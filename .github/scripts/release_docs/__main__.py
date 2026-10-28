"""Command line: ``python -m release_docs resolve TASK`` and ``python -m release_docs run TASK``.

Run from ``.github/scripts`` so ``changelog_release`` and ``generate_changelog`` import.
Settings come from the environment; see ``.github/workflows/release-docs-task.yml``.
"""

import argparse
import difflib
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from changelog_release import changelog_path

from . import (
    calendar,
    changelog,
    docker_env,
    drafts,
    github_release,
    http,
    jira,
    notice,
    posts,
    publish,
    release_docs_pr,
    version_archive,
)
from .claude import Claude
from .github import GitHub
from .result import TODO_MARKER, Result
from .versions import Version

MODES = ("dry_run", "live")
PR_TASKS = ("version-archive", "docker-env", "upgrade-notice", "release-docs")
TASKS = PR_TASKS + ("github-release", "posts", "breaking-changes", "drafts")
SERVER_REPO = "mattermost/mattermost"
FINAL_TAG = re.compile(r"v\d+\.\d+\.\d+")
RELEASE_BRANCH = re.compile(r"release-(\d+)\.(\d+)")


# ── Resolve: does this event run the task, for which version, in which mode ─────────

def resolve(task: str, env: dict, event: dict) -> dict:
    mode = (env.get("INPUT_MODE") or env.get("PHASE3_MODE") or "dry_run").strip().lower().replace("-", "_")
    if mode not in MODES:
        raise ValueError(f"mode must be dry_run or live (PHASE3_MODE or the mode input), not {mode!r}")
    name = env.get("EVENT_NAME", "")
    if name == "workflow_dispatch":
        raw = (env.get("INPUT_VERSION") or "").strip()
        if task == "breaking-changes":
            if not raw:
                raise ValueError("the milestone input is required")
            return {"run": "true", "version": raw, "mode": mode, "reason": "dispatched"}
        return {"run": "true", "version": Version.parse(raw).tag, "mode": mode, "reason": "dispatched"}
    if name == "release":
        tag = event.get("release", {}).get("tag_name", "")
        if not FINAL_TAG.fullmatch(tag):
            return {"run": "false", "reason": f"{tag} is not a final release tag (vX.Y.Z)"}
        return {"run": "true", "version": tag, "mode": mode, "reason": f"release {event.get('action')}"}
    if name == "push":
        ref = event.get("ref", "").removeprefix("refs/heads/")
        match = RELEASE_BRANCH.fullmatch(ref)
        if not match or not event.get("created"):
            return {"run": "false", "reason": f"push to {ref} is not a release branch being created"}
        return {"run": "true", "version": f"v{match.group(1)}.{match.group(2)}.0", "mode": mode, "reason": "branch cut"}
    raise ValueError(f"{task} does not run on {name or 'an unknown'} events")


# ── Shared inputs ───────────────────────────────────────────────────────────────────

def load_events(env: dict, fetch) -> tuple[list | None, str | None]:
    url = env.get("CALENDAR_ICS_URL", "").strip()
    if not url:
        return None, "RELEASE_AGENT_CALENDAR_ICS_URL is not set"
    status, text = fetch(url)
    if status != 200:
        return None, f"the Release Dates calendar returned HTTP {status}"
    return calendar.parse_ics(text), None


def release_day_for(version: Version, env: dict, events: list | None, result: Result) -> date | None:
    if env.get("RELEASE_DATE", "").strip():
        return date.fromisoformat(env["RELEASE_DATE"].strip())
    if events:
        day = calendar.release_day(events, version)
        if day:
            return day
    result.notes.append(f"No Release Day for {version.short}: set the release_date input or the calendar URL.")
    return None


def changelog_entry(gh, version: Version) -> tuple[str | None, str]:
    """(the entry, where it came from): master, else the open changelog PR's branch."""
    path = changelog_path(version.tag)
    base = Version(version.major, version.minor, 0)
    for ref in (gh.default_branch(SERVER_REPO), f"changelog/{base.tag}"):
        found = changelog.entry(gh.file(SERVER_REPO, path, ref) or "", version)
        if found:
            return found, f"{path} on {ref}"
    return None, ""


def highlights_for(gh, version: Version, claude, result: Result):
    entry, source = changelog_entry(gh, version)
    if not entry:
        result.todo(f"no {version.short} entry in the changelog on master or in an open changelog PR")
        return [], entry
    result.notes.append(f"Highlights picked from {source}.")
    picked, problem = changelog.pick_highlights(changelog.improvement_bullets(entry), claude)
    if problem:
        result.todo(problem)
    return picked, entry


def is_latest(gh, version: Version) -> bool:
    latest = gh.latest_release(SERVER_REPO)
    return bool(latest) and latest.get("tag_name") == version.tag


# ── Tasks ───────────────────────────────────────────────────────────────────────────

@dataclass
class Run:
    result: Result
    outcome: str  # what publishing did, or would do in a dry run
    highlights: list = field(default_factory=list)
    base_files: dict = field(default_factory=dict)  # changed paths as they were before this run


