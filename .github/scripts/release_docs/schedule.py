"""The release schedule as code: working days, and every key date of a monthly release.

Rules from the Release Timeline section of the Release Processes Overview page
(Confluence 2928869382):

- Release Day (T-0) is the first working day on or before the 16th of the release month.
- T-N counts N working days back from Release Day.
- The release branch is cut the working day after the previous release's Final Release
  Build Cut.
- Mobile releases on the 16th, or the Thursday before when the 16th is a weekend. The
  mobile minor version goes up by one every month.

Working days are Monday to Friday, except every day off in the US or Canada listed on the
same page's "Holidays" section. A year that isn't on the page yet is never guessed: the
schedule for a release that needs it isn't computed.

Phase 1 (``release_agent``) can use this module instead of reading dates off the calendar.
"""

import html
import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from .versions import Version

HOLIDAYS_PAGE_ID = "2928869382"
HOLIDAYS_HEADING = re.compile(r"Entity and EOR locations holidays for (\d{4})", re.IGNORECASE)
HOLIDAY_DATE = re.compile(r"(?<![\d/])(\d{1,2})/(\d{1,2})/(\d{4})(?![\d/])")
PLANNED_DAY = 16
THURSDAY = 3

# T-N offsets, in working days before Release Day.
T_OFFSETS = {
    "feature_complete": 16,
    "rc1": 15,
    "code_freeze": 6,
    "final_build": 5,
    "cloud_freemium_pro": 4,
    "cloud_enterprise": 3,
}

# One month whose server and mobile versions are known; every other month counts from it.
# v12.2 (December 2026) shipped with Mobile v2.47. A major version bump on either side
# needs this anchor moved.
ANCHOR_MONTH = (2026, 12)
ANCHOR_SERVER = (12, 2)
ANCHOR_MOBILE = (2, 47)


class MissingHolidays(Exception):
    """A year the schedule needs isn't on the holidays page yet."""

    def __init__(self, years: list[int]):
        self.years = sorted(set(years))
        super().__init__(f"the holidays page has no list for {', '.join(map(str, self.years))}")


@dataclass(frozen=True)
class Holidays:
    days: frozenset
    years: frozenset  # years with a list on the page; any other year is unknown

    def require(self, *days: date) -> None:
        missing = sorted({d.year for d in days} - self.years)
        if missing:
            raise MissingHolidays(missing)

    def is_working_day(self, day: date) -> bool:
        self.require(day)
        return day.weekday() < 5 and day not in self.days


def parse_holidays(page: str) -> Holidays:
    """Every ``M/DD/YYYY`` date under each "Entity and EOR locations holidays for {year}"
    heading, from the page's storage format or its plain text.

    Both countries' lists are read, so a day off in either is a non-working day. Dates are
    only counted for the heading's own year, so a stray date of another year in a list
    can't mark a year as known.
    """
    text = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", page or "")).split())
    headings = list(HOLIDAYS_HEADING.finditer(text))
    days, years = set(), set()
    for index, heading in enumerate(headings):
        year = int(heading.group(1))
        end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
        found = [date(int(y), int(m), int(d)) for m, d, y in HOLIDAY_DATE.findall(text[heading.end():end])]
        found = [d for d in found if d.year == year]
        if found:
            years.add(year)
            days.update(found)
    return Holidays(frozenset(days), frozenset(years))


def add_working_days(start: date, count: int, holidays: Holidays) -> date:
    """The working day ``count`` working days after (negative: before) ``start``."""
    step = 1 if count >= 0 else -1
    day, remaining = start, abs(count)
    while remaining:
        day += timedelta(days=step)
        if holidays.is_working_day(day):
            remaining -= 1
    return day


def on_or_before(day: date, holidays: Holidays) -> date:
    while not holidays.is_working_day(day):
        day -= timedelta(days=1)
    return day


def on_or_after(day: date, holidays: Holidays) -> date:
    while not holidays.is_working_day(day):
        day += timedelta(days=1)
    return day


def months_between(start: tuple[int, int], end: tuple[int, int]) -> int:
    return (end[0] - start[0]) * 12 + end[1] - start[1]


