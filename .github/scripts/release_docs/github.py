"""The GitHub REST calls the tasks need, over urllib."""

import base64
import json
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"GitHub API {status}: {message}")
        self.status = status


class GitHub:
    def __init__(self, token: str, api: str = API, opener=urllib.request.urlopen,
                 write_token: str = "", committer: dict | None = None):
        """``token`` makes every read. Anything that is not a GET uses ``write_token`` (default: ``token``),
        and commits are authored by ``committer`` ({"name", "email"}) when given."""
        self.token = token
        self.write_token = write_token or token
        self.committer = committer
        self.api = api.rstrip("/")
        self.opener = opener

    def request(self, method: str, path: str, body=None, missing_ok: bool = False):
        url = path if path.startswith("http") else f"{self.api}{path}"
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url, data=data, method=method, headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self.token if method == 'GET' else self.write_token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mattermost-release-docs",
            **({"Content-Type": "application/json"} if data else {}),
        })
        try:
            with self.opener(request, timeout=60) as response:
                text = response.read().decode()
                return json.loads(text) if text else None
        except urllib.error.HTTPError as err:
            if missing_ok and err.code == 404:
                return None
            raise GitHubError(err.code, err.read().decode(errors="replace")[:500]) from err

    # ── Repository content ──────────────────────────────────────────────────────────

    def default_branch(self, repo: str) -> str:
        return self.request("GET", f"/repos/{repo}")["default_branch"]

    def branch_sha(self, repo: str, branch: str) -> str | None:
        ref = self.request("GET", f"/repos/{repo}/git/ref/heads/{urllib.parse.quote(branch)}", missing_ok=True)
        return ref["object"]["sha"] if ref else None

    def file(self, repo: str, path: str, ref: str) -> str | None:
        found = self.request("GET", f"/repos/{repo}/contents/{urllib.parse.quote(path)}?ref={urllib.parse.quote(ref)}",
                             missing_ok=True)
        if not found or isinstance(found, list):
            return None
        if found.get("encoding") == "base64" and found.get("content") is not None:
            return base64.b64decode(found["content"]).decode()
        blob = self.request("GET", found["git_url"])
        return base64.b64decode(blob["content"]).decode()

    def list_dir(self, repo: str, path: str, ref: str) -> list[str]:
        """File names in a directory at ``ref`` (the contents API lists up to 1,000)."""
        found = self.request("GET", f"/repos/{repo}/contents/{urllib.parse.quote(path)}?ref={urllib.parse.quote(ref)}",
                             missing_ok=True)
        return [item["name"] for item in found] if isinstance(found, list) else []

    def last_commit_for_path(self, repo: str, path: str, ref: str) -> str | None:
        found = self.request("GET", f"/repos/{repo}/commits?" + urllib.parse.urlencode({"path": path, "sha": ref, "per_page": 1}))
        return found[0]["sha"] if found else None

    def matching_refs(self, repo: str, prefix: str) -> list[str]:
        """Full ref names starting with ``prefix``, such as ``tags/v12.`` or ``heads/release-``."""
        refs = self.request("GET", f"/repos/{repo}/git/matching-refs/{urllib.parse.quote(prefix)}") or []
        return [ref["ref"] for ref in refs]

    def commits_ahead(self, repo: str, base: str, head: str) -> list[dict]:
        compare = self.request("GET", f"/repos/{repo}/compare/{urllib.parse.quote(base)}...{urllib.parse.quote(head)}")
        return compare.get("commits", [])

    def tag_sha(self, repo: str, tag: str) -> str | None:
        """The commit a tag points at, or None if there is no such tag."""
        ref = self.request("GET", f"/repos/{repo}/git/ref/tags/{urllib.parse.quote(tag)}", missing_ok=True)
        if not ref:
            return None
        target = ref["object"]
        while target["type"] == "tag":
            target = self.request("GET", target["url"])["object"]
        return target["sha"]

    def commit(self, repo: str, sha: str) -> dict:
        """One commit with its message, committer date and changed file names (``files``)."""
        found = self.request("GET", f"/repos/{repo}/commits/{urllib.parse.quote(sha)}")
        files, page = list(found.get("files") or []), 2
        while len(found.get("files") or []) == 300:  # the API pages a commit's files 300 at a time
            found = self.request("GET", f"/repos/{repo}/commits/{urllib.parse.quote(sha)}?page={page}")
            files += found.get("files") or []
            page += 1
        return {"sha": found["sha"], "message": found["commit"]["message"],
                "date": found["commit"]["committer"]["date"], "parents": [p["sha"] for p in found.get("parents", [])],
                "files": [f["filename"] for f in files]}

    def commits_between(self, repo: str, base: str, head: str) -> list[dict]:
        """The commits reachable from ``head`` but not ``base``, oldest first."""
        commits, page = [], 1
        while True:
            found = self.request("GET", f"/repos/{repo}/compare/{urllib.parse.quote(base)}...{urllib.parse.quote(head)}"
                                        f"?per_page=100&page={page}")
            batch = found.get("commits", [])
            commits += batch
            if len(batch) < 100:
                return commits
            page += 1

    def pull(self, repo: str, number: int) -> dict | None:
        return self.request("GET", f"/repos/{repo}/pulls/{number}", missing_ok=True)

    def commit_pulls(self, repo: str, sha: str) -> list[dict]:
        return self.request("GET", f"/repos/{repo}/commits/{sha}/pulls") or []

    def branches_with_prefix(self, repo: str, prefix: str) -> list[str]:
        refs = self.request("GET", f"/repos/{repo}/git/matching-refs/heads/{urllib.parse.quote(prefix)}") or []
        return [ref["ref"].removeprefix("refs/heads/") for ref in refs]

    def create_branch(self, repo: str, branch: str, sha: str) -> None:
        self.request("POST", f"/repos/{repo}/git/refs", {"ref": f"refs/heads/{branch}", "sha": sha})

    def commit_files(self, repo: str, branch: str, parent: str, files: dict, message: str) -> str:
        """One commit on top of ``parent`` with ``files`` (path -> text). The ref only moves forward."""
        base_tree = self.request("GET", f"/repos/{repo}/git/commits/{parent}")["tree"]["sha"]
        tree = self.request("POST", f"/repos/{repo}/git/trees", {
            "base_tree": base_tree,
            "tree": [{"path": path, "mode": "100644", "type": "blob", "content": text} for path, text in files.items()],
        })
        commit = self.request("POST", f"/repos/{repo}/git/commits",
                              {"message": message, "tree": tree["sha"], "parents": [parent],
                               **({"author": self.committer, "committer": self.committer} if self.committer else {})})
        self.request("PATCH", f"/repos/{repo}/git/refs/heads/{urllib.parse.quote(branch)}",
                     {"sha": commit["sha"], "force": False})
        return commit["sha"]

    # ── Pull requests and labels ────────────────────────────────────────────────────

    def pulls_for_branch(self, repo: str, branch: str) -> list[dict]:
        owner = repo.split("/")[0]
        query = urllib.parse.urlencode({"head": f"{owner}:{branch}", "state": "all", "per_page": 100})
        return self.request("GET", f"/repos/{repo}/pulls?{query}") or []

    def create_pr(self, repo: str, head: str, base: str, title: str, body: str) -> dict:
        return self.request("POST", f"/repos/{repo}/pulls",
                            {"head": head, "base": base, "title": title, "body": body, "draft": True})

    def update_pr(self, repo: str, number: int, title: str, body: str) -> None:
        self.request("PATCH", f"/repos/{repo}/pulls/{number}", {"title": title, "body": body})

    def add_labels(self, repo: str, number: int, labels: list[str]) -> None:
        self.request("POST", f"/repos/{repo}/issues/{number}/labels", {"labels": labels})

    def label_exists(self, repo: str, label: str) -> bool:
        return self.request("GET", f"/repos/{repo}/labels/{urllib.parse.quote(label)}", missing_ok=True) is not None

    def remove_label(self, repo: str, number: int, label: str) -> None:
        self.request("DELETE", f"/repos/{repo}/issues/{number}/labels/{urllib.parse.quote(label)}", missing_ok=True)

    def search_issues(self, query: str, limit: int = 1000) -> list[dict]:
        items, page = [], 1
        while len(items) < limit:
            params = urllib.parse.urlencode({"q": query, "per_page": 100, "page": page})
            found = self.request("GET", f"/search/issues?{params}")
            batch = found.get("items", [])
            items += batch
            if len(batch) < 100:
                break
            page += 1
        return items[:limit]

    # ── Releases ────────────────────────────────────────────────────────────────────

    def release_by_tag(self, repo: str, tag: str) -> dict | None:
        return self.request("GET", f"/repos/{repo}/releases/tags/{urllib.parse.quote(tag)}", missing_ok=True)

    def latest_release(self, repo: str) -> dict | None:
        return self.request("GET", f"/repos/{repo}/releases/latest", missing_ok=True)

    def recent_releases(self, repo: str, count: int = 30) -> list[dict]:
        """The newest releases, including pre-releases, newest first."""
        return self.request("GET", f"/repos/{repo}/releases?per_page={count}") or []

    def update_release_body(self, repo: str, release_id: int, body: str) -> None:
        self.request("PATCH", f"/repos/{repo}/releases/{release_id}", {"body": body})
