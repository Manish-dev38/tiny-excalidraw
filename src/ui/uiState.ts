import type { Tool } from '../collab/protocol'
import type { ExcalidrawElement } from '../core/types'

/** Every tool the UI can activate. Hand, select and eraser are UI-only. */
export type UiTool = Tool | 'eraser' | 'select' | 'hand'

/** How the properties panel decides to show itself. */
export type PanelMode = 'auto' | 'open' | 'closed'

/** Property groups the panel can render. */
export type StyleGroup =
  | 'stroke'
  | 'background'
  | 'strokeWidth'
  | 'lineStyle'
  | 'fontSize'
  | 'textAlign'
  | 'arrowheads'

export type ConnectionStatus = 'connecting' | 'live' | 'offline'

/** Toolbar groups, separated by a hairline in the tool pill. */
export const TOOL_GROUPS: readonly (readonly UiTool[])[] = [
  ['hand', 'select'],
  ['rectangle', 'ellipse', 'arrow'],
  ['pen', 'text', 'eraser'],
]

export const TOOL_SHORTCUTS: Partial<Record<UiTool, string>> = {
  hand: 'H',
  select: 'V',
  rectangle: 'R',
  ellipse: 'O',
  arrow: 'A',
  pen: 'P',
  text: 'T',
  eraser: 'E',
}

export const SHORTCUT_TO_TOOL: Record<string, UiTool> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUTS)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([tool, key]) => [key.toLowerCase(), tool as UiTool]),
)

/**
 * Which property groups are meaningful for a tool or a selected element.
 * The panel never shows a control that would do nothing.
 */
export function styleGroupsFor(tool: UiTool, selection: ExcalidrawElement | null): StyleGroup[] {
  if (selection) {
    switch (selection.type) {
      case 'pen':
        return ['stroke', 'strokeWidth']
      case 'arrow':
        return ['stroke', 'strokeWidth', 'lineStyle', 'fontSize', 'textAlign', 'arrowheads']
      case 'text':
        return ['stroke', 'fontSize', 'textAlign']
      case 'rectangle':
      case 'ellipse':
      case 'laptop':
      case 'database':
      case 'server':
      case 'cloud':
      case 'user':
        return ['stroke', 'background', 'strokeWidth', 'fontSize', 'textAlign']
    }
  }

  switch (tool) {
    case 'pen':
      return ['stroke', 'strokeWidth']
    case 'text':
      return ['stroke', 'fontSize', 'textAlign']
    case 'arrow':
      return ['stroke', 'strokeWidth', 'lineStyle', 'fontSize', 'textAlign', 'arrowheads']
    case 'rectangle':
    case 'ellipse':
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      return ['stroke', 'background', 'strokeWidth']
    default:
      return []
  }
}

/** Panel visibility: contextual in `auto`, forced by the hamburger otherwise. */
export function isPanelVisible(
  tool: UiTool,
  selection: ExcalidrawElement | null,
  mode: PanelMode,
): boolean {
  if (mode === 'closed') return false
  if (mode === 'open') return true
  return styleGroupsFor(tool, selection).length > 0
}

/**
 * Groups to render. When pinned open with no style context, show the defaults
 * for the next element (stroke, background, width).
 */
export function panelGroups(
  tool: UiTool,
  selection: ExcalidrawElement | null,
  mode: PanelMode,
): StyleGroup[] {
  if (!isPanelVisible(tool, selection, mode)) return []
  const groups = styleGroupsFor(tool, selection)
  return groups.length > 0 ? groups : ['stroke', 'background', 'strokeWidth']
}

export function hintFor(tool: UiTool, selection: ExcalidrawElement | null): string {
  if (selection) return 'Drag to move · Delete to remove'
  switch (tool) {
    case 'select':
      return 'Click an element to select it, then drag to move'
    case 'hand':
      return 'Drag to pan the canvas'
    case 'rectangle':
    case 'ellipse':
    case 'arrow':
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      return 'Click and drag, release when you’re finished'
    case 'pen':
      return 'Click and drag to draw'
    case 'text':
      return 'Click to place text, then type'
    case 'eraser':
      return 'Click or drag over elements to erase'
  }
}

export function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'live':
      return 'Live'
    case 'offline':
      return 'Friend offline'
    case 'connecting':
      return 'Connecting…'
  }
}
