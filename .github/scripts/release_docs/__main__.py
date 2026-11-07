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

from changelog_release import changelog_path, parse_ls_remote, unreleased_branches

from . import (
    announcement,
    breaking,
    calendar,
    changelog,
    docker_env,
    dot_release,
    drafts,
    esr,
    feature_review,
    gcal,
    github_release,
    http,
    jira,
    key_dates,
    marketing,
    notice,
    posts,
    publish,
    release_docs_pr,
    report,
    schedule,
    version_archive,
)
from . import hub as hublib
from . import highlights as highlights_slide
from .claude import Claude
from .github import GitHub
from .result import TODO_MARKER, Result
from .versions import Version, add_months, changelog_url, long_date

MODES = ("dry_run", "live")
PR_TASKS = ("version-archive", "docker-env", "upgrade-notice", "release-docs")
# Hub and calendar tasks: they post to Hub or write to Google Calendar (and, for ESR comms,
# open a docs PR and Jira tickets). On a schedule each works out for itself whether today is
# its day, so the resolve step only says "scheduled".
HUB_TASKS = (announcement.TASK, key_dates.TASK, marketing.TASK, esr.TASK, feature_review.TASK)
TASKS = PR_TASKS + (dot_release.TASK, "github-release", "posts", "breaking-changes", "drafts", highlights_slide.TASK) + HUB_TASKS
SCHEDULED = "scheduled"
# Their output names Jira keys, epics and mattermost/enterprise PRs: it goes to Hub only (report.py).
PRIVATE_TASKS = ("drafts", highlights_slide.TASK, "breaking-changes")
SERVER_REPO = "mattermost/mattermost"
FINAL_TAG = re.compile(r"v\d+\.\d+\.\d+")
DOT_RELEASE_HANDLED = "handled by the dot release docs PR"
# Dot releases for several minors ship together; a release event also picks up the others
# published this recently, in case their own runs were cancelled while waiting their turn.
SWEEP_DAYS = 3
RELEASE_BRANCH = re.compile(r"release-(\d+)\.(\d+)")
RC1_TAG = re.compile(r"v(\d+)\.(\d+)\.0-rc1")


# ── Resolve: does this event run the task, for which version, in which mode ─────────

def release_in_progress(gh) -> Version | None:
    """The newest release whose ``release-X.Y`` branch is cut but whose final ``vX.Y.0`` tag is not."""
    tags = {ref.removeprefix("refs/tags/") for ref in gh.matching_refs(SERVER_REPO, "tags/v")}
    open_releases = []
    for ref in gh.matching_refs(SERVER_REPO, "heads/release-"):
        match = RELEASE_BRANCH.fullmatch(ref.removeprefix("refs/heads/"))
        if match and f"v{match.group(1)}.{match.group(2)}.0" not in tags:
            open_releases.append(Version(int(match.group(1)), int(match.group(2)), 0))
    return max(open_releases, default=None)


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
        if task in HUB_TASKS and not raw:
            return {"run": "true", "version": SCHEDULED, "mode": mode, "reason": "dispatched without a version: today's work"}
        if task == "breaking-changes":
            if not raw:
                raise ValueError("the milestone input is required")
            return {"run": "true", "version": raw, "mode": mode, "reason": "dispatched"}
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
    if name == "schedule" and task in HUB_TASKS:
        return {"run": "true", "version": SCHEDULED, "mode": mode, "reason": "weekday run: the task checks whether it's due"}
    if name == "schedule" and task == release_docs_pr.TASK:
        # A weekday backstop for the vX.Y.0-rc1 tag event: the task updates the PR it already
        # opened, so a run after the tag event changes nothing.
        version = release_at_rc(gh)
        if not version:
            return {"run": "false", "reason": "no release is between its vX.Y.0-rc1 and vX.Y.0 tags"}
        return {"run": "true", "version": version.tag, "mode": mode,
                "reason": f"weekday run between {version.tag}-rc1 and {version.tag}"}
    if name == "schedule":
        # The breaking-change list runs every weekday from the branch cut until the final release is cut.
        if task != "breaking-changes":
            raise ValueError(f"{task} does not run on a schedule")
        version = release_in_progress(gh)
        if not version:
            return {"run": "false", "reason": "no release-X.Y branch is waiting for its final vX.Y.0 tag"}
        return {"run": "true", "version": version.tag, "mode": mode,
                "reason": f"weekday run between the release-{version.major}.{version.minor} branch cut and {version.tag}"}
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
    if name == "push":
        ref = event.get("ref", "").removeprefix("refs/heads/")
        match = RELEASE_BRANCH.fullmatch(ref)
        if not match or not event.get("created"):
            return {"run": "false", "reason": f"push to {ref} is not a release branch being created"}
        if task == release_docs_pr.TASK:
            return {"run": "false", "reason": "the release docs PR opens when vX.Y.0-rc1 is tagged, not at the branch cut"}
        return {"run": "true", "version": f"v{match.group(1)}.{match.group(2)}.0", "mode": mode, "reason": "branch cut"}
    raise ValueError(f"{task} does not run on {name or 'an unknown'} events")


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


