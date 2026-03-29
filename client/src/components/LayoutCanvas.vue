<template>
  <div class="canvas-area" ref="container">
    <canvas ref="canvas" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @dblclick="onDblClick" />
    <div class="canvas-hint">drag to move · resize at corner · double-click to rename</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { detectEdges } from '../lib/edge-detection.js'
import { useConfig } from '../composables/useConfig.js'

const GRID_SIZE = 5
const HANDLE_SIZE = 8
const EDGE_SNAP = 12
const COLORS = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#ff922b']

const container = ref(null)
const canvas = ref(null)
const { screens, links, serverName, debouncedSaveLayout } = useConfig()

let ctx = null
let dragging = null
let resizing = null
let selected = -1
let resizeObserver = null

function resize() {
  if (!container.value || !canvas.value) return
  const rect = container.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const dpr = window.devicePixelRatio || 1
  canvas.value.width = rect.width * dpr
  canvas.value.height = rect.height * dpr
  canvas.value.style.width = rect.width + 'px'
  canvas.value.style.height = rect.height + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw()
}

function ensureServerScreen() {
  if (!serverName.value) return
  const exists = screens.value.some(s => s.name === serverName.value)
  if (!exists) {
    const rect = container.value?.getBoundingClientRect()
    const cx = rect ? Math.round(rect.width / 2) : 400
    const cy = rect ? Math.round(rect.height / 2 - 80) : 200
    screens.value.unshift({ name: serverName.value, x: cx - 200, y: cy, w: 400, h: 140, options: {} })
    updateLinks()
  }
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')

  // ResizeObserver catches log panel collapse, tab switches, window resize
  resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(container.value)

  resize()

  // Wait for hostname to load, then ensure server screen exists
  watch(serverName, () => ensureServerScreen(), { immediate: true })

  // Default layout if empty and no server name yet
  if (screens.value.length === 0 && !serverName.value) {
    const rect = container.value.getBoundingClientRect()
    const cx = Math.round(rect.width / 2)
    const topY = Math.round(rect.height / 2 - 160)
    screens.value.push(
      { name: 'server', x: cx - 280, y: topY, w: 560, h: 160, options: {} },
      { name: 'laptop-left', x: cx - 280, y: topY + 160, w: 280, h: 175, options: {} },
      { name: 'laptop-right', x: cx, y: topY + 160, w: 280, h: 175, options: {} },
    )
    updateLinks()
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(screens, () => draw(), { deep: true })

const emit = defineEmits(['select'])

defineExpose({ addScreen, removeScreen })

function addScreen(name, w = 280, h = 175) {
  const rect = container.value.getBoundingClientRect()
  const cx = rect.width / 2 - w / 2
  const cy = rect.height / 2 - h / 2 + screens.value.length * 20
  screens.value.push({ name, x: snap(cx), y: snap(cy), w, h, options: {} })
  updateLinks()
  debouncedSaveLayout()
}

function removeScreen(index) {
  if (screens.value[index]?.name === serverName.value) return
  screens.value.splice(index, 1)
  if (selected >= screens.value.length) selected = -1
  debouncedSaveLayout()
  updateLinks()
}

function updateLinks() {
  links.value = detectEdges(screens.value)
  draw()
}

function snap(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE }

// ── Drawing ──

function draw() {
  if (!ctx || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const w = rect.width, h = rect.height
  ctx.clearRect(0, 0, w, h)

  // Grid dots — warm amber tint
  ctx.fillStyle = '#2a2520'
  for (let x = 0; x < w; x += GRID_SIZE * 8) {
    for (let y = 0; y < h; y += GRID_SIZE * 8) {
      ctx.fillRect(x, y, 1, 1)
    }
  }

  drawLinks()

  screens.value.forEach((s, i) => {
    const color = COLORS[i % COLORS.length]
    const isSel = i === selected

    // Glow for selected
    if (isSel) {
      ctx.shadowColor = color + '30'
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 0
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 3
    }

    // Fill with subtle gradient
    const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h)
    grad.addColorStop(0, color + '18')
    grad.addColorStop(1, color + '08')
    ctx.fillStyle = grad
    ctx.strokeStyle = isSel ? color + 'cc' : color + '55'
    ctx.lineWidth = isSel ? 2 : 1
    ctx.beginPath()
    ctx.roundRect(s.x, s.y, s.w, s.h, 6)
    ctx.fill()
    ctx.stroke()

    // Inner border for depth
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.strokeStyle = color + '0a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2, 5)
    ctx.stroke()

    // Label
    const isServer = serverName.value && s.name === serverName.value
    const label = isServer ? s.name + ' (server)' : s.name

    ctx.fillStyle = '#e8e9ee'
    ctx.font = '500 13px Outfit, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Measure and clamp label
    const maxLabelW = s.w - 16
    let displayLabel = label
    while (ctx.measureText(displayLabel).width > maxLabelW && displayLabel.length > 3) {
      displayLabel = displayLabel.slice(0, -4) + '...'
    }

    // Crown icon for server
    if (isServer) {
      const lw = ctx.measureText(displayLabel).width
      const crownX = s.x + s.w / 2 - lw / 2 - 14
      const crownY = s.y + s.h / 2 - 5
      ctx.fillStyle = '#e8a830'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('♛', crownX, crownY + 9)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#e8e9ee'
      ctx.font = '500 13px Outfit, system-ui, sans-serif'
    }

    ctx.fillText(displayLabel, s.x + s.w / 2, s.y + s.h / 2)

    // Dimensions
    ctx.fillStyle = '#666'
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.fillText(`${s.w} × ${s.h}`, s.x + s.w / 2, s.y + s.h / 2 + 16)

    // Resize handle
    if (isSel) {
      ctx.fillStyle = color + '88'
      ctx.beginPath()
      ctx.roundRect(s.x + s.w - HANDLE_SIZE - 1, s.y + s.h - HANDLE_SIZE - 1, HANDLE_SIZE + 1, HANDLE_SIZE + 1, 2)
      ctx.fill()
    }

    // Server border accent — drawn inside the screen
    if (isServer) {
      ctx.strokeStyle = '#e8a830aa'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.roundRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6, 4)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Dead corner indicators
    const cornerVal = s.options?.switchCorners || ''
    const cornerSize = parseInt(s.options?.switchCornerSize) || 0
    if (cornerVal.includes('+')) {
      // Scale proportionally with generous minimum
      const csW = Math.max(14, Math.min(s.w * 0.2, cornerSize * s.w / 1920))
      const csH = Math.max(14, Math.min(s.h * 0.2, cornerSize * s.h / 1080))

      ctx.fillStyle = '#e8a83030'
      ctx.strokeStyle = '#e8a83050'
      ctx.lineWidth = 1

      if (cornerVal.includes('+top-left')) {
        ctx.fillRect(s.x, s.y, csW, csH)
        ctx.strokeRect(s.x, s.y, csW, csH)
      }
      if (cornerVal.includes('+top-right')) {
        ctx.fillRect(s.x + s.w - csW, s.y, csW, csH)
        ctx.strokeRect(s.x + s.w - csW, s.y, csW, csH)
      }
      if (cornerVal.includes('+bottom-left')) {
        ctx.fillRect(s.x, s.y + s.h - csH, csW, csH)
        ctx.strokeRect(s.x, s.y + s.h - csH, csW, csH)
      }
      if (cornerVal.includes('+bottom-right')) {
        ctx.fillRect(s.x + s.w - csW, s.y + s.h - csH, csW, csH)
        ctx.strokeRect(s.x + s.w - csW, s.y + s.h - csH, csW, csH)
      }
    }
  })
}

function drawLinks() {
  for (const [screenName, linkList] of Object.entries(links.value)) {
    const src = screens.value.find(s => s.name === screenName)
    if (!src) continue
    for (const link of linkList) {
      const dst = screens.value.find(s => s.name === link.dstScreen)
      if (!dst) continue

      const seg = edgeSegment(src, link.srcDir, link.srcStart, link.srcEnd)
      ctx.strokeStyle = '#e8a83044'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.stroke()

      const srcPt = edgeMid(src, link.srcDir, link.srcStart, link.srcEnd)
      const dstPt = edgeMid(dst, opposite(link.srcDir), link.dstStart, link.dstEnd)
      ctx.strokeStyle = '#e8a83020'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(srcPt.x, srcPt.y)
      ctx.lineTo(dstPt.x, dstPt.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineCap = 'butt'
    }
  }
}

function opposite(d) { return { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[d] }

function edgeMid(s, dir, start, end) {
  const m = (start + end) / 200
  if (dir === 'left') return { x: s.x, y: s.y + s.h * m }
  if (dir === 'right') return { x: s.x + s.w, y: s.y + s.h * m }
  if (dir === 'top') return { x: s.x + s.w * m, y: s.y }
  return { x: s.x + s.w * m, y: s.y + s.h }
}

function edgeSegment(s, dir, start, end) {
  const a = start / 100, b = end / 100
  if (dir === 'left') return { x1: s.x, y1: s.y + s.h * a, x2: s.x, y2: s.y + s.h * b }
  if (dir === 'right') return { x1: s.x + s.w, y1: s.y + s.h * a, x2: s.x + s.w, y2: s.y + s.h * b }
  if (dir === 'top') return { x1: s.x + s.w * a, y1: s.y, x2: s.x + s.w * b, y2: s.y }
  return { x1: s.x + s.w * a, y1: s.y + s.h, x2: s.x + s.w * b, y2: s.y + s.h }
}

// ── Interaction ──

function canvasPos(e) {
  const r = canvas.value.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onMouseDown(e) {
  const { x, y } = canvasPos(e)

  if (selected >= 0) {
    const s = screens.value[selected]
    if (x >= s.x + s.w - HANDLE_SIZE && y >= s.y + s.h - HANDLE_SIZE &&
        x <= s.x + s.w && y <= s.y + s.h) {
      resizing = { index: selected }
      return
    }
  }

  for (let i = screens.value.length - 1; i >= 0; i--) {
    const s = screens.value[i]
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      selected = i
      emit('select', i)
      dragging = { index: i, offsetX: x - s.x, offsetY: y - s.y }
      draw()
      return
    }
  }
  selected = -1
  emit('select', -1)
  draw()
}

function onMouseMove(e) {
  const { x, y } = canvasPos(e)

  if (dragging) {
    const s = screens.value[dragging.index]
    let nx = snap(x - dragging.offsetX)
    let ny = snap(y - dragging.offsetY)

    for (let i = 0; i < screens.value.length; i++) {
      if (i === dragging.index) continue
      const o = screens.value[i]
      if (Math.abs((nx + s.w) - o.x) < EDGE_SNAP) nx = o.x - s.w
      if (Math.abs(nx - (o.x + o.w)) < EDGE_SNAP) nx = o.x + o.w
      if (Math.abs((ny + s.h) - o.y) < EDGE_SNAP) ny = o.y - s.h
      if (Math.abs(ny - (o.y + o.h)) < EDGE_SNAP) ny = o.y + o.h
      if (Math.abs(nx - o.x) < EDGE_SNAP) nx = o.x
      if (Math.abs((nx + s.w) - (o.x + o.w)) < EDGE_SNAP) nx = o.x + o.w - s.w
      if (Math.abs(ny - o.y) < EDGE_SNAP) ny = o.y
      if (Math.abs((ny + s.h) - (o.y + o.h)) < EDGE_SNAP) ny = o.y + o.h - s.h
    }

    s.x = nx
    s.y = ny
    updateLinks()
  } else if (resizing) {
    const s = screens.value[resizing.index]
    s.w = Math.max(60, snap(x - s.x))
    s.h = Math.max(40, snap(y - s.y))
    updateLinks()
  } else {
    if (selected >= 0) {
      const s = screens.value[selected]
      if (x >= s.x + s.w - HANDLE_SIZE && y >= s.y + s.h - HANDLE_SIZE &&
          x <= s.x + s.w && y <= s.y + s.h) {
        canvas.value.style.cursor = 'nwse-resize'
        return
      }
    }
    for (const s of screens.value) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        canvas.value.style.cursor = 'move'
        return
      }
    }
    canvas.value.style.cursor = 'default'
  }
}

function onMouseUp() {
  if (dragging || resizing) {
    updateLinks()
    debouncedSaveLayout()
  }
  dragging = null
  resizing = null
}

function onDblClick(e) {
  const { x, y } = canvasPos(e)
  for (const s of screens.value) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      const newName = prompt('Screen name:', s.name)
      if (newName?.trim()) {
        s.name = newName.trim()
        updateLinks()
      }
      return
    }
  }
}
</script>

<style scoped>
.canvas-area {
  position: relative;
  background: var(--bg-deep);
  overflow: hidden;
}
.canvas-area::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 25% 35%, rgba(232,168,48,0.03) 0%, transparent 50%),
    radial-gradient(ellipse at 75% 65%, rgba(92,207,230,0.02) 0%, transparent 45%);
}
.canvas-area canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.canvas-hint {
  position: absolute;
  bottom: 16px;
  left: 20px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  pointer-events: none;
  letter-spacing: 0.01em;
}
</style>
