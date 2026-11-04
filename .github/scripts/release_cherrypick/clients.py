"""Standard-library clients for Jira, GitHub and Hub.

Errors name the service and HTTP status only: URLs and response bodies can carry private
details, and the Actions log of this public repo is public.
"""

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request


class ServiceError(Exception):
    def __init__(self, service: str, status: int | None):
        self.service, self.status = service, status
        super().__init__(f"{service} request failed" + (f" (HTTP {status})" if status else ""))


class TruncatedError(ServiceError):
    """A search with more results than could be read: what it found is not all there is."""

    def __init__(self, service: str, count: int):
        super().__init__(service, None)
        self.count = count
        self.args = (f"{service} results truncated at {count}, can't confirm",)


# GitHub search returns at most this many results, however many pages are asked for.
GITHUB_SEARCH_LIMIT = 1000
JIRA_SEARCH_LIMIT = 1000


class Http:
    def __init__(self, service: str, base_url: str, headers: dict, timeout: int = 30, retries: int = 2):
        self.service, self.base_url = service, base_url.rstrip("/")
        self.headers, self.timeout, self.retries = headers, timeout, retries

    def request(self, method: str, path: str, params: dict | None = None, body=None, retries: int | None = None):
        url = self.base_url + path
        if params:
            url += "?" + urllib.parse.urlencode(params, doseq=True)
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Accept": "application/json", **self.headers}
        if data is not None:
            headers["Content-Type"] = "application/json"
        retries = self.retries if retries is None else retries
        for attempt in range(retries + 1):
            req = urllib.request.Request(url, data=data, method=method, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    raw = response.read()
                    return json.loads(raw) if raw.strip() else None
            except urllib.error.HTTPError as err:
                if err.code >= 500 and attempt < retries:
                    time.sleep(2 ** attempt)
                    continue
                raise ServiceError(self.service, err.code) from None
            except (urllib.error.URLError, TimeoutError):
                if attempt < retries:
                    time.sleep(2 ** attempt)
                    continue
                raise ServiceError(self.service, None) from None
        raise AssertionError("unreachable")

    def get(self, path: str, /, **params):
        return self.request("GET", path, params or None)


class Jira:
    def __init__(self, base_url: str, email: str, token: str, http: Http | None = None):
        self.base_url = base_url.rstrip("/")
        auth = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.http = http or Http("Jira", self.base_url, {"Authorization": f"Basic {auth}"})

    def versions(self, project: str) -> list[dict]:
        return self.http.get(f"/rest/api/3/project/{urllib.parse.quote(project)}/versions") or []

    def search(self, jql: str, fields: list[str], limit: int = JIRA_SEARCH_LIMIT) -> list[dict]:
        """Every issue the JQL matches, following ``nextPageToken`` until ``isLast``; more than
        ``limit`` raises TruncatedError."""
        issues, token = [], None
        while True:
            body = {"jql": jql, "fields": fields, "maxResults": 100}
            if token:
                body["nextPageToken"] = token
            result = self.http.request("POST", "/rest/api/3/search/jql", body=body) or {}
            issues.extend(result.get("issues", []))
            token = result.get("nextPageToken")
            if not token or result.get("isLast", True):
                return issues
            if len(issues) >= limit:
                raise TruncatedError("Jira", len(issues))

    def issue(self, key: str, fields: list[str]) -> dict:
        return self.http.get(f"/rest/api/3/issue/{urllib.parse.quote(key)}", fields=",".join(fields))

    def remote_links(self, key: str) -> list[dict]:
        return self.http.get(f"/rest/api/3/issue/{urllib.parse.quote(key)}/remotelink") or []

    def browse_url(self, key: str) -> str:
        return f"{self.base_url}/browse/{key}"


class GitHub:
    """Reads with ``token`` (mattermost and enterprise) and writes with ``write_token`` (the
    workflow's GITHUB_TOKEN, which only reaches mattermost/mattermost)."""

    def __init__(self, token: str, write_token: str = "", http: Http | None = None, write_http: Http | None = None):
        self.http = http or self._http(token)
        self.write_http = write_http or (self._http(write_token) if write_token else self.http)

    @staticmethod
    def _http(token: str) -> Http:
        return Http("GitHub", "https://api.github.com", {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })

    def pull(self, repo: str, number: int) -> dict:
        return self.http.get(f"/repos/{repo}/pulls/{number}")

    def search_prs(self, query: str, limit: int = GITHUB_SEARCH_LIMIT) -> list[dict]:
        """Every result of the search, page by page; more than ``limit`` (GitHub returns 1,000
        at most), or results GitHub says are incomplete, raise TruncatedError."""
        items, page = [], 1
        while True:
            result = self.http.get("/search/issues", q=query, per_page=100, page=page) or {}
            batch = result.get("items", [])
            items.extend(batch)
            if result.get("incomplete_results"):
                raise TruncatedError("GitHub", len(items))
            total = result.get("total_count")
            if (len(batch) < 100) if total is None else (len(items) >= total):
                return items
            if len(items) >= limit or not batch:
                raise TruncatedError("GitHub", len(items))
            page += 1

    def milestones(self, repo: str) -> list[dict]:
        items, page = [], 1
        while True:
            batch = self.http.get(f"/repos/{repo}/milestones", state="all", per_page=100, page=page) or []
            items.extend(batch)
            if len(batch) < 100:
                return items
            page += 1

    def branch_exists(self, repo: str, branch: str) -> bool:
        try:
            self.http.get(f"/repos/{repo}/branches/{urllib.parse.quote(branch, safe='')}")
            return True
        except ServiceError as err:
            if err.status == 404:
                return False
            raise

    def is_public(self, repo: str) -> bool:
        try:
            return not (self.http.get(f"/repos/{repo}") or {}).get("private", True)
        except ServiceError:
            return False

    def add_label(self, repo: str, number: int, label: str) -> None:
        self.write_http.request("POST", f"/repos/{repo}/issues/{number}/labels", body={"labels": [label]})

    def set_milestone(self, repo: str, number: int, milestone_number: int) -> None:
        self.write_http.request("PATCH", f"/repos/{repo}/issues/{number}", body={"milestone": milestone_number})


class Hub:
    def __init__(self, base_url: str, token: str, http: Http | None = None):
        self.http = http or Http("Mattermost", base_url, {"Authorization": f"Bearer {token}"})
        self._me = None

    def me(self) -> dict:
        if self._me is None:
            self._me = self.http.get("/api/v4/users/me")
        return self._me

    def my_channels(self) -> list[dict]:
        return [c for c in self.http.get("/api/v4/users/me/channels") or [] if not c.get("delete_at")]

    def channel_posts(self, channel_id: str, page: int = 0, per_page: int = 200) -> list[dict]:
        result = self.http.get(f"/api/v4/channels/{channel_id}/posts", page=page, per_page=per_page) or {}
        posts = result.get("posts", {})
        return [posts[i] for i in result.get("order", []) if i in posts]

    def create_post(self, channel_id: str, message: str, root_id: str = "") -> dict:
        body = {"channel_id": channel_id, "message": message}
        if root_id:
            body["root_id"] = root_id
        # A lost response may still have created the post, so a retry could duplicate it.
        return self.http.request("POST", "/api/v4/posts", body=body, retries=0)
