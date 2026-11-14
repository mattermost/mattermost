"""The release schedule as code, against the holidays on the Release Processes Overview page."""

import unittest
from datetime import date

from release_docs import schedule
from release_docs.versions import Version

from .fakes import fixture

COLUMNS = ("branch_cut", "feature_complete", "rc1", "code_freeze", "final_build", "cloud_freemium_pro",
           "cloud_enterprise", "release_day")
# The release schedule table, computed with the holidays on the page. v12.2 and v12.3 match
# the Release Dates calendar.
EXPECTED = {
    "v12.2": ("", "2026-11-23", "2026-11-24", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-16"),
    "v12.3": ("2026-12-10", "2026-12-21", "2026-12-22", "2027-01-07", "2027-01-08", "2027-01-11", "2027-01-12", "2027-01-15"),
    "v12.4": ("2027-01-11", "2027-01-22", "2027-01-25", "2027-02-05", "2027-02-08", "2027-02-09", "2027-02-10", "2027-02-16"),
    "v12.5": ("2027-02-09", "2027-02-22", "2027-02-23", "2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-03-16"),
}


def holidays():
    return schedule.parse_holidays(fixture("holidays-page.html"))


def row(release: schedule.Schedule) -> tuple:
    values = {"branch_cut": release.branch_cut, "release_day": release.release_day, **release.dates}
    return tuple(values[c].isoformat() for c in COLUMNS)


class HolidaysTest(unittest.TestCase):
    def test_reads_every_date_under_each_year_heading(self):
        found = holidays()
        self.assertEqual(found.years, {2026, 2027})
        self.assertEqual(len([d for d in found.days if d.year == 2026]), 16)  # both countries, days off in both once
        self.assertIn(date(2026, 8, 3), found.days)  # "Civic Holiday (AB, BC, ON) (8/03/2026)": regional days count
        self.assertIn(date(2026, 12, 28), found.days)  # Boxing Day (ON)
        self.assertNotIn(date(2025, 12, 31), found.days)  # a date outside the holiday headings

    def test_a_year_not_on_the_page_is_never_guessed(self):
        with self.assertRaises(schedule.MissingHolidays) as raised:
            holidays().is_working_day(date(2028, 1, 3))
        self.assertEqual(raised.exception.years, [2028])


class ScheduleTest(unittest.TestCase):
    def test_v12_2_to_v12_5(self):
        releases = schedule.following(Version(12, 1), (2026, 11), holidays(), count=4)
        self.assertEqual([r.version.short for r in releases], ["v12.2", "v12.3", "v12.4", "v12.5"])
        for release in releases:
            expected = EXPECTED[release.version.short]
            got = row(release)
            if not expected[0]:  # v12.1's final build on the calendar is not on the rule; see the key dates test
                got, expected = got[1:], expected[1:]
            self.assertEqual(got, expected, release.version.short)

    def test_mobile_versions_and_split_release_day(self):
        v12_3 = schedule.following(Version(12, 2), (2026, 12), holidays(), count=1)[0]
        self.assertEqual(v12_3.mobile, "v2.48")
        self.assertEqual(v12_3.mobile_release_day, date(2027, 1, 14))  # Jan 16 is a Saturday: the Thursday before
        titles = [title for title, _ in v12_3.events()]
        self.assertIn("Mobile v2.48 Release Day", titles)
        self.assertIn("v12.3 Release Day", titles)
        self.assertNotIn("v12.3 & Mobile v2.48 Release Day", titles)
        v12_2 = schedule.following(Version(12, 1), (2026, 11), holidays(), count=1)[0]
        self.assertIn(("v12.2 & Mobile v2.47 Release Day", date(2026, 12, 16)), v12_2.events())
        self.assertEqual(len(v12_2.events()), 8)

    def test_release_month_from_jira_then_the_anchor(self):
        jira = schedule.JiraVersions(FIX_VERSIONS)
        self.assertEqual(schedule.release_month(Version(13, 0), jira), (2027, 10))  # v13.x from Jira
        self.assertEqual(schedule.release_month(Version(12, 4), jira), (2027, 2))  # not in Jira: the anchor
        with self.assertRaises(ValueError):
            schedule.release_month(Version(13, 5), jira)  # neither knows it
        with self.assertRaises(ValueError):
            schedule.release_month(Version(13, 0))


# The Jira versions API's names around a server and a mobile major version bump.
FIX_VERSIONS = [{"id": str(n), "name": name} for n, name in enumerate((
    "v12.11 (September 2027)", "v2.56 Mobile (September 2027)",
    "v13.0 (October 2027)", "v3.0 Mobile (October 2027)",
    "v13.1 (November 2027)", "v3.1 Mobile (November 2027)",
    "v12.11.1", "v13.0.1",  # dot releases are not months' fix versions
))]


class JiraVersionsTest(unittest.TestCase):
    def test_v13_0_after_v12_11_comes_from_jira_and_the_difference_is_noted(self):
        notes = []
        releases = schedule.following(Version(12, 11), (2027, 9), holidays(), jira=schedule.JiraVersions(FIX_VERSIONS),
                                      notes=notes)
        self.assertEqual([r.version.short for r in releases], ["v13.0", "v13.1"])
        self.assertIn("v13.0 & Mobile v3.0 Release Branch Cut", [title for title, _ in releases[0].events()])
        self.assertEqual(notes, [
            "Jira's fix version for October 2027 is v13.0, not v12.12 as worked out from the month before; Jira's is used.",
            "Jira's mobile fix version for October 2027 is v3.0, not v2.57 as worked out from the month before; "
            "Jira's is used.",
        ])  # November follows on from Jira's October, so it isn't noted

    def test_mobile_major_bump(self):
        jira = schedule.JiraVersions(FIX_VERSIONS)
        self.assertEqual(schedule.mobile_version((2027, 10), jira), "v3.0")
        self.assertEqual(schedule.mobile_version((2027, 11), jira), "v3.1")
        releases = schedule.following(Version(12, 11), (2027, 9), holidays(), jira=jira)
        self.assertEqual([r.mobile for r in releases], ["v3.0", "v3.1"])
        self.assertIn("Mobile v3.1 Release Day", " ".join(title for title, _ in releases[1].events()))

    def test_a_month_without_a_fix_version_is_worked_out_with_a_note(self):
        jira = schedule.JiraVersions([{"name": "v12.2 (December 2026)"}, {"name": "v2.47 Mobile (December 2026)"},
                                      {"name": "v12.3 (January 2027)"}, {"name": "v2.48 Mobile (January 2027)"}])
        notes = []
        releases = schedule.following(Version(12, 2), (2026, 12), holidays(), jira=jira, notes=notes)
        self.assertEqual([(r.version.short, r.mobile) for r in releases], [("v12.3", "v2.48"), ("v12.4", "v2.49")])
        self.assertEqual(notes, [
            "No Jira fix version for February 2027, so the version was worked out: v12.4. Check it.",
            "No Jira mobile fix version for February 2027, so the version was worked out: v2.49. Check it.",
        ])

    def test_two_fix_versions_for_one_month_are_not_trusted(self):
        jira = schedule.JiraVersions([{"name": "v13.0 (October 2027)"}, {"name": "v12.12 (October 2027)"}])
        self.assertNotIn((2027, 10), jira.server)


if __name__ == "__main__":
    unittest.main()
