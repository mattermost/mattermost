"""Loading and validating rules.yml."""

import json
import re
from datetime import date
from pathlib import Path

import jsonschema
import yaml

from .checks import CHECKS
from .playbook import normalize, title_matches

CONFIG_DIR = Path(__file__).resolve().parents[2] / "release-agent"
RULES_PATH = CONFIG_DIR / "rules.yml"
SCHEMA_PATH = CONFIG_DIR / "rules.schema.json"
TEMPLATE_PATH = CONFIG_DIR / "playbook-template.yml"


class UniqueKeyLoader(yaml.SafeLoader):
    """SafeLoader that refuses a mapping with the same key twice, which safe_load would
    quietly resolve to the last one (so a rule could tick another item than it reads)."""

    def construct_mapping(self, node, deep=False):
        seen = set()
        for key_node, _ in node.value:
            if key_node.tag == "tag:yaml.org,2002:merge":
                continue  # `<<: *anchor`, expanded by the parent class
            key = self.construct_object(key_node, deep=deep)
            if key in seen:
                raise yaml.constructor.ConstructorError(None, None, f"duplicate key {key!r}", key_node.start_mark)
            seen.add(key)
        return super().construct_mapping(node, deep)


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as handle:
        return yaml.load(handle, Loader=UniqueKeyLoader)  # a SafeLoader subclass


def template_items(template: dict) -> set[str]:
    return {
        item["title"]
        for checklist in template.get("checklists") or []
        for item in checklist.get("items") or []
    }


# Query keys a check reads without a default.
REQUIRED_QUERY = {
    "open_release_items": ("jql",),
    "new_regressions": ("jql",),
    "resolved_tickets": ("jql",),
    "cherry_picks_to_label": ("jql", "repos", "labels", "milestone", "base_branch"),
    "notice_txt": ("repo", "author", "title", "milestone"),
    "cherry_picks": ("repos", "labels"),
    "version_go_prs": ("repo", "author", "created_since"),
    "changelog_labels": ("repos", "labels"),
    "holidays_page": ("month", "heading", "min_dates"),
    "e2e_results": ("match_any",),
    "release_tags": ("repos",),
    "changelog_pr": ("state", "repo", "branch", "base_branch", "live_url"),
    "changelog_migrations": ("repo", "branch", "base_branch", "migrations_path"),
}
CHANGELOG_PR_STATES = ("exists", "ready", "merged")


def problems(rules: dict, schema: dict, template_titles: set[str] | None = None) -> list[str]:
    """Everything wrong with ``rules``: schema errors first, then cross-field checks."""
    validator = jsonschema.Draft202012Validator(schema)
    errors = [f"{'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message}"
              for e in sorted(validator.iter_errors(rules), key=lambda e: list(e.absolute_path))]
    if errors:
        return errors
    milestones = rules["calendar"]["milestones"]
    known_items = list(template_titles) if template_titles is not None else None
    seen = set()
    for rule in rules["rules"]:
        task = rule["task"]
        if task in seen:
            errors.append(f"{task}: task is listed twice")
        seen.add(task)
        _, pass_when = CHECKS[rule["type"]]
        if rule["pass_when"] != pass_when:
            errors.append(f"{task}: a {rule['type']} check passes when {pass_when!r}, not {rule['pass_when']!r}")
        query = rule.get("query") or {}
        for key in REQUIRED_QUERY.get(rule["type"], ()):
            if key not in query:
                errors.append(f"{task}: a {rule['type']} check needs query.{key}")
        if rule["type"] == "changelog_pr" and query.get("state") not in CHANGELOG_PR_STATES:
            errors.append(f"{task}: a changelog_pr check needs query.state to be one of {', '.join(CHANGELOG_PR_STATES)}")
        if rule["type"] == "release_tags" and not ({"tag", "tag_prefix"} & query.keys()):
            errors.append(f"{task}: a release_tags check needs query.tag or query.tag_prefix")
        anchor = re.fullmatch(r"([a-z][a-z0-9_]*)([-+]\d+)?", rule["due"])
        if anchor and anchor.group(1) not in milestones:
            errors.append(f"{task}: due {rule['due']!r} names no calendar milestone")
        if known_items is not None and rule["playbook_item"] is not None \
                and not any(title_matches(known, rule["playbook_item"]) for known in known_items):
            errors.append(f"{task}: playbook_item {rule['playbook_item']!r} is not in the playbook template")
    for day in rules.get("holidays", []):
        try:
            date.fromisoformat(day)
        except ValueError:
            errors.append(f"holidays: {day!r} is not a calendar date")
    return errors


def load_rules(path: Path = RULES_PATH) -> dict:
    rules = load_yaml(path)
    with open(SCHEMA_PATH, encoding="utf-8") as handle:
        schema = json.load(handle)
    found = problems(rules, schema, template_items(load_yaml(TEMPLATE_PATH)))
    if found:
        raise ValueError("Invalid release agent rules:\n" + "\n".join(f"  - {p}" for p in found))
    return rules