def jira_labels_by_key(env: dict, problems: list):
    """A function from Jira keys to each ticket's labels, or None without Jira credentials."""
    if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
        return None
    client = jira.Jira(env.get("JIRA_URL") or jira.DEFAULT_URL, env["JIRA_EMAIL"], env["JIRA_TOKEN"])

    def labels(keys: set) -> dict:
        found = {}
        ordered = sorted(keys)
        for start in range(0, len(ordered), 100):
            batch = ordered[start:start + 100]
            try:
                issues = client.search(f"key in ({', '.join(batch)})", ["labels"])
            except Exception as err:  # noqa: BLE001 - reported; the results are listed for review either way
                problems.append(f"Jira labels for {', '.join(batch)} could not be read: {err}")
                continue
            for issue in issues:
                found[issue["key"]] = set(issue.get("fields", {}).get("labels", []))
        return found
    return labels


def jira_labels_reader(env: dict, problems: list):
    """A function from Jira keys to all their labels together, or None without Jira credentials."""
    by_key = jira_labels_by_key(env, problems)
    if by_key is None:
        return None
    return lambda keys: set().union(*by_key(keys).values())

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


def run_task(task: str, raw_version: str, env: dict, gh, read_gh, claude, fetch=None, sleep=None, docs=None) -> Run:
    run = _run_task(task, raw_version, env, gh, read_gh, claude, fetch, sleep, docs)
    if task in PRIVATE_TASKS:
        run.result.private = True
    return run


