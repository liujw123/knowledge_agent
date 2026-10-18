<script setup>
import { computed } from 'vue'
import MarkdownViewer from './MarkdownViewer.vue'
import ThoughtChain from './ThoughtChain.vue'
import AppIcon from './AppIcon.vue'
import { useUiStore } from '../stores/ui'

const props = defineProps({
  message: { type: Object, required: true },
  isLast: { type: Boolean, default: false },
  streamStatus: { type: String, default: '' }
})
const emit = defineEmits(['regenerate', 'open-source'])
const ui = useUiStore()

const isAssistant = computed(() => props.message.role === 'assistant')
const active = computed(
  () => isAssistant.value && ['thinking', 'streaming'].includes(props.message.status)
)
const hasContent = computed(() => Boolean(props.message.content?.trim()))
const sources = computed(() => props.message.sources || [])

const time = computed(() => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(props.message.createdAt))
  } catch {
    return ''
  }
})

function openSource(citation) {
  emit('open-source', { sources: sources.value, citation })
}

async function copyAnswer() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ui.toast('回答已复制', 'success')
  } catch {
    ui.toast('复制失败，请手动选择文本', 'error')
  }
}
</script>

<template>
  <div v-if="!isAssistant" class="message-row user">
    <div class="user-bubble">
      <div class="user-text">{{ message.content }}</div>
      <span class="user-time">{{ time }}</span>
    </div>
    <div class="avatar user-avatar">你</div>
  </div>

  <div v-else class="message-row assistant">
    <div class="avatar agent-avatar">
      <AppIcon name="sparkles" :size="18" :stroke-width="2" />
    </div>

    <div class="message-main">
      <div class="message-meta">
        <strong>知微</strong>
        <span>Agent</span>
        <span class="meta-separator">·</span>
        <span>{{ time }}</span>
      </div>

      <ThoughtChain :thoughts="message.thoughts" :streaming="active" />

      <div v-if="!hasContent && active" class="thinking-card">
        <span class="thinking-orb">
          <span class="thinking-ring" />
          <AppIcon name="sparkles" :size="15" />
        </span>
        <span class="thinking-copy">
          <span>{{ streamStatus || '正在理解你的问题…' }}</span>
          <span class="typing-dots"><i /><i /><i /></span>
        </span>
      </div>

      <div
        v-if="hasContent"
        class="markdown-shell"
        :class="{ 'is-streaming': active }"
      >
        <MarkdownViewer :content="message.content" @citation="openSource" />
      </div>

      <div v-if="message.status === 'stopped'" class="message-note">
        <AppIcon name="stop" :size="12" />
        已停止生成
      </div>

      <div v-if="message.error" class="message-error">
        <AppIcon name="alert" :size="15" />
        <span>{{ message.error }}</span>
        <button v-if="isLast" type="button" @click="emit('regenerate', message.id)">
          重试
        </button>
      </div>

      <div v-if="sources.length" class="source-strip">
        <span class="source-strip-label">
          <AppIcon name="link" :size="13" />
          引用
        </span>
        <button
          v-for="source in sources"
          :key="source.id"
          type="button"
          class="source-chip"
          :title="`${source.documentName} · 片段 ${source.chunkIndex + 1}`"
          @click="openSource(source.citation)"
        >
          <span class="source-chip-num">{{ source.citation }}</span>
          <span>{{ source.heading || source.documentName }}</span>
        </button>
      </div>

      <div
        v-if="isAssistant && (hasContent || message.error || message.status === 'stopped') && !active"
        class="message-actions"
      >
        <button v-if="hasContent" type="button" @click="copyAnswer">
          <AppIcon name="copy" :size="14" />
          复制
        </button>
        <button v-if="isLast" type="button" @click="emit('regenerate', message.id)">
          <AppIcon name="refresh" :size="14" />
          重新生成
        </button>
      </div>
    </div>
  </div>
</template>
