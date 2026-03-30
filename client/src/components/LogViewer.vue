<template>
  <div class="log-panel" :class="collapsed ? 'collapsed' : 'expanded'">
    <div class="log-header" @click="collapsed = !collapsed">
      <div class="log-header-left">
        <span class="log-title">Logs</span>
        <span class="log-count" v-if="logs.length">{{ logs.length }}</span>
      </div>
      <span class="toggle-arrow" :class="{ flipped: collapsed }">{{ collapsed ? '▲ Show' : '▼ Hide' }}</span>
    </div>
    <div class="log-content" ref="logEl">
      <div v-for="(line, i) in logs" :key="i" class="log-line" :class="logClass(line)">
        <span class="log-text">{{ line }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useWebSocket } from '../composables/useWebSocket.js'

const { logs } = useWebSocket()
const collapsed = ref(false)
const logEl = ref(null)

watch(logs, async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}, { deep: true })

function logClass(line) {
  if (line.includes('NOTE:')) return 'level-note'
  if (line.includes('WARNING:')) return 'level-warn'
  if (line.includes('ERROR:') || line.includes('FATAL:')) return 'level-err'
  return ''
}
</script>

<style scoped>
.log-panel {
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: height 0.25s ease;
  overflow: hidden;
}

.log-panel.collapsed { height: 44px !important; }
.log-panel.expanded { height: 180px; max-height: 180px; }

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 44px;
  min-height: 44px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.log-header:hover { background: var(--bg-hover); }

.log-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.log-title {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.log-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-inset);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--border-subtle);
}

.toggle-arrow {
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--text-dim);
  transition: color 0.15s;
}

.toggle-arrow:hover {
  color: var(--text);
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.4;
  color: var(--text);
}

.log-content::-webkit-scrollbar { width: 4px; }
.log-content::-webkit-scrollbar-track { background: transparent; }
.log-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.log-line {
  padding: 3px 18px;
  border-left: 2px solid transparent;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-line:hover {
  background: var(--bg-hover);
}

.level-note {
  border-left-color: var(--cyan);
}

.level-note .log-text { color: var(--cyan); }

.level-warn {
  border-left-color: var(--accent);
}

.level-warn .log-text { color: var(--accent); }

.level-err {
  border-left-color: var(--red);
  background: var(--red-bg);
}

.level-err .log-text { color: var(--red); }
</style>