def add_month(month: tuple[int, int], count: int = 1) -> tuple[int, int]:
    year, index = divmod(month[0] * 12 + month[1] - 1 + count, 12)
    return year, index + 1


def mobile_version(month: tuple[int, int]) -> str:
    return f"v{ANCHOR_MOBILE[0]}.{ANCHOR_MOBILE[1] + months_between(ANCHOR_MONTH, month)}"


def release_month(version: Version) -> tuple[int, int]:
    """The month ``version`` ships in, counted from the anchor (same major version only)."""
    if version.major != ANCHOR_SERVER[0]:
        raise ValueError(f"{version.short} is not v{ANCHOR_SERVER[0]}.x: move schedule.ANCHOR_* to its major version")
    return add_month(ANCHOR_MONTH, version.minor - ANCHOR_SERVER[1])


def mobile_release_day(month: tuple[int, int]) -> date:
    """The 16th, or the Thursday before it when the 16th is a weekend."""
    day = date(month[0], month[1], PLANNED_DAY)
    if day.weekday() >= 5:
        day -= timedelta(days=day.weekday() - THURSDAY)
    return day


@dataclass
class Schedule:
    version: Version
    mobile: str
    month: tuple[int, int]
    release_day: date
    mobile_release_day: date
    branch_cut: date
    dates: dict = field(default_factory=dict)  # T_OFFSETS key -> date

    @property
    def final_build(self) -> date:
        return self.dates["final_build"]

    def events(self) -> list[tuple[str, date]]:
        """(calendar title, day) for every all-day event, in date order.

        Titles follow the newest events on the Release Dates calendar (v12.2 and v12.3);
        the release agent matches them (``calendar.milestones`` in ``rules.yml``).
        """
        both = f"{self.version.short} & Mobile {self.mobile}"
        found = [
            (f"{both} Release Branch Cut", self.branch_cut),
            (f"{both} Feature Complete", self.dates["feature_complete"]),
            (f"{both} RC1 Cut & QA Qualification Starts", self.dates["rc1"]),
            (f"{both} Code Freeze", self.dates["code_freeze"]),
            (f"{both} Final Release Build Cut", self.dates["final_build"]),
            (f"{self.version.short} Cloud Freemium & Professional Releases", self.dates["cloud_freemium_pro"]),
            (f"{self.version.short} Cloud Enterprise Release", self.dates["cloud_enterprise"]),
        ]
        if self.mobile_release_day == self.release_day:
            found.append((f"{both} Release Day", self.release_day))
        else:
            found += [(f"Mobile {self.mobile} Release Day", self.mobile_release_day),
                      (f"{self.version.short} Release Day", self.release_day)]
        return sorted(found, key=lambda event: event[1])

    @property
    def window(self) -> tuple[date, date]:
        days = [day for _, day in self.events()]
        return min(days), max(days)


def release_day(month: tuple[int, int], holidays: Holidays) -> date:
    return on_or_before(date(month[0], month[1], PLANNED_DAY), holidays)


def compute(version: Version, month: tuple[int, int], previous_final_build: date, holidays: Holidays,
            mobile: str = "") -> Schedule:
    """Every key date of ``version``, released in ``month``. Raises MissingHolidays."""
    day = release_day(month, holidays)
    dates = {key: add_working_days(day, -offset, holidays) for key, offset in T_OFFSETS.items()}
    branch_cut = add_working_days(previous_final_build, 1, holidays)
    return Schedule(version, mobile or mobile_version(month), month, day, mobile_release_day(month), branch_cut, dates)


def following(version: Version, month: tuple[int, int], holidays: Holidays, count: int = 2) -> list[Schedule]:
    """The ``count`` releases after ``version`` (released in ``month``), each one minor
    version and one month later. Raises MissingHolidays when a year isn't on the page."""
    previous_final = add_working_days(release_day(month, holidays), -T_OFFSETS["final_build"], holidays)
    found = []
    for step in range(1, count + 1):
        next_month = add_month(month, step)
        release = compute(Version(version.major, version.minor + step), next_month, previous_final, holidays)
        found.append(release)
        previous_final = release.final_build
    return found


def due_on(planned: date, holidays: Holidays) -> date:
    """The day a task planned for ``planned`` runs: that day, or the next working day."""
    return on_or_after(planned, holidays)
