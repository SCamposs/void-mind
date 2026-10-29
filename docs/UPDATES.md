# Desktop updates

`features/updates/updateStore.ts` owns the one-hour scheduler, persistent automatic/manual preference, update resource lifecycle, announcement state and confirmed installation/restart. `UpdatePanel.tsx` composes source-owned controls with Base UI Dialog and Progress. It is mounted at app level so progress survives navigation and waits until onboarding/boot/plan notices are finished before opening.

Checks never download or install. The user chooses Update and restart; Later defers the version for the current session. Unknown download length is indeterminate and displays downloaded MB, rather than an invented percentage. Errors remain retryable. A failed relaunch retries restart without reinstalling.

Tauri updater and process plugins have explicit check/download-and-install/restart permissions. The HTTPS feed is `updater/latest.json` in this repository, with `windows-x86_64` and `linux-x86_64` signed artifacts. The updater key is independent of VOID. Its private key stays outside the checkout and in the repository's `TAURI_SIGNING_PRIVATE_KEY` Actions secret; only the public key belongs in configuration. Preserve the key for future updates. Local backup path: `C:\Users\zuado\.tauri\void-mind-updater.key`.

Release workflow generates signatures/checksums and the manifest after both platforms build, publishes curated `docs/releases/<tag>.md` notes, and updates the static feed on main. Keep all workspace package/lock versions aligned. Native versions use the existing numeric prerelease mapping (`0.2.0-alpha.2` maps to `0.2.0-2`); the manifest uses the native version.

Explicit `linux-x86_64-deb` and `linux-x86_64-appimage` entries route updates to the installed package format. A generic AppImage entry remains for compatibility. DEB assets are signed with the same updater key and installation may request system package-manager authorization.

## Alpha.2 evidence

Application source `c9430de`, annotated tag `v0.2.0-alpha.2`, passed [desktop validation 40923161511](https://github.com/SCamposs/void-mind/actions/runs/40923161511) and [release 40923204739](https://github.com/SCamposs/void-mind/actions/runs/40923204739). Frontend validation includes 81 tests. Native tests report 38 passes on Windows and 37 on Linux, with two existing ignored cases on each platform. All three packages were generated; no installer was executed on the user's PC.

The isolated Linux native acceptance receipt contains 13 passing checks, including changing automatic checks to manual-only mode through Settings and preserving that preference after an actual application session restart. This checks preference persistence, not an actual version upgrade or the update installer's relaunch path.

Downloaded NSIS/DEB/AppImage files matched their three SHA-256 receipts. Package signatures, trusted comments and modified-payload rejection were independently checked against the public key committed in the app. All four manifest routes matched their signature files. The ten public GitHub Release asset digests matched the local receipts. The DEB signature and explicit format routes were finalized as release metadata without replacing tagged binaries or rewriting tags. Subsequent metadata-only edits do not alter the validated application source.

Anonymous publication verification initially found that `SCamposs/void-mind` was private, making the raw feed and release downloads unavailable without repository access. Alpha.2 was temporarily held as a draft. The owner then explicitly chose to make the existing repository public. Anonymous requests now verify the raw feed, four format routes and ten release assets; alpha.2 is published again. No separate distribution repository or embedded GitHub token is needed. [Issue #7](https://github.com/SCamposs/void-mind/issues/7) records the resolved distribution blocker.

Real Windows/Linux installation, upgrade, restart and operating-system prompts remain [manual validation #6](https://github.com/SCamposs/void-mind/issues/6). Publication does not close that issue or the existing provider acceptance follow-ups.

Windows NSIS explicitly uses `currentUser`; updater `installMode` is `quiet`. This avoids the user-scope selection page and suits the existing per-user installation default. It does not bypass operating-system security prompts or provide Authenticode signing. The custom app dialog reports download progress; Windows installation may close the app until restart. Real installation/progress/restart remains [manual validation #6](https://github.com/SCamposs/void-mind/issues/6), not a result inferred from mocks.
