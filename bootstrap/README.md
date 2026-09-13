# Screenshot bootstrap

Copy the contents of `vault/` into your vault root. It adds three notes and two photographs under
**Plugin Showcase**, using Image Kit-specific names. Do not overwrite an edited showcase note.

Open **Plugin Showcase/Image Kit - Quiet details** in Live Preview. The accompanying capture
checklist lists five screenshots, their filenames, and the exact state to show. Photo credits
travel with the kit. Fullscreen Image and Simple Gallery are optional companions for the demo.

The primary vault copy has already been installed for this development preview.

## Install on a phone

The primary vault includes **Plugin Showcase/Install Image Kit 0.1.3 on mobile**. Sync that
note to the phone, enable Templater, duplicate the installer note, and run **Templater:
Replace templates in the active file** on the copy. It verifies the embedded runtime files,
preserves settings, backs up existing files, and enables Image Kit. It requires Obsidian 1.13+.
The installer has automated success and rollback tests; physical-phone execution remains to be checked.

To regenerate it from a production build:

```sh
node bootstrap/build-mobile-installer.mjs '/tmp/Install Image Kit 0.1.3 on mobile.md'
```

A conventional runtime ZIP is also provided under **Plugin Showcase/Image Kit downloads**
in the primary vault. Extract its `image-kit` folder into the vault's `.obsidian/plugins/`
folder only when that folder is accessible on the device, then enable Image Kit.

## Before public release

- Capture and review the real-phone panel and keyboard behavior.
- Resolve or explicitly reject ambiguous numeric/reserved captions before claiming reliable caption editing.
- Complete the relevant compatibility cases in CONTRIBUTING.md.
- Add the approved screenshots to the README.
- Create the public Image Kit repository and verify all three companion links before publishing.
- Build the tagged source and attach the runtime artifacts; keep vault settings out of the release.
