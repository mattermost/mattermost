"""Plain HTTP reads of published release files."""

import urllib.error
import urllib.request


def fetch(url: str, method: str = "GET") -> tuple[int, str]:
    """(status, body). Errors come back as a status, never raised; a network failure is 0."""
    request = urllib.request.Request(url, method=method, headers={"User-Agent": "mattermost-release-docs"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8", "replace") if method == "GET" else ""
            return response.status, body
    except urllib.error.HTTPError as err:
        return err.code, ""
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, ""
