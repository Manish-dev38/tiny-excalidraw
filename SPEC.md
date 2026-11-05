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
| 6 | Tools | **Select, hand, pen, rectangle, ellipse, arrow, text, eraser** |
| 7 | Undo/redo | **Full stack, per-person + synced** |
| 8 | Canvas | **Infinite pan + zoom** (bounded ~10%–400%; wheel zoom; hand tool / space-drag / right-click pan) |
| 9 | Export | **PNG + SVG** |
| 10 | Rooms | **Home screen → "New room" → shareable `#room=abc` link; friend joins same room** |
| 11 | Input | **Pointer Events** (unifies mouse + touch/stylus) |
| 12 | UI | **Faithful clone** of Excalidraw's design/theme/toolbar/icon style, all assets **implemented in-house** (MIT-licensed design language as reference only) |
| 13 | Text | **Click-to-place text, inline edit, drag-to-move** |
| 14 | Cleanup | **"Recent boards" list (max 10) with delete option** |
| 15 | Board files | **Save / Save As / Import `.whiteboard` JSON** (editable scenes, no backend) |
| 16 | Autosave | **300 ms debounced IndexedDB writes + visible saved status** |
| 17 | Restore | **Reopen the last active board on a bare URL; Back to home clears it** |

## 3. Architecture

- **Vite + vanilla TypeScript**, single `<canvas>` renderer. Tiny bundle, instant load.
- **PeerJS** provides real-time sync: the host creates a room, the peer joins by room id.
  Messages sent over the data channel:
  - element mutations: `add`, `update`, `remove`
  - whole-scene replacement: `replace` (atomic import sync)
  - presence: `cursor` (x, y, tool)
- **IndexedDB** (`tiny-excalidraw`, version 1) holds recent boards keyed by room id,
  capped at 10 with manual delete. A `meta` store holds the last active room and the
  one-time legacy-migration marker. A localStorage adapter takes over with a warning
  when IndexedDB is unavailable.
- **Board files** are versioned JSON envelopes wrapping the same scene; importing
  validates the whole file before changing anything.
- **Autosave** writes the scene through an injected repository after a trailing 300 ms
  debounce, tracks saving/saved/failed status, and flushes on hide, page leave, and
  before returning home.
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
  - **Top-right:** saved/unsaved status and `Save` sit beside `Share`, which copies the
    room link and shows a live/connecting/offline dot; the `…` menu holds Save As,
    Import board, Export PNG, Export SVG, Fit to screen, theme toggle, Back to home, and
    the room id.
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
- Home screen: app name, "Create a board", a secondary "Import a board" button, and a
  recent-boards list with delete.
- Every icon/asset is drawn in-house (CSS or small SVG), not copied.
- Responsive below 720px: the tool pill spans the top and scrolls, hamburger and
  top-right actions stack into a second row, save status collapses to its dot, home
  actions stack, and the properties panel overlays the canvas.


## 6. Export

- SVG: serialize scene to `<svg>` (crisp at any zoom, printable).
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
  "version": 1,
  "savedAt": "2026-11-05T10:00:00.000Z",
  "roomId": "abc123",
  "scene": { "elements": [] }
}
```

- The scene reuses the existing element model, so every stroke, shape, arrow, text
  block, colour, position, and size round-trips and stays editable.
- Import accepts the versioned envelope, plus legacy raw `{ elements }` objects, with
  `.whiteboard` and `.json` extensions.
- Validation is all-or-nothing: malformed JSON, wrong formats/versions, missing or
  type-invalid fields, non-finite numbers, duplicate ids, unsupported types (including
  `image`), more than 5 MB, 10,000 elements, or 50,000 points per stroke reject the
  whole file.
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
  stack, element geometry, serialization/export, room-id generation).
- Type-safe: strict TypeScript throughout. No `any` leaks at module boundaries.
- Runtime checks in dev; production build is tree-shaken and gzip-reasonable.

## 9. Out of scope (future, not now)

- Voice/video, images, frames, embeds, laser/freedraw pressure modes, multi-user (>2),
  cloud persistence/accounts, real Excalidraw file format compat, mobile PWA offline.
- Silent overwrite of a chosen file via the File System Access API, board titles, and
  persisting viewport/tool/selection per board.

## 10. Definition of done

1. Home screen creates, imports, joins, and deletes rooms; recent boards persist and load.
2. Two tabs/users can draw together in near real time with live cursors.
3. All eight tools work with undo/redo (synced).
4. Pan/zoom works within bounds.
5. PNG & SVG export work.
6. Save, Save As, and Import round-trip editable `.whiteboard` files.
7. Autosave shows its status, flushes when leaving, and reopens the last board.
8. Netlify deploy produces a working static site.
9. `npm run build` and `npm test` pass cleanly.
