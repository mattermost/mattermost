"""The calculated parts of the release docs PR (playbook T-16).

Server releases table, the Release Lifecycle chart on the release policy page (this release,
the next two, versions past their support end marked unsupported, and the next ESR), the
latest server, desktop and mobile releases' end dates when the next release is late,
ESR/PostgreSQL rows, Desktop compatibility and the deploy pages' version strings. Every
Release Day is the due date of the release's ``vX.Y.0`` milestone (milestones.py); a
milestone with no due date is a TODO, never a guess. Important Upgrade Notes and Deprecated
Features are filled from the confirmed breaking changes (upgrade_docs.py). Other sections that
need a person get a marked placeholder, filled in a later PR.
"""

import re
from datetime import date, datetime, timedelta

from . import schedule
from .milestones import DESKTOP_REPO, MOBILE_REPO, SERVER_REPO
from .result import TODO_MARKER, Result
from .versions import (
    Version,
    changelog_anchor,
    changelog_page,
    download_url,
    is_esr,
    long_date,
    next_esr_line,
    planned_next_esr_day,
    sbom_url,
    support_end,
)

TASK = "release-docs"
# The last release docs PR a person made, whose format the generated lines copy.
EXAMPLE_PR = "https://github.com/mattermost/mattermost/pull/38573"
MOBILE_RELEASES = "docs/main/product-overview/mattermost-mobile-releases.mdx"
PLAYBOOK_QUOTE = ("Draft a docs PR to update the UI & Accessibility changelog, Important Upgrade Notes, Open Source "
                  "Components, deploy-rhel.rst, deploy-tar.rst, Deprecated Features list, Release Lifecycle (add two "
                  "upcoming versions and mark one version as unsupported), Desktop compatibility, and ESR/PostgreSQL "
                  "compatibility table pages, and add the next ESR version to the chart in the ESR docs page.")
SERVER_RELEASES = "docs/main/product-overview/mattermost-server-releases.mdx"
RELEASE_POLICY = "docs/main/product-overview/release-policy.mdx"
DESKTOP_RELEASES = "docs/main/product-overview/mattermost-desktop-releases.mdx"
REQUIREMENTS = "docs/main/deployment-guide/software-hardware-requirements.mdx"
DEPLOY_PAGES = (
    "docs/main/deployment-guide/server/linux/deploy-rhel.mdx",
    "docs/main/deployment-guide/server/linux/deploy-tar.mdx",
)
UI_ADA_CHANGELOG = "docs/main/product-overview/ui-ada-changelog.mdx"
UPGRADE_NOTES = "docs/main/administration-guide/upgrade/important-upgrade-notes.mdx"
DEPRECATED_FEATURES = "docs/main/product-overview/deprecated-features.mdx"
FILES = (SERVER_RELEASES, RELEASE_POLICY, DESKTOP_RELEASES, MOBILE_RELEASES, REQUIREMENTS, *DEPLOY_PAGES,
         UI_ADA_CHANGELOG, UPGRADE_NOTES, DEPRECATED_FEATURES)
# Where the server's minimum PostgreSQL version is set; read on the release branch.
POSTGRES_REQUIREMENT = "server/public/model/config.go"
POSTGRES_CONSTANT = re.compile(r"(?m)^\s*MinimumPostgresMajorVersion\s*=\s*(\d+)\b")
PLACEHOLDER_MARKER = "release-agent placeholder"
GANTT_NAME_WIDTH = 23
# The PR check fails from T-2 while Important Upgrade Notes or Deprecated Features keep a placeholder.
CHECK_FAILS_FROM_T = 2


def _day(day: date | None, result: Result, what: str) -> str:
    return day.isoformat() if day else result.todo(f"no {what}: its vX.Y.0 milestone has no due date")


def postgres_minimum(config_go: str | None) -> int | None:
    match = POSTGRES_CONSTANT.search(config_go or "")
    return int(match.group(1)) if match else None


# ── Server releases table ───────────────────────────────────────────────────────────

ROW_VERSION = re.compile(r"^\| v(\d+)\.(\d+) ")


