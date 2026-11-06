# Contributing

Bug reports and pull requests are welcome.

Before submitting a change:

1. Use Node.js 26 and run `npm ci`.
2. Run `npm test`, `npm run lint`, and `npm run build`. Install the isolated test browser with `npx playwright install chromium`, then run `npm run test:browser`. CI installs Chromium with its OS dependencies.
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

## Caption appearance and Android navigation regression

`npm run test:browser` renders the actual toolbar and caption code with minimal Obsidian API stand-ins in isolated Chromium. It checks native safe-area changes without resize events, keyboard overlap, panning, narrow and landscape screens, rotation, and every caption-format combination in both view modes. This does not operate the running Obsidian app or verify a physical phone.

Before closing #2, verify on physical Android with three-button navigation and on iPhone: toolbar actions remain above system navigation; caption Save/Cancel remain accessible with the keyboard open; rotation, keyboard dismissal, and the previous workaround snippet disabled all work. Run the existing in-app regression script only with explicit app-interaction authorization. Preserve real device results separately from browser simulation results.
