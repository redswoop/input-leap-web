<template>
  <div class="status-page">
    <div class="status-grid">
      <!-- Server Process -->
      <section class="card">
        <h2 class="card-title">Server Process</h2>
        <div class="process-row">
          <div class="process-status">
            <span class="proc-dot" :class="{ running: serverStatus.running }" />
            <span class="proc-label">{{ serverStatus.running ? 'Running' : 'Stopped' }}</span>
          </div>
          <div v-if="serverStatus.pid" class="proc-meta">PID {{ serverStatus.pid }}</div>
          <div v-if="serverStatus.running" class="proc-meta uptime">{{ uptimeStr }}</div>
          <div class="proc-actions">
            <button v-if="serverStatus.running" class="btn btn-danger" @click="stop">Stop</button>
            <button v-if="serverStatus.running" class="btn" @click="restart">Restart</button>
            <button v-if="!serverStatus.running" class="btn btn-accent" @click="start">Start</button>
          </div>
        </div>
        <div class="process-info">
          <span>{{ serverName }}</span>
          <span class="sep">·</span>
          <span>{{ platformLabel }}</span>
          <span class="sep">·</span>
          <span>:24800</span>
          <template v-if="connectedClients[serverName]">
            <span class="sep">·</span>
            <span>{{ connectedClients[serverName].width }}×{{ connectedClients[serverName].height }}</span>
          </template>
        </div>
      </section>

      <!-- Connected Clients -->
      <section class="card">
        <h2 class="card-title">
          Connected Clients
          <span class="panel-badge">{{ connectedCount }} / {{ clientScreens.length }}</span>
        </h2>
        <div class="client-list">
          <div v-for="s in clientScreens" :key="s.name" class="client-row" :class="{ offline: !isConnected(s.name) }">
            <span class="client-os">{{ osIcon(s) }}</span>
            <div class="client-info">
              <div class="client-name-row">
                <span class="client-name">{{ s.name }}</span>
                <span v-if="s.name === serverName" class="server-tag">server</span>
                <span v-if="isActive(s.name)" class="active-tag">active</span>
                <span v-else-if="isConnected(s.name)" class="idle-tag">idle</span>
                <span v-else class="offline-tag">offline</span>
              </div>
              <div class="client-details">
                <template v-if="isConnected(s.name)">
                  <span>{{ clientInfo(s.name).width }}×{{ clientInfo(s.name).height }}</span>
                  <span class="sep">·</span>
                  <span>cursor {{ clientInfo(s.name).cursorX }}, {{ clientInfo(s.name).cursorY }}</span>
                  <template v-if="connectedSince(s.name)">
                    <span class="sep">·</span>
                    <span>connected {{ relTime(connectedSince(s.name)) }}</span>
                  </template>
                  <template v-if="!isActive(s.name) && lastActive(s.name)">
                    <span class="sep">·</span>
                    <span>last active {{ relTime(lastActive(s.name)) }}</span>
                  </template>
                </template>
                <template v-else>
                  <span class="dim">not connected</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Activity Feed -->
      <section class="card">
        <h2 class="card-title">Activity</h2>
        <div class="activity-feed" v-if="events.length">
          <div v-for="(ev, i) in events.slice(0, 50)" :key="i" class="activity-row" :class="'ev-' + ev.kind">
            <span class="ev-time">{{ formatTime(ev.time) }}</span>
            <span class="ev-icon">{{ eventIcon(ev) }}</span>
            <span class="ev-text">{{ eventText(ev) }}</span>
          </div>
        </div>
        <div v-else class="empty-feed">
          <span class="dim">No activity yet. Start the server to see events.</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWebSocket } from '../composables/useWebSocket.js'
import { useConfig } from '../composables/useConfig.js'

const { serverStatus, events } = useWebSocket()
const { screens, serverName, serverPlatform, connectedClients, saveAll } = useConfig()

const now = ref(Date.now())
let timer = null

onMounted(() => { timer = setInterval(() => now.value = Date.now(), 1000) })
onUnmounted(() => clearInterval(timer))

const platformLabel = computed(() => {
  if (serverPlatform.value === 'macos') return 'macOS'
  if (serverPlatform.value === 'windows') return 'Windows'
  if (serverPlatform.value === 'linux') return 'Linux'
  return serverPlatform.value
})

