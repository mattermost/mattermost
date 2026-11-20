"""Working days, Monday to Friday, and T-N from a Release Day."""

import unittest
from datetime import date

from release_docs import schedule


class WorkingDaysTest(unittest.TestCase):
    def test_t_minus_counts_working_days_back_over_a_weekend(self):
        # v12.2: Release Day Wednesday 2026-12-16, T-2 the Monday before it; a Monday's T-2 is the Thursday before.
        self.assertEqual(schedule.t_minus(date(2026, 12, 16), 2), date(2026, 12, 14))
        self.assertEqual(schedule.t_minus(date(2027, 2, 15), 2), date(2027, 2, 11))

    def test_a_weekend_day_runs_on_the_next_monday(self):
        self.assertEqual(schedule.due_on(date(2027, 5, 15)), date(2027, 5, 17))  # a Saturday
        self.assertEqual(schedule.due_on(date(2027, 5, 14)), date(2027, 5, 14))


if __name__ == "__main__":
    unittest.main()
