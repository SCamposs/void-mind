from pathlib import Path

from void_mind.evaluation import evaluate, load_suite, read_outputs


def test_eval_is_reproducible_with_fixed_inputs() -> None:
    suite = load_suite(Path("lab/samples/evals/general-v1.json"))
    outputs = read_outputs(Path("lab/samples/evals/a0-responses.jsonl"))
    first = evaluate(suite, outputs, model="A0", seed=42, created_at="2026-01-01T00:00:00Z")
    second = evaluate(suite, outputs, model="A0", seed=42, created_at="2026-01-01T00:00:00Z")
    assert first == second
    assert first.score == 1
