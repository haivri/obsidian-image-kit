# Image Kit development

- This directory is the authoritative source repository. Do not develop from the installed copy in an Obsidian vault.
- `origin` is the private Forgejo repository; `github` is the public GitHub repository.
- Keep `main` clean. Commit and push completed work to `origin` after validation.
- Push to `github` or publish GitHub tags/releases only with the user's explicit approval for that release. Approval for an earlier release does not carry forward. When authorized, release the exact same commit to both remotes.
- Run `npm test`, `npm run lint`, and the production build before publishing.
- Do not control or inspect the running Obsidian app or other computer UI without the user's explicit approval for that interaction. Source edits, automated tests, builds, and file deployment do not authorize app commands, reloads, settings changes, or in-app verification. Let the user verify in-app behavior unless they explicitly approve those checks.
- Layout state lives only in the image link text (`![[a.jpg|Caption|center|400]]`). Never add a sidecar, cache, or per-vault data file for image layout.
- Scope is deliberately narrow: size, alignment, captions, delegated fullscreen viewing, opt-in paste/drop with originals kept, and file actions. No conversion, compression, annotation, crop/rotate, batch processing, or galleries.
- Preserve native image controls and gestures. Add Edit image before Edit this block in the native action strip. Delegate viewing to Fullscreen Image or Obsidian; do not maintain a second viewer. Desktop uses native resize handles. Mobile editing adds two diagonal touch grips with pending width saved on Done or outside tap, as explicitly requested by the user.
- Rendering must not depend on any theme: stamp `ik-*` classes from JS and style them with core Obsidian variables only.
- For an explicitly authorized GitHub release, publish through `/Users/robertfleming/vaults/obsidian-vault/_obsidian-os/scripts/release-obsidian-plugin image-kit`. This publisher pushes both remotes and requires a public GitHub release; do not run it without that approval. Otherwise use `npm run publish:vault` for local deployment and push only `origin`.
- The publisher installs only runtime artifacts into the primary vault and preserves its existing `data.json` settings.
- Never add a vault's `data.json` or other user-specific settings to this source repository.
- `npm run publish:vault` builds and installs the runtime artifacts into the primary vault (`/Users/robertfleming/vaults/obsidian-vault`, overridable via `OBSIDIAN_VAULT`), preserving the vault's `data.json` and writing a `.release.json` provenance record. `npm run ship` does that and then pushes `origin`. Neither command touches the `github` remote — GitHub remains a deliberate, manual release push.
