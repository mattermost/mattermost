"""Command line: ``python -m release_docs resolve TASK``, ``run TASK`` and ``check TASK``.

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

from changelog_release import MIGRATIONS_DIR, changelog_path, parse_ls_remote, unreleased_branches

from . import (
    changelog,
    changelog_run,
    docker_env,
    dot_release,
    esr,
    github_release,
    http,
    markers,
    milestones,
    notice,
    publish,
    release_docs_pr,
    schedule,
    upgrade_docs,
    version_archive,
)
from .claude import Claude
from .github import GitHub, GitHubError
from .result import TODO_MARKER, Result
from .versions import Version, long_date

MODES = ("dry_run", "live")
PR_TASKS = ("version-archive", "docker-env", "upgrade-notice", "release-docs")
# Tasks that work out for themselves on a weekday run whether today is their day, so the
# resolve step only says "scheduled".
SCHEDULED_TASKS = (esr.TASK,)
TASKS = PR_TASKS + (dot_release.TASK, "github-release") + SCHEDULED_TASKS
SCHEDULED = "scheduled"
SERVER_REPO = "mattermost/mattermost"
FINAL_TAG = re.compile(r"v\d+\.\d+\.\d+")
DOT_RELEASE_HANDLED = "handled by the dot release docs PR"
# Dot releases for several minors ship together; a release event also picks up the others
# published this recently, in case their own runs were cancelled while waiting their turn.
SWEEP_DAYS = 3
RC1_TAG = re.compile(r"v(\d+)\.(\d+)\.0-rc1")
RELEASE_DOCS_BRANCH = re.compile(r"^release-agent/(v\d+\.\d+\.0)/" + re.escape(release_docs_pr.TASK) + "$")
DOT_RELEASE_BRANCH = re.compile(re.escape(dot_release.BRANCH_PREFIX) + r"(v\d+\.\d+\.[1-9]\d*)")
# A description edit reruns the task of the PR it was made to when it changed the hidden marker
# mattermost/release-automation writes there: (the PR's branch, the marker).
MARKER_EDITS = {release_docs_pr.TASK: (RELEASE_DOCS_BRANCH, upgrade_docs.MARKER_NAME),
                dot_release.TASK: (DOT_RELEASE_BRANCH, dot_release.SECURITY_MARKER)}


# ── Resolve: does this event run the task, for which version, in which mode ─────────

def from_release(env: dict) -> bool:
    """Whether a release event started this run: the event itself, or (since a release event's run
    can't use the write key in `release-write`) a dispatch on master that its trigger job started
    with source_event=release. The trigger job validated the tag first."""
    return env.get("EVENT_NAME") == "release" or env.get("SOURCE_EVENT") == "release"


def release_at_rc(gh) -> Version | None:
    """The release between its RC-1 and its final tag: the oldest cut ``release-X.Y`` with a
    ``vX.Y.0-rcN`` tag and no ``vX.Y.0`` tag. Same rule as generate-changelog.yml, from
    changelog_release.py."""
    refs = gh.matching_refs(SERVER_REPO, "heads/release-") + gh.matching_refs(SERVER_REPO, "tags/v")
    branches, tags, rcs = parse_ls_remote("\n".join(refs))
    candidates = [b for b in unreleased_branches(branches, tags) if b in rcs]
    return Version(candidates[0][0], candidates[0][1], 0) if candidates else None


def resolve(task: str, env: dict, event: dict, gh=None) -> dict:
    mode = (env.get("INPUT_MODE") or env.get("PHASE3_MODE") or "dry_run").strip().lower().replace("-", "_")
    if mode not in MODES:
        raise ValueError(f"mode must be dry_run or live (PHASE3_MODE or the mode input), not {mode!r}")
    name = env.get("EVENT_NAME", "")
    if name == "workflow_dispatch":
        raw = (env.get("INPUT_VERSION") or "").strip()
        if task in SCHEDULED_TASKS and not raw:
            return {"run": "true", "version": SCHEDULED, "mode": mode, "reason": "dispatched without a version: today's work"}
        if task == dot_release.TASK:
            versions = parse_versions(raw)
            if not versions:
                raise ValueError("the versions input is required, e.g. v12.1.1, v11.7.15")
            return {"run": "true", "version": ",".join(v.tag for v in versions), "mode": mode, "reason": "dispatched"}
        return {"run": "true", "version": Version.parse(raw).tag, "mode": mode, "reason": "dispatched"}
    if name == "release":
        tag = event.get("release", {}).get("tag_name", "")
        if not FINAL_TAG.fullmatch(tag):
            return {"run": "false", "reason": f"{tag} is not a final release tag (vX.Y.Z)"}
        dot = Version.parse(tag).is_dot
        if task == "version-archive" and dot:
            return {"run": "false", "reason": f"{tag} is a dot release: {DOT_RELEASE_HANDLED}"}
        if task == dot_release.TASK and not dot:
            return {"run": "false", "reason": f"{tag} is a feature release: the version archive task handles it"}
        return {"run": "true", "version": tag, "mode": mode, "reason": f"release {event.get('action')}"}
    if name == "schedule" and task in SCHEDULED_TASKS:
        return {"run": "true", "version": SCHEDULED, "mode": mode, "reason": "weekday run: the task checks whether it's due"}
    if name == "schedule" and task == release_docs_pr.TASK:
        # A weekday backstop for the vX.Y.0-rc1 tag event: the task updates the PR it already
        # opened, so a run after the tag event changes nothing unless something new arrived.
        version = release_at_rc(gh)
        if not version:
            return {"run": "false", "reason": "no release is between its vX.Y.0-rc1 and vX.Y.0 tags"}
        return {"run": "true", "version": version.tag, "mode": mode,
                "reason": f"weekday run between {version.tag}-rc1 and {version.tag}"}
    if name == "schedule":
        raise ValueError(f"{task} does not run on a schedule")
    if name == "push" and event.get("ref", "").startswith("refs/tags/"):
        # The release docs PR opens at RC-1, the same point as the changelog PR: when vX.Y.0-rc1
        # is tagged on release-X.Y.
        tag = event["ref"].removeprefix("refs/tags/")
        match = RC1_TAG.fullmatch(tag)
        if task != release_docs_pr.TASK or not match or not event.get("created"):
            return {"run": "false", "reason": f"tag {tag} is not a vX.Y.0-rc1 tag being created"}
        branch = f"release-{match.group(1)}.{match.group(2)}"
        sha = gh.tag_sha(SERVER_REPO, tag)
        if not gh.branch_sha(SERVER_REPO, branch) or not sha or not gh.on_branch(SERVER_REPO, branch, sha):
            return {"run": "false", "reason": f"{tag} is not on {branch}"}
        return {"run": "true", "version": f"v{match.group(1)}.{match.group(2)}.0", "mode": mode, "reason": f"{tag} tagged"}
    if name == "pull_request" and task in MARKER_EDITS:
        return resolve_marker_edit(task, env, event, mode)
    raise ValueError(f"{task} does not run on {name or 'an unknown'} events")


def resolve_marker_edit(task: str, env: dict, event: dict, mode: str) -> dict:
    """An edit to the task's own PR (same repo, into master, on the task's branch) reruns the task
    when it changed what the task's marker says. The version comes from the branch name. The
    task's own rewrites of the description keep the marker (publish.kept_markers), so they never
    rerun it. Nothing from the PR's title or description is ever written to the outputs."""
    branch_rule, marker = MARKER_EDITS[task]
    pr = event.get("pull_request") or {}
    repo = env.get("GITHUB_REPOSITORY") or (event.get("repository") or {}).get("full_name", "")
    match = branch_rule.fullmatch((pr.get("head") or {}).get("ref", ""))
    if event.get("action") != "edited":
        return {"run": "false", "reason": "not a PR description edit"}
    if not repo or ((pr.get("head") or {}).get("repo") or {}).get("full_name") != repo:
        return {"run": "false", "reason": "the PR's branch is not in this repo"}
    if (pr.get("base") or {}).get("ref") != "master" or pr.get("state") != "open":
        return {"run": "false", "reason": "not an open PR into master"}
    if not match:
        return {"run": "false", "reason": f"not the {task} PR's branch"}
    body = (event.get("changes") or {}).get("body")
    if not body or not markers.changed(body.get("from"), pr.get("body"), marker):
        return {"run": "false", "reason": f"the edit did not change the `{marker}` marker"}
    version = Version.parse(match.group(1))
    return {"run": "true", "version": version.tag, "mode": mode, "reason": f"the `{marker}` marker changed"}


