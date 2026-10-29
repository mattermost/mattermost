"""Syncing the Release Dates calendar against a fake Google Calendar API."""

import contextlib
import copy
import io
import json
import unittest
import urllib.parse
from datetime import date

from release_schedule import calendar_sync, schedule

TODAY = date(2026, 11, 20)


class FakeCalendarAPI:
    """Just enough of Google Calendar's events endpoints, as ``api.request``."""

    def __init__(self, events=(), page_size=1000):
        self.events = {e["id"]: copy.deepcopy(e) for e in events}
        self.page_size = page_size
        self.calls = []
        self.next_id = 1

    def __call__(self, method, url, token, body=None):
        self.calls.append((method, url.split("?")[0].rsplit("/", 1)[-1], body))
        parsed = urllib.parse.urlparse(url)
        query = dict(urllib.parse.parse_qsl(parsed.query))
        if method == "GET":
            key, value = query["privateExtendedProperty"].split("=")
            matching = [e for e in self.events.values()
                        if e.get("extendedProperties", {}).get("private", {}).get(key) == value
                        and e["end"]["date"] > query["timeMin"][:10]]
            start = int(query.get("pageToken", 0))
            page = matching[start:start + self.page_size]
            result = {"items": copy.deepcopy(page)}
            if start + self.page_size < len(matching):
                result["nextPageToken"] = str(start + self.page_size)
            return result
        if method == "POST":
            event = dict(copy.deepcopy(body), id=f"new{self.next_id}", created=f"2026-11-20T00:00:{self.next_id:02d}Z")
            self.next_id += 1
            self.events[event["id"]] = event
            return event
        event_id = urllib.parse.unquote(parsed.path.rsplit("/", 1)[-1])
        if method == "PUT":
            self.events[event_id] = dict(copy.deepcopy(body), id=event_id, created=self.events[event_id]["created"])
            return self.events[event_id]
        if method == "DELETE":
            del self.events[event_id]
            return None
        raise AssertionError(method)


