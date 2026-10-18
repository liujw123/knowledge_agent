<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatComposer from './components/ChatComposer.vue'
import EmptyState from './components/EmptyState.vue'
import SourceDrawer from './components/SourceDrawer.vue'
import ModelSettings from './components/ModelSettings.vue'
import ToastStack from './components/ToastStack.vue'
import AppIcon from './components/AppIcon.vue'
import { useChatStore } from './stores/chat'
import { useKnowledgeStore } from './stores/knowledge'
import { useModelStore } from './stores/models'
import { useUiStore } from './stores/ui'
import { fetchHealth } from './api'

const chat = useChatStore()
const knowledge = useKnowledgeStore()
const models = useModelStore()
const ui = useUiStore()

const sidebarOpen = ref(false)
const sidebarTab = ref('chats')
const scrollElement = ref(null)
const composer = ref(null)
const connectionError = ref('')
const stickToBottom = ref(true)
let knowledgeTimer = null

const sourceDrawer = reactive({
  open: false,
  sources: [],
  activeCitation: 0
})

const sessionTitle = computed(() => chat.activeSession?.title || '新对话')
const messages = computed(() => chat.activeSession?.messages || [])
const lastMessage = computed(() => messages.value[messages.value.length - 1] || null)

const apiState = computed(() => {
  if (connectionError.value) return { label: '后端未连接', className: 'offline' }
  if (!models.ready) return { label: '连接中', className: 'checking' }
  if (!models.activeModel) return { label: '未配置模型', className: 'warning' }
  return {
    label: models.activeModel.name || models.activeModel.model,
    className: 'online'
  }
})

const configBanner = computed(() => {
  if (connectionError.value) {
    return {
      type: 'error',
      text: '无法连接后端服务，请确认已运行 pnpm dev，且端口 3001 可用。',
      action: '重试',
      target: 'health'
    }
  }
  if (models.ready && !models.activeModel) {
    return {
      type: 'warning',
      text: '还没有可用的模型。请添加模型、完成连接测试并保存，之后才能开始对话。',
      action: '配置模型',
      target: 'models'
    }
  }
  return null
})

function scrollToBottom(force = false) {
  if (force) stickToBottom.value = true
  if (!stickToBottom.value) return

  nextTick(() => {
    const element = scrollElement.value
    if (!element) return
    element.scrollTop = element.scrollHeight
  })
}

function onScroll() {
  const element = scrollElement.value
  if (!element) return
  stickToBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight < 160
}

async function loadHealth() {
  connectionError.value = ''
  try {
    await fetchHealth()
  } catch (error) {
    connectionError.value = error.message
  }
}

function send(text) {
  if (!text || chat.streaming) return
  if (!models.activeModel) {
    ui.toast('请先配置并测试一个模型', 'error')
    models.openSettings()
    return
  }
  scrollToBottom(true)
  chat.send(text)
  nextTick(() => scrollToBottom(true))
}

function handleBannerAction() {
  if (configBanner.value?.target === 'models') {
    models.openSettings()
    return
  }
  loadHealth()
}

function newChat() {
  if (chat.streaming) return
  chat.createSession()
  sidebarTab.value = 'chats'
  sidebarOpen.value = false
  nextTick(() => composer.value?.focus())
}

function openSources(payload) {
  if (!payload?.sources?.length) return
  sourceDrawer.sources = payload.sources
  sourceDrawer.activeCitation = payload.citation || payload.sources[0].citation
  sourceDrawer.open = true
}

function openKnowledgeSidebar() {
  sidebarTab.value = 'knowledge'
  sidebarOpen.value = true
}

function handleGlobalKey(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    newChat()
  }
}

watch(
  () => {
    const message = lastMessage.value
    return [
      chat.activeId,
      messages.value.length,
      message?.content?.length || 0,
      message?.thoughts?.length || 0,
      message?.sources?.length || 0,
      message?.status || '',
      chat.tick
    ].join(':')
  },
  () => scrollToBottom()
)

watch(
  () => chat.activeId,
  () => {
    stickToBottom.value = true
    scrollToBottom(true)
  }
)

onMounted(async () => {
  models.init()
  chat.init()
  loadHealth()
  knowledge.fetch()
  window.addEventListener('keydown', handleGlobalKey)
  knowledgeTimer = window.setInterval(() => knowledge.fetch(), 60_000)
  await nextTick()
  scrollToBottom(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKey)
  if (knowledgeTimer) window.clearInterval(knowledgeTimer)
})
</script>

<template>
  <div class="app-shell">
    <Sidebar
      :open="sidebarOpen"
      :tab="sidebarTab"
      @close="sidebarOpen = false"
      @update:tab="sidebarTab = $event"
    />
    <div
      v-if="sidebarOpen"
      class="sidebar-scrim"
      @click="sidebarOpen = false"
    />

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-button mobile-menu" title="打开菜单" @click="sidebarOpen = true">
            <AppIcon name="menu" :size="19" />
          </button>
          <div class="topbar-title">
            <span class="topbar-crumb">知识库助手</span>
            <h1>{{ sessionTitle }}</h1>
          </div>
        </div>

        <div class="topbar-right">
          <span class="kb-metric">
            <AppIcon name="database" :size="13" />
            {{ knowledge.documentCount }} 文档 · {{ knowledge.chunks }} 片段
          </span>
          <button
            type="button"
            class="model-pill"
            :class="apiState.className"
            title="模型设置"
            @click="models.openSettings()"
          >
            <span class="status-dot" />
            {{ apiState.label }}
          </button>
        </div>
      </header>

      <div v-if="configBanner" class="config-banner" :class="configBanner.type">
        <span class="banner-icon">
          <AppIcon :name="configBanner.type === 'error' ? 'alert' : 'sparkles'" :size="15" />
        </span>
        <span class="banner-text">{{ configBanner.text }}</span>
        <button type="button" @click="handleBannerAction">{{ configBanner.action }}</button>
      </div>

      <main ref="scrollElement" class="chat-scroll" @scroll.passive="onScroll">
        <div class="chat-inner" :class="{ 'is-empty': !messages.length }">
          <EmptyState
            v-if="!messages.length"
            :document-count="knowledge.documentCount"
            :chunk-count="knowledge.chunks"
            @prompt="send"
          />

          <template v-else>
            <ChatMessage
              v-for="(message, index) in messages"
              :key="message.id"
              :message="message"
              :is-last="index === messages.length - 1"
              :stream-status="chat.streamStatus"
              @regenerate="chat.regenerate"
              @open-source="openSources"
            />

            <div v-if="!knowledge.documentCount" class="first-upload-hint">
              <span><AppIcon name="upload" :size="15" /></span>
              <p>知识库还没有文档，上传资料后回答会带可溯源的引用。</p>
              <button type="button" @click="openKnowledgeSidebar">去上传</button>
            </div>
          </template>
        </div>
      </main>

      <div class="composer-region">
        <ChatComposer
          ref="composer"
          :streaming="chat.streaming"
          :status="chat.streamStatus"
          :document-count="knowledge.documentCount"
          @send="send"
          @stop="chat.stop"
        />
      </div>
    </div>

    <SourceDrawer
      :open="sourceDrawer.open"
      :sources="sourceDrawer.sources"
      :active-citation="sourceDrawer.activeCitation"
      @close="sourceDrawer.open = false"
      @select="sourceDrawer.activeCitation = $event"
    />

    <ModelSettings :open="models.settingsOpen" @close="models.closeSettings()" />

    <ToastStack />
  </div>
</template>
