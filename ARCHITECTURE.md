# Architecture

## Boundaries

`void-mind` prepares artifacts. The `void` desktop application consumes a compatible local GGUF through `llama-server`. Neither repository owns model weights, cloud inference, telemetry, or automatic downloads.

- `datasets.py` owns strict SFT and preference-pair schemas, normalization, semantic deduplication, deterministic splitting, privacy classification, and JSONL export.
- `evaluation.py` owns fixed suites and deterministic scoring of captured model outputs. It stores the seed, suite, model label, per-case results, and aggregate score.
- `manifest.py` owns the versioned A0/A1 contract and SHA-256 helpers.
- `training.py` validates LoRA or QLoRA configuration and gates external llama.cpp artifact tools behind explicit execution.
- `cli.py` is a thin Typer surface over those modules.

## Reproducibility

Splits sort records before applying a seeded shuffle. Evaluation uses a fixed suite plus captured outputs, so repeating a run with the same inputs and seed produces the same case decisions. Training configurations include an explicit seed and all material hyperparameters. Generated results and outputs belong in ignored directories.

## Data handling

Every record includes provenance, license, and privacy classification. Public export omits `private` and `restricted` records. Private source material belongs under ignored `private/` or `data/private/` paths and must not be committed.

## Model lineage

The JSON Schema at `src/void_mind/contracts/model-manifest.schema.json` is the portable contract. `A0` identifies the first compatible imported model. Later exports increment the label and list their base, fine-tuning, merge, and quantization ancestry. Every distributed manifest records the final GGUF SHA-256 and `created_by: SCamposs`.