def _run_task(task: str, raw_version: str, env: dict, gh, read_gh, claude, fetch=None, sleep=None, docs=None) -> Run:
    fetch = fetch or http.fetch
    live = env.get("MODE") == "live"
    esr = env.get("ESR_VERSIONS", "")
    highlights = []

    if task == "breaking-changes":
        repos = [r.strip() for r in env.get("REPOS", SERVER_REPO).split(",") if r.strip()]
        jira_problems = []
        result = breaking.run(read_gh, repos, raw_version, env.get("CONFIRMED", ""), claude,
                              jira_labels_by_key(env, jira_problems))
        if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
            result.notes.append("Jira was not read (no RELEASE_AGENT_JIRA_* settings): labels were read from GitHub only.")
        result.notes += jira_problems
        return Run(result, "Nothing published: drafts only.")

    if task == dot_release.TASK:
        versions = parse_versions(raw_version)
        result_notes = []
        if env.get("EVENT_NAME") == "release" and versions:
            others = released_together(gh, versions[0], datetime.now(timezone.utc))
            versions += [v for v in others if v not in versions]
            if others:
                result_notes.append(f"Also checked the dot releases published in the last {SWEEP_DAYS} days: "
                                    f"{', '.join(v.tag for v in others)}.")
        jira_problems = []
        result, outcome, base_files = dot_release.run(gh, versions, env, claude, fetch, live,
                                                      jira_labels_reader(env, jira_problems), sleep)
        if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
            result_notes.append("Jira was not read (no RELEASE_AGENT_JIRA_* settings): security fixes were found "
                                "from GitHub labels only.")
        result.notes = result_notes + result.notes + jira_problems
        return Run(result, outcome, base_files=base_files)

    if task in HUB_TASKS:
        return run_hub_task(task, raw_version, env, gh, read_gh, claude, fetch)

    version = Version.parse(raw_version)
    released_event = env.get("EVENT_NAME") == "release"

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
        result = Result(task, version.tag)
        highlights, entry = highlights_for(gh, version, claude, result)
        built = posts.build(version, esr, highlights, changelog.blog_url(entry or "", version))
        built.todos, built.notes = result.todos + built.todos, result.notes + built.notes
        return Run(built, "Nothing posted: text for copy and paste.", highlights)

    if task == highlights_slide.TASK:
        if released_event and not is_latest(gh, version):
            return Run(Result(task, version.tag, skipped=f"{version} is not the latest release"), "Skipped.")
        if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
            result = Result(task, version.tag)
            result.todo("RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN are not set, so Jira was not read")
            return Run(result, "Nothing written.")
        client = jira.Jira(env.get("JIRA_URL") or jira.DEFAULT_URL, env["JIRA_EMAIL"], env["JIRA_TOKEN"])
        day = date.fromisoformat(env["RELEASE_DATE"]) if env.get("RELEASE_DATE") else None
        result = highlights_slide.build(version, client, claude, docs or highlights_slide.DocsIndex.from_checkout(),
                                  highlights_slide.load_config(), day)
        if result.skipped:
            return Run(result, f"Skipped: {result.skipped}.")
        return Run(result, "Nothing written to the deck: paste the slide from the file attached to the Hub post.")

    if task == "drafts":
        return Run(build_drafts(version, env, gh, read_gh, claude, fetch), "Nothing sent: drafts only.")

    raise ValueError(f"unknown task {task!r}")


# ── Drafts, and the Hub and calendar tasks ─────────────────────────────────────────

SEVERITY = re.compile(r"contains (?:an? )?(.+?) severity level security fix", re.IGNORECASE)
PATCH_REPOS = (
    ("mattermost/mattermost-mobile", "Mobile", "https://docs.mattermost.com/product-overview/mobile-app-changelog.html"),
    ("mattermost/desktop", "Desktop App", "https://docs.mattermost.com/product-overview/desktop-app-changelog.html"),
)


def now_utc(env: dict) -> datetime:
    raw = (env.get("NOW") or "").strip()
    return datetime.fromisoformat(raw) if raw else datetime.now(timezone.utc)


def releases_between(gh, repo: str, since: date, until: date, problems: list) -> list[Version]:
    """Dot releases published on GitHub after ``since`` and up to ``until``, newest first."""
    try:
        releases = gh.recent_releases(repo, 50)
    except Exception as err:  # noqa: BLE001 - reported; the email says what's missing
        problems.append(f"{repo} releases could not be read ({type(err).__name__})")
        return []
    found = set()
    for release in releases:
        tag, published = release.get("tag_name", ""), (release.get("published_at") or release.get("created_at") or "")[:10]
        if release.get("draft") or not FINAL_TAG.fullmatch(tag) or not published:
            continue
        version = Version.parse(tag)
        if version.is_dot and since < date.fromisoformat(published) <= until:
            found.add(version)
    return sorted(found, reverse=True)


def severity_of(gh, version: Version) -> str | None:
    """The severity a dot release's published changelog entry gives, e.g. "Low to Medium"."""
    content = gh.file(SERVER_REPO, changelog_path(version.tag), gh.default_branch(SERVER_REPO)) or ""
    match = SEVERITY.search(changelog.entry(content, version) or "")
    return match.group(1).strip() if match else None


