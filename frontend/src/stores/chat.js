import { defineStore } from 'pinia'
import { streamChat } from '../api'
import { useModelStore } from './models'

const STORAGE_KEY = 'zhiwei-chat-v1'
const MAX_SESSIONS = 30
const MAX_MESSAGES = 80

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function makeTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean || '新对话'
}

function makeMessage(role, content = '') {
  return {
    id: newId(),
    role,
    content,
    thoughts: [],
    sources: [],
    status: role === 'assistant' ? 'thinking' : 'done',
    error: '',
    createdAt: new Date().toISOString()
  }
}

function normalizeSession(session) {
  return {
    id: session.id || newId(),
    title: session.title || '新对话',
    createdAt: session.createdAt || new Date().toISOString(),
    updatedAt: session.updatedAt || session.createdAt || new Date().toISOString(),
    messages: Array.isArray(session.messages)
      ? session.messages.map((message) => {
          const interrupted =
            message.role === 'assistant' &&
            ['thinking', 'streaming'].includes(message.status)

          return {
            ...message,
            thoughts: Array.isArray(message.thoughts) ? message.thoughts : [],
            sources: Array.isArray(message.sources) ? message.sources : [],
            status: interrupted ? 'stopped' : message.status || 'done',
            error: interrupted
              ? '页面刷新导致生成中断，请重新生成'
              : message.error || ''
          }
        })
      : []
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    sessions: [],
    activeId: null,
    streaming: false,
    streamStatus: '',
    controller: null,
    tick: 0
  }),

  getters: {
    activeSession: (state) => state.sessions.find((session) => session.id === state.activeId) || null,
    hasMessages() {
      return Boolean(this.activeSession?.messages.length)
    }
  },

  actions: {
    init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          this.sessions = Array.isArray(saved.sessions)
            ? saved.sessions.map(normalizeSession)
            : []
          this.activeId = this.sessions.some((session) => session.id === saved.activeId)
            ? saved.activeId
            : this.sessions[0]?.id || null
        }
      } catch {
        this.sessions = []
      }

      if (!this.sessions.length) this.createSession()
    },

    createSession() {
      if (this.streaming) return null
      const session = {
        id: newId(),
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      this.sessions.unshift(session)
      if (this.sessions.length > MAX_SESSIONS) this.sessions.pop()
      this.activeId = session.id
      this.save()
      return session
    },

    selectSession(id) {
      if (this.streaming) return
      if (this.sessions.some((session) => session.id === id)) {
        this.activeId = id
        this.save()
      }
    },

    deleteSession(id) {
      if (this.streaming) return
      this.sessions = this.sessions.filter((session) => session.id !== id)
      if (!this.sessions.length) {
        this.createSession()
      } else if (this.activeId === id) {
        this.activeId = this.sessions[0].id
        this.save()
      } else {
        this.save()
      }
    },

    save() {
      const sessions = this.sessions.slice(0, MAX_SESSIONS).map((session) => ({
        ...session,
        messages: session.messages.slice(-MAX_MESSAGES).map((message) => ({
          ...message,
          sources: (message.sources || []).map((source) => ({
            ...source,
            text: String(source.text || '').slice(0, 1800)
          }))
        }))
      }))

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ activeId: this.activeId, sessions })
        )
      } catch {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              activeId: this.activeId,
              sessions: sessions.slice(0, 8).map((session) => ({
                ...session,
                messages: session.messages.slice(-30)
              }))
            })
          )
        } catch {
          // Storage is a convenience; never break chatting because it is full.
        }
      }
    },

    async send(rawText) {
      const text = String(rawText || '').trim()
      if (!text || this.streaming) return

      const model = useModelStore().activeModel
      if (!model) return

      let session = this.activeSession
      if (!session) session = this.createSession()
      if (!session) return

      const history = session.messages
        .filter(
          (message) =>
            message.role &&
            message.content?.trim() &&
            message.status !== 'error' &&
            message.status !== 'thinking'
        )
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content }))

      const userMessage = makeMessage('user', text)
      const assistantMessage = makeMessage('assistant')

      session.messages.push(userMessage, assistantMessage)
      // Read the reactive proxy back from the store; mutating the raw object
      // would not trigger component updates.
      const assistant = session.messages[session.messages.length - 1]
      if (session.title === '新对话') session.title = makeTitle(text)
      session.updatedAt = new Date().toISOString()
      this.save()

      await this.runStream({
        session,
        assistant,
        query: text,
        history,
        model: {
          baseUrl: model.baseUrl,
          model: model.model,
          apiKey: model.apiKey,
          temperature: model.temperature
        }
      })
    },

    async regenerate(assistantId) {
      if (this.streaming) return
      const model = useModelStore().activeModel
      if (!model) return
      const session = this.activeSession
      if (!session) return

      const assistantIndex = session.messages.findIndex((message) => message.id === assistantId)
      if (assistantIndex < 0) return

      let userIndex = -1
      for (let index = assistantIndex - 1; index >= 0; index -= 1) {
        if (session.messages[index].role === 'user') {
          userIndex = index
          break
        }
      }
      if (userIndex < 0) return

      const query = session.messages[userIndex].content
      const history = session.messages
        .slice(0, userIndex)
        .filter((message) => message.content?.trim() && message.status !== 'error')
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content }))

      session.messages.splice(assistantIndex)
      const assistantMessage = makeMessage('assistant')
      session.messages.push(assistantMessage)
      const assistant = session.messages[session.messages.length - 1]
      session.updatedAt = new Date().toISOString()
      this.save()

      await this.runStream({
        session,
        assistant,
        query,
        history,
        model: {
          baseUrl: model.baseUrl,
          model: model.model,
          apiKey: model.apiKey,
          temperature: model.temperature
        }
      })
    },

    stop() {
      this.controller?.abort()
    },

    async runStream({ session, assistant, query, history, model }) {
      const controller = new AbortController()
      this.controller = controller
      this.streaming = true
      this.streamStatus = '正在连接知识库…'
      let buffer = ''
      let frame = 0
      let serverError = ''
      let watchdogFired = false
      let watchdogTimer = 0

      const armWatchdog = () => {
        window.clearTimeout(watchdogTimer)
        watchdogTimer = window.setTimeout(() => {
          watchdogFired = true
          controller.abort()
        }, 45_000)
      }

      const flush = () => {
        if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
        if (!buffer) return
        assistant.content += buffer
        buffer = ''
        assistant.status = 'streaming'
        this.tick += 1
      }

      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(flush)
      }

      armWatchdog()

      try {
        await streamChat({
          query,
          history,
          model,
          signal: controller.signal,
          onActivity: armWatchdog,
          onEvent: (event) => {
            switch (event.type) {
              case 'status':
                this.streamStatus = event.text || ''
                break
              case 'thought': {
                const index = assistant.thoughts.findIndex(
                  (thought) => thought.id === event.id
                )
                const thought = {
                  id: event.id,
                  title: event.title,
                  detail: event.detail,
                  status: event.status
                }
                if (index >= 0) assistant.thoughts[index] = thought
                else assistant.thoughts.push(thought)
                break
              }
              case 'sources':
                assistant.sources = Array.isArray(event.sources) ? event.sources : []
                break
              case 'text':
                if (event.delta) {
                  buffer += event.delta
                  schedule()
                }
                break
              case 'done':
                if (Array.isArray(event.sources)) assistant.sources = event.sources
                break
              case 'error':
                serverError = event.message || '生成失败，请稍后重试'
                break
              default:
                break
            }
          }
        })

        flush()
        if (serverError) throw new Error(serverError)
        if (!assistant.content.trim()) throw new Error('没有收到回答内容，请重试')

        assistant.status = 'done'
        assistant.error = ''
        this.streamStatus = ''
      } catch (error) {
        flush()
        if (watchdogFired) {
          assistant.status = 'error'
          assistant.error = '连接超时或服务已重启，请重新生成'
        } else if (error.name === 'AbortError' || controller.signal.aborted) {
          assistant.status = 'stopped'
          assistant.error = ''
        } else {
          assistant.status = 'error'
          assistant.error = error.message || '生成失败，请稍后重试'
        }
      } finally {
        window.clearTimeout(watchdogTimer)
        flush()
        this.streaming = false
        this.controller = null
        this.streamStatus = ''
        session.updatedAt = new Date().toISOString()
        this.tick += 1
        this.save()
      }
    }
  }
})
