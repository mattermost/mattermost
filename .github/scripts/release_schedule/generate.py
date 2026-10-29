"""Build or extend .github/release/schedule.yml from the release rules.

The file's inputs are people's decisions: ``start``, ``through``, ``automate_from``,
``known_esrs``, ``holidays`` and ``overrides``. Everything under ``releases`` is worked
out from them by the rules in the Release Processes Overview:

- Release Day is the first working day on or before the 16th of the month.
- The other milestones are T-offsets in working days from Release Day, skipping weekends
  and holidays (``T_OFFSETS``).
- The Cloud Enterprise release moves to the working day before when it falls on a Friday,
  which can put it on the same day as the Cloud Freemium & Professional release.
- The branch cut is the working day after the previous release's Final Build.
- One release a month. October's is the next major (``vN.0``), the rest bump the minor.
- The known ESRs are ESRs; after the last of them, one every 9 months.
- Mobile ships a minor with every release, Desktop one every 3 months from ``start``.
- Support ends on the 15th, 3 months after Release Day (12 for an ESR).
- Overrides are applied last and nothing else moves with them.

    python3 -m release_schedule.generate            # regenerate, keeping ``through``
    python3 -m release_schedule.generate --years 5  # extend to 5 years from today
"""

import argparse
import calendar
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from . import yamlio
from .schedule import (
    FORMAT_VERSION,
    MILESTONES,
    SCHEDULE_PATH,
    add_working_days,
    is_working_day,
    parse_version,
)

RELEASE_DAY_OF_MONTH = 16
T_OFFSETS = {
    "feature_complete": -16,
    "rc1": -15,
    "code_freeze": -6,
    "final_build": -5,
    "cloud_freemium_professional": -4,
    "cloud_enterprise": -3,
}
MAJOR_RELEASE_MONTH = 10
ESR_CADENCE_MONTHS = 9
DESKTOP_CADENCE_MONTHS = 3
SUPPORT_MONTHS = 3
ESR_SUPPORT_MONTHS = 12
SUPPORT_END_DAY = 15

MONTH = re.compile(r"(\d{4})-(\d{2})")
ENTRY_WIDTH = max(len(m) for m in MILESTONES) + len(": YYYY-MM-DD")

HEADER = """\
# The release schedule: the source of truth for release dates. The Release Dates Google
# Calendar and the release-milestone events are generated from it
# (.github/workflows/release-schedule.yml).
#
# Edit the inputs (start, through, automate_from, known_esrs, holidays, overrides), then
# regenerate everything under releases:
#
#   cd .github/scripts && python3 -m release_schedule.generate
#
# validate.py fails a PR whose releases don't match what generate.py writes. To move a
# date, add an override with a reason; nothing else moves with it.
"""


class InputError(ValueError):
    pass


@dataclass
class Override:
    version: str
    milestone: str
    date: date
    reason: str


@dataclass
class Inputs:
    start_version: str
    start_month: tuple[int, int]
    start_mobile: str | None
    start_desktop: str | None
    through: tuple[int, int]
    automate_from: str
    known_esrs: list[str]
    holidays: dict  # date -> name
    overrides: list[Override] = field(default_factory=list)


@dataclass
class GeneratedRelease:
    major: int
    minor: int
    esr: bool
    milestones: dict
    notes: dict  # milestone -> comment
    support_end: date
    mobile: str | None
    desktop: str | None

    @property
    def version(self) -> str:
        return f"v{self.major}.{self.minor}"

    @property
    def jira_fix_version(self) -> str:
        day = self.milestones["release_day"]
        return f"{self.version} ({calendar.month_name[day.month]} {day.year})"


def parse_month(text, where: str) -> tuple[int, int]:
    match = MONTH.fullmatch(str(text or ""))
    if not match or not 1 <= int(match.group(2)) <= 12:
        raise InputError(f"{where} should be YYYY-MM, got {text!r}")
    return int(match.group(1)), int(match.group(2))


def month_index(year: int, month: int) -> int:
    return year * 12 + month - 1


def from_index(index: int) -> tuple[int, int]:
    year, month = divmod(index, 12)
    return year, month + 1


def add_months(day: date, months: int, on_day: int) -> date:
    year, month = from_index(month_index(day.year, day.month) + months)
    return date(year, month, min(on_day, calendar.monthrange(year, month)[1]))


def release_day(year: int, month: int, holidays) -> date:
    day = date(year, month, RELEASE_DAY_OF_MONTH)
    while not is_working_day(day, holidays):
        day = date.fromordinal(day.toordinal() - 1)
    return day


def final_build(day: date, holidays) -> date:
    return add_working_days(day, T_OFFSETS["final_build"], holidays)


def _bump(version: str | None) -> str | None:
    if not version:
        return None
    major, minor = parse_version(version)
    return f"v{major}.{minor + 1}"


