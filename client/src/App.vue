<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1 class="header-title">Input<span class="accent">Leap</span></h1>
        <nav class="header-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="header-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </nav>
      </div>
      <div class="status-badge" :class="{ active: serverStatus.running }">
        <span class="status-dot" :class="{ running: serverStatus.running }" />
        <span class="status-label">{{ serverStatus.running ? 'Running' : 'Stopped' }}</span>
        <span v-if="serverStatus.pid" class="status-pid">PID {{ serverStatus.pid }}</span>
      </div>
    </header>

    <!-- Server Tab -->
    <div v-show="activeTab === 'server'" class="tab-view server-view">
      <ServerTab />
    </div>

    <!-- Topology Tab -->
    <div v-show="activeTab === 'topology'" class="tab-view topology-view">
      <div class="topo-left">
        <ScreenList
          @add="name => layoutCanvas?.addScreen(name)"
          @remove="i => { layoutCanvas?.removeScreen(i); selectedScreen = -1 }"
          @select="i => selectedScreen = i"
          :selected="selectedScreen"
        />
      </div>
      <LayoutCanvas ref="layoutCanvas" @select="i => selectedScreen = i" />
      <div class="topo-right" v-if="selectedScreenObj">
        <ScreenSettings
          :screen="selectedScreenObj"
          :key="selectedScreen"
        />
      </div>
      <div class="topo-right topo-empty" v-else>
        <div class="empty-hint">Select a screen to edit its settings</div>
      </div>
    </div>

    <!-- Status Tab -->
    <div v-show="activeTab === 'status'" class="tab-view server-view">
      <StatusTab />
    </div>

    <!-- Logs -->
    <LogViewer />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useWebSocket } from './composables/useWebSocket.js'
import { useConfig } from './composables/useConfig.js'
import LayoutCanvas from './components/LayoutCanvas.vue'
import ScreenList from './components/ScreenList.vue'
import ScreenSettings from './components/ScreenSettings.vue'
import ServerTab from './components/ServerTab.vue'
import StatusTab from './components/StatusTab.vue'
import LogViewer from './components/LogViewer.vue'

const { serverStatus } = useWebSocket()
const { screens } = useConfig()
const layoutCanvas = ref(null)

// Read initial state from URL
const params = new URLSearchParams(window.location.search)
const selectedScreen = ref(parseInt(params.get('screen') ?? '-1'))
const activeTab = ref(params.get('tab') || 'topology')

// Sync state to URL without reloading
function updateURL() {
  const p = new URLSearchParams()
  p.set('tab', activeTab.value)
  if (selectedScreen.value >= 0) p.set('screen', selectedScreen.value)
  const url = `${window.location.pathname}?${p.toString()}`
  window.history.replaceState(null, '', url)
}

watch(activeTab, updateURL)
watch(selectedScreen, updateURL)

const selectedScreenObj = computed(() => {
  if (selectedScreen.value >= 0 && selectedScreen.value < screens.value.length) {
    return screens.value[selectedScreen.value]
  }
  return null
})

const tabs = [
  { id: 'topology', label: 'Topology' },
  { id: 'server', label: 'Server' },
  { id: 'status', label: 'Status' },
]
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-deep: #0e0e11;
  --bg-surface: #151518;
  --bg-raised: #1c1c20;
  --bg-input: #121215;
  --bg-hover: #1f1f24;
  --bg-inset: #0b0b0e;

  --border: #2c2c34;
  --border-subtle: #222228;
  --border-focus: #e8a83066;

  --text: #d0d1d8;
  --text-dim: #77798a;
  --text-bright: #f0f1f4;
  --text-muted: #55576a;

  --accent: #e8a830;
  --accent-hover: #f0b840;
  --accent-bg: #e8a83015;
  --accent-border: #e8a83033;
  --cyan: #5ccfe6;
  --cyan-bg: #5ccfe612;
  --red: #ef5350;
  --red-bg: #ef535012;
  --green: #66bb6a;
  --green-bg: #66bb6a12;

  --font-display: 'Outfit', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --header-height: 48px;
  --radius: 6px;
  --radius-sm: 3px;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
}

html, body {
  height: 100%;
  background: var(--bg-deep);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 13px;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.app {
  display: grid;
  grid-template-rows: var(--header-height) 1fr auto;
  height: 100vh;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: var(--header-height);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 28px;
}

.header-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.02em;
  color: var(--text-bright);
  flex-shrink: 0;
}

