# Desktop updates

`features/updates/updateStore.ts` owns the one-hour scheduler, persistent automatic/manual preference, update resource lifecycle, announcement state and confirmed installation/restart. `UpdatePanel.tsx` composes source-owned controls with Base UI Dialog and Progress. It is mounted at app level so progress survives navigation and waits until onboarding/boot/plan notices are finished before opening.

Checks never download or install. The user chooses Update and restart; Later defers the version for the current session. Unknown download length is indeterminate and displays downloaded MB, rather than an invented percentage. Errors remain retryable. A failed relaunch retries restart without reinstalling.

Tauri updater and process plugins have explicit check/download-and-install/restart permissions. The HTTPS feed is `updater/latest.json` in this repository, with `windows-x86_64` and `linux-x86_64` signed artifacts. The updater key is independent of VOID. Its private key stays outside the checkout and in the repository's `TAURI_SIGNING_PRIVATE_KEY` Actions secret; only the public key belongs in configuration. Preserve the key for future updates. Local backup path: `C:\Users\zuado\.tauri\void-mind-updater.key`.

Release workflow generates signatures/checksums and the manifest after both platforms build, publishes curated `docs/releases/<tag>.md` notes, and updates the static feed on main. Keep all workspace package/lock versions aligned. Native versions use the existing numeric prerelease mapping (`0.2.0-alpha.2` maps to `0.2.0-2`); the manifest uses the native version.

Windows NSIS explicitly uses `currentUser`; updater `installMode` is `quiet`. This avoids the user-scope selection page and suits the existing per-user installation default. It does not bypass operating-system security prompts or provide Authenticode signing. The custom app dialog reports download progress; Windows installation may close the app until restart. Real installation/progress/restart remains [manual validation #6](https://github.com/SCamposs/void-mind/issues/6), not a result inferred from mocks.
