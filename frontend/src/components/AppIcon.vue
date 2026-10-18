<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: 'circle' },
  size: { type: [Number, String], default: 18 },
  strokeWidth: { type: [Number, String], default: 1.8 }
})

const icons = {
  plus: ['M12 5v14', 'M5 12h14'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
  book: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'
  ],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M20 16v4H4v-4'],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6'
  ],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  stop: ['M7 7h10v10H7z'],
  copy: [
    'M9 9h11v11H9z',
    'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'
  ],
  refresh: [
    'M21 12a9 9 0 0 0-15.5-6.2L3 8.5',
    'M3 3v5.5h5.5',
    'M3 12a9 9 0 0 0 15.5 6.2L21 15.5',
    'M21 21v-5.5h-5.5'
  ],
  'chevron-down': ['m6 9 6 6 6-6'],
  sparkles: [
    'm12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9z',
    'M5 3v4',
    'M3 5h4',
    'M19 17v4',
    'M17 19h4'
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.3-4.3'],
  database: [
    'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z',
    'M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3',
    'M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5'
  ],
  check: ['m20 6-11 11-5-5'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  link: [
    'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7',
    'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'
  ],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  arrowup: ['M12 19V5', 'm5 12 7-7 7 7'],
  panel: ['M3 3h18v18H3z', 'M9 3v18'],
  sliders: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6'
  ],
  circle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z']
}

const paths = computed(() => icons[props.name] || icons.circle)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, index) in paths" :key="index" :d="path" />
  </svg>
</template>
