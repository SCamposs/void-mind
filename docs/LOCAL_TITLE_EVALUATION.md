# Local title generation: feasibility assessment

Status: assessment only. The user requested evidence that an initial local model is worthwhile and asked for an environment that is easy to clean. No model has been selected, downloaded, trained or integrated for this feature. The existing `lab/` remains in standby.

## Decision to evaluate

Compare three approaches to the first user message:

1. Existing deterministic title extraction, with no model load.
2. A small pretrained instruction model, without additional training.
3. The same base with task-specific fine-tuning, only if measured baseline weaknesses justify the experiment.

Starting from a pretrained base avoids having to learn general language from scratch. It does not establish title quality, Portuguese support, acceptable resource use or redistribution rights by itself. Fine-tuning does not erase the base model's license obligations. Training from scratch is a separate research question and is not the default implementation plan for this product feature.

## Current machine receipt

Read-only Windows hardware inspection on 2026-10-28 reported an AMD Ryzen 5 5600X, 12 logical processors, approximately 23.9 GiB system memory and an AMD Radeon RX 6600. The virtual display adapter is not an inference device. GPU acceleration support and usable VRAM were not verified; do not infer them from the device name. There is no throughput measurement or defensible training-duration estimate yet.

## Isolation requirements for a future experiment

Use one dedicated, ignored root such as `private/experiments/local-titles/`. Keep its Python virtual environment, dependency lock, model snapshots, download caches, temporary files, training checkpoints, results and logs below that root. Redirect cache/temp locations for each child process, including Hugging Face, Torch, pip and the chosen environment manager. Keep an artifact manifest recording paths, sizes, source revisions and ownership.

Do not install Python packages globally, edit persistent user/system environment variables, change drivers, add services or reuse production credentials. A virtual environment separates dependencies; it is not an operating-system sandbox. Verify actual output locations before claiming the experiment leaves no files elsewhere. If a dependency requires external state, document it before using it.

Cleanup must stop experiment-owned processes first, verify the resolved root is inside the intended workspace, and remove only the recorded experiment paths. Preserve the production app, existing user models, account credentials and user documents. No cleanup command has been run as part of this assessment.

## Evidence required before training or integration

- A fixed, held-out set of Portuguese and English prompts, including long prompts, code, questions, accents and misleading instructions. Use synthetic or explicitly supplied material, not private chat history gathered automatically.
- Evaluate short, relevant titles in the user's language, preserving important identifiers without answering the prompt or inventing facts. A 36-character limit is a candidate product target, not a quality score.
- Measure cold-load time, warm title latency, peak/resident memory, downloaded/installed size and behavior while the main chat is active. Compare against deterministic extraction.
- If training is justified, measure a short pilot's actual examples/steps per second and memory use before estimating a full run. Report setup time separately from training and inference.
- Compare the held-out quality before/after adjustment; do not call memorized training examples a successful evaluation. Reject an adjustment that adds cost without a useful quality improvement.
- Confirm the exact weights/tokenizer/code licenses and required distribution notices before selecting a base.

Product integration, if later accepted, should generate once in the background after first send, preserve an immediate fallback, avoid blocking the main response and never overwrite a manual rename. An unavailable local model must retain the fallback instead of silently consuming a remote quota.

## Research leads, not selected models

Official Hugging Face model cards confirm that small pretrained instruction variants exist at 135M and 360M parameters. The SmolLM2 cards identify English and Apache-2.0; they do not prove Portuguese title quality or local training speed. These are examples to assess, not a benchmark result or a chosen dependency:

- https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct
- https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct

The public Codex TUI uses a separate structured title request with a 36-character output bound and prioritizes manual names. That is a useful behavioral reference, not proof that Codex desktop uses the identical implementation:

- https://github.com/openai/codex/blob/main/codex-rs/tui/src/app/thread_title.rs
