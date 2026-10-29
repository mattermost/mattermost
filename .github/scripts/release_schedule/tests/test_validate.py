"""validate.py on the real file and on broken copies of it."""

import contextlib
import io
import tempfile
import unittest
from datetime import date
from pathlib import Path

from release_schedule import generate, validate
from release_schedule.schedule import SCHEDULE_PATH

REAL = SCHEDULE_PATH.read_text(encoding="utf-8")


def with_override(version, milestone, day, reason="Testing"):
    text = REAL.replace(
        "overrides: []\n",
        f"overrides:\n  - version: {version}\n    milestone: {milestone}\n    date: {day}\n    reason: \"{reason}\"\n",
    )
    return generate.regenerate(text)


class RealFileTest(unittest.TestCase):
    def test_passes(self):
        self.assertEqual(validate.validate(REAL), [])

    def test_covers_a_year_from_now(self):
        self.assertEqual(validate.validate(REAL, date(2026, 10, 29), 12), [])

    def test_cli(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(validate.main(["--path", str(SCHEDULE_PATH)]), 0)
        self.assertIn("OK", out.getvalue())


class BrokenFileTest(unittest.TestCase):
    def test_hand_edited_date(self):
        text = REAL.replace("      code_freeze: 2026-12-08                  # T-6",
                            "      code_freeze: 2026-12-07                  # T-6")
        self.assertNotEqual(text, REAL)
        errors = validate.validate(text)
        self.assertEqual(len(errors), 1)
        self.assertIn("isn't what generate.py writes", errors[0])
        self.assertIn("-      code_freeze: 2026-12-07                  # T-6", errors[0])
        self.assertIn("+      code_freeze: 2026-12-08                  # T-6", errors[0])

    def test_new_holiday_without_regenerating(self):
        text = REAL.replace('  - {date: 2026-12-25, name: "Christmas Day"}\n',
                            '  - {date: 2026-12-09, name: "Company day off"}\n'
                            '  - {date: 2026-12-25, name: "Christmas Day"}\n')
        errors = validate.validate(text)
        self.assertTrue(any("isn't what generate.py writes" in e for e in errors))
        self.assertTrue(any("v12.2: final_build 2026-12-09 is a holiday (Company day off)" in e for e in errors))
        self.assertEqual(validate.validate(generate.regenerate(text)), [])

    def test_override_passes(self):
        self.assertEqual(validate.validate(with_override("v12.2", "code_freeze", "2026-12-07")), [])

    def test_override_on_a_weekend(self):
        errors = validate.validate(with_override("v12.2", "code_freeze", "2026-12-05"))
        self.assertEqual(errors, ["v12.2: code_freeze 2026-12-05 is on a Saturday"])

    def test_override_on_a_holiday(self):
        errors = validate.validate(with_override("v12.3", "rc1", "2026-12-25"))
        self.assertIn("v12.3: rc1 2026-12-25 is a holiday (Christmas Day)", errors)

    def test_override_out_of_order(self):
        errors = validate.validate(with_override("v12.2", "code_freeze", "2026-12-14"))
        self.assertIn("v12.2: final_build (2026-12-09) should be after code_freeze (2026-12-14)", errors)

    def test_release_day_after_the_16th(self):
        errors = validate.validate(with_override("v12.2", "release_day", "2026-12-17"))
        self.assertIn("v12.2: release_day 2026-12-17 is after the 16th", errors)

    def test_branch_cut_before_previous_final_build(self):
        errors = validate.validate(with_override("v12.2", "branch_cut", "2026-11-09"))
        self.assertIn("v12.2: branch_cut 2026-11-09 is not after v12.1's final_build (2026-11-09)", errors)

    def test_override_without_reason(self):
        text = REAL.replace("overrides: []\n",
                            "overrides:\n  - version: v12.2\n    milestone: rc1\n    date: 2026-11-25\n    reason: \"\"\n")
        self.assertEqual(validate.validate(text), ["overrides[0]: every override needs a reason"])

    def test_holidays_out_of_order(self):
        text = REAL.replace('  - {date: 2026-01-01, name: "New Year\'s Day"}\n', "")
        text = text.replace(
            '  - {date: 2031-12-26, name: "Boxing Day (Canada)"}\n',
            '  - {date: 2031-12-26, name: "Boxing Day (Canada)"}\n  - {date: 2026-01-01, name: "New Year\'s Day"}\n')
        self.assertIn("holidays should be in date order", validate.validate(text))

    def test_unparseable(self):
        self.assertTrue(validate.validate("version: 1\nreleases: [\n")[0].startswith("schedule.yml:"))

    def test_running_out(self):
        errors = validate.validate(REAL, date(2031, 1, 1), 12)
        self.assertEqual(len(errors), 1)
        self.assertIn("extend it with", errors[0])

    def test_cli_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "schedule.yml"
            path.write_text(REAL.replace("esr: true", "esr: false", 1), encoding="utf-8")
            with contextlib.redirect_stderr(io.StringIO()) as err:
                self.assertEqual(validate.main(["--path", str(path)]), 1)
            self.assertIn("-    esr: false", err.getvalue())


if __name__ == "__main__":
    unittest.main()