def run_task(task: str, raw_version: str, env: dict, gh, read_gh, claude, fetch=None, sleep=None) -> Run:
    fetch = fetch or http.fetch
    live = env.get("MODE") == "live"
    esr = env.get("ESR_VERSIONS", "")
    highlights = []

    if task == "breaking-changes":
        repos = [r.strip() for r in env.get("REPOS", SERVER_REPO).split(",") if r.strip()]
        prs = drafts.milestone_prs(read_gh, repos, raw_version, drafts.BREAKING_LABEL)
        return Run(drafts.breaking_notices(raw_version, prs, claude), "Nothing published: drafts only.")

    version = Version.parse(raw_version)
    released_event = env.get("EVENT_NAME") == "release"

    if task in PR_TASKS:
        repo = {"docker-env": docker_env.REPO, "upgrade-notice": notice.REPO}.get(task, SERVER_REPO)
        target = publish.locate(gh, repo, version.tag, task)

        def read(path):
            return gh.file(repo, path, target.ref)

        if task == "version-archive":
            kwargs = {"sleep": sleep} if sleep else {}
            facts = version_archive.wait_for_facts(version, fetch, int(env.get("WAIT_ATTEMPTS") or 12),
                                                   float(env.get("WAIT_SECONDS") or 300), **kwargs)
            result = version_archive.build(version, read(version_archive.ARCHIVE_PATH) or "", esr, facts)
        elif task == "docker-env":
            result = docker_env.build(version, read(docker_env.PATH) or "", esr)
        elif task == "upgrade-notice":
            if released_event and not is_latest(gh, version):
                result = Result(task, version.tag, skipped=f"{version} is not the latest release")
            elif version.is_dot:
                result = notice.build(version, "", date.today(), [])
            else:
                result = Result(task, version.tag)
                highlights, _ = highlights_for(gh, version, claude, result)
                day = date.fromisoformat(env["RELEASE_DATE"]) if env.get("RELEASE_DATE") else datetime.now(timezone.utc).date()
                built = notice.build(version, read(notice.PATH) or "", day, highlights)
                built.todos = result.todos + built.todos
                built.notes = result.notes + built.notes
                result = built
        else:
            events, problem = load_events(env, fetch)
            result = Result(task, version.tag)
            if problem and not env.get("RELEASE_DATE"):
                result.notes.append(problem)
            day = release_day_for(version, env, events, result)
            branch = f"release-{version.major}.{version.minor}"
            code_minimum = release_docs_pr.postgres_minimum(
                gh.file(SERVER_REPO, release_docs_pr.POSTGRES_REQUIREMENT, branch)
                if gh.branch_sha(SERVER_REPO, branch) else gh.file(SERVER_REPO, release_docs_pr.POSTGRES_REQUIREMENT, target.base))
            built = release_docs_pr.build(version, {p: read(p) for p in release_docs_pr.FILES}, esr, day, code_minimum)
            built.todos = result.todos + built.todos
            built.notes = result.notes + built.notes
            result = built
        if result.skipped:
            blocked = f" {target.blocked[0].upper()}{target.blocked[1:]}." if target.blocked else ""
            return Run(result, f"Skipped: {result.skipped}.{blocked}", highlights)
        base_files = {path: read(path) for path in result.files}
        return Run(result, publish.apply(gh, result, target, live), highlights, base_files)

    if task == "github-release":
        if released_event and not is_latest(gh, version):
            return Run(Result(task, version.tag, skipped=f"{version} is not the latest release"), "Skipped.")
        result = Result(task, version.tag)
        if not version.is_dot:
            highlights, _ = highlights_for(gh, version, claude, result)
        built = github_release.build(version, esr, highlights)
        built.todos, built.notes = result.todos + built.todos, result.notes + built.notes
        if built.skipped:
            return Run(built, f"Skipped: {built.skipped}.", highlights)
        release = gh.release_by_tag(SERVER_REPO, version.tag)
        if not release:
            built.todo(f"there is no GitHub release for {version.tag}")
            return Run(built, "Nothing written.", highlights)
        built.notes.append(f"Current description: {release.get('body') or '(empty)'}")
        if built.failed:
            return Run(built, "Nothing written: the text has missing inputs.", highlights)
        if (release.get("body") or "").strip() == built.text:
            return Run(built, "The release description already matches.", highlights)
        if not live:
            return Run(built, f"Dry run: would have set the {version.tag} release description.", highlights)
        gh.update_release_body(SERVER_REPO, release["id"], built.text)
        return Run(built, f"Set the {version.tag} release description.", highlights)

    if task == "posts":
        events, problem = load_events(env, fetch)
        result = Result(task, version.tag)
        highlights, entry = highlights_for(gh, version, claude, result)
        server_releases = gh.file(SERVER_REPO, release_docs_pr.SERVER_RELEASES, gh.default_branch(SERVER_REPO)) or ""
        built = posts.build(version, esr, events, highlights, changelog.blog_url(entry or "", version), server_releases)
        if problem:
            built.notes.append(problem)
        built.todos, built.notes = result.todos + built.todos, result.notes + built.notes
        return Run(built, "Nothing posted: text for copy and paste.", highlights)

    if task == "drafts":
        problems = []
        entry, _ = changelog_entry(gh, version)
        if not entry:
            problems.append(f"no {version.short} entry in the changelog on master or in an open changelog PR")
        repos = [r.strip() for r in env.get("REPOS", SERVER_REPO).split(",") if r.strip()]
        prs = drafts.milestone_prs(read_gh, repos, env.get("MILESTONE") or Version(version.major, version.minor, 0).tag)
        epics = []
        if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
            problems.append("RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN are not set, so Jira epics were not read")
        else:
            events, problem = load_events(env, fetch)
            day = release_day_for(version, env, events, Result(task, version.tag))
            fix_version = env.get("JIRA_FIX_VERSION") or (calendar.fix_version(version, day) if day else "")
            if not fix_version:
                problems.append(f"no Jira fix version for {version.short}: {problem or 'no Release Day on the calendar'}")
            else:
                epics = jira.epics(env.get("JIRA_URL") or jira.DEFAULT_URL, env["JIRA_EMAIL"], env["JIRA_TOKEN"], fix_version)
        bullets = changelog.improvement_bullets(entry or "")
        return Run(drafts.blog_and_email(version, bullets, prs, epics, claude, problems), "Nothing sent: drafts only.")

    raise ValueError(f"unknown task {task!r}")


