# VOID Mind alpha.1 — environment phase handoff

Published on 2026-10-29: [v0.2.0-alpha.1](https://github.com/SCamposs/void-mind/releases/tag/v0.2.0-alpha.1). The environment phase is handed off under the maintainer's amended acceptance plan: remaining interactive checks are tracked as manual validation, not claimed as passed. Publication and all six asset digests were verified; detailed evidence is in VALIDATION.md.

## Product and architecture

VOID Mind is now a standalone general-purpose workspace with Home, Conversations, Workspaces, Knowledge, Intelligence and Settings. React/Tauri depends on framework-independent mind-core, provider and versioned-persistence packages. The Python laboratory remains outside the desktop runtime.

The initial Codex-dependent authentication direction was superseded by the approved direct official ChatGPT-plan connection and optional OpenAI API key. The primary flow requires neither a Codex installation nor a local model. Browser consent stays under user control. The native boundary owns registration, PKCE/state/nonce and signed identity validation, HTTPS requests, cancellation and OS-vault storage. Safe account presentation includes account identity/email and authorization state; model availability comes from the authenticated catalog. No fixed plan entitlement, unlimited usage or parity with the ChatGPT product is promised.

ChatGPT and API access use separate provider/model namespaces. No automatic provider fallback occurs. Conversation override takes precedence over workspace preference, then the global default. Controls adapt to reported capabilities; the global Active indicator/options no longer borrow a stale selection from another catalog. Direct requests use explicit local history, `store:false`, streaming and no tools. No extra AI request is used for titles.

The optional legacy Codex provider owns one stdio app-server child with centralized request correlation, bounded executable discovery/version probing, sanitized errors and pending-request cleanup. Cooperative EOF shutdown has a bounded forced fallback. Protocol schemas were generated from the installed official runtime; the tested installed version is 0.165.0-alpha.1.2. Browser/device-code login and account operations use official app-server methods. The runtime owns legacy credentials. Product IDs remain separate from provider thread bindings; start/resume preserve the restricted neutral directory/profile. General chats are not coding-agent surfaces and do not receive project directories by default.

Workspaces support names, descriptions, explicit instructions, provider/model preferences, conversation ownership and restart persistence. Knowledge accepts explicitly selected Markdown/text, validates type/size/UTF-8 and stores managed copies. Source selection and Context inspection make transmitted content visible. Deletion cleans the managed copy without deleting the original. There is no directory scan, embedding index, RAG or automatic memory.

Home prioritizes a quiet prompt, recent work and workspaces. Onboarding offers ChatGPT, API/local alternatives and Explore first; sending without an available provider is blocked by button and keyboard. New conversation is a transient draft until its first message, so repeated creation does not add empty history. Titles use deterministic extraction and preserve manual renaming. Search, pin/rename/delete, quick navigation and keyboard shortcuts are implemented.

## Visual direction

The canonical VOID mark/BootIntro geometry, black/glacial-white surfaces, Urbanist titles and Barlow reading/control typography establish the shared direction. Source-owned wrappers compose Base UI primitives for controls, dialogs, drawers, disclosures and primary scroll areas; native file dialogs remain platform-owned. Focus, overflow, disabled send cursor, callback/favicon and integrated titlebar were refined. NSIS uses VOID icons/header/sidebar with native page bodies, as agreed.

The approved direction is ready to guide the subsequent VOID appearance refactor through PRODUCT.md and DESIGN.md. No sibling VOID implementation is included in this phase; product domains must not be copied merely because their visual foundations are shared.

## Validation

- [Run 40892819822](https://github.com/SCamposs/void-mind/actions/runs/40892819822) at application source `aaa6d8d`: Windows and Linux passed lint, TypeScript, 67 JavaScript tests/20 files, native tests, production frontend/Tauri builds and packaging.
- Native tests: 38 Windows and 37 Linux passed, with two intentionally ignored standalone host/child-fixture entrypoints each. Tests cover actual child lifecycle behavior and loopback HTTP renewal/revocation contracts, not just pure mocks.
- Downloaded Linux receipts: eleven extracted Debian checks and twelve extracted AppImage checks passed. Real GTK selection, managed-copy cleanup, workspace persistence/deletion, no-provider behavior, compact keyboard containment and reduced motion are covered. This is not an OS package-manager/FUSE installation test.
- Laboratory: all six existing Python tests and Ruff passed. No training/data/lab expansion was performed during environment completion.
- Local-provider automated regression is retained; real GGUF inference is deferred in issue #1. No model/runtime is bundled or downloaded.
- Real account QA previously exercised official legacy and direct inference, contextual follow-up and Stop. Direct browser consent, catalog, incremental streaming, stopped-partial preservation, restart recovery and explicit workspace/source effect were observed. General non-coding prompts and long-form text/table reading were exercised.
- A Windows diagnostic using the same minimal-read neutral-directory/MXC profile read an allowed synthetic control and was denied a synthetic sibling-file read. This is limited Windows read-boundary evidence, not exhaustive filesystem/network or Linux enforcement proof.
- A prior branded Windows candidate installed over the existing installation and recovered the connected account/workspace/source/history. The final source corrections are CI-covered; the final installed UI remains manual validation.

## Manual follow-ups and deferred work

The maintainer directed that remaining interactive tests be saved as manual-validation issues and that no further tests control the user's PC. These items are not claimed as passed:

- [#1: real local llama.cpp/GGUF inference](https://github.com/SCamposs/void-mind/issues/1).
- [#2: real OpenAI API-key connection/inference](https://github.com/SCamposs/void-mind/issues/2).
- [#3: final Windows installer/UI, capability controls, compact reading and uninstall](https://github.com/SCamposs/void-mind/issues/3).
- [#4: real ChatGPT token renewal and remote revocation](https://github.com/SCamposs/void-mind/issues/4). Manual Disconnect/reconnect was reported, but whether a revocation warning appeared is unknown.
- [#5: legacy runtime authentication/lifecycle and normal Linux installation](https://github.com/SCamposs/void-mind/issues/5).

Qwen3-0.6B remains NO-GO in the evaluated configuration; no integration, training, additional benchmark or model download is part of this release. The isolated negative report is preserved; manual removal of its private experiment directory was left to the maintainer. Future optional provider-generated titles must disclose their additional usage/cost, run in the background, preserve manual names and retain deterministic fallback. They are not implemented here.

Agents, MCP, generic shell access, automatic memory, advanced retrieval, voice, image generation, training UI and Mind Mini remain deferred. Platform/account/provider limits are documented rather than hidden.

## Commits and repository boundary

Key implementation checkpoints include `9dd1cf2` (draft isolation), `a9c176f` (chrome/branding), `a9911dc` (workspace entry points), `2d1ec9d` (context bounds), `b122f76` (restricted Windows runtime compatibility), `38db469` (direct connections/shared controls), `80da169` (renewal/primitives), `8c9b225` (deferred history creation), `ab21693` (workspace quick navigation), `644ff9e` (cooperative shutdown), `b4d0173` (native Knowledge acceptance), `e6ba3b5` (discovery fallback), `df0921f` (focus acceptance), `efb5620` (global model controls) and `aaa6d8d` (HTTP auth regression). `git log v0.2.0-alpha.0..v0.2.0-alpha.1` identifies the complete release history once tagged; intermediate evidence and documentation commits remain in that history.

Release preparation after `aaa6d8d` changes documentation only. Tag `v0.2.0-alpha.1` points to `1fefd1a`; [release run 40901467460](https://github.com/SCamposs/void-mind/actions/runs/40901467460) passed Windows, Linux and publication. The three downloaded workflow packages and their checksum files match the six public release asset sizes/SHA-256 digests. None was executed locally for this check.

Generated binaries, logs, private QA and credentials are excluded from Git. Diff checks pass before publishing. The sibling VOID remains untouched and retains its pre-existing one-commit ahead/behind divergence. Main receives only the documentation receipt after the immutable release tag; final synchronization is verified when that receipt is pushed. No desktop control is needed to consume this report or download the release.
