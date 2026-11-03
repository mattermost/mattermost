"""The release's Jira versions and epics, read with the release agent's Jira credentials."""

import base64
import json
import urllib.parse
import urllib.request

DEFAULT_URL = "https://mattermost.atlassian.net"
PROJECT = "MM"


class Jira:
    def __init__(self, base_url: str, email: str, token: str, opener=urllib.request.urlopen):
        self.base_url = (base_url or DEFAULT_URL).rstrip("/")
        self.auth = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.opener = opener

    def _request(self, path: str, body: dict | None = None):
        request = urllib.request.Request(
            self.base_url + path, data=json.dumps(body).encode() if body is not None else None,
            method="POST" if body is not None else "GET",
            headers={"Authorization": f"Basic {self.auth}", "Content-Type": "application/json", "Accept": "application/json"})
        with self.opener(request, timeout=60) as response:
            return json.loads(response.read().decode())

    def versions(self, project: str = PROJECT) -> list[dict]:
        """Every version of the project: id, name, released, releaseDate (YYYY-MM-DD)."""
        return self._request(f"/rest/api/3/project/{urllib.parse.quote(project)}/versions") or []

    def search(self, jql: str, fields: list[str]) -> list[dict]:
        found, next_token = [], None
        while True:
            body = {"jql": jql, "fields": fields, "maxResults": 100, **({"nextPageToken": next_token} if next_token else {})}
            page = self._request("/rest/api/3/search/jql", body)
            found += page.get("issues", [])
            next_token = page.get("nextPageToken")
            if not next_token or page.get("isLast", True):
                return found

    def create_issue(self, summary: str, description: str, labels: list[str], issue_type: str = "Task",
                     project: str = PROJECT) -> str:
        """A new ticket, with a plain-text description; returns its key."""
        paragraphs = [{"type": "paragraph", "content": [{"type": "text", "text": line}]}
                      for line in description.split("\n") if line.strip()]
        created = self._request("/rest/api/3/issue", {"fields": {
            "project": {"key": project}, "issuetype": {"name": issue_type}, "summary": summary, "labels": labels,
            "description": {"type": "doc", "version": 1, "content": paragraphs}}})
        return created["key"]

    def find_by_summary(self, summary: str, label: str, project: str = PROJECT) -> str | None:
        """The key of a ticket with exactly this summary and label, if one exists."""
        for issue in self.search(f'project = {project} AND labels = "{label}" ORDER BY created DESC', ["summary"]):
            if issue["fields"].get("summary") == summary:
                return issue["key"]
        return None

    def confluence_page(self, page_id: str) -> str:
        """A Confluence page's storage-format body, on the same site and with the same account."""
        page = self._request(f"/wiki/api/v2/pages/{urllib.parse.quote(page_id)}?body-format=storage") or {}
        return ((page.get("body") or {}).get("storage") or {}).get("value") or ""

    def browse_url(self, key: str) -> str:
        return f"{self.base_url}/browse/{key}"

    def filter_url(self, jql: str) -> str:
        return f"{self.base_url}/issues/?" + urllib.parse.urlencode({"jql": jql})


def from_env(env: dict):
    """A client from RELEASE_AGENT_JIRA_EMAIL / RELEASE_AGENT_JIRA_TOKEN, or None."""
    if not (env.get("JIRA_EMAIL") and env.get("JIRA_TOKEN")):
        return None
    return Jira(env.get("JIRA_URL") or DEFAULT_URL, env["JIRA_EMAIL"], env["JIRA_TOKEN"])


def epics(base_url: str, email: str, token: str, fix_version: str, opener=urllib.request.urlopen) -> list[dict]:
    client = Jira(base_url, email, token, opener)
    jql = f'issuetype = Epic AND fixVersion = "{fix_version}" ORDER BY key'
    return [{"key": issue["key"], "summary": issue["fields"].get("summary", ""), "url": client.browse_url(issue["key"])}
            for issue in client.search(jql, ["summary"])]
