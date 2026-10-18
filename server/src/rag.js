const CJK = /[\u3400-\u9fff]/
const TOKEN_PATTERN = /[a-z0-9]+|[\u3400-\u9fff]+/g
const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'were', 'will', 'with', 'what', 'which', 'who', 'how', 'why'
])

/**
 * English words are indexed as-is. Chinese has no whitespace, so overlapping
 * character bigrams are used (e.g. 知识库 -> 知识 / 识库).
 */
export function tokenize(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase()
  const tokens = []

  for (const match of normalized.matchAll(TOKEN_PATTERN)) {
    const part = match[0]
    if (!CJK.test(part)) {
      if (part.length > 1 && !ENGLISH_STOP_WORDS.has(part)) tokens.push(part)
      continue
    }

    if (part.length === 1) {
      tokens.push(part)
      continue
    }
    for (let i = 0; i < part.length - 1; i += 1) {
      tokens.push(part.slice(i, i + 2))
    }
  }

  return tokens
}

export class BM25Index {
  constructor(chunks = []) {
    this.chunks = chunks
    this.postings = new Map()
    this.lengths = []
    this.averageLength = 0
    this.build()
  }

  build() {
    let totalLength = 0

    this.chunks.forEach((chunk, chunkIndex) => {
      const searchable = `${chunk.heading || ''}\n${chunk.heading || ''}\n${chunk.text}`
      const tokens = tokenize(searchable)
      const frequencies = new Map()

      for (const token of tokens) {
        frequencies.set(token, (frequencies.get(token) || 0) + 1)
      }

      this.lengths[chunkIndex] = tokens.length
      totalLength += tokens.length

      for (const [token, frequency] of frequencies) {
        if (!this.postings.has(token)) this.postings.set(token, [])
        this.postings.get(token).push([chunkIndex, frequency])
      }
    })

    this.averageLength = this.chunks.length ? totalLength / this.chunks.length : 0
  }

  search(query, limit = 5) {
    if (!this.chunks.length) return []

    const terms = [...new Set(tokenize(query))]
    if (!terms.length) return []

    const scores = new Map()
    const total = this.chunks.length
    const k1 = 1.4
    const b = 0.75

    for (const term of terms) {
      const postings = this.postings.get(term)
      if (!postings) continue

      const documentFrequency = postings.length
      const inverseDocumentFrequency = Math.log(
        1 + (total - documentFrequency + 0.5) / (documentFrequency + 0.5)
      )

      for (const [chunkIndex, frequency] of postings) {
        const length = this.lengths[chunkIndex] || 1
        const denominator =
          frequency + k1 * (1 - b + b * (length / (this.averageLength || 1)))
        const score = inverseDocumentFrequency * ((frequency * (k1 + 1)) / denominator)
        scores.set(chunkIndex, (scores.get(chunkIndex) || 0) + score)
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, limit))
      .map(([chunkIndex, score]) => ({ ...this.chunks[chunkIndex], score }))
  }
}
