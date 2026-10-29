"""Check .github/release/schedule.yml: it is what generate.py writes, and its dates make sense.

    python3 -m release_schedule.validate [--path FILE] [--today YYYY-MM-DD --min-months-ahead 12]
"""

import argparse
import difflib
import sys
from datetime import date, timedelta
from pathlib import Path

from . import generate, yamlio
from .schedule import MILESTONES, SCHEDULE_PATH, Schedule, ScheduleError, parse

# Strictly after the one before, except where a Friday move puts both cloud rings on one day.
SAME_DAY_ALLOWED = {("cloud_freemium_professional", "cloud_enterprise")}


def check_dates(sched: Schedule) -> list[str]:
    errors = []
    previous = None
    for release in sched.releases:
        name, ms = release.version, release.milestones
        for earlier, later in zip(MILESTONES, MILESTONES[1:]):
            if ms[later] < ms[earlier] or (ms[later] == ms[earlier] and (earlier, later) not in SAME_DAY_ALLOWED):
                errors.append(f"{name}: {later} ({ms[later]}) should be after {earlier} ({ms[earlier]})")
        if release.release_day.day > generate.RELEASE_DAY_OF_MONTH:
            errors.append(f"{name}: release_day {release.release_day} is after the "
                          f"{generate.RELEASE_DAY_OF_MONTH}th")
        for milestone, day in ms.items():
            if day.weekday() >= 5:
                errors.append(f"{name}: {milestone} {day} is on a {day.strftime('%A')}")
            elif day in sched.holidays:
                errors.append(f"{name}: {milestone} {day} is a holiday ({sched.holidays[day]})")
        if release.support_end <= release.release_day:
            errors.append(f"{name}: support_end {release.support_end} is not after release_day")
        if previous:
            if release.key <= previous.key:
                errors.append(f"{name} comes after {previous.version}")
            if release.release_day <= previous.release_day:
                errors.append(f"{name}: release_day {release.release_day} is not after "
                              f"{previous.version}'s ({previous.release_day})")
            if ms["branch_cut"] <= previous.milestones["final_build"]:
                errors.append(f"{name}: branch_cut {ms['branch_cut']} is not after "
                              f"{previous.version}'s final_build ({previous.milestones['final_build']})")
        previous = release
    if not sched.has_release(sched.automate_from):
        errors.append(f"automate_from {sched.automate_from} is not in the schedule")
    return errors


def check_holidays(doc: dict) -> list[str]:
    days = [entry.get("date") for entry in doc.get("holidays") or [] if isinstance(entry, dict)]
    if days != sorted(days):
        return ["holidays should be in date order"]
    return []


def check_coverage(sched: Schedule, today: date, months: int) -> list[str]:
    if not sched.releases:
        return ["the schedule has no releases"]
    last = sched.releases[-1].release_day
    if last < today + timedelta(days=months * 365 // 12):
        return [f"the schedule ends with {sched.releases[-1].version} on {last}, less than {months} months "
                f"after {today}; extend it with: python3 -m release_schedule.generate --years 5"]
    return []


def validate(text: str, today: date | None = None, min_months_ahead: int = 0) -> list[str]:
    try:
        sched = parse(text)
        doc = yamlio.load(text)
        expected = generate.regenerate(text)
    except (ScheduleError, generate.InputError, yamlio.YAMLError) as exc:
        return [str(exc)]
    errors = []
    if expected != text:
        diff = "".join(difflib.unified_diff(
            text.splitlines(True), expected.splitlines(True), "schedule.yml", "regenerated", n=1))
        errors.append("schedule.yml isn't what generate.py writes from its inputs. Run "
                      "`cd .github/scripts && python3 -m release_schedule.generate`, or move dates with "
                      "an override instead of by hand:\n" + diff)
    errors += check_holidays(doc)
    errors += check_dates(sched)
    if today and min_months_ahead:
        errors += check_coverage(sched, today, min_months_ahead)
    return errors


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--path", type=Path, default=SCHEDULE_PATH)
    parser.add_argument("--today", type=date.fromisoformat, default=date.today())
    parser.add_argument("--min-months-ahead", type=int, default=0,
                        help="fail unless the last Release Day is at least this many months after --today")
    args = parser.parse_args(argv)
    errors = validate(args.path.read_text(encoding="utf-8"), args.today, args.min_months_ahead)
    for error in errors:
        print(f"::error file={args.path}::{error}" if "\n" not in error else f"error: {error}", file=sys.stderr)
    if errors:
        return 1
    sched = parse(args.path.read_text(encoding="utf-8"))
    print(f"{args.path}: {len(sched.releases)} releases, {sched.releases[0].version} to "
          f"{sched.releases[-1].version} ({sched.releases[-1].release_day}), "
          f"{len(sched.esrs())} ESRs, {len(sched.holidays)} holidays. OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
