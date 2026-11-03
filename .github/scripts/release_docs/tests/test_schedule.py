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

    def test_release_month_from_the_anchor(self):
        self.assertEqual(schedule.release_month(Version(12, 4)), (2027, 2))
        with self.assertRaises(ValueError):
            schedule.release_month(Version(13, 0))


if __name__ == "__main__":
    unittest.main()
