<template>
  <div class="screen-settings">
    <div class="settings-header">
      <span class="settings-title">{{ screen.name }}</span>
      <span class="settings-subtitle">Screen Settings</span>
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

const { aliases } = useConfig()

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

.settings-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  display: block;
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
