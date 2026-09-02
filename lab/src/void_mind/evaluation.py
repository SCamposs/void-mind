from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EvalCase(StrictModel):
    id: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    expected_contains: list[str] = Field(default_factory=list)
    forbidden_contains: list[str] = Field(default_factory=list)


class EvalSuite(StrictModel):
    schema_version: str = "1.0.0"
    name: str = Field(min_length=1)
    cases: list[EvalCase] = Field(min_length=1)


class CaseResult(StrictModel):
    id: str
    passed: bool
    missing: list[str]
    forbidden_hits: list[str]
    output: str


class EvalResult(StrictModel):
    schema_version: str = "1.0.0"
    suite: str
    model: str
    seed: int
    created_at: str
    passed: int
    total: int
    score: float
    cases: list[CaseResult]


def load_suite(path: Path) -> EvalSuite:
    return EvalSuite.model_validate_json(path.read_text(encoding="utf-8"))


def read_outputs(path: Path) -> dict[str, str]:
    outputs: dict[str, str] = {}
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if (
            not isinstance(value, dict)
            or not isinstance(value.get("id"), str)
            or not isinstance(value.get("output"), str)
        ):
            raise ValueError(f"{path}:{line_number}: expected an object with string id and output")
        outputs[value["id"]] = value["output"]
    return outputs


def evaluate(
    suite: EvalSuite,
    outputs: dict[str, str],
    model: str,
    seed: int,
    created_at: str | None = None,
) -> EvalResult:
    case_results: list[CaseResult] = []
    for case in suite.cases:
        output = outputs.get(case.id, "")
        normalized = output.casefold()
        missing = [value for value in case.expected_contains if value.casefold() not in normalized]
        forbidden_hits = [
            value for value in case.forbidden_contains if value.casefold() in normalized
        ]
        case_results.append(
            CaseResult(
                id=case.id,
                passed=bool(output) and not missing and not forbidden_hits,
                missing=missing,
                forbidden_hits=forbidden_hits,
                output=output,
            )
        )
    passed = sum(result.passed for result in case_results)
    total = len(case_results)
    return EvalResult(
        suite=suite.name,
        model=model,
        seed=seed,
        created_at=created_at or datetime.now(UTC).isoformat(),
        passed=passed,
        total=total,
        score=passed / total if total else 0,
        cases=case_results,
    )


def save_result(result: EvalResult, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(result.model_dump_json(indent=2) + "\n", encoding="utf-8")


def compare_results(left: EvalResult, right: EvalResult) -> dict[str, object]:
    left_cases = {case.id: case for case in left.cases}
    right_cases = {case.id: case for case in right.cases}
    ids = sorted(set(left_cases) | set(right_cases))

    def passed(cases: dict[str, CaseResult], case_id: str) -> bool:
        result = cases.get(case_id)
        return result.passed if result else False

    improved = [
        case_id
        for case_id in ids
        if not passed(left_cases, case_id) and passed(right_cases, case_id)
    ]
    regressed = [
        case_id
        for case_id in ids
        if passed(left_cases, case_id) and not passed(right_cases, case_id)
    ]
    return {
        "left": left.model,
        "right": right.model,
        "left_score": left.score,
        "right_score": right.score,
        "delta": right.score - left.score,
        "improved": improved,
        "regressed": regressed,
    }
