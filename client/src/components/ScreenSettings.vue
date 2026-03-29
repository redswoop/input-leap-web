<template>
  <div class="screen-settings">
    <div class="settings-header">
      <div class="settings-title-row">
        <span class="settings-title">{{ screen.name }}</span>
        <span v-if="screen.name === serverName" class="server-tag">server</span>
      </div>
      <span class="settings-subtitle">Screen Settings</span>
    </div>

    <!-- Switch Corners -->
    <div class="settings-section">
      <div class="section-label">Switch Corners</div>
      <p class="section-hint">Prevent screen switching when cursor is in a corner</p>
      <div class="corner-viz">
        <div class="corner-screen">
          <button
            v-for="corner in corners"
            :key="corner.key"
            class="corner-dot"
            :class="[corner.pos, { active: isCornerActive(corner.key) }]"
            @click="toggleCorner(corner.key)"
            :title="corner.label"
          />
          <span class="corner-screen-label">{{ screen.name }}</span>
        </div>
      </div>
      <div class="input-group" style="margin-top:12px;">
        <label class="input-label">Corner dead zone size</label>
        <div class="input-with-unit">
          <input class="input" type="number"
            :value="screen.options?.switchCornerSize || ''"
            @input="setOpt('switchCornerSize', $event.target.value)"
            placeholder="0">
          <span class="input-unit">px</span>
        </div>
      </div>
    </div>

    <!-- Aliases -->
    <div class="settings-section">
      <div class="section-label">Aliases</div>
      <p class="section-hint">Hostnames that map to this screen</p>
      <div v-for="(alias, ai) in (aliases[screen.name] || [])" :key="ai" class="alias-row">
        <input class="input alias-input" :value="alias"
          @input="updateAlias(ai, $event.target.value)"
          placeholder="hostname" spellcheck="false">
        <button class="alias-remove" @click="removeAlias(ai)">&times;</button>
      </div>
      <button class="link-btn" @click="addAlias">+ add alias</button>
    </div>

    <!-- Modifier Remapping -->
    <div class="settings-section">
      <div class="section-label">Modifier Keys</div>
      <p class="section-hint">Remap modifiers for this screen</p>
      <div class="input-group" v-for="mod in modifiers" :key="mod.key">
        <label class="input-label">{{ mod.label }}</label>
        <select class="input" :value="screen.options?.[mod.key] || ''" @change="setOpt(mod.key, $event.target.value)">
          <option value="">default</option>
          <option v-for="v in modValues" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
    </div>

    <!-- Toggles -->
    <div class="settings-section">
      <div class="section-label">Fixes</div>
      <div v-for="opt in toggleOpts" :key="opt.key" class="toggle-row">
        <span class="toggle-label">{{ opt.label }}</span>
        <input type="checkbox" class="toggle"
          :checked="screen.options?.[opt.key] === 'true'"
          @change="setOpt(opt.key, $event.target.checked ? 'true' : 'false')">
      </div>
    </div>
  </div>
</template>

<script setup>
import { useConfig } from '../composables/useConfig.js'

const props = defineProps({
  screen: { type: Object, required: true }
})

const { aliases, serverName } = useConfig()

const corners = [
  { key: 'top-left', label: 'Top Left', pos: 'pos-tl' },
  { key: 'top-right', label: 'Top Right', pos: 'pos-tr' },
  { key: 'bottom-left', label: 'Bottom Left', pos: 'pos-bl' },
  { key: 'bottom-right', label: 'Bottom Right', pos: 'pos-br' },
]

const modifiers = [
  { key: 'shift', label: 'Shift' },
  { key: 'ctrl', label: 'Ctrl' },
  { key: 'alt', label: 'Alt' },
  { key: 'altgr', label: 'AltGr' },
  { key: 'meta', label: 'Meta' },
  { key: 'super', label: 'Super' },
]

const modValues = ['shift', 'ctrl', 'alt', 'altgr', 'meta', 'super', 'none']

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
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--accent-bg);
}

.settings-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

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
  flex-shrink: 0;
}

.settings-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  display: block;
}

.settings-section {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
}

.section-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.section-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

/* Corner visualization */
.corner-viz {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.corner-screen {
  position: relative;
  width: 160px;
  height: 100px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-inset);
}

.corner-screen-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

.corner-dot {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  cursor: pointer;
  transition: all 0.15s ease;
}

.corner-dot:hover {
  border-color: var(--accent-border);
  background: var(--bg-hover);
}

.corner-dot.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(232, 168, 48, 0.2);
}

.corner-dot.active::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--accent);
}

.pos-tl { top: -4px; left: -4px; }
.pos-tr { top: -4px; right: -4px; }
.pos-bl { bottom: -4px; left: -4px; }
.pos-br { bottom: -4px; right: -4px; }

.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-unit .input {
  padding-right: 36px;
}

.input-unit {
  position: absolute;
  right: 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

/* Aliases */
.alias-row {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.alias-input {
  flex: 1;
  font-size: 11px;
  padding: 6px 10px;
}

.alias-remove {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 15px;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.alias-remove:hover {
  color: var(--red);
  background: var(--red-bg);
}

.link-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s;
}

.link-btn:hover {
  color: var(--accent);
}
</style>