def read_inputs(doc: dict) -> Inputs:
    if not isinstance(doc, dict):
        raise InputError("schedule.yml should be a mapping")
    if doc.get("version") != FORMAT_VERSION:
        raise InputError(f"unsupported format version {doc.get('version')!r}")
    start = doc.get("start")
    if not isinstance(start, dict):
        raise InputError("start should be a mapping with version, month, mobile and desktop")
    try:
        parse_version(start.get("version", ""))
        parse_version(doc.get("automate_from", ""))
        known_esrs = [f"v{a}.{b}" for a, b in sorted(parse_version(v) for v in doc.get("known_esrs") or [])]
        for key in ("mobile", "desktop"):
            if start.get(key) is not None:
                parse_version(start[key])
    except ValueError as exc:
        raise InputError(str(exc)) from exc

    holidays = {}
    for i, entry in enumerate(doc.get("holidays") or []):
        if not isinstance(entry, dict) or not isinstance(entry.get("date"), date) or not entry.get("name"):
            raise InputError(f"holidays[{i}] should be {{date: YYYY-MM-DD, name: ...}}, got {entry!r}")
        if entry["date"] in holidays:
            raise InputError(f"holidays[{i}]: {entry['date']} is listed twice")
        holidays[entry["date"]] = str(entry["name"])

    overrides = []
    for i, entry in enumerate(doc.get("overrides") or []):
        where = f"overrides[{i}]"
        if not isinstance(entry, dict):
            raise InputError(f"{where} should be a mapping")
        if entry.get("milestone") not in MILESTONES:
            raise InputError(f"{where}: milestone should be one of {', '.join(MILESTONES)}, got {entry.get('milestone')!r}")
        if not isinstance(entry.get("date"), date):
            raise InputError(f"{where}: date should be YYYY-MM-DD, got {entry.get('date')!r}")
        if not str(entry.get("reason") or "").strip():
            raise InputError(f"{where}: every override needs a reason")
        try:
            version = "v{}.{}".format(*parse_version(entry.get("version", "")))
        except ValueError as exc:
            raise InputError(f"{where}: {exc}") from exc
        overrides.append(Override(version, entry["milestone"], entry["date"], str(entry["reason"]).strip()))

    return Inputs(
        start_version="v{}.{}".format(*parse_version(start["version"])),
        start_month=parse_month(start.get("month"), "start.month"),
        start_mobile=start.get("mobile"),
        start_desktop=start.get("desktop"),
        through=parse_month(doc.get("through"), "through"),
        automate_from="v{}.{}".format(*parse_version(doc["automate_from"])),
        known_esrs=known_esrs,
        holidays=dict(sorted(holidays.items())),
        overrides=overrides,
    )


def build(inputs: Inputs) -> list[GeneratedRelease]:
    holidays = inputs.holidays
    first, last = month_index(*inputs.start_month), month_index(*inputs.through)
    if last < first:
        raise InputError("through is before start.month")

    plan = []
    major, minor = parse_version(inputs.start_version)
    for index in range(first, last + 1):
        year, month = from_index(index)
        if index > first:
            major, minor = (major + 1, 0) if month == MAJOR_RELEASE_MONTH else (major, minor + 1)
        plan.append((index, major, minor))

    known = {parse_version(v) for v in inputs.known_esrs}
    listed = {(a, b): index for index, a, b in plan}
    missing = sorted(known - set(listed))
    if missing:
        raise InputError("known_esrs not in the schedule's range: " + ", ".join(f"v{a}.{b}" for a, b in missing))
    last_known = max((listed[k] for k in known), default=None)

    releases = []
    previous_final = final_build(release_day(*from_index(first - 1), holidays), holidays)
    start_major, start_minor = parse_version(inputs.start_version)
    previous_version = f"v{start_major}.{start_minor - 1}" if start_minor else "the previous release's"
    mobile, desktop = inputs.start_mobile, inputs.start_desktop
    for index, major, minor in plan:
        day = release_day(*from_index(index), holidays)
        milestones = {"release_day": day}
        notes = {"release_day": f"first working day on or before the {RELEASE_DAY_OF_MONTH}th"}
        for milestone, offset in T_OFFSETS.items():
            milestones[milestone] = add_working_days(day, offset, holidays)
            notes[milestone] = f"T{offset}"
        if milestones["cloud_enterprise"].weekday() == calendar.FRIDAY:
            milestones["cloud_enterprise"] = add_working_days(milestones["cloud_enterprise"], -1, holidays)
            notes["cloud_enterprise"] = f"T{T_OFFSETS['cloud_enterprise']}, moved off a Friday"
        milestones["branch_cut"] = add_working_days(previous_final, 1, holidays)
        notes["branch_cut"] = f"working day after {previous_version} final_build"

        esr = (major, minor) in known or (
            last_known is not None and index > last_known and (index - last_known) % ESR_CADENCE_MONTHS == 0)
        ships_desktop = (index - first) % DESKTOP_CADENCE_MONTHS == 0
        if index > first:
            mobile = _bump(mobile)
            if ships_desktop:
                desktop = _bump(desktop)
        releases.append(GeneratedRelease(
            major=major,
            minor=minor,
            esr=esr,
            milestones={m: milestones[m] for m in MILESTONES},
            notes=notes,
            support_end=add_months(day, ESR_SUPPORT_MONTHS if esr else SUPPORT_MONTHS, SUPPORT_END_DAY),
            mobile=mobile,
            desktop=desktop if ships_desktop else None,
        ))
        previous_final, previous_version = milestones["final_build"], f"v{major}.{minor}"

    by_version = {r.version: r for r in releases}
    seen = set()
    for override in inputs.overrides:
        if override.version not in by_version:
            raise InputError(f"override for {override.version}, which is not in the schedule")
        if (override.version, override.milestone) in seen:
            raise InputError(f"two overrides for {override.version} {override.milestone}")
        seen.add((override.version, override.milestone))
        release = by_version[override.version]
        rule_date = release.milestones[override.milestone]
        release.milestones[override.milestone] = override.date
        release.notes[override.milestone] = f"override (the rules give {rule_date})"
        if override.milestone == "release_day":
            release.support_end = add_months(override.date, ESR_SUPPORT_MONTHS if release.esr else SUPPORT_MONTHS,
                                             SUPPORT_END_DAY)
    return releases


