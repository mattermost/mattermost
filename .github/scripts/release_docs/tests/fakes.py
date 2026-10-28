"""In-memory stand-ins for GitHub, the release file server, and Claude."""

import itertools
import json
import os

from release_docs.github import GitHubError

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def fixture(name: str) -> str:
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return f.read()


class FakeGitHub:
    """Repos are branches of commits; each commit holds a full snapshot of its files.

    ``writes`` records every call that would change GitHub, so a dry run can be shown to
    make none.
    """

    def __init__(self):
        self.repos = {}
        self.pulls = {}
        self.releases = {}
        self.latest = {}
        self.search_results = {}
        self.writes = []
        self._shas = (f"sha{n}" for n in itertools.count(1))

    # setup helpers
    def add_repo(self, repo: str, files: dict, default: str = "master") -> None:
        self.repos[repo] = {"default": default, "branches": {default: [self._commit("initial", "Someone", files)]}}
        self.pulls.setdefault(repo, [])

    def _commit(self, message: str, author: str, files: dict) -> dict:
        return {"sha": next(self._shas), "commit": {"message": message, "author": {"name": author}}, "files": dict(files)}

    def push(self, repo: str, branch: str, files: dict, message: str = "edit", author: str = "A Person") -> None:
        commits = self.repos[repo]["branches"][branch]
        commits.append(self._commit(message, author, {**commits[-1]["files"], **files}))

    def head_files(self, repo: str, branch: str) -> dict:
        return self.repos[repo]["branches"][branch][-1]["files"]

    # the GitHub interface
    def default_branch(self, repo):
        return self.repos[repo]["default"]

    def branch_sha(self, repo, branch):
        commits = self.repos.get(repo, {}).get("branches", {}).get(branch)
        return commits[-1]["sha"] if commits else None

    def file(self, repo, path, ref):
        commits = self.repos.get(repo, {}).get("branches", {}).get(ref)
        return commits[-1]["files"].get(path) if commits else None

    def commits_ahead(self, repo, base, head):
        base_shas = {c["sha"] for c in self.repos[repo]["branches"][base]}
        return [c for c in self.repos[repo]["branches"][head] if c["sha"] not in base_shas]

    def create_branch(self, repo, branch, sha):
        self.writes.append(("create_branch", repo, branch))
        for commits in self.repos[repo]["branches"].values():
            for i, commit in enumerate(commits):
                if commit["sha"] == sha:
                    self.repos[repo]["branches"][branch] = commits[:i + 1]
                    return
        raise GitHubError(422, "unknown sha")

    def commit_files(self, repo, branch, parent, files, message):
        self.writes.append(("commit_files", repo, branch, dict(files)))
        commits = self.repos[repo]["branches"][branch]
        if commits[-1]["sha"] != parent:
            raise GitHubError(422, "Update is not a fast forward")
        commits.append(self._commit(message, "release-docs[bot]", {**commits[-1]["files"], **files}))
        return commits[-1]["sha"]

    def pulls_for_branch(self, repo, branch):
        return [p for p in self.pulls.get(repo, []) if p["head"] == branch]

    def create_pr(self, repo, head, base, title, body):
        self.writes.append(("create_pr", repo, head))
        pr = {"number": 100 + sum(len(p) for p in self.pulls.values()), "head": head, "base": base, "title": title,
              "body": body, "draft": True, "state": "open", "merged_at": None, "labels": []}
        self.pulls[repo].append(pr)
        return pr

    def update_pr(self, repo, number, title, body):
        self.writes.append(("update_pr", repo, number))
        pr = next(p for p in self.pulls[repo] if p["number"] == number)
        pr.update(title=title, body=body)

    def add_labels(self, repo, number, labels):
        self.writes.append(("add_labels", repo, number, tuple(labels)))
        pr = next(p for p in self.pulls[repo] if p["number"] == number)
        pr["labels"] = sorted(set(pr["labels"]) | set(labels))

    def search_issues(self, query, limit=1000):
        return [item for key, items in self.search_results.items() if key in query for item in items]

    def release_by_tag(self, repo, tag):
        return self.releases.get((repo, tag))

    def latest_release(self, repo):
        tag = self.latest.get(repo)
        return self.releases.get((repo, tag)) if tag else None

    def update_release_body(self, repo, release_id, body):
        self.writes.append(("update_release_body", repo, release_id))
        for release in self.releases.values():
            if release["id"] == release_id:
                release["body"] = body


def release_server(sha256: dict, missing: tuple = ()):
    """A ``fetch`` for releases.mattermost.com and GitHub release assets.

    ``sha256`` maps tarball file names to hashes; URLs containing any of ``missing`` 404.
    """
    def fetch(url, method="GET"):
        if any(part in url for part in missing):
            return 404, ""
        name = url.rsplit("/", 1)[-1]
        if name.endswith(".sha256"):
            tarball = name[:-len(".sha256")]
            return (200, f"{sha256[tarball]}  {tarball}\n") if tarball in sha256 else (404, "")
        return 200, ""
    return fetch


class FakeClaude:
    def __init__(self, answer):
        self.answer = answer
        self.prompts = []

    def ask_json(self, system, prompt, max_tokens=4000):
        self.prompts.append(prompt)
        if isinstance(self.answer, Exception):
            raise self.answer
        return json.loads(json.dumps(self.answer))
