<template>
  <div class="screen-settings">
    <div class="settings-header">
      <div class="settings-title-row">
        <span class="settings-title">{{ screen.name }}</span>
        <span v-if="isServer" class="server-tag">server</span>
      </div>
      <span class="settings-subtitle">Screen Settings</span>
    </div>

    <!-- OS + Preset -->
    <div class="settings-section compact">
      <div class="inline-row">
        <span class="section-label" style="margin-bottom:0">OS</span>
        <div v-if="isServer" class="os-inline">{{ osIcon(serverPlatform) }} {{ osLabel(serverPlatform) }}</div>
        <select v-else class="input input-sm" :value="screen.os || ''" @change="screen.os = $event.target.value" style="flex:1;">
          <option value="">Select...</option>
          <option value="macos">macOS</option>
          <option value="windows">Windows</option>
          <option value="linux">Linux</option>
        </select>
      </div>
      <button v-if="presetAvailable" class="btn btn-accent btn-sm" style="width:100%;margin-top:6px;" @click="applyPreset">
        Apply recommended key mapping
      </button>
      <div class="inline-row" style="margin-top:8px;">
        <span class="section-label" style="margin-bottom:0">Display Scale</span>
        <div class="scale-row">
          <button v-for="s in scalePresets" :key="s"
            class="scale-btn" :class="{ active: (screen.scaleFactor || 1) === s }"
            @click="screen.scaleFactor = s">{{ s }}x</button>
        </div>
      </div>
    </div>

    <!-- Modifier Keys (compact 2-col grid) -->
    <div class="settings-section compact">
      <div class="section-label">Modifiers</div>
      <div class="mod-grid">
        <div v-for="mod in displayModifiers" :key="mod.key" class="mod-cell">
          <label class="mod-label">{{ mod.label }}</label>
          <select class="input input-sm" :value="screen.options?.[mod.key] || ''" @change="setOpt(mod.key, $event.target.value)">
            <option value="">default</option>
            <option v-for="v in displayModValues" :key="v.value" :value="v.value">{{ v.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Corners (inline) -->
    <div class="settings-section compact">
      <div class="inline-row" style="margin-bottom:6px;">
        <span class="section-label" style="margin-bottom:0">Corners</span>
        <div class="input-with-unit" style="width:80px;">
          <input class="input input-sm" type="number"
            :value="screen.options?.switchCornerSize || ''"
            @input="setOpt('switchCornerSize', $event.target.value)"
            placeholder="0">
          <span class="input-unit">px</span>
        </div>
      </div>
      <div class="corner-row">
        <button v-for="corner in corners" :key="corner.key"
          class="corner-btn" :class="{ active: isCornerActive(corner.key) }"
          @click="toggleCorner(corner.key)">{{ corner.short }}</button>
      </div>
    </div>

    <!-- Aliases (compact) -->
    <div class="settings-section compact">
      <div class="section-label">Aliases <button class="link-btn" @click="addAlias" style="margin-left:6px;">+ add</button></div>
      <div v-for="(alias, ai) in (aliases[screen.name] || [])" :key="ai" class="alias-row">
        <input class="input input-sm alias-input" :value="alias"
          @input="updateAlias(ai, $event.target.value)"
          placeholder="hostname" spellcheck="false">
        <button class="alias-remove" @click="removeAlias(ai)">&times;</button>
      </div>
    </div>

    <!-- Fixes (compact toggles) -->
    <div class="settings-section compact">
      <div class="section-label">Fixes</div>
      <div v-for="opt in toggleOpts" :key="opt.key" class="toggle-row compact-toggle">
        <span class="toggle-label">{{ opt.label }}</span>
        <input type="checkbox" class="toggle"
          :checked="screen.options?.[opt.key] === 'true'"
          @change="setOpt(opt.key, $event.target.checked ? 'true' : 'false')">
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useConfig } from '../composables/useConfig.js'

const props = defineProps({
  screen: { type: Object, required: true }
})

const { aliases, serverName, serverPlatform, saveAll } = useConfig()

const scalePresets = [1, 1.25, 1.5, 2, 3]

// Auto-save when screen options, OS, scaleFactor, or aliases change
let saveTimer = null
function debouncedSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveAll(), 800)
}
watch(() => props.screen.options, debouncedSave, { deep: true })
watch(() => props.screen.os, debouncedSave)
watch(() => props.screen.scaleFactor, debouncedSave)
watch(() => aliases.value[props.screen.name], debouncedSave, { deep: true })

