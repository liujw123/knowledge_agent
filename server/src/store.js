import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { extractText } from './extract.js'
import { chunkText } from './chunk.js'
import { BM25Index } from './rag.js'

const STATE_VERSION = 1

export class KnowledgeStore {
  constructor() {
    this.documents = []
    this.chunks = []
    this.index = new BM25Index([])
    this.stateFile = path.join(config.dataDir, 'knowledge.json')
    this.filesDir = path.join(config.dataDir, 'files')
    this.writeQueue = Promise.resolve()
  }

  async init() {
    await fs.mkdir(this.filesDir, { recursive: true })

    try {
      const raw = await fs.readFile(this.stateFile, 'utf8')
      const state = JSON.parse(raw)
      if (Array.isArray(state.documents)) {
        this.documents = state.documents.filter(
          (document) => document && Array.isArray(document.chunks)
        )
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[knowledge] Failed to load state:', error.message)
      }
    }

    this.rebuild()
  }

  rebuild() {
    this.chunks = this.documents.flatMap((document) =>
      document.chunks.map((chunk) => ({
        ...chunk,
        documentId: document.id,
        documentName: document.name,
        fileType: document.extension
      }))
    )
    this.index = new BM25Index(this.chunks)
  }

  list() {
    return this.documents.map(({ chunks, ...document }) => document)
  }

  stats() {
    return {
      documentCount: this.documents.length,
      chunks: this.chunks.length
    }
  }

  search(query, limit = config.agent.topK) {
    return this.index.search(query, limit)
  }

  async persist(documents) {
    const state = JSON.stringify({ version: STATE_VERSION, documents })
    const temporaryFile = `${this.stateFile}.tmp`

    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      await fs.writeFile(temporaryFile, state, 'utf8')
      await fs.rename(temporaryFile, this.stateFile)
    })

    return this.writeQueue
  }

  async addDocument({ name, buffer, size }) {
    const extension = path.extname(name).toLowerCase()
    const id = randomUUID()
    const text = await extractText(name, buffer, config.upload.maxExtractedChars)
    const chunks = chunkText(text).map((chunk, index) => ({
      id: `${id}-${index}`,
      index,
      text: chunk.text,
      heading: chunk.heading
    }))

    if (!chunks.length) throw new Error('文档内容过短，无法建立索引')

    const document = {
      id,
      name,
      extension,
      size,
      createdAt: new Date().toISOString(),
      characters: text.length,
      chunkCount: chunks.length,
      chunks
    }

    const storedFile = path.join(this.filesDir, `${id}${extension}`)
    await fs.writeFile(storedFile, buffer)
    const nextDocuments = [document, ...this.documents]

    try {
      await this.persist(nextDocuments)
    } catch (error) {
      await fs.unlink(storedFile).catch(() => {})
      throw error
    }

    this.documents = nextDocuments
    this.rebuild()

    const { chunks: _chunks, ...publicDocument } = document
    return publicDocument
  }

  async removeDocument(id) {
    const document = this.documents.find((item) => item.id === id)
    if (!document) return false

    const nextDocuments = this.documents.filter((item) => item.id !== id)
    await this.persist(nextDocuments)
    await fs.unlink(path.join(this.filesDir, `${document.id}${document.extension}`)).catch(() => {})

    this.documents = nextDocuments
    this.rebuild()
    return true
  }
}

export const knowledgeStore = new KnowledgeStore()
