import { defineStore } from 'pinia'
import { fetchDocuments, uploadDocument, deleteDocument } from '../api'

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    documents: [],
    chunks: 0,
    loading: false,
    uploading: false,
    error: ''
  }),
  getters: {
    documentCount: (state) => state.documents.length
  },
  actions: {
    async fetch() {
      this.loading = true
      this.error = ''
      try {
        const data = await fetchDocuments()
        this.documents = data.documents || []
        this.chunks = data.chunks || 0
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },
    async upload(file) {
      if (this.uploading) return null
      this.uploading = true
      this.error = ''
      try {
        const data = await uploadDocument(file)
        this.documents.unshift(data.document)
        this.chunks = data.chunks
        return data.document
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.uploading = false
      }
    },
    async remove(id) {
      this.error = ''
      try {
        const data = await deleteDocument(id)
        this.documents = this.documents.filter((document) => document.id !== id)
        this.chunks = data.chunks
      } catch (error) {
        this.error = error.message
        throw error
      }
    }
  }
})
