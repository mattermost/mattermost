"""python3 -m release_agent run|log|validate, from .github/scripts.

  run       Check the active releases, tick and post, and write run.json (public, uploaded
            as an artifact) and details.txt (private, only ever posted to Hub).
  log       Post the run's one line to release-agent-log. Runs even when `run` failed.
  validate  Validate rules.yml against its schema and the playbook template.
  actions   Run the release actions once (release-actions.yml): branch cut, QA sheet, RCs,
            fix versions, tickets and metrics. Dry run unless RELEASE_ACTIONS_MODE is live.
  actions-log  Post the actions run's line to release-agent-log.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import agent
from .clients import Confluence, GitHub, Jira, Mattermost, Playbooks, fetch_text, fetch_url


def load_rules_module():
    # Imported late: it needs PyYAML and jsonschema, and `log` must work without them.
    from . import rules
    return rules


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"{name} is not set")
    return value


def services_from_env() -> agent.Services:
    hub = Mattermost(require("MM_URL"), require("MM_TOKEN"))
    calendar_url = require("CALENDAR_ICS_URL")
    atlassian = (os.environ.get("JIRA_URL") or "https://mattermost.atlassian.net", require("JIRA_EMAIL"), require("JIRA_TOKEN"))
    return agent.Services(
        github=GitHub(require("GH_TOKEN")),
        jira=Jira(*atlassian),
        confluence=Confluence(*atlassian),
        hub=hub,
        playbooks=Playbooks(hub),
        fetch_calendar=lambda: fetch_text(calendar_url, "Release Dates calendar"),
        ls_remote=agent.git_ls_remote,
        fetch_page=lambda url: fetch_text(url, "docs.mattermost.com"),
        fetch_web=lambda url: fetch_url(url, "mattermost.com"),
    )


def action_settings_from_env(env=os.environ):
    from .actions import engine
    return engine.settings_from_env(env)


def action_services_from_env(settings, env=os.environ):
    from .actions.runner import Services
    from .actions.writers import GitHubWriter, JiraWriter, Sheets
    def require(name: str) -> str:
        value = (env.get(name) or "").strip()
        if not value:
            raise ValueError(f"{name} is not set")
        return value

    hub = Mattermost(require("MM_URL"), require("MM_TOKEN"))
    calendar_url = require("CALENDAR_ICS_URL")
    jira_url = env.get("JIRA_URL") or "https://mattermost.atlassian.net"
    services = Services(
        hub=hub, playbooks=Playbooks(hub), github=GitHub(require("GH_TOKEN")),
        jira=Jira(jira_url, require("JIRA_EMAIL"), require("JIRA_TOKEN")),
        fetch_calendar=lambda: fetch_text(calendar_url, "Release Dates calendar"),
        ls_remote=agent.git_ls_remote,
        confluence=Confluence(jira_url, require("JIRA_EMAIL"), require("JIRA_TOKEN")),
    )
    # Write clients only when something can act live; a dry run never has them.
    if settings.mode == "live" and settings.trigger == "schedule" and settings.live_actions:
        if env.get("DISPATCH_TOKEN"):
            services.dispatcher = GitHubWriter(env["DISPATCH_TOKEN"])
        if env.get("MILESTONES_TOKEN"):
            services.milestones = GitHubWriter(env["MILESTONES_TOKEN"])
        if env.get("JIRA_WRITE_EMAIL") and env.get("JIRA_WRITE_TOKEN"):
            services.jira_writer = JiraWriter(jira_url, env["JIRA_WRITE_EMAIL"], env["JIRA_WRITE_TOKEN"])
    if env.get("GOOGLE_SA_KEY") and (settings.qa_sheet_id or settings.scorecard_sheet_id):
        services.sheets = Sheets(env["GOOGLE_SA_KEY"])  # dry runs read the sheets to show the rows they'd add
    return services


def command_actions(args) -> int:
    from .actions import runner
    now = datetime.now(timezone.utc)
    body, details, audit = {"date": now.date().isoformat(), "releases": [], "flags": []}, [], []
    try:
        settings = action_settings_from_env()
        body.update(mode=settings.mode, trigger=settings.trigger)
        services = action_services_from_env(settings)
        result, details, audit = runner.run(load_rules_module().load_rules(), settings, services, now)
        body.update(result)
        return 0
    except Exception as err:  # noqa: BLE001 - recorded, then the step fails
        body["error"] = agent.public_error(err) if not isinstance(err, ValueError) else str(err)
        private = agent.private_error(err)
        if private != body["error"]:
            details.append(f"run: {private}")
        print(f"::error::{body['error']}")
        return 1
    finally:
        body["run_url"] = os.environ.get("RUN_URL", "")
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "run.json").write_text(json.dumps(body, indent=2) + "\n")
        (out_dir / "details.txt").write_text("\n".join(details) + ("\n" if details else ""))
        (out_dir / "audit.txt").write_text("\n\n".join(audit) + ("\n" if audit else ""))
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            from .actions.runner import step_summary as actions_summary
            with open(summary, "a", encoding="utf-8") as handle:
                handle.write(actions_summary(body))


def actions_log_line(body: dict | None, details: list, job_status: str, run_url: str) -> str:
    link = f" · [run]({run_url})" if run_url else ""
    if body is None:
        return f"Failed: release-actions stopped before it wrote run.json ({job_status}){link}"
    prefix = f"release-actions [{body.get('mode', '?')}, {body.get('trigger', '?')}] {body.get('date', '')}"
    if body.get("error") or job_status not in ("", "success"):
        reason = body.get("error") or f"job {job_status}"
        extra = f" ({details[-1]})" if details else ""
        return f"Failed: {prefix}: {reason}{extra}{link}"
    parts = [f"{r['version']}: " + ", ".join(f"{a['task']} {a['state'].lower()}" for a in r["actions"])
             for r in body.get("releases", [])]
    return f"Done: {prefix}: {' · '.join(parts) or 'no release has actions today'}{link}"


def command_actions_log(args) -> int:
    out_dir = Path(args.out_dir)
    body = json.loads((out_dir / "run.json").read_text()) if (out_dir / "run.json").exists() else None
    details_path, audit_path = out_dir / "details.txt", out_dir / "audit.txt"
    details = [d for d in details_path.read_text().splitlines() if d.strip()] if details_path.exists() else []
    audit = [a for a in audit_path.read_text().split("\n\n") if a.strip()] if audit_path.exists() else []
    hub = Mattermost(require("MM_URL"), require("MM_TOKEN"))
    channel = require("LOG_CHANNEL_ID")
    # Every workflow started in delivery-platform, with what started it. Hub only.
    for line in audit:
        hub.create_post(channel, line)
    hub.create_post(channel, actions_log_line(body, details, os.environ.get("JOB_STATUS", ""), os.environ.get("RUN_URL", "")))
    print(f"Posted {len(audit)} audit line(s) and the run's line to release-agent-log.")
    return 0


def step_summary(body: dict) -> str:
    lines = [f"## Release agent ({body.get('mode', '?')} mode, {body.get('date', '')})", ""]
    if body.get("error"):
        lines += [f"**The run failed:** {body['error']}", ""]
    if not body.get("releases") and not body.get("error"):
        lines.append("No release is active today.")
    for release in body.get("releases", []):
        lines += [f"### {release['version']} · {release['t_day']} · {release['status'].replace('_', ' ')}",
                  f"Post: {release.get('post', 'skipped')}", "",
                  "| Task | State | Due | Summary |", "| --- | --- | --- | --- |"]
        for check in release["checks"]:
            summary = check.get("summary") or check.get("error") or ""
            lines.append(f"| {check['task']} | {check['state']} | {check['due'] or '—'} | {summary.replace('|', '/')} |")
        if release["ticked"] or release["would_tick"]:
            ticked = ", ".join(t["task"] for t in release["ticked"]) or "none"
            lines += ["", f"Ticked: {ticked}" + (f" · would tick: {', '.join(release['would_tick'])}" if release["would_tick"] else "")]
        lines += [f"- :triangular_flag_on_post: {flag}" for flag in release["flags"]]
        if release.get("hub_only_flags"):
            lines.append(f"- :triangular_flag_on_post: {release['hub_only_flags']} more flag(s), shown in Hub only")
        lines.append("")
    lines += [f"- :triangular_flag_on_post: {flag}" for flag in body.get("flags", [])]
    return "\n".join(lines) + "\n"


def write_outputs(out_dir: Path, body: dict, details: list) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "run.json").write_text(json.dumps(body, indent=2) + "\n")
    (out_dir / "details.txt").write_text("\n".join(details) + ("\n" if details else ""))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(step_summary(body))


def command_run(args) -> int:
    today = datetime.now(timezone.utc).date()
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    body, details = {"date": today.isoformat(), "started_at": started, "releases": [], "flags": []}, []
    try:
        settings = agent.env_settings()
        body["mode"] = settings.mode
        result, details = agent.run(load_rules_module().load_rules(), settings, services_from_env(), today)
        body.update(result)
        return 0
    except Exception as err:  # noqa: BLE001 - recorded, then the step fails
        body["error"] = agent.public_error(err) if not isinstance(err, ValueError) else str(err)
        private = agent.private_error(err)
        if private != body["error"]:
            details.append(f"run: {private}")
        print(f"::error::{body['error']}")
        return 1
    finally:
        body["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        body["run_url"] = os.environ.get("RUN_URL", "")
        body.setdefault("totals", agent.totals(body))
        write_outputs(Path(args.out_dir), body, details)


def log_line(body: dict | None, details: list, job_status: str, run_url: str, mode: str) -> str:
    link = f" · [run]({run_url})" if run_url else ""
    if body is None:
        return f":rotating_light: release-agent [{mode or '?'}] failed before it wrote run.json ({job_status}){link}"
    prefix = f"release-agent [{body.get('mode', mode or '?')}] {body.get('date', '')}"
    if body.get("error") or job_status not in ("", "success"):
        reason = body.get("error") or f"job {job_status}"
        extra = f" — {details[-1]}" if details else ""
        return f":rotating_light: {prefix} failed: {reason}{extra}{link}"
    parts = []
    for release in body.get("releases", []):
        status = release["status"].replace("_", " ")
        ticked = f", ticked {len(release['ticked'])}" if release["ticked"] else ""
        parts.append(f"{release['version']} {release['t_day']} {status} (post {release.get('post', 'skipped')}{ticked})")
    totals = body.get("totals", {})
    summary = " · ".join(parts) if parts else "no active release"
    issues = f" · {totals.get('errors', 0)} check errors" if totals.get("errors") else ""
    flags = f" · {totals.get('flags', 0)} flags" if totals.get("flags") else ""
    attention = any(r["status"] != "all_good" for r in body.get("releases", []))
    icon = ":warning:" if attention or issues or flags else ":white_check_mark:"
    return f"{icon} {prefix}: {summary}{issues}{flags}{link}"


def command_log(args) -> int:
    out_dir = Path(args.out_dir)
    body = json.loads((out_dir / "run.json").read_text()) if (out_dir / "run.json").exists() else None
    details_path = out_dir / "details.txt"
    details = [d for d in details_path.read_text().splitlines() if d.strip()] if details_path.exists() else []
    line = log_line(body, details, os.environ.get("JOB_STATUS", ""), os.environ.get("RUN_URL", ""),
                    os.environ.get("RELEASE_AGENT_MODE", ""))
    hub = Mattermost(require("MM_URL"), require("MM_TOKEN"))
    hub.create_post(require("LOG_CHANNEL_ID"), line)
    print("Posted the run's line to release-agent-log.")
    return 0


def command_validate(_args) -> int:
    rules = load_rules_module()
    rules.load_rules()
    print(f"{rules.RULES_PATH.name} is valid.")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="release_agent")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("run", "log", "actions", "actions-log"):
        sub.add_parser(name).add_argument("--out-dir", required=True)
    sub.add_parser("validate")
    args = parser.parse_args(argv)
    return {"run": command_run, "log": command_log, "validate": command_validate, "actions": command_actions,
            "actions-log": command_actions_log}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
