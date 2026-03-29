<template>
  <div class="server-page">
    <div class="server-grid">
      <!-- Left column: Controls + Options -->
      <div class="server-col">
        <!-- Server Controls -->
        <section class="card">
          <h2 class="card-title">Server Controls</h2>
          <div class="input-group">
            <label class="input-label">Server screen name</label>
            <input class="input" v-model="serverName" type="text" placeholder="e.g. desktop" spellcheck="false">
          </div>
          <div class="btn-row">
            <button class="btn btn-accent btn-lg" @click="start">Start Server</button>
            <button class="btn btn-danger btn-lg" @click="stop">Stop</button>
            <button class="btn btn-lg" @click="restart">Restart</button>
          </div>
        </section>

        <!-- Switching -->
        <section class="card">
          <h2 class="card-title">Switching</h2>
          <div class="option-grid">
            <div class="input-group">
              <label class="input-label">Switch delay</label>
              <div class="input-with-unit">
                <input class="input" type="number" v-model="options.switchDelay" placeholder="250">
                <span class="input-unit">ms</span>
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Double-tap delay</label>
              <div class="input-with-unit">
                <input class="input" type="number" v-model="options.switchDoubleTap" placeholder="250">
                <span class="input-unit">ms</span>
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Heartbeat interval</label>
              <div class="input-with-unit">
                <input class="input" type="number" v-model="options.heartbeat" placeholder="5000">
                <span class="input-unit">ms</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Features -->
        <section class="card">
          <h2 class="card-title">Features</h2>
          <div class="toggle-list">
            <div class="toggle-row" v-for="opt in featureToggles" :key="opt.key">
              <div>
                <span class="toggle-label">{{ opt.label }}</span>
                <span class="toggle-desc">{{ opt.desc }}</span>
              </div>
              <input type="checkbox" class="toggle"
                :checked="options[opt.key] === 'true'"
                @change="options[opt.key] = $event.target.checked ? 'true' : 'false'">
            </div>
          </div>
          <div class="input-group" style="margin-top:12px;" v-show="options.clipboardSharing === 'true'">
            <label class="input-label">Clipboard max size</label>
            <div class="input-with-unit">
              <input class="input" type="number" v-model="options.clipboardSharingSize" placeholder="1048576">
              <span class="input-unit">bytes</span>
            </div>
          </div>
        </section>
      </div>

      <!-- Right column: Config Preview -->
      <div class="server-col">
        <section class="card config-card">
          <div class="card-header-row">
            <h2 class="card-title">Generated Config</h2>
            <div class="card-actions">
              <button class="btn" :class="{ copied }" @click="copy" style="padding:5px 12px;font-size:11px;">
                {{ copied ? 'Copied' : 'Copy' }}
              </button>
              <button class="btn btn-accent" @click="save" style="padding:5px 12px;font-size:11px;">Save</button>
            </div>
          </div>
          <pre class="config-output"><template v-for="(line, i) in highlightedLines" :key="i"><span :class="line.cls">{{ line.text }}</span>{{ '\n' }}</template></pre>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useConfig } from '../composables/useConfig.js'

const { options, configText, saveConfig } = useConfig()
const serverName = ref('')
const copied = ref(false)

const featureToggles = [
  { key: 'screenSaverSync', label: 'Screensaver sync', desc: 'Sync screensaver state across screens' },
  { key: 'relativeMouseMoves', label: 'Relative mouse moves', desc: 'Use relative instead of absolute mouse positioning' },
  { key: 'clipboardSharing', label: 'Clipboard sharing', desc: 'Share clipboard contents between screens' },
  { key: 'win32KeepForeground', label: 'Win32 keep foreground', desc: 'Keep foreground window on Windows clients' },
]

const highlightedLines = computed(() => {
  return configText.value.split('\n').map(text => {
    let cls = ''
    if (text.startsWith('section:') || text === 'end') cls = 'config-keyword'
    else if (text.includes('=')) cls = 'config-value'
    else if (text.trim().endsWith(':')) cls = 'config-name'
    return { text, cls }
  })
})

async function start() {
  await saveConfig()
  await fetch('/api/server/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: serverName.value || undefined }),
  })
}

async function stop() {
  await fetch('/api/server/stop', { method: 'POST' })
}

async function restart() {
  await saveConfig()
  await fetch('/api/server/restart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: serverName.value || undefined }),
  })
}

async function save() {
  await saveConfig()
}

async function copy() {
  await navigator.clipboard.writeText(configText.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}
</script>

<style scoped>
.server-page {
  padding: 24px;
  overflow-y: auto;
  height: 100%;
}

.server-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  max-width: 1200px;
}

.server-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.card-title {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-bright);
  margin-bottom: 16px;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-header-row .card-title {
  margin-bottom: 0;
}

.card-actions {
  display: flex;
  gap: 6px;
}

.option-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.option-grid .input-group {
  margin-bottom: 0;
}

.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-unit .input {
  padding-right: 48px;
}

.input-unit {
  position: absolute;
  right: 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-list .toggle-row {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.toggle-list .toggle-row:last-child {
  border-bottom: none;
}

.toggle-desc {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.config-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.config-output {
  flex: 1;
  min-height: 200px;
  margin: 0;
  overflow: auto;
  padding: 14px 16px;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-dim);
  tab-size: 4;
}

.config-output::-webkit-scrollbar { width: 4px; }
.config-output::-webkit-scrollbar-track { background: transparent; }
.config-output::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.config-keyword { color: var(--accent); font-weight: 500; }
.config-name { color: var(--cyan); }
.config-value { color: var(--text); }

.copied { color: var(--green) !important; border-color: #66bb6a33 !important; }
</style>
