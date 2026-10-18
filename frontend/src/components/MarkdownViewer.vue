<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '../utils/markdown'
import { useUiStore } from '../stores/ui'

const props = defineProps({
  content: { type: String, default: '' }
})
const emit = defineEmits(['citation'])
const ui = useUiStore()
const html = computed(() => renderMarkdown(props.content))

function fallbackCopy(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

async function handleClick(event) {
  const citation = event.target.closest('[data-citation]')
  if (citation) {
    emit('citation', Number(citation.dataset.citation))
    return
  }

  const button = event.target.closest('.copy-code')
  if (!button) return

  const code = button.closest('.code-block')?.querySelector('code')?.textContent || ''
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code)
    else fallbackCopy(code)
    button.textContent = '已复制'
    ui.toast('代码已复制', 'success')
    window.setTimeout(() => {
      button.textContent = '复制'
    }, 1600)
  } catch {
    ui.toast('复制失败，请手动选择代码', 'error')
  }
}
</script>

<template>
  <div class="markdown-body" v-html="html" @click="handleClick" />
</template>
