"""Loader and query helpers for .github/release/schedule.yml, shared by every workflow.

    from release_schedule import schedule
    schedule.release("v12.2").milestones["code_freeze"]
    schedule.milestones_on(date.today())

The module-level helpers read the repo's schedule.yml once; ``load(path)`` returns a
``Schedule`` with the same methods for any other file.
"""

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from . import yamlio

SCHEDULE_PATH = Path(__file__).resolve().parents[2] / "release" / "schedule.yml"
FORMAT_VERSION = 1

# In date order. Every release has all of them.
MILESTONES = (
    "branch_cut",
    "feature_complete",
    "rc1",
    "code_freeze",
    "final_build",
    "cloud_freemium_professional",
    "cloud_enterprise",
    "release_day",
)

MILESTONE_TITLES = {
    "branch_cut": "Release Branch Cut",
    "feature_complete": "Feature Complete",
    "rc1": "RC1 Cut",
    "code_freeze": "Code Freeze",
    "final_build": "Final Release Build Cut",
    "cloud_freemium_professional": "Cloud Freemium & Professional Release",
    "cloud_enterprise": "Cloud Enterprise Release",
    "release_day": "Release Day",
}

# Mobile ships with the server, so its version joins these titles; Desktop only ships on Release Day.
MOBILE_IN_TITLE = frozenset({"code_freeze", "release_day"})
DESKTOP_IN_TITLE = frozenset({"release_day"})

VERSION = re.compile(r"v?(\d+)\.(\d+)(?:\.(\d+))?")


def parse_version(text: str) -> tuple[int, int]:
    """``(major, minor)`` from ``v12.2``, ``12.2``, ``v12.2.0`` or ``v12.2.1``."""
    match = VERSION.fullmatch(str(text).strip())
    if not match:
        raise ValueError(f"not a release version: {text!r}")
    return int(match.group(1)), int(match.group(2))


def short_version(text: str) -> str:
    major, minor = parse_version(text)
    return f"v{major}.{minor}"


def is_working_day(day: date, holidays) -> bool:
    return day.weekday() < 5 and day not in holidays


def add_working_days(start: date, days: int, holidays) -> date:
    """The working day ``days`` working days after (or, if negative, before) ``start``."""
    step = 1 if days >= 0 else -1
    day, remaining = start, abs(days)
    while remaining:
        day += timedelta(days=step)
        if is_working_day(day, holidays):
            remaining -= 1
    return day


@dataclass(frozen=True)
class Release:
    version: str
    esr: bool
    jira_fix_version: str
    milestones: dict = field(hash=False, compare=False)
    support_end: date
    mobile: str | None = None
    desktop: str | None = None

    @property
    def key(self) -> tuple[int, int]:
        return parse_version(self.version)

    @property
    def major(self) -> int:
        return self.key[0]

    @property
    def minor(self) -> int:
        return self.key[1]

    @property
    def tag(self) -> str:
        return f"{self.version}.0"

    @property
    def branch(self) -> str:
        return f"release-{self.major}.{self.minor}"

    @property
    def release_day(self) -> date:
        return self.milestones["release_day"]

    def event_title(self, milestone: str) -> str:
        """``v12.2 & Mobile v2.47 Code Freeze``."""
        parts = [self.version]
        if self.mobile and milestone in MOBILE_IN_TITLE:
            parts.append(f"Mobile {self.mobile}")
        if self.desktop and milestone in DESKTOP_IN_TITLE:
            parts.append(f"Desktop {self.desktop}")
        return f"{' & '.join(parts)} {MILESTONE_TITLES[milestone]}"


