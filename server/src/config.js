import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

const number = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  port: number(process.env.PORT, 3001),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  deepseek: {
    apiKey: (process.env.DEEPSEEK_API_KEY || '').trim(),
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    temperature: number(process.env.DEEPSEEK_TEMPERATURE, 0.25)
  },
  agent: {
    maxRounds: number(process.env.AGENT_MAX_ROUNDS, 4),
    topK: number(process.env.RAG_TOP_K, 5)
  },
  upload: {
    // 0 means no explicit size limit. Set MAX_UPLOAD_MB to enforce one.
    maxBytes: process.env.MAX_UPLOAD_MB
      ? number(process.env.MAX_UPLOAD_MB, 20) * 1024 * 1024
      : 0,
    maxExtractedChars: process.env.MAX_EXTRACTED_CHARS
      ? number(process.env.MAX_EXTRACTED_CHARS, 800_000)
      : 0
  },
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(serverRoot, 'data')
}
