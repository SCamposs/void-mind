# VOID Mind Providers

## Status

- Provider contract: **Implemented**
- VOID Local llama-server provider: **Implemented**
- External local-server mode: **Implemented**
- Managed local runtime: **Implemented foundation**
- ChatGPT plan provider: **Implemented; native authentication, inference, Stop, continuation and restart recovery observed**
- OpenAI API-key provider: **Implemented; real-key QA deferred by the user to [issue #2](https://github.com/SCamposs/void-mind/issues/2), outside alpha.1 acceptance**
- OpenAI Codex provider: **Implemented, legacy runtime connection**
- Additional remote providers: **Future**

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

Generation emits `binding`, `start`, `token`, `done`, or `error`. Cancellation uses `AbortSignal` at the caller boundary and a provider-owned interrupt. This keeps stop behavior usable without exposing transport details to the conversation view.

## OpenAI Codex

The legacy Codex provider launches the installed `codex app-server --stdio`, performs the required initialize handshake, and centralizes JSONL request correlation and notification normalization in the Tauri layer. It supports runtime-owned ChatGPT login, logout and cancellation; live model discovery; persisted thread IDs; streamed assistant deltas; turn completion; and actual `turn/interrupt`.

Every legacy thread uses a neutral workspace below app data, `approvalPolicy: never`, a named minimal-read permission profile with network disabled, and general-purpose conversation instructions. Server-initiated approval or tool requests are rejected. Legacy runtime credentials are never requested, parsed, logged, or written by VOID Mind. Earlier elevated sandbox probes failed; subsequent MXC-backed native inference, Stop and continuation passed. Effective filesystem-denial validation remains open. See CODEX_PROVIDER.md and COMPLETION_AUDIT.md.

The provider exposes errors as stable user-facing categories such as missing runtime, authentication required, network unavailable, usage limit, unavailable model, protocol mismatch, and generation failure. It does not silently route to llama.cpp.

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

A provider must:

1. implement `MindProvider`
2. declare truthful capabilities
3. translate its transport into common stream events
4. define cancellation and error semantics
5. keep credentials outside local JSON persistence
6. state whether execution and data transfer are local or remote
7. add contract-level tests for health, models, stream parsing, cancellation, and errors

Remote providers must be opt-in and must never inherit the local privacy claim.

Unofficial token extraction is outside the architecture.

## Direct ChatGPT and OpenAI API connections

`openai-chatgpt` and `openai-api` are separate provider IDs and model namespaces. `connections.rs` owns OAuth, secure native credential storage, serialized refresh, account selection, key verification, model discovery and Responses SSE. `OpenAIProvider` adapts sanitized native events to the existing provider contract. Requests include the full explicit local history and selected context, without tools or server-stored conversation state. `store:false` and `stream:true` are mandatory. Model metadata is not fabricated; the API catalog may include models that do not support Responses text conversations. No account/key fallback occurs automatically.

Credentials stay in the OS vault. The password input is uncontrolled and cleared on submit; it is never stored in Zustand/localStorage. OAuth URLs, codes and tokens never cross IPC. Tokens are signed/issuer/audience/expiry/nonce checked, and plan authorization depends on granted scopes. Sign-out attempts remote session revocation and reports an unconfirmed revocation explicitly. See [CONNECTIONS.md](CONNECTIONS.md).
