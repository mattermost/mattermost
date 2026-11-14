"""The Feature Ready Review: the description of the release's occurrence, once Feature Complete passes.

The recurring "Feature Ready Review" event lives on the Release Dates calendar, organised by
the calendar itself. The release's occurrence is the one after its Feature Complete and
before its Release Day: with none, it's flagged and nothing changes, and once it has started
it's left alone. Only its description changes, with ``sendUpdates=none``: never the time,
the attendees or any other occurrence. A meeting with invitees is never created.
"""

from datetime import date, datetime, timezone

from . import hub as hublib
from .result import Result

TASK = "feature-review"
TITLE = "Feature Ready Review"
# The trailing "…" matches by the start of the title, as the Twitter item does: on Hub it reads
# "Schedule a Feature Ready Review meeting with these guidelines."
PLAYBOOK_ITEMS = ["Schedule a Feature Ready Review meeting…"]
INTRO = ("This is a monthly Feature Ready Review meeting where the development lead for each new feature gives a short "
         "(10 minute maximum) demo and explanation of new features. These monthly meetings are recorded.")
PLAN_TBD = "plan TBD"  # Jira epics have no plan field yet (Phase 6)


def description(version, epics: list[dict]) -> str:
    lines = [INTRO, "", "List of features:", ""]
    lines += [f"- {' '.join(e['summary'].split())} ({PLAN_TBD}, {version.short})" for e in epics]
    return "\n".join(lines) + "\n"


def starts_at(event: dict) -> datetime:
    """When an occurrence starts; an all-day one at the start of its day, UTC."""
    start = event.get("start") or {}
    if start.get("dateTime"):
        return datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
    day = date.fromisoformat(start["date"])
    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc)


def release_occurrence(calendar, feature_complete: date, release_day: date) -> tuple[dict | None, str]:
    """(the occurrence after the release's Feature Complete and before its Release Day, why not).

    Found in the recurring event titled Feature Ready Review. Never the next one regardless:
    an occurrence after Release Day belongs to the next release."""
    series = [e for e in calendar.recurring(TITLE) if e.get("status") != "cancelled" and e.get("recurrence")
              and " ".join((e.get("summary") or "").split()).casefold() == TITLE.casefold()]
    if len(series) != 1:
        return None, (f"no recurring \"{TITLE}\" event on the Release Dates calendar" if not series
                      else f"{len(series)} recurring \"{TITLE}\" events on the Release Dates calendar")
    window = [e for e in calendar.instances(series[0]["id"], feature_complete, release_day)
              if e.get("status") != "cancelled" and feature_complete < starts_at(e).date() < release_day]
    if not window:
        return None, (f"the recurring \"{TITLE}\" event has no occurrence between Feature Complete "
                      f"({feature_complete}) and Release Day ({release_day})")
    return min(window, key=starts_at), ""


def run(version, epics: list[dict], calendar, now: datetime, feature_complete: date | None, release_day: date,
        hub, live: bool) -> Result:
    result = Result(TASK, version.tag)
    if calendar is None:
        result.todo("RELEASE_DOCS_GOOGLE_SA_KEY / RELEASE_DATES_CALENDAR_ID are not set")
        return result
    if feature_complete is None:
        result.todo(f"no Feature Complete for {version.short} on the calendar, so the review's occurrence can't be found")
        return result
    if now.date() <= feature_complete:
        result.text = f"Feature Complete for {version.short} has not passed, so the description is not changed yet."
        return result
    event, problem = release_occurrence(calendar, feature_complete, release_day)
    if event is None:
        result.todo(f"{problem}; nothing was changed (an occurrence is never created)")
        return result
    start = starts_at(event)
    when = start.date().isoformat()
    if start <= now:
        result.text = f"The occurrence on {when} has started, so its description is no longer changed."
        return result
    if not epics:
        result.todo(f"no Jira epics in {version.short}'s fix version, so there's no list of features")
        return result
    text = description(version, epics)
    if (event.get("description") or "").strip() == text.strip():
        result.text = f"The occurrence on {when} already lists the {len(epics)} feature(s)."
    elif live:
        calendar.set_description(event["id"], text)
        result.text = f"Updated the description of the occurrence on {when}: {len(epics)} feature(s)."
    else:
        result.text = f"Dry run: would have updated the description of the occurrence on {when}: {len(epics)} feature(s)."
    if live and hub:
        result.notes.append(hublib.tick(hub, hublib.release_run(hub, hublib.release_channel(hub, version)),
                                        PLAYBOOK_ITEMS, live))
    result.notes.append("Each feature's plan is \"plan TBD\" until Jira epics have a plan field; fill it in before the meeting.")
    return result
