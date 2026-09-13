# Changelog

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
