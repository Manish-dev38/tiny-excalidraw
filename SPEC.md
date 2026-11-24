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
| 3 | Session model | **IndexedDB per-room + dynamic room link** (board survives tab close; localStorage fallback) |
| 4 | Presence | **Live cursor presence** — see the other user's pointer |
| 5 | Voice | **None** (users bring their own call) |
| 6 | Tools | **Select, hand, pen, rectangle, ellipse, arrow, text, eraser + infrastructure shapes** |
| 7 | Undo/redo | **Full stack, per-person + synced** |
| 8 | Canvas | **Infinite pan + zoom** (bounded ~10%–400%; wheel zoom; hand tool / space-drag / right-click pan) |
| 9 | Export | **PNG + SVG** |
| 10 | Rooms | **Home screen → "New room" → shareable `#room=abc` link; friend joins same room** |
| 11 | Input | **Pointer Events** (unifies mouse + touch/stylus) |
| 12 | UI | **Faithful clone** of Excalidraw's design/theme/toolbar/icon style, all assets **implemented in-house** (MIT-licensed design language as reference only) |
| 13 | Text | **Click-to-place text with real font metrics and word wrap; inline edit; drag-to-move** |
| 14 | Cleanup | **"Recent boards" list (max 10) with delete option** |
| 15 | Board files | **Save / Save As / Import `.whiteboard` JSON** (editable scenes, no backend) |
| 16 | Autosave | **300 ms debounced IndexedDB writes + visible saved status** |
| 17 | Restore | **Reopen the last active board on a bare URL; Back to home clears it** |
| 18 | Multi-select | **Shift-click and rubber-band marquee; group move/delete/style as one undo step** |
| 19 | Clipboard | **Internal copy/cut/paste/duplicate (`Ctrl/⌘ C/X/V/D`) with offset fan-out; no cross-app paste** |
| 20 | Text editing | **Double-click or Enter reopens the inline editor pre-filled; emptying the text deletes it** |
| 21 | Shapes | **Five infrastructure shapes — laptop, database, server, cloud, user — in a toolbar picker** |
| 22 | Arrows | **Orthogonal elbow routing, independent heads at both ends (none/arrow/triangle), optional dashed style** |
| 23 | Attachment | **Proportional arrow anchors on a shape's border (`inside`/`orbit`), following moves and resizes; moving an arrow detaches it** |
| 24 | Resize | **8 handles on shapes, corner/left-right handles on text (wrap width), group scaling; Shift keeps aspect, Alt resizes from centre** |
| 25 | Labels | **One bound text label per shape or arrow, centred and re-wrapped as the container changes** |
| 26 | Deleting | **Deleting a shape also removes its label and attached arrows, as one undo step** |

## 3. Architecture

- **Vite + vanilla TypeScript**, single `<canvas>` renderer. Tiny bundle, instant load.
- **PeerJS** provides real-time sync: the host creates a room, the peer joins by room id.
  Messages sent over the data channel:
  - element mutations: `add`, `update`, `remove`
  - whole-scene replacement: `replace` (atomic import sync)
  - presence: `cursor` (x, y, tool)
  - `update` patches use `null` to remove an optional property (arrow attachments)
    because JSON drops `undefined` keys.
- **IndexedDB** (`tiny-excalidraw`, version 1) holds recent boards keyed by room id,
  capped at 10 with manual delete. A `meta` store holds the last active room and the
  one-time legacy-migration marker. A localStorage adapter takes over with a warning
  when IndexedDB is unavailable.
- **Board files** are versioned JSON envelopes wrapping the same scene; importing
  validates the whole file before changing anything. Version 3 adds proportional arrow
  bindings, text metrics/alignment, bound labels, and arrowheads; version 1 and 2 files
  still import and are migrated on read.
- **Autosave** writes the scene through an injected repository after a trailing 300 ms
  debounce, tracks saving/saved/failed status, and flushes on hide, page leave, and
  before returning home.
- **Scene model:** an ordered list of elements (strokes, shapes, text). Each has a stable
  unique id. Arrows may carry `startBinding`/`endBinding`
  `{ elementId, mode: 'inside' | 'orbit', fixedPoint: [nx, ny] }` attachments, where
  `fixedPoint` is proportional to the shape's box. Text carries `width`, `height`,
  `autoResize`, `textAlign`, `verticalAlign`, and `lineHeight`, and a label points back
  at its container with `containerId`. Shared state is idempotent so late-joining peers
  converge.
