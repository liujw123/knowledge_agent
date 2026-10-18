<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  sources: { type: Array, default: () => [] },
  activeCitation: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'select'])

const drawer = ref(null)
const closeButton = ref(null)

const activeSource = computed(
  () => props.sources.find((source) => source.citation === props.activeCitation) || props.sources[0]
)

function scrollActive() {
  nextTick(() => {
    drawer.value
      ?.querySelector(`[data-source="${props.activeCitation}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

watch(
  () => [props.open, props.activeCitation, props.sources.length],
  () => {
    if (props.open) {
      scrollActive()
      document.body.classList.add('drawer-open')
    } else {
      document.body.classList.remove('drawer-open')
    }
  },
  { immediate: true }
)

function onKeydown(event) {
  if (event.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('drawer-open')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="drawer-backdrop" @click="emit('close')" />
    </Transition>

    <Transition name="drawer">
      <aside v-if="open" ref="drawer" class="source-drawer" aria-label="引用资料">
        <header class="drawer-head">
          <div>
            <p class="drawer-kicker"><AppIcon name="link" :size="13" /> SOURCES</p>
            <h2>引用资料</h2>
          </div>
          <button ref="closeButton" class="icon-button" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="19" />
          </button>
        </header>

        <div class="drawer-summary">
          <span>{{ sources.length }} 个命中片段</span>
          <span v-if="activeSource">当前：引用 {{ activeSource.citation }}</span>
        </div>

        <div class="source-list">
          <article
            v-for="source in sources"
            :key="source.id"
            class="source-card"
            :class="{ active: source.citation === activeSource?.citation }"
            :data-source="source.citation"
            @click="emit('select', source.citation)"
          >
            <div class="source-card-head">
              <span class="source-citation">{{ source.citation }}</span>
              <div class="source-title-wrap">
                <strong>{{ source.heading || source.documentName }}</strong>
                <span>
                  {{ source.documentName }}
                  <template v-if="source.heading"> · 片段 {{ source.chunkIndex + 1 }}</template>
                </span>
              </div>
              <AppIcon name="book" :size="15" class="source-book" />
            </div>
            <p class="source-text">{{ source.text }}</p>
          </article>

          <div v-if="!sources.length" class="drawer-empty">
            <AppIcon name="search" :size="24" />
            <p>这次回答没有引用资料</p>
          </div>
        </div>

        <footer class="drawer-foot">
          <AppIcon name="database" :size="14" />
          内容来自你上传的原始文档片段
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>
