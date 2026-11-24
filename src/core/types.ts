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

/** Arrowhead shapes offered in the properties panel. */
export type ArrowheadStyle = 'arrow' | 'triangle'

/** How an arrow end attaches to a shape. */
export type BindMode = 'inside' | 'orbit'

/**
 * Persisted attachment of an arrow end to a box shape.
 *
 * `fixedPoint` is normalized to the shape's box: `0..1` spans the shape, so
 * `[0.5, 0.5]` is its centre and `[1.04, 0.5]` is just outside the right edge
 * (used for the small elbow gap). Because the point is proportional, moving or
 * resizing the shape keeps the arrow attached to the same relative spot.
 */
export interface ArrowBinding {
  elementId: string
  mode: BindMode
  fixedPoint: [number, number]
}

/** Reference from a container (shape or arrow) to its bound text label. */
export interface BoundTextRef {
  type: 'text'
  id: string
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
  /** Text labels owned by this element (shapes and arrows). */
  boundElements?: BoundTextRef[]
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

export interface ArrowElement extends BaseElement {
  type: 'arrow'
  /** Start and end points; routing is derived from these. */
  points: [Point, Point]
  /** Shape the start end follows, if any. */
  startBinding?: ArrowBinding
  /** Shape the end end follows, if any. */
  endBinding?: ArrowBinding
  /** Head at the start; absent/null means none. */
  startArrowhead?: ArrowheadStyle | null
  /** Head at the end; absent means the classic arrow. */
  endArrowhead?: ArrowheadStyle | null
}

export type TextAlign = 'left' | 'center' | 'right'
export type TextVerticalAlign = 'top' | 'middle'

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  /** Rendered block width in scene units. */
  width: number
  /** Rendered block height (lines × fontSize × lineHeight). */
  height: number
  /** Text grows to fit its content instead of wrapping at `width`. */
  autoResize: boolean
  textAlign: TextAlign
  verticalAlign: TextVerticalAlign
  /** Line spacing multiplier (1.25 by default). */
  lineHeight: number
  /** Text as the user typed it, before wrapping. */
  originalText?: string
  /** Container shape/arrow id when this text is a label. */
  containerId?: string
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
