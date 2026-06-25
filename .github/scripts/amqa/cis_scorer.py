#!/usr/bin/env python3
"""Fallback CIS scoring from changed file paths when CodeRabbit is absent."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

CONFIG_PATH = Path(__file__).resolve().parents[2] / "amqa" / "cis_config.yml"
DEFAULT_CONFIG = CONFIG_PATH


def load_config(path: Path = DEFAULT_CONFIG) -> dict:
    if yaml is None or not path.is_file():
        return {
            "weights": {
                "user_visible_ui": 30,
                "auth_security": 25,
                "data_migration": 20,
                "api_websocket": 15,
                "config_surface": 10,
                "pure_refactor_tests_docs": -20,
            },
            "path_patterns": {},
        }
    return yaml.safe_load(path.read_text()) or {}


def score_paths(changed_files: Iterable[str], config: dict | None = None) -> int:
    cfg = config or load_config()
    weights = cfg.get("weights", {
        "user_visible_ui": 30,
        "auth_security": 25,
        "data_migration": 20,
        "api_websocket": 15,
        "config_surface": 10,
        "pure_refactor_tests_docs": -20,
    })
    patterns = cfg.get("path_patterns") or {
        "user_visible_ui": ["^webapp/channels/src/", "^webapp/platform/"],
        "auth_security": ["login", "saml", "permission", "session"],
        "data_migration": ["\\.up\\.sql$", "migrations/"],
        "api_websocket": ["server/channels/api4/", "websocket"],
        "config_surface": ["server/public/model/config.go"],
        "pure_refactor_tests_docs": ["_test\\.go$", "_test\\.tsx$", "^e2e-tests/"],
    }
    score = 0
    matched_categories: set[str] = set()

    for filepath in changed_files:
        lower = filepath.lower()
        for category, pats in patterns.items():
            for pat in pats:
                if re.search(pat, lower if pat.startswith("^") else filepath):
                    matched_categories.add(category)
                    break

    for category in matched_categories:
        score += weights.get(category, 0)

    if matched_categories == {"pure_refactor_tests_docs"}:
        score = max(0, score)

    return max(0, min(100, score))


def risk_tier(cis: int) -> str:
    if cis >= 90:
        return "critical"
    if cis >= 70:
        return "high"
    if cis >= 30:
        return "medium"
    return "low"


def infer_blast_radius(changed_files: Iterable[str]) -> list[str]:
    radius: list[str] = []
    joined = "\n".join(changed_files).lower()
    checks = {
        "permissions": ["permission", "role", "abac", "access_control"],
        "mobile_web": ["mobile", "responsive"],
        "websocket": ["websocket", "ws_"],
        "migrations": [".up.sql", "migration"],
        "admin_console": ["admin_console", "system_console"],
    }
    for area, keywords in checks.items():
        if any(k in joined for k in keywords):
            radius.append(area)
    return radius