def esr_section_for(day: date, env: dict, gh, problems: list):
    """(ESR, "before"/"ended", desktop ESR map) when ``day``'s month has ESR comms, else None."""
    server_releases = gh.file(SERVER_REPO, release_docs_pr.SERVER_RELEASES, gh.default_branch(SERVER_REPO)) or ""
    found = esr.for_month((day.year, day.month), esr.esrs(env.get("ESR_VERSIONS", ""), server_releases))
    if not found:
        return None
    holder = Result(esr.TASK, "")
    desktop = esr.desktop_versions(env.get("DESKTOP_ESR_VERSIONS", ""), holder)
    problems += holder.todos
    return found[0], found[1], desktop


def email_facts(version: Version, env: dict, gh, read_gh, claude, entry: str, day: date | None, prs: list,
                problems: list) -> drafts.EmailFacts:
    facts = drafts.EmailFacts(release_day=day, blog_url=changelog.blog_url(entry, version) if entry else "",
                              plugins=drafts.plugins_in(entry))
    if day is None:
        problems.append("no Release Day, so the security and patch releases and the ESR section were not looked up")
    else:
        since = add_months(day, -1)
        facts.security = [(dot, severity_of(gh, dot)) for dot in releases_between(read_gh, SERVER_REPO, since, day, problems)]
        for repo, label, url in PATCH_REPOS:
            facts.patches += [(f"{label} {v.tag}", url) for v in releases_between(read_gh, repo, since, day, problems)]
        found = esr_section_for(day, env, gh, problems)
        if found:
            holder = Result(esr.TASK, "")
            facts.esr_blog = esr.section(*found, holder)
            facts.esr_email = esr.section(*found, holder, email=True)
            problems += holder.todos
    try:
        chosen = breaking.parse_confirmed(env.get("CONFIRMED", ""))
    except ValueError as err:
        problems.append(str(err))
        chosen = None
    if chosen:
        by_id = {p["id"]: p for p in prs}
        picked = [by_id[i] for i in chosen if i in by_id]
        problems += [f"{i} is not a merged PR in the milestone" for i in chosen if i not in by_id]
        holder = Result(drafts.BREAKING_TASK, "")
        notices = drafts.draft_notices(picked, claude, holder)
        facts.breaking = [notices.get(p["id"]) or holder.todo(f"no notice drafted for {p['id']}") for p in picked]
        problems += holder.todos
    return facts


def build_drafts(version: Version, env: dict, gh, read_gh, claude, fetch) -> Result:
    problems = []
    entry, _ = changelog_entry(gh, version)
    if not entry:
        problems.append(f"no {version.short} entry in the changelog on master or in an open changelog PR")
    repos = [r.strip() for r in env.get("REPOS", SERVER_REPO).split(",") if r.strip()]
    prs = drafts.milestone_prs(read_gh, repos, env.get("MILESTONE") or Version(version.major, version.minor, 0).tag)
    events, problem = load_events(env, fetch)
    holder = Result(drafts.DRAFTS_TASK, version.tag)
    day = release_day_for(version, env, events, holder)
    epics = []
    if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
        problems.append("RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN are not set, so Jira epics were not read")
    else:
        fix_version = env.get("JIRA_FIX_VERSION") or (calendar.fix_version(version, day) if day else "")
        if not fix_version:
            problems.append(f"no Jira fix version for {version.short}: {problem or 'no Release Day on the calendar'}")
        else:
            epics = jira.epics(env.get("JIRA_URL") or jira.DEFAULT_URL, env["JIRA_EMAIL"], env["JIRA_TOKEN"], fix_version)
    facts = email_facts(version, env, gh, read_gh, claude, entry or "", day, prs, problems)
    result = drafts.blog_and_email(version, changelog.improvement_bullets(entry or ""), prs, epics, claude, problems,
                                   facts, env.get("ESR_VERSIONS", ""))
    result.notes = holder.notes + result.notes
    return result