# ── Shared inputs ───────────────────────────────────────────────────────────────────

def parse_versions(raw: str) -> list[Version]:
    """``v12.1.1, v11.7.15`` (commas or spaces), in the order given, without repeats."""
    versions = []
    for part in re.split(r"[\s,]+", raw or ""):
        if part.strip():
            version = Version.parse(part)
            if version not in versions:
                versions.append(version)
    return versions


def released_together(gh, trigger: Version, now: datetime) -> list[Version]:
    """The dot releases published on GitHub in the last few days, besides ``trigger``."""
    found = []
    for release in gh.recent_releases(SERVER_REPO):
        # published_at, not created_at: GitHub sets that to the commit's date, so a release tagged days
        # before it was published would be skipped as old.
        tag, published = release.get("tag_name", ""), release.get("published_at") or ""
        if release.get("draft") or not FINAL_TAG.fullmatch(tag) or not published:
            continue
        version = Version.parse(tag)
        age = now - datetime.fromisoformat(published.replace("Z", "+00:00"))
        if version.is_dot and version != trigger and age.days < SWEEP_DAYS:
            found.append(version)
    return sorted(set(found), reverse=True)


def today_utc(env: dict) -> date:
    """Today in UTC, or ``NOW`` (an ISO date or time) when set, for tests and reruns. A time with
    an offset is converted to UTC first; a date, or a time without an offset, is taken as UTC."""
    raw = (env.get("NOW") or "").strip()
    if not raw:
        return datetime.now(timezone.utc).date()
    now = datetime.fromisoformat(raw)
    return (now.astimezone(timezone.utc) if now.tzinfo else now).date()