def server_release_row(version: Version, esr_versions: str, release_day: date | None, result: Result) -> str:
    v = Version(version.major, version.minor, 0)
    sbom = (f'<details class="mm-sbom"><summary>SBOM</summary><ul>'
            f'<li><a href="{sbom_url(v, "team")}">Team Edition</a></li>'
            f'<li><a href="{sbom_url(v, "enterprise")}">Enterprise</a></li></ul></details>')
    esr = is_esr(version, esr_versions)
    if not re.search(r"\d", esr_versions or ""):
        result.todo("CHANGELOG_ESR_VERSIONS is empty, so the support end assumes a non-ESR release")
    released = _day(release_day, result, f"release date for {version.short}")
    ends = support_end(release_day, esr).isoformat() if release_day else result.todo(f"no support end for {version.short}")
    if esr:
        ends += " [EXTENDED](./release-policy#release-types)"
    return (f"| {version.short} [Download]({download_url(v, 'enterprise')}) \\| "
            f"[Changelog](./{changelog_page(v)}#{changelog_anchor(v, esr_versions)}) \\| {sbom} "
            f"| {released} | {ends} |\n")


def add_server_release(content: str, version: Version, esr_versions: str, release_day: date | None, result: Result) -> str:
    lines = content.splitlines(keepends=True)
    header = next((i for i, line in enumerate(lines) if line.startswith("| **Release** | **Released on**")), None)
    if header is None:
        result.todo(f"{SERVER_RELEASES} has no Latest releases table")
        return content
    index = header + 2
    while index < len(lines) and (match := ROW_VERSION.match(lines[index])):
        listed = (int(match.group(1)), int(match.group(2)))
        if listed == version.line:
            if TODO_MARKER in lines[index]:
                lines[index] = server_release_row(version, esr_versions, release_day, result)
                return "".join(lines)
            result.notes.append(f"{SERVER_RELEASES} already lists {version.short}; left as is.")
            return content
        if listed < version.line:
            break
        index += 1
    lines.insert(index, server_release_row(version, esr_versions, release_day, result))
    return "".join(lines)


# ── ESR chart and legend ────────────────────────────────────────────────────────────

GANTT_LINE = re.compile(r"^    v(\d+)\.(\d+)(?P<label>[^:\n]*?)\s*:(?P<tags>(?:\s*:?\w+\s*,)*)\s*(?P<start>\d{4}-\d{2}-\d{2}),\s*(?P<end>\d{4}-\d{2}-\d{2})\s*$")
DESKTOP_IN_LABEL = re.compile(r"& Desktop App (v\d+\.\d+)")


def _gantt_line(short: str, label: str, tags: list[str], start: str, end: str) -> str:
    """``    v12.0                  :active, 2026-10-16, 2027-01-15``, or with ``:crit, :active,``."""
    name = f"{short}{label}"
    name = f"{name:<{GANTT_NAME_WIDTH}}" if not label else f"{name} "
    return f"    {name}:{', :'.join(tags)}, {start}, {end}\n"


def _parse_gantt(lines: list[str], start: int, end: int) -> list[dict]:
    entries = []
    for i in range(start, end):
        match = GANTT_LINE.match(lines[i])
        if match:
            tags = [t.strip().lstrip(":") for t in match.group("tags").split(",") if t.strip()]
            entries.append({"index": i, "version": (int(match.group(1)), int(match.group(2))),
                            "label": match.group("label").rstrip(), "tags": tags,
                            "start": match.group("start"), "end": match.group("end"),
                            "planned": "(planned)" in match.group("label")})
    return entries


