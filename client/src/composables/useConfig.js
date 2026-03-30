import { ref, computed, watch } from 'vue'

const screens = ref([])
const links = ref({})
const aliases = ref({})
const serverName = ref('')
const serverPlatform = ref('')
const connectedClients = ref({}) // name → { width, height, cursorX, cursorY, active }
const options = ref({
  relativeMouseMoves: 'false',
  screenSaverSync: 'true',
  clipboardSharing: 'true',
  clipboardSharingSize: '1048576',
  switchDelay: '250',
  switchDoubleTap: '250',
  heartbeat: '5000',
})

const visibleScreens = computed(() => screens.value.filter(s => s.visible !== false))

const configText = computed(() => {
  const lines = []
  const vis = visibleScreens.value

  lines.push('section: screens')
  for (const s of vis) {
    lines.push(`\t${s.name}:`)
    if (s.options) {
      for (const [k, v] of Object.entries(s.options)) {
        if (v !== '' && v !== undefined) lines.push(`\t\t${k} = ${v}`)
      }
    }
  }
  lines.push('end')
  lines.push('')

  const visNames = new Set(vis.map(s => s.name))

  // Aliases
  const hasAliases = Object.values(aliases.value).some(a => a?.length > 0)
  if (hasAliases) {
    lines.push('section: aliases')
    for (const [name, aliasList] of Object.entries(aliases.value)) {
      if (!aliasList?.length) continue
      lines.push(`\t${name}:`)
      for (const a of aliasList) lines.push(`\t\t${a}`)
    }
    lines.push('end')
    lines.push('')
  }

  lines.push('section: links')
  for (const [name, linkList] of Object.entries(links.value)) {
    if (!linkList.length || !visNames.has(name)) continue
    const visLinks = linkList.filter(lk => visNames.has(lk.dstScreen))
    if (!visLinks.length) continue
    lines.push(`\t${name}:`)
    for (const lk of visLinks) {
      const dir = lk.srcDir === 'top' ? 'up' : lk.srcDir === 'bottom' ? 'down' : lk.srcDir
      const srcInt = (lk.srcStart === 0 && lk.srcEnd === 100) ? '' : `(${lk.srcStart},${lk.srcEnd})`
      const dstInt = (lk.dstStart === 0 && lk.dstEnd === 100) ? '' : `(${lk.dstStart},${lk.dstEnd})`
      lines.push(`\t\t${dir}${srcInt} = ${lk.dstScreen}${dstInt}`)
    }
  }
  lines.push('end')
  lines.push('')

  lines.push('section: options')
  for (const [k, v] of Object.entries(options.value)) {
    if (v !== '' && v !== undefined) lines.push(`\t${k} = ${v}`)
  }
  lines.push('end')

  return lines.join('\n')
})

function buildJSON() {
  const screenMap = {}
  for (const s of screens.value) {
    screenMap[s.name] = s.options || {}
  }
  return {
    screens: screenMap,
    links: links.value,
    aliases: aliases.value,
    options: options.value,
  }
}

async function saveConfig() {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildJSON()),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Save config failed (${res.status})`)
  }
}

async function saveLayout() {
  const res = await fetch('/api/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screens: screens.value.map(s => ({
        name: s.name, x: s.x, y: s.y, w: s.w, h: s.h,
        os: s.os || null, options: s.options || {},
        visible: s.visible !== false,
        scaleFactor: s.scaleFactor || 1,
      })),
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Save layout failed (${res.status})`)
  }
}

async function saveAll() {
  await Promise.all([saveConfig(), saveLayout()])
}

// Debounced layout save — called on drag/resize
let layoutSaveTimer = null
function debouncedSaveLayout() {
  clearTimeout(layoutSaveTimer)
  layoutSaveTimer = setTimeout(() => saveLayout().catch(() => {}), 1000)
}

// ── Init ──

let initDone = false

async function init() {
  if (initDone) return
  initDone = true

  // Fetch hostname + platform
  try {
    const res = await fetch('/api/hostname')
    if (res.ok) {
      const data = await res.json()
      serverName.value = data.hostname
      serverPlatform.value = data.platform || ''
    }
  } catch { /* server not reachable yet */ }

  // Try loading saved layout
  try {
    const res = await fetch('/api/layout')
    if (res.ok) {
      const layout = await res.json()
      if (layout?.screens?.length) {
        screens.value = layout.screens.map(s => ({
          name: s.name, x: s.x, y: s.y, w: s.w, h: s.h,
          os: s.os || null, options: s.options || {},
          visible: s.visible !== false,
          scaleFactor: s.scaleFactor || 1,
        }))
      }
    }
  } catch { /* layout not available */ }

  // Load existing InputLeap config and merge options/aliases
  try {
    const res = await fetch('/api/config')
    if (res.ok) {
      const cfg = await res.json()
      if (cfg) {
        // Merge global options
        if (cfg.options && Object.keys(cfg.options).length) {
          options.value = { ...options.value, ...cfg.options }
        }
        // Merge aliases
        if (cfg.aliases && Object.keys(cfg.aliases).length) {
          aliases.value = cfg.aliases
        }
        // Merge per-screen options from config into layout screens
        if (cfg.screens) {
          for (const [name, opts] of Object.entries(cfg.screens)) {
            const existing = screens.value.find(s => s.name === name)
            if (existing && opts && Object.keys(opts).length) {
              existing.options = { ...existing.options, ...opts }
            }
          }
        }
      }
    }
  } catch { /* config not available */ }
}

// Poll InputLeap status endpoint for connected clients
let pollStarted = false
let pollIntervalId = null

async function pollStatus() {
  try {
    const res = await fetch('/api/il-status')
    if (res.ok) {
      const data = await res.json()
      if (data?.clients) {
        const map = {}
        for (const c of data.clients) {
          map[c.name] = {
            width: c.width, height: c.height,
            cursorX: c.cursorX, cursorY: c.cursorY,
            active: c.active,
          }
        }
        connectedClients.value = map
      }
    }
  } catch { /* server not running */ }
}

function startPolling() {
  if (pollStarted) return
  pollStarted = true
  pollStatus()
  pollIntervalId = setInterval(pollStatus, 3000)
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
  pollStarted = false
}

export function useConfig() {
  init()
  startPolling()
  return {
    screens, links, aliases, options, serverName, serverPlatform,
    connectedClients, visibleScreens,
    configText, saveConfig, saveLayout, saveAll, debouncedSaveLayout, buildJSON,
    stopPolling,
  }
}
