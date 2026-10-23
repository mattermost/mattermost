import unittest
from datetime import date

from release_agent import release_calendar as rc
from release_agent import workdays
from release_agent.tests.fakes import fixture

MILESTONES = {
    "branch_cut": "Release Branch Cut",
    "feature_complete": "Feature Complete",
    "code_freeze": "Code Freeze",
    "final_build": "Final Build",
    "release_day": "Release Day",
}


def load():
    events = rc.parse_ics(fixture("release-dates.ics"))
    releases, notes = rc.releases_from_events(events, MILESTONES)
    holidays = rc.holidays_from(events, ["Holiday"], [])
    return events, releases, notes, holidays


class ParseIcsTest(unittest.TestCase):
    def test_titles_are_trimmed_unfolded_and_unescaped(self):
        summaries = [e.summary for e in rc.parse_ics(fixture("release-dates.ics"))]
        self.assertIn("v12.2 Release Branch Cut", summaries)
        self.assertIn("Mattermost v12.2 Code Freeze", summaries)
        self.assertIn("v12.3 Release Branch Cut", summaries)  # leading tab
        self.assertIn("v12.3 Code Freeze", summaries)  # folded line
        self.assertIn("Release planning, Q1", summaries)
        self.assertFalse(any(s != s.strip() for s in summaries))

    def test_dates_ignore_time_and_zone(self):
        events = {e.summary: e for e in rc.parse_ics(fixture("release-dates.ics"))}
        self.assertEqual(events["Mattermost v12.2 Code Freeze"].start, date(2026, 10, 28))
        self.assertEqual(events["v12.2 Release Day"].start, date(2026, 11, 16))

    def test_event_without_end_lasts_one_day(self):
        text = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261102\nSUMMARY:x\nEND:VEVENT\nEND:VCALENDAR\n"
        event = rc.parse_ics(text)[0]
        self.assertEqual((event.start, event.end), (date(2026, 11, 2), date(2026, 11, 3)))


class ReleasesTest(unittest.TestCase):
    def test_milestones_matched_on_substrings(self):
        _, releases, _, _ = load()
        self.assertEqual(releases[(12, 2)].milestones, {
            "branch_cut": date(2026, 10, 19),
            "feature_complete": date(2026, 10, 23),
            "code_freeze": date(2026, 10, 28),
            "final_build": date(2026, 11, 9),
            "release_day": date(2026, 11, 16),
        })
        self.assertEqual(releases[(12, 3)].milestones["code_freeze"], date(2026, 11, 25))

    def test_dot_release_events_are_ignored(self):
        _, releases, _, _ = load()
        self.assertEqual(releases[(12, 1)].release_day, date(2026, 10, 16))

    def test_milestone_without_version_is_noted(self):
        events = rc.parse_ics("BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261102\nSUMMARY: Code Freeze\nEND:VEVENT\n")
        releases, notes = rc.releases_from_events(events, MILESTONES)
        self.assertEqual(releases, {})
        self.assertIn("names no release version", notes[0])

    def test_two_releases_active_at_once(self):
        _, releases, _, _ = load()
        active = rc.active_releases(releases, date(2026, 11, 4), 1)
        self.assertEqual([r.short_version for r in active], ["v12.2", "v12.3"])

    def test_release_inactive_after_grace(self):
        _, releases, _, _ = load()
        self.assertEqual([r.short_version for r in rc.active_releases(releases, date(2026, 11, 17), 1)], ["v12.2", "v12.3"])
        self.assertEqual([r.short_version for r in rc.active_releases(releases, date(2026, 11, 18), 1)], ["v12.3"])
        self.assertEqual(rc.active_releases(releases, date(2026, 10, 18), 1), [])

    def test_holidays_from_calendar_and_rules(self):
        events, _, _, _ = load()
        holidays = rc.holidays_from(events, ["Holiday"], ["2026-12-24"])
        self.assertEqual(holidays, frozenset({date(2026, 11, 11), date(2026, 12, 24)}))