def update_esr_chart(content: str, version: Version, esr_versions: str, release_day: date | None, result: Result) -> str:
    lines = content.splitlines(keepends=True)
    start = next((i for i, line in enumerate(lines) if line.strip() == "section Releases"), None)
    if start is None:
        result.todo(f"{RELEASE_POLICY} has no ESR chart (mermaid 'section Releases')")
        return content
    end = next((i for i in range(start, len(lines)) if lines[i].strip() == "```"), len(lines))
    entries = _parse_gantt(lines, start + 1, end)
    esr = is_esr(version, esr_versions)
    if not release_day:
        result.todo(f"no Release Day for {version.short} (no due date on its {version.tag} milestone), so the ESR chart "
                    "is not updated")
        return content
    begin, finish = release_day.isoformat(), support_end(release_day, esr).isoformat()
    short = version.short
    existing = next((e for e in entries if e["version"] == version.line), None)
    if existing and not existing["planned"]:
        # Already there (a rerun, or added by hand): its dates follow the milestone; label and tags stay.
        new_line = None
        if (existing["start"], existing["end"]) == (begin, finish):
            result.notes.append(f"The ESR chart already has {short}; left as is.")
        else:
            lines[existing["index"]] = _gantt_line(short, existing["label"], existing["tags"], begin, finish)
            result.notes.append(f"The ESR chart already has {short}; its dates now follow the milestone ({begin} to "
                                f"{finish}).")
    elif esr:
        desktop = DESKTOP_IN_LABEL.search(existing["label"]).group(1) if existing and DESKTOP_IN_LABEL.search(existing["label"]) \
            else result.todo(f"the Desktop App ESR paired with {short} (the chart has no planned line for it)", bare=True)
        new_line = _gantt_line(short, f" & Desktop App {desktop} Extended Support", ["crit", "active"], begin, finish)
    else:
        if existing:
            result.todo(f"the ESR chart plans {short} as an ESR, but CHANGELOG_ESR_VERSIONS does not list it")
        new_line = _gantt_line(short, "", ["active"], begin, finish)

    for e in entries:
        if not e["planned"] and e["version"] != version.line and e["end"] < begin:
            tags = ["done" if t == "active" else t for t in e["tags"]]
            if tags != e["tags"]:
                lines[e["index"]] = _gantt_line(f"v{e['version'][0]}.{e['version'][1]}", e["label"], tags, e["start"], e["end"])

    if new_line:
        if existing:
            lines[existing["index"]] = new_line
        else:
            later = [e["index"] for e in entries if e["version"] > version.line]
            lines.insert(later[0] if later else (entries[-1]["index"] + 1 if entries else start + 1), new_line)
    content = "".join(lines)
    if esr:
        content = _add_planned_esr(content, version, esr_versions, release_day, result)
        content = _update_esr_legend(content, version, release_day, result)
    return content


def upcoming_releases(version: Version, server_days: dict | None) -> list[tuple[Version, date | None]]:
    """The two server releases after ``version``, with their Release Day (``server_days``: the
    ``vX.Y.0`` milestones' due dates by ``(major, minor)``).

    Each is the one right after the last: the next minor, or the next major's .0 when only that
    has a due date. One with no due date yet is the next minor with no date, a TODO, never a
    guess, even when the releases after it have one.
    """
    found, previous = [], version
    while len(found) < 2:
        found.append(next_release(previous, server_days))
        previous = found[-1][0]
    return found


def next_release(version: Version, days: dict | None) -> tuple[Version, date | None]:
    """The release after ``version`` and its Release Day (``days``: the ``vX.Y.0`` milestones' due
    dates by ``(major, minor)``): the next minor if it has a due date, else the next major's .0 if
    that has one, else the next minor with none."""
    for line in ((version.major, version.minor + 1), (version.major + 1, 0)):
        if (days or {}).get(line) is not None:
            return Version(*line), days[line]
    return Version(version.major, version.minor + 1), None


def add_upcoming_lines(content: str, upcoming: list, esr_versions: str, result: Result) -> str:
    """The Release Lifecycle chart gets a line for each of the next two releases, dated from their
    milestones, as the last release docs PR made by hand did (``EXAMPLE_PR``). A line already
    there is filled in (its dates follow the milestone), never added twice; a planned ESR line
    is left as it is. A release with no Release Day gets a TODO in the PR body, no line."""
    for version, day in upcoming:
        if day is None:
            result.todo(f"no due date on the {version.tag} milestone in {SERVER_REPO}, so the Release Lifecycle chart "
                        f"has no line for {version.short}")
            continue
        lines = content.splitlines(keepends=True)
        start = next((i for i, line in enumerate(lines) if line.strip() == "section Releases"), None)
        if start is None:
            return content
        end = next((i for i in range(start, len(lines)) if lines[i].strip() == "```"), len(lines))
        entries = _parse_gantt(lines, start + 1, end)
        esr = is_esr(version, esr_versions)
        begin, finish = day.isoformat(), support_end(day, esr).isoformat()
        existing = next((e for e in entries if e["version"] == version.line), None)
        if existing and existing["planned"]:
            continue
        if existing:
            if (existing["start"], existing["end"]) != (begin, finish):
                lines[existing["index"]] = _gantt_line(version.short, existing["label"], existing["tags"], begin, finish)
                result.notes.append(f"The Release Lifecycle chart's {version.short} line now has its milestone's dates.")
            content = "".join(lines)
            continue
        if esr:
            desktop = result.todo(f"the Desktop App ESR paired with {version.short}", bare=True)
            line = _gantt_line(version.short, f" & Desktop App {desktop} Extended Support", ["crit", "active"], begin, finish)
        else:
            line = _gantt_line(version.short, "", ["active"], begin, finish)
        later = [e["index"] for e in entries if e["version"] > version.line]
        lines.insert(later[0] if later else (entries[-1]["index"] + 1 if entries else start + 1), line)
        content = "".join(lines)
        result.upcoming.append(version.short)
    return content


