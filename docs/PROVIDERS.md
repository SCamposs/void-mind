# VOID Mind Providers

## Status

- Provider contract: **Implemented**
- VOID Local llama-server provider: **Implemented**
- External local-server mode: **Implemented**
- Managed local runtime: **Implemented foundation**
- Remote providers: **Future**
- Codex provider: **Proposed**

## Contract

A provider supplies:

- a stable identity and display name
- declared capabilities
- health and readiness
- available model descriptors
- generation as typed stream events
- cancellation
- actionable errors

Capabilities include streaming, cancellation, files, vision, tools, reasoning, local execution, and account authentication. UI surfaces ask the contract about capabilities instead of branching on llama.cpp implementation details.

Generation emits `start`, `token`, `done`, or `error`. Cancellation uses `AbortSignal` at the caller boundary and a provider-owned active controller. This keeps stop behavior usable without exposing transport details to the conversation view.

## VOID Local

VOID Local speaks the llama.cpp OpenAI-compatible surface:

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions` with streaming enabled

The endpoint normalizer accepts HTTP origins only on `127.0.0.1`, `localhost`, or `::1`. It rejects credentials, query parameters, fragments, API paths, HTTPS remote origins, LAN addresses, and public binding.

HTTP 503 is treated as model loading. Server errors and malformed stream events become explicit provider errors. No silent remote fallback exists.

## Model descriptors

Models are user-facing objects. The current descriptor can represent:

- display name and provider identifier
- version and location
- base model, format, and quantization
- context, languages, and capabilities
- source, license, hash, and creator
- training lineage and chat template
- explicitly selected local model and manifest paths

Runtime discovery creates only the metadata the server proves. It does not fabricate license, hash, lineage, language, context, or A1 status.

## Managed runtime security

The native bridge is deliberately narrow:

- only the selected `llama-server` executable name is accepted
- only an existing selected `.gguf` is accepted
- ports below 1024 are rejected
- host is fixed to `127.0.0.1`
- arguments are constructed internally
- duplicate managed children are rejected
- standard streams are detached from the UI
- the child is stopped on application exit
- crash status is observable

There is no shell permission, arbitrary executable mode, arbitrary argument input, remote binding, broad filesystem command, or process enumeration API.

## Adding a provider

A future provider must:

1. implement `MindProvider`
2. declare truthful capabilities
3. translate its transport into common stream events
4. define cancellation and error semantics
5. keep credentials outside local JSON persistence
6. state whether execution and data transfer are local or remote
7. add contract-level tests for health, models, stream parsing, cancellation, and errors

Remote providers must be opt-in and must never inherit the local privacy claim.

The future Codex provider should use official Codex runtime or app-server mechanisms and official ChatGPT/Codex account authentication. Unofficial token extraction is outside the architecture.