def load_holidays(env: dict, client) -> tuple[schedule.Holidays | None, str | None]:
    """Holidays from the Release Processes Overview page, read with the Jira account."""
    if client is None:
        return None, "RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN are not set, so the holidays page can't be read"
    try:
        page = client.confluence_page(env.get("HOLIDAYS_PAGE_ID") or schedule.HOLIDAYS_PAGE_ID)
    except Exception as err:  # noqa: BLE001 - only the error type is public
        return None, f"the holidays page could not be read ({type(err).__name__})"
    holidays = schedule.parse_holidays(page)
    return (holidays, None) if holidays.years else (None, "the holidays page has no holiday lists")


def jira_versions(client) -> tuple[schedule.JiraVersions, str | None]:
    """Each month's server and mobile fix versions, or none (and why) when Jira can't be read."""
    if client is None:
        return schedule.JiraVersions(), "Jira was not read, so every version was worked out from the month before"
    try:
        return schedule.JiraVersions(client.versions()), None
    except Exception as err:  # noqa: BLE001 - only the error type is public
        return schedule.JiraVersions(), f"Jira's fix versions could not be read ({type(err).__name__}), so every version was worked out"


def due_release(task: str, events: list, today: date, holidays) -> tuple[Version | None, date | None]:
    """The release a scheduled run acts on today, and its Release Day, from the calendar."""
    for line, found in sorted(calendar.milestones(events or []).items()):
        if "release_day" not in found:
            continue
        version, day = Version(*line), found["release_day"].start
        if task == announcement.TASK and schedule.add_working_days(day, -1, holidays) <= today <= day:
            return version, day
        if task in (key_dates.TASK, marketing.TASK) and today == day:
            return version, day
        if task == feature_review.TASK and "feature_complete" in found and \
                schedule.add_working_days(found["feature_complete"].start, 1, holidays) <= today < day:
            return version, day
    return None, None


def report_in_hub(hub, channel_id: str, marker: str, message: str, live: bool) -> str:
    if hub is None or not channel_id:
        return "no Hub token or review channel, so nothing was reported in Hub"
    if hublib.find_post(hub, channel_id, marker):
        return "already reported in Hub"
    if not live:
        return "dry run: would have reported in Hub"
    hub.create_post(channel_id, message, {hublib.MARKER_PROP: marker})
    return "reported in Hub"


def mobile_hub_message(built: Result, target, base_files: dict) -> str:
    """The mobile ESR PR's exact changes, for a person to make when the bot can't open the PR."""
    changes = "".join("".join(difflib.unified_diff((base_files.get(p) or "").splitlines(True), text.splitlines(True),
                                                   f"a/{p}", f"b/{p}")) for p, text in built.files.items())
    todos = "".join(f"\n- {TODO_MARKER}: {t}" for t in built.todos)
    return (f"The mobile ESR PR could not be opened in {esr.MOBILE_REPO}: the changelog write app has no token there "
            f"(check that it is installed on {esr.MOBILE_REPO}). Please make these changes on a branch "
            f"`{target.branch}` from `{target.base}` and open a draft PR titled \"{built.title}\":\n\n"
            f"```diff\n{changes.rstrip()}\n```\n{todos}\n\nPR description:\n\n{built.body}")


def mobile_esr_pr(item, env: dict, gh, mobile_gh, hub, live: bool, result: Result) -> str:
    """The draft PR in mattermost-mobile making the new ESR the minimum server, as #9954 did.

    Written with ``mobile_gh`` (the changelog write app, limited to mattermost-mobile). In a
    live run without it, nothing is written there and the exact changes are posted in Hub."""
    if item.new is None:
        result.todo(f"CHANGELOG_ESR_VERSIONS lists no ESR after {item.old.short}, so no mobile ESR PR was opened")
        return "not opened"
    target = publish.locate(gh, esr.MOBILE_REPO, f"{item.new.tag}-before", esr.MOBILE_TASK)
    base_files = {p: gh.file(esr.MOBILE_REPO, p, target.ref) or "" for p in esr.MOBILE_FILES}
    built = esr.mobile_result(item, base_files, env.get("ESR_VERSIONS", ""))
    result.todos += [t for t in built.todos if t not in result.todos]
    result.notes += built.notes
    if live and mobile_gh is None and built.files and not target.blocked:
        result.todo(f"no changelog write app token for {esr.MOBILE_REPO}, so the mobile ESR PR was not opened; "
                    "its changes are posted in Hub")
        marker = f"release-docs:mobile-esr:{built.version}"
        posted = report_in_hub(hub, hublib.review_channel_id(env, live), marker,
                               mobile_hub_message(built, target, base_files), live)
        return f"not opened (no write token for {esr.MOBILE_REPO}); the changes were {posted}"
    return publish.apply(mobile_gh or gh, built, target, live)


