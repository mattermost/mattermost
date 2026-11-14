"""The Announcements post text. The ``announcement`` task posts it in Hub for approval;
the ``posts`` task renders it for copy and paste.

Key dates now go on the Release Dates calendar (``key_dates``) and ESR comms are a section
of the monthly blog and email (``esr``).
"""

from . import templates
from .changelog import Highlight
from .result import Result
from .versions import Version, changelog_url, download_url, is_esr

TASK = "posts"


def announcement(version: Version, esr_versions: str, highlights: list[Highlight], blog: str, result: Result) -> str:
    if highlights:
        items = "\n".join(f"- [{h.name}]({h.url})" if h.url else f"- {h.name}" for h in highlights)
    else:
        items = result.todo("no highlights for the Announcements post")
    return templates.render("announcement-post.md", {
        "short": version.short,
        "esr_label": " Extended Support Release" if is_esr(version, esr_versions) else "",
        "highlight_list": items,
        "changelog_url": changelog_url(version, esr_versions),
        "blog_url": blog,
        "download_url": download_url(Version(version.major, version.minor, 0), "enterprise"),
    })


def build(version: Version, esr_versions: str, highlights: list[Highlight], blog: str) -> Result:
    result = Result(TASK, version.tag)
    text = announcement(version, esr_versions, highlights, blog, result)
    result.text = f"## Announcements post\n\n````markdown\n{text.strip()}\n````\n"
    return result
