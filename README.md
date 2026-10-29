# VOID Mind

A standalone intelligence environment for focused conversations and contextual work.

VOID Mind is a standalone desktop product for conversation, reasoning, writing, study, and exploration. Its primary connection is official Sign in with ChatGPT, using the user's plan without requiring Codex installation. An optional OpenAI API key, legacy Codex app-server compatibility and a loopback-only llama.cpp provider are also available. This repository preserves the Python model laboratory used for datasets, evaluation, manifests, and reproducible training preparation.

## Current state

[Download v0.2.0-alpha.1 for Windows or Linux](https://github.com/SCamposs/void-mind/releases/tag/v0.2.0-alpha.1). This is a prerelease with explicitly tracked manual-validation follow-ups; see the release notes and [phase report](docs/ALPHA_1_REPORT.md).

Implemented:

- standalone Tauri v2, React, and TypeScript desktop application
- product Home, persisted conversations, search, pin, rename, and delete
- streamed assistant responses with real interrupt, regenerate, edit, copy, Markdown, and code blocks
- official direct ChatGPT browser authentication, plus legacy Codex browser/device-code authentication
- live Codex model, reasoning-effort, and service-tier discovery
- persistent local conversation to Codex thread binding
- functional Workspaces with instructions and preferred intelligence
- explicit `.md`/`.txt` Knowledge import as app-managed copies and per-conversation selection
- a framework-agnostic conversation core
- a provider abstraction and loopback-only llama-server provider
- external-server mode and a constrained managed llama-server runtime
- General, Creative, Analytical, Concise, and Custom response profiles
- preserved Python model lab under `lab/`

Direct ChatGPT and API-key credentials are held by the native system credential store, outside product JSON persistence and frontend state. The legacy Codex runtime owns its own authentication; its threads use a neutral app-data workspace with `approvalPolicy: never`, a restrictive permission profile and no product tool workflow. A Windows runtime/profile test denied reading outside that neutral directory; this is not exhaustive cross-platform sandbox verification. VOID Local connects only to a llama.cpp-compatible server on `127.0.0.1`, `localhost`, or `::1`.

## Repository

```text
apps/desktop          standalone Tauri application
packages/mind-core    framework-agnostic conversation and model domain
packages/providers    provider contracts and llama-server implementation
packages/persistence  versioned local persistence
lab                   Python model data, evaluation, manifest, and training lab
docs                  product, architecture, design, and provider boundaries
```

## Run the desktop app

Requirements:

- Node.js 22+
- npm 11+
- Rust and the platform prerequisites required by Tauri v2
- Optional Codex CLI on `PATH` or in its supported per-user install location, only for legacy Codex-bound conversations; direct ChatGPT login does not require it

```powershell
npm install
npm run dev
```

For the native desktop application:

```powershell
npm run tauri -- dev
```

Validation:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run tauri -- info
npm run tauri -- build
```

## Run the model lab

The lab requires Python 3.12+ and uv.

```powershell
uv sync --extra dev
uv run ruff check .
uv run pytest
uv run mind dataset validate lab/samples/datasets/tiny-conversations.jsonl
uv run mind train dry-run lab/samples/train/qlora-dry-run.json
```

Training libraries remain optional:

```powershell
uv sync --extra dev --extra train
```

Installing the optional dependencies does not start training. Generated model files, checkpoints, adapters, outputs, caches, and private datasets are ignored.

## Documentation

- [Product](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN.md)
- [Providers](docs/PROVIDERS.md)
- [Codex provider](docs/CODEX_PROVIDER.md)
- [Workspaces](docs/WORKSPACES.md)
- [Knowledge](docs/KNOWLEDGE.md)
- [Model lab](lab/ARCHITECTURE.md)

## Current limitations

- no model or llama.cpp runtime is bundled or downloaded
- local inference requires a user-selected GGUF and llama-server installation; direct ChatGPT uses the connected account instead
- Knowledge uses explicit full-text context selection; indexing and RAG are not implemented
- arbitrary tools, autonomous actions, memory, voice, training UI, and Mind Mini are not implemented
- Codex availability depends on the installed runtime, network, account entitlement, and current usage limits
- model discovery does not claim a VOID-trained A1 without a verified artifact and manifest

VOID Mind is an early standalone foundation, not the completed future platform.

### Connection update

Continue with ChatGPT uses direct official Sign in with ChatGPT plan usage; this path does not require a separate Codex installation. Intelligence also offers an optional OpenAI API key. Both use the native system credential store and separate model catalogs. Fresh consent, direct inference, incremental streaming, Stop, contextual continuation and restart recovery were observed natively. Remaining manual validation is tracked in [issues #1–#5](https://github.com/SCamposs/void-mind/issues), including local/API-key inference, the final installed UI, real credential renewal/revocation and platform compatibility. These are not claimed as passed. See [Connections](docs/CONNECTIONS.md), the [alpha.1 handoff](docs/ALPHA_1_REPORT.md) and the [completion audit](docs/COMPLETION_AUDIT.md).
