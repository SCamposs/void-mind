from __future__ import annotations

import hashlib
import json
import random
from collections import Counter
from collections.abc import Iterable
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Provenance(StrictModel):
    source: str = Field(min_length=1)
    license: str = Field(min_length=1)
    collected_at: str | None = None
    notes: str | None = None


class Message(StrictModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, value: str) -> str:
        normalized = value.replace("\r\n", "\n").replace("\r", "\n").strip()
        if not normalized:
            raise ValueError("message content cannot be blank")
        return normalized


class DatasetRecord(StrictModel):
    id: str = Field(min_length=1, max_length=160)
    privacy: Literal["public", "private", "restricted"] = "public"
    provenance: Provenance
    tags: list[str] = Field(default_factory=list)


class SFTConversation(DatasetRecord):
    kind: Literal["sft"] = "sft"
    messages: list[Message] = Field(min_length=2)

    @model_validator(mode="after")
    def validate_dialogue(self) -> SFTConversation:
        roles = [message.role for message in self.messages]
        if "user" not in roles or "assistant" not in roles:
            raise ValueError("SFT conversations require at least one user and assistant message")
        if roles[-1] != "assistant":
            raise ValueError("SFT conversations must end with an assistant message")
        return self


class PreferencePair(DatasetRecord):
    kind: Literal["preference"] = "preference"
    prompt: list[Message] = Field(min_length=1)
    chosen: str = Field(min_length=1)
    rejected: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_pair(self) -> PreferencePair:
        self.chosen = self.chosen.strip()
        self.rejected = self.rejected.strip()
        if not self.chosen or not self.rejected:
            raise ValueError("chosen and rejected responses cannot be blank")
        if self.chosen == self.rejected:
            raise ValueError("chosen and rejected responses must differ")
        return self


type Record = Annotated[SFTConversation | PreferencePair, Field(discriminator="kind")]
RECORD_ADAPTER = TypeAdapter(Record)


def read_jsonl(path: Path) -> list[Record]:
    records: list[Record] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            records.append(RECORD_ADAPTER.validate_json(line))
        except Exception as error:
            raise ValueError(f"{path}:{line_number}: {error}") from error
    if not records:
        raise ValueError(f"{path}: dataset is empty")
    ids = [record.id for record in records]
    duplicates = [record_id for record_id, count in Counter(ids).items() if count > 1]
    if duplicates:
        raise ValueError(f"duplicate record ids: {', '.join(sorted(duplicates))}")
    return records


def write_jsonl(records: Iterable[Record], path: Path, include_private: bool = False) -> int:
    selected = [record for record in records if include_private or record.privacy == "public"]
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(
        json.dumps(record.model_dump(mode="json"), ensure_ascii=False, sort_keys=True)
        for record in selected
    )
    path.write_text(payload + ("\n" if payload else ""), encoding="utf-8")
    return len(selected)


def semantic_fingerprint(record: Record) -> str:
    if isinstance(record, SFTConversation):
        semantic = {
            "kind": record.kind,
            "messages": [message.model_dump(mode="json") for message in record.messages],
        }
    else:
        semantic = {
            "kind": record.kind,
            "prompt": [message.model_dump(mode="json") for message in record.prompt],
            "chosen": record.chosen,
            "rejected": record.rejected,
        }
    canonical = json.dumps(semantic, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def deduplicate(records: Iterable[Record]) -> tuple[list[Record], list[str]]:
    unique: list[Record] = []
    removed: list[str] = []
    fingerprints: set[str] = set()
    for record in records:
        fingerprint = semantic_fingerprint(record)
        if fingerprint in fingerprints:
            removed.append(record.id)
            continue
        fingerprints.add(fingerprint)
        unique.append(record)
    return unique, removed


def contamination_ids(reference: Iterable[Record], candidate: Iterable[Record]) -> list[str]:
    reference_fingerprints = {semantic_fingerprint(record) for record in reference}
    return sorted(
        record.id for record in candidate if semantic_fingerprint(record) in reference_fingerprints
    )


def split_records(
    records: list[Record], eval_ratio: float = 0.2, seed: int = 42
) -> tuple[list[Record], list[Record]]:
    if not 0 < eval_ratio < 1:
        raise ValueError("eval_ratio must be between 0 and 1")
    ordered = sorted(records, key=lambda item: item.id)
    random.Random(seed).shuffle(ordered)
    if len(ordered) < 2:
        return ordered, []
    eval_count = min(len(ordered) - 1, max(1, round(len(ordered) * eval_ratio)))
    evaluation = sorted(ordered[:eval_count], key=lambda item: item.id)
    training = sorted(ordered[eval_count:], key=lambda item: item.id)
    return training, evaluation


def dataset_stats(records: list[Record]) -> dict[str, object]:
    kind_counts = Counter(record.kind for record in records)
    privacy_counts = Counter(record.privacy for record in records)
    unique, removed = deduplicate(records)
    message_count = sum(
        len(record.messages) if isinstance(record, SFTConversation) else len(record.prompt) + 2
        for record in records
    )
    return {
        "records": len(records),
        "kinds": dict(sorted(kind_counts.items())),
        "privacy": dict(sorted(privacy_counts.items())),
        "messages": message_count,
        "semantic_duplicates": len(removed),
        "unique_records": len(unique),
    }