const isServer = computed(() => props.screen.name === serverName.value)

const screenOS = computed(() => {
  if (isServer.value) return serverPlatform.value
  return props.screen.os || ''
})

// Friendly modifier names based on screen OS
const displayModifiers = computed(() => {
  const os = screenOS.value
  if (os === 'macos') return [
    { key: 'shift', label: 'Shift' },
    { key: 'ctrl', label: 'Control' },
    { key: 'alt', label: 'Option (⌥)' },
    { key: 'super', label: 'Command (⌘)' },
    { key: 'meta', label: 'Meta' },
    { key: 'altgr', label: 'AltGr' },
  ]
  if (os === 'windows') return [
    { key: 'shift', label: 'Shift' },
    { key: 'ctrl', label: 'Ctrl' },
    { key: 'alt', label: 'Alt' },
    { key: 'super', label: 'Win (⊞)' },
    { key: 'meta', label: 'Meta' },
    { key: 'altgr', label: 'AltGr' },
  ]
  return [
    { key: 'shift', label: 'Shift' },
    { key: 'ctrl', label: 'Ctrl' },
    { key: 'alt', label: 'Alt' },
    { key: 'super', label: 'Super' },
    { key: 'meta', label: 'Meta' },
    { key: 'altgr', label: 'AltGr' },
  ]
})

const displayModValues = computed(() => {
  const os = screenOS.value
  const base = [
    { value: 'shift', label: 'Shift' },
    { value: 'ctrl', label: os === 'macos' ? 'Control' : 'Ctrl' },
    { value: 'alt', label: os === 'macos' ? 'Option (⌥)' : 'Alt' },
    { value: 'super', label: os === 'macos' ? 'Command (⌘)' : os === 'windows' ? 'Win (⊞)' : 'Super' },
    { value: 'meta', label: 'Meta' },
    { value: 'altgr', label: 'AltGr' },
    { value: 'none', label: 'None (disabled)' },
  ]
  return base
})

// Preset logic
const presetAvailable = computed(() => {
  if (!screenOS.value || !serverPlatform.value) return false
  if (isServer.value) return false
  const pair = `${screenOS.value}-${serverPlatform.value}`
  return pair === 'macos-windows' || pair === 'windows-macos' ||
         pair === 'macos-linux' || pair === 'linux-macos'
})

const presetDescription = computed(() => {
  const os = screenOS.value
  const srv = serverPlatform.value
  if ((os === 'macos' && srv === 'windows') || (os === 'macos' && srv === 'linux')) {
    return 'Swap Option ↔ Command so muscle memory matches physical key positions on a Windows/Linux keyboard'
  }
  if ((os === 'windows' && srv === 'macos') || (os === 'linux' && srv === 'macos')) {
    return 'Swap Alt ↔ Win so muscle memory matches physical key positions on a Mac keyboard'
  }
  return ''
})

function applyPreset() {
  if (!props.screen.options) props.screen.options = {}
  const os = screenOS.value
  const srv = serverPlatform.value

  // Clear existing modifier remaps
  for (const k of ['shift', 'ctrl', 'alt', 'altgr', 'meta', 'super']) {
    delete props.screen.options[k]
  }

  const needsSwap = (os === 'macos' && (srv === 'windows' || srv === 'linux')) ||
                    ((os === 'windows' || os === 'linux') && srv === 'macos')

  if (needsSwap) {
    // Swap alt ↔ super for muscle memory
    props.screen.options.alt = 'super'
    props.screen.options.super = 'alt'
  }
}

function osIcon(os) {
  if (os === 'macos') return '🍎'
  if (os === 'windows') return '⊞'
  if (os === 'linux') return '🐧'
  return '?'
}

