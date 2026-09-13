# Screenshot bootstrap

Copy the contents of `vault/` into your vault root. It adds three notes and two photographs under
**Plugin Showcase**, using Image Kit-specific names. Do not overwrite an edited showcase note.

Open **Plugin Showcase/Image Kit - Quiet details** in Live Preview. The accompanying capture
checklist lists five screenshots, their filenames, and the exact state to show. Photo credits
travel with the kit. Fullscreen Image and Simple Gallery are optional companions for the demo.

The approved release captures are in [`../screenshots/`](../screenshots/): desktop editing,
mobile editing, the mobile caption sheet, the finished layout, and a locked image.

## Install on a phone

The primary vault includes **Plugin Showcase/Install Image Kit 0.1.7 on mobile**. Sync that
note to the phone, enable Templater, duplicate the installer note, and run **Templater:
Replace templates in the active file** on the copy. It verifies the embedded runtime files,
preserves settings, backs up existing files, and enables Image Kit. It requires Obsidian 1.13+.
The installer has automated success and rollback tests. The mobile editing and caption workflows
have also been exercised on an iPhone; the release screenshots show the resulting interface.

For a public installation, use the release downloads or BRAT as described in the
[README](../README.md#installation). The embedded installer is a development convenience.

To regenerate it from a production build:

```sh
node bootstrap/build-mobile-installer.mjs '/tmp/Install Image Kit 0.1.7 on mobile.md'
```

A conventional runtime ZIP is also provided under **Plugin Showcase/Image Kit downloads**
in the primary vault. Extract its `image-kit` folder into the vault's `.obsidian/plugins/`
folder only when that folder is accessible on the device, then enable Image Kit.

## Release checks

- Review the real-phone panel and keyboard behavior when either changes.
- Keep numeric/reserved-caption limitations documented until the grammar supports them.
- Complete the relevant compatibility cases in CONTRIBUTING.md.
- Update screenshots when the interface changes.
- Verify the Image Kit, Fullscreen Image, and Simple Gallery links before publishing.
- Build the tagged source and attach the runtime artifacts; keep vault settings out of the release.
