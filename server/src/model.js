import { config } from './config.js'

export class ModelConfigError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

function normalizeBaseUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw new ModelConfigError('Base URL 格式不正确')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ModelConfigError('Base URL 只支持 http 或 https')
  }
  if (url.username || url.password) {
    throw new ModelConfigError('Base URL 不能包含账号密码')
  }

  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
}

export function normalizeProvider(input = {}) {
  return {
    baseUrl: normalizeBaseUrl(input.baseUrl || config.deepseek.baseUrl),
    apiKey: String(input.apiKey || '').trim()
  }
}

export function normalizeModelConfig(input, { allowEnvFallback = true } = {}) {
  if (!input || typeof input !== 'object') {
    if (allowEnvFallback && config.deepseek.apiKey) {
      return {
        apiKey: config.deepseek.apiKey,
        baseUrl: config.deepseek.baseUrl,
        model: config.deepseek.model,
        temperature: config.deepseek.temperature,
        source: 'env'
      }
    }
    throw new ModelConfigError('请先在模型设置中配置并测试一个模型', 503)
  }

  const apiKey = String(input.apiKey || '').trim()
  const model = String(input.model || '').trim()
  if (!apiKey) throw new ModelConfigError('请填写 API Key')
  if (!model) throw new ModelConfigError('请填写模型 ID')
  if (model.length > 120) throw new ModelConfigError('模型 ID 过长')

  const temperatureValue = Number(input.temperature)
  const temperature = Number.isFinite(temperatureValue)
    ? Math.min(2, Math.max(0, temperatureValue))
    : config.deepseek.temperature

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(input.baseUrl || config.deepseek.baseUrl),
    model,
    temperature,
    source: 'client'
  }
}

function extractProviderError(raw) {
  try {
    const parsed = JSON.parse(raw)
    return parsed.error?.message || parsed.message || ''
  } catch {
    return raw.slice(0, 240)
  }
}

export async function listAvailableModels({ baseUrl, apiKey }, { signal } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      signal: signal || AbortSignal.timeout(15_000)
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ModelConfigError('获取模型列表超时，请检查 Base URL 或网络', 502)
    }
    throw new ModelConfigError(`无法连接模型服务：${error.message}`, 502)
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    const detail = extractProviderError(raw)
    const message =
      response.status === 401 || response.status === 403
        ? '鉴权失败，请检查 API Key'
        : response.status === 404
          ? '该服务不支持 /models 接口，请手动填写模型 ID'
          : `获取模型列表失败（${response.status}）${detail ? `：${detail}` : ''}`
    throw new ModelConfigError(message, 400)
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new ModelConfigError('模型列表响应不是合法 JSON', 502)
  }

  const rawModels = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
      ? data.models
      : []

  const models = [
    ...new Set(
      rawModels
        .map((item) => (typeof item === 'string' ? item : item?.id))
        .filter((id) => typeof id === 'string' && id.trim())
        .map((id) => id.trim())
    )
  ]

  if (!models.length) {
    throw new ModelConfigError('接口没有返回可用模型，请手动填写模型 ID')
  }

  return { models, count: models.length }
}

export async function testModelConnection(modelConfig, { signal } = {}) {  const startedAt = Date.now()
  let response

  try {
    response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          { role: 'system', content: 'You are a connectivity test. Reply with exactly OK.' },
          { role: 'user', content: 'Reply with OK.' }
        ],
        temperature: 0,
        max_tokens: 8,
        stream: false
      }),
      signal: signal || AbortSignal.timeout(20_000)
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ModelConfigError('连接超时，请检查 Base URL 或网络', 502)
    }
    throw new ModelConfigError(`无法连接模型服务：${error.message}`, 502)
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    const detail = extractProviderError(raw)
    const message =
      response.status === 401 || response.status === 403
        ? '鉴权失败，请检查 API Key'
        : `模型服务返回 ${response.status}${detail ? `：${detail}` : ''}`
    throw new ModelConfigError(message, 400)
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new ModelConfigError('模型服务返回了非 JSON 响应，请检查 Base URL', 502)
  }

  return {
    latencyMs: Date.now() - startedAt,
    model: data.model || modelConfig.model,
    reply: String(data.choices?.[0]?.message?.content || '').slice(0, 80)
  }
}
