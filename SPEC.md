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
| 6 | Tools | **Pen, rectangle, ellipse, arrow, text, eraser** |
| 7 | Undo/redo | **Full stack, per-person + synced** |
| 8 | Canvas | **Infinite pan + zoom** (bounded ~10%–400%; wheel zoom; space/right-click pan) |
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
| Pen | Freehand stroke from pointer path (points + widths) |
| Rectangle / Ellipse | Drag to size from anchor point |
| Arrow | Drag to place line with arrowhead |
| Text | Click to place box, type inline, drag to move |
| Eraser | Overlap-based removal of strokes/shapes |

- Pan: space-drag or middle/right mouse drag. Zoom: mouse wheel, bounded ~10%–400%.
- Pointer Events unify mouse/touch/stylus for all tools.

## 5. UI / visual design (faithful clone)

- Match Excalidraw's: light/dark themes, color palette, toolbar position & grouping,
  icon style, and typography (Virgil + Assistant/FiraSans look).
- Every icon/asset is drawn in-house (CSS or small SVG), not copied.
- Home screen: app name, "New room" button, recent-boards list.
- Canvas screen: top toolbar, canvas, footer hints, export menu (PNG/SVG), room link display.

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
3. All six tools work with undo/redo (synced).
4. Pan/zoom works within bounds.
5. PNG & SVG export work.
6. Netlify deploy produces a working static site.
7. `npm run build` and `npm test` pass cleanly.
