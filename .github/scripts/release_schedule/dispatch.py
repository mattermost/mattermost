"""The milestone dispatcher: one ``release-milestone`` repository_dispatch per milestone today.

This is the only date-driven trigger. Workflows that act on a milestone listen for

    on:
      repository_dispatch:
        types: [release-milestone]

and read ``github.event.client_payload.version``, ``.milestone`` and ``.date``, then look
anything else up with release_schedule.schedule. Only releases from ``automate_from``
are dispatched.

    GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo python3 -m release_schedule.dispatch [--date D] [--dry-run]
"""

import argparse
import os
import sys
from datetime import date, datetime, timezone

from . import api, validate
from .schedule import SCHEDULE_PATH, Schedule, load

EVENT_TYPE = "release-milestone"
COVERAGE_MONTHS = 12


def payloads(sched: Schedule, day: date) -> list[dict]:
    return [{"version": release.version, "milestone": milestone, "date": day.isoformat()}
            for release, milestone in sched.milestones_on(day) if sched.is_automated(release.version)]


def dispatch(repo: str, token: str, payload: dict, request=api.request):
    request("POST", f"https://api.github.com/repos/{repo}/dispatches", token,
            {"event_type": EVENT_TYPE, "client_payload": payload})


def main(argv=None, request=api.request) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--path", default=SCHEDULE_PATH)
    parser.add_argument("--date", type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    sched = load(args.path)
    for warning in validate.check_coverage(sched, args.date, COVERAGE_MONTHS):
        print(f"::warning::{warning}")
    found = payloads(sched, args.date)
    if not found:
        print(f"No milestones on {args.date}.")
        return 0
    token = os.environ.get("GITHUB_TOKEN")
    if not args.dry_run and not (token and args.repo):
        print("::error::GITHUB_TOKEN and GITHUB_REPOSITORY are needed to dispatch", file=sys.stderr)
        return 1
    failed = 0
    for payload in found:
        label = f"{payload['version']} {payload['milestone']} ({payload['date']})"
        if args.dry_run:
            print(f"[dry run] would dispatch {EVENT_TYPE}: {label}")
            continue
        try:
            dispatch(args.repo, token, payload, request)
            print(f"Dispatched {EVENT_TYPE}: {label}")
        except api.APIError as exc:
            failed += 1
            print(f"::error::{label}: {exc}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