def _add_planned_esr(content: str, version: Version, esr_versions: str, release_day: date, result: Result) -> str:
    following, problem = next_esr_line(version, esr_versions)
    if problem:
        result.todo(problem)
    if not following or problem:
        return content
    lines = content.splitlines(keepends=True)
    start = next(i for i, line in enumerate(lines) if line.strip() == "section Releases")
    end = next((i for i in range(start, len(lines)) if lines[i].strip() == "```"), len(lines))
    entries = _parse_gantt(lines, start + 1, end)
    if any(e["version"] == following.line for e in entries):
        return content
    planned = planned_next_esr_day(release_day)
    desktop = result.todo(f"the Desktop App ESR paired with the next ESR, {following.short}", bare=True)
    line = _gantt_line(following.short, f" & Desktop App {desktop} Extended Support (planned)", ["crit"],
                       planned.isoformat(), support_end(planned, True).isoformat())
    lines.insert(entries[-1]["index"] + 1 if entries else start + 1, line)
    content = "".join(lines)
    bullet = (f"  - {following.short} & Desktop App {desktop} (planned): Expected {planned.strftime('%B')} {planned.year}. "
              "Version number and dates are subject to change until the release is announced.\n")
    return re.sub(r"(?m)^(- 🔴 \*\*Red bars\*\*.*\n)", lambda m: m.group(1) + bullet, content, count=1)


def _update_esr_legend(content: str, version: Version, release_day: date, result: Result) -> str:
    """The red-bar bullets: this ESR is supported until its end; earlier ones past their end have ended."""
    ends = support_end(release_day, True)
    lines = content.splitlines(keepends=True)
    out = []
    for line in lines:
        match = re.match(r"^  - v(\d+)\.(\d+)( & Desktop App [^:(]+?)?\s*(\(planned\))?: (.*)$", line)
        if not match:
            out.append(line)
            continue
        line_version = (int(match.group(1)), int(match.group(2)))
        pairing = (match.group(3) or "").rstrip()
        if line_version == version.line:
            out.append(f"  - {version.short}{pairing}: Supported until {long_date(ends)}\n")
            continue
        until = re.match(r"Supported until (\w+ \d+, \d{4})", match.group(5))
        if until and line_version < version.line:
            ended = datetime.strptime(until.group(1), "%B %d, %Y").date()
            if ended < release_day:
                out.append(f"  - v{line_version[0]}.{line_version[1]}{pairing}: Support ended {until.group(1)}\n")
                continue
        out.append(line)
    if not any(re.match(rf"^  - {re.escape(version.short)}\b", line) for line in out):
        bullet = f"  - {version.short} & Desktop App {result.todo(f'the Desktop App ESR paired with {version.short}', bare=True)}: Supported until {long_date(ends)}\n"
        text = "".join(out)
        planned = re.search(r"(?m)^  - v\d+\.\d+ .*\(planned\).*\n", text)
        anchor = planned.end() if planned else (re.search(r"(?m)^- 🔴 \*\*Red bars\*\*.*\n", text) or re.search(r"\Z", text)).end()
        return text[:anchor] + bullet + text[anchor:]
    return "".join(out)


# ── Desktop compatibility ───────────────────────────────────────────────────────────