def run_esr_comms(raw: str, env: dict, gh, hub, jira_client, holidays, today: date, live: bool,
                  mobile_gh=None) -> Result:
    result = Result(esr.TASK, raw)
    server_releases = gh.file(SERVER_REPO, release_docs_pr.SERVER_RELEASES, gh.default_branch(SERVER_REPO)) or ""
    all_esrs = esr.esrs(env.get("ESR_VERSIONS", ""), server_releases)
    if raw != SCHEDULED:
        line = Version.parse(raw)
        stage = (env.get("ESR_STAGE") or esr.ENDED).strip()
        jobs = [(e, stage) for e in all_esrs if e.old.line == line.line]
        if not jobs:
            result.todo(f"{line.short} is not a released ESR in CHANGELOG_ESR_VERSIONS and the server releases table")
    elif holidays is None:
        return result
    else:
        jobs = esr.due(today, all_esrs, lambda day: schedule.due_on(day, holidays))
        if not jobs:
            result.text = "Not due: no ESR goes out of support in three months or today."
            return result
    desktop = esr.desktop_versions(env.get("DESKTOP_ESR_VERSIONS", ""), result)
    lines, hub_lines = [], []
    for item, stage in jobs:
        label = f"{item.old.short} ESR, {'end of support' if stage == esr.ENDED else 'three months before'} ({long_date(item.end)})"
        target = publish.locate(gh, SERVER_REPO, f"{item.old.tag}-{stage}", esr.DOCS_TASK)
        docs = esr.docs_result(item, stage, {p: gh.file(SERVER_REPO, p, target.ref) or "" for p in esr.DOCS_FILES}, desktop)
        outcome = publish.apply(gh, docs, target, live) if docs.files else "no docs changes needed"
        lines.append(f"- {label}: docs PR: {outcome}")
        result.todos += [t for t in docs.todos if t not in result.todos]
        result.notes += docs.notes
        if stage == esr.BEFORE:
            lines.append(f"- {label}: mobile ESR PR: {mobile_esr_pr(item, env, gh, mobile_gh, hub, live, result)}")
        if not esr.tickets(item, stage):
            continue
        if jira_client is None:
            result.todo("RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN are not set, so no Jira tickets were created")
            continue
        made, found = [], []
        for summary, description in esr.tickets(item, stage):
            key = jira_client.find_by_summary(summary, esr.JIRA_LABEL)
            if key:
                found.append((key, summary))
            elif live:
                made.append((jira_client.create_issue(summary, description, [esr.JIRA_LABEL]), summary))
            else:
                made.append(("", summary))
        lines.append(f"- {label}: {len(made)} Jira ticket(s) {'created' if live else 'would be created'}, "
                     f"{len(found)} already there (keys are posted in Hub only)")
        hub_lines += [f"- {'Created' if live else 'Would create'} [{key}]({jira_client.browse_url(key)}): {summary}"
                      if key else f"- Would create: {summary}" for key, summary in made]
        hub_lines += [f"- Already there: [{key}]({jira_client.browse_url(key)}): {summary}" for key, summary in found]
    if hub_lines:
        message = "ESR comms: Jira tickets\n" + "\n".join(hub_lines)
        marker = f"release-docs:esr-comms:{raw}:{today}"
        lines.append(f"- Jira tickets: {report_in_hub(hub, hublib.review_channel_id(env, live, hublib.release_channel(hub, item.old) if hub else None), marker, message, live)}")
    result.text = "\n".join(lines)
    return result


