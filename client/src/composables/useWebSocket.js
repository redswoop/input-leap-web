import { ref } from 'vue'

const logs = ref([])
const serverStatus = ref({ running: false, pid: null })
let ws = null

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'log') {
      logs.value.push(msg.data)
      if (logs.value.length > 500) logs.value.splice(0, logs.value.length - 500)
    } else if (msg.type === 'status') {
      serverStatus.value = msg.data
    }
  })

  ws.addEventListener('close', () => {
    logs.value.push('[ws] Disconnected. Reconnecting...\n')
    setTimeout(connect, 2000)
  })

  ws.addEventListener('error', () => ws.close())
}

export function useWebSocket() {
  if (!ws) connect()
  return { logs, serverStatus }
}
