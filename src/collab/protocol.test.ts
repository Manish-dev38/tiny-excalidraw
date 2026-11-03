import { describe, expect, it } from 'vitest'
import { decodeMessage, encodeMessage, type ClientMessage } from './protocol'
import type { ExcalidrawElement } from '../core/types'

const rect: ExcalidrawElement = {
  id: 'a',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
}

const messages: ClientMessage[] = [
  { type: 'add', element: rect },
  { type: 'update', id: 'a', patch: { x: 5 } },
  { type: 'remove', id: 'a' },
  { type: 'undo' },
  { type: 'redo' },
  { type: 'cursor', x: 12, y: 34, tool: 'pen' },
  { type: 'cursor', x: 0, y: 0, tool: null },
]

describe('encodeMessage / decodeMessage', () => {
  it('round-trips every message type', () => {
    for (const msg of messages) {
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg)
    }
  })
  it('rejects invalid JSON', () => {
    expect(() => decodeMessage('not json')).toThrow()
  })
  it('rejects non-object payloads', () => {
    expect(() => decodeMessage('null')).toThrow()
    expect(() => decodeMessage('"hi"')).toThrow()
  })
  it('rejects unknown message types', () => {
    expect(() => decodeMessage(JSON.stringify({ type: 'bogus' }))).toThrow()
  })
  it('rejects messages missing required fields', () => {
    expect(() => decodeMessage(JSON.stringify({ type: 'add' }))).toThrow()
    expect(() => decodeMessage(JSON.stringify({ type: 'cursor', x: 1 }))).toThrow()
  })
})