def release_days(gh, result: Result) -> dict:
    """``{"Server" | "Desktop" | "Mobile": {(major, minor): Release Day}}`` from the ``vX.Y.0``
    milestones' due dates. A repo whose milestones can't be read is a TODO and has none."""
    days = {}
    for kind, repo in milestones.REPOS.items():
        try:
            days[kind] = milestones.release_days(gh, repo)
        except GitHubError as err:
            result.todo(f"the milestones of {repo} could not be read (GitHub API {err.status}), so no Release Day "
                        "comes from them")
            days[kind] = {}
    return days


def changelog_entry(gh, version: Version) -> tuple[str | None, str]:
    """(the entry, where it came from): master, else the open changelog PR's branch."""
    path = changelog_path(version.tag)
    base = Version(version.major, version.minor, 0)
    branch = f"changelog/{base.tag}"
    refs = [gh.default_branch(SERVER_REPO)]
    # The branch of a closed, unmerged changelog PR is not a source: only an open PR's.
    if any(p.get("state") == "open" for p in gh.pulls_for_branch(SERVER_REPO, branch)):
        refs.append(branch)
    for ref in refs:
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


def run_task(task: str, raw_version: str, env: dict, gh, claude, fetch=None, sleep=None) -> Run:
    fetch = fetch or http.fetch
    live = env.get("MODE") == "live"
    esr_versions = env.get("ESR_VERSIONS", "")
    reviewers = env.get("REVIEWERS", "")
    highlights = []

    if task == dot_release.TASK:
        versions = parse_versions(raw_version)
        result_notes = []
        if from_release(env) and versions:
            others = released_together(gh, versions[0], datetime.now(timezone.utc))
            versions += [v for v in others if v not in versions]
            if others:
                result_notes.append(f"Also checked the dot releases published in the last {SWEEP_DAYS} days: "
                                    f"{', '.join(v.tag for v in others)}.")
        result, outcome, base_files = dot_release.run(gh, versions, env, claude, fetch, live, sleep)
        result.notes = result_notes + result.notes
        return Run(result, outcome, base_files=base_files)

    if task == esr.TASK:
        mobile_gh = GitHub(env.get("READ_TOKEN") or env.get("GITHUB_TOKEN", ""), write_token=env["MOBILE_WRITE_TOKEN"],
                           committer=getattr(gh, "committer", None)) if env.get("MOBILE_WRITE_TOKEN") else None
        result = run_esr_comms(raw_version, env, gh, today_utc(env), live, mobile_gh)
        return Run(result, "ESR comms." if result.text else "Nothing done.")

    version = Version.parse(raw_version)
    released_event = from_release(env)

    if task == "version-archive" and version.is_dot:
        return Run(Result(task, version.tag, skipped=f"{version} is a dot release: {DOT_RELEASE_HANDLED}"),
                   f"Skipped: {version} is a dot release, {DOT_RELEASE_HANDLED}.")

    if task in PR_TASKS:
        repo = {"docker-env": docker_env.REPO, "upgrade-notice": notice.REPO}.get(task, SERVER_REPO)
        target = publish.locate(gh, repo, version.tag, task)

        def read(path):
            return gh.file(repo, path, target.ref)

        if task == "version-archive":
            kwargs = {"sleep": sleep} if sleep else {}
            facts = version_archive.wait_for_facts(version, fetch, int(env.get("WAIT_ATTEMPTS") or 12),
                                                   float(env.get("WAIT_SECONDS") or 300), **kwargs)
            result = version_archive.build(version, read(version_archive.ARCHIVE_PATH) or "", esr_versions, facts)
        elif task == "docker-env":
            result = docker_env.build(version, read(docker_env.PATH) or "", esr_versions)
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
            result = build_release_docs(version, env, gh, claude, target, read)
        if result.skipped:
            blocked = f" {target.blocked[0].upper()}{target.blocked[1:]}." if target.blocked else ""
            return Run(result, f"Skipped: {result.skipped}.{blocked}", highlights)
        base_files = {path: read(path) for path in result.files}
        return Run(result, publish.apply(gh, result, target, live, reviewers), highlights, base_files)

    if task == "github-release":
        if released_event and not is_latest(gh, version):
            return Run(Result(task, version.tag, skipped=f"{version} is not the latest release"), "Skipped.")
        result = Result(task, version.tag)
        if not version.is_dot:
            highlights, _ = highlights_for(gh, version, claude, result)
        built = github_release.build(version, esr_versions, highlights)
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

    raise ValueError(f"unknown task {task!r}")


