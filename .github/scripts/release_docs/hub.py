"""Hub (Mattermost) and Playbooks, with the release agent's bot token (RELEASE_AGENT_MM_TOKEN).

Every post carries a hidden marker in its props, so a rerun finds the bot's own post and
never posts twice. Errors name the service and HTTP status only: the Actions log of this
public repo is public, and Hub content stays in Hub.
"""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_URL = "https://hub.mattermost.com"
MARKER_PROP = "release_docs_marker"
PLAYBOOKS = "/plugins/playbooks/api/v0"
NO_MANAGER_NOTE = ("_No release manager is known: the release playbook run has no owner, so nobody is mentioned. "
                   "Please set the run's owner._")
APPROVE_EMOJI = "white_check_mark"
MAX_PAGES = 10
PER_PAGE = 200
# "Release: v12.2", and ESRs' own names, as the release agent finds the release channel.
RELEASE_CHANNEL_NAMES = ("Release: {short}", "Release: {short} (ESR)", "Release: {short} ESR")


class HubError(Exception):
    def __init__(self, status: int | None):
        self.status = status
        super().__init__("Hub request failed" + (f" (HTTP {status})" if status else ""))


class Hub:
    def __init__(self, base_url: str, token: str, opener=urllib.request.urlopen):
        self.base_url = (base_url or DEFAULT_URL).rstrip("/")
        self.token = token
        self.opener = opener
        self._me = None

    def _request(self, method: str, path: str, params: dict | None = None, body=None, raw: bytes | None = None):
        url = self.base_url + path + (("?" + urllib.parse.urlencode(params)) if params else "")
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        content_type = "application/octet-stream" if raw is not None else "application/json"
        request = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {self.token}",
                                                                                 "Content-Type": content_type,
                                                                                 "Accept": "application/json"})
        for attempt in range(3):
            try:
                with self.opener(request, timeout=60) as response:
                    raw = response.read()
                    return json.loads(raw) if raw.strip() else None
            except urllib.error.HTTPError as err:
                if err.code >= 500 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise HubError(err.code) from None
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise HubError(None) from None
        raise AssertionError("unreachable")

    # users and channels
    def me(self) -> dict:
        if self._me is None:
            self._me = self._request("GET", "/api/v4/users/me")
        return self._me

    def user(self, user_id: str) -> dict:
        return self._request("GET", f"/api/v4/users/{urllib.parse.quote(user_id)}")

    def user_by_username(self, username: str) -> dict | None:
        try:
            return self._request("GET", f"/api/v4/users/username/{urllib.parse.quote(username)}")
        except HubError as err:
            if err.status == 404:
                return None
            raise

    def channel(self, channel_id: str) -> dict:
        return self._request("GET", f"/api/v4/channels/{urllib.parse.quote(channel_id)}")

    def my_channels(self) -> list[dict]:
        return self._request("GET", "/api/v4/users/me/channels") or []

    # posts
    def channel_posts(self, channel_id: str, page: int) -> list[dict]:
        result = self._request("GET", f"/api/v4/channels/{channel_id}/posts", {"page": page, "per_page": PER_PAGE}) or {}
        posts = result.get("posts") or {}
        return [posts[i] for i in result.get("order", []) if i in posts]

    def thread(self, post_id: str) -> list[dict]:
        result = self._request("GET", f"/api/v4/posts/{post_id}/thread") or {}
        posts = result.get("posts") or {}
        return [posts[i] for i in result.get("order", []) if i in posts]

    def post(self, post_id: str) -> dict:
        return self._request("GET", f"/api/v4/posts/{post_id}")

    def reactions(self, post_id: str) -> list[dict]:
        return self._request("GET", f"/api/v4/posts/{post_id}/reactions") or []

    def create_post(self, channel_id: str, message: str, props: dict, root_id: str = "", file_ids=()) -> dict:
        body = {"channel_id": channel_id, "message": message, "props": props}
        if root_id:
            body["root_id"] = root_id
        if file_ids:
            body["file_ids"] = list(file_ids)
        return self._request("POST", "/api/v4/posts", body=body)

    def upload_file(self, channel_id: str, name: str, content: bytes) -> str:
        """A file for a post in ``channel_id`` (the raw-body form of POST /api/v4/files); its id."""
        result = self._request("POST", "/api/v4/files", {"channel_id": channel_id, "filename": name}, raw=content)
        return result["file_infos"][0]["id"]

    def schedule_post(self, channel_id: str, message: str, props: dict, at_ms: int) -> dict:
        return self._request("POST", "/api/v4/posts/schedule",
                             body={"channel_id": channel_id, "message": message, "props": props, "scheduled_at": at_ms})

    def scheduled_posts(self, team_id: str) -> list[dict]:
        result = self._request("GET", f"/api/v4/posts/scheduled/team/{team_id}") or {}
        return [post for posts in result.values() for post in posts or []]

    # playbooks
    def runs_in_channel(self, channel_id: str) -> list[dict]:
        result = self._request("GET", f"{PLAYBOOKS}/runs", {"channel_id": channel_id, "statuses": "InProgress",
                                                            "per_page": 100}) or {}
        return result.get("items") or []

    def close_item(self, run_id: str, checklist: int, item: int) -> None:
        self._request("PUT", f"{PLAYBOOKS}/runs/{run_id}/checklists/{checklist}/item/{item}/state",
                      body={"new_state": "closed"})


