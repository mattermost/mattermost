"""The real schedule.yml and the query helpers every workflow uses."""

import unittest
from datetime import date

from release_schedule import schedule

# Release days and support ends from docs/main/product-overview/mattermost-server-releases.mdx
# and release-policy.mdx; Mobile from mattermost-mobile-releases.mdx, Desktop from
# desktop-app-changelog.mdx and the release policy's ESR list.
PUBLISHED = {
    "v11.7": (date(2026, 5, 15), date(2027, 5, 15)),
    "v11.8": (date(2026, 6, 16), date(2026, 9, 15)),
    "v11.9": (date(2026, 7, 16), date(2026, 10, 15)),
    "v11.10": (date(2026, 8, 14), date(2026, 11, 15)),
    "v11.11": (date(2026, 9, 16), date(2026, 12, 15)),
    "v12.0": (date(2026, 10, 16), date(2027, 1, 15)),
    "v12.1": (date(2026, 11, 16), date(2027, 2, 15)),
}


class RealScheduleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = schedule.load()

    def test_published_release_days_and_support_ends(self):
        for version, (release_day, support_end) in PUBLISHED.items():
            with self.subTest(version):
                self.assertEqual(self.s.release(version).release_day, release_day)
                self.assertEqual(self.s.support_end(version), support_end)

    def test_v11_7_esr(self):
        r = self.s.release("v11.7")
        self.assertTrue(r.esr)
        self.assertEqual((r.mobile, r.desktop), ("v2.40", "v6.2"))
        self.assertEqual(r.jira_fix_version, "v11.7 (May 2026)")
        self.assertEqual(r.support_end, date(2027, 5, 15))

    def test_v12_0(self):
        r = self.s.release("v12.0")
        self.assertFalse(r.esr)
        self.assertEqual(r.mobile, "v2.45")
        self.assertEqual(r.jira_fix_version, "v12.0 (October 2026)")
        self.assertEqual(r.event_title("release_day"), "v12.0 & Mobile v2.45 Release Day")

    def test_v12_1(self):
        r = self.s.release("v12.1")
        # The Release Dates calendar has v12.1's Final Release Build Cut on Mon Nov 9.
        self.assertEqual(r.milestones["final_build"], date(2026, 11, 9))
        self.assertEqual(r.milestones["code_freeze"], date(2026, 11, 6))
        self.assertEqual(r.release_day, date(2026, 11, 16))
        self.assertEqual((r.mobile, r.desktop), ("v2.46", "v6.4"))
        self.assertEqual(r.event_title("code_freeze"), "v12.1 & Mobile v2.46 Code Freeze")

    def test_v12_2_branch_cut_is_the_working_day_after_v12_1_final_build(self):
        self.assertEqual(self.s.release("v12.2").milestones["branch_cut"], date(2026, 11, 10))

    def test_planned_v12_4_esr(self):
        r = self.s.release("v12.4")
        self.assertTrue(r.esr)
        self.assertEqual(r.release_day, date(2027, 2, 16))
        self.assertEqual(r.support_end, date(2028, 2, 15))
        self.assertEqual((r.mobile, r.desktop), ("v2.49", "v6.5"))
        self.assertEqual(r.event_title("release_day"), "v12.4 & Mobile v2.49 & Desktop v6.5 Release Day")

    def test_mobile_releases_monthly(self):
        for version, mobile in {"v12.2": "v2.47", "v12.3": "v2.48"}.items():
            self.assertEqual(self.s.release(version).mobile, mobile)

    def test_v12_3_release_day_moves_off_saturday_the_16th(self):
        self.assertEqual(self.s.release("v12.3").release_day, date(2027, 1, 15))

    def test_esrs_every_nine_months_after_the_known_ones(self):
        esrs = [r.version for r in self.s.esrs()]
        self.assertEqual(esrs[:3], ["v11.7", "v12.4", "v13.1"])
        months = [r.release_day.year * 12 + r.release_day.month for r in self.s.esrs()]
        self.assertEqual({b - a for a, b in zip(months, months[1:])}, {9})

    def test_generated_five_years_ahead(self):
        self.assertGreaterEqual(self.s.releases[-1].release_day, date(2031, 10, 1))

    def test_every_release_is_one_month_after_the_last(self):
        months = [r.release_day.year * 12 + r.release_day.month for r in self.s.releases]
        self.assertEqual(months, list(range(months[0], months[0] + len(months))))

    def test_majors_are_in_october(self):
        for r in self.s.releases:
            self.assertEqual(r.minor == 0, r.release_day.month == 10, r.version)


