const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

async function parseError(response) {
  try {
    const data = await response.json()
    return data.error || data.message || `请求失败（${response.status}）`
  } catch {
    return `请求失败（${response.status}）`
  }
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE}/api/health`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchDocuments() {
  const response = await fetch(`${API_BASE}/api/documents`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    body: formData
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function deleteDocument(id) {
  const response = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function testModel(config) {
  const response = await fetch(`${API_BASE}/api/models/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchAvailableModels({ baseUrl, apiKey }) {
  const response = await fetch(`${API_BASE}/api/models/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl, apiKey })
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

/**
 * POST + ReadableStream SSE. Each `data:` packet is dispatched as an object
 * with a `type` field (status / thought / sources / text / done / error).
 */
export async function streamChat({ query, history, model, signal, onEvent, onActivity }) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, history, model, response_mode: 'streaming' }),
    signal
  })

  if (!response.ok) throw new Error(await parseError(response))
  if (!response.body) throw new Error('当前浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (block) => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim()

    if (!data) return
    try {
      onEvent(JSON.parse(data))
    } catch {
      // Ignore malformed keep-alive / partial packets.
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      onActivity?.()
      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
    }

    if (buffer.trim()) dispatch(buffer)
  } finally {
    reader.releaseLock()
  }
}
