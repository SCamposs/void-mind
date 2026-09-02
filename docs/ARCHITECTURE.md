# VOID Mind Architecture

## Status language

- **Implemented** means executable and covered by current validation.
- **Foundation** means a real boundary or surface exists without pretending the future behavior is complete.
- **Proposed** means the dependency direction is decided but no production implementation exists.
- **Future** means explicitly deferred.

## Repository structure

```text
void-mind/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   ├── lib/
│       │   ├── stores/
│       │   └── styles/
│       └── src-tauri/
├── packages/
│   ├── mind-core/
│   ├── providers/
│   └── persistence/
├── lab/
│   ├── samples/
│   ├── src/
│   └── tests/
└── docs/
```

Three TypeScript packages are justified. A fourth shared package is intentionally absent until cross-domain utilities earn a stable boundary.

## Dependency direction

```text
desktop UI
  ├── mind-core
  ├── providers ──> mind-core
  └── persistence ──> mind-core

Tauri native runtime
  └── selected llama-server process only

Python lab
  └── independent Python and optional ML dependencies
```

The UI depends on provider contracts, never on llama.cpp response details. `mind-core` has no React, browser-storage, Tauri, or Python dependency. The Python lab does not enter the desktop runtime dependency graph.

## Conversations

**Implemented.** The core owns conversation and message types, mutations, title generation, search, rename, deletion, and validation. Editing a prior user message and regenerating an assistant response archive the displaced path in `archivedBranches`. The current UI shows one active linear path, while the data model avoids making discarded history unrecoverable.

The desktop store owns selection and ephemeral generation status. The provider owns the asynchronous stream and cancellation. Persistence serializes only durable product state.

## Providers

**Implemented.** `MindProvider` exposes identity, capability discovery, health, models, generation events, and cancellation. VOID Local implements llama-server-compatible health, model discovery, and streaming chat completion over a loopback-only origin.

**Future.** Codex, OpenAI API, Anthropic, Gemini, and other providers must implement the same boundary. The proposed Codex provider uses official Codex app-server and account mechanisms. It does not redefine the product as a coding tool.

## Persistence

**Implemented.** A versioned JSON envelope stores conversations, selected conversation, profiles, provider and model selection, safe preferences, and non-secret local-runtime configuration. Missing, malformed, partial, and legacy chat-shaped values fall back or migrate to safe defaults. Persistence failures surface in Settings.

Secrets are not required for the local provider and are not stored. A future remote-provider credential layer must use secure native storage behind a separate contract.

## Native local runtime

**Implemented foundation.** External mode connects to a user-started loopback server. Managed mode accepts only an explicitly selected file named `llama-server` or `llama-server.exe`, an explicitly selected `.gguf`, a validated non-privileged port, context, and GPU-layer count. It builds fixed arguments, binds `127.0.0.1`, prevents duplicate managed children, detects process exit, exposes stop/status commands, hides the child console on Windows, and cleans up on application exit.

It does not expose arbitrary command arguments, a shell, remote binding, filesystem-wide commands, or background services unrelated to the selected runtime.

## Workspaces, Knowledge, and Memory

**Foundation.** Workspaces and Knowledge have navigation surfaces and documented domain intent. There are no fake workspaces, statistics, indexing jobs, or RAG pipeline.

**Future.** A Workspace groups conversations, explicit sources, instructions, memory controls, and preferred provider/model settings. Knowledge contains user-supplied sources. Memory remains separately inspectable and controllable, with no silent permanent memory by default.

## Model lab

**Implemented and preserved.** `lab/` remains the canonical Python experimentation layer for schemas, normalization, deduplication, deterministic splits, fixed evaluations, model manifests, LoRA/QLoRA configuration, and guarded artifact commands. The long-term loop is use, evaluate, curate, train, export, import, and compare.

The A-series is lineage, not marketing. A0 may identify an imported compatible baseline. A1 must not be claimed until a real trained derivative exists.

## Boundary with VOID

VOID and VOID Mind remain sibling repositories. VOID is read-only to this project. The exact symbol geometry is shared intentionally, while application code is recreated within VOID Mind. A future `mind-core` consumer may power a reduced Mind Mini inside VOID without nesting repositories or mixing Python and desktop dependencies.
