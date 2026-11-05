# UI Redesign — Excalidraw-Style Floating Chrome

**Status:** Agreed (synthesised from the grilling session).
**Date:** 2026-11-04.
**Scope:** Board screen and home screen presentation; hand tool; keyboard
shortcuts; text-tool repair. No new whiteboard capabilities beyond those.

---

## Problem Statement

The board currently presents every control in a single full-width top strip:
tools, undo/redo, zoom, colour swatches, export, room link, theme and home all
compete for the same horizontal space. The result reads as a toolbar bolted onto
a canvas rather than the canvas-first Excalidraw interface the project set out to
match, and the left-hand properties panel that makes the reference screenshot
feel calm and spacious is missing entirely.

Separately, the text tool is effectively non-functional. Clicking with it
produces an editor that is removed before the user can type, committed text
ignores the chosen colour and renders black on the near-black canvas, and global
shortcuts intercept keys while the user is trying to type.

Users want the board to look and behave like the supplied Excalidraw reference:
floating chrome, a contextual properties panel, a bottom-left zoom/undo cluster,
and a quiet canvas. They also want the text tool to work.

---

## Solution

Restyle the board screen into floating chrome arranged over a dark, canvas-first
surface:

- a hamburger at the top-left that shows or hides the properties panel;
- a centred, rounded tool pill with grouped tools and keyboard hints;
- Share and an overflow menu at the top-right;
- a contextual properties panel floating at the left;
- zoom and undo/redo pills at the bottom-left;
- a help button at the bottom-right;
- a single contextual hint under the toolbar.

The home screen adopts the same visual language without the board chrome.

The visible toolset stays honest: no Sign in, image, lock, diamond, line, fill,
opacity, pressure or layers controls are shown, because the product does not
support them. The only interaction additions are a real **hand** tool and
keyboard shortcuts, both of which the reference implies.

The text tool is repaired so that clicking places a live editor, typing shows
text immediately, committed text uses the chosen stroke colour, and keyboard
shortcuts do not fire while typing.

---

## User Stories

1. As a returning user, I want the board screen to resemble the reference
   Excalidraw UI, so that the product feels familiar and deliberate.
2. As a user, I want the toolbar to float over the canvas instead of spanning the
   full width, so that the drawing surface feels open.
3. As a user, I want the toolbar grouped into navigation, shapes, and
   drawing/annotation tools, so that I can find a tool at a glance.
4. As a user, I want the active tool highlighted, so that I know what a click on
   the canvas will do.
5. As a user, I want each tool button to show its shortcut letter, so that I can
   learn the keyboard shortcuts without opening help.
6. As a user, I want the app to open in Select mode, so that I do not draw by
   accident when I first click.
7. As a user, I want my chosen tool to stay active after I finish an element, so
   that I can draw several shapes without reselecting.
8. As a user, I want a hand tool that pans while I drag, so that I can move the
   canvas without holding Space.
9. As a keyboard user, I want `V H R O A P T E` to switch tools, so that I can
   work without the mouse.
10. As a keyboard user, I want `Escape` to return to Select and clear the
    selection, so that I can always get back to a neutral state.
11. As a user, I want a properties panel on the left when a drawing tool is
    active, so that I can choose how the next element looks.
12. As a user, I want the panel to show Stroke, Background and Stroke width only
    when each applies to the current tool or selected element, so that I never
    see a control that does nothing.
13. As a user, I want to change stroke colour and width before drawing, so that
    the next element uses my choices.
14. As a user, I want to select an existing element and restyle it from the
    panel, so that I can correct a drawing without redrawing it.
15. As a user, I want restyling to be undoable, so that an accidental colour
    change is recoverable.
16. As a collaborator, I want restyling to reach my friend immediately, so that
    both of us see the same board.
17. As a user, I want the hamburger to show or hide the properties panel, so that
    I can reclaim canvas space or pin the panel open.
18. As a user, I want a contextual hint directly under the toolbar, so that I
    know how the active tool behaves.
19. As a user, I want the hint to hide while I am typing, so that it does not
    distract me during text entry.
20. As a user, I want Share to copy the room link, so that I can invite my friend
    with one click.
21. As a user, I want a status dot on Share, so that I can tell whether my friend
    is connected, connecting, or offline.
22. As a user, I want brief "Link copied" feedback, so that I know the link
    reached my clipboard.
23. As a user, I want an overflow menu with export, theme, fit-to-screen, home
    and the room id, so that secondary actions stay out of the way.
