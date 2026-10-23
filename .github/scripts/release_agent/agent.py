"""One release agent run: work everything out again, check, tick, post, and record run.json.

Nothing is kept between runs. Each run reads the calendar, git, Jira, GitHub and Hub
afresh; the only memory is the status post itself, found again by its hidden marker.
"""

import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import changelog_release  # noqa: E402  (.github/scripts, shared with the changelog workflow)

from . import checks, playbook, posting, release_calendar, workdays  # noqa: E402
from .clients import ServiceError  # noqa: E402

MODES = ("test", "live")
LS_REMOTE_URL = "https://github.com/mattermost/mattermost.git"


@dataclass
class Settings:
    mode: str
    release_override: str = ""
    testing_alerts_channel: str = ""
    test_channel: str = ""
    playbook_id: str = ""
    release_channels: dict = field(default_factory=dict)


@dataclass
class Services:
    github: object
    jira: object
    hub: object
    playbooks: object
    fetch_calendar: object  # () -> ICS text
    ls_remote: object  # () -> `git ls-remote` output


def resolve_mode(requested: str, variable: str) -> str:
    """The dispatch input when it names a mode, else RELEASE_AGENT_MODE, else test."""
    requested = (requested or "").strip().lower()
    mode = requested if requested in MODES else (variable or "test").strip().lower()
    if mode not in MODES:
        raise ValueError(f"RELEASE_AGENT_MODE must be one of {', '.join(MODES)}, not {mode!r}")
    return mode


