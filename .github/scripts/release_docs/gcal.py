"""Google Calendar, with a service account added to the Release Dates calendar.

The key is the RELEASE_DOCS_GOOGLE_SA_KEY secret (the JSON key file); the calendar is
RELEASE_DATES_CALENDAR_ID. Every write passes ``sendUpdates=none``, so nobody is emailed.
"""

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

API = "https://www.googleapis.com/calendar/v3"
SCOPE = "https://www.googleapis.com/auth/calendar.events"
TOKEN_URL = "https://oauth2.googleapis.com/token"


class CalendarError(Exception):
    def __init__(self, status: int | None):
        self.status = status
        super().__init__("Google Calendar request failed" + (f" (HTTP {status})" if status else ""))


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def service_account_assertion(key: dict, now: int) -> str:
    """A signed JWT for the OAuth token exchange (RS256, needs ``cryptography``)."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    header = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = _b64(json.dumps({"iss": key["client_email"], "scope": SCOPE, "aud": TOKEN_URL,
                              "iat": now, "exp": now + 3600}).encode())
    private_key = serialization.load_pem_private_key(key["private_key"].encode(), password=None)
    signature = private_key.sign(f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{header}.{claims}.{_b64(signature)}"


class GoogleCalendar:
    def __init__(self, calendar_id: str, token: str, opener=urllib.request.urlopen):
        self.calendar_id, self.token, self.opener = calendar_id, token, opener

    @classmethod
    def from_key(cls, calendar_id: str, key_json: str, opener=urllib.request.urlopen) -> "GoogleCalendar":
        key = json.loads(key_json)
        body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                       "assertion": service_account_assertion(key, int(time.time()))}).encode()
        request = urllib.request.Request(TOKEN_URL, data=body, method="POST",
                                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with opener(request, timeout=60) as response:
                token = json.loads(response.read().decode())["access_token"]
        except urllib.error.HTTPError as err:
            raise CalendarError(err.code) from None
        return cls(calendar_id, token, opener)

    def _request(self, method: str, path: str, params: dict | None = None, body: dict | None = None):
        url = f"{API}/calendars/{urllib.parse.quote(self.calendar_id)}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method,
                                         headers={"Authorization": f"Bearer {self.token}",
                                                  "Content-Type": "application/json"})
        try:
            with self.opener(request, timeout=60) as response:
                raw = response.read()
                return json.loads(raw) if raw.strip() else None
        except urllib.error.HTTPError as err:
            raise CalendarError(err.code) from None

    def _pages(self, path: str, params: dict) -> list[dict]:
        items, token = [], None
        while True:
            page = self._request("GET", path, {**params, **({"pageToken": token} if token else {})}) or {}
            items += page.get("items") or []
            token = page.get("nextPageToken")
            if not token:
                return items

    def events(self, start: date, end: date, query: str = "", single: bool = True) -> list[dict]:
        """Events between ``start`` and ``end`` (inclusive days); recurring ones expanded when ``single``."""
        params = {"timeMin": f"{start.isoformat()}T00:00:00Z", "timeMax": f"{(end + timedelta(days=1)).isoformat()}T00:00:00Z",
                  "singleEvents": "true" if single else "false", "maxResults": 250}
        if query:
            params["q"] = query
        return self._pages("/events", params)

    def instances(self, event_id: str, start: date) -> list[dict]:
        return self._pages(f"/events/{urllib.parse.quote(event_id)}/instances",
                           {"timeMin": f"{start.isoformat()}T00:00:00Z", "maxResults": 10})

    def create_all_day(self, title: str, day: date) -> dict:
        """An all-day event shown as free, with no attendees and no notifications."""
        return self._request("POST", "/events", {"sendUpdates": "none"}, {
            "summary": title,
            "start": {"date": day.isoformat()},
            "end": {"date": (day + timedelta(days=1)).isoformat()},
            "transparency": "transparent",
            "reminders": {"useDefault": False, "overrides": []},
        })

    def set_description(self, event_id: str, description: str) -> dict:
        """``events.patch`` of the description only, telling nobody."""
        return self._request("PATCH", f"/events/{urllib.parse.quote(event_id)}", {"sendUpdates": "none"},
                             {"description": description})


def from_env(env: dict):
    """A calendar client, or (None, why not)."""
    calendar_id = (env.get("CALENDAR_ID") or "").strip()
    key = (env.get("GOOGLE_SA_KEY") or "").strip()
    if not calendar_id or not key:
        return None, "RELEASE_DOCS_GOOGLE_SA_KEY / RELEASE_DATES_CALENDAR_ID are not set"
    try:
        return GoogleCalendar.from_key(calendar_id, key), None
    except (CalendarError, ValueError, KeyError) as err:
        return None, f"could not sign in to Google Calendar: {type(err).__name__}" + (
            f" ({err})" if isinstance(err, CalendarError) else "")
