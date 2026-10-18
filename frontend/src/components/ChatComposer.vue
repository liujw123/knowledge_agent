<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  streaming: { type: Boolean, default: false },
  status: { type: String, default: '' },
  documentCount: { type: Number, default: 0 }
})
const emit = defineEmits(['send', 'stop'])

const text = ref('')
const textarea = ref(null)

const canSend = computed(() => !props.streaming && Boolean(text.value.trim()))
const remaining = computed(() => 4000 - text.value.length)

function resize() {
  const element = textarea.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 180)}px`
}

watch(text, () => nextTick(resize))

function submit() {
  if (!canSend.value) return
  emit('send', text.value.trim())
  text.value = ''
  nextTick(resize)
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

function focus() {
  textarea.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="composer-wrap">
    <div class="composer" :class="{ busy: streaming }">
      <textarea
        ref="textarea"
        v-model="text"
        rows="1"
        maxlength="4000"
        placeholder="向知识库提问，例如：总结这份方案的核心设计…"
        @keydown="onKeydown"
        @input="resize"
      />
      <div class="composer-bottom">
        <div class="composer-status">
          <span class="kb-pill">
            <AppIcon name="database" :size="13" />
            知识库
            <b>{{ documentCount }}</b>
          </span>
          <span v-if="streaming" class="generating-label">
            <span class="mini-spinner" />
            {{ status || '处理中…' }}
          </span>
          <span v-else-if="remaining < 500" class="counter">{{ remaining }}</span>
        </div>

        <button
          v-if="streaming"
          type="button"
          class="send-button stop"
          title="停止生成"
          @click="emit('stop')"
        >
          <AppIcon name="stop" :size="16" />
        </button>
        <button
          v-else
          type="button"
          class="send-button"
          :disabled="!canSend"
          title="发送"
          @click="submit"
        >
          <AppIcon name="arrowup" :size="18" :stroke-width="2.2" />
        </button>
      </div>
    </div>
    <p class="composer-hint">
      <span><kbd>Enter</kbd> 发送 · <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</span>
      <span>回答由当前模型生成，请核对引用原文</span>
    </p>
  </div>
</template>
