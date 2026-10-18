import { config } from './config.js'

export class DeepSeekError extends Error {
  constructor(message, status = 502, details = '') {
    super(message)
    this.status = status
    this.details = details
  }
}

function parseErrorBody(body) {
  try {
    const parsed = JSON.parse(body)
    return parsed.error?.message || parsed.message || body
  } catch {
    return body
  }
}

/**
 * Calls DeepSeek's OpenAI-compatible streaming API. Both answer deltas and
 * streamed tool_calls are supported.
 */
export async function streamCompletion({
  messages,
  tools,
  signal,
  onDelta,
  modelConfig = {
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
    model: config.deepseek.model,
    temperature: config.deepseek.temperature
  }
}) {
  if (!modelConfig.apiKey) {
    throw new DeepSeekError('未配置模型 API Key', 503)
  }

  const body = {
    model: modelConfig.model,
    messages,
    temperature: modelConfig.temperature,
    stream: true
  }
  if (tools?.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  let response
  try {
    response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify(body),
      signal
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new DeepSeekError(`无法连接模型服务：${error.message}`)
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    throw new DeepSeekError(
      `模型请求失败（${response.status}）`,
      502,
      parseErrorBody(raw)
    )
  }
  if (!response.body) throw new DeepSeekError('DeepSeek 未返回流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const toolCallMap = new Map()
  let buffer = ''
  let content = ''
  let finishReason = ''

  const consume = (line) => {
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return

    let event
    try {
      event = JSON.parse(payload)
    } catch {
      return
    }

    const choice = event.choices?.[0]
    if (!choice) return
    if (choice.finish_reason) finishReason = choice.finish_reason

    const delta = choice.delta || {}
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content
      onDelta?.(delta.content)
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const call of delta.tool_calls) {
        const index = Number.isInteger(call.index) ? call.index : toolCallMap.size
        if (!toolCallMap.has(index)) {
          toolCallMap.set(index, {
            id: '',
            type: 'function',
            function: { name: '', arguments: '' }
          })
        }
        const target = toolCallMap.get(index)
        if (call.id) target.id = call.id
        if (call.function?.name) target.function.name += call.function.name
        if (call.function?.arguments) target.function.arguments += call.function.arguments
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) consume(line)
  }

  if (buffer) consume(buffer)

  const toolCalls = [...toolCallMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, call]) => ({
      ...call,
      id: call.id || `call_${index}_${Date.now()}`
    }))
    .filter((call) => call.function.name)

  return { content, toolCalls, finishReason }
}
