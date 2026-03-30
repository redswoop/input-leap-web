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
          :class="{ selected: selected === i, disconnected: !isConnected(s.name), hidden: s.visible === false }"
          @click="$emit('select', selected === i ? -1 : i)"
        >
          <input
            type="checkbox"
            class="vis-toggle"
            :checked="s.visible !== false"
            @click.stop
            @change="toggleVisible(s)"
            :title="s.visible !== false ? 'Hide from topology' : 'Show in topology'"
          >
          <span class="os-icon">{{ osIcon(s) }}</span>
          <span class="name">{{ s.name }}</span>
          <span v-if="s.name === serverName" class="server-tag">server</span>
          <template v-if="s.name !== serverName">
            <span v-if="isConnected(s.name)" class="conn-dot connected" title="Connected"></span>
            <span v-else class="conn-dot" title="Disconnected"></span>
          </template>
          <span v-if="connectedClients[s.name]" class="res-label">
            {{ connectedClients[s.name].width }}×{{ connectedClients[s.name].height }}
          </span>
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

const { screens, serverName, serverPlatform, connectedClients } = useConfig()

const emit = defineEmits(['remove', 'add', 'select'])

function isConnected(name) {
  return name in connectedClients.value
}

function osIcon(screen) {
  const os = screen.name === serverName.value ? serverPlatform.value : screen.os
  if (os === 'macos') return '🍎'
  if (os === 'windows') return '🪟'
  if (os === 'linux') return '🐧'
  return '💻'
}

function toggleVisible(screen) {
  screen.visible = screen.visible === false ? true : false
}

function addScreen() {
  const name = prompt('Screen name:')
  if (name?.trim()) emit('add', name.trim())
}
</script>

<style scoped>
.screen-item {
  cursor: pointer;
  gap: 6px;
}

.screen-item.selected {
  border-color: var(--accent-border) !important;
  background: var(--accent-bg) !important;
}

.screen-item.disconnected .name {
  opacity: 0.5;
}

.screen-item.hidden {
  opacity: 0.4;
}

.vis-toggle {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

.os-icon {
  font-size: 14px;
  flex-shrink: 0;
  line-height: 1;
}

.conn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  margin-left: auto;
}

.conn-dot.connected {
  background: var(--green);
  box-shadow: 0 0 6px #66bb6a40;
}

.res-label {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  flex-shrink: 0;
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
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
</style>