# ── The release docs PR ─────────────────────────────────────────────────────────────

def build_release_docs(version: Version, env: dict, gh, claude, target, read) -> Result:
    result = Result(release_docs_pr.TASK, version.tag)
    days = release_days(gh, result)
    day = days["Server"].get(version.line)
    if day is None:
        result.todo(milestones.missing(version))
    branch = f"release-{version.major}.{version.minor}"
    code_minimum = release_docs_pr.postgres_minimum(
        gh.file(SERVER_REPO, release_docs_pr.POSTGRES_REQUIREMENT, branch)
        if gh.branch_sha(SERVER_REPO, branch) else gh.file(SERVER_REPO, release_docs_pr.POSTGRES_REQUIREMENT, target.base))
    upgrade = upgrade_from_marker(env, gh, claude, version, target, result)
    built = release_docs_pr.build(version, {p: read(p) for p in release_docs_pr.FILES}, env.get("ESR_VERSIONS", ""),
                                  day, code_minimum, days, upgrade, today_utc(env))
    built.todos = result.todos + [t for t in built.todos if t not in result.todos]
    built.notes = result.notes + built.notes
    return built


def upgrade_from_marker(env: dict, gh, claude, version: Version, target, result: Result):
    """Important Upgrade Notes and Deprecated Features from the confirmed breaking changes, or None
    while the release docs PR's description has no marker naming them.

    mattermost/release-automation writes the marker (upgrade_docs.MARKER_NAME). Each confirmed
    PR's wording is its changelog bullets (the changelog runs' sections.json, matched to the
    entry as it is now); Claude drafts only for a confirmed PR with no bullet."""
    confirmed, problem = upgrade_docs.parse_marker((target.pr or {}).get("body"))
    if problem:
        return upgrade_docs.plan([], {}, {}, f"{problem}, so the confirmed breaking changes are unknown")
    if confirmed is None:
        result.notes.append(f"No confirmed breaking changes yet: the PR description has no `{upgrade_docs.MARKER_NAME}` "
                            "marker, so Important Upgrade Notes and Deprecated Features keep their placeholders.")
        return None
    if not confirmed:
        return upgrade_docs.plan([], {}, {})
    reports, report_problem = changelog_run.fetch_reports(version.tag, env.get("ACTIONS_TOKEN", ""))
    items = changelog_run.items(reports)
    if report_problem and not items:
        return upgrade_docs.plan(confirmed, {}, {}, f"the changelog run's bullets could not be read ({report_problem})")
    branch = f"release-{version.major}.{version.minor}"
    for item in items:  # a schema bullet written for a migration is the bullet of the PR that added it
        for source in [s for s in item["sources"] if s.startswith("migration:")]:
            sha = gh.last_commit_for_path(SERVER_REPO, f"{MIGRATIONS_DIR}/{source[len('migration:'):]}.up.sql", branch)
            item["sources"] += [f"{SERVER_REPO}#{p['number']}" for p in (gh.commit_pulls(SERVER_REPO, sha) if sha else [])]
    entry, _ = changelog_entry(gh, version)
    bullets = {source: changelog_run.bullets_for(source, items, entry) for source in confirmed}
    bare = [s for s in confirmed if not upgrade_docs.has_wording(bullets[s])]
    prs = {s: gh.pull(SERVER_REPO, int(s.rsplit("#", 1)[1])) for s in bare}
    holder = Result(release_docs_pr.TASK, version.tag)
    drafted = upgrade_docs.draft_notices({s: pr for s, pr in prs.items() if pr}, claude, holder)
    docs = upgrade_docs.plan(confirmed, bullets, drafted)
    docs.todos = holder.todos + docs.todos
    return docs