const uptimeStr = computed(() => {
  if (!serverStatus.value.startedAt) return ''
  const ms = now.value - serverStatus.value.startedAt
  const secs = Math.floor(ms / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
})

// Filter out server from client list — it's always there, not a "connection"
const clientScreens = computed(() => screens.value.filter(s => s.name !== serverName.value))
const connectedCount = computed(() => {
  return clientScreens.value.filter(s => s.name in connectedClients.value).length
})

function isConnected(name) { return name in connectedClients.value }
function isActive(name) { return connectedClients.value[name]?.active }
function clientInfo(name) { return connectedClients.value[name] || {} }

function osIcon(screen) {
  const os = screen.name === serverName.value ? serverPlatform.value : screen.os
  if (os === 'macos') return '🍎'
  if (os === 'windows') return '🪟'
  if (os === 'linux') return '🐧'
  return '💻'
}

function connectedSince(name) {
  // Find most recent connect event for this client
  const ev = events.value.find(e => e.kind === 'client-connected' && e.name === name)
  return ev?.time || null
}

function lastActive(name) {
  // Find most recent switch-to event for this client
  const ev = events.value.find(e => e.kind === 'screen-switched' && e.to === name)
  return ev?.time || null
}

function relTime(ts) {
  if (!ts) return ''
  const ms = now.value - ts
  const secs = Math.floor(ms / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m ago`
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function eventIcon(ev) {
  switch (ev.kind) {
    case 'client-connected': return '←'
    case 'client-disconnected': return '→'
    case 'screen-switched': return '⇄'
    case 'server-started': return '●'
    case 'server-stopped': return '○'
    case 'client-rejected': return '✕'
    default: return '·'
  }
}

function eventText(ev) {
  switch (ev.kind) {
    case 'client-connected': return `${ev.name} connected`
    case 'client-disconnected': return `${ev.name} disconnected`
    case 'screen-switched': return `switched to ${ev.to}`
    case 'server-started': return 'server started'
    case 'server-stopped': return 'server stopped'
    case 'client-rejected': return `${ev.name} rejected (not in config)`
    default: return JSON.stringify(ev)
  }
}

async function start() {
  await saveAll()
  await fetch('/api/server/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: serverName.value }),
  })
}

async function stop() {
  await fetch('/api/server/stop', { method: 'POST' })
}

async function restart() {
  await saveAll()
  await fetch('/api/server/restart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: serverName.value }),
  })
}
</script>

<style scoped>
.status-page {
  padding: 24px;
  overflow-y: auto;
  height: 100%;
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Process card */
.process-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.process-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.proc-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 8px #ef535040;
}

.proc-dot.running {
  background: var(--green);
  box-shadow: 0 0 10px #66bb6a40;
  animation: pulse 2.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.proc-label {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-bright);
}

.proc-meta {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  padding: 3px 10px;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.uptime {
  font-variant-numeric: tabular-nums;
}

.proc-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.process-info {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sep { color: var(--border); }

/* Client list */
.client-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.client-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
  transition: background 0.15s;
}

.client-row:hover {
  background: var(--bg-hover);
}

.client-row.offline {
  opacity: 0.5;
}

.client-os {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.client-info {
  flex: 1;
  min-width: 0;
}

.client-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.client-name {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-bright);
}

.active-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  color: var(--green);
  background: var(--green-bg);
  border: 1px solid #66bb6a33;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.idle-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-dim);
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.offline-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
}

.client-details {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.dim { color: var(--text-muted); }

/* Activity feed */
.activity-feed {
  max-height: 300px;
  overflow-y: auto;
}

.activity-feed::-webkit-scrollbar { width: 4px; }
.activity-feed::-webkit-scrollbar-track { background: transparent; }
.activity-feed::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.activity-row:hover { background: var(--bg-hover); }

.ev-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.ev-icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.ev-text {
  color: var(--text);
}

.ev-client-connected .ev-icon { color: var(--green); }
.ev-client-connected .ev-text { color: var(--green); }
.ev-client-disconnected .ev-icon { color: var(--red); }
.ev-client-disconnected .ev-text { color: var(--red); }
.ev-screen-switched .ev-icon { color: var(--cyan); }
.ev-screen-switched .ev-text { color: var(--cyan); }
.ev-server-started .ev-icon { color: var(--green); }
.ev-server-started .ev-text { color: var(--green); }
.ev-server-stopped .ev-icon { color: var(--red); }
.ev-server-stopped .ev-text { color: var(--red); }
.ev-client-rejected .ev-icon { color: var(--accent); }
.ev-client-rejected .ev-text { color: var(--accent); }

.empty-feed {
  padding: 20px;
  text-align: center;
  font-size: 13px;
}
</style>
