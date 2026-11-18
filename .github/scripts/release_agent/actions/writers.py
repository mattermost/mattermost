"""Clients that write: delivery-platform workflow dispatches, GitHub milestones, Jira versions and
issues, and Google Sheets. Each is only built in release-actions.yml, from a token that can do
just its own job. Dry runs never call their write methods (the tests check this).
"""

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from ..clients import Http, ServiceError


class GitHubWriter:
    """Writes with an app installation token. For delivery-platform the token has Actions: write
    only; for milestones, Issues: write on mattermost and enterprise only."""

    def __init__(self, token: str, http: Http | None = None):
        self.http = http or Http("GitHub", "https://api.github.com", {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })

    def dispatch(self, repo: str, workflow: str, ref: str, inputs: dict) -> dict:
        """Start a workflow_dispatch run. Never retried: a lost response may still have started it.
        Returns GitHub's run details when it gives them ({} otherwise)."""
        body = {"ref": ref, "inputs": {k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in inputs.items()},
                "return_run_details": True}
        _, result = self.http.request("POST", f"/repos/{repo}/actions/workflows/{urllib.parse.quote(workflow)}/dispatches",
                                      body=body, retries=0)
        return result or {}

    def workflow_runs(self, repo: str, workflow: str, created_since: str) -> list[dict]:
        result = self.http.get(f"/repos/{repo}/actions/workflows/{urllib.parse.quote(workflow)}/runs",
                               event="workflow_dispatch", created=f">={created_since}", per_page=50) or {}
        return result.get("workflow_runs") or []

    def workflow_run(self, repo: str, run_id: int) -> dict:
        return self.http.get(f"/repos/{repo}/actions/runs/{run_id}")

    def create_milestone(self, repo: str, title: str, due_on: str = "") -> dict:
        body = {"title": title}
        if due_on:
            body["due_on"] = f"{due_on}T08:00:00Z"
        return self.http.request("POST", f"/repos/{repo}/milestones", body=body, retries=0)[1]


class JiraWriter:
    """Jira with the write account (RELEASE_AGENT_JIRA_WRITE_*): versions and issues only."""

    def __init__(self, base_url: str, email: str, token: str, http: Http | None = None):
        self.base_url = base_url.rstrip("/")
        auth = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.http = http or Http("Jira", self.base_url, {"Authorization": f"Basic {auth}"})

    def project_id(self, project: str) -> str:
        return str(self.http.get(f"/rest/api/3/project/{urllib.parse.quote(project)}")["id"])

    def create_version(self, project_id: str, name: str, release_date: str = "") -> dict:
        body = {"name": name, "projectId": int(project_id)}
        if release_date:
            body["releaseDate"] = release_date
        return self.http.request("POST", "/rest/api/3/version", body=body, retries=0)[1]

    def release_version(self, version_id: str, release_date: str) -> dict:
        return self.http.request("PUT", f"/rest/api/3/version/{urllib.parse.quote(str(version_id))}",
                                 body={"released": True, "releaseDate": release_date})[1]

    def create_issue(self, fields: dict) -> dict:
        return self.http.request("POST", "/rest/api/3/issue", body={"fields": fields}, retries=0)[1]

    def update_issue(self, key: str, fields: dict) -> None:
        self.http.request("PUT", f"/rest/api/3/issue/{urllib.parse.quote(key)}", body={"fields": fields})


SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"


class Sheets:
    """Google Sheets API v4 with a service account key (RELEASE_DOCS_GOOGLE_SA_KEY)."""

    def __init__(self, key_json: str, http: Http | None = None):
        self.key = json.loads(key_json) if key_json else {}
        self._http, self._expires = http, 0

    @property
    def http(self) -> Http:
        if self._http is None or (self._expires and time.time() > self._expires - 60):
            self._http = Http("Google Sheets", "https://sheets.googleapis.com/v4",
                              {"Authorization": f"Bearer {self._access_token()}"})
        return self._http

    def _access_token(self) -> str:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        def b64(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

        now = int(time.time())
        token_uri = self.key.get("token_uri") or "https://oauth2.googleapis.com/token"
        claims = {"iss": self.key["client_email"], "scope": SHEETS_SCOPE, "aud": token_uri, "iat": now, "exp": now + 3600}
        unsigned = f"{b64(json.dumps({'alg': 'RS256', 'typ': 'JWT'}).encode())}.{b64(json.dumps(claims).encode())}"
        private_key = serialization.load_pem_private_key(self.key["private_key"].encode(), password=None)
        signature = private_key.sign(unsigned.encode(), padding.PKCS1v15(), hashes.SHA256())
        data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                       "assertion": f"{unsigned}.{b64(signature)}"}).encode()
        try:
            with urllib.request.urlopen(urllib.request.Request(token_uri, data=data, method="POST"), timeout=30) as response:
                body = json.loads(response.read())
        except urllib.error.HTTPError as err:
            raise ServiceError("Google auth", err.code) from None
        except (urllib.error.URLError, TimeoutError):
            raise ServiceError("Google auth", None) from None
        self._expires = now + int(body.get("expires_in", 3600))
        return body["access_token"]

    def tabs(self, sheet_id: str) -> list[dict]:
        """[{title, sheetId, index}], in tab order."""
        result = self.http.get(f"/spreadsheets/{sheet_id}", fields="sheets.properties") or {}
        tabs = [s["properties"] for s in result.get("sheets", [])]
        return sorted(({"title": t["title"], "sheetId": t["sheetId"], "index": t.get("index", 0)} for t in tabs),
                      key=lambda t: t["index"])

    def values(self, sheet_id: str, a1: str) -> list[list]:
        result = self.http.get(f"/spreadsheets/{sheet_id}/values/{urllib.parse.quote(a1, safe='')}",
                               valueRenderOption="FORMULA") or {}
        return result.get("values") or []

    def update(self, sheet_id: str, a1: str, rows: list[list]) -> None:
        # RAW: a ticket summary that starts with "=" stays text, never a formula.
        self.http.request("PUT", f"/spreadsheets/{sheet_id}/values/{urllib.parse.quote(a1, safe='')}?valueInputOption=RAW",
                          body={"range": a1, "values": rows})

    def append(self, sheet_id: str, a1: str, rows: list[list]) -> None:
        self.http.request("POST", f"/spreadsheets/{sheet_id}/values/{urllib.parse.quote(a1, safe='')}:append"
                                  "?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
                          body={"values": rows}, retries=0)

    def clear(self, sheet_id: str, a1: str) -> None:
        self.http.request("POST", f"/spreadsheets/{sheet_id}/values/{urllib.parse.quote(a1, safe='')}:clear", body={})

    def batch_update(self, sheet_id: str, requests: list[dict]) -> dict:
        return self.http.request("POST", f"/spreadsheets/{sheet_id}:batchUpdate", body={"requests": requests},
                                 retries=0)[1] or {}


def tab_url(sheet_id: str, gid: int, a1: str = "") -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={gid}" + (f"&range={a1}" if a1 else "")