# ── ESR comms: the ESR docs PR and the mobile ESR PR ───────────────────────────────

def mobile_changes_text(built: Result, target, base_files: dict) -> str:
    """The mobile ESR PR's exact changes, for a person to make when the workflow can't open the PR."""
    changes = "".join("".join(difflib.unified_diff((base_files.get(p) or "").splitlines(True), text.splitlines(True),
                                                   f"a/{p}", f"b/{p}")) for p, text in built.files.items())
    diff = f"````diff\n{changes.rstrip()}\n````"
    if target.pr:
        # The PR is already open: the diff is against its branch as it is now, not the base.
        return (f"#### The mobile ESR PR, to update by hand: {esr.MOBILE_REPO}#{target.pr['number']}\n\n"
                f"Apply this to its current branch `{target.branch}`:\n\n{diff}\n\nPR description:\n\n{built.body}")
    where = (f"On the existing branch `{target.branch}`" if target.ref == target.branch
             else f"On a branch `{target.branch}` from `{target.base}`")
    return (f"#### The mobile ESR PR, to open by hand in {esr.MOBILE_REPO}\n\n"
            f"{where}, as a draft PR titled \"{built.title}\":\n\n{diff}\n\nPR description:\n\n{built.body}")


def mobile_esr_pr(item, env: dict, gh, mobile_gh, live: bool, result: Result) -> tuple[str, str]:
    """The draft PR in mattermost-mobile making the new ESR the minimum server, as #9954 did.
    (what happened, the changes to make by hand or "").

    Written with ``mobile_gh`` (the changelog write app, limited to mattermost-mobile). In a
    live run without it, nothing is written there: the run fails and its summary has the changes."""
    if item.new is None:
        result.todo(f"CHANGELOG_ESR_VERSIONS lists no ESR after {item.old.short}, so no mobile ESR PR was opened")
        return "not opened", ""
    target = publish.locate(gh, esr.MOBILE_REPO, f"{item.new.tag}-before", esr.MOBILE_TASK)
    base_files = {p: gh.file(esr.MOBILE_REPO, p, target.ref) or "" for p in esr.MOBILE_FILES}
    built = esr.mobile_result(item, base_files, env.get("ESR_VERSIONS", ""))
    result.todos += [t for t in built.todos if t not in result.todos]
    result.notes += built.notes
    if live and mobile_gh is None and built.files and not target.blocked:
        result.todo(f"no changelog write app token for {esr.MOBILE_REPO} (is the app installed there?), so the mobile "
                    "ESR PR was not opened; its changes are in this run's summary, to make by hand")
        return f"not opened (no write token for {esr.MOBILE_REPO})", mobile_changes_text(built, target, base_files)
    return publish.apply(mobile_gh or gh, built, target, live, env.get("REVIEWERS", "")), ""


