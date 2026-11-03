import type { ExcalidrawElement } from '../core/types'

export type Tool = 'pen' | 'rectangle' | 'ellipse' | 'arrow' | 'text'

export type ClientMessage =
  | { type: 'add'; element: ExcalidrawElement }
  | { type: 'update'; id: string; patch: Partial<ExcalidrawElement> }
  | { type: 'remove'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'cursor'; x: number; y: number; tool: Tool | null }

const MESSAGE_TYPES = ['add', 'update', 'remove', 'undo', 'redo', 'cursor']
const TOOLS = ['pen', 'rectangle', 'ellipse', 'arrow', 'text']

export function encodeMessage(msg: ClientMessage): string {
  return JSON.stringify(msg)
}

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('Expected an object')
}

function isElement(value: unknown): value is ExcalidrawElement {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    typeof e.x === 'number' &&
    typeof e.y === 'number'
  )
}

export function decodeMessage(raw: string): ClientMessage {
  const parsed: unknown = JSON.parse(raw)
  assertObject(parsed)
  const { type } = parsed
  if (typeof type !== 'string' || !MESSAGE_TYPES.includes(type)) {
    throw new Error(`Unknown message type: ${String(type)}`)
  }

  switch (type) {
    case 'add': {
      if (!isElement(parsed.element)) throw new Error('Invalid element payload')
      return { type: 'add', element: parsed.element }
    }
    case 'update': {
      if (typeof parsed.id !== 'string') throw new Error('Missing id')
      assertObject(parsed.patch)
      return { type: 'update', id: parsed.id, patch: parsed.patch }
    }
    case 'remove':
      if (typeof parsed.id !== 'string') throw new Error('Missing id')
      return { type: 'remove', id: parsed.id }
    case 'undo':
      return { type: 'undo' }
    case 'redo':
      return { type: 'redo' }
    case 'cursor': {
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
        throw new Error('Invalid cursor coordinates')
      }
      const tool = parsed.tool
      if (tool !== null && (typeof tool !== 'string' || !TOOLS.includes(tool))) {
        throw new Error('Invalid tool')
      }
      return { type: 'cursor', x: parsed.x, y: parsed.y, tool: tool as Tool | null }
    }
    default:
      throw new Error(`Unknown message type: ${String(type)}`)
  }
}
