# Tiny Excalidraw — Specification

> A lightweight, two-person collaborative whiteboard for explaining topics online.
> Styled to match Excalidraw's design language, but implemented in-house and kept small.

**Status:** Agreed (validated by grilling session).
**Deploy target:** Netlify (static hosting).

---

## 1. Product goal

Allow the user and one friend to draw/annotate an infinite whiteboard together in
real time, purely in the browser, with no backend to run. It should feel familiar to
anyone who has used Excalidraw — same visual design, toolbar layout, themes, colors,
fonts, and interaction model — but only a subset of the tools, and a fraction of the
bundle weight.

## 2. Core decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Transport | **PeerJS** (WebRTC data channel; free cloud signaling; no backend) |
| 2 | Stack | **Vite + vanilla TypeScript + Canvas API** (no framework) |
| 3 | Session model | **localStorage per-room + dynamic room link** (board survives tab close) |
| 4 | Presence | **Live cursor presence** — see the other user's pointer |
| 5 | Voice | **None** (users bring their own call) |
| 6 | Tools | **Select, hand, pen, rectangle, ellipse, arrow, text, eraser** |
| 7 | Undo/redo | **Full stack, per-person + synced** |
| 8 | Canvas | **Infinite pan + zoom** (bounded ~10%–400%; wheel zoom; hand tool / space-drag / right-click pan) |
| 9 | Export | **PNG + SVG** |
| 10 | Rooms | **Home screen → "New room" → shareable `#room=abc` link; friend joins same room** |
| 11 | Input | **Pointer Events** (unifies mouse + touch/stylus) |
| 12 | UI | **Faithful clone** of Excalidraw's design/theme/toolbar/icon style, all assets **implemented in-house** (MIT-licensed design language as reference only) |
| 13 | Text | **Click-to-place text, inline edit, drag-to-move** |
| 14 | Cleanup | **"Recent boards" list (max ~10) with delete option** |

## 3. Architecture

- **Vite + vanilla TypeScript**, single `<canvas>` renderer. Tiny bundle, instant load.
- **PeerJS** provides real-time sync: the host creates a room, the peer joins by room id.
  Messages sent over the data channel:
  - element mutations: `add`, `update`, `erase`
  - stack ops: `undo`, `redo`
  - presence: `cursor` (x, y, tool, pressure)
- **localStorage** keyed by room id holds recent boards. Load on join; merge remote events
  on receipt. Capped at ~10 rooms with manual delete.
- **Scene model:** an ordered list of elements (strokes, shapes, text). Each has a stable
  unique id. Shared state is idempotent so late-joining peers converge.

## 4. Tools & interaction

| Tool | Behavior |
|------|----------|
| Select | Click to select (dashed outline), drag to move, Delete to remove |
| Hand | Drag to pan the canvas |
| Pen | Freehand stroke from pointer path (points + widths) |
| Rectangle / Ellipse | Drag to size from anchor point |
| Arrow | Drag to place line with arrowhead |
| Text | Click to place, type inline, Enter commits, Shift+Enter adds a line, Escape cancels |
| Eraser | Overlap-based removal of strokes/shapes |

- Shortcuts: `V` select, `H` hand, `R` rectangle, `O` ellipse, `A` arrow,
  `P` pen, `T` text, `E` eraser; `Delete` removes the selection; `Esc` returns to select.
- Pan: hand tool, space-drag, or middle/right mouse drag. Zoom: mouse wheel / buttons,
  bounded ~10%–400%. Clicking the zoom percentage resets it to 100%.
- The active tool persists after drawing (it does not snap back to select).
- Pointer Events unify mouse/touch/stylus for all tools.

## 5. UI / visual design (Excalidraw-inspired)

- Dark by default with a fully working light theme. Near-black canvas, warm charcoal
  floating chrome, one muted periwinkle accent; typography follows Excalidraw's
  Assistant + handwriting pairing.
- Floating chrome instead of full-width bars:
  - **Top-left:** hamburger toggles the properties panel.
  - **Top centre:** one tool pill, grouped `hand/select · rectangle/ellipse/arrow · pen/text/eraser`.
    The active tool is filled, and each button carries its keyboard shortcut.
  - **Top-right:** `Share` copies the room link and shows a live/connecting/offline dot;
    the `…` menu holds Export PNG, Export SVG, Fit to screen, theme toggle, Back to home,
    and the room id.
  - **Bottom-left:** zoom pill (`−`, percentage, `+`; percentage resets) and undo/redo pill.
  - **Bottom-right:** `?` help popover listing every shortcut.
- **Properties panel** floats under the hamburger and renders only meaningful groups:
  pen/arrow → stroke + stroke width; rectangle/ellipse → stroke + background + stroke
  width; text → stroke. It is contextual for drawing tools and selections, closed for
  select/hand/eraser with no selection, and the hamburger can pin it open or closed.
- A contextual hint under the tool pill describes the active tool; it hides while the
  text editor is open and on narrow screens.
- **Text** uses an in-canvas inline editor: click to place, type, Enter commits,
  Shift+Enter inserts a newline, Escape cancels, click-away commits. Text inherits the
  current stroke colour so it stays visible in either theme, supports multiple lines in
  canvas rendering, bounds and SVG export, and selects itself after commit.
- Home screen: app name, "Create a board", and a recent-boards list with delete.
- Every icon/asset is drawn in-house (CSS or small SVG), not copied.
- Responsive below 720px: the tool pill spans the top and scrolls, hamburger and
  top-right actions stack into a second row, and the properties panel overlays the canvas.


## 6. Export

- SVG: serialize scene to `<svg>` (crisp at any zoom, printable).
- PNG: render scene to an offscreen canvas at a fixed scale, download.

## 7. Testing & quality

- TDD-driven build. Unit tests for the core, framework-free modules (scene model, undo/redo
  stack, element geometry, serialization/export, room-id generation).
- Type-safe: strict TypeScript throughout. No `any` leaks at module boundaries.
- Runtime checks in dev; production build is tree-shaken and gzip-reasonable.

## 8. Out of scope (future, not now)

- Voice/video, images, frames, embeds, laser/freedraw pressure modes, multi-user (>2),
  cloud persistence/accounts, real Excalidraw file format compat, mobile PWA offline.

## 9. Definition of done

1. Home screen creates/joins rooms; recent boards persist and load.
2. Two tabs/users can draw together in near real time with live cursors.
3. All eight tools work with undo/redo (synced).
4. Pan/zoom works within bounds.
5. PNG & SVG export work.
6. Netlify deploy produces a working static site.
7. `npm run build` and `npm test` pass cleanly.