def run_esr_comms(raw: str, env: dict, gh, today: date, live: bool, mobile_gh=None) -> Result:
    """By hand for one ESR (``raw`` its line, ESR_STAGE the stage), or on a weekday run for the ESRs
    due today: three months before support ends, or the day it does (or the next working day)."""
    result = Result(esr.TASK, raw)
    server_releases = gh.file(SERVER_REPO, release_docs_pr.SERVER_RELEASES, gh.default_branch(SERVER_REPO)) or ""
    all_esrs = esr.esrs(env.get("ESR_VERSIONS", ""), server_releases)
    if raw != SCHEDULED:
        line = Version.parse(raw)
        stage = (env.get("ESR_STAGE") or esr.ENDED).strip()
        jobs = [(e, stage) for e in all_esrs if e.old.line == line.line]
        if not jobs:
            result.todo(f"{line.short} is not a released ESR in CHANGELOG_ESR_VERSIONS and the server releases table")
    else:
        jobs = esr.due(today, all_esrs, schedule.due_on)
        if not jobs:
            result.text = "Not due: no ESR goes out of support in three months or today."
            return result
    desktop = esr.desktop_versions(env.get("DESKTOP_ESR_VERSIONS", ""), result)
    lines, by_hand = [], []
    for item, stage in jobs:
        label = f"{item.old.short} ESR, {'end of support' if stage == esr.ENDED else 'three months before'} ({long_date(item.end)})"
        target = publish.locate(gh, SERVER_REPO, f"{item.old.tag}-{stage}", esr.DOCS_TASK)
        docs = esr.docs_result(item, stage, {p: gh.file(SERVER_REPO, p, target.ref) or "" for p in esr.DOCS_FILES}, desktop)
        outcome = publish.apply(gh, docs, target, live, env.get("REVIEWERS", "")) if docs.files else "no docs changes needed"
        lines.append(f"- {label}: docs PR: {outcome}")
        result.todos += [t for t in docs.todos if t not in result.todos]
        result.notes += docs.notes
        if stage == esr.BEFORE:
            outcome, changes = mobile_esr_pr(item, env, gh, mobile_gh, live, result)
            lines.append(f"- {label}: mobile ESR PR: {outcome}")
            if changes:
                by_hand.append(changes)
    result.text = "\n".join(lines) + "".join(f"\n\n{text}" for text in by_hand)
    return result


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
    if result.task == dot_release.TASK and result.body:
        lines += ["### PR description", "", result.body.rstrip(), ""]
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


