import { describe, expect, it } from 'vitest'
import {
  SHORTCUT_TO_TOOL,
  TOOL_GROUPS,
  TOOL_SHORTCUTS,
  hintFor,
  isPanelVisible,
  panelGroups,
  statusLabel,
  styleGroupsFor,
} from './uiState'
import type { ExcalidrawElement } from '../core/types'

const shape = (type: 'rectangle' | 'ellipse' | 'arrow' | 'pen' | 'text'): ExcalidrawElement => {
  const base = { id: 'e', x: 0, y: 0, strokeColor: '#000', background: 'transparent', strokeWidth: 2 }
  if (type === 'arrow') return { ...base, type, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }
  if (type === 'pen') return { ...base, type, points: [{ x: 0, y: 0 }] }
  if (type === 'text') return { ...base, type, text: 'hi', fontSize: 24 }
  return { ...base, type, width: 10, height: 10 }
}

describe('styleGroupsFor', () => {
  it('offers only the groups a drawing tool can use', () => {
    expect(styleGroupsFor('pen', null)).toEqual(['stroke', 'strokeWidth'])
    expect(styleGroupsFor('arrow', null)).toEqual(['stroke', 'strokeWidth'])
    expect(styleGroupsFor('rectangle', null)).toEqual(['stroke', 'background', 'strokeWidth'])
    expect(styleGroupsFor('ellipse', null)).toEqual(['stroke', 'background', 'strokeWidth'])
  })

  it('offers nothing for tools that do not draw', () => {
    expect(styleGroupsFor('select', null)).toEqual([])
    expect(styleGroupsFor('hand', null)).toEqual([])
    expect(styleGroupsFor('eraser', null)).toEqual([])
    expect(styleGroupsFor('text', null)).toEqual([])
  })

  it('follows the selected element type', () => {
    expect(styleGroupsFor('select', shape('pen'))).toEqual(['stroke', 'strokeWidth'])
    expect(styleGroupsFor('select', shape('text'))).toEqual(['stroke'])
    expect(styleGroupsFor('select', shape('rectangle'))).toEqual([
      'stroke',
      'background',
      'strokeWidth',
    ])
  })
})

describe('panel visibility and groups', () => {
  it('is contextual in auto mode', () => {
    expect(isPanelVisible('rectangle', null, 'auto')).toBe(true)
    expect(isPanelVisible('select', null, 'auto')).toBe(false)
    expect(isPanelVisible('select', shape('ellipse'), 'auto')).toBe(true)
  })

  it('can be forced open or closed by the hamburger', () => {
    expect(isPanelVisible('select', null, 'open')).toBe(true)
    expect(isPanelVisible('rectangle', null, 'closed')).toBe(false)
  })

  it('shows defaults when pinned open without a style context', () => {
    expect(panelGroups('select', null, 'open')).toEqual([
      'stroke',
      'background',
      'strokeWidth',
    ])
    expect(panelGroups('select', null, 'auto')).toEqual([])
    expect(panelGroups('rectangle', null, 'closed')).toEqual([])
  })
})

describe('hints', () => {
  it('describes the active tool', () => {
    expect(hintFor('hand', null)).toContain('pan')
    expect(hintFor('pen', null)).toContain('draw')
    expect(hintFor('text', null)).toContain('type')
    expect(hintFor('eraser', null)).toContain('erase')
    expect(hintFor('select', null)).toContain('select')
  })

  it('describes a selection', () => {
    expect(hintFor('select', shape('rectangle'))).toContain('move')
  })
})

describe('tool metadata', () => {
  it('gives every tool a shortcut and maps the shortcut back', () => {
    const tools = TOOL_GROUPS.flat()
    for (const tool of tools) {
      const key = TOOL_SHORTCUTS[tool]
      expect(key).toHaveLength(1)
      expect(SHORTCUT_TO_TOOL[key.toLowerCase()]).toBe(tool)
    }
  })

  it('labels connection states', () => {
    expect(statusLabel('live')).toBe('Live')
    expect(statusLabel('offline')).toBe('Friend offline')
    expect(statusLabel('connecting')).toBe('Connecting…')
  })
})
