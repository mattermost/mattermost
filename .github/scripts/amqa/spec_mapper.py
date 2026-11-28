#!/usr/bin/env python3
"""Map changed file paths to Playwright specs via e2e-tests/.qa/spec-map.yml."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SPEC_MAP = REPO_ROOT / "e2e-tests" / ".qa" / "spec-map.yml"
MAX_SPECS = 20


def load_spec_map(path: Path | None = None) -> dict:
    path = path or DEFAULT_SPEC_MAP
    if not path.is_file():
        return {"mappings": [], "sev1_smoke": [], "tag_specs": {}}
    if yaml is None:
        return _parse_minimal_spec_map(path.read_text())
    data = yaml.safe_load(path.read_text()) or {}
    data.setdefault("mappings", [])
    data.setdefault("sev1_smoke", [])
    data.setdefault("tag_specs", {})
    return data


def _parse_minimal_spec_map(text: str) -> dict:
    mappings: list[dict] = []
    sev1_smoke: list[str] = []
    tag_specs: dict[str, list[str]] = {}
    current: dict | None = None
    section = "mappings"
    current_tag: str | None = None

    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "sev1_smoke:":
            section = "sev1_smoke"
            current = None
            current_tag = None
            continue
        if stripped == "tag_specs:":
            section = "tag_specs"
            current = None
            current_tag = None
            continue
        if stripped == "mappings:":
            section = "mappings"
            current = None
            current_tag = None
            continue

        if section == "mappings":
            if stripped.startswith("- prefix:"):
                if current:
                    mappings.append(current)
                current = {"prefix": stripped.split(":", 1)[1].strip().strip('"').strip("'"), "specs": []}
            elif stripped.startswith("- ") and current is not None:
                spec = stripped[2:].strip().strip('"').strip("'")
                current["specs"].append(spec)
        elif section == "sev1_smoke" and stripped.startswith("- "):
            sev1_smoke.append(stripped[2:].strip().strip('"').strip("'"))
        elif section == "tag_specs":
            if stripped.endswith(":") and not stripped.startswith("-"):
                current_tag = stripped[:-1].strip()
                tag_specs.setdefault(current_tag, [])
            elif stripped.startswith("- ") and current_tag:
                tag_specs[current_tag].append(stripped[2:].strip().strip('"').strip("'"))

    if current:
        mappings.append(current)
    return {"mappings": mappings, "sev1_smoke": sev1_smoke, "tag_specs": tag_specs}


def _parse_minimal_yaml(text: str) -> list[dict]:
    return _parse_minimal_spec_map(text)["mappings"]


def map_changed_files(changed_files: Iterable[str], spec_map_path: Path | None = None) -> list[str]:
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


def smoke_specs(spec_map_path: Path | None = None) -> list[str]:
    data = load_spec_map(spec_map_path)
    return list(data.get("sev1_smoke", []))[:5]