24. As a user, I want the room id available in the menu, so that I can identify
    or share the board another way.
25. As a user, I want a zoom pill with minus, percentage and plus, so that
    zooming feels like the reference; clicking the percentage resets it to 100%.
26. As a user, I want undo and redo in a separate bottom-left pill, so that
    history controls are where my hand expects them.
27. As a user, I want a help button, so that I can look up shortcuts at any time.
28. As a user, I want the canvas to use the reference's near-black background, so
    that light strokes read clearly.
29. As a user, I want the UI typeface and icon weight to match the reference, so
    that the whole interface feels coherent.
30. As a light-theme user, I want the redesign to work in light mode, so that I am
    not forced to use dark mode.
31. As a user, I want my theme choice remembered, so that the app opens the way I
    left it.
32. As a tablet user, I want the toolbar to remain usable on a narrow screen, so
    that I can draw without a desktop.
33. As a tablet user, I want the properties panel to open as an overlay from the
    hamburger, so that it does not permanently cover the canvas.
34. As a user, I want the home screen to share the board's visual language, so
    that moving between screens feels continuous.
35. As a user, I want the text tool to place an editor when I click, so that I can
    annotate the board.
36. As a user, I want keystrokes to appear in the editor immediately, including
    spaces, so that typing behaves like a normal text field.
37. As a user, I want `Enter` to commit, `Shift+Enter` to add a line, `Escape` to
    cancel, and a click elsewhere to commit, so that text editing follows
    familiar conventions.
38. As a user, I want committed text to use my chosen stroke colour, so that it
    is visible on the dark canvas.
39. As a user, I want shortcuts to be suppressed while the text editor is open, so
    that typing does not switch tools or delete elements.
40. As a user, I want the new text element selected after I commit it, so that I
    can immediately move, restyle or delete it.
41. As a user, I want my existing saved boards to keep loading, so that the
    redesign loses nothing.
42. As a collaborator, I want the redesigned UI to keep syncing over the existing
    peer connection, so that the visual change does not break collaboration.
43. As a user with reduced-motion preferences, I want animations disabled, so
    that the interface does not cause discomfort.
44. As a keyboard-only user, I want visible focus rings and labelled buttons, so
    that I can navigate the chrome.
45. As a screen-reader user, I want tool buttons to expose pressed state, so that
    I know which tool is active.
46. As a user, I do not want to see buttons for features that do not exist, so
    that I am not misled by a fake Sign in, image, lock or layers control.
47. As a user, I want the canvas bridging behaviour (space-drag, right-drag,
    wheel zoom) preserved, so that existing habits keep working.
48. As a user, I want undo/redo to remain disabled when there is no history, so
    that the controls communicate their state.
49. As a user, I want the panel to scroll when its content exceeds the viewport
    height, so that every control stays reachable.
50. As a user, I want the help popover to close on outside click or `Escape`, so
    that it never traps me.

---

## Implementation Decisions

### Scope and fidelity

- The work is a **reskin plus interaction repair**, not a feature build. The
  visible feature set remains exactly: select, hand, pen (draw), rectangle,
  ellipse, arrow, text, eraser; PNG/SVG export; theme; rooms; live collaboration.
- Controls that exist in the reference but not in the product are **omitted**,
  not disabled or inert. No Sign in, image, lock, diamond, line, fill-style,
  opacity, pressure, layers, frames or embeds.
- Layout, spacing, radii, border weights and colour hierarchy follow the
  reference closely; icon shapes remain in-house SVGs.
- Dark remains the default theme; light remains supported. Both use the same
  structural tokens; the reference's dark values are the design source of truth.

### Board chrome

- The board screen becomes four floating clusters over a full-bleed canvas:
  top-left hamburger, top-centre tool pill, top-right actions, bottom-left
  controls, plus a bottom-right help button.
- The full-width top strip, in-bar colour swatches, in-bar zoom, in-bar
  undo/redo, in-bar export/link/theme/home controls, connection status pill,
  board-letter badge and empty-canvas invitation pill are all removed.
- **Hamburger:** toggles the properties panel. It opens the panel as a
  left-side overlay on narrow screens. When there is no style context (Select
  with nothing selected), it can pin the panel open showing the default stroke,
  background and width for the next element.
