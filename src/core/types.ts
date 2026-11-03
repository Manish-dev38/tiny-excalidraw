/** Shared domain types for the whiteboard scene. */

export type ElementType = 'pen' | 'rectangle' | 'ellipse' | 'arrow' | 'text'

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
}

export interface PenElement extends BaseElement {
  type: 'pen'
  points: Point[]
}

export interface RectLikeElement extends BaseElement {
  type: 'rectangle' | 'ellipse'
  width: number
  height: number
}

export interface ArrowElement extends BaseElement {
  type: 'arrow'
  /** Start and end points. */
  points: [Point, Point]
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
