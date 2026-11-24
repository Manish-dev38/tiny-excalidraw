import { migrateElements } from './migrate'
import type { Scene } from './scene'
import type { ElementType, ExcalidrawElement, Point } from './types'

export const BOARD_FORMAT = 'tiny-excalidraw'
/**
 * v2 adds infrastructure shapes, v3 adds proportional arrow bindings, text
 * metrics/alignment and arrowheads. Older files are migrated on import.
 */
export const BOARD_VERSION = 3
const SUPPORTED_VERSIONS = [1, 2, 3]
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ELEMENTS = 10_000
export const MAX_POINTS = 50_000
export const MAX_TEXT_LENGTH = 100_000

const ELEMENT_TYPES: ElementType[] = [
  'pen',
  'rectangle',
  'ellipse',
  'laptop',
  'database',
  'server',
  'cloud',
  'user',
  'arrow',
  'text',
]

export class BoardFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardFileError'
  }
}

export interface ParsedBoardFile {
  scene: Scene
  roomId?: string
  savedAt?: string
  /** True for the older raw `{ elements }` shape. */
  legacy: boolean
}

export interface BoardFile {
  format: typeof BOARD_FORMAT
  version: number
  savedAt: string
  roomId: string
  scene: Scene
}

/** Builds the versioned envelope written to a `.whiteboard` file. */
export function buildBoardFile(
  scene: Scene,
  roomId: string,
  savedAt: Date = new Date(),
): BoardFile {
  return {
    format: BOARD_FORMAT,
    version: BOARD_VERSION,
    savedAt: savedAt.toISOString(),
    roomId,
    scene,
  }
}

export function serializeBoardFile(
  scene: Scene,
  roomId: string,
  savedAt: Date = new Date(),
): string {
  return JSON.stringify(buildBoardFile(scene, roomId, savedAt))
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** `whiteboard-<roomId>-<YYYY-MM-DD>.whiteboard`, using the local date. */
export function defaultFileName(roomId: string, date: Date = new Date()): string {
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  return `whiteboard-${roomId}-${day}.whiteboard`
}

const UNSAFE_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g
const EXPLICIT_SUFFIX = /\.(whiteboard|json)$/i

/**
 * Keeps an explicit `.whiteboard`/`.json` suffix, otherwise appends
 * `.whiteboard`. Unsafe path and control characters are removed, and a name
 * that collapses to nothing uses the fallback.
 */
export function normalizeFileName(name: string, fallback: string): string {
  const stripped = name
    .replace(UNSAFE_FILENAME, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
  if (!stripped) return fallback
  if (EXPLICIT_SUFFIX.test(stripped)) return stripped
  return `${stripped}.whiteboard`
}

/** Derives a safe board filename from an imported file's name. */
export function fileNameFromSource(source: string, fallback: string): string {
  const base = source.split(/[\\/]/).pop() ?? source
  return normalizeFileName(base, fallback)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isBinding(value: unknown): boolean {
  if (!isRecord(value)) return false
  // Legacy v1/v2 attachment.
  if (typeof value.shapeId === 'string') {
    return value.shapeId.length > 0 && value.shapeId.length <= 200
  }
  return (
    typeof value.elementId === 'string' &&
    value.elementId.length > 0 &&
    value.elementId.length <= 200 &&
    (value.mode === 'inside' || value.mode === 'orbit') &&
    Array.isArray(value.fixedPoint) &&
    value.fixedPoint.length === 2 &&
    value.fixedPoint.every(isFiniteNumber)
  )
}

function isBoundTextRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.type === 'text' &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.id.length <= 200
  )
}

function isArrowhead(value: unknown): boolean {
  return value === null || value === 'arrow' || value === 'triangle'
}

function validBoundElements(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.length <= 1000 && value.every(isBoundTextRef))
  )
}

function readElements(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new BoardFileError('This board file is missing its drawing.')
  if (value.length > MAX_ELEMENTS) {
    throw new BoardFileError(`This board has too many elements (max ${MAX_ELEMENTS.toLocaleString()}).`)
  }
  return value
}