function osLabel(os) {
  if (os === 'macos') return 'macOS'
  if (os === 'windows') return 'Windows'
  if (os === 'linux') return 'Linux'
  return 'Unknown'
}

const corners = [
  { key: 'top-left', label: 'Top Left', pos: 'pos-tl', short: 'TL' },
  { key: 'top-right', label: 'Top Right', pos: 'pos-tr', short: 'TR' },
  { key: 'bottom-left', label: 'Bottom Left', pos: 'pos-bl', short: 'BL' },
  { key: 'bottom-right', label: 'Bottom Right', pos: 'pos-br', short: 'BR' },
]

const toggleOpts = [
  { key: 'halfDuplexCapsLock', label: 'Half-duplex Caps Lock' },
  { key: 'halfDuplexNumLock', label: 'Half-duplex Num Lock' },
  { key: 'halfDuplexScrollLock', label: 'Half-duplex Scroll Lock' },
  { key: 'preserveFocus', label: 'Preserve focus' },
]

function getActiveCorners() {
  const val = props.screen.options?.switchCorners || ''
  return corners.map(c => c.key).filter(k => val.includes('+' + k))
}

function isCornerActive(key) {
  return getActiveCorners().includes(key)
}

function toggleCorner(key) {
  const active = getActiveCorners()
  const idx = active.indexOf(key)
  if (idx >= 0) {
    active.splice(idx, 1)
  } else {
    active.push(key)
  }

  if (active.length === 0) {
    setOpt('switchCorners', '')
  } else {
    setOpt('switchCorners', 'none ' + active.map(k => '+' + k).join(' '))
  }
}

function setOpt(key, value) {
  if (!props.screen.options) props.screen.options = {}
  if (value === '' || value === 'false') {
    delete props.screen.options[key]
  } else {
    props.screen.options[key] = value
  }
}

function addAlias() {
  if (!aliases.value[props.screen.name]) aliases.value[props.screen.name] = []
  aliases.value[props.screen.name].push('')
}

function removeAlias(index) {
  aliases.value[props.screen.name].splice(index, 1)
}

function updateAlias(index, value) {
  aliases.value[props.screen.name][index] = value
}
</script>

<style scoped>
.screen-settings {
  border-top: 1px solid var(--border);
  animation: slideIn 0.15s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--accent-bg);
}

.settings-title-row { display: flex; align-items: center; gap: 8px; }

.settings-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
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

.settings-subtitle { font-size: 10px; color: var(--text-muted); margin-top: 1px; display: block; }

/* Compact sections */
.settings-section.compact {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.section-label {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
}

/* Inline row (label + control side by side) */
.inline-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.os-inline {
  font-size: 12px;
  color: var(--text);
}

/* Small inputs */
.input-sm {
  padding: 5px 8px;
  font-size: 11px;
}

.btn-sm {
  padding: 5px 12px;
  font-size: 11px;
}

/* Modifier grid — 2 columns */
.mod-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.mod-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mod-label {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--text-dim);
}

/* Corner buttons — inline row */
.corner-row {
  display: flex;
  gap: 4px;
}

.corner-btn {
  flex: 1;
  padding: 5px 0;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.corner-btn:hover {
  border-color: var(--border);
  color: var(--text);
}

.corner-btn.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

/* Input with unit */
.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-unit .input { padding-right: 28px; }

.input-unit {
  position: absolute;
  right: 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

/* Aliases */
.alias-row { display: flex; gap: 4px; margin-bottom: 3px; }
.alias-input { flex: 1; }

.alias-remove {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.alias-remove:hover { color: var(--red); background: var(--red-bg); }

.link-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.link-btn:hover { color: var(--accent); }

/* Scale presets */
.scale-row { display: flex; gap: 3px; flex: 1; }

.scale-btn {
  flex: 1;
  padding: 4px 0;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.scale-btn:hover { border-color: var(--border); color: var(--text); }
.scale-btn.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }

/* Compact toggles */
.compact-toggle { padding: 4px 0; }
.compact-toggle .toggle-label { font-size: 11px; }
</style>