- **Tool pill:** grouped as `hand | select` then `rectangle | ellipse | arrow`
  then `pen | text | eraser`, with hairline separators between groups. The
  active tool uses the reference's indigo highlight. Each button carries its
  shortcut letter in the lower-right corner. No toolbar overflow button is
  shown, because no tools are hidden.
- **Top-right:** an indigo Share button and a "more" menu. Share copies the room
  link and carries a status dot (green live, grey connecting, red offline) with
  a tooltip and brief copied feedback. The menu contains Export PNG, Export SVG,
  Fit to screen, Toggle theme, Back to home, and the room id.
- **Bottom-left:** a compact zoom pill (`−`, percentage, `+`) where the
  percentage is a button that resets zoom to 100%, and a separate undo/redo
  pill. Undo and redo expose disabled states.
- **Bottom-right:** a help button that opens a shortcuts popover. It closes on
  outside click or `Escape`.
- **Contextual hint:** one centred, secondary-coloured line directly under the
  tool pill, worded per tool. It is hidden while the text editor is open.

### Tools and interaction

- The app opens with **Select** active.
- The active tool **persists** after an element is committed; there is no
  Excalidraw-style lock toggle.
- A **hand** tool is added. Dragging while it is active pans the viewport. Space
  drag and right/middle drag continue to pan regardless of the active tool.
- Shortcut mapping: `V` select, `H` hand, `R` rectangle, `O` ellipse, `A` arrow,
  `P` pen, `T` text, `E` eraser, `Escape` select-and-deselect. Existing
  `Delete`/`Backspace`, undo/redo and Space-pan shortcuts remain.
- All tool shortcuts are suppressed while the inline text editor is open.
- The tool cursor type is not sent as a peer tool for hand or select; the wire
  protocol is unchanged.

### Properties panel

- The panel is a fixed-width floating card at the left, below the hamburger,
  with internal scrolling when the viewport is short.
- Visibility rule: shown when the active tool is pen, rectangle, ellipse or
  arrow, or when an element is selected; hidden otherwise (hand, eraser, text
  with no selection, Select with nothing selected) unless pinned by the
  hamburger.
- Group applicability:
  - Pen: Stroke, Stroke width.
  - Rectangle/Ellipse: Stroke, Background, Stroke width.
  - Arrow: Stroke, Stroke width.
  - Selected text: Stroke only.
- Changes update the tool defaults for the next element. When exactly one
  element is selected, the same change is applied to that element immediately as
  an update operation, so it participates in undo/redo and peer sync.
- Colour choices remain the existing palettes; the redesign changes their
  presentation to the reference's rounded-square swatches and wraps them across
  rows. No palette entries are removed.
- The panel reflects the selected element's current values.

### Text tool repair

- The inline editor must survive the pointer sequence that creates it: the
  pointer interaction that places text must not let the browser move focus away
  from the newly created editor.
- The editor must live inside the board application root so the application's
  "is editing" check can see it; that check must be corrected.
- While the editor is open, global keyboard shortcuts are ignored.
- Commit on `Enter` (without Shift), on blur, and on click-away; insert a newline
  on `Shift+Enter`; cancel without creating anything on `Escape`.
- Guard against double commits when `Enter` triggers both commit and blur.
- New text inherits the current stroke colour and current stroke width for its
  outline semantics; font size remains 24 scene units.
- Empty or whitespace-only text is discarded.
- After a successful commit, the tool switches to Select and the new text
  element becomes the selection.

### Visual system

- Canvas background matches the reference near-black rather than the current
  slightly lighter dark.
- Chrome surfaces, borders, text hierarchy, active indigo, danger and accent
  values are re-derived from the reference and expressed as theme tokens for
  both dark and light.
- UI typography moves to the reference's Assistant-like sans; Caveat remains the
  handwriting face for scene text.
- Icons are redrawn as lightweight in-house SVGs with the reference's stroke
  weight and optical size; no Excalidraw assets are copied.
- Radii, control heights and gaps follow the reference: compact square buttons,
  rounded tool pill, floating cards with hairline borders and no heavy shadows.
- Motion stays minimal: a short entrance for chrome and panels, all disabled
  under reduced-motion.

### Home screen

- The landing screen uses the same dark surface and type system, with a centred
  card: logo/title, Create a board, supporting hint, and Recent boards.
- No hamburger, tool pill or other board chrome is shown on home.
- Recent-board rows become reference-styled cards with clear open and delete
  affordances.

### Responsiveness

- Below the narrow breakpoint, the tool pill scrolls horizontally while keeping
  all tools reachable.