def run_hub_task(task: str, raw: str, env: dict, gh, read_gh, claude, fetch) -> Run:
    live = env.get("MODE") == "live"
    now = now_utc(env)
    today = now.date()
    hub = hublib.from_env(env)
    jira_client = jira.from_env(env)
    holidays, holidays_problem = (None, None)
    if task != marketing.TASK:
        holidays, holidays_problem = load_holidays(env, jira_client)
    label = raw if raw != SCHEDULED else f"{today} (scheduled)"
    try:
        if task == esr.TASK:
            mobile_gh = GitHub(env.get("READ_TOKEN") or env.get("GITHUB_TOKEN", ""), write_token=env["MOBILE_WRITE_TOKEN"],
                               committer=getattr(gh, "committer", None)) if env.get("MOBILE_WRITE_TOKEN") else None
            result = run_esr_comms(raw, env, gh, hub, jira_client, holidays, today, live, mobile_gh)
            if holidays_problem and raw == SCHEDULED:
                result.todo(holidays_problem)
            return Run(result, "ESR comms." if result.text else "Nothing done.")

        events, problem = load_events(env, fetch)
        if raw != SCHEDULED:
            version = Version.parse(raw)
            day = release_day_for(version, env, events, Result(task, version.tag))
        elif holidays is None and task != marketing.TASK:
            result = Result(task, label)
            result.todo(holidays_problem or "no holidays")
            return Run(result, "Nothing done.")
        else:
            version, day = due_release(task, events, today, holidays)
            if version is None:
                if problem:
                    # An unreadable calendar is a failure, not a quiet day: the exact-day tasks don't retry.
                    result = Result(task, label)
                    result.todo(f"the Release Dates calendar could not be read: {problem}")
                    return Run(result, "Nothing done.")
                return Run(Result(task, label, skipped=f"nothing is due on {today}"), f"Not due on {today}.")
        if day is None and task != key_dates.TASK:
            result = Result(task, version.tag)
            result.todo(f"no Release Day for {version.short}: set the release_date input or the calendar URL")
            return Run(result, "Nothing done.")
        if hub is None and task in (announcement.TASK, marketing.TASK):
            result = Result(task, version.tag)
            result.todo("RELEASE_AGENT_MM_TOKEN is not set, so Hub can't be read or posted to")
            return Run(result, "Nothing posted.")

        if task == announcement.TASK:
            if holidays is None:
                result = Result(task, version.tag)
                result.todo(holidays_problem or "no holidays")
                return Run(result, "Nothing posted.")

            def render():
                holder = Result(posts.TASK, version.tag)
                highlights, entry = highlights_for(gh, version, claude, holder)
                text = posts.announcement(version, env.get("ESR_VERSIONS", ""), highlights,
                                          changelog.blog_url(entry or "", version), holder)
                return text, holder.todos

            result = announcement.run(version, day, render, hub, env, live, now, holidays, raw != SCHEDULED)
            return Run(result, "Announcements post.")

        if task == key_dates.TASK:
            if holidays is None:
                result = Result(task, version.tag)
                result.todo(f"{holidays_problem}: no key dates written")
                return Run(result, "Nothing written.")
            client, calendar_problem = gcal.from_env(env)
            versions, versions_problem = jira_versions(jira_client)
            month = (day.year, day.month) if day else schedule.release_month(version, versions)
            result = key_dates.run(version, month, holidays, client, hub, env, live, versions)
            for problem in (calendar_problem if client is None else None, versions_problem):
                if problem:
                    result.notes.append(problem)
            return Run(result, "Key dates on the Release Dates calendar.")

        if task == marketing.TASK:
            draft = build_drafts(version, env, gh, read_gh, claude, fetch)
            holder = Result(task, version.tag)
            highlights, _ = highlights_for(gh, version, claude, holder)
            esr_esr = env.get("ESR_VERSIONS", "")
            social = marketing.social_text(version, highlights, changelog_url(Version(version.major, version.minor, 0), esr_esr), holder)
            problems = []
            found = esr_section_for(day, env, gh, problems)
            forum = esr.forum_post(*found, holder) if found else ""
            result = marketing.run(version, long_date(day), draft.artifacts.get("email.md", ""), draft.todos + problems,
                                   social, forum, hub, env, live)
            result.todos = holder.todos + result.todos
            return Run(result, "Marketing hand-off.")

        if task == feature_review.TASK:
            if jira_client is None:
                result = Result(task, version.tag)
                result.todo("RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN are not set, so Jira epics were not read")
                return Run(result, "Nothing changed.")
            fix_version = env.get("JIRA_FIX_VERSION") or calendar.fix_version(version, day)
            epics = jira.epics(env.get("JIRA_URL") or jira.DEFAULT_URL, env["JIRA_EMAIL"], env["JIRA_TOKEN"], fix_version)
            client, calendar_problem = gcal.from_env(env)
            fc_event = calendar.milestones(events or []).get(version.line, {}).get("feature_complete")
            result = feature_review.run(version, epics, client, now, fc_event.start if fc_event else None, day, hub, live)
            if calendar_problem and client is None:
                result.notes.append(calendar_problem)
            return Run(result, "Feature Ready Review description.")
    except schedule.MissingHolidays as err:
        result = Result(task, label)
        result.todo(f"{err}: nothing done. Add the year's holidays to the Release Processes Overview page")
        return Run(result, "Nothing done.")
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
    for name, content in result.artifacts.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
            f.write(content)
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


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="release_docs")
    parser.add_argument("command", choices=("resolve", "run", "check"))
    parser.add_argument("task", choices=TASKS)
    args = parser.parse_args(argv)
    env = dict(os.environ)

    if args.command == "check":
        if args.task != dot_release.TASK:
            parser.error(f"check is only for {dot_release.TASK}")
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
    read_gh = gh
    run = run_task(args.task, env["VERSION"], env, gh, read_gh, Claude.from_env())
    return finish(run, env, hublib.from_env(env) if run.result.private else None)


