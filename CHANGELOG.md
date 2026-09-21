# Changelog

## 0.1.12 - 2026-09-21

- Resume hover dismissal after choosing a size, alignment, or More action, including selections that finish after the pointer has left. Keep active caption/width editing protected.

## 0.1.11 - 2026-09-21

- Hide Done in desktop Hover or click mode; retain it in click-only mode and on mobile.
- Close image controls on outside clicks or when settings/modal dialogs open, and suppress hover reopening behind dialogs.
- Close controls when the note window loses focus, including settings opened in a separate window; disable hover opening in inactive windows.
- Keep only Image Kit’s own More menu protected from outside dismissal; cancel timers and remove listeners when closing. Preserve pending inline caption and valid width edits on outside dismissal.

## 0.1.10 - 2026-09-21

- Default image controls to click-only, with an optional desktop Hover or click setting.
- Close hover previews 300 ms after leaving the button and toolbar; cancel closing when returning and keep controls open after clicking or starting an edit.

## 0.1.9 - 2026-09-21

- Open the layout menu when the mouse hovers over Edit image on desktop. Keep the menu open while moving into it, preserve an active edit, and retain mobile tap behavior.

## 0.1.8 - 2026-09-13

- Remove the redundant product name from the manifest description to satisfy the community plugin directory check.

## 0.1.7 - 2026-09-13

- First public release, with desktop and iPhone screenshots and installation instructions.
- Use Node 26 for CI and release builds to match the test dependencies. Image editing behavior is unchanged from 0.1.6.

## 0.1.6 - 2026-09-13

- Frame only the image during touch resizing, leaving its caption outside the selection outline. Mirror the bottom-right grip’s spacing to match the top-left corner.

## 0.1.5 - 2026-09-13

- Show only the L-shaped resize corners, removing the native button background and shadow while retaining 48-pixel touch targets and keyboard focus indicators.
- Keep Image Kit’s edit button out of Reading view on mobile and desktop; captions, alignment, and native viewing controls remain available.

## 0.1.4 - 2026-09-13

- Restore captions and alignment in Reading view by decorating native image placeholders after loading and re-rendering.
- Replace the mobile caption modal with a slide-up page of the image toolbar, with Cancel and Save above the text field.
- Add top-left and bottom-right diagonal resize grips with 48-pixel touch targets during mobile editing. Dragging previews the width; Done or an outside tap saves it.
- Cancel pending resizing when Page Lock is applied or the plugin unloads. Desktop retains native resize controls.
- Remove the obsolete modal positioning helper and cover the new caption, resize, and keyboard-boundary workflows.

## 0.1.3 - 2026-09-13

- Correct the iPhone caption dialog regression in 0.1.2 by honoring Obsidian’s native keyboard height even when VisualViewport does not resize.
- Intersect native keyboard and visible viewport bounds without subtracting the keyboard twice.
- Add a rendered regression check covering keyboard overlay, viewport panning, short landscape space, and keyboard dismissal without resize events.

## 0.1.2 - 2026-09-13

- Keep the phone caption dialog above the keyboard using the visible viewport, including viewport panning and rotation.
- Keep Cancel and Save in a fixed footer while the caption area scrolls on short screens.

## 0.1.1 - 2026-09-12

- Add image layout editing beside native controls, with a steadier desktop toolbar and a touch-friendly phone panel.
- Delegate fullscreen viewing and resizing to the existing viewer and native controls.
- Preserve captions on reset; removing an image keeps its attachment.
- Respect Page Lock before opening controls or applying image edits.
- Add the screenshot bootstrap and companion-plugin documentation.
- Provide a self-contained mobile installer through Templater, with checksums, runtime backups, and rollback.

## 0.1.0 — development prototype

- Initial image workflow prototype. The current build delegates viewing and resizing to existing implementations.
