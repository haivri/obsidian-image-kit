# Image Kit

Your everyday image workflow, in one place: choose a size, place the image, add a caption,
and get back to writing. Image Kit puts these controls beside Obsidian’s native image actions
on desktop and mobile.

## What you can do

- Apply Small, Medium, Large, Original, or an exact width.
- On mobile, drag either diagonal corner grip to preview a new size; tap Done or outside the image to save.
- Align left, center, or right, and wrap text around an image.
- Add and edit a plain-text caption without editing the link syntax.
- Reveal the attachment in the file explorer, copy it, or open it fullscreen.
- Reset size and alignment while keeping the caption.
- Remove an image from the note while keeping its attachment.

In Live Preview, **Edit image** appears before Obsidian’s **Edit this block** button.
The native zoom and resize controls remain available. The desktop toolbar stays aligned
to the note column; phones get a compact bottom panel and a slide-up caption editor with Save and Cancel above the text field.
With **Page Lock**, locked images stay available to view while image editing is blocked.

<!-- Add screenshots/01-desktop-layout.png and screenshots/02-mobile-layout.png after capture. -->

## The complete image workflow

Use Image Kit on its own for individual image layout, or add its companions:

| Plugin | What it adds |
| --- | --- |
| **Image Kit** | Size, placement, captions, and attachment shortcuts |
| **[Fullscreen Image](https://github.com/haivri/obsidian-fullscreen-image)** | Fullscreen viewing with zoom buttons, pan, and gallery navigation |
| **[Simple Gallery](https://github.com/haivri/obsidian-simple-gallery)** | Photo galleries inside notes, with sections and captions |

Each plugin works independently. Image Kit delegates fullscreen viewing to Fullscreen Image
when enabled, or to Obsidian otherwise. Simple Gallery owns gallery editing.

## Start using it

1. Hover over an image in Live Preview, or tap its **Edit image** action on mobile.
2. Choose a size and alignment. Use **Caption** to add or change the caption.
3. Select **Done** and continue writing.

**More actions** includes file shortcuts, fullscreen viewing, Reset, and Remove image from note.
Reading view uses a corner edit button where native image actions are unavailable.

## Your notes stay yours

Layout is saved in the image link:

```markdown
![[photo.jpg|A little room to pause.|center|480]]
```

There is no separate layout database. Obsidian can still apply the width if Image Kit is
removed; visible captions and alignment need a compatible plugin or renderer.
The optional paste/drop handler keeps the original image bytes and is off by default,
so your existing attachment workflow can continue.

Image Kit makes no telemetry requests. Remote image links follow Obsidian’s normal behavior.
It does not convert, compress, crop, rotate, or annotate images.

## Installation

Requires **Obsidian 1.13 or newer**. This is currently a development preview; public release
preparation is in progress.

Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/image-kit/`, then
enable **Image Kit** in Community plugins. Existing settings are preserved by the vault publisher.

Captions are currently plain text. Numeric-only captions and reserved layout words are ambiguous
in the current grammar. Rich captions, external-image and popout combinations, and physical-phone
behavior still need broader validation before a public reliability claim.

## Screenshots and development

The [showcase bootstrap and capture checklist](bootstrap/README.md) provide a clean demo note
and the screenshots needed for the README. See [CONTRIBUTING.md](CONTRIBUTING.md) for testing.

```sh
npm ci
npm test
npm run lint
npm run build
npm run publish:vault
```

## Support

If Image Kit improves your workflow, you can support development on
[Buy Me a Coffee](https://www.buymeacoffee.com/robertfleming).

## License

MIT. Demo photographs retain their own license and attribution.
