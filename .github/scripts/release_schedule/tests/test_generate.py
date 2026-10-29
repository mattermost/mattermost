"""The rules generate.py builds the schedule from."""

import contextlib
import io
import tempfile
import unittest
from datetime import date
from pathlib import Path

from release_schedule import generate, schedule, yamlio
from release_schedule.generate import InputError, Inputs, Override

HOLIDAYS = {date(2026, 10, 12): "Thanksgiving (Canada)", date(2026, 11, 26): "Thanksgiving (US)",
            date(2026, 12, 25): "Christmas Day", date(2026, 12, 28): "Boxing Day (Canada)",
            date(2027, 1, 1): "New Year's Day"}


def inputs(**changes) -> Inputs:
    values = dict(start_version="v12.1", start_month=(2026, 11), start_mobile="v2.46", start_desktop="v6.4",
                  through=(2027, 3), automate_from="v12.2", known_esrs=["v12.4"], holidays=dict(HOLIDAYS),
                  overrides=[])
    values.update(changes)
    return Inputs(**values)


def by_version(releases):
    return {r.version: r for r in releases}


class RulesTest(unittest.TestCase):
    def test_release_day_is_the_16th_or_the_working_day_before(self):
        self.assertEqual(generate.release_day(2026, 12, {}), date(2026, 12, 16))
        self.assertEqual(generate.release_day(2027, 1, {}), date(2027, 1, 15))   # Sat the 16th
        self.assertEqual(generate.release_day(2026, 8, {}), date(2026, 8, 14))   # Sun the 16th
        self.assertEqual(generate.release_day(2026, 12, {date(2026, 12, 16): "x"}), date(2026, 12, 15))

    def test_t_offsets_skip_weekends_and_holidays(self):
        ms = by_version(generate.build(inputs()))["v12.2"].milestones
        self.assertEqual(ms["release_day"], date(2026, 12, 16))
        self.assertEqual(ms["final_build"], date(2026, 12, 9))
        self.assertEqual(ms["code_freeze"], date(2026, 12, 8))
        # T-15 and T-16 count back over Thanksgiving (US) on Nov 26.
        self.assertEqual(ms["rc1"], date(2026, 11, 24))
        self.assertEqual(ms["feature_complete"], date(2026, 11, 23))

    def test_t_offsets_skip_holidays(self):
        ms = by_version(generate.build(inputs()))["v12.3"].milestones
        self.assertEqual(ms["release_day"], date(2027, 1, 15))
        # T-16 counts back over Jan 1, Dec 28 and Dec 25.
        self.assertEqual(ms["feature_complete"], date(2026, 12, 21))
        without = by_version(generate.build(inputs(holidays={})))["v12.3"].milestones
        self.assertEqual(without["feature_complete"], date(2026, 12, 24))

    def test_no_milestone_on_a_weekend_or_holiday(self):
        for release in generate.build(inputs()):
            for milestone, day in release.milestones.items():
                self.assertTrue(schedule.is_working_day(day, HOLIDAYS), f"{release.version} {milestone} {day}")

    def test_enterprise_moves_off_a_friday(self):
        release = by_version(generate.build(inputs()))["v12.2"]
        # T-3 is Fri Dec 11, so Enterprise goes out the day before.
        self.assertEqual(release.milestones["cloud_enterprise"], date(2026, 12, 10))
        self.assertIn("moved off a Friday", release.notes["cloud_enterprise"])
        v12_1 = by_version(generate.build(inputs()))["v12.1"]
        self.assertEqual(v12_1.milestones["cloud_enterprise"], date(2026, 11, 11))
        for release in generate.build(inputs(through=(2030, 12))):
            self.assertNotEqual(release.milestones["cloud_enterprise"].weekday(), 4, release.version)

    def test_branch_cut_is_the_working_day_after_the_previous_final_build(self):
        releases = generate.build(inputs())
        for previous, release in zip(releases, releases[1:]):
            self.assertEqual(release.milestones["branch_cut"],
                             schedule.add_working_days(previous.milestones["final_build"], 1, HOLIDAYS))
            self.assertEqual(release.notes["branch_cut"], f"working day after {previous.version} final_build")
        # v12.0's Final Build is Oct 8, as T-5 skips Thanksgiving (Canada) on Oct 12.
        self.assertEqual(releases[0].milestones["branch_cut"], date(2026, 10, 9))
        self.assertEqual(releases[0].notes["branch_cut"], "working day after v12.0 final_build")

    def test_october_is_the_next_major(self):
        versions = [r.version for r in generate.build(inputs(through=(2027, 11)))]
        self.assertEqual(versions[-3:], ["v12.11", "v13.0", "v13.1"])

    def test_esr_every_nine_months_after_the_last_known(self):
        releases = generate.build(inputs(through=(2029, 6)))
        self.assertEqual([r.version for r in releases if r.esr], ["v12.4", "v13.1", "v13.10", "v14.7"])

    def test_known_esrs_off_cadence_are_kept(self):
        releases = generate.build(inputs(known_esrs=["v12.4", "v12.6"], through=(2028, 3)))
        self.assertEqual([r.version for r in releases if r.esr], ["v12.4", "v12.6", "v13.3"])

    def test_known_esr_outside_the_range(self):
        with self.assertRaisesRegex(InputError, "v9.9"):
            generate.build(inputs(known_esrs=["v9.9"]))

    def test_no_known_esrs(self):
        self.assertFalse(any(r.esr for r in generate.build(inputs(known_esrs=[]))))

    def test_mobile_monthly_and_desktop_every_three_months(self):
        releases = generate.build(inputs(through=(2027, 5)))
        self.assertEqual([r.mobile for r in releases], [f"v2.{n}" for n in range(46, 53)])
        self.assertEqual([r.desktop for r in releases], ["v6.4", None, None, "v6.5", None, None, "v6.6"])

    def test_support_end(self):
        releases = by_version(generate.build(inputs()))
        self.assertEqual(releases["v12.2"].support_end, date(2027, 3, 15))
        self.assertEqual(releases["v12.4"].support_end, date(2028, 2, 15))

    def test_jira_fix_version_uses_release_day_month(self):
        self.assertEqual(by_version(generate.build(inputs()))["v12.2"].jira_fix_version, "v12.2 (December 2026)")
        v11_10 = generate.build(inputs(start_version="v11.10", start_month=(2026, 8), known_esrs=[]))[0]
        self.assertEqual(v11_10.jira_fix_version, "v11.10 (August 2026)")

    def test_through_before_start(self):
        with self.assertRaisesRegex(InputError, "before start"):
            generate.build(inputs(through=(2026, 1)))


