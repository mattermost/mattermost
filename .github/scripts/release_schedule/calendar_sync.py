"""Make the Release Dates Google Calendar match schedule.yml.

Each event the sync owns carries private extended properties ``release_schedule=1``,
``version`` and ``milestone``, so events are matched on those and never on titles.
Events without them (holidays, planning meetings, events made by hand) are left alone,
as is anything dated before today. From today on, for each release in the schedule from
``automate_from``, there is exactly one event per milestone: missing ones are created,
changed ones updated, and extras deleted.

    GOOGLE_ACCESS_TOKEN=... python3 -m release_schedule.calendar_sync --calendar-id ID [--dry-run]
"""

import argparse
import os
import sys
import urllib.parse
from dataclasses import dataclass
from datetime import date, timedelta

from . import api
from .schedule import MILESTONES, SCHEDULE_PATH, Schedule, load, parse_version

API = "https://www.googleapis.com/calendar/v3"
OWNER_KEY = "release_schedule"
SOURCE_URL = "https://github.com/mattermost/mattermost/blob/master/.github/release/schedule.yml"
DESCRIPTION = (
    "Generated from .github/release/schedule.yml. Edit that file, not this event: "
    f"changes made here are overwritten.\n{SOURCE_URL}"
)
COMPARED = ("summary", "description", "start", "end", "transparency")


def desired_events(sched: Schedule, today: date) -> dict:
    """``{(version, milestone): event body}`` for milestones on or after ``today``."""
    events = {}
    for release in sched.releases:
        if not sched.is_automated(release.version):
            continue
        for milestone in MILESTONES:
            day = release.milestones[milestone]
            if day < today:
                continue
            events[(release.version, milestone)] = {
                "summary": release.event_title(milestone),
                "description": DESCRIPTION,
                "start": {"date": day.isoformat()},
                "end": {"date": (day + timedelta(days=1)).isoformat()},
                "transparency": "transparent",
                "extendedProperties": {"private": {
                    OWNER_KEY: "1", "version": release.version, "milestone": milestone,
                }},
            }
    return events


@dataclass
class Action:
    kind: str  # create, update, delete
    key: tuple
    event_id: str | None = None
    body: dict | None = None
    summary: str = ""

    def describe(self) -> str:
        version, milestone = self.key
        return f"{self.kind:<6} {version} {milestone}: {self.summary}"


def _key(event: dict):
    private = (event.get("extendedProperties") or {}).get("private") or {}
    if private.get(OWNER_KEY) != "1":
        return None
    return private.get("version"), private.get("milestone")


def _start(event: dict) -> str:
    start = event.get("start") or {}
    return start.get("date") or (start.get("dateTime") or "")[:10]


def _differs(existing: dict, body: dict) -> bool:
    return any(existing.get(field) != body[field] for field in COMPARED)


def plan(desired: dict, existing: list[dict], today: date) -> list[Action]:
    actions, matched = [], set()
    for event in sorted(existing, key=lambda e: (e.get("created", ""), e.get("id", ""))):
        key = _key(event)
        if key is None or event.get("status") == "cancelled" or _start(event) < today.isoformat():
            continue
        body = desired.get(key)
        if body is None or key in matched:
            actions.append(Action("delete", key, event["id"], summary=event.get("summary", "")))
            continue
        matched.add(key)
        if _differs(event, body):
            actions.append(Action("update", key, event["id"], body, body["summary"]))
    for key, body in desired.items():
        if key not in matched:
            actions.append(Action("create", key, body=body, summary=body["summary"]))
    order = {"delete": 0, "update": 1, "create": 2}
    return sorted(actions, key=lambda a: (order[a.kind], _version_key(a.key[0]),
                                          MILESTONES.index(a.key[1]) if a.key[1] in MILESTONES else -1))


def _version_key(version) -> tuple:
    try:
        return parse_version(version)
    except ValueError:
        return (-1, -1)


class GoogleCalendar:
    def __init__(self, calendar_id: str, token: str, request=api.request):
        self.base = f"{API}/calendars/{urllib.parse.quote(calendar_id, safe='')}/events"
        self.token = token
        self.request = request

    def managed_events(self, today: date) -> list[dict]:
        events, page = [], None
        while True:
            query = {
                "privateExtendedProperty": f"{OWNER_KEY}=1",
                "timeMin": f"{today.isoformat()}T00:00:00Z",
                "maxResults": "2500",
                "singleEvents": "true",
            }
            if page:
                query["pageToken"] = page
            result = self.request("GET", f"{self.base}?{urllib.parse.urlencode(query)}", self.token)
            events += result.get("items", [])
            page = result.get("nextPageToken")
            if not page:
                return events

    def apply(self, action: Action):
        if action.kind == "create":
            self.request("POST", self.base, self.token, action.body)
        elif action.kind == "update":
            self.request("PUT", f"{self.base}/{urllib.parse.quote(action.event_id)}", self.token, action.body)
        elif action.kind == "delete":
            self.request("DELETE", f"{self.base}/{urllib.parse.quote(action.event_id)}", self.token)


def sync(sched: Schedule, calendar: GoogleCalendar, today: date, dry_run: bool, out=print) -> list[Action]:
    actions = plan(desired_events(sched, today), calendar.managed_events(today), today)
    if not actions:
        out("The calendar already matches schedule.yml.")
    for action in actions:
        out(("[dry run] " if dry_run else "") + action.describe())
        if not dry_run:
            calendar.apply(action)
    return actions


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--path", default=SCHEDULE_PATH)
    parser.add_argument("--calendar-id", default=os.environ.get("RELEASE_SCHEDULE_CALENDAR_ID"))
    parser.add_argument("--today", type=date.fromisoformat, default=date.today())
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    sched = load(args.path)
    token = os.environ.get("GOOGLE_ACCESS_TOKEN")
    if not args.calendar_id or not token:
        print("::notice::No calendar ID or Google access token, so listing the events the calendar "
              "should have instead of syncing.")
        for (version, milestone), body in desired_events(sched, args.today).items():
            print(f"{body['start']['date']}  {body['summary']}")
        return 0
    try:
        actions = sync(sched, GoogleCalendar(args.calendar_id, token), args.today, args.dry_run)
    except api.APIError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    counts = {kind: sum(a.kind == kind for a in actions) for kind in ("create", "update", "delete")}
    print(", ".join(f"{n} to {kind}" if args.dry_run else f"{kind.rstrip('e')}ed {n}" for kind, n in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
