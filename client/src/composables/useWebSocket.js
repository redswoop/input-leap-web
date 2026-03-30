import { ref } from 'vue'

const logs = ref([])
const serverStatus = ref({ running: false, pid: null, startedAt: null })
const events = ref([]) // parsed structured events
const connected = ref(false)
let ws = null
let reconnectDelay = 1000
const MAX_RECONNECT_DELAY = 30000

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)

  ws.addEventListener('open', () => {
    connected.value = true
    reconnectDelay = 1000 // reset backoff on successful connection
  })

  ws.addEventListener('message', (e) => {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      logs.value.push('[ws] Received malformed message\n')
      return
    }

    if (msg.type === 'log') {
      logs.value.push(msg.data)
      if (logs.value.length > 500) logs.value.splice(0, logs.value.length - 500)
    } else if (msg.type === 'status') {
      serverStatus.value = msg.data
    } else if (msg.type === 'event') {
      events.value.unshift(msg.data) // newest first
      if (events.value.length > 200) events.value.splice(200)
    }
  })

  ws.addEventListener('close', () => {
    connected.value = false
    ws = null
    logs.value.push('[ws] Disconnected. Reconnecting...\n')
    setTimeout(connect, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY)
  })

  ws.addEventListener('error', () => {
    // close event will fire after error, triggering reconnect
  })
}

export function useWebSocket() {
  if (!ws) connect()
  return { logs, serverStatus, events, connected }
}