class SyncTest(unittest.TestCase):
    def setUp(self):
        self.sched = schedule.load()
        self.desired = calendar_sync.desired_events(self.sched, TODAY)

    def run_sync(self, api, dry_run=False):
        calendar = calendar_sync.GoogleCalendar("release-dates@group.calendar.google.com", "token", api)
        with contextlib.redirect_stdout(io.StringIO()):
            return calendar_sync.sync(self.sched, calendar, TODAY, dry_run)

    def test_desired_events(self):
        body = self.desired[("v12.2", "code_freeze")]
        self.assertEqual(body["summary"], "v12.2 & Mobile v2.47 Code Freeze")
        self.assertEqual((body["start"], body["end"]), ({"date": "2026-12-08"}, {"date": "2026-12-09"}))
        self.assertEqual(body["extendedProperties"]["private"],
                         {"release_schedule": "1", "version": "v12.2", "milestone": "code_freeze"})
        # Before automate_from (v12.1), and v12.2's branch cut on Nov 10, are in the past or not managed.
        self.assertNotIn(("v12.1", "release_day"), self.desired)
        self.assertNotIn(("v12.2", "branch_cut"), self.desired)
        self.assertIn(("v12.2", "feature_complete"), self.desired)
        self.assertEqual(self.desired[("v12.4", "release_day")]["summary"],
                         "v12.4 & Mobile v2.49 & Desktop v6.5 Release Day")

    def test_creates_everything_on_an_empty_calendar_then_does_nothing(self):
        api = FakeCalendarAPI()
        actions = self.run_sync(api)
        self.assertEqual({a.kind for a in actions}, {"create"})
        self.assertEqual(len(api.events), len(self.desired))
        self.assertEqual(self.run_sync(FakeCalendarAPI(api.events.values())), [])

    def test_updates_moved_and_renamed_events_and_deletes_extras(self):
        api = FakeCalendarAPI()
        self.run_sync(api)
        by_key = {calendar_sync._key(e): e for e in api.events.values()}
        moved = by_key[("v12.2", "code_freeze")]
        moved["start"], moved["end"] = {"date": "2026-12-07"}, {"date": "2026-12-08"}
        by_key[("v12.3", "rc1")]["summary"] = "renamed by hand"
        stale = dict(copy.deepcopy(by_key[("v12.4", "rc1")]), id="stale")
        stale["extendedProperties"]["private"]["milestone"] = "launch_party"
        duplicate = dict(copy.deepcopy(by_key[("v12.5", "rc1")]), id="zz-duplicate", created="2026-11-21T00:00:00Z")
        api.events.update({"stale": stale, "zz-duplicate": duplicate})

        actions = self.run_sync(api)
        self.assertEqual([(a.kind, a.key) for a in actions], [
            ("delete", ("v12.4", "launch_party")),
            ("delete", ("v12.5", "rc1")),
            ("update", ("v12.2", "code_freeze")),
            ("update", ("v12.3", "rc1")),
        ])
        self.assertNotIn("zz-duplicate", api.events)
        self.assertIn(by_key[("v12.5", "rc1")]["id"], api.events)
        self.assertEqual(api.events[moved["id"]]["start"], {"date": "2026-12-08"})
        self.assertEqual(self.run_sync(api), [])

    def test_leaves_unmanaged_and_past_events_alone(self):
        hand_made = {"id": "hand", "summary": "v12.2 Code Freeze", "start": {"date": "2026-12-08"},
                     "end": {"date": "2026-12-09"}, "created": "2026-01-01T00:00:00Z"}
        past = {"id": "past", "summary": "v12.2 Release Branch Cut", "start": {"date": "2026-11-10"},
                "end": {"date": "2026-11-11"}, "created": "2026-01-01T00:00:00Z",
                "extendedProperties": {"private": {"release_schedule": "1", "version": "v12.2",
                                                   "milestone": "branch_cut"}}}
        api = FakeCalendarAPI([hand_made, past])
        actions = self.run_sync(api)
        self.assertEqual({a.kind for a in actions}, {"create"})
        self.assertIn("hand", api.events)
        self.assertIn("past", api.events)
        plan = calendar_sync.plan(self.desired, [dict(past, end={"date": "2026-11-21"}, start={"date": "2026-11-10"})], TODAY)
        self.assertNotIn("delete", {a.kind for a in plan})

    def test_actions_in_version_order(self):
        actions = calendar_sync.plan(self.desired, [], TODAY)
        versions = list(dict.fromkeys(a.key[0] for a in actions))
        self.assertEqual(versions[:10], ["v12.2", "v12.3", "v12.4", "v12.5", "v12.6", "v12.7", "v12.8", "v12.9",
                                         "v12.10", "v12.11"])

    def test_dry_run_changes_nothing(self):
        api = FakeCalendarAPI()
        actions = self.run_sync(api, dry_run=True)
        self.assertEqual(len(actions), len(self.desired))
        self.assertEqual(api.events, {})
        self.assertEqual({c[0] for c in api.calls}, {"GET"})

    def test_pages_through_events(self):
        api = FakeCalendarAPI(page_size=7)
        self.run_sync(api)
        listed = calendar_sync.GoogleCalendar("id", "token", api).managed_events(TODAY)
        self.assertEqual(len(listed), len(self.desired))

    def test_calendar_id_is_escaped(self):
        self.assertIn("a%23b%40group.calendar.google.com", calendar_sync.GoogleCalendar("a#b@group.calendar.google.com", "t").base)

    def test_without_credentials_lists_the_events(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(calendar_sync.main(["--today", TODAY.isoformat(), "--calendar-id", ""]), 0)
        self.assertIn("2026-12-08  v12.2 & Mobile v2.47 Code Freeze", out.getvalue())

    def test_bodies_are_json(self):
        json.dumps(self.desired[("v12.2", "release_day")])


if __name__ == "__main__":
    unittest.main()
