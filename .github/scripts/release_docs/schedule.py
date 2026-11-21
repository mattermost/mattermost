"""Working days: Monday to Friday.

T-N counts N working days back from Release Day (the ``vX.Y.0`` milestone's due date). Public
holidays aren't known here, so a T-N date can fall on one; the checks that use it only decide
from which day a missing input fails, so a holiday makes them strict one day early at most.
"""

from datetime import date, timedelta


def is_working_day(day: date) -> bool:
    return day.weekday() < 5


def add_working_days(start: date, count: int) -> date:
    """The working day ``count`` working days after (negative: before) ``start``."""
    step = 1 if count >= 0 else -1
    day, remaining = start, abs(count)
    while remaining:
        day += timedelta(days=step)
        if is_working_day(day):
            remaining -= 1
    return day


def due_on(planned: date) -> date:
    """The day a task planned for ``planned`` runs: that day, or the next working day."""
    while not is_working_day(planned):
        planned += timedelta(days=1)
    return planned


def t_minus(release_day: date, count: int) -> date:
    """T-``count``: ``count`` working days before Release Day."""
    return add_working_days(release_day, -count)
