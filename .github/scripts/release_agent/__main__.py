"""python3 -m release_agent run|log|validate, from .github/scripts.

  run       Check the active releases, tick and post, and write run.json (public, uploaded
            as an artifact) and details.txt (private, only ever posted to Hub).
  log       Post the run's one line to release-agent-log. Runs even when `run` failed.
  validate  Validate rules.yml against its schema and the playbook template.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import agent
from .clients import Confluence, GitHub, Jira, Mattermost, Playbooks, fetch_text


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
    )


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
    for name in ("run", "log"):
        sub.add_parser(name).add_argument("--out-dir", required=True)
    sub.add_parser("validate")
    args = parser.parse_args(argv)
    return {"run": command_run, "log": command_log, "validate": command_validate}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