def check_dot_release_pr(env: dict) -> int:
    """The dot release docs PR's check, run in its checkout: the files on disk against ``BASE_REF``."""
    import subprocess

    def at_base(path: str) -> str:
        shown = subprocess.run(["git", "show", f"{env.get('BASE_REF', 'HEAD^1')}:{path}"], capture_output=True, text=True)
        return shown.stdout if shown.returncode == 0 else ""

    root = env.get("REPO_ROOT") or subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True,
                                                  text=True).stdout.strip()
    title = env.get("PR_TITLE", "")
    paths = {dot_release.SERVER_RELEASES, dot_release.ARCHIVE, *dot_release.DEPLOY_PAGES}
    paths |= {dot_release.changelog_path(Version.parse(t)) for t in dot_release.versions_in_title(title)}
    files, base = {}, {}
    for path in sorted(paths):
        with open(os.path.join(root, path), encoding="utf-8") as f:
            files[path] = f.read()
        base[path] = at_base(path)
    problems = dot_release.check_pr(title, files, base)
    lines = [f"## Dot release docs check: {title}", ""]
    lines += [f"- {p}" for p in problems] or ["No `<SEVERITY>`, TBD checksum, TODO marker or consistency problem left."]
    text = "\n".join(lines) + "\n"
    print(text)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)
    for problem in problems:
        print(f"::error title=Dot release docs::{problem}")
    return 1 if problems else 0


UPGRADE_PAGES = {release_docs_pr.UPGRADE_NOTES: "Important Upgrade Notes",
                 release_docs_pr.DEPRECATED_FEATURES: "Deprecated Features"}


def release_docs_problems(files: dict) -> list[str]:
    """What still keeps the release docs PR from merging: a placeholder or TODO marker left on the
    Important Upgrade Notes or Deprecated Features page (the confirmed breaking changes aren't
    known yet, or a confirmed one has no wording). Other pages' placeholders are filled in later
    PRs and don't count."""
    problems = []
    for path, what in UPGRADE_PAGES.items():
        text = files.get(path) or ""
        for line in text.splitlines():
            if release_docs_pr.PLACEHOLDER_MARKER in line and what in line:
                problems.append(f"{path} still has its {what} placeholder: the confirmed breaking changes aren't in the "
                                "PR description yet, or a confirmed one has no wording (see the PR's Missing inputs)")
            elif TODO_MARKER in line:
                problems.append(f"{path} has a {TODO_MARKER} marker")
    return problems


def release_docs_verdict(problems: list[str], release_day: date | None, today: date,
                         day_problem: str = "") -> tuple[list[str], list[str]]:
    """(errors, notes) of the release docs PR's check. A placeholder or marker left on the upgrade
    pages fails it from T-2, two working days (Monday to Friday) before Release Day, the
    ``vX.Y.0`` milestone's due date; before that the check passes and says when it will fail.
    With no Release Day, it fails: when T-2 is can't be known."""
    if not problems:
        return [], []
    if release_day is None:
        return problems + [day_problem or "no Release Day, so T-2 is unknown"], []
    fails_from = release_docs_pr.check_fails_from(release_day)
    if today >= fails_from:
        return [f"{p} (T-{release_docs_pr.CHECK_FAILS_FROM_T} was {fails_from.isoformat()})" for p in problems], []
    return [], [f"{p}. Not failing yet: this check fails from T-{release_docs_pr.CHECK_FAILS_FROM_T} "
                f"({fails_from.isoformat()}, Release Day {release_day.isoformat()})." for p in problems]


def release_docs_check_day(env: dict, gh) -> tuple[date | None, str]:
    """(Release Day of the release the PR branch names, why there is none)."""
    match = RELEASE_DOCS_BRANCH.match(env.get("HEAD_REF", ""))
    if not match:
        return None, f"the branch {env.get('HEAD_REF', '')!r} is not release-agent/vX.Y.0/{release_docs_pr.TASK}"
    version = Version.parse(match.group(1))
    try:
        day = milestones.release_days(gh, SERVER_REPO).get(version.line)
    except GitHubError as err:
        return None, f"the milestones of {SERVER_REPO} could not be read (GitHub API {err.status}), so T-2 is unknown"
    return day, "" if day else milestones.missing(version) + ", so T-2 is unknown"


