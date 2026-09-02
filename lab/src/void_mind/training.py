from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TrainConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_model: str = Field(min_length=1)
    train_dataset: Path
    eval_dataset: Path
    output_dir: Path
    method: Literal["lora", "qlora"] = "qlora"
    seed: int = 42
    epochs: float = Field(default=1.0, gt=0)
    learning_rate: float = Field(default=2e-4, gt=0)
    rank: int = Field(default=16, ge=1)
    alpha: int = Field(default=32, ge=1)
    batch_size: int = Field(default=1, ge=1)
    gradient_accumulation_steps: int = Field(default=8, ge=1)


def load_train_config(path: Path) -> TrainConfig:
    return TrainConfig.model_validate_json(path.read_text(encoding="utf-8"))


def dry_run(config: TrainConfig) -> dict[str, object]:
    required_modules = ["transformers", "datasets", "peft", "trl", "accelerate"]
    modules = {module: importlib.util.find_spec(module) is not None for module in required_modules}
    return {
        "valid": True,
        "method": config.method,
        "seed": config.seed,
        "paths": {
            "train_dataset": config.train_dataset.exists(),
            "eval_dataset": config.eval_dataset.exists(),
            "output_parent": config.output_dir.parent.exists(),
        },
        "optional_dependencies": modules,
        "ready_to_train": all(modules.values())
        and config.train_dataset.exists()
        and config.eval_dataset.exists(),
        "config": json.loads(config.model_dump_json()),
    }


def run_tool(tool: str, arguments: list[str], execute: bool) -> dict[str, object]:
    resolved = shutil.which(tool)
    command = [resolved or tool, *arguments]
    if not execute:
        return {"executed": False, "available": resolved is not None, "command": command}
    if resolved is None:
        raise FileNotFoundError(f"required tool is not available on PATH: {tool}")
    completed = subprocess.run(command, check=False, text=True, capture_output=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or f"{tool} exited with {completed.returncode}")
    return {
        "executed": True,
        "available": True,
        "command": command,
        "stdout": completed.stdout.strip(),
    }