- **Grouped actions** (multi-move, multi-delete, detach-on-delete, paste/duplicate) are
  applied as one batched history op, so they undo and redo in a single step while the
  broadcast still fans out to individual peer ops. A resize gesture and the resulting
  label/arrow updates also form one undo entry.

## 4. Tools & interaction

| Tool | Behavior |
|------|----------|
| Select | Click to select (dashed outline); drag a selection to move it; Delete to remove |
| Hand | Drag to pan the canvas |
| Pen | Freehand stroke from pointer path (points + widths) |
| Rectangle / Ellipse | Drag to size from anchor point |
| Shapes | Picker with laptop, database, server, cloud, and user; drag to size like a rectangle |
| Arrow | Drag to place an elbow-routed arrow that attaches to nearby shapes |
| Text | Click to place, type inline, Enter commits, Shift+Enter adds a line, Escape cancels |
| Eraser | Overlap-based removal of strokes/shapes |

- Shortcuts: `V` select, `H` hand, `R` rectangle, `O` ellipse, `A` arrow,
  `P` pen, `T` text, `E` eraser; `Delete` removes the selection; `Esc` returns to select.
- Pan: hand tool, space-drag, or middle/right mouse drag. Zoom: mouse wheel / buttons,
  bounded ~10%–400%. Clicking the zoom percentage resets it to 100%.
- After drawing, the new element is selected and the tool returns to Select, so style
  changes apply to that element immediately instead of only to future drawings.
- Multi-select: Shift-click toggles an element in the selection; dragging from empty
  canvas rubber-bands a marquee. Group move, delete, and style changes apply to the whole
  selection and undo as one step. Style changes only touch properties an element accepts
  (e.g. no background on text).
- Clipboard: `Ctrl/⌘ C`, `X`, `V`, and `D` copy/cut/paste/duplicate the selection through
  an internal (localStorage-backed) clipboard shared by board tabs. Pastes offset by
  20 px and fan out on repeated paste; text fields keep native clipboard behaviour and
  external paste is out of scope. Arrow attachments are remapped to cloned shapes or
  dropped when the target shape is not part of the copied set.
- Text: double-click a text element, or press Enter with one selected, to reopen the
  inline editor pre-filled. Enter commits (trimmed), Escape discards, click-away commits,
  unchanged text is a no-op, and emptying the text removes the element. Text is measured
  with real font metrics and wrapped greedily on word boundaries (explicit newlines are
  preserved and words are never split) at a minimum block width of 60 px. Font sizes are
  16/20/28/36 and alignment is left/centre/right.
- Resize: selecting a shape shows eight handles (corners and edge midpoints); dragging one
  resizes the element, with a 12 × 12 minimum. Holding **Shift** keeps the aspect ratio on
  corner handles; holding **Alt** resizes from the centre. Text exposes its four corners
  plus left/right handles and resizing sets a fixed wrap width (`autoResize: false`) so it
  reflows instead of scaling glyphs. A multi-element selection scales every member through
  the group box, scales font sizes by `min(sx, sy)` and never scales stroke width; bound
  arrows are recomputed from their anchors.
- Labels: double-click a shape or arrow to add one bound text label. Shape labels keep an
  8 px inset, wrap at the container width, and centre vertically and horizontally; arrow
  labels sit centred on the route and wrap at `min(240, arrow length)`. Resizing or moving
  the container reflows its label.
- Arrows: routed as orthogonal elbows (two runs joined by a mid jog, straight for
  axis-aligned drags), with independent heads at each end (`none`, `arrow`, or `triangle`)
  drawn along the terminal segment. An end dropped inside a shape binds `inside` and snaps
  to the facing edge midpoint; an end dropped within 24 px binds `orbit` to the nearest
  border point. Both keep a 6 px gap and store a proportional `fixedPoint`, so moving or
  resizing the shape keeps the arrow attached to the same relative spot. Moving the arrow
  itself detaches it.
- Deleting: removing a shape also removes its bound label and every arrow attached to it,
  and a single undo restores all of them. Deleting just a label leaves its container.
- Pointer Events unify mouse/touch/stylus for all tools.

## 5. UI / visual design (Excalidraw-inspired)

- Dark by default with a fully working light theme. Near-black canvas, warm charcoal
  floating chrome, one muted periwinkle accent; typography follows Excalidraw's
  Assistant + handwriting pairing.
