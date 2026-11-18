"""The hourly release actions run (release-actions.yml), and the read-only view of the same
actions that the daily status post shows under "Release actions".

run.json and the step summary get each action's status word and counts only. Jira keys, ticket
text, delivery-platform run links and sheet contents go to Hub only.
"""

import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import changelog_release  # noqa: E402

from .. import agent, checks, release_calendar  # noqa: E402
from . import branch_cut, engine, metrics, qa_sheet, rc, tickets, versions  # noqa: E402
from .engine import ActionContext, Status  # noqa: E402

HANDLERS = {
    "branch_cut": branch_cut.run,
    "qa_sheet": qa_sheet.run,
    "rc": rc.run,
    "versions": versions.run,
    "tickets": tickets.run,
    "metrics": metrics.run,
}
# These post in the release channel; with none (live), they wait. The branch cut falls back to
# release-agent-log, since the channel may not exist yet on Release Branch Cut day.
NEEDS_CHANNEL = {"qa_sheet", "rc", "versions", "tickets", "metrics"}


@dataclass
class Services:
    hub: object
    playbooks: object
    github: object  # read: mattermost and enterprise
    jira: object  # read
    fetch_calendar: object
    ls_remote: object
    dispatcher: object = None  # delivery-platform, Actions: write
    milestones: object = None  # mattermost and enterprise, Issues: write
    jira_writer: object = None
    sheets: object = None
    confluence: object = None


def evaluate(ctx: ActionContext) -> Status:
    if ctx.execute and ctx.action in NEEDS_CHANNEL and not ctx.channel:
        where = "release channel" if ctx.settings.is_live(ctx.action) else "test channel"
        return Status(engine.WAITING, f"{engine.WAITING}: there's no {where} to post in.", "no_channel",
                      attention=[f"{ctx.spec['title']}: there's no {where} to post in."])
    return HANDLERS[ctx.action](ctx)


def release_status(release, rules: dict, settings: engine.Settings, services, now: datetime, holidays: frozenset,
                   events: list, releases: dict, branches: set, tags: set, rc_numbers: list, channel: str,
                   run: dict | None, variables: dict) -> list[tuple[dict, Status]]:
    """Read only, for the daily status post: [(action spec, Status)]."""
    found = []
    for spec in rules.get("actions", []):
        ctx = ActionContext(release=release, now=now, holidays=holidays, rules=rules, spec=spec, settings=settings,
                            services=services, events=events, releases=releases, branches=branches, tags=tags,
                            rc_numbers=rc_numbers, release_channel=channel, run=run, execute=False, vars=variables)
        try:
            status = evaluate(ctx)
        except Exception as err:  # noqa: BLE001 - one action failing must not stop the post
            status = Status(engine.ATTENTION, f"{engine.ATTENTION}: couldn't check {spec['title'].lower()}: "
                                              f"{agent.public_error(err)}.", f"error: {agent.public_error(err)}")
        found.append((spec, status))
    return found


def active(releases: dict, today, days_after: int) -> list:
    return release_calendar.active_releases(releases, today, days_after)


def run(rules: dict, settings: engine.Settings, services: Services, now: datetime) -> tuple[dict, list, list]:
    """Run every due action once. Returns (run.json body, private details, audit lines for
    release-agent-log)."""
    today = now.date()
    events = release_calendar.parse_ics(services.fetch_calendar())
    releases, notes = release_calendar.releases_from_events(events, rules["calendar"]["milestones"])
    holidays = release_calendar.holidays_from(events, rules["calendar"].get("holiday_markers", []), rules.get("holidays", []))
    flags, details, audit = list(notes), [], []
    if services.confluence:
        page_settings = agent.Settings(mode="test", holidays_page_id=settings.holidays_page_id)
        holidays |= agent.page_holidays(rules, page_settings, services, today, flags, details)
    holidays = frozenset(holidays)
    ls_remote = services.ls_remote()
    branches, tags, _ = changelog_release.parse_ls_remote(ls_remote)
    if settings.release_override:
        key = changelog_release.parse_version(settings.release_override)[:2]
        selected = [releases[key]] if key in releases else []
        if not selected:
            flags.append(f"v{key[0]}.{key[1]} was requested, but the calendar has no milestones for it.")
    else:
        selected = active(releases, today, rules["release_actions"]["active_days_after_release"])

    body = {"mode": settings.mode, "trigger": settings.trigger, "live_actions": sorted(settings.live_actions),
            "date": today.isoformat(), "releases": [], "flags": flags}
    lookup = agent.Settings(mode="test", playbook_id=settings.playbook_id)
    for release in selected:
        rc_numbers = release_calendar.rc_numbers(ls_remote, release.major, release.minor)
        variables = agent.template_vars(release, rules["naming"], rc_numbers)
        channel, playbook_run, found_flags = agent.find_channel_and_run(release, variables["release_channels"], lookup, services)
        entry = {"version": release.short_version, "actions": [], "flags": list(found_flags), "hub_only_flags": 0}
        for spec in rules["actions"]:
            ctx = ActionContext(release=release, now=now, holidays=holidays, rules=rules, spec=spec, settings=settings,
                                services=services, events=events, releases=releases, branches=branches, tags=tags,
                                rc_numbers=rc_numbers, release_channel=channel, run=playbook_run, vars=variables)
            try:
                status = evaluate(ctx)
            except Exception as err:  # noqa: BLE001 - one action failing must not stop the others
                status = Status(engine.FAILED, f"{engine.FAILED}: {spec['title']}: {agent.public_error(err)}",
                                f"error: {agent.public_error(err)}")
                details.append(f"{release.short_version} {spec['task']}: {agent.private_error(err)}")
            audit += ctx.audit
            entry["hub_only_flags"] += len(status.attention)
            details += [f"{release.short_version} {spec['task']}: {line}" for line in status.attention]
            entry["actions"].append({"task": spec["task"], "action": spec["action"],
                                     "live": settings.is_live(spec["action"]), "state": status.word,
                                     "summary": status.public})
        body["releases"].append(entry)
    people_flags = settings.people.flags()
    body["flags"] += people_flags
    return body, details, audit


def step_summary(body: dict) -> str:
    lines = [f"## Release actions ({body.get('mode', '?')}, {body.get('trigger', '?')}, {body.get('date', '')})", ""]
    if body.get("error"):
        lines += [f"**The run failed:** {body['error']}", ""]
    if not body.get("releases") and not body.get("error"):
        lines.append("No release has actions today.")
    for release in body.get("releases", []):
        lines += [f"### {release['version']}", ""]
        lines += [f"- {a['task']}: {a['state']}{' (live)' if a['live'] else ' (dry run)'}"
                  f"{' · ' + a['summary'] if a['summary'] else ''}" for a in release["actions"]]
        lines += [f"- Flag: {flag}" for flag in release["flags"]]
        if release.get("hub_only_flags"):
            lines.append(f"- {release['hub_only_flags']} more line(s) under Needs attention, shown in Hub only")
        lines.append("")
    lines += [f"- Flag: {flag}" for flag in body.get("flags", [])]
    return "\n".join(lines) + "\n"


def tick_results(statuses: list[tuple[dict, Status]]) -> list[tuple[dict, checks.Result]]:
    """(rule, Result) for each done action with a playbook item, for the daily run's ticking."""
    passing = []
    for spec, status in statuses:
        if status.done and spec.get("playbook_item"):
            rule = {"task": spec["task"], "playbook_item": spec["playbook_item"]}
            passing.append((rule, checks.Result(checks.PASS, status.proof or status.line, proof_url=status.proof_url)))
    return passing
