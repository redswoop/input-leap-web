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
const { screens, links } = useConfig()

let ctx = null
let dragging = null
let resizing = null
let selected = -1

function resize() {
  if (!container.value || !canvas.value) return
  const rect = container.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.value.width = rect.width * dpr
  canvas.value.height = rect.height * dpr
  canvas.value.style.width = rect.width + 'px'
  canvas.value.style.height = rect.height + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw()
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  resize()
  window.addEventListener('resize', resize)

  // Default layout if empty
  if (screens.value.length === 0) {
    const cx = Math.round(canvas.value.width / 2)
    const topY = Math.round(canvas.value.height / 2 - 100)
    screens.value.push(
      { name: 'ultrawide', x: cx - 160, y: topY, w: 320, h: 90, options: {} },
      { name: 'laptop-left', x: cx - 160, y: topY + 90, w: 160, h: 100, options: {} },
      { name: 'laptop-right', x: cx, y: topY + 90, w: 160, h: 100, options: {} },
    )
    updateLinks()
  }
})

onUnmounted(() => window.removeEventListener('resize', resize))

watch(screens, () => draw(), { deep: true })

const emit = defineEmits(['select'])

defineExpose({ addScreen, removeScreen })

function addScreen(name, w = 160, h = 100) {
  const cx = canvas.value.width / 2 - w / 2
  const cy = canvas.value.height / 2 - h / 2 + screens.value.length * 20
  screens.value.push({ name, x: snap(cx), y: snap(cy), w, h, options: {} })
  updateLinks()
}

function removeScreen(index) {
  screens.value.splice(index, 1)
  if (selected >= screens.value.length) selected = -1
  updateLinks()
}

function updateLinks() {
  links.value = detectEdges(screens.value)
  draw()
}

function snap(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE }

// ── Drawing ──

function draw() {
  if (!ctx) return
  const c = canvas.value
  ctx.clearRect(0, 0, c.width, c.height)

  // Grid dots — warm amber tint
  ctx.fillStyle = '#2a2520'
  for (let x = 0; x < c.width; x += GRID_SIZE * 8) {
    for (let y = 0; y < c.height; y += GRID_SIZE * 8) {
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
    ctx.fillStyle = '#e8e9ee'
    ctx.font = '500 13px Outfit, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.name, s.x + s.w / 2, s.y + s.h / 2)

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
  if (dragging || resizing) updateLinks()
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