@dataclass
class Schedule:
    releases: list[Release]
    holidays: dict  # date -> name
    automate_from: str
    raw: dict

    def __post_init__(self):
        self._by_key = {release.key: release for release in self.releases}

    def release(self, version: str) -> Release:
        try:
            return self._by_key[parse_version(version)]
        except KeyError:
            raise KeyError(f"{short_version(version)} is not in the release schedule") from None

    def has_release(self, version: str) -> bool:
        return parse_version(version) in self._by_key

    def is_automated(self, version: str) -> bool:
        """Whether release automation runs for ``version``: listed, and not before ``automate_from``."""
        return self.has_release(version) and parse_version(version) >= parse_version(self.automate_from)

    def active_releases(self, day: date, days_after_release: int = 0) -> list[Release]:
        """Releases between their branch cut and Release Day (plus grace) on ``day``, oldest first."""
        return [r for r in self.releases
                if r.milestones["branch_cut"] <= day <= r.release_day + timedelta(days=days_after_release)]

    def milestones_on(self, day: date) -> list[tuple[Release, str]]:
        return [(r, m) for r in self.releases for m in MILESTONES if r.milestones[m] == day]

    def is_esr(self, version: str) -> bool:
        return self.release(version).esr

    def fix_version(self, version: str) -> str:
        return self.release(version).jira_fix_version

    def support_end(self, version: str) -> date:
        return self.release(version).support_end

    def next_esr(self, after: str) -> Release | None:
        """The first ESR after ``after``, which need not be in the schedule itself."""
        key = parse_version(after)
        return next((r for r in self.releases if r.esr and r.key > key), None)

    def esrs(self) -> list[Release]:
        return [r for r in self.releases if r.esr]

    def is_working_day(self, day: date) -> bool:
        return is_working_day(day, self.holidays)

    def add_working_days(self, start: date, days: int) -> date:
        return add_working_days(start, days, self.holidays)


class ScheduleError(ValueError):
    pass


def _require(mapping, key, kind, where):
    if not isinstance(mapping, dict) or key not in mapping:
        raise ScheduleError(f"{where}: missing {key!r}")
    value = mapping[key]
    if kind is not None and not isinstance(value, kind):
        raise ScheduleError(f"{where}: {key!r} should be {getattr(kind, '__name__', kind)}, got {value!r}")
    return value


def parse(text: str) -> Schedule:
    try:
        doc = yamlio.load(text)
    except yamlio.YAMLError as exc:
        raise ScheduleError(f"schedule.yml: {exc}") from exc
    if not isinstance(doc, dict):
        raise ScheduleError("schedule.yml: expected a mapping at the top level")
    if doc.get("version") != FORMAT_VERSION:
        raise ScheduleError(f"schedule.yml: unsupported format version {doc.get('version')!r}")
    holidays = {}
    for i, entry in enumerate(_require(doc, "holidays", list, "schedule.yml") or []):
        where = f"holidays[{i}]"
        holidays[_require(entry, "date", date, where)] = _require(entry, "name", str, where)
    releases = []
    for i, entry in enumerate(_require(doc, "releases", list, "schedule.yml") or []):
        where = f"releases[{i}]"
        version = _require(entry, "version", str, where)
        milestones = _require(entry, "milestones", dict, where)
        missing = [m for m in MILESTONES if not isinstance(milestones.get(m), date)]
        if missing or set(milestones) - set(MILESTONES):
            raise ScheduleError(f"{where} ({version}): milestones must be exactly {', '.join(MILESTONES)}, as dates")
        releases.append(Release(
            version=short_version(version),
            esr=_require(entry, "esr", bool, where),
            jira_fix_version=_require(entry, "jira_fix_version", str, where),
            milestones={m: milestones[m] for m in MILESTONES},
            support_end=_require(entry, "support_end", date, where),
            mobile=_require(entry, "mobile", (str, type(None)), where),
            desktop=_require(entry, "desktop", (str, type(None)), where),
        ))
    return Schedule(releases, holidays, _require(doc, "automate_from", str, "schedule.yml"), doc)


def load(path: Path | str = SCHEDULE_PATH) -> Schedule:
    return parse(Path(path).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def default() -> Schedule:
    return load(SCHEDULE_PATH)


def release(version: str) -> Release:
    return default().release(version)


def active_releases(day: date, days_after_release: int = 0) -> list[Release]:
    return default().active_releases(day, days_after_release)


def milestones_on(day: date) -> list[tuple[Release, str]]:
    return default().milestones_on(day)


def is_esr(version: str) -> bool:
    return default().is_esr(version)


def fix_version(version: str) -> str:
    return default().fix_version(version)


def next_esr(after: str) -> Release | None:
    return default().next_esr(after)


def support_end(version: str) -> date:
    return default().support_end(version)


def is_automated(version: str) -> bool:
    return default().is_automated(version)
