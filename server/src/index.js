import express from 'express'
import cors from 'cors'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { knowledgeStore } from './store.js'
import { ExtractError } from './extract.js'
import { createAgent } from './agent.js'
import { DeepSeekError } from './deepseek.js'
import {
  ModelConfigError,
  listAvailableModels,
  normalizeModelConfig,
  normalizeProvider,
  testModelConnection
} from './model.js'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = express()

app.disable('x-powered-by')
app.use(
  cors({
    origin:
      config.corsOrigin === '*'
        ? true
        : config.corsOrigin.split(',').map((origin) => origin.trim())
  })
)
app.use(express.json({ limit: '2mb' }))

app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: '请求过于频繁，请稍后再试' }
  })
)

const upload = multer({
  storage: multer.memoryStorage(),
  ...(config.upload.maxBytes > 0
    ? { limits: { fileSize: config.upload.maxBytes, files: 1 } }
    : {})
})

// Busboy decodes multipart filenames as latin1; restore UTF-8 for Chinese names.
function decodeFileName(name) {
  if (!name || /^[\x00-\x7F]*$/.test(name)) return name
  const decoded = Buffer.from(name, 'latin1').toString('utf8')
  return decoded.includes('\uFFFD') ? name : decoded
}

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    model: config.deepseek.model,
    envModelConfigured: Boolean(config.deepseek.apiKey),
    ...knowledgeStore.stats()
  })
})

app.post('/api/models/test', async (request, response, next) => {
  try {
    const modelConfig = normalizeModelConfig(request.body, { allowEnvFallback: false })
    const result = await testModelConnection(modelConfig)
    response.json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})

app.post('/api/models/list', async (request, response, next) => {
  try {
    const provider = normalizeProvider(request.body)
    const result = await listAvailableModels(provider)
    response.json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})

app.get('/api/documents', async (_request, response, next) => {
  try {
    await knowledgeStore.cleanupExpired()
    response.json({
      documents: knowledgeStore.list(),
      ...knowledgeStore.stats()
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/documents', upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: '请选择要上传的文件' })
      return
    }

    const document = await knowledgeStore.addDocument({
      name: decodeFileName(request.file.originalname),
      buffer: request.file.buffer,
      size: request.file.size
    })

    response.status(201).json({
      document,
      ...knowledgeStore.stats()
    })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/documents/:id', async (request, response, next) => {
  try {
    const removed = await knowledgeStore.removeDocument(request.params.id)
    if (!removed) {
      response.status(404).json({ error: '文档不存在' })
      return
    }
    response.json({ ok: true, ...knowledgeStore.stats() })
  } catch (error) {
    next(error)
  }
})

app.post('/api/chat', async (request, response) => {
  const query = typeof request.body?.query === 'string' ? request.body.query.trim() : ''
  const history = request.body?.history

  if (!query) {
    response.status(400).json({ error: '问题不能为空' })
    return
  }
  if (query.length > 4000) {
    response.status(400).json({ error: '问题过长，请控制在 4000 字以内' })
    return
  }

  let modelConfig
  try {
    modelConfig = normalizeModelConfig(request.body?.model)
  } catch (error) {
    if (error instanceof ModelConfigError) {
      response.status(error.statusCode).json({ error: error.message })
      return
    }
    console.error('[model-config]', error)
    response.status(500).json({ error: '模型配置校验失败' })
    return
  }

  try {
    await knowledgeStore.cleanupExpired()
  } catch (error) {
    console.error('[knowledge] cleanup before chat failed:', error.message)
  }

  response.status(200)
  response.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  response.flushHeaders?.()

  const controller = new AbortController()
  response.on('close', () => {
    if (!response.writableEnded) controller.abort()
  })

  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(': ping\n\n')
  }, 15_000)
  heartbeat.unref?.()

  const emit = (type, payload = {}) => {
    if (response.writableEnded || response.destroyed) return
    try {
      response.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`)
    } catch {
      controller.abort()
    }
  }

  try {
    const agent = createAgent({
      store: knowledgeStore,
      emit,
      signal: controller.signal,
      modelConfig
    })
    await agent.run({ query, history })
  } catch (error) {
    if (error.name === 'AbortError') {
      emit('aborted', { message: '已停止生成' })
    } else {
      console.error('[chat]', error)
      const message =
        error instanceof DeepSeekError && error.status === 503
          ? error.message
          : error.message || '生成失败，请稍后重试'
      emit('error', { message })
    }
  } finally {
    clearInterval(heartbeat)
    if (!response.writableEnded) response.end()
  }
})

const frontendDist = path.resolve(serverRoot, '../frontend/dist')
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist))
  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) return next()
    return response.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  app.get('/', (_request, response) => {
    response.json({
      name: 'Knowledge Agent API',
      hint: '前端开发服务器运行在 http://localhost:5173'
    })
  })
}

app.use((request, response) => {
  response.status(404).json({ error: `接口不存在：${request.method} ${request.path}` })
})

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ error: '请求体不是合法的 JSON' })
    return
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `文件不能超过 ${Math.round(config.upload.maxBytes / 1024 / 1024)} MB`
        : `上传失败：${error.message}`
    response.status(400).json({ error: message })
    return
  }

  if (error instanceof ModelConfigError) {
    response.status(error.statusCode).json({ error: error.message })
    return
  }

  if (error instanceof ExtractError) {
    response.status(error.statusCode).json({ error: error.message })
    return
  }

  console.error('[server]', error)
  response.status(500).json({ error: '服务器内部错误' })
})

await knowledgeStore.init()

const cleanupTimer = setInterval(async () => {
  try {
    const removed = await knowledgeStore.cleanupExpired()
    if (removed) console.log(`[knowledge] removed ${removed} expired document(s)`)
  } catch (error) {
    console.error('[knowledge] scheduled cleanup failed:', error.message)
  }
}, config.cleanupIntervalMinutes * 60_000)
cleanupTimer.unref?.()

app.listen(config.port, config.host, () => {
  console.log(`[server] http://localhost:${config.port}`)
  console.log(`[server] model: ${config.deepseek.model}`)
  console.log(`[server] knowledge TTL: ${config.documentTtlHours}h`)
  if (!config.deepseek.apiKey) {
    console.warn('[server] 未配置服务端兜底 DEEPSEEK_API_KEY，聊天模型由前端模型设置提供')
  }
})