DESKTOP_ROW = re.compile(r"^\| v(\d+)\.(\d+) .*Released: (\d{4}-\d{2}-\d{2})<br/>Support Ends: (\d{4}-\d{2}-\d{2}).*\| (?P<compat>[^|]*) \|\s*$")


def add_desktop_compatibility(content: str, version: Version, esr_versions: str, release_day: date | None, result: Result) -> str:
    """Adds this server release to the newest Desktop App release still supported on its release day."""
    lines = content.splitlines(keepends=True)
    rows = [(i, m) for i, line in enumerate(lines) if (m := DESKTOP_ROW.match(line))]
    if not rows:
        result.todo(f"{DESKTOP_RELEASES} has no Desktop releases table")
        return content
    index, match = rows[0]
    desktop = f"v{match.group(1)}.{match.group(2)}"
    link = f"[{version.short}](./{changelog_page(version)}#{changelog_anchor(version, esr_versions)})"
    if f"[{version.short}](" in match.group("compat"):
        return content
    if not release_day:
        result.todo(f"no Release Day for {version.short}, so its Desktop App compatibility is unknown")
        return content
    if date.fromisoformat(match.group(4)) < release_day:
        result.todo(f"the newest Desktop App release ({desktop}) is no longer supported on {release_day}; "
                    f"add the Desktop release that ships with {version.short} and list {version.short} on it")
        return content
    line = lines[index]
    at = match.start("compat")
    lines[index] = line[:at] + link + ", " + line[at:]
    return "".join(lines)


# ── ESR / PostgreSQL table ──────────────────────────────────────────────────────────

PG_ROW = re.compile(r"<tr>\s*<td><a href=\{useBaseUrl\('[^']*'\)\}>v(\d+)\.(\d+)[^<]*</a></td>\s*<td>[^<]*</td>\s*<td>([^<]*)</td>\s*</tr>\n?")


def add_postgres_row(content: str, version: Version, esr_versions: str, release_day: date | None,
                     code_minimum: int | None, result: Result) -> str:
    """An ESR gets a row, carrying the minimum forward unless the server's own minimum changed."""
    intro = content.find("future PostgreSQL minimum version increases")
    table_end = content.find("</tbody>", intro)
    if intro < 0 or table_end < 0:
        result.todo(f"{REQUIREMENTS} has no ESR/PostgreSQL table")
        return content
    rows = list(PG_ROW.finditer(content, intro, table_end))
    own = next((r for r in rows if (int(r.group(1)), int(r.group(2))) == version.line), None)
    if own and TODO_MARKER in own.group(0):
        if code_minimum is None:
            # Keep the placeholder row: removing it would leave nothing to show the missing input.
            result.todo(f"MinimumPostgresMajorVersion not found in {POSTGRES_REQUIREMENT} on release-{version.major}.{version.minor}")
            return content
        content = content[:own.start()] + content[own.end():]
        table_end = content.find("</tbody>", intro)
        rows = list(PG_ROW.finditer(content, intro, table_end))
    elif own:
        return content
    if not rows:
        result.todo(f"{REQUIREMENTS} has no rows in the ESR/PostgreSQL table")
        return content
    last_cell = rows[-1].group(3).strip()
    last_minimum = int(re.match(r"\d+", last_cell).group(0)) if re.match(r"\d+", last_cell) else None
    esr = is_esr(version, esr_versions)
    if code_minimum is None:
        result.todo(f"MinimumPostgresMajorVersion not found in {POSTGRES_REQUIREMENT} on release-{version.major}.{version.minor}")
        return content
    if not esr and code_minimum == last_minimum:
        return content
    if last_minimum is not None and code_minimum < last_minimum:
        result.todo(f"{POSTGRES_REQUIREMENT} lowers the minimum PostgreSQL to {code_minimum}, below the table's {last_minimum}")
        return content
    cell = last_cell if code_minimum == last_minimum else f"{code_minimum}.x"
    released = f"{release_day.year}-{release_day.month}-{release_day.day}" if release_day \
        else result.todo(f"no Release Day for {version.short}")
    label = f"{version.short} ESR" if esr else version.short
    row = (f"<tr>\n<td><a href={{useBaseUrl('/product-overview/{changelog_page(version)}#{changelog_anchor(version, esr_versions)}')}}>"
           f"{label}</a></td>\n<td>{released}</td>\n<td>{cell}</td>\n</tr>\n")
    at = rows[-1].end()
    return content[:at] + row + content[at:]


