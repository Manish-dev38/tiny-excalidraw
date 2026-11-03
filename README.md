# Tiny Excalidraw

A lightweight, two-person collaborative whiteboard for explaining topics online —
styled like Excalidraw, but a fraction of the size. Built with **Vite + vanilla
TypeScript + Canvas**, synced in real time over **PeerJS** (WebRTC) with no backend
to run.

## Features

- Tools: pen, rectangle, ellipse, arrow, text, eraser
- Infinite pan + zoom (mouse wheel / space-drag / middle-drag)
- Full undo/redo (Ctrl/Cmd+Z, Ctrl+Shift+Z)
- Real-time collaboration with live cursor presence
- Boards persist in local storage (per room), with a recent-boards list
- Export to **PNG** and **SVG**
- Light/dark theme (Excalidraw-inspired), in-house iconography

## Run locally

```bash
npm install
npm run dev        # dev server
npm test           # vitest suite (71 tests)
npm run build      # type-check + production build to dist/
```

## How to use

1. Open the app → **Start a new board**. A room URL is generated, e.g.
   `https://your-site.com/#room=abc123`.
2. Send that link to your friend. The first person to open it becomes the host;
   whoever joins later connects as a client. If the host is offline, the client
   shows "Friend offline".
3. Draw together — strokes, shapes, and text appear live on both screens.
4. Bring your own voice/video call; the board is canvas-only.

## Deploy to Netlify

- Connect this repo to Netlify (or drag-and-drop the `dist/` folder).
- Build command: `npm run build`
- Publish directory: `dist`
- No environment variables or backend needed.

The app is a static site; collaboration uses PeerJS's free cloud signaling.

## Project layout

```
src/
  core/       pure logic: types, scene, geometry, history (op-based undo),
              room ids, serialization, SVG export
  collab/     peer protocol (validated message envelope) + PeerJS session
  ui/         canvas app, renderer, toolbar, home screen, viewport,
              element factories, eraser, storage
```

The core domain logic is developed test-first (TDD) — see `src/**/*.test.ts`.
