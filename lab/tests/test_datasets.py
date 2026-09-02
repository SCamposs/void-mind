from pathlib import Path

from void_mind.datasets import (
    SFTConversation,
    contamination_ids,
    deduplicate,
    read_jsonl,
    split_records,
)

SAMPLE = Path("lab/samples/datasets/tiny-conversations.jsonl")


def test_sample_dataset_validates() -> None:
    records = read_jsonl(SAMPLE)
    assert len(records) == 3
    assert isinstance(records[0], SFTConversation)


def test_deduplicate_uses_semantic_content() -> None:
    records = read_jsonl(SAMPLE)
    duplicate = records[0].model_copy(update={"id": "different-id"})
    unique, removed = deduplicate([*records, duplicate])
    assert len(unique) == 3
    assert removed == ["different-id"]


def test_split_is_reproducible() -> None:
    records = read_jsonl(SAMPLE)
    first = split_records(records, eval_ratio=0.34, seed=7)
    second = split_records(records, eval_ratio=0.34, seed=7)
    assert [[record.id for record in group] for group in first] == [
        [record.id for record in group] for group in second
    ]
    assert len(first[0]) == 2
    assert len(first[1]) == 1


def test_contamination_finds_semantic_overlap() -> None:
    records = read_jsonl(SAMPLE)
    candidate = records[0].model_copy(update={"id": "eval-copy"})
    assert contamination_ids(records, [candidate]) == ["eval-copy"]
