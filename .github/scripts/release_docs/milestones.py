"""Release Days from the ``vX.Y.0`` milestones' due dates, read with the public GitHub API.

The server's are in mattermost/mattermost; the Desktop App's and the mobile app's in their own
repos (mattermost/desktop, mattermost/mattermost-mobile). A milestone with no due date, or no
milestone, gives no Release Day: the caller writes a TODO marker, never a guess.
"""

import re
from datetime import date

from .versions import Version

SERVER_REPO = "mattermost/mattermost"
DESKTOP_REPO = "mattermost/desktop"
MOBILE_REPO = "mattermost/mattermost-mobile"
REPOS = {"Server": SERVER_REPO, "Desktop": DESKTOP_REPO, "Mobile": MOBILE_REPO}
TITLE = re.compile(r"^v(\d+)\.(\d+)\.0$")


def release_days(gh, repo: str) -> dict:
    """``{(major, minor): Release Day}`` for every ``vX.Y.0`` milestone of ``repo`` with a due date."""
    found = {}
    for milestone in gh.milestones(repo):
        match = TITLE.match((milestone.get("title") or "").strip())
        due = milestone.get("due_on") or ""
        if match and due:
            # GitHub keeps a due date as a time on that day (midnight, or a US time zone's offset);
            # the day is the date part.
            found[(int(match.group(1)), int(match.group(2)))] = date.fromisoformat(due[:10])
    return found


def missing(version: Version, repo: str = SERVER_REPO) -> str:
    """The TODO text for a release with no Release Day."""
    return f"no due date on the {Version(version.major, version.minor, 0).tag} milestone in {repo}, so no Release Day"
