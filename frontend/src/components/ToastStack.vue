<script setup>
import { useUiStore } from '../stores/ui'
import AppIcon from './AppIcon.vue'

const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <button
          v-for="toast in ui.toasts"
          :key="toast.id"
          type="button"
          class="toast"
          :class="toast.type"
          @click="ui.dismiss(toast.id)"
        >
          <span class="toast-dot">
            <AppIcon
              :name="toast.type === 'error' ? 'alert' : toast.type === 'success' ? 'check' : 'sparkles'"
              :size="13"
            />
          </span>
          <span>{{ toast.message }}</span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
