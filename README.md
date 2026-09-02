# VOID Mind model lab

`void-mind` is the independent, local-first laboratory for preparing data, fixed evaluations, model manifests, and reproducible LoRA or QLoRA configurations used by VOID Mind. It does not download models, run cloud inference, or start expensive training automatically.

## Setup

```powershell
uv sync --extra dev
uv run mind --help
```

Optional training libraries are isolated behind an extra:

```powershell
uv sync --extra dev --extra train
```

Installing that extra still does not start training.

## Common workflows

```powershell
uv run mind dataset validate lab/samples/datasets/tiny-conversations.jsonl
uv run mind dataset stats lab/samples/datasets/tiny-conversations.jsonl
uv run mind dataset split lab/samples/datasets/tiny-conversations.jsonl outputs/split --seed 42
uv run mind dataset export lab/samples/datasets/tiny-conversations.jsonl outputs/public.jsonl

uv run mind eval run lab/samples/evals/general-v1.json lab/samples/evals/a0-responses.jsonl outputs/a0-result.json --model A0 --seed 42
uv run mind eval compare outputs/a0-result.json outputs/a1-result.json

uv run mind manifest validate path/to/void-mind-a0.manifest.json
uv run mind manifest create path/to/manifest.json path/to/model.gguf --name "VOID Mind" --version A0 --base "upstream/model" --source "https://source.example/model" --license Apache-2.0 --quantization Q4_K_M --language pt-BR --language en --context 8192 --chat-template llama3

uv run mind train dry-run lab/samples/train/qlora-dry-run.json
```

Export excludes `private` and `restricted` records by default. Use `--include-private` only for a deliberate local export into an ignored path.

Artifact commands are previews by default. They run only when `--run` is supplied and the required llama.cpp tool exists on `PATH`:

```powershell
uv run mind artifact merge adapter-dir model.gguf merged-f16.gguf
uv run mind artifact quantize merged-f16.gguf void-mind-a1-q4_k_m.gguf Q4_K_M
```

## A0 and A1

The first compatible imported GGUF is labeled `A0` in its manifest. A trained, merged, and quantized successor should use `A1`, preserve the base and dataset references in `training_lineage`, and record the final GGUF SHA-256. Model files, adapters, datasets marked private, caches, checkpoints, and generated outputs remain ignored.

See [lab/ARCHITECTURE.md](lab/ARCHITECTURE.md) for boundaries and reproducibility rules.