# ── Helpers shared by the Hub tasks ─────────────────────────────────────────────────

def marker_of(post: dict) -> str:
    return (post.get("props") or {}).get(MARKER_PROP) or ""


def find_post(hub, channel_id: str, marker: str) -> dict | None:
    """The bot's own post in ``channel_id`` carrying ``marker``, newest pages first."""
    bot = hub.me()["id"]
    for page in range(MAX_PAGES):
        posts = hub.channel_posts(channel_id, page)
        for post in posts:
            if post.get("user_id") == bot and marker_of(post) == marker and not post.get("delete_at"):
                return post
        if len(posts) < PER_PAGE:
            return None
    return None


def find_reply(hub, root_id: str, marker: str) -> dict | None:
    bot = hub.me()["id"]
    return next((p for p in hub.thread(root_id) if p.get("id") != root_id and p.get("user_id") == bot
                 and marker_of(p) == marker), None)


def release_channel(hub, version) -> dict | None:
    """The release channel the bot is in, by display name, as the release agent finds it."""
    names = {" ".join(n.format(short=version.short).split()).casefold() for n in RELEASE_CHANNEL_NAMES}
    found = [c for c in hub.my_channels() if not c.get("delete_at")
             and " ".join((c.get("display_name") or "").split()).casefold() in names]
    return found[0] if len(found) == 1 else None


def release_run(hub, channel: dict | None) -> dict | None:
    if not channel:
        return None
    runs = hub.runs_in_channel(channel["id"])
    return runs[0] if len(runs) == 1 else None


def review_channel_id(env: dict, live: bool, release_channel: dict | None = None) -> str:
    """The channel for Hub reports: RELEASE_DOCS_REVIEW_CHANNEL_ID when set. Otherwise, in a dry run, the
    test channel (RELEASE_AGENT_TEST_CHANNEL_ID), never the release channel; in a live run, the release
    channel, if there is one."""
    if env.get("REVIEW_CHANNEL_ID"):
        return env["REVIEW_CHANNEL_ID"]
    if not live:
        return env.get("TEST_CHANNEL_ID", "")
    return (release_channel or {}).get("id", "")


NO_REVIEW_CHANNEL = ("no review channel (RELEASE_DOCS_REVIEW_CHANNEL_ID; for a dry run, RELEASE_AGENT_TEST_CHANNEL_ID; "
                     "for a live run, a release channel the bot is in)")


def release_manager(hub, run: dict | None) -> dict | None:
    """The playbook run's owner, or None: there is no one to fall back on."""
    if run and run.get("owner_user_id"):
        try:
            return hub.user(run["owner_user_id"])
        except HubError:
            pass
    return None


def normalize_item(title: str) -> str:
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", title or "").replace("`", "").replace("**", "")
    return " ".join(text.split()).rstrip(".…").casefold()


def find_item(run: dict, titles: list[str]) -> tuple[int, int, dict] | None:
    """The run's checklist item whose title is one of ``titles``, or starts with one ending in "…"."""
    for wanted in titles:
        prefix = wanted.endswith("…")
        key = normalize_item(wanted)
        for c_index, checklist in enumerate(run.get("checklists") or []):
            for i_index, item in enumerate(checklist.get("items") or []):
                title = normalize_item(item.get("title"))
                if title == key or (prefix and title.startswith(key)):
                    return c_index, i_index, item
    return None


def tick(hub, run: dict | None, titles: list[str], live: bool) -> str:
    """Close the playbook item, only while nobody has touched it. Returns what happened."""
    if not run:
        return "no single in-progress playbook run in the release channel, so no item was ticked"
    found = find_item(run, titles)
    if not found:
        return f'the playbook run has no "{titles[0]}" item'
    c_index, i_index, item = found
    if item.get("state") == "closed":
        return f'"{item.get("title")}" was already ticked'
    if item.get("state") or item.get("state_modified"):
        return f'"{item.get("title")}" was changed by a person, so it was left alone'
    if not live:
        return f'dry run: would have ticked "{item.get("title")}"'
    try:
        hub.close_item(run["id"], c_index, i_index)
    except HubError as err:
        # A bot that isn't a participant of the run gets HTTP 403; the posts already made must not be lost to a crash.
        return f'could not tick "{item.get("title")}": {err}; the Hub bot must be a participant of the playbook run'
    return f'ticked "{item.get("title")}"'


def mention(user: dict | None) -> str:
    """``@username``, or nothing when there is no one to mention."""
    return f"@{user['username']}" if user else ""


def addressed(user: dict | None, message: str, note: str = NO_MANAGER_NOTE) -> str:
    """``message`` for ``user``. With no one to mention, nobody is, and ``note`` asks for an owner."""
    return f"{mention(user)} {message}" if user else f"{message}\n\n{note}"


def from_env(env: dict):
    """A Hub client from RELEASE_AGENT_MM_TOKEN (and RELEASE_AGENT_MM_URL), or None."""
    token = (env.get("MM_TOKEN") or "").strip()
    return Hub(env.get("MM_URL") or DEFAULT_URL, token) if token else None
