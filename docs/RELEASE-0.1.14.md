# Image Kit 0.1.14 release preparation

Status: implemented; public publication and physical-device verification pending.

## Changes

- Global caption settings: Normal/Italic, Bold, Strikethrough, and Default/Small/Medium/Large text size. Existing appearance remains the default; note text is unchanged.
- Mobile toolbar and caption sheet respect native navigation, keyboard, and visual-viewport insets without counting overlapping obstructions twice.
- Harden settings loading, image resolution and writes, delayed paste/drop, inline caption editing, session cleanup, and rejected deletion handling.
- Add browser regression checks to CI and release validation.

## Validation

- Passed on 2026-11-06: 112 automated Node tests, 25 isolated Chromium browser tests, lint (no warnings), production build, and `git diff --check`.
- Browser fixtures execute the real rendering and edit-session code with minimal Obsidian API stand-ins. They do not constitute an in-app or physical-device test.
- Android three-button navigation, Android gesture navigation, and iPhone safe-area/keyboard geometries are simulated, including overlapping signals, rotation, panning, narrow screens, and inset-only changes.
- Physical Android and iPhone checks, the authorized in-app regression script, and third-party-theme checks are pending. Follow CONTRIBUTING.md; no running Obsidian app was controlled during implementation.
- Compatible development dependency updates remove the three high-severity npm audit findings and the fast-uri moderate finding. Thirteen moderate dependency reports remain, rooted in minimatch and moment in the lint/type tooling. npm's suggested fixes require major tooling changes or downgrades; those are deferred. These packages are not bundled into the plugin runtime. Do not run `npm audit fix --force` as part of this release.

## Publication

1. Obtain fresh explicit GitHub publication approval for these changes, as required by AGENTS.md. Approval to implement alone is insufficient.
2. Confirm that 0.1.14 is unused remotely. Publish the reviewed commit and matching tag with the pre-push guard's per-command approved-commit variable. Do not overwrite a published tag.
3. Wait for the release workflow and verify that main.js, manifest.json, and styles.css belong to that exact commit.
4. Run the prescribed `release-obsidian-plugin image-kit` publisher with the approved commit. It verifies the public release, pushes both remotes, and installs runtime files while preserving existing settings.
5. Post the replies below only after the release exists. Close #1 as completed after publication. For #2, obtain physical-device confirmation before stating it is verified and closing it.

## Reply to issue #1 after publication

Thanks so much for the suggestion! I really appreciate you taking the time to share your feedback and recommendations.

I've added this in [Image Kit 0.1.14](https://github.com/haivri/obsidian-image-kit/releases/tag/0.1.14). Under **Settings → Image Kit → Caption font style**, you can now choose **Normal** or **Italic**. There are also options for bold, strikethrough, and caption font size. These settings apply to all captions in Live Preview and Reading view, and the existing italic appearance remains the default.

Thanks again for helping improve Image Kit!

## Reply to issue #2 after publication, with device confirmation still pending

Thanks so much for the kind words and thoughtful recommendations! I really appreciate you pointing out the toolbar issue and sharing the workaround—it was very helpful.

[Image Kit 0.1.14](https://github.com/haivri/obsidian-image-kit/releases/tag/0.1.14) includes a fix that uses Obsidian's native navigation and keyboard insets to position the toolbar and caption editor, without relying on a fixed padding value for one phone. Automated browser checks cover navigation-bar and keyboard overlap, rotation, and small screens; I haven't yet confirmed it on your physical device.

I've also added **Normal/Italic**, **Bold**, **Strikethrough**, and **caption font size** under **Settings → Image Kit**. These are global caption settings and can be combined.

After updating, please disable the workaround snippet and let me know whether the toolbar now clears your navigation buttons. I'll keep this open until the device check is confirmed. Thanks again for helping make Image Kit better on mobile!

## Follow-up to issue #2 after device verification

Thanks again for helping verify this! The mobile toolbar fix and the caption-formatting options are now available in 0.1.14. Closing this as completed; please let me know if you run into any further trouble.