def finish(run: Run, env: dict, hub) -> int:
    """Print and write the run's output; a private result goes to Hub and only its counts here."""
    result, mode = run.result, env.get("MODE", "dry_run")
    out_dir = env.get("OUTPUT_DIR") or "release-docs-output"
    if result.private:
        run_url = publish.run_url() if env.get("GITHUB_RUN_ID") else ""
        posted, delivered = report.deliver(result, env, hub, run_url)
        where = "the Hub post"
        if not env.get("GITHUB_ACTIONS"):
            # A local run: the full output also goes to OUTPUT_DIR/private/, so a dry run can be
            # checked without Hub. Never in Actions, where the artifact is public.
            private_dir = report.write_private(result, out_dir, run_url)
            delivered += f"; also written to {private_dir}"
            where = "the Hub post" if posted else f"{private_dir}/{report.REPORT_FILE}"
            posted = True  # the output isn't lost
        text = report.public_summary(result, run.outcome, mode, delivered)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "summary.md"), "w", encoding="utf-8") as f:
            f.write(text)
        with open(os.path.join(out_dir, "result.json"), "w", encoding="utf-8") as f:
            json.dump(report.public_record(result, delivered), f, indent=2)
        errors = [f"{len(result.todos)} missing input(s); they are listed in {where}"] if result.todos else []
        if not posted:
            errors.append(f"the full output was {delivered}")
    else:
        text = summary(result, run.outcome, mode, run.base_files, run.highlights)
        write_outputs(out_dir, result, text, run.base_files)
        errors = list(result.todos)
        posted = True
    print(text)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)
    for error in errors:
        print(f"::error title=Missing input::{error}")
    return 1 if result.failed or not posted else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
