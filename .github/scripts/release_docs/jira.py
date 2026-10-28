"""The release's Jira epics, read with the release agent's Jira credentials."""

import base64
import json
import urllib.request

DEFAULT_URL = "https://mattermost.atlassian.net"


def epics(base_url: str, email: str, token: str, fix_version: str, opener=urllib.request.urlopen) -> list[dict]:
    jql = f'issuetype = Epic AND fixVersion = "{fix_version}" ORDER BY key'
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    found, next_token = [], None
    while True:
        body = {"jql": jql, "fields": ["summary"], "maxResults": 100, **({"nextPageToken": next_token} if next_token else {})}
        request = urllib.request.Request(f"{base_url.rstrip('/')}/rest/api/3/search/jql", data=json.dumps(body).encode(),
                                         method="POST", headers={"Authorization": f"Basic {auth}",
                                                                 "Content-Type": "application/json",
                                                                 "Accept": "application/json"})
        with opener(request, timeout=60) as response:
            page = json.loads(response.read().decode())
        for issue in page.get("issues", []):
            found.append({"key": issue["key"], "summary": issue["fields"].get("summary", ""),
                          "url": f"{base_url.rstrip('/')}/browse/{issue['key']}"})
        next_token = page.get("nextPageToken")
        if not next_token or page.get("isLast", True):
            return found
