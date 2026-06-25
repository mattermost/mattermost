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


def load_spec_map(path: Path = DEFAULT_SPEC_MAP) -> dict:
    if not path.is_file():
        return {"mappings": [], "sev1_smoke": [], "tag_specs": {}}
    if yaml is None:
        return {"mappings": _parse_minimal_yaml(path.read_text()), "sev1_smoke": [], "tag_specs": {}}
    data = yaml.safe_load(path.read_text()) or {}
    data.setdefault("mappings", [])
    data.setdefault("sev1_smoke", [])
    data.setdefault("tag_specs", {})
    return data


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
    data = load_spec_map(spec_map_path)
    mappings = data.get("mappings", [])
    tag_specs = data.get("tag_specs", {})
    specs: list[str] = []

    for filepath in changed_files:
        for entry in mappings:
            prefix = entry.get("prefix", "")
            if prefix and filepath.startswith(prefix):
                for spec in entry.get("specs", []):
                    if spec not in specs:
                        specs.append(spec)
        lower = filepath.lower()
        for tag, tag_spec_list in tag_specs.items():
            if tag in lower:
                for spec in tag_spec_list:
                    if spec not in specs:
                        specs.append(spec)

    return specs[:MAX_SPECS]


def smoke_specs(spec_map_path: Path = DEFAULT_SPEC_MAP) -> list[str]:
    data = load_spec_map(spec_map_path)
    return list(data.get("sev1_smoke", []))[:5]
