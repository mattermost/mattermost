#!/usr/bin/env python3
"""Map changed file paths to Playwright specs via e2e-tests/.qa/spec-map.yml."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore


DEFAULT_SPEC_MAP = Path("e2e-tests/.qa/spec-map.yml")
MAX_SPECS = 20


def load_spec_map(path: Path = DEFAULT_SPEC_MAP) -> list[dict]:
    if not path.is_file():
        return []
    if yaml is None:
        return _parse_minimal_yaml(path.read_text())
    data = yaml.safe_load(path.read_text()) or {}
    return data.get("mappings", [])


def _parse_minimal_yaml(text: str) -> list[dict]:
    mappings: list[dict] = []
    current: dict | None = None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- prefix:"):
            if current:
                mappings.append(current)
            current = {"prefix": stripped.split(":", 1)[1].strip().strip('"').strip("'"), "specs": []}
        elif stripped.startswith("- ") and current is not None and "specs" in current:
            spec = stripped[2:].strip().strip('"').strip("'")
            current["specs"].append(spec)
    if current:
        mappings.append(current)
    return mappings


def map_changed_files(changed_files: Iterable[str], spec_map_path: Path = DEFAULT_SPEC_MAP) -> list[str]:
    mappings = load_spec_map(spec_map_path)
    specs: list[str] = []
    for filepath in changed_files:
        for entry in mappings:
            prefix = entry.get("prefix", "")
            if prefix and filepath.startswith(prefix):
                for spec in entry.get("specs", []):
                    if spec not in specs:
                        specs.append(spec)
    return specs[:MAX_SPECS]
