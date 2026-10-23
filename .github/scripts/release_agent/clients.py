"""Thin clients for the services the agent reads and writes.

Errors name the service and HTTP status only: URLs, response bodies and repo names can
carry private details, and the Actions log of this public repo is public.
"""

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request


class ServiceError(Exception):
    def __init__(self, service: str, status: int | None, detail: str = ""):
        self.service, self.status, self.detail = service, status, detail
        super().__init__(f"{service} request failed" + (f" (HTTP {status})" if status else ""))


class Http:
    def __init__(self, service: str, base_url: str, headers: dict, timeout: int = 30, retries: int = 2):
        self.service, self.base_url = service, base_url.rstrip("/")
        self.headers, self.timeout, self.retries = headers, timeout, retries

    def request(self, method: str, path: str, params: dict | None = None, body=None) -> tuple[dict, object]:
        url = path if path.startswith("http") else self.base_url + path
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params, doseq=True)
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Accept": "application/json", **self.headers}
        if data is not None:
            headers["Content-Type"] = "application/json"
        for attempt in range(self.retries + 1):
            req = urllib.request.Request(url, data=data, method=method, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    raw = response.read()
                    return dict(response.headers), (json.loads(raw) if raw.strip() else None)
            except urllib.error.HTTPError as err:
                if err.code >= 500 and attempt < self.retries:
                    time.sleep(2 ** attempt)
                    continue
                raise ServiceError(self.service, err.code, err.read().decode(errors="replace")[:500]) from None
            except (urllib.error.URLError, TimeoutError) as err:
                if attempt < self.retries:
                    time.sleep(2 ** attempt)
                    continue
                raise ServiceError(self.service, None, str(err)) from None
        raise AssertionError("unreachable")

    def get(self, path: str, **params):
        return self.request("GET", path, params or None)[1]


def fetch_text(url: str, service: str, timeout: int = 30) -> str:
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=timeout) as response:
            return response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        raise ServiceError(service, err.code) from None
    except (urllib.error.URLError, TimeoutError):
        raise ServiceError(service, None) from None


class GitHub:
    def __init__(self, token: str, http: Http | None = None):
        self.http = http or Http("GitHub", "https://api.github.com", {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })

    def search_issues(self, query: str, limit: int = 1000, sort: str | None = None) -> list[dict]:
        items, page = [], 1
        while len(items) < limit:
            params = {"q": query, "per_page": 100, "page": page}
            if sort:
                params.update(sort=sort, order="desc")
            batch = self.http.get("/search/issues", **params).get("items", [])
            items.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return items[:limit]

    def pull(self, repo: str, number: int) -> dict:
        return self.http.get(f"/repos/{repo}/pulls/{number}")

    def commits(self, repo: str, sha: str, since: str | None = None, path: str | None = None,
                limit: int = 1000) -> list[dict]:
        items, page = [], 1
        while len(items) < limit:
            params = {"sha": sha, "per_page": 100, "page": page}
            if since:
                params["since"] = since
            if path:
                params["path"] = path
            batch = self.http.get(f"/repos/{repo}/commits", **params)
            items.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return items[:limit]

    def commit_date(self, repo: str, ref: str) -> str:
        return self.http.get(f"/repos/{repo}/commits/{urllib.parse.quote(ref, safe='')}")["commit"]["committer"]["date"]

    def is_on_branch(self, repo: str, sha: str, branch: str) -> bool:
        """Whether ``sha`` is an ancestor of (or is) the tip of ``branch``."""
        result = self.http.get(f"/repos/{repo}/compare/{sha}...{urllib.parse.quote(branch, safe='')}")
        return result.get("status") in ("ahead", "identical")

    def tags_with_prefix(self, repo: str, prefix: str) -> list[str]:
        refs = self.http.get(f"/repos/{repo}/git/matching-refs/tags/{urllib.parse.quote(prefix, safe='')}") or []
        return [ref["ref"].removeprefix("refs/tags/") for ref in refs]