def check_release_docs_pr(env: dict, gh=None) -> int:
    """The release docs PR's check, run in its checkout."""
    import subprocess

    root = env.get("REPO_ROOT") or subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True,
                                                  text=True).stdout.strip()
    files = {}
    for path in UPGRADE_PAGES:
        with open(os.path.join(root, path), encoding="utf-8") as f:
            files[path] = f.read()
    problems = release_docs_problems(files)
    day, day_problem = (None, "")
    if problems:
        day, day_problem = release_docs_check_day(env, gh or GitHub(env.get("GITHUB_TOKEN", "")))
    errors, notes = release_docs_verdict(problems, day, today_utc(env), day_problem)
    lines = ["## Release docs check: Important Upgrade Notes and Deprecated Features", ""]
    lines += [f"- {p}" for p in errors + notes] or ["No placeholder or TODO marker left on either page."]
    text = "\n".join(lines) + "\n"
    print(text)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)
    for error in errors:
        print(f"::error title=Release docs::{error}")
    for note in notes:
        print(f"::notice title=Release docs::{note}")
    return 1 if errors else 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="release_docs")
    parser.add_argument("command", choices=("resolve", "run", "check"))
    parser.add_argument("task", choices=TASKS)
    args = parser.parse_args(argv)
    env = dict(os.environ)

    if args.command == "check":
        if args.task == release_docs_pr.TASK:
            return check_release_docs_pr(env)
        if args.task != dot_release.TASK:
            parser.error(f"check is only for {dot_release.TASK} and {release_docs_pr.TASK}")
        return check_dot_release_pr(env)

    if args.command == "resolve":
        event = {}
        if env.get("GITHUB_EVENT_PATH") and os.path.exists(env["GITHUB_EVENT_PATH"]):
            with open(env["GITHUB_EVENT_PATH"], encoding="utf-8") as f:
                event = json.load(f)
        try:
            outputs = resolve(args.task, env, event, GitHub(env["GITHUB_TOKEN"]) if env.get("GITHUB_TOKEN") else None)
        except ValueError as err:
            print(f"::error::{err}")
            return 1
        with open(env.get("GITHUB_OUTPUT", os.devnull), "a", encoding="utf-8") as f:
            for key, value in outputs.items():
                print(f"{key}={value}")
                f.write(f"{key}={value}\n")
        return 0

    # Reads use the changelog read app's token and writes the changelog write app's, commits are authored
    # as CHANGELOG_GIT_USERNAME / CHANGELOG_GIT_EMAIL. A dry run without either reads with GITHUB_TOKEN.
    read_token = env.get("READ_TOKEN") or env["GITHUB_TOKEN"]
    committer = {"name": env["COMMIT_USER_NAME"], "email": env["COMMIT_USER_EMAIL"]} \
        if env.get("COMMIT_USER_NAME") and env.get("COMMIT_USER_EMAIL") else None
    gh = GitHub(read_token, write_token=env.get("WRITE_TOKEN", ""), committer=committer)
    return finish(run_task(args.task, env["VERSION"], env, gh, Claude.from_env()), env)


def finish(run: Run, env: dict) -> int:
    """Print the run's output to the log and the run summary, and write it to OUTPUT_DIR (the
    release-docs-<task> artifact). Missing inputs fail the run."""
    result, mode = run.result, env.get("MODE", "dry_run")
    out_dir = env.get("OUTPUT_DIR") or "release-docs-output"
    text = summary(result, run.outcome, mode, run.base_files, run.highlights)
    write_outputs(out_dir, result, text, run.base_files)
    print(text)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)
    for error in result.todos:
        print(f"::error title=Missing input::{error}")
    return 1 if result.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
