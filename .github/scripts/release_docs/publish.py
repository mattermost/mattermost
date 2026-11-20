"""Opening and updating a task's draft PR: one branch per task, never a second PR, never a force-push."""

import os
import re
from dataclasses import dataclass

from .github import GitHubError
from .result import LABEL as OPTIONAL_LABEL, TODO_MARKER, Result, branch_name

TRAILER = "Release-Agent-Task"
REVIEWERS_SETTING = "RELEASE_DOCS_REVIEWERS"
LOGIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
TEAM = re.compile(r"^([A-Za-z0-9][A-Za-z0-9-]*)/([A-Za-z0-9][A-Za-z0-9_.-]*)$")
# Hidden markers another workflow writes into a PR body (mattermost/release-automation's
# confirmed breaking changes and security fixes, see markers.py): kept whenever this workflow
# rewrites the body, so its own edits never change one.
KEPT_MARKER = re.compile(r"<!--\s*release-automation:.*?-->", re.DOTALL)


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
    ahead: int = 0  # commits on the task branch that the base doesn't have (all the workflow's when not blocked)


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
        ahead = gh.commits_ahead(repo, base, branch)
        target.ahead = len(ahead)
        people = [c for c in ahead if f"{TRAILER}:" not in c["commit"]["message"]]
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


def parse_reviewers(raw: str, owner: str) -> tuple[list[str], list[str], list[str]]:
    """(logins, team slugs, problems) from RELEASE_DOCS_REVIEWERS: comma-separated GitHub logins
    and ``org/team`` teams, with or without ``@``. A team must be in the repo owner's org."""
    users, teams, problems = [], [], []
    for item in (part.strip().lstrip("@") for part in (raw or "").split(",")):
        if not item:
            continue
        team = TEAM.match(item)
        if team and team.group(1).lower() == owner.lower():
            teams.append(team.group(2))
        elif team:
            problems.append(f"{REVIEWERS_SETTING}: {item} is not a team in {owner}, so it can't review here")
        elif LOGIN.match(item):
            users.append(item)
        else:
            problems.append(f"{REVIEWERS_SETTING}: {item!r} is neither a GitHub login nor an org/team")
    return list(dict.fromkeys(users)), list(dict.fromkeys(teams)), problems


def request_reviewers(gh, repo: str, number: int, raw: str) -> str:
    """Ask RELEASE_DOCS_REVIEWERS to review a new PR. Returns a note for the outcome ("" when unset)."""
    users, teams, problems = parse_reviewers(raw, repo.split("/")[0])
    asked = users + [f"{repo.split('/')[0]}/{t}" for t in teams]
    note = "".join(f" {p}." for p in problems)
    if not asked:
        return note
    try:
        gh.request_reviewers(repo, number, users, teams)
    except GitHubError as err:
        return f"{note} Review not requested from {', '.join(asked)}: GitHub answered {err.status}."
    except TimeoutError:
        # The request was sent but no answer came: GitHub may or may not have asked them.
        return f"{note} Review request to {', '.join(asked)}: outcome unknown, GitHub did not answer in time."
    except OSError as err:  # URLError and other transport errors: the request never reached GitHub
        return f"{note} Review not requested from {', '.join(asked)}: GitHub could not be reached ({type(err).__name__})."
    return f"{note} Review requested from {', '.join(asked)}."


def kept_markers(old_body: str | None, new_body: str) -> str:
    """``new_body`` with the hidden markers of ``old_body`` that it doesn't already have."""
    missing = [m for m in KEPT_MARKER.findall(old_body or "") if m not in new_body]
    return new_body.rstrip() + "\n\n" + "\n".join(missing) + "\n" if missing else new_body


def apply(gh, result: Result, target: Target, live: bool, reviewers: str = "") -> str:
    """Publish ``result`` (live) or describe what would happen (dry run). Returns that description."""
    pr = target.pr
    prefix = "" if live else "Dry run: would have "
    if target.blocked:
        return f"Nothing written: {target.blocked}."
    if not result.files:
        if pr:
            return f"PR #{pr['number']} is already up to date."
        if target.ref != target.branch or not target.ahead:
            return "Nothing to change."
        # The branch has only this workflow's commits and no PR (an earlier run stopped between the
        # commit and the PR): open the PR for what is already there, with no new commit.
        if not live:
            return f"{prefix}opened a draft PR from `{target.branch}` in {target.repo}, with the commits already on it."
        action, number, skipped, review = write(gh, target, {}, "", result.title, pr_body(result), [], reviewers=reviewers)
        return (f"{action} PR {target.repo}#{number} for the commits already on `{target.branch}`."
                f"{skipped_label_note(skipped, target.repo)}{review}")
    if any(TODO_MARKER in text for text in result.files.values()) and not result.todos:
        raise AssertionError("files carry a TODO marker that the result does not list")
    paths = ", ".join(f"`{p}`" for p in result.files)
    if not live:
        action = f"updated PR #{pr['number']}" if pr else f"opened a draft PR from `{target.branch}`"
        return f"{prefix}{action} in {target.repo}, changing {paths}."
    action, number, skipped, review = write(gh, target, result.files, commit_message(result), result.title,
                                            pr_body(result), [], reviewers=reviewers)
    return f"{action} PR {target.repo}#{number}, changing {paths}.{skipped_label_note(skipped, target.repo)}{review}"


def skipped_label_note(skipped: list[str], repo: str) -> str:
    return (f" Label {', '.join(f'`{l}`' for l in skipped)} not added: it does not exist in {repo} "
            "(the workflow never creates it).") if skipped else ""


def current_body(gh, target: Target) -> str | None:
    """The open PR's description as it is now, not as ``locate`` read it: release-automation may
    have changed a marker since."""
    fresh = next((p for p in gh.pulls_for_branch(target.repo, target.branch) if p["number"] == target.pr["number"]), None)
    return (fresh or target.pr).get("body")


def write(gh, target: Target, files: dict, message: str, title: str, body: str, labels: list[str],
          optional_labels: tuple[str, ...] = (OPTIONAL_LABEL,), reviewers: str = "") -> tuple[str, int, list[str], str]:
    """Commit ``files`` on top of ``target.sha`` (creating the branch if needed; no commit when
    there are none), then open or update the draft PR and add ``labels``, plus each of
    ``optional_labels`` that already exists in the repo (never created; the ones skipped are
    returned). The ref only ever moves forward. A PR this opens asks ``reviewers``
    (RELEASE_DOCS_REVIEWERS) for review; the last value returned says how that went. An updated
    PR keeps the hidden markers its body has just before the update."""
    if files:
        if target.ref != target.branch:
            gh.create_branch(target.repo, target.branch, target.sha)
        gh.commit_files(target.repo, target.branch, target.sha, files, message)
    review = ""
    if target.pr:
        # Re-read just before the PATCH, so a marker written since locate() is kept. A change in the
        # moment between this read and the PATCH could still be lost, but release-automation
        # rewrites a missing or changed marker every hour, so that race heals itself.
        gh.update_pr(target.repo, target.pr["number"], title, kept_markers(current_body(gh, target), body))
        number, action = target.pr["number"], "Updated"
    else:
        number, action = gh.create_pr(target.repo, target.branch, target.base, title, body)["number"], "Opened draft"
        review = request_reviewers(gh, target.repo, number, reviewers)
    present = [l for l in optional_labels if gh.label_exists(target.repo, l)]
    gh.add_labels(target.repo, number, [*labels, *present])
    return action, number, [l for l in optional_labels if l not in present], review
