"""Message templates and the wording rules every Hub post, reply and status line follows.

Templates are files in .github/release-agent/templates/actions/, filled with str.format_map.
Rules (checked by ``accessibility_problems`` in the tests):
  - links have descriptive text, never a bare URL;
  - the status word comes first ("Done", "Waiting", "Stopped", "Failed", ...);
  - no tables;
  - times are UTC with the date in words: "Tuesday, November 24 at 14:00 UTC".
"""

import re
from datetime import date, datetime
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "release-agent" / "templates" / "actions"
STATUS_WORDS = ("Cutting", "Done", "Waiting", "Stopped", "Failed", "Started", "Proposal", "Dry run", "Not due yet",
                "Not needed", "Closed", "Needs attention", "Refused")


def render(name: str, **values) -> str:
    text = (TEMPLATES_DIR / f"{name}.md").read_text(encoding="utf-8").strip()
    return text.format_map(values).strip()


def when(moment: datetime) -> str:
    """Tuesday, November 24 at 14:00 UTC"""
    return f"{moment:%A}, {moment:%B} {moment.day} at {moment:%H:%M} UTC"


def day_words(day: date) -> str:
    """Tuesday, November 24"""
    return f"{day:%A}, {day:%B} {day.day}"


def time_only(moment: datetime) -> str:
    return f"{moment:%H:%M} UTC"


def link(text: str, url: str) -> str:
    return f"[{text}]({url})" if url else text


def bullet_list(lines: list[str], limit: int = 50) -> str:
    shown = [f"- {line}" for line in lines[:limit]]
    if len(lines) > limit:
        shown.append(f"- …and {len(lines) - limit} more")
    return "\n".join(shown)


BARE_URL = re.compile(r"(?<!\]\()(?<!\[)(?<![\w/])https?://")
TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$", re.MULTILINE)
CLOCK = re.compile(r"\b\d{1,2}:\d{2}\b(?! UTC)")


def accessibility_problems(text: str, status_first: bool = True) -> list[str]:
    problems = []
    if BARE_URL.search(text):
        problems.append("bare URL")
    if TABLE_ROW.search(text):
        problems.append("table")
    if CLOCK.search(text):
        problems.append("time without UTC")
    if status_first and not text.lstrip("#* ").startswith(STATUS_WORDS):
        problems.append("status word not first")
    for match in re.finditer(r"\[([^\]]*)\]\(", text):
        if match.group(1).startswith("http") or not match.group(1).strip():
            problems.append("link text is a URL or empty")
    return problems