class DueTest(unittest.TestCase):
    def test_resolve_due(self):
        _, releases, _, holidays = load()
        release = releases[(12, 2)]
        self.assertEqual(rc.resolve_due("code_freeze", release, holidays), date(2026, 10, 28))
        self.assertEqual(rc.resolve_due("code_freeze+1", release, holidays), date(2026, 10, 29))
        self.assertEqual(rc.resolve_due("branch_cut-1", release, holidays), date(2026, 10, 16))  # skips the weekend
        self.assertEqual(rc.resolve_due("T-0", release, holidays), date(2026, 11, 16))
        self.assertEqual(rc.resolve_due("T-5", release, holidays), date(2026, 11, 6))  # skips the Nov 11 holiday
        self.assertIsNone(rc.resolve_due("rc1", release, holidays))


class TDayTest(unittest.TestCase):
    holidays = frozenset({date(2026, 11, 11)})

    def test_counts_working_days(self):
        release_day = date(2026, 11, 16)
        self.assertEqual(workdays.t_day(date(2026, 11, 16), release_day, frozenset()), 0)
        self.assertEqual(workdays.t_day(date(2026, 11, 13), release_day, frozenset()), -1)  # Fri before a Mon
        self.assertEqual(workdays.t_day(date(2026, 11, 4), release_day, frozenset()), -8)

    def test_holidays_do_not_count(self):
        self.assertEqual(workdays.t_day(date(2026, 11, 4), date(2026, 11, 16), self.holidays), -7)
        self.assertEqual(workdays.t_day(date(2026, 11, 10), date(2026, 11, 12), self.holidays), -1)

    def test_after_release_day(self):
        self.assertEqual(workdays.t_day(date(2026, 11, 17), date(2026, 11, 16), frozenset()), 1)
        self.assertEqual(workdays.format_t_day(1), "T+1")
        self.assertEqual(workdays.format_t_day(-7), "T-7")
        self.assertEqual(workdays.format_t_day(0), "T-0")

    def test_add_working_days(self):
        self.assertEqual(workdays.add_working_days(date(2026, 11, 10), 1, self.holidays), date(2026, 11, 12))
        self.assertEqual(workdays.add_working_days(date(2026, 11, 16), -5, self.holidays), date(2026, 11, 6))


class CrossCheckTest(unittest.TestCase):
    def setUp(self):
        _, self.releases, _, _ = load()

    def test_agreeing_calendar_and_git(self):
        flags = rc.cross_check(self.releases[(12, 2)], {(12, 1), (12, 2)}, {(12, 1)}, date(2026, 11, 4))
        self.assertEqual(flags, [])

    def test_branch_missing_after_cut(self):
        flags = rc.cross_check(self.releases[(12, 3)], {(12, 2)}, set(), date(2026, 11, 4))
        self.assertEqual(flags, ["The calendar has release-12.3 cut on 2026-11-02, but the branch doesn't exist."])

    def test_branch_cut_before_calendar(self):
        flags = rc.cross_check(self.releases[(12, 3)], {(12, 3)}, set(), date(2026, 10, 30))
        self.assertIn("release-12.3 exists, but the calendar has it cut on 2026-11-02.", flags)

    def test_tag_before_final_build(self):
        flags = rc.cross_check(self.releases[(12, 2)], {(12, 2)}, {(12, 2)}, date(2026, 11, 4))
        self.assertIn("v12.2.0 is tagged, but the calendar has the Final Build on 2026-11-09.", flags)

    def test_untracked_branch(self):
        flags = rc.untracked_branches(self.releases, {(12, 1), (12, 2), (12, 4)}, {(12, 1)})
        self.assertEqual(flags, ["release-12.4 is cut and untagged, but the calendar has no v12.4 milestones."])

    def test_rc_numbers(self):
        ls_remote = "a\trefs/tags/v12.2.0-rc1\nb\trefs/tags/v12.2.0-rc3\nc\trefs/tags/v12.2.0\nd\trefs/tags/v12.20.0-rc9\n"
        self.assertEqual(rc.rc_numbers(ls_remote, 12, 2), [1, 3])


if __name__ == "__main__":
    unittest.main()
