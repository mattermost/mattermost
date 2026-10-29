"""Templates in ``.github/release-docs/templates/``, filled with ``{{name}}`` placeholders."""

import os
import re

TEMPLATES_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "release-docs", "templates"))
PLACEHOLDER = re.compile(r"\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}")


def load(name: str) -> str:
    with open(os.path.join(TEMPLATES_DIR, name), encoding="utf-8") as f:
        return f.read()


def placeholders(template: str) -> set[str]:
    return set(PLACEHOLDER.findall(template))


def fill(template: str, values: dict) -> str:
    """``template`` with every placeholder replaced. A missing or unused value raises.

    Strict both ways so a renamed placeholder can't silently leave ``{{x}}`` in a PR or
    drop a value.
    """
    names = placeholders(template)
    missing = sorted(names - values.keys())
    unused = sorted(values.keys() - names)
    if missing or unused:
        raise KeyError(f"template placeholders missing values {missing}, values without placeholders {unused}")
    return PLACEHOLDER.sub(lambda m: str(values[m.group(1)]), template)


def render(name: str, values: dict) -> str:
    return fill(load(name), values)