class Jira:
    FIELDS = ["summary", "status", "assignee", "labels", "fixVersions"]

    def __init__(self, base_url: str, email: str, token: str, http: Http | None = None):
        self.base_url = base_url.rstrip("/")
        auth = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.http = http or Http("Jira", self.base_url, {"Authorization": f"Basic {auth}"})

    def search(self, jql: str, limit: int = 1000) -> list[dict]:
        issues, token = [], None
        while len(issues) < limit:
            body = {"jql": jql, "fields": self.FIELDS, "maxResults": 100}
            if token:
                body["nextPageToken"] = token
            result = self.http.request("POST", "/rest/api/3/search/jql", body=body)[1] or {}
            issues.extend(result.get("issues", []))
            token = result.get("nextPageToken")
            if not token or result.get("isLast", True):
                break
        return issues[:limit]

    def browse_url(self, key: str) -> str:
        return f"{self.base_url}/browse/{key}"

    def filter_url(self, jql: str) -> str:
        return f"{self.base_url}/issues/?" + urllib.parse.urlencode({"jql": jql})


class Mattermost:
    def __init__(self, base_url: str, token: str, http: Http | None = None):
        self.base_url = base_url.rstrip("/")
        self.http = http or Http("Mattermost", self.base_url, {"Authorization": f"Bearer {token}"})
        self._me = None

    def me(self) -> dict:
        if self._me is None:
            self._me = self.http.get("/api/v4/users/me")
        return self._me

    def server_version(self) -> tuple[str, str]:
        """(version, build hash) of the server, e.g. ("12.2.0", "a1b2c3...")."""
        headers, _ = self.http.request("GET", "/api/v4/system/ping")
        version_id = next((v for k, v in headers.items() if k.lower() == "x-version-id"), "")
        config = self.http.get("/api/v4/config/client", format="old") or {}
        version = config.get("Version") or ".".join(version_id.split(".")[:3])
        return version, config.get("BuildHash", "")

    def channel_posts(self, channel_id: str, page: int = 0, per_page: int = 200) -> list[dict]:
        result = self.http.get(f"/api/v4/channels/{channel_id}/posts", page=page, per_page=per_page) or {}
        posts = result.get("posts", {})
        return [posts[i] for i in result.get("order", []) if i in posts]

    def posts_since(self, channel_id: str, since_ms: int) -> list[dict]:
        result = self.http.get(f"/api/v4/channels/{channel_id}/posts", since=since_ms) or {}
        return list((result.get("posts") or {}).values())

    def create_post(self, channel_id: str, message: str, props: dict | None = None, root_id: str = "") -> dict:
        body = {"channel_id": channel_id, "message": message, "props": props or {}}
        if root_id:
            body["root_id"] = root_id
        return self.http.request("POST", "/api/v4/posts", body=body)[1]

    def patch_post(self, post_id: str, message: str, props: dict) -> dict:
        return self.http.request("PUT", f"/api/v4/posts/{post_id}/patch", body={"message": message, "props": props})[1]

    def permalink(self, team_name: str, post_id: str) -> str:
        return f"{self.base_url}/{team_name}/pl/{post_id}"


class Playbooks:
    """The Playbooks plugin REST API (server/api/playbook_runs.go in mattermost-plugin-playbooks)."""

    PREFIX = "/plugins/playbooks/api/v0"

    def __init__(self, mattermost: Mattermost):
        self.http = mattermost.http

    def in_progress_runs(self, search_term: str, playbook_id: str = "") -> list[dict]:
        runs, page = [], 0
        while True:
            params = {"statuses": "InProgress", "search_term": search_term, "page": page, "per_page": 100}
            if playbook_id:
                params["playbook_id"] = playbook_id
            result = self.http.get(f"{self.PREFIX}/runs", **params) or {}
            runs.extend(result.get("items") or [])
            if not result.get("has_more"):
                return runs
            page += 1

    def run(self, run_id: str) -> dict:
        return self.http.get(f"{self.PREFIX}/runs/{run_id}")

    def close_item(self, run_id: str, checklist: int, item: int) -> None:
        self.http.request("PUT", f"{self.PREFIX}/runs/{run_id}/checklists/{checklist}/item/{item}/state",
                          body={"new_state": "closed"})
