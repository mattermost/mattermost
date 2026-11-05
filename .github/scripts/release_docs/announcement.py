"""The Announcements post, approved by the release manager before it's scheduled.

At T-1 the rendered post goes to the review channel as a draft, mentioning the release
manager. On a later run, a :white_check_mark: from the release manager schedules the
draft's current text (edits included) in Announcements for Release Day. Without the
reaction by Release Day, nothing is posted and the thread says it's waiting.

Details stay in Hub: the run summary only says what was done.
"""

from datetime import date, datetime, timedelta, timezone

from . import hub as hublib
from . import schedule
from .result import TODO_MARKER, Result

TASK = "announcement"
SEPARATOR = "\n\n---\n\n"
DEFAULT_TIME = "14:00"
LATE_DELAY = timedelta(minutes=15)


def markers(short: str) -> dict:
    return {key: f"release-docs:announcement-{key}:{short}" for key in ("draft", "scheduled", "waiting")}


def scheduled_at(day: date, time_text: str) -> datetime:
    hour, minute = (int(part) for part in (time_text or DEFAULT_TIME).split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc)


def when(at: datetime) -> str:
    return f"{at:%a, %b} {at.day}, {at.year} at {at:%H:%M} UTC"


def draft_message(manager: dict | None, at: datetime, text: str) -> str:
    note = (hublib.NO_MANAGER_NOTE[:-1] + " Until it is set, no reaction can approve this draft._")
    intro = hublib.addressed(manager, f"Draft of the Announcements post for this release. React with "
                                      f":white_check_mark: to schedule this for {when(at)} in Announcements. To change it, "
                                      f"edit the text below the line before reacting.", note)
    return f"{intro}{SEPARATOR}{text.strip()}"


def approved_text(message: str) -> str:
    return message.split(SEPARATOR, 1)[1].strip() if SEPARATOR in message else ""


def approved(hub, post: dict, manager: dict | None) -> bool:
    return bool(manager) and any(r.get("emoji_name") == hublib.APPROVE_EMOJI and r.get("user_id") == manager["id"]
                                 for r in hub.reactions(post["id"]))


def already_scheduled(hub, channel_id: str, marker: str) -> bool:
    team = hub.channel(channel_id).get("team_id", "")
    return any(p.get("channel_id") == channel_id and hublib.marker_of(p) == marker for p in hub.scheduled_posts(team))


def run(version, release_day: date, render, hub, env: dict, live: bool, now: datetime,
        holidays: schedule.Holidays, dispatched: bool) -> Result:
    """``render()`` returns (post text, problems), and is only called when a draft is due."""
    result = Result(TASK, version.tag)
    mark = markers(version.short)
    announcements = env.get("ANNOUNCEMENTS_CHANNEL_ID", "")
    channel = hublib.release_channel(hub, version)
    review = hublib.review_channel_id(env, live, channel)
    if not announcements or not review:
        result.todo("no Announcements channel (RELEASE_DOCS_ANNOUNCEMENTS_CHANNEL_ID) or " + hublib.NO_REVIEW_CHANNEL)
        return result
    manager = hublib.release_manager(hub, hublib.release_run(hub, channel))
    at = scheduled_at(release_day, env.get("ANNOUNCEMENT_TIME"))
    today = now.date()

    draft = hublib.find_post(hub, review, mark["draft"])
    if draft is None:
        due = schedule.add_working_days(release_day, -1, holidays)
        if today < due and not dispatched:
            result.text = f"Not due: the draft goes to the review channel on {due} (T-1)."
            return result
        if today > release_day:
            result.text = "Release Day has passed; no draft was posted."
            return result
        text, problems = render()
        for problem in problems:
            result.todo(problem)
        if result.failed or TODO_MARKER in text:
            result.text = "Nothing posted: the draft has missing inputs."
            return result
        if not live:
            result.text = "Dry run: would have posted the draft in the review channel for approval."
            return result
        hub.create_post(review, draft_message(manager, at, text), {hublib.MARKER_PROP: mark["draft"]})
        result.text = "Posted the draft in the review channel for approval."
        return result

    if hublib.find_reply(hub, draft["id"], mark["scheduled"]) or already_scheduled(hub, announcements, mark["scheduled"]):
        result.text = "Already scheduled in Announcements; nothing to do."
        return result
    if not approved(hub, draft, manager):
        if today < release_day:
            result.text = "Waiting for the release manager's approval."
            return result
        if hublib.find_reply(hub, draft["id"], mark["waiting"]):
            result.text = "Not approved yet; the thread already says it's waiting."
            return result
        if live:
            hub.create_post(review, hublib.addressed(manager, "Still waiting for :white_check_mark: on the draft above. "
                                                              "Nothing has been posted to Announcements."),
                            {hublib.MARKER_PROP: mark["waiting"]}, root_id=draft["id"])
        result.text = ("Not approved by Release Day: " + ("replied in the thread that it's waiting."
                                                          if live else "dry run: would have replied that it's waiting."))
        return result

    text = approved_text(draft.get("message", ""))
    if not text or TODO_MARKER in text:
        result.todo("the approved draft has no text below the line, or still has a TODO")
        return result
    if at < now + timedelta(minutes=5):
        if today != release_day:
            result.text = "Approved after Release Day: nothing scheduled. Post it by hand if it's still wanted."
            return result
        at = (now + LATE_DELAY).replace(second=0, microsecond=0)
    if not live:
        result.text = f"Dry run: would have scheduled the approved post for {when(at)} in Announcements."
        return result
    hub.schedule_post(announcements, text, {hublib.MARKER_PROP: mark["scheduled"]}, int(at.timestamp() * 1000))
    hub.create_post(review, f"Scheduled in Announcements for {when(at)}:\n\n" + "\n".join(f"> {line}" for line in text.splitlines()),
                    {hublib.MARKER_PROP: mark["scheduled"]}, root_id=draft["id"])
    result.text = f"Scheduled the approved post for {when(at)} in Announcements."
    return result
