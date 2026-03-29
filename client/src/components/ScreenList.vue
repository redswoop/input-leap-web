<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-label">Screens <span class="panel-badge">{{ screens.length }}</span></span>
    </div>
    <div class="panel-body">
      <ul class="screen-list">
        <li
          v-for="(s, i) in screens"
          :key="s.name"
          class="screen-item"
          :class="{ selected: selected === i }"
          @click="$emit('select', selected === i ? -1 : i)"
        >
          <span class="color-pip" :style="{ background: colors[i % colors.length] }" />
          <span class="name">{{ s.name }}</span>
          <span v-if="s.name === serverName" class="server-tag">server</span>
          <button v-if="s.name !== serverName" class="delete-btn" @click.stop="$emit('remove', i)" title="Remove">&times;</button>
        </li>
      </ul>
      <button class="btn btn-accent btn-full" @click="addScreen">+ Add Screen</button>
    </div>
  </div>
</template>

<script setup>
import { useConfig } from '../composables/useConfig.js'

const props = defineProps({
  selected: { type: Number, default: -1 }
})

const { screens, serverName } = useConfig()
const colors = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#ff922b']

const emit = defineEmits(['remove', 'add', 'select'])

function addScreen() {
  const name = prompt('Screen name:')
  if (name?.trim()) emit('add', name.trim())
}
</script>

<style scoped>
.screen-item {
  cursor: pointer;
}

.screen-item.selected {
  border-color: var(--accent-border) !important;
  background: var(--accent-bg) !important;
}

.server-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