- Floating chrome instead of full-width bars:
  - **Top-left:** hamburger toggles the properties panel.
  - **Top centre:** one tool pill, grouped `hand/select · rectangle/ellipse/arrow · pen/text/eraser`,
    plus a **Shapes** picker button that opens a small menu (laptop, database, server, cloud,
    user) so the pill stays compact. The active tool is filled, and each button carries its
    keyboard shortcut.
  - **Top-right:** saved/unsaved status and `Save` sit beside `Share`, which copies the
    room link and shows a live/connecting/offline dot; the `…` menu holds Save As,
    Import board, Export PNG, Export SVG, Fit to screen, theme toggle, Back to home, and
    the room id.
  - **Bottom-left:** zoom pill (`−`, percentage, `+`; percentage resets) and undo/redo pill.
  - **Bottom-right:** `?` help popover listing every shortcut.
- **Properties panel** floats under the hamburger and renders only meaningful groups:
  pen → stroke + stroke width; text → stroke + font size + alignment; arrow → stroke +
  width + line style + font + alignment + arrowheads; rectangle/ellipse/infrastructure
  shapes → stroke + background + width + font + alignment (for their label). Groups
  appear in the order stroke, width, line style, background, font, alignment,
  arrowheads, so only the implemented controls are shown. It is contextual for drawing
  tools and selections, closed for select/hand/eraser with no selection, and the
  hamburger can pin it open or closed. With a multi-selection the groups follow the
  primary (last-selected) element and apply to every selected element that accepts the
  property; groups whose selected values disagree show a "Mixed" badge and leave every
  option unpressed until the user picks a value.
- A contextual hint under the tool pill describes the active tool; it hides while the
  text editor is open and on narrow screens.
- **Text** uses an in-canvas inline editor: click to place, type, Enter commits,
  Shift+Enter inserts a newline, Escape cancels, click-away commits. Double-clicking an
  existing text (or pressing Enter while it is selected) reopens the same editor
  pre-filled. Text inherits the current stroke colour so it stays visible in either
  theme, supports multiple lines in canvas rendering, bounds and SVG export, and selects
  itself after commit. Only one editor exists at a time; opening another commits the
  open one first.
- Home screen: app name, "Create a board", a secondary "Import a board" button, and a
  recent-boards list with delete.
- Every icon/asset is drawn in-house (CSS or small SVG), not copied.
- Responsive below 720px: the tool pill spans the top and scrolls, hamburger and
  top-right actions stack into a second row, save status collapses to its dot, home
  actions stack, and the properties panel overlays the canvas.


## 6. Export

- SVG: serialize scene to `<svg>` (crisp at any zoom, printable), including elbow-routed
  arrows with both arrowheads, dashed strokes, wrapped/aligned text, bound labels, and
  the infrastructure shapes.
- PNG: render scene to an offscreen canvas at a fixed scale, download.

## 7. Board files, autosave & restore

### Save and Save As

- **Save** downloads the complete scene immediately using the board's remembered
  filename; `Ctrl/Cmd+S` does the same and suppresses the browser's page-save dialog.
- **Save As** (`Ctrl/Cmd+Shift+S`, also in the `…` menu) opens a native `<dialog>` with a
  filename field, remembers the chosen name per board, and downloads.
- Default filename: `whiteboard-<roomId>-<YYYY-MM-DD>.whiteboard`.
- An explicit `.whiteboard` or `.json` suffix is preserved; otherwise `.whiteboard` is
  appended. Path separators, control characters, and unsafe characters are stripped.
- Saving an empty board is allowed. An open inline text editor is committed first.

### Board file format

```json
{
  "format": "tiny-excalidraw",
  "version": 3,
  "savedAt": "2026-11-24T10:00:00.000Z",
  "roomId": "abc123",
  "scene": { "elements": [] }
}
```

- The scene reuses the existing element model, so every stroke, shape, arrow, text
  block, colour, position, size, dashed flag, arrowhead, proportional binding, text
  metric/alignment field, and bound label round-trips and stays editable.
- Version 2 added infrastructure shapes and arrow attachments; version 3 adds
  proportional (`inside`/`orbit`) bindings, text metrics/alignment, bound labels, and
  arrowheads. Version 1 and 2 files import unchanged and are migrated in memory: legacy
  `{ shapeId }` attachments become proportional anchors, text gains its layout fields,
  `boundElements` is rebuilt from `containerId`, and labels are re-wrapped and re-centred.
  Files with a version above 3 are rejected as "created by a newer version".