# ── Output ──────────────────────────────────────────────────────────────────────────

def summary(result: Result, outcome: str, mode: str, base_files: dict, highlights: list) -> str:
    lines = [f"## {result.task} for {result.version} ({mode})", "", outcome, ""]
    if result.skipped:
        lines += [f"Not applicable: {result.skipped}.", ""]
    if result.todos:
        lines += ["### Missing inputs (this check fails)", ""] + [f"- {TODO_MARKER}: {t}" for t in result.todos] + [""]
    if result.notes:
        lines += ["### Notes", ""] + [f"- {n}" for n in result.notes] + [""]
    if highlights:
        lines += ["### Highlights and the changelog bullets they came from", ""]
        lines += [f"- **{h.name}**{f' ({h.url})' if h.url else ''}: {h.source}" for h in highlights] + [""]
    if result.files:
        lines += ["### Changes", "", "````diff", diff(result, base_files).rstrip(), "````", ""]
    if result.text:
        lines += ["### Output", "", result.text.rstrip(), ""]
    return "\n".join(lines) + "\n"


def diff(result: Result, base_files: dict) -> str:
    return "".join("".join(difflib.unified_diff((base_files.get(p) or "").splitlines(True), text.splitlines(True),
                                                f"a/{p}", f"b/{p}")) for p, text in result.files.items())


def write_outputs(out_dir: str, result: Result, text: str, base_files: dict) -> None:
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "summary.md"), "w", encoding="utf-8") as f:
        f.write(text)
    for path, content in result.files.items():
        target = os.path.join(out_dir, "files", path)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
    if result.files:
        with open(os.path.join(out_dir, "changes.diff"), "w", encoding="utf-8") as f:
            f.write(diff(result, base_files))
    with open(os.path.join(out_dir, "result.json"), "w", encoding="utf-8") as f:
        json.dump({"task": result.task, "version": result.version, "repo": result.repo, "branch": result.branch,
                   "title": result.title, "body": result.body, "text": result.text, "files": sorted(result.files),
                   "todos": result.todos, "notes": result.notes, "skipped": result.skipped}, f, indent=2)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="release_docs")
    parser.add_argument("command", choices=("resolve", "run"))
    parser.add_argument("task", choices=TASKS)
    args = parser.parse_args(argv)
    env = dict(os.environ)

    if args.command == "resolve":
        event = {}
        if env.get("GITHUB_EVENT_PATH") and os.path.exists(env["GITHUB_EVENT_PATH"]):
            with open(env["GITHUB_EVENT_PATH"], encoding="utf-8") as f:
                event = json.load(f)
        try:
            outputs = resolve(args.task, env, event)
        except ValueError as err:
            print(f"::error::{err}")
            return 1
        with open(env.get("GITHUB_OUTPUT", os.devnull), "a", encoding="utf-8") as f:
            for key, value in outputs.items():
                print(f"{key}={value}")
                f.write(f"{key}={value}\n")
        return 0

    gh = GitHub(env["GITHUB_TOKEN"])
    read_gh = GitHub(env.get("READ_TOKEN") or env["GITHUB_TOKEN"])
    run = run_task(args.task, env["VERSION"], env, gh, read_gh, Claude.from_env())
    result = run.result
    text = summary(result, run.outcome, env.get("MODE", "dry_run"), run.base_files, run.highlights)
    print(text)
    write_outputs(env.get("OUTPUT_DIR") or "release-docs-output", result, text, run.base_files)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)
    for todo in result.todos:
        print(f"::error title=Missing input::{todo}")
    return 1 if result.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
