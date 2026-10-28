"""Server release milestones from the Release Dates calendar's ICS feed."""

import re
from dataclasses import dataclass
from datetime import date, datetime

from .versions import Version

MILESTONES = (
    ("branch_cut", "Release Branch Cut"),
    ("feature_complete", "Feature Complete"),
    ("code_freeze", "Code Freeze"),
    ("final_build", "Final Release Build Cut"),
    ("release_day", "Release Day"),
)
VERSION_IN_TITLE = re.compile(r"(?<![\w.])v?(\d+)\.(\d+)(?:\.(\d+))?(?![\w.])")
# "v12.1 & Mobile v2.46 Code Freeze": a version right after Mobile or Desktop isn't a server one.
NOT_SERVER = re.compile(r"\b(?:mobile|desktop)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class Event:
    summary: str
    start: date
    time: str = ""  # "14:00 UTC" for a timed event, empty for an all-day one


def _unfold(text: str) -> list[str]:
    lines = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def _unescape(value: str) -> str:
    return re.sub(r"\\([\\;,nN])", lambda m: " " if m.group(1) in "nN" else m.group(1), value)


def _start(params: str, value: str) -> tuple[date, str]:
    value = value.strip()
    day = datetime.strptime(value[:8], "%Y%m%d").date()
    if "T" not in value:
        return day, ""
    zone = "UTC" if value.endswith("Z") else (re.search(r"TZID=([^;:]+)", params) or [None, ""])[1]
    return day, f"{value[9:11]}:{value[11:13]} {zone}".strip()


def parse_ics(text: str) -> list[Event]:
    events, current = [], None
    for line in _unfold(text):
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            if current and current.get("SUMMARY") and current.get("DTSTART"):
                day, time = _start(*current["DTSTART"])
                events.append(Event(" ".join(_unescape(current["SUMMARY"][1]).split()), day, time))
            current = None
        elif current is not None and ":" in line:
            name, value = line.split(":", 1)
            key, _, params = name.partition(";")
            current[key.upper()] = (params, value)
    return events


def server_lines(summary: str) -> list[tuple[int, int]]:
    """Server ``(major, minor)`` lines a title names; Mobile, Desktop and dot releases are left out."""
    found = []
    for match in VERSION_IN_TITLE.finditer(summary):
        if NOT_SERVER.search(summary[:match.start()]) or int(match.group(3) or 0):
            continue
        found.append((int(match.group(1)), int(match.group(2))))
    return found


def milestones(events: list[Event]) -> dict:
    """``{(major, minor): {milestone key: Event}}``; a repeated milestone keeps the later event."""
    releases = {}
    for event in events:
        key = next((k for k, title in MILESTONES if title.lower() in event.summary.lower()), None)
        if not key:
            continue
        for line in server_lines(event.summary):
            current = releases.setdefault(line, {}).get(key)
            if current is None or event.start > current.start:
                releases[line][key] = event
    return releases


def release_day(events: list[Event], version: Version) -> date | None:
    event = milestones(events).get(version.line, {}).get("release_day")
    return event.start if event else None


def next_releases(events: list[Event], after: Version, count: int = 2) -> list[tuple[Version, dict]]:
    """The ``count`` server releases after ``after`` that the calendar has a Release Day for."""
    found = sorted((Version(*line), ms) for line, ms in milestones(events).items()
                   if line > after.line and "release_day" in ms)
    return found[:count]


def fix_version(version: Version, day: date) -> str:
    """The Jira fix version, ``v12.2 (November 2026)``, with the month of Release Day."""
    return f"{version.short} ({day.strftime('%B')} {day.year})"


def format_day(event: Event) -> str:
    text = f"{event.start.strftime('%a')}, {event.start.strftime('%b')} {event.start.day}, {event.start.year}"
    return f"{text} at {event.time}" if event.time else text
