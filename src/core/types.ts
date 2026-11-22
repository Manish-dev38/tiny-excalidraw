/** Shared domain types for the whiteboard scene. */

/** Infrastructure shape kinds drawn as vector primitives. */
export type ShapeKind = 'laptop' | 'database' | 'server' | 'cloud' | 'user'

/** Elements described by an axis-aligned box. */
export type RectLikeType = 'rectangle' | 'ellipse' | ShapeKind

export type ElementType = 'pen' | RectLikeType | 'arrow' | 'text'

/** A point in scene coordinates (before pan/zoom transforms). */
export interface Point {
  x: number
  y: number
}

export interface BaseElement {
  /** Stable unique id (shared across peers). */
  id: string
  type: ElementType
  /** Top-left anchor in scene coordinates. */
  x: number
  y: number
  strokeColor: string
  /** Fill color; transparent strings mean no fill. */
  background: string
  strokeWidth: number
  /** Dashed stroke (arrows). Missing/false means solid. */
  dashed?: boolean
}

export interface PenElement extends BaseElement {
  type: 'pen'
  points: Point[]
}

export interface RectLikeElement extends BaseElement {
  type: RectLikeType
  width: number
  height: number
}

/** Persisted attachment of an arrow end to a box shape. */
export interface ArrowBinding {
  shapeId: string
}

export interface ArrowElement extends BaseElement {
  type: 'arrow'
  /** Start and end points. */
  points: [Point, Point]
  /** Shape the start end follows, if any. */
  startBinding?: ArrowBinding
  /** Shape the end end follows, if any. */
  endBinding?: ArrowBinding
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
}

export type ExcalidrawElement =
  | PenElement
  | RectLikeElement
  | ArrowElement
  | TextElement

export const SHAPE_KINDS: readonly ShapeKind[] = [
  'laptop',
  'database',
  'server',
  'cloud',
  'user',
]

export function isShapeKind(type: ElementType): type is ShapeKind {
  return (SHAPE_KINDS as readonly string[]).includes(type)
}