- Validation also accepts the legacy `{ shapeId }` binding form so older files load, and
  checks arrowheads (`null`/`arrow`/`triangle`), text alignment/line-height fields, and
  bound-text references.
- Import accepts the versioned envelope, plus legacy raw `{ elements }` objects, with
  `.whiteboard` and `.json` extensions.
- Validation is all-or-nothing: malformed JSON, wrong formats/versions, missing or
  type-invalid fields (including arrow attachment shape ids), non-finite numbers,
  duplicate ids, unsupported types (including `image`), more than 5 MB, 10,000 elements,
  or 50,000 points per stroke reject the whole file.
- Files from a newer version fail with a specific "created by a newer version" message.

### Import behaviour

- Import is available in the `…` menu and from the home screen.
- Inside a board, import keeps the current room id and share link, asks for confirmation
  only when the scene is non-empty, replaces the scene, fits it locally, clears history,
  and broadcasts an atomic `replace` message to the peer.
- A peer receiving `replace` swaps its scene, closes any open text editor, clears its
  history, and keeps its viewport.
- Home import creates a new room, opens the imported scene, stores the board, and adopts
  the source filename. A file's saved `roomId` is metadata only.
- Invalid files leave the current drawing untouched and show a specific error dialog.

### Autosave and restore

- Scene changes autosave through the repository after a trailing 300 ms debounce.
- Status shows `Saving…`, `Saved`, or `Not saved` (with the reason in a tooltip) beside
  the Save button; below 720 px it collapses to a coloured dot.
- A failed write retries on the next edit and on page hide. Pending writes flush on
  `pagehide`, when the page becomes hidden, and before returning home.
- A bare URL reopens the last active room; opening a room link remembers it; Back to
  home clears both the hash and the resume pointer, so a reload stays on home.
- Legacy localStorage boards migrate once, only when missing from IndexedDB, leaving the
  original data untouched. The migration marker prevents deleted boards from returning.
- Theme preference remains in localStorage; it is not board data.

## 8. Testing & quality

- TDD-driven build. Unit tests for the core, framework-free modules (scene model, undo/redo
  stack, element geometry, elbow routing, proportional arrow bindings and anchors,
  resizing and handle hit-testing, text measurement/wrapping, bound-label layout and
  deletion cascades, v1/v2→v3 migration, serialization/export, board-file validation,
  clipboard cloning, text-edit rules, room-id generation). The suite is 23 files /
  250 tests.
- Interactions that need a DOM (marquee, clipboard shortcuts, inline text editing,
  dragging bound arrows) are verified in the browser against the running app.
- Type-safe: strict TypeScript throughout. No `any` leaks at module boundaries.
- Runtime checks in dev; production build is tree-shaken and gzip-reasonable.

## 9. Out of scope (future, not now)

- Voice/video, images, frames, embeds, laser/freedraw pressure modes, multi-user (>2),
  cloud persistence/accounts, real Excalidraw file format compat, mobile PWA offline.
- Silent overwrite of a chosen file via the File System Access API, board titles, and
  persisting viewport/tool/selection per board.
- Element rotation, curved or multi-segment arrow routing beyond the elbow, per-segment
  arrow editing, and cross-application clipboard paste.

## 10. Definition of done

1. Home screen creates, imports, joins, and deletes rooms; recent boards persist and load.
2. Two tabs/users can draw together in near real time with live cursors.
3. Every tool (pen, rectangle, ellipse, arrow, text, eraser, and the five infrastructure
   shapes) works with undo/redo (synced).
4. Pan/zoom works within bounds.
5. PNG & SVG export work, including elbow arrows with heads, dashes, wrapped text, bound
   labels, and infrastructure shapes.
6. Save, Save As, and Import round-trip editable `.whiteboard` files (v3, with v1/v2
   migration on import).
7. Autosave shows its status, flushes when leaving, and reopens the last board.
8. Multi-select, the internal clipboard, text re-editing, and proportional arrow
   attachment all behave as specified and undo as single steps.
9. Shapes resize from eight handles (Shift/Alt modifiers, group scaling) and text resizes
   its wrap width; deleting a shape cascades to its label and attached arrows in one undo.
10. Both arrowheads, font size, and text alignment are editable from the properties panel,
    including a Mixed state for multi-selections.
11. Netlify deploy produces a working static site.
12. `npm run build` and `npm test` pass cleanly.
