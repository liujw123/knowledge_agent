import { defineStore } from 'pinia'

let toastSeed = 0

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: []
  }),
  actions: {
    toast(message, type = 'info') {
      const id = ++toastSeed
      this.toasts.push({ id, message, type })
      window.setTimeout(() => this.dismiss(id), 3200)
    },
    dismiss(id) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id)
    }
  }
})