.header-title .accent { color: var(--accent); }

.header-tabs {
  display: flex;
  gap: 4px;
}

.header-tab {
  padding: 6px 18px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s ease;
}

.header-tab:hover {
  color: var(--text);
  background: var(--bg-hover);
}

.header-tab.active {
  color: var(--text-bright);
  background: var(--bg-raised);
  border-color: var(--border);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  padding: 5px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  transition: all 0.3s ease;
}

.status-badge.active {
  border-color: #66bb6a33;
  background: var(--green-bg);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 6px #ef535040;
  transition: all 0.3s;
  flex-shrink: 0;
}

.status-dot.running {
  background: var(--green);
  box-shadow: 0 0 10px #66bb6a40;
  animation: pulse 2.5s ease-in-out infinite;
}

.status-label { font-weight: 500; }

.status-pid {
  color: var(--text-muted);
  font-size: 10px;
  padding-left: 4px;
  border-left: 1px solid var(--border-subtle);
  margin-left: 4px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ── Tab Views ── */
.tab-view {
  overflow: hidden;
}

/* Topology layout: screen list | canvas | settings */
.topology-view {
  display: grid;
  grid-template-columns: 200px 1fr 280px;
}

.topo-left {
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}

.topo-left::-webkit-scrollbar { width: 5px; }
.topo-left::-webkit-scrollbar-track { background: transparent; }
.topo-left::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.topo-right {
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  overflow-y: auto;
}

.topo-right::-webkit-scrollbar { width: 5px; }
.topo-right::-webkit-scrollbar-track { background: transparent; }
.topo-right::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.topo-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px;
}

/* Server tab: full width content */
.server-view {
  overflow-y: auto;
}

/* ── Shared Panel System ── */
.panel {
  border-bottom: 1px solid var(--border);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  user-select: none;
}

.panel-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.panel-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-inset);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid var(--border-subtle);
  margin-left: 6px;
}

.panel-body {
  padding: 0 18px 16px;
}

/* ── Screen List ── */
.screen-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.screen-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
  transition: all 0.15s ease;
  cursor: pointer;
}

.screen-item:hover {
  border-color: var(--border);
  background: var(--bg-input);
}

.screen-item .color-pip {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 10px;
  flex-shrink: 0;
}

.screen-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screen-item .delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 15px;
  padding: 0 4px;
  line-height: 1;
  opacity: 0;
  transition: all 0.15s ease;
  border-radius: 3px;
}

.screen-item:hover .delete-btn { opacity: 1; }
.screen-item .delete-btn:hover { color: var(--red); background: var(--red-bg); }

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-raised);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  user-select: none;
}

.btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-muted);
  color: var(--text-bright);
  transform: translateY(-0.5px);
}

.btn:active { transform: translateY(0.5px); }

.btn-accent { border-color: var(--accent-border); color: var(--accent); background: var(--accent-bg); }
.btn-accent:hover { background: #e8a83025; border-color: var(--accent); color: var(--accent-hover); }

.btn-danger { border-color: #ef535025; color: var(--red); background: var(--red-bg); }
.btn-danger:hover { background: #ef535020; border-color: var(--red); }

.btn-lg { padding: 10px 24px; font-size: 13px; }

.btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-full { width: 100%; margin-top: 10px; }

/* ── Inputs ── */
.input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  outline: none;
  transition: all 0.15s ease;
}

.input:focus {
  border-color: var(--border-focus);
  background: var(--bg-input);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.input::placeholder { color: var(--text-muted); }

select.input {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2377798a'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.input-label { font-family: var(--font-display); font-size: 11px; font-weight: 500; color: var(--text-dim); }

/* ── Toggle switch ── */
.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
.toggle-label { font-size: 12px; color: var(--text); }

.toggle {
  position: relative;
  width: 36px;
  height: 20px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-dim);
  transition: all 0.2s ease;
}

.toggle:checked { background: var(--accent-bg); border-color: var(--accent-border); }
.toggle:checked::after { left: 18px; background: var(--accent); }

/* ── Collapse toggle ── */
.collapse-btn {
  background: none;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.collapse-btn:hover { color: var(--text); border-color: var(--border); background: var(--bg-hover); }
</style>
