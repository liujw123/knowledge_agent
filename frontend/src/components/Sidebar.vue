<script setup>
import { computed, ref } from 'vue'
import { useChatStore } from '../stores/chat'
import { useKnowledgeStore } from '../stores/knowledge'
import { useUiStore } from '../stores/ui'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  tab: { type: String, default: 'chats' }
})
const emit = defineEmits(['close', 'update:tab'])

const chat = useChatStore()
const knowledge = useKnowledgeStore()
const ui = useUiStore()

const activeTab = computed({
  get: () => props.tab,
  set: (value) => emit('update:tab', value)
})
const dragging = ref(false)
const fileInput = ref(null)

const sessions = computed(() => chat.sessions)
const documentCount = computed(() => knowledge.documents.length)

function selectSession(id) {
  chat.selectSession(id)
  emit('close')
}

function createSession() {
  chat.createSession()
  activeTab.value = 'chats'
  emit('close')
}

function removeSession(id) {
  if (!window.confirm('确定删除这个会话吗？')) return
  chat.deleteSession(id)
}

function openFilePicker() {
  if (!knowledge.uploading) fileInput.value?.click()
}

function handleFiles(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length || knowledge.uploading) return
  uploadFiles(files)
}

async function uploadFiles(files) {
  for (const file of files) {
    try {
      const document = await knowledge.upload(file)
      if (document) {
        activeTab.value = 'knowledge'
        ui.toast(`《${document.name}》已切分并加入索引`, 'success')
      }
    } catch (error) {
      ui.toast(error.message || '上传失败', 'error')
    }
  }

  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(event) {
  dragging.value = false
  handleFiles(event.dataTransfer?.files)
}

async function removeDocument(document) {
  if (!window.confirm(`确定从知识库移除《${document.name}》吗？`)) return
  try {
    await knowledge.remove(document.id)
    ui.toast('文档已从知识库移除', 'success')
  } catch (error) {
    ui.toast(error.message || '删除失败', 'error')
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(
      new Date(value)
    )
  } catch {
    return ''
  }
}

function preview(session) {
  const last = [...session.messages].reverse().find((message) => message.content)
  return last?.content?.replace(/\s+/g, ' ').slice(0, 46) || '开始一段新的对话'
}
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <div class="brand-mark">
        <AppIcon name="sparkles" :size="20" :stroke-width="2" />
      </div>
      <div class="brand-copy">
        <strong>知微</strong>
        <span>Knowledge Agent</span>
      </div>
      <button class="icon-button brand-close" title="关闭菜单" @click="emit('close')">
        <AppIcon name="close" :size="18" />
      </button>
    </div>

    <button class="new-chat" :disabled="chat.streaming" @click="createSession">
      <AppIcon name="plus" :size="17" />
      <span>新建对话</span>
      <kbd>⌘ K</kbd>
    </button>

    <div class="sidebar-tabs">
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'chats' }"
        @click="activeTab = 'chats'"
      >
        对话
        <span>{{ sessions.length }}</span>
      </button>
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'knowledge' }"
        @click="activeTab = 'knowledge'"
      >
        知识库
        <span>{{ documentCount }}</span>
      </button>
    </div>

    <div class="sidebar-scroll">
      <template v-if="activeTab === 'chats'">
        <div v-if="sessions.length" class="session-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{
              active: session.id === chat.activeId,
              muted: chat.streaming && session.id !== chat.activeId
            }"
            role="button"
            tabindex="0"
            @click="selectSession(session.id)"
            @keydown.enter.prevent="selectSession(session.id)"
          >
            <span class="session-rail" />
            <span class="session-body">
              <span class="session-title">{{ session.title }}</span>
              <span class="session-preview">{{ preview(session) }}</span>
            </span>
            <span class="session-date">{{ formatDate(session.updatedAt) }}</span>
            <button
              class="icon-button session-delete"
              title="删除对话"
              @click.stop="removeSession(session.id)"
            >
              <AppIcon name="trash" :size="14" />
            </button>
          </div>
        </div>
        <div v-else class="sidebar-empty">
          <AppIcon name="chat" :size="22" />
          <p>还没有对话</p>
        </div>
      </template>

      <template v-else>
        <div class="knowledge-head">
          <span>{{ knowledge.chunks }} 个检索片段</span>
          <button class="icon-button" title="刷新" @click="knowledge.fetch()">
            <AppIcon name="refresh" :size="14" />
          </button>
        </div>

        <button
          class="upload-zone"
          :class="{ dragging, uploading: knowledge.uploading }"
          type="button"
          @click="openFilePicker"
          @dragenter.prevent="dragging = true"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <span class="upload-icon">
            <span v-if="knowledge.uploading" class="mini-spinner large" />
            <AppIcon v-else name="upload" :size="20" />
          </span>
          <span class="upload-copy">
            <strong>{{ knowledge.uploading ? '正在解析并建立索引…' : '上传文档' }}</strong>
            <small>点击选择或拖拽文件到这里</small>
          </span>
        </button>
        <input
          ref="fileInput"
          class="hidden-input"
          type="file"
          multiple
          @change="handleFiles($event.target.files)"
        />
        <p class="upload-formats">
          支持任意可提取文本的文件（PDF / DOCX / HTML / Markdown 等）；不限制大小。
        </p>

        <div v-if="knowledge.error" class="inline-error">
          <AppIcon name="alert" :size="14" />
          <span>{{ knowledge.error }}</span>
        </div>

        <div v-if="knowledge.documents.length" class="document-list">
          <article
            v-for="document in knowledge.documents"
            :key="document.id"
            class="document-item"
          >
            <span class="document-icon">{{ document.extension.replace('.', '').slice(0, 4) }}</span>
            <span class="document-body">
              <span class="document-name" :title="document.name">{{ document.name }}</span>
              <span class="document-meta">
                {{ document.chunkCount }} 段 · {{ formatSize(document.size) }}
              </span>
            </span>
            <button
              class="icon-button document-delete"
              title="移除文档"
              @click="removeDocument(document)"
            >
              <AppIcon name="trash" :size="14" />
            </button>
          </article>
        </div>

        <div v-else-if="!knowledge.loading" class="sidebar-empty">
          <AppIcon name="database" :size="22" />
          <p>知识库还是空的</p>
          <span>上传第一份资料，Agent 就能基于它回答</span>
        </div>
      </template>
    </div>

    <div class="sidebar-footer">
      <span class="status-dot online" />
      <span>RAG · Agent</span>
      <span class="footer-version">v1.0</span>
    </div>
  </aside>
</template>
