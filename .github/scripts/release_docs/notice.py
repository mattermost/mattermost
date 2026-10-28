"""The in-product server upgrade notice in mattermost/notices (playbook T-0)."""

import json
import re
from datetime import date

from . import templates
from .changelog import Highlight, join_names
from .result import Result
from .versions import Version, changelog_page_url

TASK = "upgrade-notice"
REPO = "mattermost/notices"
PATH = "notices.json"
UPGRADING_URL = "https://docs.mattermost.com/upgrade/upgrading-mattermost-server.html"
ENTRY_ID = re.compile(r'"id"\s*:\s*"server_upgrade_v(\d+)\.(\d+)"')


def description(version: Version, highlights: list[Highlight], result: Result) -> str:
    if highlights:
        listed = join_names([f"[{h.name}]({h.url})" if h.url else h.name for h in highlights])
    else:
        listed = result.todo("no highlights for the notice")
    return (f"Mattermost {version.short} contains multiple new quality of life improvements, including {listed}. "
            f"[Upgrading]({UPGRADING_URL}) only takes a few minutes.")


def _object_bounds(text: str, id_offset: int) -> tuple[int, int]:
    """(start, end) of the notice whose ``"id"`` is at ``id_offset``; ``id`` is always its first key."""
    start = text.rfind("{", 0, id_offset)
    _, end = json.JSONDecoder().raw_decode(text, start)
    return start, end


def _indented(block: str, indent: str) -> str:
    lines = block.rstrip("\n").splitlines()
    return lines[0] + "".join(f"\n{indent}{line}" for line in lines[1:])


def update(notices: str, version: Version, display_day: date, highlights: list[Highlight], result: Result) -> str:
    """``notices`` with the latest ``server_upgrade_vX.Y`` notice rewritten for ``version``.

    Edited as text, keeping the file's own indentation, so the diff is only the changed values.
    """
    rendered = templates.render("notice.json", {
        "short": f"{version.major}.{version.minor}",
        "display_date": display_day.isoformat(),
        "description_json": json.dumps(description(version, highlights, result)),
        "changelog_page_url": changelog_page_url(version),
    })
    entries = [(Version(int(m.group(1)), int(m.group(2))), m) for m in ENTRY_ID.finditer(notices)]
    if not entries:
        result.todo(f"{PATH} has no server_upgrade_vX.Y notice to replace")
        return notices
    latest, match = max(entries, key=lambda pair: pair[0])
    if latest.line > version.line:
        result.skipped = f"{PATH} already has the notice for v{latest.major}.{latest.minor}"
        return notices
    start, end = _object_bounds(notices, match.start())
    line_start = notices.rfind("\n", 0, start) + 1
    indent = re.match(r"[ \t]*", notices[line_start:start]).group(0)
    updated = notices[:start] + _indented(rendered, indent) + notices[end:]
    json.loads(updated)
    return updated


def build(version: Version, notices: str, display_day: date, highlights: list[Highlight]) -> Result:
    result = Result(TASK, version.tag, repo=REPO)
    if version.is_dot:
        result.skipped = "dot releases get a patch notice, which needs the security severity a person decides"
        return result
    updated = update(notices, version, display_day, highlights, result)
    if updated != notices:
        result.files[PATH] = updated
    result.title = f"v{version.major}.{version.minor} server upgrade notice"
    result.body = (
        f"Replaces the server upgrade notice with Mattermost {version.short}, shown to system admins "
        f"of servers older than {version.major}.{version.minor} from {display_day.isoformat()}.\n\n"
        "The highlights are picked from the changelog's Improvements section; each one is listed with the "
        "bullet it came from in the run summary.\n\n"
        "Playbook (T-0): Open a PR to update the server upgrade in-product notice.\n"
    )
    return result