# ── Delayed releases: the latest release's end date ──────────────────────────────────

SUPPORT_ENDS = re.compile(r"Support Ends: (\d{4}-\d{2}-\d{2})")
SERVER_ENDS = re.compile(r"\| (\d{4}-\d{2}-\d{2}) \| (\d{4}-\d{2}-\d{2})")
APP_ROW = re.compile(r"^\| v(\d+)\.(\d+) ")


APP_REPOS = {"Server": SERVER_REPO, "Desktop": DESKTOP_REPO, "Mobile": MOBILE_REPO}


def extend_for_delay(content: str, path: str, kind: str, days: dict | None, release_day: date | None,
                     result: Result) -> str:
    """When the next release is late, the latest release on a releases page is supported until
    the day before it ships, as the pages already show (v2.45: Support Ends 2026-11-15, the day
    before v2.46). Only checked for a latest release whose end falls by this release's Release
    Day. ``days`` are the due dates of ``kind``'s ``vX.Y.0`` milestones (in mattermost/mattermost,
    mattermost/desktop or mattermost/mattermost-mobile); a next release with none is a TODO."""
    lines = content.splitlines(keepends=True)
    index = next((i for i, line in enumerate(lines) if APP_ROW.match(line)), None)
    if index is None or release_day is None:
        return content
    match = APP_ROW.match(lines[index])
    found = (SERVER_ENDS if kind == "Server" else SUPPORT_ENDS).search(lines[index])
    if not found:
        return content
    end = date.fromisoformat(found.group(found.lastindex))
    if end > release_day:
        return content
    latest = f"v{match.group(1)}.{match.group(2)}"
    following, day = next_release(Version(int(match.group(1)), int(match.group(2))), days)
    name = latest if kind == "Server" else f"{kind} {latest}"
    if day is None:
        result.todo(f"no due date on the {following.tag} milestone in {APP_REPOS[kind]} (the release after {name}), so "
                    f"its end date on {path.rsplit('/', 1)[-1]} isn't checked")
        return content
    new_end = day - timedelta(days=1)
    if new_end <= end:
        return content
    start, stop = found.span(found.lastindex)
    lines[index] = lines[index][:start] + new_end.isoformat() + lines[index][stop:]
    result.delayed.append(f"{name} on {path.rsplit('/', 1)[-1]}: support now ends {new_end.isoformat()} instead of "
                          f"{end.isoformat()}, the day before the next release's Release Day ({day.isoformat()})")
    return "".join(lines)


# ── Deploy pages ────────────────────────────────────────────────────────────────────

WGET = re.compile(r"https://releases\.mattermost\.com/(\d+\.\d+\.\d+)/mattermost-(\d+\.\d+\.\d+)-linux-amd64\.tar\.gz")


def update_deploy_page(content: str, version: Version, esr_versions: str, result: Result | None = None,
                       path: str = "the deploy page") -> str:
    """The Latest release tab (and Current ESR tab, for an ESR) download the new version. Never lowered."""
    tabs = ["latest"] + (["esr"] if is_esr(version, esr_versions) else [])
    for tab in tabs:
        start = content.find(f'<TabItem value="{tab}"')
        end = content.find("</TabItem>", start)
        if start < 0 or end < 0:
            continue
        block = content[start:end]
        match = WGET.search(block)
        if not match and result is not None:
            result.todo(f"{path} has no download line in its {tab} tab to update")
        if not match or Version.parse(match.group(1)) >= version:
            continue
        block = block.replace(match.group(0), download_url(version, "enterprise"))
        content = content[:start] + block + content[end:]
    return content


# ── Placeholders for the sections a person writes ───────────────────────────────────

def placeholder(version: Version, what: str) -> str:
    return f"{{/* {PLACEHOLDER_MARKER}: {version.short} {what}, filled in a later PR. */}}\n"


def add_placeholder(content: str, after: str, text: str) -> str:
    if text.strip() in content:
        return content
    at = content.find(after)
    if at < 0:
        return content
    at += len(after)
    return content[:at] + text + content[at:]


