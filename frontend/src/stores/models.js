import { defineStore } from 'pinia'

const STORAGE_KEY = 'kb-model-configs-v1'

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeModel(model) {
  if (!model || typeof model !== 'object' || !model.model || !model.apiKey) return null
  return {
    id: model.id || newId(),
    name: String(model.name || model.model).slice(0, 40),
    baseUrl: String(model.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, ''),
    model: String(model.model).slice(0, 120),
    apiKey: String(model.apiKey),
    temperature: Number.isFinite(Number(model.temperature)) ? Number(model.temperature) : 0.25,
    testedAt: model.testedAt || new Date().toISOString(),
    createdAt: model.createdAt || new Date().toISOString()
  }
}

export const useModelStore = defineStore('models', {
  state: () => ({
    models: [],
    activeId: null,
    ready: false,
    settingsOpen: false
  }),

  getters: {
    activeModel: (state) =>
      state.models.find((model) => model.id === state.activeId) || null
  },

  actions: {
    init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          this.models = (Array.isArray(saved.models) ? saved.models : [])
            .map(normalizeModel)
            .filter(Boolean)
          this.activeId = this.models.some((model) => model.id === saved.activeId)
            ? saved.activeId
            : this.models[0]?.id || null
        }
      } catch {
        this.models = []
        this.activeId = null
      }
      this.ready = true
    },

    persist() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ activeId: this.activeId, models: this.models })
        )
      } catch {
        // localStorage may be full or disabled; the form will still work this session.
      }
    },

    openSettings() {
      this.settingsOpen = true
    },

    closeSettings() {
      this.settingsOpen = false
    },

    activate(id) {
      if (!this.models.some((model) => model.id === id)) return
      this.activeId = id
      this.persist()
    },

    saveModel(input) {
      const model = normalizeModel({
        ...input,
        id: input.id || newId(),
        testedAt: new Date().toISOString()
      })
      if (!model) return null

      const index = this.models.findIndex((item) => item.id === model.id)
      if (index >= 0) {
        this.models[index] = { ...this.models[index], ...model }
      } else {
        this.models.unshift(model)
      }
      this.activeId = model.id
      this.persist()
      return model
    },

    removeModel(id) {
      this.models = this.models.filter((model) => model.id !== id)
      if (this.activeId === id) {
        this.activeId = this.models[0]?.id || null
      }
      this.persist()
    }
  }
})