class OverridesTest(unittest.TestCase):
    def test_applied_last_and_nothing_else_moves(self):
        base = by_version(generate.build(inputs()))
        moved = by_version(generate.build(inputs(overrides=[
            Override("v12.2", "final_build", date(2026, 12, 10), "Build infra outage"),
        ])))
        self.assertEqual(moved["v12.2"].milestones["final_build"], date(2026, 12, 10))
        self.assertEqual(moved["v12.2"].notes["final_build"], "override (the rules give 2026-12-09)")
        self.assertEqual(moved["v12.3"].milestones["branch_cut"], base["v12.3"].milestones["branch_cut"])
        self.assertEqual(moved["v12.2"].milestones["code_freeze"], base["v12.2"].milestones["code_freeze"])

    def test_release_day_override_moves_support_end(self):
        moved = by_version(generate.build(inputs(overrides=[
            Override("v12.4", "release_day", date(2027, 3, 1), "Slipped a fortnight"),
        ])))
        self.assertEqual(moved["v12.4"].support_end, date(2028, 3, 15))

    def test_unknown_release(self):
        with self.assertRaisesRegex(InputError, "v20.0"):
            generate.build(inputs(overrides=[Override("v20.0", "rc1", date(2026, 12, 1), "x")]))

    def test_two_overrides_for_one_milestone(self):
        twice = [Override("v12.2", "rc1", date(2026, 11, 25), "a"), Override("v12.2", "rc1", date(2026, 11, 26), "b")]
        with self.assertRaisesRegex(InputError, "two overrides"):
            generate.build(inputs(overrides=twice))

    def test_read_inputs_needs_a_reason_and_a_known_milestone(self):
        doc = yamlio.load(generate.render(inputs(), []))
        doc["overrides"] = [{"version": "v12.2", "milestone": "rc1", "date": date(2026, 11, 25), "reason": " "}]
        with self.assertRaisesRegex(InputError, "reason"):
            generate.read_inputs(doc)
        doc["overrides"][0].update(reason="ok", milestone="launch")
        with self.assertRaisesRegex(InputError, "milestone should be one of"):
            generate.read_inputs(doc)
        doc["overrides"][0].update(milestone="rc1", date="soon")
        with self.assertRaisesRegex(InputError, "date"):
            generate.read_inputs(doc)


class RenderTest(unittest.TestCase):
    def test_round_trip(self):
        original = inputs(overrides=[Override("v12.2", "rc1", date(2026, 11, 25), 'QA asked for a day: "rc1"')])
        text = generate.render(original, generate.build(original))
        self.assertEqual(generate.regenerate(text), text)
        parsed = schedule.parse(text)
        self.assertEqual(parsed.release("v12.2").milestones["rc1"], date(2026, 11, 25))
        self.assertEqual(generate.read_inputs(yamlio.load(text)), original)

    def test_milestone_lines_carry_their_rule(self):
        text = generate.render(inputs(), generate.build(inputs()))
        self.assertIn("      feature_complete: 2026-11-23             # T-16\n", text)
        self.assertIn("      branch_cut: 2026-11-10                   # working day after v12.1 final_build\n", text)
        self.assertIn("      cloud_enterprise: 2026-12-10             # T-3, moved off a Friday\n", text)
        self.assertIn('    jira_fix_version: "v12.2 (December 2026)"\n', text)

    def test_cli_extends_by_years(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "schedule.yml"
            path.write_text(generate.render(inputs(), []), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(generate.main(["--path", str(path), "--years", "1", "--today", "2026-11-02"]), 0)
                self.assertEqual(generate.main(["--path", str(path)]), 0)
            self.assertEqual(schedule.load(path).releases[-1].version, "v13.1")

    def test_cli_reports_input_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "schedule.yml"
            path.write_text(generate.render(inputs(known_esrs=["v1.0"]), []), encoding="utf-8")
            with contextlib.redirect_stderr(io.StringIO()) as err:
                self.assertEqual(generate.main(["--path", str(path)]), 1)
            self.assertIn("v1.0", err.getvalue())


if __name__ == "__main__":
    unittest.main()
