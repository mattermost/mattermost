"""Loading and validating rules.yml."""

import json
import re
from pathlib import Path

import jsonschema
import yaml

from .checks import CHECKS

CONFIG_DIR = Path(__file__).resolve().parents[2] / "release-agent"
RULES_PATH = CONFIG_DIR / "rules.yml"
SCHEMA_PATH = CONFIG_DIR / "rules.schema.json"
TEMPLATE_PATH = CONFIG_DIR / "playbook-template.yml"


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def template_items(template: dict) -> set[str]:
    return {
        item["title"]
        for checklist in template.get("checklists") or []
        for item in checklist.get("items") or []
    }


def problems(rules: dict, schema: dict, template_titles: set[str] | None = None) -> list[str]:
    """Everything wrong with ``rules``: schema errors first, then cross-field checks."""
    validator = jsonschema.Draft202012Validator(schema)
    errors = [f"{'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message}"
              for e in sorted(validator.iter_errors(rules), key=lambda e: list(e.absolute_path))]
    if errors:
        return errors
    milestones = rules["calendar"]["milestones"]
    seen = set()
    for rule in rules["rules"]:
        task = rule["task"]
        if task in seen:
            errors.append(f"{task}: task is listed twice")
        seen.add(task)
        _, pass_when = CHECKS[rule["type"]]
        if rule["pass_when"] != pass_when:
            errors.append(f"{task}: a {rule['type']} check passes when {pass_when!r}, not {rule['pass_when']!r}")
        anchor = re.fullmatch(r"([a-z][a-z0-9_]*)([-+]\d+)?", rule["due"])
        if anchor and anchor.group(1) not in milestones:
            errors.append(f"{task}: due {rule['due']!r} names no calendar milestone")
        if template_titles is not None and rule["playbook_item"] is not None \
                and rule["playbook_item"] not in template_titles:
            errors.append(f"{task}: playbook_item {rule['playbook_item']!r} is not in the playbook template")
    return errors


def load_rules(path: Path = RULES_PATH) -> dict:
    rules = load_yaml(path)
    with open(SCHEMA_PATH, encoding="utf-8") as handle:
        schema = json.load(handle)
    found = problems(rules, schema, template_items(load_yaml(TEMPLATE_PATH)))
    if found:
        raise ValueError("Invalid release agent rules:\n" + "\n".join(f"  - {p}" for p in found))
    return rules
