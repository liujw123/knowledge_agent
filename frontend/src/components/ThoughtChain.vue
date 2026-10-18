<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  thoughts: { type: Array, default: () => [] },
  streaming: { type: Boolean, default: false }
})

const expanded = ref(false)

watch(
  () => props.streaming,
  (streaming) => {
    if (streaming) expanded.value = true
  },
  { immediate: true }
)

watch(
  () => props.thoughts.length,
  (length) => {
    if (length && props.streaming) expanded.value = true
  }
)

const completed = computed(
  () => props.thoughts.filter((thought) => thought.status !== 'running').length
)
</script>

<template>
  <div v-if="thoughts.length" class="thought-chain">
    <button
      type="button"
      class="thought-toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="thought-icon" :class="{ active: streaming }">
        <AppIcon name="sparkles" :size="14" />
      </span>
      <span class="thought-label">
        {{ streaming ? 'Agent 正在执行' : 'Agent 执行过程' }}
      </span>
      <span class="thought-count">
        {{ completed }}/{{ thoughts.length }}
      </span>
      <AppIcon
        name="chevron-down"
        :size="14"
        class="thought-chevron"
        :class="{ rotated: expanded }"
      />
    </button>

    <Transition name="thought-expand">
      <div v-if="expanded" class="thought-list">
        <div
          v-for="thought in thoughts"
          :key="thought.id"
          class="thought-item"
          :class="thought.status"
        >
          <span class="thought-status">
            <span v-if="thought.status === 'running'" class="mini-spinner" />
            <AppIcon v-else-if="thought.status === 'error'" name="alert" :size="12" />
            <AppIcon v-else-if="thought.status === 'empty'" name="search" :size="12" />
            <AppIcon v-else name="check" :size="12" />
          </span>
          <span class="thought-copy">
            <span class="thought-title">{{ thought.title }}</span>
            <span v-if="thought.detail" class="thought-detail">{{ thought.detail }}</span>
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>
