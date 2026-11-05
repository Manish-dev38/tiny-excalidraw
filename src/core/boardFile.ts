import type { Scene } from './scene'

export const BOARD_FORMAT = 'tiny-excalidraw'
export const BOARD_VERSION = 1

export interface BoardFile {
  format: typeof BOARD_FORMAT
  version: typeof BOARD_VERSION
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
