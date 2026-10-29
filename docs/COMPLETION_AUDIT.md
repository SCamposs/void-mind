# Environment phase completion audit

This is an open audit, not a completion declaration. The user subsequently approved direct official ChatGPT plan authentication plus an OpenAI API key; see CONNECTIONS.md for the requirement amendment. Numbering follows section 77 of VOID_MIND_ENVIRONMENT_GOAL.md. Source review and fixture tests do not substitute for native behavior or visual acceptance.

| Criterion | Evidence level | Current evidence / remaining gate |
| --- | --- | --- |
| 1 | Native primary connection and first-run presentation observed | Fresh Linux onboarding prioritizes ChatGPT and opens Intelligence without installed Codex; direct account/catalog/inference were separately observed on Windows. This combines separate receipts, not one clean-machine login walkthrough. |
| 2 | Source + tests | Rust codex.rs and providers/codex.ts implement official app-server. |
| 3 | Source reviewed | No browser token/cookie collection in integration. |
| 4 | Discovery/probe tests and real host probe passed; latest CI pending | Missing files/directories/names and Unix execute bits are covered. Windows selection now rejects failed probes instead of returning an unverified fallback. A real invalid codex.exe is rejected locally; selection tests cover runnable fallback/MXC preference/expired budgets. All 35 Windows Rust tests and the separate installed-runtime probe (0.165.0-alpha.1.2) pass. Latest cross-platform CI is pending; no Windows ACL-specific exercise or publisher authentication is claimed. |
| 5 | Process and manager cleanup tests pass; native integration partial | Real stdio child tests cover request/crash, pending-request cleanup, cooperative EOF exit, forced fallback after 500 ms, cleanup with an occupied input lock, child reaping, repeated cleanup and manager ownership removal. Actual Codex discovery/start/reuse and Tauri-exit walkthrough remain separate gates. |
| 6 | Source + tests | Central IDs/pending map/reader; direct tests cover out-of-order replies, duplicate/unknown IDs, sanitized errors and failure-drain behavior. |
| 7 | Native observed | Direct connected account and live catalog recovered after preview restart. |
| 8 | Native direct login observed | User completed official browser consent; direct account and catalog loaded. Legacy login start remains implemented but not freshly exercised. |
| 9 | Native browser flow observed | Direct browser flow completed with user-controlled authentication. Legacy device-code flow remains unverified live. |
| 10 | Unverified live | Official account/logout call exists; real logout not exercised. |
| 11 | Source reviewed | Persistence uses product-state allowlist, excluding transient account/auth state. |
| 12 | Observed earlier | Native catalog loaded; model normalization covered by fixture tests. |
| 13 | Source + tests | Catalog comes from runtime; test model names are fixtures. |
| 14 | Global capability binding regression fixed and tested | Native inspection found stale legacy metadata supplying options while the global provider was direct ChatGPT. Intelligence now resolves its Active badge/options from the global provider/model preference, independently of catalog-selection state. Store/UI tests cover interleaved catalog refreshes, missing explicit models, provider defaults and control appearance/removal on preference changes. A fresh installed-source check of this correction is pending. |
| 15 | Native legacy and direct inference observed | Portuguese explanations and contextual follow-ups completed on both paths. Incremental direct text was observed at separate partial stages. |
| 16 | Native legacy and direct Stop observed | Both partials survived restart. Direct Stop preserved an unfinished item, settled to idle, remained stable and allowed a successful contextual follow-up. |
| 17 | Source + tests | Product conversation ID and remote binding are separate; resume test passes. |
| 18 | Windows native read boundary verified; platform scope limited | A no-inference command/exec diagnostic with runtime 0.165.0-alpha.1.2 and the same named minimal-read/MXC profile read an allowed control but received Access is denied for a sibling file outside the neutral workspace. Product thread/turn restrictions are source/test covered. No Linux OS enforcement or exhaustive filesystem/network claim. |
| 19 | Source reviewed | General-purpose product surfaces; Codex in Intelligence/provider details. |
| 20 | Automated regression retained; real inference explicitly deferred | Six llama provider tests pass. On 2026-10-29 the user deferred real GGUF/runtime validation and requested tracking it in [issue #1](https://github.com/SCamposs/void-mind/issues/1), outside current alpha.1 validation. No new model download or inference claim. |
| 21 | Verified regression | Lab untouched in this checkpoint; Ruff and all six Python tests pass. |
| 22 | Native Home inspected at full and compact sizes | Windows Home inspected; Linux run 40812737849 resized the actual app to 760-by-600 and verified/captured Home within its viewport. Extracted Debian and AppImage passed the same compact checks in that run. |
| 23 | Native first-run presentation observed | Fresh Linux production app exposes primary ChatGPT action and API/local/Explore alternatives. Local option routing is source-reviewed; real provider setup remains covered by other receipts. |
| 24 | Native Explore first passed | Isolated credential-free Linux app opened Home and Intelligence, retained onboarding completion after app restart and prevented both button and Enter sending with a nonempty prompt in run 40802054782. No conversation was persisted. |
| 25 | Native CRUD, persistence and copy cleanup observed | Windows creation/description/instructions/preference and restart passed. Linux run 40811967821 verified restart, Keep/Delete confirmation and actual managed-file cleanup through workspace deletion while retaining the source original. Partial deletion/retry and conversation preservation also have component coverage. |
| 26 | Native workspace conversation observed | Workspace-created draft inherited its preference and delivered a real response; draft promotion/source isolation and deletion preservation tests pass. |
| 27 | Native direct instruction effect observed | Real workspace response followed the configured language, sentence and prefix instruction. Assembly for other providers remains covered structurally. |
| 28 | Native workspace preference and conversation override persistence observed | The installed app retained workspace GPT-5.6-Luna. A saved QA conversation changed from direct GPT-6-Luna to GPT-6.1-Sol, then restored that override after real process exit/relaunch; Home retained the workspace preference. The original conversation model was restored afterward, without inference. Changed-model inference and the reasoning walkthrough remain unverified. |
| 29 | Native import, restart and deletion passed | Run 40811967821 used the GTK picker to import Markdown, inspected the real managed file and metadata, restarted, cancelled removal, then confirmed removal and verified only the copy disappeared. Rust tests additionally cover supported types, UTF-8, size limits and path boundaries. Full-preview text was checked; the next screenshot check waits for its reveal animation to finish. |
| 30 | Source reviewed | Explicit file dialog/import only; no automatic scan path. |
| 31 | Native selection and use observed | Source checkbox/count reflected explicit selection; response returned facts unique to that source. A new draft did not implicitly retain the selection. |
| 32 | Native inspector observed | Instructions/source names visible; selection updated count and survived app restart; Escape closed the panel and returned focus. Compact conversation renders its Context trigger. |
| 33 | Tests pass | Resolution precedence and unavailable-provider behavior covered. |
| 34 | Partial | Black/ice tokens, canonical mark, Urbanist/Barlow implemented; final visual acceptance pending. |
| 35 | Partial | Source preserves black surfaces; final all-surface native QA pending. |
| 36 | Linux reduced motion verified | Run 40808447482 confirms native GTK preference reaches WebKit and reduced CSS in extracted AppImage. Final visual motion acceptance remains pending. |
| 37 | Real long-form conversation inspected | In the installed Windows app, a direct ChatGPT response to a general study-techniques prompt completed with paragraphs, headings, a list and a three-column table. Native scrolling and hierarchy/wrapping were visually inspected at 1280-by-800. This does not claim compact long-form acceptance or user aesthetic approval. |
| 38 | Native desktop and compact navigation checks passed | Existing Ctrl+N/model/Context/history receipts are retained. Linux run 40812737849 verified Ctrl+K/search/workspace/Settings navigation plus real compact drawer Tab containment, Escape closing and trigger focus restoration. The extracted Debian and AppImage scenarios passed the same compact execution checks. |
| 39 | Narrow source boundaries plus Windows read-denial evidence | Commands remain scoped; browser URL allowlists, explicit imports and loopback-only local endpoints are source/test covered. The matching named runtime profile denied a synthetic read outside its neutral workspace on Windows. Linux OS sandbox and network-denial behavior remain outside this native receipt. |
| 40 | Partial | Core docs updated; remaining implementation/validation claims must follow audit. |
| 41 | Cross-platform checkpoint passed | Run 40812737849 at 54580a1 passed Windows/Linux validation, including 33 Rust tests, production builds, native import/cleanup and compact navigation. Later changes are documentation receipts only. |
| 42 | Current preview packaging and extracted Linux runtime passed | Run 40812737849 built NSIS, Debian and AppImage without publishing. Extracted Debian executable passed eleven checks; AppImage AppRun passed twelve, including Knowledge import/restart/deletion, workspace cleanup, compact navigation and reduced motion (AppImage). This does not prove OS package-manager installation or FUSE mounting. |
| 43 | Verified regression | All six existing Python tests and Ruff passed again after the current environment changes; lab source remains untouched. |
| 44 | Verified check | Diff checks pass before incremental commits. |
| 45 | Source boundary | All current checkpoint edits scoped to void-mind; sibling still has its pre-existing divergence. |
| 46 | Partial native QA | Legacy inference/continuation/Stop passed. Direct fresh login, catalog, inference, incremental streaming, Stop, continuation, restart recovery and a new workspace/source request after restart observed. Refresh/logout remain pending. |
| 47 | Documented | CODEX_PROVIDER.md and VALIDATION.md record runtime/sandbox and visual automation limits. |

## Additional user-requested gates

- Installer scope updated by the user after visual inspection: VOID header/sidebar/icons, native page bodies and controls. Full dark NSIS styling is no longer a requirement.
- Updated setup welcome, same-version maintenance, destination, progress and installation-complete pages were inspected with the VOID icon/header/sidebar and native bodies. User clicked Finish and the installed application opened. Uninstaller inspection was interrupted by physical Escape; no uninstall validation is claimed. App maximize/close actions were verified earlier.
- The e6ba3b5 Windows candidate was subsequently installed with explicit action-time user authorization. Add/Reinstall was used at the exact existing executable directory; setup completed and Run VOID Mind opened the app with its connected account and prior workspace/source/history. A later Intelligence model-binding bug was then found and fixed in source; that frontend correction is not claimed as installed by this receipt.
- Publish alpha.1 only after required gates; prepared commits and local setup are not a published release.
- Transfer design to sibling VOID only in a subsequent authorized phase. Current phase keeps it read-only.

## Connection/control amendment validation

Direct `openai-chatgpt` and `openai-api` providers are implemented separately from the legacy Codex provider. Primary login no longer requires Codex installation. The older Codex runtime is retained for existing bindings; it is not a prerequisite for direct login. Fresh browser consent, direct catalog, real inference, visible incremental streaming, Stop and contextual continuation passed natively. Post-inference restart recovered the connected account, catalog and full conversation, including stopped content. A subsequent workspace/source request succeeded without another login. Real API-key inference and credential refresh/revocation remain unverified.

On 2026-10-29 the user explicitly deferred real API-key validation to [issue #2](https://github.com/SCamposs/void-mind/issues/2), outside alpha.1 acceptance. The provider stays implemented and its automated tests remain required. No API-key entry or billable API call is authorized for the current phase. That decision does not defer credential refresh/revocation checks for the primary ChatGPT connection.

All app-authored buttons/fields/selectors/checks/switches/numbers/segments/disclosures now use shared Base UI primitives. Primary scroll areas use Base UI with matching native fallback styling for text/code/list overflow. Native compact navigation/history drawers isolated background accessibility; the rebuilt history dialog exposed its corrected accessible name and closed with Escape. Final all-surface keyboard, visual and reduced-motion acceptance remains open.

## Resumption after the isolated title experiment

The user accepted retaining deterministic title extraction and explicitly authorized resuming the main environment goal on 2026-10-28. Qwen is not integrated; `lab/` remains in standby. The negative experiment report and lightweight private evidence archive are preserved. Execution policy blocked recursive removal of the experiment directory, so disk cleanup is an outstanding environment limitation rather than a completed action. Current-state provider/auth documentation was reconciled against the chronological native receipts; historical failed probes remain recorded.
