"""The calculated parts of the release docs PR (playbook T-16).

Release lifecycle table, ESR chart (with the next ESR), ESR/PostgreSQL rows, Desktop
compatibility and the deploy pages' version strings. Sections that need a person get a
marked placeholder, filled in a later PR.
"""

import re
from datetime import date, datetime

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
FILES = (SERVER_RELEASES, RELEASE_POLICY, DESKTOP_RELEASES, REQUIREMENTS, *DEPLOY_PAGES,
         UI_ADA_CHANGELOG, UPGRADE_NOTES, DEPRECATED_FEATURES)
# Where the server's minimum PostgreSQL version is set; read on the release branch.
POSTGRES_REQUIREMENT = "server/public/model/config.go"
POSTGRES_CONSTANT = re.compile(r"(?m)^\s*MinimumPostgresMajorVersion\s*=\s*(\d+)\b")
PLACEHOLDER_MARKER = "release-agent placeholder"
GANTT_NAME_WIDTH = 23


def _day(day: date | None, result: Result, what: str) -> str:
    return day.isoformat() if day else result.todo(f"no {what}: the Release Dates calendar has no Release Day for it")


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
        result.todo(f"no Release Day for {version.short} in the Release Dates calendar, so the ESR chart is not updated")
        return content
    begin, finish = release_day.isoformat(), support_end(release_day, esr).isoformat()
    short = version.short
    existing = next((e for e in entries if e["version"] == version.line), None)
    if existing and not existing["planned"]:
        result.notes.append(f"The ESR chart already has {short}; left as is.")
        new_line = None
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


# ── Deploy pages ────────────────────────────────────────────────────────────────────

WGET = re.compile(r"https://releases\.mattermost\.com/(\d+\.\d+\.\d+)/mattermost-(\d+\.\d+\.\d+)-linux-amd64\.tar\.gz")


def update_deploy_page(content: str, version: Version, esr_versions: str) -> str:
    """The Latest release tab (and Current ESR tab, for an ESR) download the new version. Never lowered."""
    tabs = ["latest"] + (["esr"] if is_esr(version, esr_versions) else [])
    for tab in tabs:
        start = content.find(f'<TabItem value="{tab}"')
        end = content.find("</TabItem>", start)
        if start < 0 or end < 0:
            continue
        block = content[start:end]
        match = WGET.search(block)
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

def build(version: Version, files: dict, esr_versions: str, release_day: date | None, code_minimum: int | None) -> Result:
    """``files`` maps each path in ``FILES`` to its text on the base branch (None if absent)."""
    result = Result(TASK, version.tag, repo="mattermost/mattermost")
    updated = dict(files)

    def apply(path, fn):
        if updated.get(path) is None:
            result.todo(f"{path} does not exist")
            return
        updated[path] = fn(updated[path])

    apply(SERVER_RELEASES, lambda c: add_server_release(c, version, esr_versions, release_day, result))
    apply(RELEASE_POLICY, lambda c: update_esr_chart(c, version, esr_versions, release_day, result))
    apply(DESKTOP_RELEASES, lambda c: add_desktop_compatibility(c, version, esr_versions, release_day, result))
    apply(REQUIREMENTS, lambda c: add_postgres_row(c, version, esr_versions, release_day, code_minimum, result))
    for path in DEPLOY_PAGES:
        apply(path, lambda c: update_deploy_page(c, version, esr_versions))
    for path, after, what in PLACEHOLDERS:
        apply(path, lambda c, after=after, what=what: add_placeholder(c, after, placeholder(version, what)))

    result.files = {path: text for path, text in updated.items() if text is not None and text != files.get(path)}
    esr_note = " (ESR)" if is_esr(version, esr_versions) else ""
    result.title = f"{version.short}{esr_note} release docs: lifecycle, ESR chart, compatibility and deploy pages"
    result.body = "\n".join([
        f"Release docs for {version.short}{esr_note} that are calculated from the release calendar, "
        "`CHANGELOG_ESR_VERSIONS` and the release branch:",
        "",
        "- Server releases table: the new row, with its support end date",
        "- ESR chart on the release policy page" + (", including the next planned ESR" if esr_note else ""),
        "- Desktop compatibility: the newest supported Desktop App release",
        "- ESR/PostgreSQL table: carried forward unless `MinimumPostgresMajorVersion` changed on the release branch",
        "- Version strings in `deploy-rhel.mdx` and `deploy-tar.mdx`",
        "",
        "Sections that need a person are marked with an MDX comment and are filled in a later PR:",
        "",
        "- [ ] UI & Accessibility changelog",
        "- [ ] Important Upgrade Notes",
        "- [ ] Deprecated Features",
        "",
        "Playbook (T-16): Draft a docs PR to update the UI & Accessibility changelog, Important Upgrade Notes, "
        "Open Source Components, deploy-rhel.rst, deploy-tar.rst, Deprecated Features list, Release Lifecycle, "
        "Desktop compatibility, and ESR/PostgreSQL compatibility table pages, and add the next ESR version to "
        "the chart in the ESR docs page.",
        "",
    ])
    return result
