import { describe, it, expect } from 'vitest'
import { detectEdges } from './edge-detection.js'

describe('detectEdges', () => {
  it('returns empty object for empty array', () => {
    expect(detectEdges([])).toEqual({})
  })

  it('returns empty object for null/undefined input', () => {
    expect(detectEdges(null)).toEqual({})
    expect(detectEdges(undefined)).toEqual({})
  })

  it('returns empty links for a single screen', () => {
    const screens = [{ name: 'server', x: 0, y: 0, w: 400, h: 300 }]
    const links = detectEdges(screens)
    expect(links.server).toEqual([])
  })

  it('detects right-left adjacency between two screens', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 400, y: 0, w: 400, h: 300 },
    ]
    const links = detectEdges(screens)
    expect(links.A.length).toBeGreaterThan(0)
    expect(links.B.length).toBeGreaterThan(0)

    const aRight = links.A.find(l => l.srcDir === 'right')
    expect(aRight).toBeDefined()
    expect(aRight.dstScreen).toBe('B')
    expect(aRight.srcStart).toBe(0)
    expect(aRight.srcEnd).toBe(100)

    const bLeft = links.B.find(l => l.srcDir === 'left')
    expect(bLeft).toBeDefined()
    expect(bLeft.dstScreen).toBe('A')
  })

  it('detects top-bottom adjacency between two screens', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 0, y: 300, w: 400, h: 300 },
    ]
    const links = detectEdges(screens)

    const aBottom = links.A.find(l => l.srcDir === 'bottom')
    expect(aBottom).toBeDefined()
    expect(aBottom.dstScreen).toBe('B')

    const bTop = links.B.find(l => l.srcDir === 'top')
    expect(bTop).toBeDefined()
    expect(bTop.dstScreen).toBe('A')
  })

  it('produces partial range links when screens partially overlap', () => {
    // B is half the height of A, aligned to A's right edge
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 200 },
      { name: 'B', x: 400, y: 50, w: 400, h: 100 },
    ]
    const links = detectEdges(screens)

    const aRight = links.A.find(l => l.srcDir === 'right')
    expect(aRight).toBeDefined()
    expect(aRight.srcStart).toBe(25) // 50/200 * 100
    expect(aRight.srcEnd).toBe(75)   // 150/200 * 100

    const bLeft = links.B.find(l => l.srcDir === 'left')
    expect(bLeft).toBeDefined()
    expect(bLeft.srcStart).toBe(0)
    expect(bLeft.srcEnd).toBe(100)
  })

  it('does not detect links when screens are far apart', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 600, y: 0, w: 400, h: 300 },
    ]
    const links = detectEdges(screens)
    expect(links.A).toEqual([])
    expect(links.B).toEqual([])
  })

  it('does not detect links when edges are within snap threshold but no vertical overlap', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 400, y: 400, w: 400, h: 300 }, // no vertical overlap
    ]
    const links = detectEdges(screens)
    expect(links.A).toEqual([])
    expect(links.B).toEqual([])
  })

  it('detects links within snap threshold', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 410, y: 0, w: 400, h: 300 }, // 10px gap, within threshold
    ]
    const links = detectEdges(screens)
    expect(links.A.length).toBeGreaterThan(0)
  })

  it('handles three screens in a row', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 400, y: 0, w: 400, h: 300 },
      { name: 'C', x: 800, y: 0, w: 400, h: 300 },
    ]
    const links = detectEdges(screens)

    // A links to B (right)
    expect(links.A.find(l => l.srcDir === 'right' && l.dstScreen === 'B')).toBeDefined()
    // B links to A (left) and C (right)
    expect(links.B.find(l => l.srcDir === 'left' && l.dstScreen === 'A')).toBeDefined()
    expect(links.B.find(l => l.srcDir === 'right' && l.dstScreen === 'C')).toBeDefined()
    // C links to B (left)
    expect(links.C.find(l => l.srcDir === 'left' && l.dstScreen === 'B')).toBeDefined()
    // A should not link directly to C
    expect(links.A.find(l => l.dstScreen === 'C')).toBeUndefined()
  })

  it('skips screens with zero or negative dimensions', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 400, y: 0, w: 0, h: 300 },
      { name: 'C', x: 400, y: 0, w: -100, h: 300 },
    ]
    const links = detectEdges(screens)
    expect(links.A).toEqual([])
  })

  it('skips screens with missing name', () => {
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { x: 400, y: 0, w: 400, h: 300 },
    ]
    const links = detectEdges(screens)
    expect(links.A).toEqual([])
    expect(Object.keys(links)).toEqual(['A'])
  })

  it('handles L-shaped layout with multiple adjacencies', () => {
    // A is above-left, B is to the right, C is below A
    const screens = [
      { name: 'A', x: 0, y: 0, w: 400, h: 300 },
      { name: 'B', x: 400, y: 0, w: 400, h: 300 },
      { name: 'C', x: 0, y: 300, w: 400, h: 300 },
    ]
    const links = detectEdges(screens)

    // A → B (right), A → C (bottom)
    expect(links.A.find(l => l.srcDir === 'right')).toBeDefined()
    expect(links.A.find(l => l.srcDir === 'bottom')).toBeDefined()
    // B and C should not be adjacent
    expect(links.B.find(l => l.dstScreen === 'C')).toBeUndefined()
    expect(links.C.find(l => l.dstScreen === 'B')).toBeUndefined()
  })
})