class HelpersTest(unittest.TestCase):
    def test_module_helpers_read_the_repo_file(self):
        self.assertEqual(schedule.release("v12.2").version, "v12.2")
        self.assertTrue(schedule.is_esr("v11.7"))
        self.assertFalse(schedule.is_esr("v12.2"))
        self.assertEqual(schedule.fix_version("v12.2"), "v12.2 (December 2026)")
        self.assertEqual(schedule.next_esr("v11.7").version, "v12.4")
        self.assertEqual(schedule.next_esr("v12.4").version, "v13.1")
        self.assertEqual(schedule.support_end("v12.0"), date(2027, 1, 15))

    def test_versions_in_any_form(self):
        for text in ("v12.2", "12.2", "v12.2.0", "v12.2.1", " v12.2 "):
            self.assertEqual(schedule.release(text).version, "v12.2")
        self.assertEqual(schedule.release("v12.2").tag, "v12.2.0")
        self.assertEqual(schedule.release("v12.2").branch, "release-12.2")
        with self.assertRaises(ValueError):
            schedule.parse_version("twelve")
        with self.assertRaises(KeyError):
            schedule.release("v9.0")

    def test_next_esr_after_a_version_outside_the_schedule(self):
        self.assertEqual(schedule.next_esr("v10.11").version, "v11.7")

    def test_is_automated_from_automate_from(self):
        self.assertFalse(schedule.is_automated("v12.1"))
        self.assertTrue(schedule.is_automated("v12.2"))
        self.assertTrue(schedule.is_automated("v12.2.1"))
        self.assertFalse(schedule.is_automated("v99.0"))

    def test_milestones_on(self):
        found = [(r.version, m) for r, m in schedule.milestones_on(date(2026, 11, 10))]
        self.assertEqual(found, [("v12.1", "cloud_freemium_professional"), ("v12.2", "branch_cut")])
        self.assertEqual(schedule.milestones_on(date(2026, 11, 14)), [])

    def test_active_releases_overlap(self):
        self.assertEqual([r.version for r in schedule.active_releases(date(2026, 10, 29))], ["v12.1"])
        self.assertEqual([r.version for r in schedule.active_releases(date(2026, 11, 12))], ["v12.1", "v12.2"])
        self.assertEqual([r.version for r in schedule.active_releases(date(2026, 11, 17))], ["v12.2"])
        self.assertEqual([r.version for r in schedule.active_releases(date(2026, 11, 17), 1)], ["v12.1", "v12.2"])

    def test_working_days(self):
        holidays = {date(2026, 12, 25), date(2026, 12, 28)}
        self.assertEqual(schedule.add_working_days(date(2026, 12, 24), 1, holidays), date(2026, 12, 29))
        self.assertEqual(schedule.add_working_days(date(2026, 12, 29), -1, holidays), date(2026, 12, 24))
        self.assertEqual(schedule.add_working_days(date(2026, 12, 26), 0, holidays), date(2026, 12, 26))


class ParseErrorsTest(unittest.TestCase):
    BASE = (
        "version: 1\nautomate_from: v1.0\nholidays: []\nreleases:\n  - version: v1.0\n"
        "    esr: false\n    jira_fix_version: \"v1.0 (May 2026)\"\n    milestones:\n{milestones}"
        "    support_end: 2026-08-15\n    mobile: null\n    desktop: null\n"
    )

    def milestones(self, names):
        return "".join(f"      {m}: 2026-05-{i + 4:02d}\n" for i, m in enumerate(names))

    def test_parses(self):
        s = schedule.parse(self.BASE.format(milestones=self.milestones(schedule.MILESTONES)))
        self.assertEqual(s.release("v1.0").release_day, date(2026, 5, 11))

    def test_missing_milestone(self):
        with self.assertRaisesRegex(schedule.ScheduleError, "milestones must be exactly"):
            schedule.parse(self.BASE.format(milestones=self.milestones(schedule.MILESTONES[:-1])))

    def test_unknown_milestone(self):
        names = list(schedule.MILESTONES) + ["launch_party"]
        with self.assertRaisesRegex(schedule.ScheduleError, "milestones must be exactly"):
            schedule.parse(self.BASE.format(milestones=self.milestones(names)))

    def test_wrong_format_version(self):
        with self.assertRaisesRegex(schedule.ScheduleError, "format version"):
            schedule.parse("version: 2\n")


if __name__ == "__main__":
    unittest.main()
