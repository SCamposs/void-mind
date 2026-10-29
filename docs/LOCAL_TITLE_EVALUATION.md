# Local title generation: feasibility assessment

Status: isolated experiment completed, **not approved for integration**. On 2026-10-28 the user chose `Qwen/Qwen3-0.6B` as the first candidate, using its pretrained weights without training. Three bounded prompt configurations were evaluated offline, including a final zero-shot run with official template/sampling checks and separate development/final sets. Reliability remained insufficient. See [LOCAL_TITLE_RESULTS.md](LOCAL_TITLE_RESULTS.md) for raw examples, latency, memory, preservation checks and limits. The user accepted retaining deterministic extraction, authorized experiment cleanup and explicitly resumed the main environment work. There was no training or product integration; `lab/` remains in standby. Cleanup is blocked by execution policy; a verified lightweight evidence archive is preserved.

## Final user decision

The scope is one practical product function: generate a short conversation title locally, without using the user's ChatGPT quota. It is not a new AI research program. Evaluate the ready model in an isolated environment; do not automatically integrate it into Mind, introduce a download flow or change the existing title behavior. If pretrained inference is good and fast enough, no fine-tuning is needed. Training is outside this experiment and is not an automatic next step after a failed benchmark.

The product keeps the VOID visual identity. The candidate's Apache-2.0 license requires applicable distribution notices, not a decorative provider credit in the composer or conversation. Preserve its license and any applicable NOTICE material with distributed artifacts/documentation. Do not claim the pretrained weights were created or trained by Mind.

The official non-thinking mode was checked using `enable_thinking=False` and `add_generation_prompt=True`, separate roles and the rendered tokenizer template. The original Safetensors revision was pinned before download and verified. The reference runtime used CPU FP32. Quantization and production distribution remain unselected and unmeasured; no further models may be downloaded as part of this completed experiment.

## Decision to evaluate

Compare two approaches to the first user message:

1. Existing deterministic title extraction, with no model load.
2. The selected pretrained `Qwen/Qwen3-0.6B`, without additional training.

Starting from a pretrained base avoids having to learn general language from scratch. It does not establish title quality, Portuguese support, acceptable resource use or redistribution rights by itself. Fine-tuning does not erase the base model's license obligations. Training from scratch is a separate research question and is not the default implementation plan for this product feature.

## Current machine receipt

Read-only Windows hardware inspection on 2026-10-28 reported an AMD Ryzen 5 5600X, 12 logical processors, approximately 23.9 GiB system memory and an AMD Radeon RX 6600. The virtual display adapter is not an inference device. GPU acceleration support and usable VRAM were not verified; do not infer them from the device name. CPU inference was measured in the isolated experiment; no training-duration estimate is relevant to this no-training decision.

## Isolation requirements for a future experiment

Use one dedicated, ignored root such as `private/experiments/local-titles/`. Keep its Python virtual environment, dependency lock, model snapshots, download caches, temporary files, training checkpoints, results and logs below that root. Redirect cache/temp locations for each child process, including Hugging Face, Torch, pip and the chosen environment manager. Keep an artifact manifest recording paths, sizes, source revisions and ownership.

Do not install Python packages globally, edit persistent user/system environment variables, change drivers, add services or reuse production credentials. A virtual environment separates dependencies; it is not an operating-system sandbox. Verify actual output locations before claiming the experiment leaves no files elsewhere. If a dependency requires external state, document it before using it.

Cleanup must stop experiment-owned processes first, verify the resolved root is inside the intended workspace, and remove only the recorded experiment paths. Preserve the production app, existing user models, account credentials and user documents. No cleanup command has been run as part of this assessment.

## Evidence required before training or integration

- A fixed, held-out set of Portuguese and English prompts, including long prompts, code, questions, accents and misleading instructions. Use synthetic or explicitly supplied material, not private chat history gathered automatically.
- Evaluate short, relevant titles in the user's language, preserving important identifiers without answering the prompt or inventing facts. A 36-character limit is a candidate product target, not a quality score.
- Measure cold-load time, warm title latency, peak/resident memory, downloaded/installed size and behavior while the main chat is active. Compare against deterministic extraction.
- Report setup/download/load time separately from inference. There is no training stage in this experiment.
- Retain all raw titles and per-case timing results, including failures and output-limit violations. Do not infer success from a few favorable examples or silently normalize poor outputs before scoring them.
- Confirm the exact weights/tokenizer/code licenses and required distribution notices before selecting a base.

Product integration, if later accepted, should generate once in the background after first send, preserve an immediate fallback, avoid blocking the main response and never overwrite a manual rename. An unavailable local model must retain the fallback instead of silently consuming a remote quota.

## Sources and superseded alternatives

Selected candidate and license:

- https://huggingface.co/Qwen/Qwen3-0.6B
- https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/LICENSE

No latency, quality or memory result is established by the model card. Actual measurements remain required before proposing product integration. Acceptance thresholds and packaging remain open decisions.

SmolLM2 variants at 135M and 360M parameters were earlier research examples. They are not candidates for the first experiment after the user's final Qwen selection. Their English/Apache-2.0 cards did not establish Portuguese title quality or local training speed:

- https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct
- https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct

The public Codex TUI uses a separate structured title request with a 36-character output bound and prioritizes manual names. That is a useful behavioral reference, not proof that Codex desktop uses the identical implementation:

- https://github.com/openai/codex/blob/main/codex-rs/tui/src/app/thread_title.rs
