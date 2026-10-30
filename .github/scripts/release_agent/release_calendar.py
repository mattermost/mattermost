"""Active releases from the Release Dates calendar's ICS feed, cross-checked against git."""

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from . import workdays

VERSION_IN_TITLE = re.compile(r"(?<![\w.])v?(\d+)\.(\d+)(?:\.(\d+))?(?![\w.])")
# "v12.1 & Mobile v2.46 Code Freeze": a version right after Mobile or Desktop isn't a server one.
NOT_SERVER = re.compile(r"\b(?:mobile|desktop)\s*$", re.IGNORECASE)


@dataclass
class Event:
    summary: str
    start: date
    end: date  # exclusive, as in ICS


@dataclass
class Release:
    major: int
    minor: int
    milestones: dict = field(default_factory=dict)  # milestone key -> date

    @property
    def key(self) -> tuple:
        return self.major, self.minor

    @property
    def version(self) -> str:
        return f"v{self.major}.{self.minor}.0"

    @property
    def short_version(self) -> str:
        return f"v{self.major}.{self.minor}"

    @property
    def branch(self) -> str:
        return f"release-{self.major}.{self.minor}"

    @property
    def release_day(self) -> date | None:
        return self.milestones.get("release_day")

    def window(self, days_after_release: int) -> tuple:
        start = min(self.milestones.values())
        end = self.release_day or max(self.milestones.values())
        return start, end + timedelta(days=days_after_release)


# ── ICS ─────────────────────────────────────────────────────────────────────────────

def _unfold(text: str) -> list[str]:
    lines = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def _unescape(value: str) -> str:
    return re.sub(r"\\([\\;,nN])", lambda m: "\n" if m.group(1) in "nN" else m.group(1), value)


def _parse_date(value: str) -> date:
    return datetime.strptime(value.strip()[:8], "%Y%m%d").date()


def parse_ics(text: str) -> list[Event]:
    """The VEVENTs in an ICS feed, with whitespace-trimmed titles and date-only bounds.

    Times are dropped: every milestone is a whole working day. Recurring events are
    taken at their first occurrence.
    """
    events, current = [], None
    for line in _unfold(text):
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            if current is not None and current.get("SUMMARY") and current.get("DTSTART"):
                start = _parse_date(current["DTSTART"])
                end = _parse_date(current["DTEND"]) if current.get("DTEND") else start + timedelta(days=1)
                events.append(Event(_unescape(current["SUMMARY"]).strip(), start, max(end, start + timedelta(days=1))))
            current = None
        elif current is not None and ":" in line:
            name, value = line.split(":", 1)
            current[name.split(";", 1)[0].upper()] = value
    return events


# ── Releases ────────────────────────────────────────────────────────────────────────

def milestone_for(summary: str, milestones: dict) -> str | None:
    lowered = summary.lower()
    for key, marker in milestones.items():
        if marker.lower() in lowered:
            return key
    return None


def server_versions(summary: str) -> list[tuple]:
    """The ``(major, minor, patch)`` server versions in a title, leaving out Mobile and Desktop ones."""
    return [(int(m.group(1)), int(m.group(2)), int(m.group(3) or 0))
            for m in VERSION_IN_TITLE.finditer(summary) if not NOT_SERVER.search(summary[:m.start()])]


def releases_from_events(events: list[Event], milestones: dict) -> tuple[dict, list[str]]:
    """``{(major, minor): Release}`` from server milestone events, and notes on events left out.

    Events naming only Mobile or Desktop versions, and dot releases, are ignored.
    """
    releases, notes = {}, []
    for event in events:
        key = milestone_for(event.summary, milestones)
        if not key:
            continue
        versions = server_versions(event.summary)
        if not versions:
            if not VERSION_IN_TITLE.search(event.summary):
                notes.append(f"Calendar event “{event.summary}” on {event.start} names no release version.")
            continue
        for major, minor, patch in versions:
            if patch:
                continue
            release = releases.setdefault((major, minor), Release(major, minor))
            previous = release.milestones.get(key)
            if previous and previous != event.start:
                notes.append(f"The calendar has two {milestones[key]} events for v{major}.{minor} "
                             f"({previous} and {event.start}); using the later one.")
            release.milestones[key] = max(previous or event.start, event.start)
    return releases, notes


def holidays_from(events: list[Event], markers: list[str], extra: list[str]) -> frozenset:
    days = {date.fromisoformat(day) for day in extra}
    lowered = [marker.lower() for marker in markers]
    for event in events:
        if any(marker in event.summary.lower() for marker in lowered):
            day = event.start
            while day < event.end:
                days.add(day)
                day += timedelta(days=1)
    return frozenset(days)


def active_releases(releases: dict, today: date, days_after_release: int) -> list[Release]:
    """Releases whose window (first milestone to Release Day, plus grace) includes today."""
    active = []
    for release in releases.values():
        start, end = release.window(days_after_release)
        if start <= today <= end:
            active.append(release)
    return sorted(active, key=lambda r: r.key)


def resolve_due(due: str, release: Release, holidays: frozenset) -> date | None:
    """The date a rule falls due: ``T-5``, ``code_freeze`` or ``code_freeze+1``.

    None when the calendar lacks the milestone it hangs off.
    """
    match = re.fullmatch(r"T([-+]\d+)", due)
    if match:
        anchor, offset = release.release_day, int(match.group(1))
    else:
        match = re.fullmatch(r"([a-z][a-z0-9_]*)([-+]\d+)?", due)
        anchor, offset = release.milestones.get(match.group(1)), int(match.group(2) or 0)
    if anchor is None:
        return None
    return workdays.add_working_days(anchor, offset, holidays)


# ── Git cross-check ─────────────────────────────────────────────────────────────────

def rc_numbers(ls_remote: str, major: int, minor: int) -> list[int]:
    found = set()
    for line in ls_remote.splitlines():
        ref = line.split("\t")[-1].strip()
        match = re.fullmatch(rf"refs/tags/v{major}\.{minor}\.0-rc(\d+)", ref)
        if match:
            found.add(int(match.group(1)))
    return sorted(found)


def cross_check(release: Release, branches: set, tags: set, today: date) -> list[str]:
    """Where the calendar and git disagree about one release. Reported, never resolved by guessing."""
    flags = []
    cut = release.milestones.get("branch_cut")
    has_branch = release.key in branches
    if cut and cut <= today and not has_branch:
        flags.append(f"The calendar has {release.branch} cut on {cut}, but the branch doesn't exist.")
    if cut and cut > today and has_branch:
        flags.append(f"{release.branch} exists, but the calendar has it cut on {cut}.")
    if not cut and not has_branch:
        flags.append(f"The calendar has no Release Branch Cut for {release.short_version} and {release.branch} doesn't exist.")
    final = release.milestones.get("final_build")
    if release.key in tags and final and final > today:
        flags.append(f"{release.version} is tagged, but the calendar has the Final Release Build Cut on {final}.")
    if not release.release_day:
        flags.append(f"The calendar has no Release Day for {release.short_version}, so its T-day is unknown.")
    return flags


def untracked_branches(releases: dict, branches: set, tags: set) -> list[str]:
    """Cut, untagged release branches newer than the last release that the calendar doesn't know."""
    newest_tag = max(tags) if tags else (0, 0)
    return [
        f"release-{major}.{minor} is cut and untagged, but the calendar has no v{major}.{minor} milestones."
        for major, minor in sorted(branches - tags)
        if (major, minor) > newest_tag and (major, minor) not in releases
    ]