PLACEHOLDERS = (
    (UI_ADA_CHANGELOG, "<tbody>\n", "UI & Accessibility changelog rows"),
    (UPGRADE_NOTES, "<tbody>\n", "Important Upgrade Notes"),
    (DEPRECATED_FEATURES, "## Removed features by Mattermost version\n\n", "Deprecated Features"),
)


# ── The PR ──────────────────────────────────────────────────────────────────────────

def check_fails_from(release_day: date | None) -> date | None:
    """T-2: from this day the PR check fails while the upgrade pages keep a placeholder."""
    return schedule.t_minus(release_day, CHECK_FAILS_FROM_T) if release_day else None


def waiting_lines(release_day: date | None) -> list[str]:
    """The PR body's lines while the confirmed breaking changes are not known (no marker yet)."""
    when = check_fails_from(release_day)
    fails = (f"The PR check fails from T-{CHECK_FAILS_FROM_T} ({when.isoformat()}) while their placeholders are here."
             if when else "The PR check fails while their placeholders are here: with no Release Day, T-2 is unknown.")
    return ["- [ ] Important Upgrade Notes and Deprecated Features: waiting for the confirmed breaking changes (the "
            "`release-automation:confirmed-breaking` marker in this description). " + fails]


def upgrade_lines(upgrade) -> list[str]:
    """The PR body's lines for the two pages filled from confirmed breaking changes. Private PRs are
    only counted: the PR is public."""
    def public(entries):
        return sorted({e.source for e in entries if e.source.startswith("mattermost/mattermost#")})

    done = "x" if upgrade.complete else " "
    lines = [f"- [{done}] Important Upgrade Notes: {len(upgrade.notes)} row(s) from confirmed breaking changes, worded "
             "from their changelog bullets" + ("" if upgrade.complete else "; the placeholder stays (see Missing inputs)"),
             f"- [{done}] Deprecated Features: {len(upgrade.removed)} entr{'y' if len(upgrade.removed) == 1 else 'ies'} for "
             "confirmed removals and deprecations"]
    drafted = public(upgrade.drafted())
    if drafted:
        lines += ["", "Drafted by Claude, because the PR has no changelog bullet in Upgrade Impact or API Changes. Check "
                      "the wording before merging:", ""]
        lines += [f"- [ ] {source}" for source in drafted]
    return lines


