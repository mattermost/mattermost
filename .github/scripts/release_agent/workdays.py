"""Working-day arithmetic for T-days: weekends and holidays don't count."""

from datetime import date, timedelta


def is_working_day(day: date, holidays: frozenset) -> bool:
    return day.weekday() < 5 and day not in holidays


def add_working_days(start: date, days: int, holidays: frozenset) -> date:
    """The working day ``days`` working days after (or, if negative, before) ``start``.

    ``start`` itself need not be a working day; ``add_working_days(d, 0)`` returns ``d``.
    """
    step = 1 if days >= 0 else -1
    day, remaining = start, abs(days)
    while remaining:
        day += timedelta(days=step)
        if is_working_day(day, holidays):
            remaining -= 1
    return day


def working_days_between(start: date, end: date, holidays: frozenset) -> int:
    """Working days in (start, end], negated when ``end`` is before ``start``."""
    if end < start:
        return -working_days_between(end, start, holidays)
    count, day = 0, start
    while day < end:
        day += timedelta(days=1)
        if is_working_day(day, holidays):
            count += 1
    return count


def t_day(today: date, release_day: date, holidays: frozenset) -> int:
    """Today's T-day: -5 is five working days before Release Day (T-5), 0 is the day itself."""
    return -working_days_between(today, release_day, holidays)


def format_t_day(value: int | None) -> str:
    if value is None:
        return "T-?"
    return f"T-{-value}" if value <= 0 else f"T+{value}"
