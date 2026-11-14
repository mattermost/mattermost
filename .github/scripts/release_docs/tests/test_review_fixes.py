"""Regression tests for review fixes: label negation, cancelled events, release naming."""

import os
import unittest

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)

from release_docs import breaking, calendar, key_dates  # noqa: E402
from release_docs import hub as hublib  # noqa: E402

from .hub_fakes import FakeHub, playbook_run  # noqa: E402


class Release:
    class version:
        short = "v12.3"
    mobile = "v2.48"


class ReviewFixesTest(unittest.TestCase):
    def test_negated_labels_are_not_signals(self):
        self.assertTrue(breaking._is_signal("Breaking-Change"))
        self.assertTrue(breaking._is_signal("Deprecation"))
        self.assertFalse(breaking._is_signal("Non-breaking"))
        self.assertFalse(breaking._is_signal("No deprecation"))

    def test_cancelled_calendar_events_are_skipped(self):
        ics = ("BEGIN:VEVENT\nSUMMARY:v12.3 Release Day\nDTSTART;VALUE=DATE:20261116\nSTATUS:CANCELLED\nEND:VEVENT\n"
               "BEGIN:VEVENT\nSUMMARY:v12.4 Release Day\nDTSTART;VALUE=DATE:20261216\nEND:VEVENT\n")
        self.assertEqual([e.summary for e in calendar.parse_ics(ics)], ["v12.4 Release Day"])

    def test_names_release_matches_zero_patch_and_case_but_not_dot_releases(self):
        self.assertTrue(key_dates.names_release("v12.3.0 Release Day", Release))
        self.assertTrue(key_dates.names_release("V12.3 release day", Release))
        self.assertFalse(key_dates.names_release("v12.3.1 Release Day", Release))
        self.assertTrue(key_dates.names_release("Mobile v2.48 Release Day", Release))

    def test_a_refused_tick_is_reported_not_raised(self):
        class Refusing(FakeHub):
            def close_item(self, run_id, checklist, item):
                raise hublib.HubError(403)

        hub = Refusing([], playbook_run("release", "Queue the Twitter announcement for the release"))
        note = hublib.tick(hub, hub.run, ["Queue the Twitter announcement for the release"], True)
        self.assertEqual(note, 'could not tick "Queue the Twitter announcement for the release": Hub request failed (HTTP 403); '
                               'the Hub bot must be a participant of the playbook run')
        self.assertEqual(hub.writes, [])


if __name__ == "__main__":
    unittest.main()