def _scalar(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, date)):
        return str(value)
    text = str(value)
    if re.fullmatch(r"v\d+\.\d+", text):
        return text
    return yamlio.quote(text)


def render(inputs: Inputs, releases: list[GeneratedRelease]) -> str:
    lines = [HEADER.rstrip("\n"), f"version: {FORMAT_VERSION}", ""]
    lines += [
        "# The first release generated, and the Mobile and Desktop versions that ship with it.",
        "start:",
        f"  version: {inputs.start_version}",
        "  month: {}-{:02d}".format(*inputs.start_month),
        f"  mobile: {_scalar(inputs.start_mobile)}",
        f"  desktop: {_scalar(inputs.start_desktop)}",
        "# The last month generated. Extend with: python3 -m release_schedule.generate --years 5",
        "through: {}-{:02d}".format(*inputs.through),
        "# Release automation (changelog, release agent, docs tasks) runs from this release on.",
        f"automate_from: {inputs.automate_from}",
        "# Announced ESRs. After the last one, the generator picks one every 9 months.",
        f"known_esrs: [{', '.join(inputs.known_esrs)}]",
        "",
        "# Non-working days, from the US and Canada list on the Release Processes Overview page.",
        "holidays:",
    ]
    lines += [f"  - {{date: {day}, name: {_scalar(name)}}}" for day, name in inputs.holidays.items()]
    if not inputs.holidays:
        lines[-1] = "holidays: []"
    lines += ["", "# Dated exceptions to the rules, each with a reason. Applied last.", "overrides:"]
    if not inputs.overrides:
        lines[-1] = "overrides: []"
    for override in inputs.overrides:
        lines += [
            f"  - version: {override.version}",
            f"    milestone: {override.milestone}",
            f"    date: {override.date}",
            f"    reason: {_scalar(override.reason)}",
        ]
    lines += ["", "# Generated. Don't edit by hand."]
    lines.append("releases:" if releases else "releases: []")
    for release in releases:
        lines += [
            f"  - version: {release.version}",
            f"    esr: {_scalar(release.esr)}",
            f"    jira_fix_version: {_scalar(release.jira_fix_version)}",
            "    milestones:",
        ]
        for milestone in MILESTONES:
            entry = f"{milestone}: {release.milestones[milestone]}"
            lines.append(f"      {entry:<{ENTRY_WIDTH}}  # {release.notes[milestone]}")
        lines += [
            f"    support_end: {release.support_end}",
            f"    mobile: {_scalar(release.mobile)}",
            f"    desktop: {_scalar(release.desktop)}",
            "",
        ]
    return "\n".join(lines).rstrip("\n") + "\n"


def regenerate(text: str, through: tuple[int, int] | None = None) -> str:
    inputs = read_inputs(yamlio.load(text))
    if through:
        inputs.through = through
    return render(inputs, build(inputs))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--path", type=Path, default=SCHEDULE_PATH)
    horizon = parser.add_mutually_exclusive_group()
    horizon.add_argument("--through", help="last month to generate, YYYY-MM")
    horizon.add_argument("--years", type=int, help="generate through this many years from --today")
    parser.add_argument("--today", type=date.fromisoformat, default=date.today())
    args = parser.parse_args(argv)

    through = None
    if args.through:
        through = parse_month(args.through, "--through")
    elif args.years is not None:
        through = (args.today.year + args.years, args.today.month)
    try:
        text = regenerate(args.path.read_text(encoding="utf-8"), through)
    except (InputError, yamlio.YAMLError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    args.path.write_text(text, encoding="utf-8")
    print(f"Wrote {args.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
