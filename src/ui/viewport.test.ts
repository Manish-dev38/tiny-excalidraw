import { describe, expect, it } from 'vitest'
import { clampZoom, panBy, sceneToScreen, screenToScene, zoomAt } from './viewport'

describe('sceneToScreen / screenToScene', () => {
  it('are inverses of each other', () => {
    const vp = { x: 120, y: -40, zoom: 1.5 }
    const p = { x: 37, y: 82 }
    expect(screenToScene(vp, sceneToScreen(vp, p))).toEqual(p)
  })
  it('identity viewport maps 1:1', () => {
    const vp = { x: 0, y: 0, zoom: 1 }
    expect(sceneToScreen(vp, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
  })
})

describe('zoomAt', () => {
  it('keeps the anchor scene point fixed on screen', () => {
    const vp = { x: 50, y: 50, zoom: 1 }
    const anchor = { x: 300, y: 200 }
    const next = zoomAt(vp, anchor, 2)
    expect(sceneToScreen(next, screenToScene(vp, anchor))).toEqual(anchor)
  })
  it('respects zoom bounds', () => {
    const vp = { x: 0, y: 0, zoom: 1 }
    expect(zoomAt(vp, { x: 0, y: 0 }, 100).zoom).toBe(4)
    expect(zoomAt(vp, { x: 0, y: 0 }, 0.001).zoom).toBe(0.1)
  })
})

describe('panBy', () => {
  it('shifts the viewport translation', () => {
    const vp = { x: 0, y: 0, zoom: 1 }
    expect(panBy(vp, 15, -9)).toEqual({ x: 15, y: -9, zoom: 1 })
  })
})

describe('clampZoom', () => {
  it('clamps to the allowed range', () => {
    expect(clampZoom(0.01)).toBe(0.1)
    expect(clampZoom(4)).toBe(4)
    expect(clampZoom(9)).toBe(4)
    expect(clampZoom(1)).toBe(1)
  })
})
