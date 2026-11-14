"""Key dates for the next two releases, added to the Release Dates calendar.

On Release Day of release N (and by hand), every event of releases N+1 and N+2 that isn't
on the calendar yet is created: all-day, free, no attendees, no notifications. An event a
person made is never moved or deleted; when its date differs from the computed one, the
difference goes to the release manager in Hub. Nothing is posted to a channel.
"""

import re
from datetime import timedelta

from . import hub as hublib
from . import schedule
from .result import Result

TASK = "key-dates"
PLAYBOOK_ITEMS = ["Add key dates for the next two releases to the Release Dates calendar.",
                  "Post upcoming key dates for the next two releases"]
WINDOW_MARGIN = timedelta(days=21)

# Milestones as people have titled them: v12.3's final build is "Release Build Cut", v12.1's
# branch cut was "Feature Complete and Release Branch Cut". Checked in order.
MILESTONE_WORDS = (
    ("cloud_freemium_pro", r"freemium|cloud professional"),
    ("cloud_enterprise", r"cloud enterprise"),
    ("rc1", r"\brc-?1\b"),
    ("code_freeze", r"code freeze"),
    ("final_build", r"(?<!branch )build cut"),
    ("branch_cut", r"branch cut"),
    ("feature_complete", r"feature complete"),
    ("release_day", r"release day"),
)


def clean(title: str) -> str:
    return " ".join((title or "").split())


def milestone_key(title: str) -> str | None:
    """("server"|"mobile", milestone) for a calendar title, e.g. Mobile v2.48 Release Day."""
    text = clean(title).casefold()
    for key, pattern in MILESTONE_WORDS:
        if re.search(pattern, text):
            if key == "release_day" and text.startswith("mobile"):
                return "mobile_release_day"
            return key
    return None


def names_release(title: str, release: schedule.Schedule) -> bool:
    text = clean(title)
    if milestone_key(text) == "mobile_release_day":
        return re.search(rf"Mobile {re.escape(release.mobile)}(?![\d.])", text, re.IGNORECASE) is not None
    # "v12.3 Release Day" or "v12.3.0 Release Day", not a dot release such as v12.3.1.
    return re.search(rf"(?<![\w.]){re.escape(release.version.short)}(?!\d)(?!\.[1-9])", text, re.IGNORECASE) is not None


def event_day(event: dict):
    from datetime import date
    start = event.get("start") or {}
    return date.fromisoformat((start.get("date") or start.get("dateTime") or "")[:10])


def plan(release: schedule.Schedule, existing: list[dict]) -> tuple[list, list]:
    """(events to create, differences): an event counts as there when an event with the same
    title, or the same milestone of the same release, is in the release's window."""
    mine = [e for e in existing if e.get("status") != "cancelled" and names_release(e.get("summary", ""), release)]
    create, differences = [], []
    for title, day in release.events():
        key = milestone_key(title)
        match = next((e for e in mine if clean(e.get("summary")) .casefold() == title.casefold()), None)
        match = match or next((e for e in mine if milestone_key(e.get("summary", "")) == key), None)
        if match is None:
            create.append((title, day))
        elif event_day(match) != day:
            differences.append((clean(match.get("summary")), event_day(match), day))
    return create, differences


def run(version, month, holidays: schedule.Holidays, calendar, hub, env: dict, live: bool,
        versions: schedule.JiraVersions | None = None) -> Result:
    """``versions``: the Jira fix versions that name each month's server and mobile versions."""
    result = Result(TASK, version.tag)
    try:
        releases = schedule.following(version, month, holidays, jira=versions, notes=result.notes)
    except schedule.MissingHolidays as err:
        result.todo(f"{err}: no key dates written. Add the year's holidays to the Release Processes Overview page")
        return result
    if calendar is None:
        result.todo("RELEASE_DOCS_GOOGLE_SA_KEY / RELEASE_DATES_CALENDAR_ID are not set, so the calendar can't be read")
    lines, all_differences, created = [], [], 0
    for release in releases:
        start, end = release.window
        existing = calendar.events(start - WINDOW_MARGIN, end + WINDOW_MARGIN) if calendar else []
        create, differences = plan(release, existing)
        lines.append(f"### {release.version.short} & Mobile {release.mobile} (Release Day {release.release_day})")
        lines += [f"- {day} {title}" for title, day in release.events()]
        lines.append("")
        if calendar is None:
            continue
        lines += [f"- {'Created' if live else 'Would create'}: {day} {title}" for title, day in create]
        lines += [f"- Differs, left as it is: {title} is on {have}, computed {want}" for title, have, want in differences]
        if not create and not differences:
            lines.append("- Every event is already on the calendar.")
        lines.append("")
        if live:
            for title, day in create:
                calendar.create_all_day(title, day)
                created += 1
        all_differences += differences
    result.text = "\n".join(lines)
    if result.failed:
        return result

    if all_differences:
        report_differences(hub, version, all_differences, env, live, result)
    if live:
        channel = hublib.release_channel(hub, version) if hub else None
        result.notes.append(hublib.tick(hub, hublib.release_run(hub, channel), PLAYBOOK_ITEMS, live)
                            if hub else "RELEASE_AGENT_MM_TOKEN is not set, so the playbook item was not ticked")
    else:
        result.notes.append("Dry run: nothing was written to the calendar.")
    result.notes.append(f"Created {created} event(s).")
    return result


def report_differences(hub, version, differences: list, env: dict, live: bool, result: Result) -> None:
    if hub is None:
        result.notes.append("RELEASE_AGENT_MM_TOKEN is not set, so the differences were not reported in Hub.")
        return
    channel = hublib.release_channel(hub, version)
    review = hublib.review_channel_id(env, live, channel)
    marker = f"release-docs:key-dates-differences:{version.short}"
    if not review or hublib.find_post(hub, review, marker):
        result.notes.append("Differences already reported, or no review channel to report them in.")
        return
    manager = hublib.release_manager(hub, hublib.release_run(hub, channel))
    message = hublib.addressed(manager, "These Release Dates calendar events differ from the release schedule. "
                                        "They were left as they are; moving one is your call:\n"
                                        + "\n".join(f"- {title}: on the calendar {have}, schedule says {want}"
                                                  for title, have, want in differences))
    if live:
        hub.create_post(review, message, {hublib.MARKER_PROP: marker})
    result.notes.append(f"{len(differences)} difference(s) {'reported to' if live else 'would be reported to'} the release manager in Hub.")
