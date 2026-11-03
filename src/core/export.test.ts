import { describe, expect, it } from 'vitest'
import { toSVG } from './export'
import { addElement, createScene } from './scene'
import type { ExcalidrawElement } from './types'

const rect = (id: string): ExcalidrawElement => ({
  id,
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

describe('toSVG', () => {
  it('emits an svg root with a viewBox', () => {
    const svg = toSVG(addElement(createScene(), rect('a')))
    expect(svg).toMatch(/^<svg/)
    expect(svg).toMatch(/viewBox="9\.5 19\.5 31 41"/)
  })
  it('renders a rectangle with its geometry and colors', () => {
    const svg = toSVG(addElement(createScene(), rect('a')))
    expect(svg).toContain('<rect')
    expect(svg).toContain('x="10"')
    expect(svg).toContain('y="20"')
    expect(svg).toContain('width="30"')
    expect(svg).toContain('height="40"')
    expect(svg).toContain('stroke="#000"')
    expect(svg).toContain('stroke-width="1"')
  })
  it('renders a pen element as a path', () => {
    const pen: ExcalidrawElement = {
      id: 'p1',
      type: 'pen',
      x: 0,
      y: 0,
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      strokeColor: '#0af',
      background: 'transparent',
      strokeWidth: 2,
    }
    const svg = toSVG(addElement(createScene(), pen))
    expect(svg).toContain('<path')
    expect(svg).toContain('d="M 1 2 L 3 4"')
  })
  it('renders text with escaped content', () => {
    const text: ExcalidrawElement = {
      id: 't1',
      type: 'text',
      x: 0,
      y: 0,
      text: 'a < b & c',
      fontSize: 16,
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 1,
    }
    const svg = toSVG(addElement(createScene(), text))
    expect(svg).toContain('<text')
    expect(svg).toContain('a &lt; b &amp; c')
  })
})
