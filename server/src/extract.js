import path from 'node:path'
import mammoth from 'mammoth'

const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.csv', '.json', '.log', '.xml', '.yaml', '.yml']

export class ExtractError extends Error {
  constructor(message, statusCode = 422) {
    super(message)
    this.statusCode = statusCode
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim()
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, 8192)
  if (!sample.length) return false
  let control = 0
  for (const byte of sample) {
    if (byte === 0) return true
    if (byte < 7 || (byte > 13 && byte < 32)) control += 1
  }
  return control / sample.length > 0.08
}

function htmlToText(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

export async function extractText(fileName, buffer, maxChars = 0) {
  const extension = path.extname(fileName).toLowerCase()
  let text = ''

  if (TEXT_EXTENSIONS.includes(extension)) {
    text = buffer.toString('utf8')
  } else if (extension === '.html' || extension === '.htm') {
    text = htmlToText(buffer.toString('utf8'))
  } else if (extension === '.pdf') {
    try {
      const module = await import('pdf-parse/lib/pdf-parse.js')
      const pdfParse = module.default || module
      const result = await pdfParse(buffer)
      text = result.text
    } catch {
      throw new ExtractError('PDF 解析失败，请确认文件没有加密或损坏')
    }
  } else if (extension === '.docx') {
    try {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } catch {
      throw new ExtractError('DOCX 解析失败，请确认文件格式正确')
    }
  } else {
    if (isProbablyBinary(buffer)) {
      throw new ExtractError(
        '文件已接收，但该二进制格式无法提取文字。可索引格式包括文本、Markdown、HTML、PDF、DOCX 等',
        415
      )
    }
    text = buffer.toString('utf8')
  }

  text = cleanText(text)
  if (!text) throw new ExtractError('没有从文件中读取到文字，可能是扫描版 PDF 或空文件')
  if (maxChars > 0 && text.length > maxChars) text = text.slice(0, maxChars)

  return text
}