function validateElement(value: unknown): ExcalidrawElement {
  if (!isRecord(value)) throw new BoardFileError('This board contains an invalid element.')
  const type = value.type
  if (typeof type !== 'string' || !ELEMENT_TYPES.includes(type as ElementType)) {
    if (type === 'image') {
      throw new BoardFileError("This board contains images, which this app can't open.")
    }
    throw new BoardFileError("This board contains an element type this app doesn't support.")
  }
  if (
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 200 ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    typeof value.strokeColor !== 'string' ||
    value.strokeColor.length > 100 ||
    typeof value.background !== 'string' ||
    value.background.length > 100 ||
    !isFiniteNumber(value.strokeWidth) ||
    (value.dashed !== undefined && typeof value.dashed !== 'boolean') ||
    !validBoundElements(value.boundElements) ||
    (value.containerId !== undefined &&
      (typeof value.containerId !== 'string' || value.containerId.length > 200))
  ) {
    throw new BoardFileError('This board contains an element with invalid properties.')
  }

  switch (type as ElementType) {
    case 'pen': {
      if (!Array.isArray(value.points) || value.points.length < 1) {
        throw new BoardFileError('This board contains a drawing stroke with invalid points.')
      }
      if (value.points.length > MAX_POINTS) {
        throw new BoardFileError(
          `A drawing stroke has too many points (max ${MAX_POINTS.toLocaleString()}).`,
        )
      }
      if (!value.points.every(isPoint)) {
        throw new BoardFileError('This board contains a drawing stroke with invalid points.')
      }
      break
    }
    case 'rectangle':
    case 'ellipse':
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      if (!isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
        throw new BoardFileError('This board contains a shape with invalid size.')
      }
      break
    case 'arrow':
      if (
        !Array.isArray(value.points) ||
        value.points.length !== 2 ||
        !value.points.every(isPoint)
      ) {
        throw new BoardFileError('This board contains an arrow with invalid points.')
      }
      if (
        (value.startBinding !== undefined && !isBinding(value.startBinding)) ||
        (value.endBinding !== undefined && !isBinding(value.endBinding)) ||
        (value.startArrowhead !== undefined && !isArrowhead(value.startArrowhead)) ||
        (value.endArrowhead !== undefined && !isArrowhead(value.endArrowhead))
      ) {
        throw new BoardFileError('This board contains an arrow with an invalid attachment.')
      }
      break
    case 'text':
      if (
        typeof value.text !== 'string' ||
        value.text.length > MAX_TEXT_LENGTH ||
        (value.originalText !== undefined &&
          (typeof value.originalText !== 'string' ||
            value.originalText.length > MAX_TEXT_LENGTH)) ||
        !isFiniteNumber(value.fontSize) ||
        value.fontSize <= 0 ||
        (value.width !== undefined && !isFiniteNumber(value.width)) ||
        (value.height !== undefined && !isFiniteNumber(value.height)) ||
        (value.autoResize !== undefined && typeof value.autoResize !== 'boolean') ||
        (value.textAlign !== undefined &&
          value.textAlign !== 'left' &&
          value.textAlign !== 'center' &&
          value.textAlign !== 'right') ||
        (value.verticalAlign !== undefined &&
          value.verticalAlign !== 'top' &&
          value.verticalAlign !== 'middle') ||
        (value.lineHeight !== undefined && !isFiniteNumber(value.lineHeight))
      ) {
        throw new BoardFileError('This board contains text with invalid properties.')
      }
      break
  }

  return value as unknown as ExcalidrawElement
}

/** Validates a whole element list; any invalid element rejects the scene. */
export function parseSceneElements(value: unknown): Scene {
  const seen = new Set<string>()
  const validated = readElements(value).map((element) => {
    const result = validateElement(element)
    if (seen.has(result.id)) {
      throw new BoardFileError('This board contains two elements with the same id.')
    }
    seen.add(result.id)
    return result
  })
  return { elements: migrateElements(validated) }
}

/**
 * Parses a `.whiteboard` envelope or a legacy raw `{ elements }` file.
 * Throws a BoardFileError with a user-facing reason for any invalid input.
 */
export function parseBoardFile(raw: string): ParsedBoardFile {
  if (new TextEncoder().encode(raw).byteLength > MAX_FILE_BYTES) {
    throw new BoardFileError('This file is too large (max 5 MB).')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BoardFileError("This isn't a Tiny Excalidraw board file.")
  }
  if (!isRecord(parsed)) throw new BoardFileError("This isn't a Tiny Excalidraw board file.")

  if (parsed.format !== undefined) {
    if (parsed.format !== BOARD_FORMAT) {
      throw new BoardFileError("This isn't a Tiny Excalidraw board file.")
    }
    if (typeof parsed.version !== 'number' || !SUPPORTED_VERSIONS.includes(parsed.version)) {
      if (typeof parsed.version === 'number' && parsed.version > BOARD_VERSION) {
        throw new BoardFileError('This board was created by a newer version of the app.')
      }
      throw new BoardFileError('This board file uses an unsupported version.')
    }
    if (!isRecord(parsed.scene)) {
      throw new BoardFileError('This board file is missing its drawing.')
    }
    const roomId =
      typeof parsed.roomId === 'string' && parsed.roomId.length <= 200
        ? parsed.roomId
        : undefined
    const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined
    return {
      scene: parseSceneElements(parsed.scene.elements),
      roomId,
      savedAt,
      legacy: false,
    }
  }

  return { scene: parseSceneElements(parsed.elements), legacy: true }
}
