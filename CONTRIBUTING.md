# Contributing

Bug reports and pull requests are welcome.

Before submitting a change:

1. Run `npm ci`.
2. Run `npm test`, `npm run lint`, and `npm run build`.
3. Test both Reading view and Live Preview, on desktop and on a phone if you can.
4. Walk the QA matrix below for anything you touched.

Keep the plugin simple and local-first. Layout state lives only in the image link. New
functionality must not transmit vault content without explicit user action and clear
documentation. Do not include vault content or `data.json` in commits.

## QA matrix

Fixtures (start with `bootstrap/` in a test vault):
plain paragraph image, image in a bullet, nested bullet, blockquote, callout, table cell with
`\|`, two identical images on one line, three of the same image in one note, a Markdown link
with `%20` in the path, a remote URL image, a legacy `WxH` link, and a `|thumb` link.

Actions: view, edit, preset, native resize, typed width, center, right, wrap left and right, caption add /
edit / remove, reset, undo (Live Preview), remove a link with repeated image references, lock/unlock, paste from
clipboard, drop from the file manager, rotate the device while editing, keyboard open while
captioning.

Run it under the default theme, Minimal, and one heavy theme.

## Mobile sheet and resize regression

Run `tests/keyboard-layout.obsidian.js` through Obsidian’s eval CLI against the installed build.
It creates and removes a disposable note using the bootstrap lotus image. It checks native
`--keyboard-height` changes without a VisualViewport resize, as well as combined signals,
panning, dismissal, and short landscape space. All cases must pass. Do not substitute a
viewport-only simulation for this check; 0.1.2 passed that simulation but failed on an iPhone.
The current check also verifies there is no caption modal, Save/Cancel behavior, 48-pixel grips, visible resize preview, deferred saving, and cancellation on lock. Confirm the final behavior on a physical iPhone before calling the keyboard issue resolved.
