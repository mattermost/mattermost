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

    def browse_url(self, key: str) -> str:
        return f"{self.base_url}/browse/{key}"

    def filter_url(self, jql: str) -> str:
        return f"{self.base_url}/issues/?" + urllib.parse.urlencode({"jql": jql})


def epics(base_url: str, email: str, token: str, fix_version: str, opener=urllib.request.urlopen) -> list[dict]:
    client = Jira(base_url, email, token, opener)
    jql = f'issuetype = Epic AND fixVersion = "{fix_version}" ORDER BY key'
    return [{"key": issue["key"], "summary": issue["fields"].get("summary", ""), "url": client.browse_url(issue["key"])}
            for issue in client.search(jql, ["summary"])]
