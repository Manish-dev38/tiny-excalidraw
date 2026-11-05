# Tiny Excalidraw

A lightweight, two-person collaborative whiteboard for explaining topics online —
styled like Excalidraw, but a fraction of the size. Built with **Vite + vanilla
TypeScript + Canvas**, synced in real time over **PeerJS** (WebRTC) with no backend
to run.

## Features

- Tools: select, hand, pen, rectangle, ellipse, arrow, text, eraser
- **Select/move**: pick the select tool (arrow icon), click an element to select
  it (dashed outline), drag to move it, press Delete to remove it
- **Hand tool**: drag to pan, alongside space-drag and middle/right-drag
- Infinite pan + zoom (mouse wheel / hand tool / space-drag), with a zoom pill you can
  click to reset to 100%
- Full undo/redo (Ctrl/Cmd+Z, Ctrl+Shift+Z or Ctrl+Y) and clickable undo/redo pills
- **Floating Excalidraw-style chrome**: centred tool pill with shortcut badges,
  hamburger properties panel, Share, `…` menu, bottom hints and a `?` shortcut popover
- **Contextual properties panel**: stroke, background, and stroke width — only the
  groups that apply to the active tool or selection
- **Share** copies the room link and reports live/connecting/offline state
- Keyboard shortcuts: `V` `H` `R` `O` `A` `P` `T` `E`, Space to pan, wheel to zoom
- **Text**: click to place, Enter commits, Shift+Enter adds a line, Escape cancels,
  click-away commits; text inherits the stroke colour and exports as multiple lines
- Real-time collaboration with live cursor presence, including name labels
- Boards persist in local storage (per room), with a recent-boards list
- Export to **PNG** and **SVG**
- Dark theme by default (Excalidraw-inspired), toggleable to light; in-house iconography
- "Back to home" lives in the `…` menu and returns to the recent-boards screen

## Run locally

```bash
npm install
npm run dev        # dev server
npm test           # vitest suite (96 tests)
npm run build      # type-check + production build to dist/
```

## How to use

1. Open the app → **Create a board**. A room URL is generated, e.g.
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
  ui/         canvas app, renderer, toolbar, chrome, properties,
              ui-state rules, home screen, viewport, element factories,
              eraser, storage
```

The core domain logic is developed test-first (TDD) — see `src/**/*.test.ts`.
