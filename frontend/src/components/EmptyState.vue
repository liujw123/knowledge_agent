<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  documentCount: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 }
})
const emit = defineEmits(['prompt'])

const suggestions = [
  {
    icon: 'database',
    title: '知识库里有什么？',
    text: '列出当前知识库的文档，并概括每份资料的主题',
    prompt: '这个知识库里有哪些资料？请概括每份文档的主题。'
  },
  {
    icon: 'sparkles',
    title: '提炼核心观点',
    text: '把长文档压缩成一份清晰、可执行的摘要',
    prompt: '请总结知识库中所有文档的核心内容，按主题整理成要点。'
  },
  {
    icon: 'search',
    title: '跨文档找答案',
    text: '检索多个片段，给出带引用的完整回答',
    prompt: '根据知识库中的资料，帮我梳理关键结论，并标注引用来源。'
  }
]
</script>

<template>
  <div class="empty-state">
    <div class="empty-orbit" aria-hidden="true">
      <span class="orbit orbit-one" />
      <span class="orbit orbit-two" />
      <span class="empty-core">
        <AppIcon name="sparkles" :size="30" :stroke-width="1.7" />
      </span>
    </div>

    <p class="empty-kicker">RAG · AGENT · MULTI-MODEL</p>
    <h1>从你的知识里，<span>找到答案</span></h1>
    <p class="empty-subtitle">
      上传文档即可扩展知识库。知微会先检索、再推理，并用可点击的引用告诉你答案来自哪里。
    </p>

    <div class="empty-stats">
      <span><b>{{ documentCount }}</b> 份文档</span>
      <i />
      <span><b>{{ chunkCount }}</b> 个检索片段</span>
      <i />
      <span>流式回答</span>
    </div>

    <div class="suggestion-grid">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.title"
        type="button"
        class="suggestion-card"
        @click="emit('prompt', suggestion.prompt)"
      >
        <span class="suggestion-icon">
          <AppIcon :name="suggestion.icon" :size="17" />
        </span>
        <span class="suggestion-title">{{ suggestion.title }}</span>
        <span class="suggestion-text">{{ suggestion.text }}</span>
        <span class="suggestion-arrow"><AppIcon name="arrowup" :size="14" /></span>
      </button>
    </div>

    <p v-if="!documentCount" class="empty-tip">
      知识库为空？打开左侧「知识库」上传一份 Markdown、PDF 或 DOCX 开始体验。
    </p>
  </div>
</template>
