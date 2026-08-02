from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

import typer

from .datasets import (
    contamination_ids,
    dataset_stats,
    deduplicate,
    read_jsonl,
    split_records,
    write_jsonl,
)
from .evaluation import EvalResult, compare_results, evaluate, load_suite, read_outputs, save_result
from .manifest import (
    LineageEntry,
    ModelHashes,
    ModelManifest,
    ModelSource,
    file_sha256,
    load_manifest,
    save_manifest,
)
from .training import dry_run, load_train_config, run_tool

app = typer.Typer(help="VOID Mind local model-lab toolkit.", no_args_is_help=True)
dataset_app = typer.Typer(help="Validate and prepare SFT or preference datasets.")
eval_app = typer.Typer(help="Run deterministic fixed-suite evaluation.")
manifest_app = typer.Typer(help="Create and validate VOID Mind manifests.")
train_app = typer.Typer(help="Validate optional LoRA or QLoRA training configuration.")
artifact_app = typer.Typer(help="Preview or run external artifact tools when installed.")
app.add_typer(dataset_app, name="dataset")
app.add_typer(eval_app, name="eval")
app.add_typer(manifest_app, name="manifest")
app.add_typer(train_app, name="train")
app.add_typer(artifact_app, name="artifact")


def print_json(value: object) -> None:
    typer.echo(json.dumps(value, indent=2, ensure_ascii=False, default=str))


@dataset_app.command("validate")
def dataset_validate(source: Path) -> None:
    records = read_jsonl(source)
    print_json({"valid": True, **dataset_stats(records)})


@dataset_app.command("stats")
def dataset_statistics(source: Path) -> None:
    print_json(dataset_stats(read_jsonl(source)))


@dataset_app.command("normalize")
def dataset_normalize(
    source: Path,
    output: Path,
    include_private: Annotated[
        bool, typer.Option(help="Include private or restricted rows.")
    ] = False,
) -> None:
    count = write_jsonl(read_jsonl(source), output, include_private=include_private)
    print_json({"written": count, "output": output})


@dataset_app.command("deduplicate")
def dataset_deduplicate(source: Path, output: Path) -> None:
    records, removed = deduplicate(read_jsonl(source))
    count = write_jsonl(records, output, include_private=True)
    print_json({"written": count, "removed_ids": removed, "output": output})


@dataset_app.command("contamination")
def dataset_contamination(reference: Path, candidate: Path) -> None:
    overlaps = contamination_ids(read_jsonl(reference), read_jsonl(candidate))
    print_json({"contaminated": bool(overlaps), "overlapping_candidate_ids": overlaps})
    if overlaps:
        raise typer.Exit(code=2)


@dataset_app.command("split")
def dataset_split(
    source: Path,
    output_dir: Path,
    eval_ratio: Annotated[float, typer.Option(min=0.01, max=0.99)] = 0.2,
    seed: int = 42,
) -> None:
    records = read_jsonl(source)
    training, evaluation = split_records(records, eval_ratio=eval_ratio, seed=seed)
    train_path = output_dir / "train.jsonl"
    eval_path = output_dir / "eval.jsonl"
    write_jsonl(training, train_path, include_private=True)
    write_jsonl(evaluation, eval_path, include_private=True)
    print_json(
        {"seed": seed, "train": len(training), "eval": len(evaluation), "output_dir": output_dir}
    )


@dataset_app.command("export")
def dataset_export(
    source: Path,
    output: Path,
    include_private: Annotated[
        bool, typer.Option(help="Explicitly export non-public rows.")
    ] = False,
) -> None:
    count = write_jsonl(read_jsonl(source), output, include_private=include_private)
    print_json({"written": count, "private_included": include_private, "output": output})


@eval_app.command("run")
def eval_run(
    suite: Path,
    outputs: Path,
    result: Path,
    model: Annotated[str, typer.Option(help="Model version or comparison label.")],
    seed: int = 42,
) -> None:
    evaluated = evaluate(load_suite(suite), read_outputs(outputs), model=model, seed=seed)
    save_result(evaluated, result)
    print_json(
        {
            "score": evaluated.score,
            "passed": evaluated.passed,
            "total": evaluated.total,
            "result": result,
        }
    )


@eval_app.command("compare")
def eval_compare(left: Path, right: Path) -> None:
    left_result = EvalResult.model_validate_json(left.read_text(encoding="utf-8"))
    right_result = EvalResult.model_validate_json(right.read_text(encoding="utf-8"))
    print_json(compare_results(left_result, right_result))


@manifest_app.command("validate")
def manifest_validate(source: Path, model_file: Path | None = None) -> None:
    manifest = load_manifest(source)
    hash_matches = None if model_file is None else file_sha256(model_file) == manifest.hashes.sha256
    print_json({"valid": True, "version": manifest.version, "hash_matches": hash_matches})


@manifest_app.command("create")
def manifest_create(
    output: Path,
    model_file: Path,
    name: Annotated[str, typer.Option()],
    version: Annotated[str, typer.Option()],
    base: Annotated[str, typer.Option()],
    source: Annotated[str, typer.Option()],
    license_name: Annotated[str, typer.Option("--license")],
    quantization: Annotated[str, typer.Option()],
    language: Annotated[list[str], typer.Option()],
    context: Annotated[int, typer.Option()],
    chat_template: Annotated[str, typer.Option()],
) -> None:
    manifest = ModelManifest(
        name=name,
        version=version,
        base=base,
        source=ModelSource(uri=source, license=license_name),
        quantization=quantization,
        languages=language,
        context=context,
        chat_template=chat_template,
        training_lineage=[LineageEntry(name=base, version="upstream", relation="base")],
        hashes=ModelHashes(sha256=file_sha256(model_file)),
        created_at=datetime.now(UTC),
    )
    save_manifest(manifest, output)
    print_json({"created": output, "version": manifest.version, "sha256": manifest.hashes.sha256})


@train_app.command("dry-run")
def train_dry_run(config: Path) -> None:
    print_json(dry_run(load_train_config(config)))


@artifact_app.command("merge")
def artifact_merge(adapter: Path, model: Path, output: Path, run: bool = False) -> None:
    print_json(
        run_tool(
            "llama-export-lora", ["-m", str(model), "-l", str(adapter), "-o", str(output)], run
        )
    )


@artifact_app.command("export")
def artifact_export(model_dir: Path, output: Path, run: bool = False) -> None:
    print_json(run_tool("convert_hf_to_gguf.py", [str(model_dir), "--outfile", str(output)], run))


@artifact_app.command("quantize")
def artifact_quantize(model: Path, output: Path, quantization: str, run: bool = False) -> None:
    print_json(run_tool("llama-quantize", [str(model), str(output), quantization], run))


if __name__ == "__main__":
    app()
