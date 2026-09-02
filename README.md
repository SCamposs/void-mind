# VOID Mind

A local-first AI workspace.

VOID Mind is a standalone desktop product for conversation, reasoning, writing, study, and exploration with locally hosted models. This repository also preserves the Python model laboratory used for datasets, evaluation, manifests, and reproducible training preparation.

## Current state

Implemented:

- standalone Tauri v2, React, and TypeScript desktop application
- persisted conversations with rename, delete, and search
- streamed assistant responses with stop, regenerate, edit, copy, Markdown, and code blocks
- a framework-agnostic conversation core
- a provider abstraction and loopback-only llama-server provider
- external-server mode and a constrained managed llama-server runtime
- General, Creative, Analytical, Concise, and Custom response profiles
- honest Workspaces and Knowledge foundations
- preserved Python model lab under `lab/`

The current provider is VOID Local. It connects only to a llama.cpp-compatible server on `127.0.0.1`, `localhost`, or `::1`. It does not require an account, API key, remote backend, or telemetry.

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
- [Model lab](lab/ARCHITECTURE.md)

## Current limitations

- no model or llama.cpp runtime is bundled or downloaded
- real inference requires a user-selected GGUF and llama-server installation
- Workspaces and Knowledge are foundations only
- remote providers, account authentication, tools, memory, RAG, voice, training UI, and Mind Mini are not implemented
- model discovery does not claim a VOID-trained A1 without a verified artifact and manifest

VOID Mind is an early standalone foundation, not the completed future platform.