def git_ls_remote() -> str:
    result = subprocess.run(["git", "ls-remote", LS_REMOTE_URL, "refs/heads/release-*", "refs/tags/v*"],
                            capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError("git ls-remote of mattermost/mattermost failed")
    return result.stdout


def public_error(err: Exception) -> str:
    """An error message safe for the public log: the service and status, or the error type."""
    return str(err) if isinstance(err, ServiceError) else f"unexpected {type(err).__name__}"


def private_error(err: Exception) -> str:
    public = public_error(err)
    detail = getattr(err, "detail", "") if isinstance(err, ServiceError) else str(err)
    return (f"{public}: {detail}" if detail and detail != public else public)[:300]


def template_vars(release, naming: dict, rc_numbers: list) -> dict:
    base = {
        "version": release.version,
        "short_version": release.short_version,
        "major": release.major,
        "minor": release.minor,
        "branch": release.branch,
    }
    cut = release.milestones.get("branch_cut") or release.window(0)[0]
    values = {
        **base,
        "milestone": naming["milestone"].format_map(base),
        "fix_version": naming["fix_version"].format_map(base),
        "branch_cut": cut.isoformat(),
    }
    if rc_numbers:
        values["rc_tag"] = f"{release.version}-rc{rc_numbers[-1]}"
    return values


def evaluate(ctx: checks.Context, rule: dict, due: date | None, today: date) -> posting.Outcome:
    function, _ = checks.CHECKS[rule["type"]]
    try:
        result = function(ctx, rule)
    except Exception as err:  # noqa: BLE001 - one failing check must not stop the rest
        print(f"::warning::{ctx.release.short_version} {rule['task']}: {public_error(err)}")
        return posting.Outcome(rule, posting.ERROR, None, due, public_error(err), private_error(err))
    if result.status == checks.INFO:
        state = posting.REPORT
    elif result.status == checks.SKIPPED:
        state = posting.SKIPPED
    elif result.status == checks.PASS:
        state = posting.OK
    elif due is None or today < due:
        state = posting.NOT_DUE
    elif rule["on_fail"] == "log_only":
        state = posting.LOG_ONLY
    else:
        state = posting.NEEDS_ATTENTION
    return posting.Outcome(rule, state, result, due)


def check_release(release, rules: dict, settings: Settings, services: Services, today: date,
                  holidays: frozenset, branches: set, tags: set, ls_remote: str) -> posting.ReleaseReport:
    t_day = workdays.t_day(today, release.release_day, holidays) if release.release_day else None
    report = posting.ReleaseReport(release, t_day, settings.mode)
    report.flags += release_calendar.cross_check(release, branches, tags, today)

    rc_numbers = release_calendar.rc_numbers(ls_remote, release.major, release.minor)
    ctx = checks.Context(
        release=release, today=today, vars=template_vars(release, rules["naming"], rc_numbers),
        has_branch=release.key in branches, rc_numbers=rc_numbers, github=services.github,
        jira=services.jira, hub=services.hub, testing_alerts_channel=settings.testing_alerts_channel,
    )
    for rule in rules["rules"]:
        due = release_calendar.resolve_due(rule["due"], release, holidays)
        if due is None:
            report.flags.append(f"{rule['task']} is due at {rule['due']}, which isn't on the calendar for {release.short_version}.")
        report.outcomes.append(evaluate(ctx, rule, due, today))

    fragment = rules["naming"]["playbook_run"].format_map(ctx.vars)
    run = None
    try:
        found, problem = playbook.find_run(services.playbooks.in_progress_runs(fragment, settings.playbook_id), fragment)
        if problem:
            report.flags.append(problem)
        else:
            run = services.playbooks.run(found["id"])
    except Exception as err:  # noqa: BLE001 - checks still get posted without the run
        report.flags.append(f"Couldn't read the playbook runs: {public_error(err)}")
    report.run = run

    passing = [(o.rule, o.result) for o in report.outcomes
               if o.state == posting.OK and o.rule["playbook_item"] and o.due and today >= o.due]
    if run and passing:
        report.ticks = playbook.tick_items(services.playbooks, run, passing, settings.mode == "live")
        for tick in report.ticks:
            if tick.action in (playbook.NOT_FOUND, playbook.AMBIGUOUS):
                report.flags.append(f"Playbook item “{tick.playbook_item}” ({tick.task}) "
                                    f"{'is not in' if tick.action == playbook.NOT_FOUND else 'matches several items in'} the run.")
            elif tick.action == playbook.FAILED:
                report.flags.append(f"Ticking “{tick.playbook_item}” ({tick.task}) failed.")
    return report


def post_report(report: posting.ReleaseReport, rules: dict, settings: Settings, services: Services,
                today: date) -> dict:
    release = report.release
    if settings.mode == "live":
        channel = settings.release_channels.get(release.short_version) or (report.run or {}).get("channel_id", "")
    else:
        channel = settings.test_channel
    if not channel:
        report.flags.append(f"There's no {'release' if settings.mode == 'live' else 'test'} channel to post {release.short_version}'s status in.")
        return {"post": "skipped"}
    names = rules["calendar"]["milestones"]
    message = posting.format_post(report, today, names)
    window_start = release.window(0)[0] - timedelta(days=14)
    since_ms = int(datetime(window_start.year, window_start.month, window_start.day, tzinfo=timezone.utc).timestamp() * 1000)
    action, post = posting.upsert_post(services.hub, channel, posting.marker(release, settings.mode), message, since_ms)
    for tick in report.ticks:
        if tick.action == playbook.TICKED:
            proof = f" · [proof]({tick.proof_url})" if tick.proof_url else ""
            services.hub.create_post(channel, f"Ticked **{tick.playbook_item}** in the playbook run: {tick.summary}{proof}",
                                     root_id=post["id"])
    return {"post": action, "post_id": post.get("id", "")}


def public_result(outcome: posting.Outcome) -> dict:
    result = outcome.result
    entry = {
        "task": outcome.rule["task"],
        "type": outcome.rule["type"],
        "playbook_item": outcome.rule["playbook_item"],
        "due": outcome.due.isoformat() if outcome.due else None,
        "state": outcome.state,
        "summary": result.summary if result else None,
        "items": [label for label in (item.public_label for item in (result.items if result else [])) if label],
    }
    if outcome.state == posting.ERROR:
        entry["error"] = outcome.error
    return entry


def run(rules: dict, settings: Settings, services: Services, today: date) -> tuple[dict, list]:
    """Run once. Returns (run.json body, private log details)."""
    events = release_calendar.parse_ics(services.fetch_calendar())
    calendar = rules["calendar"]
    releases, notes = release_calendar.releases_from_events(events, calendar["milestones"])
    holidays = release_calendar.holidays_from(events, calendar.get("holiday_markers", []), rules.get("holidays", []))
    ls_remote = services.ls_remote()
    branches, tags = changelog_release.parse_ls_remote(ls_remote)

    flags = list(notes)
    if settings.release_override:
        key = changelog_release.parse_version(settings.release_override)[:2]
        selected = [releases[key]] if key in releases else []
        if not selected:
            flags.append(f"v{key[0]}.{key[1]} was requested, but the calendar has no milestones for it.")
    else:
        selected = release_calendar.active_releases(releases, today, calendar["active_days_after_release"])
        flags += release_calendar.untracked_branches(releases, branches, tags)

    body = {"mode": settings.mode, "date": today.isoformat(), "releases": [], "flags": flags}
    details = []
    for release in selected:
        report = check_release(release, rules, settings, services, today, holidays, branches, tags, ls_remote)
        try:
            post = post_report(report, rules, settings, services, today)
        except Exception as err:  # noqa: BLE001 - still record the run
            report.flags.append("Couldn't post the status.")
            details.append(f"{release.short_version} post: {private_error(err)}")
            post = {"post": "failed"}
        details += [f"{release.short_version} {o.rule['task']}: {o.error_detail}" for o in report.outcomes if o.error_detail]
        body["releases"].append({
            "version": release.short_version,
            "t_day": workdays.format_t_day(report.t_day),
            "milestones": {k: v.isoformat() for k, v in sorted(release.milestones.items(), key=lambda kv: kv[1])},
            "status": "needs_attention" if report.needs_attention else "all_good",
            **post,
            "checks": [public_result(o) for o in report.outcomes],
            "ticked": [{"task": t.task, "playbook_item": t.playbook_item} for t in report.ticks if t.action == playbook.TICKED],
            "would_tick": [t.task for t in report.ticks if t.action == playbook.WOULD_TICK],
            "not_ticked": [{"task": t.task, "reason": t.action} for t in report.ticks
                           if t.action not in (playbook.TICKED, playbook.WOULD_TICK)],
            "flags": report.flags,
        })
    body["totals"] = totals(body)
    return body, details


def totals(body: dict) -> dict:
    all_checks = [c for r in body["releases"] for c in r["checks"]]
    count = lambda state: sum(1 for c in all_checks if c["state"] == state)  # noqa: E731
    return {
        "releases": len(body["releases"]),
        "checks_run": len(all_checks),
        "passed": count(posting.OK),
        "needs_attention": count(posting.NEEDS_ATTENTION),
        "not_due": count(posting.NOT_DUE),
        "errors": count(posting.ERROR),
        "ticked": sum(len(r["ticked"]) for r in body["releases"]),
        "flags": len(body["flags"]) + sum(len(r["flags"]) for r in body["releases"]),
    }


def env_settings(env=os.environ) -> Settings:
    import json
    channels = env.get("RELEASE_CHANNEL_IDS", "").strip()
    return Settings(
        mode=resolve_mode(env.get("INPUT_MODE", ""), env.get("RELEASE_AGENT_MODE", "")),
        release_override=env.get("INPUT_RELEASE", "").strip(),
        testing_alerts_channel=env.get("TESTING_ALERTS_CHANNEL_ID", ""),
        test_channel=env.get("TEST_CHANNEL_ID", ""),
        playbook_id=env.get("PLAYBOOK_ID", ""),
        release_channels=json.loads(channels) if channels else {},
    )
