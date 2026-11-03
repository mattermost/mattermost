"""The Feature Ready Review: the next occurrence's description, once Feature Complete passes.

The recurring "Feature Ready Review" event lives on the Release Dates calendar, organised by
the calendar itself. Only the description of its next occurrence changes, with
``sendUpdates=none``: never the time, the attendees or any other occurrence. No event, no
change: a meeting with invitees is never created.
"""

from datetime import date

from . import hub as hublib
from .result import Result

TASK = "feature-review"
TITLE = "Feature Ready Review"
PLAYBOOK_ITEMS = ["Schedule a Feature Ready Review meeting"]
INTRO = ("This is a monthly Feature Ready Review meeting where the development lead for each new feature gives a short "
         "(10 minute maximum) demo and explanation of new features. These monthly meetings are recorded.")
PLAN_TBD = "plan TBD"  # Jira epics have no plan field yet (Phase 6)


def description(version, epics: list[dict]) -> str:
    lines = [INTRO, "", "List of features:", ""]
    lines += [f"- {' '.join(e['summary'].split())} ({PLAN_TBD}, {version.short})" for e in epics]
    return "\n".join(lines) + "\n"


def next_occurrence(calendar, today: date) -> tuple[dict | None, str]:
    """(the next occurrence, why not): the recurring event titled Feature Ready Review."""
    series = [e for e in calendar.events(today, date(today.year + 1, today.month, 1), TITLE, single=False)
              if " ".join((e.get("summary") or "").split()).casefold() == TITLE.casefold() and e.get("recurrence")]
    if len(series) != 1:
        return None, (f"no recurring \"{TITLE}\" event on the Release Dates calendar" if not series
                      else f"{len(series)} recurring \"{TITLE}\" events on the Release Dates calendar")
    upcoming = [e for e in calendar.instances(series[0]["id"], today) if e.get("status") != "cancelled"]
    return (upcoming[0], "") if upcoming else (None, f"the recurring \"{TITLE}\" event has no upcoming occurrence")


def run(version, epics: list[dict], calendar, today: date, hub, live: bool) -> Result:
    result = Result(TASK, version.tag)
    if calendar is None:
        result.todo("RELEASE_DOCS_GOOGLE_SA_KEY / RELEASE_DATES_CALENDAR_ID are not set")
        return result
    if not epics:
        result.todo(f"no Jira epics in {version.short}'s fix version, so there's no list of features")
        return result
    event, problem = next_occurrence(calendar, today)
    if event is None:
        result.todo(f"{problem}; nothing was changed (it is never created)")
        return result
    text = description(version, epics)
    start = (event.get("start") or {}).get("dateTime") or (event.get("start") or {}).get("date", "")
    if (event.get("description") or "").strip() == text.strip():
        result.text = f"The occurrence on {start[:10]} already lists the {len(epics)} feature(s)."
    elif live:
        calendar.set_description(event["id"], text)
        result.text = f"Updated the description of the occurrence on {start[:10]}: {len(epics)} feature(s)."
    else:
        result.text = f"Dry run: would have updated the description of the occurrence on {start[:10]}: {len(epics)} feature(s)."
    if live and hub:
        result.notes.append(hublib.tick(hub, hublib.release_run(hub, hublib.release_channel(hub, version)),
                                        PLAYBOOK_ITEMS, live))
    result.notes.append("Each feature's plan is \"plan TBD\" until Jira epics have a plan field; fill it in before the meeting.")
    return result
