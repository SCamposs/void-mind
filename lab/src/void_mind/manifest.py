from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LineageEntry(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    version: str = Field(min_length=1, max_length=80)
    relation: Literal["base", "fine_tuned_from", "merged_from", "quantized_from"]
    manifest_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    dataset_refs: list[str] = Field(default_factory=list)


class ModelHashes(StrictModel):
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class ModelSource(StrictModel):
    uri: str = Field(min_length=1, max_length=500)
    license: str = Field(min_length=1, max_length=120)


class DatasetReference(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    version: str = Field(min_length=1, max_length=80)
    license: str = Field(min_length=1, max_length=120)
    sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")


class TrainingStage(StrictModel):
    type: Literal["continued_pretraining", "sft", "preference", "merge", "quantization"]
    config_ref: str | None = Field(default=None, max_length=240)
    seed: int | None = None


class AdapterReference(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    version: str = Field(min_length=1, max_length=80)
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class EvaluationReference(StrictModel):
    suite: str = Field(min_length=1, max_length=160)
    version: str = Field(min_length=1, max_length=80)
    score: float = Field(ge=0, le=1)
    result_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class ModelManifest(StrictModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    name: str = Field(min_length=1, max_length=120)
    version: str = Field(pattern=r"^A(?:0|[1-9][0-9]*)$")
    base: str = Field(min_length=1, max_length=240)
    source: ModelSource
    format: Literal["GGUF"] = "GGUF"
    quantization: str = Field(min_length=1, max_length=64)
    languages: list[str] = Field(min_length=1)
    context: int = Field(ge=256, le=1_048_576)
    chat_template: str = Field(min_length=1, max_length=120)
    training_lineage: list[LineageEntry] = Field(default_factory=list)
    training_datasets: list[DatasetReference] = Field(default_factory=list)
    training_stages: list[TrainingStage] = Field(default_factory=list)
    adapters: list[AdapterReference] = Field(default_factory=list)
    evaluations: list[EvaluationReference] = Field(default_factory=list)
    hashes: ModelHashes
    created_by: Literal["SCamposs"] = "SCamposs"
    created_at: datetime

    @field_validator("languages")
    @classmethod
    def unique_languages(cls, value: list[str]) -> list[str]:
        cleaned = [language.strip() for language in value]
        if any(len(language) < 2 for language in cleaned):
            raise ValueError("languages must contain non-empty language identifiers")
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("languages must be unique")
        return cleaned


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> ModelManifest:
    return ModelManifest.model_validate_json(path.read_text(encoding="utf-8"))


def save_manifest(manifest: ModelManifest, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
