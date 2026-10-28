"""Opening and updating a task's draft PR: one branch per task, never a second PR, never a force-push."""

import os
from dataclasses import dataclass

from .result import LABEL, TODO_MARKER, Result, branch_name

TRAILER = "Release-Agent-Task"


@dataclass
class Target:
    """Where a task's files are read from, and what publishing would do."""
    repo: str
    branch: str
    base: str  # the repo's default branch
    ref: str  # the ref to read files at: the task branch if it exists, else the base
    sha: str  # that ref's head commit
    pr: dict | None = None
    blocked: str = ""  # why nothing may be written
    done: bool = False  # the PR was merged


def locate(gh, repo: str, version: str, task: str) -> Target:
    branch = branch_name(version, task)
    base = gh.default_branch(repo)
    pulls = gh.pulls_for_branch(repo, branch)
    merged = [p for p in pulls if p.get("merged_at")]
    open_prs = [p for p in pulls if p.get("state") == "open"]
    branch_sha = gh.branch_sha(repo, branch)
    target = Target(repo, branch, base, branch if branch_sha else base, branch_sha or gh.branch_sha(repo, base),
                    pr=(open_prs or merged or pulls or [None])[0])
    if merged:
        target.done, target.blocked = True, f"PR #{merged[0]['number']} was merged; the task is done"
    elif pulls and not open_prs:
        target.blocked = f"PR #{pulls[0]['number']} was closed without merging; not reopening or opening another"
    elif branch_sha:
        people = [c for c in gh.commits_ahead(repo, base, branch) if f"{TRAILER}:" not in c["commit"]["message"]]
        if people:
            names = sorted({c["commit"]["author"]["name"] for c in people})
            target.blocked = (f"{branch} has {len(people)} commit(s) from {', '.join(names)}; "
                              "left for them rather than committing over their work")
    return target


def run_url() -> str:
    server, repo, run = (os.environ.get(k, "") for k in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"))
    return f"{server}/{repo}/actions/runs/{run}" if server and repo and run else ""


def pr_body(result: Result) -> str:
    url = run_url()
    made_by = f"the [release docs workflow]({url})" if url else "the release docs workflow"
    return (result.body.rstrip() + "\n" + result.todo_section() +
            f"\n---\nOpened as a draft by {made_by} on branch `{result.branch}`. "
            "Edits are welcome: once anyone else commits here, the workflow stops updating this branch. "
            "The playbook item is done when this PR is merged.\n")


def commit_message(result: Result) -> str:
    return f"{result.title}\n\n{TRAILER}: {result.task}\n"


def apply(gh, result: Result, target: Target, live: bool) -> str:
    """Publish ``result`` (live) or describe what would happen (dry run). Returns that description."""
    pr = target.pr
    prefix = "" if live else "Dry run: would have "
    if target.blocked:
        return f"Nothing written: {target.blocked}."
    if not result.files:
        if pr:
            return f"PR #{pr['number']} is already up to date."
        return "Nothing to change."
    if any(TODO_MARKER in text for text in result.files.values()) and not result.todos:
        raise AssertionError("files carry a TODO marker that the result does not list")
    paths = ", ".join(f"`{p}`" for p in result.files)
    if not live:
        action = f"updated PR #{pr['number']}" if pr else f"opened a draft PR from `{target.branch}`"
        return f"{prefix}{action} in {target.repo}, changing {paths}."
    if target.ref != target.branch:
        gh.create_branch(target.repo, target.branch, target.sha)
    gh.commit_files(target.repo, target.branch, target.sha, result.files, commit_message(result))
    body = pr_body(result)
    if pr:
        gh.update_pr(target.repo, pr["number"], result.title, body)
        number = pr["number"]
        action = "Updated"
    else:
        created = gh.create_pr(target.repo, target.branch, target.base, result.title, body)
        number = created["number"]
        action = "Opened draft"
    gh.add_labels(target.repo, number, [LABEL])
    return f"{action} PR {target.repo}#{number}, changing {paths}."
