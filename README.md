# VOID Mind

A standalone intelligence environment for focused conversations and contextual work.

VOID Mind is a standalone desktop product for conversation, reasoning, writing, study, and exploration. Its primary provider is the official Codex app-server using a user's ChatGPT account; a loopback-only llama.cpp provider remains available for local models. This repository also preserves the Python model laboratory used for datasets, evaluation, manifests, and reproducible training preparation.

## Current state

Implemented:

- standalone Tauri v2, React, and TypeScript desktop application
- product Home, persisted conversations, search, pin, rename, and delete
- streamed assistant responses with real interrupt, regenerate, edit, copy, Markdown, and code blocks
- official ChatGPT browser and device-code authentication through Codex app-server
- live Codex model, reasoning-effort, and service-tier discovery
- persistent local conversation to Codex thread binding
- functional Workspaces with instructions and preferred intelligence
- explicit `.md`/`.txt` Knowledge import as app-managed copies and per-conversation selection
- a framework-agnostic conversation core
- a provider abstraction and loopback-only llama-server provider
- external-server mode and a constrained managed llama-server runtime
- General, Creative, Analytical, Concise, and Custom response profiles
- preserved Python model lab under `lab/`

The primary provider is OpenAI Codex. Authentication and account credentials are owned by the installed Codex runtime; VOID Mind does not extract or persist tokens. Each thread runs in a neutral app-data workspace with `approvalPolicy: never`, a read-only sandbox, and no product tool workflow. VOID Local connects only to a llama.cpp-compatible server on `127.0.0.1`, `localhost`, or `::1`.

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
- Codex CLI on `PATH` or in its supported per-user install location for ChatGPT integration

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
- real inference requires a user-selected GGUF and llama-server installation
- Knowledge uses explicit full-text context selection; indexing and RAG are not implemented
- arbitrary tools, autonomous actions, memory, voice, training UI, and Mind Mini are not implemented
- Codex availability depends on the installed runtime, network, account entitlement, and current usage limits
- model discovery does not claim a VOID-trained A1 without a verified artifact and manifest

VOID Mind is an early standalone foundation, not the completed future platform.