def build(version: Version, files: dict, esr_versions: str, release_day: date | None, code_minimum: int | None,
          release_days: dict | None = None, upgrade=None, today: date | None = None) -> Result:
    """``files`` maps each path in ``FILES`` to its text on the base branch (None if absent).
    ``release_days`` maps "Server", "Desktop" and "Mobile" to their ``vX.Y.0`` milestones' due
    dates by ``(major, minor)``. ``upgrade`` (upgrade_docs.UpgradeDocs) fills Important Upgrade
    Notes and Deprecated Features from the confirmed breaking changes; without it (no marker in
    the PR description yet) they get placeholders, a missing input from T-2 (``today`` on or
    after it)."""
    result = Result(TASK, version.tag, repo="mattermost/mattermost")
    release_days = release_days or {}
    result.upcoming, result.delayed = [], []
    updated = dict(files)

    def apply(path, fn):
        if updated.get(path) is None:
            result.todo(f"{path} does not exist")
            return
        updated[path] = fn(updated[path])

    # The latest release on each page is checked for a late next release before this one is added.
    for path, kind in ((SERVER_RELEASES, "Server"), (DESKTOP_RELEASES, "Desktop"), (MOBILE_RELEASES, "Mobile")):
        if kind != "Mobile" or updated.get(path) is not None:
            apply(path, lambda c, path=path, kind=kind: extend_for_delay(c, path, kind, release_days.get(kind),
                                                                       release_day, result))
    apply(SERVER_RELEASES, lambda c: add_server_release(c, version, esr_versions, release_day, result))
    apply(RELEASE_POLICY, lambda c: update_esr_chart(c, version, esr_versions, release_day, result))
    apply(RELEASE_POLICY, lambda c: add_upcoming_lines(c, upcoming_releases(version, release_days.get("Server")),
                                                       esr_versions, result))
    apply(DESKTOP_RELEASES, lambda c: add_desktop_compatibility(c, version, esr_versions, release_day, result))
    apply(REQUIREMENTS, lambda c: add_postgres_row(c, version, esr_versions, release_day, code_minimum, result))
    for path in DEPLOY_PAGES:
        apply(path, lambda c, path=path: update_deploy_page(c, version, esr_versions, result, path))
    for path, after, what in PLACEHOLDERS:
        if upgrade is not None and path in (UPGRADE_NOTES, DEPRECATED_FEATURES):
            continue
        apply(path, lambda c, after=after, what=what: add_placeholder(c, after, placeholder(version, what)))
    if upgrade is not None:
        from . import upgrade_docs
        keep = not upgrade.complete
        rows = upgrade_docs.note_rows(version.short, upgrade.notes) if upgrade.notes else ""
        removed = upgrade_docs.removed_section(version.short, release_day, upgrade.removed) if upgrade.removed else ""

        def fill(path, remove, anchor, where, block, what):
            def edit(content):
                filled = upgrade_docs.fill(remove(content, version.short), anchor, block, placeholder(version, what), keep)
                if filled is None:  # the page is left as it is
                    result.todo(f"{path} has no `{where}` to add {version.short}'s {what} after, so it is unchanged")
                    return content
                return filled
            apply(path, edit)

        fill(UPGRADE_NOTES, upgrade_docs.without_rows, upgrade_docs.NOTES_ANCHOR, "<tbody>", rows,
             "Important Upgrade Notes")
        fill(DEPRECATED_FEATURES, upgrade_docs.without_section, upgrade_docs.REMOVED_ANCHOR,
             "## Removed features by Mattermost version", removed, "Deprecated Features")
        for todo in upgrade.todos:
            result.todo(todo)
    elif today and release_day and today >= check_fails_from(release_day):
        result.todo(f"no confirmed breaking changes yet (no `release-automation:confirmed-breaking` marker in the PR "
                    f"description) on or after T-{CHECK_FAILS_FROM_T}, so Important Upgrade Notes and Deprecated "
                    "Features keep their placeholders")

    result.files = {path: text for path, text in updated.items() if text is not None and text != files.get(path)}
    esr_note = " (ESR)" if is_esr(version, esr_versions) else ""
    result.title = f"{version.short}{esr_note} release docs: lifecycle, ESR chart, compatibility and deploy pages"
    upcoming = (f"Release Lifecycle chart on the release policy page: lines for the next two releases "
                f"({', '.join(result.upcoming)} added; the others were already there or have a TODO), versions past "
                "their support end marked as unsupported (`:done`)" if result.upcoming else
                "Release Lifecycle chart on the release policy page: the next two releases were already there (or "
                "have a TODO), versions past their support end marked as unsupported (`:done`)")
    result.body = "\n".join([
        f"Release docs for {version.short}{esr_note} that are calculated from the `vX.Y.0` milestones' due dates, "
        "`CHANGELOG_ESR_VERSIONS` and the release branch:",
        "",
        "- Server releases table: the new row, with its support end date",
        f"- {upcoming}",
        "- ESR chart on the release policy page" + (", including the next planned ESR" if esr_note else ""),
        "- Desktop compatibility: the newest supported Desktop App release",
        "- ESR/PostgreSQL table: carried forward unless `MinimumPostgresMajorVersion` changed on the release branch",
        "- Version strings in `deploy-rhel.mdx` and `deploy-tar.mdx`",
        "",
        f"The chart lines follow the format of the last release docs PR made by hand: {EXAMPLE_PR}.",
        "",
        *(["Delayed releases (the next release's milestone is due later than the end date shown):", "",
           *[f"- {line}" for line in result.delayed], ""] if result.delayed else []),
        "Sections that need a person are marked with an MDX comment and are filled in a later PR:",
        "",
        "- [ ] UI & Accessibility changelog. Accessibility tickets to review: see the release channel.",
        *(upgrade_lines(upgrade) if upgrade is not None else waiting_lines(release_day)),
        "",
        f"Playbook (T-16): {PLAYBOOK_QUOTE}",
        "",
    ])
    return result
