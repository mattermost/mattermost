"""Post text for copy and paste: key dates, the Announcements post, and ESR comms."""

import re
from datetime import date

from . import calendar, templates
from .changelog import Highlight
from .result import Result
from .versions import (
    Version,
    changelog_url,
    download_url,
    esr_comms_dates,
    esr_lines,
    is_esr,
    long_date,
    support_end,
)

TASK = "posts"
RELEASE_ROW = re.compile(r"^\| v(\d+)\.(\d+) .*\| (\d{4}-\d{2}-\d{2}) \| (\d{4}-\d{2}-\d{2})\b")


def key_dates(version: Version, events: list | None, result: Result) -> str:
    if events is None:
        return templates.render("key-dates-post.md", {
            "releases": result.todo("RELEASE_AGENT_CALENDAR_ICS_URL is not set, so key dates can't be read")})
    upcoming = calendar.next_releases(events, version)
    blocks = []
    for release, milestones in upcoming:
        lines = [f"**Mattermost {release.short}**"]
        for key, title in calendar.MILESTONES:
            event = milestones.get(key)
            when = calendar.format_day(event) if event else result.todo(f"no {title} for {release.short} on the calendar")
            lines.append(f"- {title}: {when}")
        blocks.append("\n".join(lines))
    if len(upcoming) < 2:
        blocks.append(result.todo(f"the calendar has {len(upcoming)} release(s) after {version.short}, not two"))
    return templates.render("key-dates-post.md", {"releases": "\n\n".join(blocks)})


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


def published_support_ends(server_releases: str) -> dict:
    """``{(major, minor): (released, support ends)}`` from the server releases table."""
    found = {}
    for line in (server_releases or "").splitlines():
        match = RELEASE_ROW.match(line)
        if match:
            found[(int(match.group(1)), int(match.group(2)))] = (date.fromisoformat(match.group(3)),
                                                                 date.fromisoformat(match.group(4)))
    return found


def esr_comms(version: Version, esr_versions: str, server_releases: str, release_day: date | None, result: Result) -> str:
    """The emails for the ESR that the current one replaces: three months before it ends, and on the day."""
    lines = [line for line in esr_lines(esr_versions) if line.line <= version.line]
    if len(lines) < 2:
        return result.todo(f"CHANGELOG_ESR_VERSIONS needs the current ESR and the one before it, as of {version.short}")
    ending, current = lines[-2], lines[-1]
    table = published_support_ends(server_releases)
    if ending.line not in table:
        return result.todo(f"the server releases table has no support end for {ending.short}")
    end = table[ending.line][1]
    if current.line in table:
        current_end = table[current.line][1]
    elif current.line == version.line and release_day:
        current_end = support_end(release_day, True)
    else:
        current_end = None
    first, second = esr_comms_dates(end)
    return templates.render("esr-comms.md", {
        "ending": ending.short,
        "end_long": long_date(end),
        "first_send": first.isoformat(),
        "second_send": second.isoformat(),
        "current": current.short,
        "current_end_long": long_date(current_end) if current_end else result.todo(f"no support end for {current.short}"),
        "current_changelog_url": changelog_url(current, esr_versions),
    })


def build(version: Version, esr_versions: str, events: list | None, highlights: list[Highlight], blog: str,
          server_releases: str) -> Result:
    result = Result(TASK, version.tag)
    release_day = calendar.release_day(events, version) if events else None
    sections = [
        ("Key dates", key_dates(version, events, result)),
        ("Announcements post", announcement(version, esr_versions, highlights, blog, result)),
        ("ESR comms", esr_comms(version, esr_versions, server_releases, release_day, result)),
    ]
    result.text = "\n\n".join(f"## {title}\n\n````markdown\n{text.strip()}\n````" for title, text in sections) + "\n"
    return result