- The properties panel becomes an overlay opened from the hamburger and can be
  dismissed by outside tap or `Escape`.
- The bottom-left pills remain anchored; the hint may be hidden on very narrow
  widths.

### Data and compatibility

- No changes to the scene schema, serialization format, storage keys, room
  identifiers or peer protocol.
- Existing saved boards load unchanged.
- Restyling uses the existing update operation, so history and live sync keep
  working without new message types.
- No backend or dependency changes are required; the only external asset
  addition is the Assistant font family.

### Documentation

- The project specification's UI section and the README feature list are updated
  to describe the new chrome, panel, hand tool, shortcuts, and text behaviour.

---

## Testing Decisions

**What makes a good test here:** tests assert externally observable behaviour —
what a user of the module can see or do — not internal structure. Pure logic is
tested directly; presentation and browser interaction are verified against the
real UI rather than mocked.

**Seams (agreed with the user):**

1. **New pure seam — UI state.** A small, framework-free module computes the
   panel's visibility, the property groups applicable to a tool or selected
   element, the panel values for a selection, and the contextual hint for a
   tool. This is the single new seam and keeps all conditional UI logic out of
   the DOM builder. It is tested under the existing node-based Vitest setup like
   the core modules.
2. **Existing seam — element factories.** Text creation must honour the supplied
   drawing style. A regression test asserts that a text element created with a
   stroke colour and width carries them through, covering the black-on-black
   defect without touching the DOM.

**Not unit-tested:**

- The focus-steal defect and the text editing lifecycle are browser behaviours.
  Adding a DOM emulation dependency for one fix would cost more than it buys, so
  they are verified in a real browser during the visual pass. The pure pieces
  they depend on (state checks, hint selection) remain covered.
- Toolbar markup, panel markup, CSS and icons are presentation. They are checked
  by screenshot comparison against the reference.

**Regression bar:**

- Every existing test continues to pass unchanged.
- `npm test` and `npm run build` (which includes strict type-checking) pass.
- No new runtime dependency is added.

**Browser verification checklist:**

- Board renders with floating chrome at approximately 1350×650 and visually
  matches the reference's cluster positions, panel proportions, active-tool
  highlight, hint placement and canvas tone.
- Text: click, type including spaces, see characters; `Shift+Enter` adds a line;
  `Enter` commits in the chosen colour; `Escape` cancels; click-away commits;
  the new text is selected and typable-looking on dark.
- Panel: appears for every drawing tool and a selected element, shows only
  applicable groups, edits defaults, edits a selected element, and hides when it
  should.
- Shortcuts: every letter switches tools; `Escape` returns to Select; shortcuts
  do nothing while typing.
- Zoom, reset-by-percentage, fit-to-screen from the menu, undo/redo disabled
  states, theme toggle persistence, share-copy feedback and status dot.
- Two tabs on one room still sync add, update, move, erase and undo; cursors
  still appear.
- Existing saved boards still load.
- Narrow viewport: tool pill scrolls; panel opens as an overlay from the
  hamburger and dismisses.
- Home screen consistent with the board; recent boards open and delete.
- Reduced-motion media query disables animations.
- Focus rings visible on every interactive element.

**Prior art:** the pure module tests follow the existing pattern of small,
behaviour-level unit suites for scene, geometry, history, serialization,
viewport, selection and eraser.

---

## Out of Scope

- Fill styles (hachure, cross-hatch, solid), opacity, pressure-sensitive
  strokes, layers/reordering, frames, embeds and images.
- Diamond and line tools, despite appearing in the reference.
- The lock toggle, Sign in, accounts, cloud persistence and multi-user beyond
  two peers.
- Font-size, font-family or text-alignment controls.
- A real Excalidraw file format compatibility layer.
- Voice or video calls.
- Mobile PWA/offline support and a native app shell.
- Any change to the collaboration backend, signaling, or scene schema.

---

## Further Notes

- The reference screenshot is the design source for **layout, density and
  colour**, not for feature set. Where the reference shows a control the product
  cannot back, the control is omitted rather than faked.
- Deliberate deviations from Excalidraw: the tool persists after drawing (no
  lock), colours stay the project's existing palettes, and the properties panel
  can be pinned with the hamburger even with no selection.
- The text-tool repair is independent of the visual redesign and could ship
  first if the chrome work is split.
- Existing `SPEC.md` remains the product-level spec; this document covers the
  redesign and should be folded into it once implemented.
