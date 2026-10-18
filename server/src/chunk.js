const HEADING = /^(#{1,6})\s+(.+)$/
const SENTENCE_END = /[。！？.!?；;\n]/

function splitLongBlock(block, maxChars) {
  const parts = []
  let rest = block

  while (rest.length > maxChars) {
    let cut = maxChars
    const floor = Math.floor(maxChars * 0.55)
    for (let i = maxChars; i > floor; i -= 1) {
      if (SENTENCE_END.test(rest[i])) {
        cut = i + 1
        break
      }
    }
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trimStart()
  }

  if (rest.trim()) parts.push(rest.trim())
  return parts
}

/**
 * Paragraph-aware chunking with a small overlap, so a sentence split across
 * chunks can still be retrieved by either side.
 */
export function chunkText(text, { maxChars = 950, overlap = 140 } = {}) {
  const clean = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!clean) return []

  const blocks = clean.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  const chunks = []
  let heading = ''
  let current = ''

  const pushCurrent = () => {
    if (current.trim()) chunks.push({ text: current.trim(), heading })
    current = ''
  }

  for (const block of blocks) {
    const headingMatch = block.match(HEADING)
    if (headingMatch && block.length < 240) {
      pushCurrent()
      heading = headingMatch[2].trim()
    }

    if (block.length > maxChars) {
      pushCurrent()
      for (const part of splitLongBlock(block, maxChars)) {
        chunks.push({ text: part, heading })
      }
      continue
    }

    const nextLength = current ? current.length + block.length + 2 : block.length
    if (current && nextLength > maxChars) {
      const tail = current.slice(-overlap)
      pushCurrent()
      current = `${tail}\n\n${block}`
    } else {
      current = current ? `${current}\n\n${block}` : block
    }
  }

  pushCurrent()

  // Avoid tiny trailing chunks.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1]
    if (last.text.length < 70) {
      const previous = chunks[chunks.length - 2]
      previous.text = `${previous.text}\n\n${last.text}`
      chunks.pop()
    }
  }

  return chunks.filter((chunk) => chunk.text.length >= 20)
}
