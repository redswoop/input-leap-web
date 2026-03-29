import { ref, computed } from 'vue'

const screens = ref([])
const links = ref({})
const aliases = ref({})
const serverName = ref('')
const options = ref({
  relativeMouseMoves: 'false',
  screenSaverSync: 'true',
  clipboardSharing: 'true',
  clipboardSharingSize: '1048576',
  switchDelay: '250',
  switchDoubleTap: '250',
  heartbeat: '5000',
})

const configText = computed(() => {
  const lines = []

  lines.push('section: screens')
  for (const s of screens.value) {
    lines.push(`\t${s.name}:`)
    if (s.options) {
      for (const [k, v] of Object.entries(s.options)) {
        if (v !== '' && v !== undefined) lines.push(`\t\t${k} = ${v}`)
      }
    }
  }
  lines.push('end')
  lines.push('')

  // Aliases
  const hasAliases = Object.values(aliases.value).some(a => a.length > 0)
  if (hasAliases) {
    lines.push('section: aliases')
    for (const [name, aliasList] of Object.entries(aliases.value)) {
      if (aliasList.length === 0) continue
      lines.push(`\t${name}:`)
      for (const a of aliasList) lines.push(`\t\t${a}`)
    }
    lines.push('end')
    lines.push('')
  }

  lines.push('section: links')
  for (const [name, linkList] of Object.entries(links.value)) {
    if (!linkList.length) continue
    lines.push(`\t${name}:`)
    for (const lk of linkList) {
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
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildJSON()),
  })
}

let hostnameLoaded = false

async function loadHostname() {
  if (hostnameLoaded) return
  hostnameLoaded = true
  try {
    const res = await fetch('/api/hostname')
    const { hostname } = await res.json()
    serverName.value = hostname
  } catch { /* ignore */ }
}

export function useConfig() {
  loadHostname()
  return { screens, links, aliases, options, serverName, configText, saveConfig, buildJSON }
}
