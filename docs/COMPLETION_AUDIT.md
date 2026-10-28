# Environment phase completion audit

This is an open audit, not a completion declaration. The user subsequently approved direct official ChatGPT plan authentication plus an OpenAI API key; see CONNECTIONS.md for the requirement amendment. Numbering follows section 77 of VOID_MIND_ENVIRONMENT_GOAL.md. Source review and fixture tests do not substitute for native behavior or visual acceptance.

| Criterion | Evidence level | Current evidence / remaining gate |
| --- | --- | --- |
| 1 | Source reviewed | Home/onboarding prioritize Codex; native acceptance pending. |
| 2 | Source + tests | Rust codex.rs and providers/codex.ts implement official app-server. |
| 3 | Source reviewed | No browser token/cookie collection in integration. |
| 4 | Partial | PATH/native npm-shim discovery exists; missing/executable permission/platform failure cases need stronger lifecycle tests. |
| 5 | Partial | Manager starts/reuses/stops children; crash/shutdown/process-launch integration tests incomplete. |
| 6 | Source + tests | Central IDs/pending map/reader; direct tests cover out-of-order replies, duplicate/unknown IDs, sanitized errors and failure-drain behavior. |
| 7 | Observed earlier | Native app showed connected account; full revalidation pending. |
| 8 | Partial | Official account/login/start implemented; real login flow not exercised. |
| 9 | Partial | Browser/device-code branches implemented; browser failure/cancel tests pass; actual authentication pending. |
| 10 | Unverified live | Official account/logout call exists; real logout not exercised. |
| 11 | Source reviewed | Persistence uses product-state allowlist, excluding transient account/auth state. |
| 12 | Observed earlier | Native catalog loaded; model normalization covered by fixture tests. |
| 13 | Source + tests | Catalog comes from runtime; test model names are fixtures. |
| 14 | Source reviewed | Runtime reasoning metadata drives selectors; interactive switching pending. |
| 15 | Native inference observed | Actual Portuguese answer and context-dependent follow-up completed after MXC correction. Token cadence still needs direct observation. |
| 16 | Native legacy Stop observed; direct path partial | Interrupt fixtures pass; native Stop preserved a stable partial answer through restart. Direct HTTP cancellation has orchestration tests but no live credential-backed receipt. |
| 17 | Source + tests | Product conversation ID and remote binding are separate; resume test passes. |
| 18 | Partial | Neutral cwd and minimal read profile tested structurally; OS sandbox validation pending. |
| 19 | Source reviewed | General-purpose product surfaces; Codex in Intelligence/provider details. |
| 20 | Partial | Six llama provider tests pass; real GGUF inference not rerun. |
| 21 | Verified regression | Lab untouched in this checkpoint; Ruff and all six Python tests pass. |
| 22 | Partial | Home implemented and seen natively; latest acceptance pending. |
| 23 | Source reviewed | Continue with ChatGPT is primary; Use a local model opens Intelligence with explicit local preference. Native first-run test pending. |
| 24 | Source reviewed | Explore first completes onboarding without a provider and opens Home; native first-run test pending. |
| 25 | Partial | CRUD/detail/preferences exist; direct chat list/create added; native acceptance pending. |
| 26 | Source + tests | Workspace ownership persisted; draft reuse and deletion preservation tests pass. |
| 27 | Source + tests | Workspace instructions assembled for Codex/local; live response effect unverified. |
| 28 | Source + tests | Conversation/workspace/global resolution tested; interactive preference acceptance pending. |
| 29 | Source + tests | Rust imports UTF-8 md/txt up to 512 KB; validation/cleanup tests pass. |
| 30 | Source reviewed | Explicit file dialog/import only; no automatic scan path. |
| 31 | Source reviewed | Selected source checkboxes and remote context note visible; inspector acceptance pending. |
| 32 | Partial | Context inspector exists; ready-source selection and keyboard acceptance pending. |
| 33 | Tests pass | Resolution precedence and unavailable-provider behavior covered. |
| 34 | Partial | Black/ice tokens, canonical mark, Urbanist/Barlow implemented; final visual acceptance pending. |
| 35 | Partial | Source preserves black surfaces; final all-surface native QA pending. |
| 36 | Source reviewed | Short boot displacement and reduced-motion rules; motion inspection pending. |
| 37 | Partial | Proportional Barlow reading column implemented; long-form native QA pending. |
| 38 | Partial | Shortcuts/drawers/focus implemented; full keyboard walkthrough pending. |
| 39 | Partial | Narrow commands, URL allowlist, explicit import, loopback local endpoint; runtime isolation unresolved. |
| 40 | Partial | Core docs updated; remaining implementation/validation claims must follow audit. |
| 41 | Verified checks | 59 JS tests, 23 Rust tests, TypeScript/lint/fmt passed in recent checkpoints. |
| 42 | Windows build passed | Production and NSIS rebuild with MXC passed; Linux release unverified. |
| 43 | Verified checks | Six existing Python tests pass; Ruff passes. |
| 44 | Verified check | Diff checks pass before incremental commits. |
| 45 | Source boundary | All current checkpoint edits scoped to void-mind; sibling still has its pre-existing divergence. |
| 46 | Partial native QA | Existing account/catalog recovered after restart; real inference and continuation passed with MXC. Fresh direct login and its account-specific catalog were observed; direct inference, refresh and logout remain pending; legacy Stop was observed. |
| 47 | Documented | CODEX_PROVIDER.md and VALIDATION.md record runtime/sandbox and visual automation limits. |

## Additional user-requested gates

- Installer scope updated by the user after visual inspection: VOID header/sidebar/icons, native page bodies and controls. Full dark NSIS styling is no longer a requirement.
- Inspect setup/uninstall pages and titlebar actions after the Windows capture/activation failure is resolved.
- Publish alpha.1 only after required gates; prepared commits and local setup are not a published release.
- Transfer design to sibling VOID only in a subsequent authorized phase. Current phase keeps it read-only.

## Connection/control amendment validation

Direct `openai-chatgpt` and `openai-api` providers are implemented separately from the legacy Codex provider. Primary login no longer requires Codex installation. The older Codex runtime is retained for existing bindings; it is not a prerequisite for direct login. Fresh browser consent and the direct catalog were observed; real direct inference remains required before declaring this connection work validated.

All app-authored buttons/fields/selectors/checks/switches/numbers/segments/disclosures now use shared Base UI primitives. Primary scroll areas use Base UI with matching native fallback styling for text/code/list overflow. Native snapshots confirm the primary controls; final compact-drawer and postinspection corrections still require reinspection.
