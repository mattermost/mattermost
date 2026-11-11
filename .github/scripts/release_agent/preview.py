"""--no-post: read everything for real, write nothing.

The Hub and Playbooks clients are wrapped so that every write (the status post, its edits,
would-be asks, reminders, proof replies and ticks) is recorded instead of sent, and
written to OUT_DIR/preview.md. Reads go to the real services. Community is read only
already, and the agent never writes to GitHub, Jira or Confluence.
"""

from datetime import datetime, timezone


class Preview:
    def __init__(self):
        self.writes = []  # (kind, where, text)

    def markdown(self) -> str:
        if not self.writes:
            return "# Preview\n\nNothing would be written.\n"
        lines = ["# Preview", "", f"{len(self.writes)} write(s) that a run without --no-post would make.", ""]
        for number, (kind, where, text) in enumerate(self.writes, 1):
            lines += [f"## {number}. {kind}", "", where, "", "````markdown", text, "````", ""]
        return "\n".join(lines)


class PreviewHub:
    """Hub for --no-post: reads go to Hub, writes to the preview. Only GET requests reach Hub."""

    def __init__(self, hub, preview: Preview):
        self._hub, self._preview, self._next = hub, preview, 0

    def __getattr__(self, name):
        return getattr(self._hub, name)

    def search_users(self, term: str) -> list[dict]:
        # Hub's user search is a POST; the autocomplete endpoint answers the same name lookup with a GET.
        found = self._hub.http.get("/api/v4/users/autocomplete", name=term, limit=100) or {}
        return [user for user in found.get("users") or [] if not user.get("delete_at")]

    def create_post(self, channel_id: str, message: str, props: dict | None = None, root_id: str = "") -> dict:
        self._next += 1
        where = f"Channel `{channel_id}`" + (f", in the thread of `{root_id}`" if root_id else "")
        self._preview.writes.append(("Reply" if root_id else "Post", where, message))
        return {"id": f"preview-{self._next}", "channel_id": channel_id, "message": message, "props": props or {},
                "root_id": root_id, "user_id": self._hub.me()["id"],
                "create_at": int(datetime.now(timezone.utc).timestamp() * 1000), "delete_at": 0}

    def patch_post(self, post_id: str, message: str, props: dict) -> dict:
        self._preview.writes.append(("Edit", f"Post `{post_id}`", message))
        return {"id": post_id, "message": message, "props": props}


class PreviewPlaybooks:
    """Playbooks for --no-post: runs are read; a tick is recorded instead of closing the item."""

    def __init__(self, playbooks, preview: Preview):
        self._playbooks, self._preview = playbooks, preview

    def __getattr__(self, name):
        return getattr(self._playbooks, name)

    def close_item(self, run_id: str, checklist: int, item: int) -> None:
        self._preview.writes.append(("Tick", f"Run `{run_id}`, checklist {checklist}, item {item}", "(closed)"))
