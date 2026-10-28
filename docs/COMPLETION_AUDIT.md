# Environment phase completion audit

This is an open audit, not a completion declaration. The user subsequently approved direct official ChatGPT plan authentication plus an OpenAI API key; see CONNECTIONS.md for the requirement amendment. Numbering follows section 77 of VOID_MIND_ENVIRONMENT_GOAL.md. Source review and fixture tests do not substitute for native behavior or visual acceptance.

| Criterion | Evidence level | Current evidence / remaining gate |
| --- | --- | --- |
| 1 | Native primary connection observed | Home/onboarding prioritize ChatGPT; direct account/catalog/inference observed. First-run acceptance remains pending. |
| 2 | Source + tests | Rust codex.rs and providers/codex.ts implement official app-server. |
| 3 | Source reviewed | No browser token/cookie collection in integration. |
| 4 | Partial | PATH/native npm-shim discovery exists; missing/executable permission/platform failure cases need stronger lifecycle tests. |
| 5 | Partial | Manager starts/reuses/stops children; crash/shutdown/process-launch integration tests incomplete. |
| 6 | Source + tests | Central IDs/pending map/reader; direct tests cover out-of-order replies, duplicate/unknown IDs, sanitized errors and failure-drain behavior. |
| 7 | Native observed | Direct connected account and live catalog recovered after preview restart. |
| 8 | Native direct login observed | User completed official browser consent; direct account and catalog loaded. Legacy login start remains implemented but not freshly exercised. |
| 9 | Native browser flow observed | Direct browser flow completed with user-controlled authentication. Legacy device-code flow remains unverified live. |
| 10 | Unverified live | Official account/logout call exists; real logout not exercised. |
| 11 | Source reviewed | Persistence uses product-state allowlist, excluding transient account/auth state. |
| 12 | Observed earlier | Native catalog loaded; model normalization covered by fixture tests. |
| 13 | Source + tests | Catalog comes from runtime; test model names are fixtures. |
| 14 | Source reviewed | Runtime reasoning metadata drives selectors; interactive switching pending. |
| 15 | Native legacy and direct inference observed | Portuguese explanations and contextual follow-ups completed on both paths. Incremental direct text was observed at separate partial stages. |
| 16 | Native legacy and direct Stop observed | Both partials survived restart. Direct Stop preserved an unfinished item, settled to idle, remained stable and allowed a successful contextual follow-up. |
| 17 | Source + tests | Product conversation ID and remote binding are separate; resume test passes. |
| 18 | Partial | Neutral cwd and minimal read profile tested structurally; OS sandbox validation pending. |
| 19 | Source reviewed | General-purpose product surfaces; Codex in Intelligence/provider details. |
| 20 | Partial | Six llama provider tests pass; real GGUF inference not rerun. |
| 21 | Verified regression | Lab untouched in this checkpoint; Ruff and all six Python tests pass. |
| 22 | Partial | Home implemented and seen natively; latest acceptance pending. |
| 23 | Source reviewed | Continue with ChatGPT is primary; Use a local model opens Intelligence with explicit local preference. Native first-run test pending. |
| 24 | Source reviewed | Explore first completes onboarding without a provider and opens Home; native first-run test pending. |
| 25 | Native creation/editing/persistence observed; deletion tested | Native creation/name/description/instructions/preference, navigation and app-restart retention passed. Product-surface partial-cleanup/retry tests preserve conversations. Native deletion remains open. |
| 26 | Native workspace conversation observed | Workspace-created draft inherited its preference and delivered a real response; draft promotion/source isolation and deletion preservation tests pass. |
| 27 | Native direct instruction effect observed | Real workspace response followed the configured language, sentence and prefix instruction. Assembly for other providers remains covered structurally. |
| 28 | Native workspace preference observed | Keyboard selection/save used a different catalog model from the global default; chat showed workspace resolution. Full conversation-override native walkthrough remains pending. |
| 29 | Native Markdown import observed + tests | Explicit native selection created a managed item with metadata and full preview. UTF-8 md/txt limits/cleanup covered by Rust tests; native deletion remains unverified. |
| 30 | Source reviewed | Explicit file dialog/import only; no automatic scan path. |
| 31 | Native selection and use observed | Source checkbox/count reflected explicit selection; response returned facts unique to that source. A new draft did not implicitly retain the selection. |
| 32 | Native inspector observed | Instructions/source names visible; selection updated count and survived app restart; Escape closed the panel and returned focus. Compact conversation renders its Context trigger. |
| 33 | Tests pass | Resolution precedence and unavailable-provider behavior covered. |
| 34 | Partial | Black/ice tokens, canonical mark, Urbanist/Barlow implemented; final visual acceptance pending. |
| 35 | Partial | Source preserves black surfaces; final all-surface native QA pending. |
| 36 | Source reviewed | Short boot displacement and reduced-motion rules; motion inspection pending. |
| 37 | Partial | Proportional Barlow reading column implemented; long-form native QA pending. |
| 38 | Partial native keyboard walkthrough | Ctrl+N draft, End/Enter model selection, Escape Context and focus return observed; Ctrl+K observed earlier. Compact navigation/history drawers isolate background accessibility; history Escape works. Final full walkthrough remains pending. |
| 39 | Partial | Narrow commands, URL allowlist, explicit import, loopback local endpoint; runtime isolation unresolved. |
| 40 | Partial | Core docs updated; remaining implementation/validation claims must follow audit. |
| 41 | Verified checks | All 63 JS tests pass together; TypeScript/lint pass after new surface tests. 23 Rust tests passed previously; native source unchanged in this checkpoint. |
| 42 | Windows build passed | Production and NSIS rebuild with MXC passed; Linux release unverified. |
| 43 | Verified checks | Six existing Python tests pass; Ruff passes. |
| 44 | Verified check | Diff checks pass before incremental commits. |
| 45 | Source boundary | All current checkpoint edits scoped to void-mind; sibling still has its pre-existing divergence. |
| 46 | Partial native QA | Legacy inference/continuation/Stop passed. Direct fresh login, catalog, inference, incremental streaming, Stop, continuation, restart recovery and a new workspace/source request after restart observed. Refresh/logout remain pending. |
| 47 | Documented | CODEX_PROVIDER.md and VALIDATION.md record runtime/sandbox and visual automation limits. |

## Additional user-requested gates

- Installer scope updated by the user after visual inspection: VOID header/sidebar/icons, native page bodies and controls. Full dark NSIS styling is no longer a requirement.
- Inspect setup/uninstall pages and titlebar actions after the Windows capture/activation failure is resolved.
- Publish alpha.1 only after required gates; prepared commits and local setup are not a published release.
- Transfer design to sibling VOID only in a subsequent authorized phase. Current phase keeps it read-only.

## Connection/control amendment validation

Direct `openai-chatgpt` and `openai-api` providers are implemented separately from the legacy Codex provider. Primary login no longer requires Codex installation. The older Codex runtime is retained for existing bindings; it is not a prerequisite for direct login. Fresh browser consent, direct catalog, real inference, visible incremental streaming, Stop and contextual continuation passed natively. Post-inference restart recovered the connected account, catalog and full conversation, including stopped content. Real API-key inference, credential refresh/revocation and a new direct request after restart remain unverified.

All app-authored buttons/fields/selectors/checks/switches/numbers/segments/disclosures now use shared Base UI primitives. Primary scroll areas use Base UI with matching native fallback styling for text/code/list overflow. Native snapshots confirm the primary controls; final compact-drawer and postinspection corrections still require reinspection.
