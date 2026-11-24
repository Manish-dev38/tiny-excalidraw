# Tiny Excalidraw

A lightweight, two-person collaborative whiteboard for explaining topics online —
styled like Excalidraw, but a fraction of the size. Built with **Vite + vanilla
TypeScript + Canvas**, synced in real time over **PeerJS** (WebRTC) with no backend
to run.

## Features

- Tools: select, hand, pen, rectangle, ellipse, arrow, text, eraser, plus five
  infrastructure shapes (laptop, database, server, cloud, user) from a toolbar picker
- **Select/move**: pick the select tool (arrow icon), click an element to select it
  (dashed outline), drag to move it, press Delete to remove it; the element you just drew
  is selected automatically, so styles apply to it right away
- **Multi-select**: Shift-click to add or remove elements, or drag a marquee from empty
  canvas; group move, delete, and style changes undo as a single step
- **Resize**: shapes show eight handles and text shows width handles; drag a corner or
  edge to resize, hold **Shift** to keep the aspect ratio on corners and **Alt** to resize
  from the centre. A group selection scales together (fonts scale, stroke width does not)
- **Clipboard**: `Ctrl/Cmd+C/X/V/D` copy, cut, paste, and duplicate through an internal
  clipboard; pastes offset and fan out, and arrow attachments follow the cloned shapes
- **Hand tool**: drag to pan, alongside space-drag and middle/right-drag
- Infinite pan + zoom (mouse wheel / hand tool / space-drag), with a zoom pill you can
  click to reset to 100%
- Full undo/redo (Ctrl/Cmd+Z, Ctrl+Shift+Z or Ctrl+Y) and clickable undo/redo pills
- **Floating Excalidraw-style chrome**: centred tool pill with shortcut badges,
  hamburger properties panel, Share, `…` menu, bottom hints and a `?` shortcut popover
- **Contextual properties panel**: stroke, background, stroke width, font size, text
  alignment, and independent arrowheads for both ends, plus a solid/dashed line style —
  only the groups that apply to the active tool or selection, with a "Mixed" badge when a
  multi-selection disagrees
- **Arrows**: elbow (orthogonal) routing with an independent head at each end (none,
  arrow, or triangle). An end dropped on a shape binds to its facing edge, and one dropped
  nearby orbits its border; both use proportional anchors, so the arrow keeps following
  when the shape moves or resizes, while dragging the arrow itself detaches it
- **Labels**: double-click a shape or arrow to add a bound label that stays centred and
  re-wraps as its container changes; deleting a shape removes its label and attached
  arrows in one undo step
- **Share** copies the room link and reports live/connecting/offline state
- Keyboard shortcuts: `V` `H` `R` `O` `A` `P` `T` `E`, Space to pan, wheel to zoom
- **Text**: click to place, Enter commits, Shift+Enter adds a line, Escape cancels,
  click-away commits; double-click (or Enter on a selected text) reopens the editor
  pre-filled. Text uses real font metrics and word wrapping, has 16/20/28/36 px sizes and
  left/centre/right alignment, inherits the stroke colour, and exports as multiple lines
- Real-time collaboration with live cursor presence, including name labels
- **Save** (`Ctrl/Cmd+S`) downloads the whole board as an editable `.whiteboard` JSON
  file; **Save As** (`Ctrl/Cmd+Shift+S`) lets you choose and remember its filename
- **Import** restores a `.whiteboard` or `.json` file into the current room (keeping its
  share link) or into a new room from the home screen; invalid files are rejected
  without touching the current drawing
- **Autosave** stores the scene in IndexedDB after a short debounce and shows
  `Saving…` / `Saved` / `Not saved`; reopening a bare URL resumes the last board
- Boards persist in IndexedDB (with a localStorage fallback and one-time migration),
  with a recent-boards list capped at 10
- Export to **PNG** and **SVG**
- Dark theme by default (Excalidraw-inspired), toggleable to light; in-house iconography
- "Back to home" lives in the `…` menu and returns to the recent-boards screen

## Run locally

```bash
npm install
npm run dev        # dev server
npm test           # vitest suite (250 tests)
npm run build      # type-check + production build to dist/
```

## How to use

1. Open the app → **Create a board**. A room URL is generated, e.g.
   `https://your-site.com/#room=abc123`.
2. Send that link to your friend. The first person to open it becomes the host;
   whoever joins later connects as a client. If the host is offline, the client
   shows "Friend offline".
3. Draw together — strokes, shapes, and text appear live on both screens.
4. Draw an arrow from one shape to another to connect them: endpoints bind to the shapes
   with proportional anchors and keep following when you move or resize them.
5. Double-click a shape or arrow to add a centred label, and drag any selection handle to
   resize; the properties panel handles font size, alignment, and both arrowheads.
6. Bring your own voice/video call; the board is canvas-only.

## Saving and restoring boards

- Click **Save** (or press `Ctrl/Cmd+S`) to download the board as
  `whiteboard-<roomId>-<date>.whiteboard`. The file is plain JSON containing the whole
  editable scene.
- Use **Save As…** in the `…` menu (or `Ctrl/Cmd+Shift+S`) to pick a filename. The name
  is remembered per board and reused by later saves.
- **Import board** in the `…` menu replaces the current drawing after confirmation and
  keeps the room link intact, so collaborators stay connected. On the home screen,
  **Import a board** opens the file in a new room.
- Invalid, oversized, or unsupported files (including images) are rejected with a clear
  message and leave the current drawing untouched.
- Your work is autosaved to IndexedDB as you draw. Closing the tab and reopening the app
  returns you to the last board; **Back to home** clears that pointer.

## Deploy to Netlify

- Connect this repo to Netlify (or drag-and-drop the `dist/` folder).
- Build command: `npm run build`
- Publish directory: `dist`
- No environment variables or backend needed.

The app is a static site; collaboration uses PeerJS's free cloud signaling.

## Project layout

```
src/
  core/       pure logic: types, scene, geometry, elbow routing, proportional
              arrow bindings, resizing/handle math, text measurement and
              wrapping, bound-label containers, v1/v2→v3 migration, history
              (op-based undo), room ids, serialization, SVG export, board-file
              codec/validation
  collab/     peer protocol (validated message envelope) + PeerJS session
  ui/         canvas app, renderer, toolbar (+ shapes picker), chrome,
              properties, ui-state rules, home screen, viewport, element
              factories, selection, clipboard, text editing, eraser,
              downloads, dialogs, autosave controller, storage repository
              (IndexedDB + localStorage fallback)
```

The core domain logic is developed test-first (TDD) — see `src/**/*.test.ts`.
