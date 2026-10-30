"""python3 -m release_cherrypick run

Environment:
  GH_TOKEN          GitHub App token for mattermost/mattermost and mattermost/enterprise
  JIRA_EMAIL, JIRA_TOKEN, JIRA_URL (default https://mattermost.atlassian.net)
  MODE_INPUT        dry_run | live, from workflow_dispatch; else CHERRYPICK_LABEL_MODE; else dry_run
  VERSION_INPUT     e.g. v12.2: run on that release only
  ISSUE_KEY         from the jira-submitted dispatch: run on that ticket only
  MM_URL, MM_TOKEN, LOG_CHANNEL_ID   optional: the Hub release-agent-log line and live posts
  RUN_URL, GITHUB_STEP_SUMMARY
"""

import os
import sys

from . import output
from .clients import GitHub, Hub, Jira, ServiceError
from .labeller import PROJECT, LabelError, Labeller, active_versions, find_fix_version, parse_short_version

MODES = ("dry_run", "live")


def resolve_mode(requested: str, variable: str) -> str:
    requested = (requested or "").strip().lower()
    mode = requested if requested in MODES else (variable or "dry_run").strip().lower()
    if mode not in MODES:
        raise LabelError(f"CHERRYPICK_LABEL_MODE must be dry_run or live, not {mode!r}")
    return mode


def run(env, jira, github, hub=None) -> tuple[str, str, int]:
    """Run once. Returns (step summary, log line, exit code)."""
    problems, reports, live = [], [], False
    try:
        live = resolve_mode(env.get("MODE_INPUT", ""), env.get("CHERRYPICK_LABEL_MODE", "")) == "live"
        labeller = Labeller(jira, github, live)
        versions = jira.versions(PROJECT)
        if env.get("ISSUE_KEY", "").strip():
            reports.append(labeller.run_ticket(env["ISSUE_KEY"].strip().upper(), versions))
        elif env.get("VERSION_INPUT", "").strip():
            reports.append(labeller.run_version(find_fix_version(versions, *parse_short_version(env["VERSION_INPUT"]))))
        else:
            reports += [labeller.run_version(version) for version in active_versions(versions, github)]
    except (LabelError, ServiceError) as err:
        problems.append(str(err))

    if hub and live:
        for report in reports:
            if report.version:
                try:
                    report.notes.append(f"Hub: {output.post_to_release(hub, report)}.")
                except ServiceError as err:
                    report.errors.append(f"Hub post: {err}")
    failed = bool(problems or any(r.errors for r in reports))
    return (output.summary(reports, live, problems), output.log_line(reports, live, env.get("RUN_URL", ""), problems),
            1 if failed else 0)


def main(argv: list[str]) -> int:
    if argv[1:] != ["run"]:
        print(__doc__)
        return 2
    env = os.environ
    jira = Jira(env.get("JIRA_URL") or "https://mattermost.atlassian.net", env.get("JIRA_EMAIL", ""), env.get("JIRA_TOKEN", ""))
    github = GitHub(env.get("GH_TOKEN", ""))
    hub = Hub(env.get("MM_URL") or "https://hub.mattermost.com", env["MM_TOKEN"]) if env.get("MM_TOKEN") else None
    text, line, code = run(env, jira, github, hub)
    print(text)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
            handle.write(text)
    if hub and env.get("LOG_CHANNEL_ID"):
        try:
            hub.create_post(env["LOG_CHANNEL_ID"], line)
        except ServiceError as err:
            print(f"::warning::Couldn't write to release-agent-log: {err}")
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
