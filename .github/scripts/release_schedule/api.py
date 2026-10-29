"""JSON over HTTPS with urllib, retrying rate limits and server errors."""

import json
import time
import urllib.error
import urllib.request

RETRY_STATUSES = {429, 500, 502, 503, 504}
# Google Calendar reports rate limits as 403s with one of these reasons.
RATE_LIMIT_REASONS = ("rateLimitExceeded", "userRateLimitExceeded")


class APIError(RuntimeError):
    def __init__(self, method: str, url: str, status: int, body: str):
        super().__init__(f"{method} {url.split('?')[0]} returned {status}: {body[:300]}")
        self.status = status


def request(method: str, url: str, token: str, body=None, attempts: int = 5, sleep=time.sleep):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    for attempt in range(attempts):
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = response.read()
                return json.loads(payload) if payload else None
        except urllib.error.HTTPError as exc:
            text = exc.read().decode(errors="replace")
            retry = exc.code in RETRY_STATUSES or (exc.code == 403 and any(r in text for r in RATE_LIMIT_REASONS))
            if retry and attempt + 1 < attempts:
                sleep(2 ** (attempt + 2))
                continue
            raise APIError(method, url, exc.code, text) from None
