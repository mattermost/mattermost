"""ESR comms: three months before an ESR goes out of support, and on the day it does.

- The monthly blog and email get an "Extended Support Release Updates" section in those
  two months (``section``), as in the v11.10 (August 2026) release; no separate blog or email.
- On each of the two days (or the next working day) a weekday run:
  - opens one draft docs PR for the ESR support snippets, the release policy and the
    upgrade page (``docs_changes``);
  - creates Jira tickets for the mobile team (the mobile ESR prompt) and, when support
    ends, for removing the feature flags enabled up to that ESR. Ticket keys go to Hub only.
- The forum post is a draft in the Marketing thread (``forum_post``); there's no forum access.

Support ends come from ``versions.support_end`` and each ESR's Release Day from the server
releases table. Desktop ESRs can't be worked out: they come from DESKTOP_ESR_VERSIONS.
"""

import json
import re
from dataclasses import dataclass
from datetime import date, timedelta

from . import templates
from .result import Result
from .versions import Version, esr_comms_dates, esr_lines, long_date, support_end

BEFORE, ENDED = "before", "ended"
TASK = "esr-comms"
DOCS_TASK = "esr-docs"
JIRA_LABEL = "release-agent-esr"
MOBILE_EXAMPLE = "https://github.com/mattermost/mattermost-mobile/pull/9954"
RECENT = timedelta(days=14)
RELEASE_ROW = re.compile(r"^\| v(\d+)\.(\d+) .*?\| (\d{4}-\d{2}-\d{2}) \|")

# The ESR doc lists mattermost/docs paths; these are their docs/main files.
SNIPPETS = (
    "docs/main/product-overview/common-esr-support-rst.mdx",
    "docs/main/product-overview/common-esr-support-upgrade.mdx",
    "docs/main/product-overview/common-esr-support.mdx",
    "docs/main/administration-guide/upgrade/prepare-to-upgrade-mattermost.mdx",
)
RELEASE_POLICY = "docs/main/product-overview/release-policy.mdx"
MOBILE_CHANGELOG = "docs/main/product-overview/mobile-app-changelog.mdx"
DOCS_FILES = SNIPPETS + (RELEASE_POLICY,)

SUPPORT_SENTENCE = re.compile(
    r"Support for Mattermost Server (?P<old>v\d+\.\d+) (?P<link>\[Extended Support Release\]\([^)]*\)) "
    r"(?:has|will) come to the end of its life cycle on (?P<date>[A-Z][a-z]+ \d{1,2}, \d{4})\. "
    r"(?P<upgrade>Upgrading to .*? is required\.)")


@dataclass(frozen=True)
class Esr:
    """An ESR going out of support, and the ESR that replaces it."""
    old: Version
    old_released: date
    new: Version | None
    new_released: date | None

    @property
    def end(self) -> date:
        return support_end(self.old_released, True)

    @property
    def new_end(self) -> date | None:
        return support_end(self.new_released, True) if self.new_released else None

    @property
    def dates(self) -> dict:
        before, ended = esr_comms_dates(self.end)
        return {BEFORE: before, ENDED: ended}


def released_on(server_releases: str) -> dict:
    """``{(major, minor): Release Day}`` from the server releases table's "Released on" column."""
    found = {}
    for line in (server_releases or "").splitlines():
        match = RELEASE_ROW.match(line)
        if match:
            found[(int(match.group(1)), int(match.group(2)))] = date.fromisoformat(match.group(3))
    return found


def esrs(esr_versions: str, server_releases: str) -> list[Esr]:
    """Every ESR in CHANGELOG_ESR_VERSIONS that's released, with the one after it."""
    days = released_on(server_releases)
    lines = esr_lines(esr_versions)
    found = []
    for index, line in enumerate(lines):
        if line.line not in days:
            continue
        new = lines[index + 1] if index + 1 < len(lines) else None
        found.append(Esr(line, days[line.line], new, days.get(new.line) if new else None))
    return found


def for_month(month: tuple[int, int], all_esrs: list[Esr]) -> tuple[Esr, str] | None:
    """The ESR whose comms fall in ``month`` (a release month), and which of the two it is."""
    for esr in all_esrs:
        for kind, day in esr.dates.items():
            if (day.year, day.month) == month:
                return esr, kind
    return None


def desktop_versions(raw: str, result: Result) -> dict:
    if not (raw or "").strip():
        return {}
    try:
        return {Version.parse(k).short: v for k, v in json.loads(raw).items()}
    except (ValueError, AttributeError):
        result.todo("DESKTOP_ESR_VERSIONS is not a JSON object such as {\"v10.11\": \"v5.13\"}")
        return {}


def section(esr: Esr, kind: str, desktop: dict, result: Result, email: bool = False) -> str:
    """The "Extended Support Release Updates" text: three paragraphs for the blog, one for the email."""
    def desktop_for(version: Version) -> str:
        return desktop.get(version.short) or result.todo(f"DESKTOP_ESR_VERSIONS has no desktop ESR for {version.short}")

    if esr.new is None or esr.new_released is None:
        new = esr.new.short if esr.new else result.todo(f"CHANGELOG_ESR_VERSIONS lists no ESR after {esr.old.short}")
        month = result.todo(f"the server releases table has no Release Day for the ESR after {esr.old.short}")
        new_end, new_desktop = month, desktop_for(esr.new) if esr.new else new
    else:
        new, new_desktop = esr.new.short, desktop_for(esr.new)
        month = f"{esr.new_released.strftime('%B')} {esr.new_released.year}"
        new_end = long_date(esr.new_end)
    text = templates.render("esr-section.md", {
        "new_esr": new,
        "new_desktop_esr": new_desktop,
        "new_esr_month": month,
        "new_esr_support_end": new_end,
        "old_esr": esr.old.short,
        "old_desktop_esr": desktop_for(esr.old),
        "old_esr_support_end": long_date(esr.end),
        "life_cycle": "have come to the end of their life cycle" if kind == ENDED
        else "will come to the end of their life cycle",
        "backports": "we are no longer backporting fixes" if kind == ENDED else "we will no longer backport fixes",
    }).strip()
    return " ".join(p.strip() for p in text.split("\n\n")) if email else text


# ── The weekday run ─────────────────────────────────────────────────────────────────

def due(today: date, all_esrs: list[Esr], next_working_day) -> list[tuple[Esr, str]]:
    """The ESR comms that run today: on their day, or the next working day after it.

    Only dates in the last two weeks are looked at, so a year far off that isn't on the
    holidays page yet doesn't stop today's run."""
    return [(esr, kind) for esr in all_esrs for kind, day in esr.dates.items()
            if timedelta(0) <= today - day <= RECENT and next_working_day(day) == today]


def support_sentence(match: re.Match, esr: Esr, kind: str) -> str:
    verb = "has" if kind == ENDED else "will"
    upgrade = match.group("upgrade")
    if esr.new:
        upgrade = re.sub(r"v\d+\.\d+", esr.new.short, upgrade, count=1)
    return (f"Support for Mattermost Server {esr.old.short} {match.group('link')} {verb} come to the end of its "
            f"life cycle on {long_date(esr.end)}. {upgrade}")


def docs_changes(esr: Esr, kind: str, files: dict, desktop: dict, result: Result) -> dict:
    """The ESR docs edits, on top of ``files`` (path -> text)."""
    changed = {}
    for path in SNIPPETS:
        text = files.get(path) or ""
        updated = SUPPORT_SENTENCE.sub(lambda m: support_sentence(m, esr, kind), text)
        if not SUPPORT_SENTENCE.search(text):
            result.todo(f"{path} has no ESR support sentence to update")
        elif updated != text:
            changed[path] = updated
    policy = files.get(RELEASE_POLICY) or ""
    if kind == ENDED:
        old_desktop = desktop.get(esr.old.short, "")
        legend = re.compile(rf"^(\s*- {re.escape(esr.old.short)} & Desktop App [^:]+): Supported until .*$", re.M)
        updated = legend.sub(lambda m: f"{m.group(1)}: Support ended {long_date(esr.end)}", policy)
        updated = re.sub(rf"^(\s*{re.escape(esr.old.short)} & Desktop App \S+ Extended Support :crit, ):active, ",
                         r"\1:done, ", updated, flags=re.M)
        if updated == policy and f"Support ended {long_date(esr.end)}" not in policy:
            result.todo(f"the release policy has no {esr.old.short} legend line or chart row to mark as ended")
        elif updated != policy:
            changed[RELEASE_POLICY] = updated
        if old_desktop and old_desktop not in policy:
            result.notes.append(f"The release policy doesn't name Desktop App {old_desktop}; check the ESR rows.")
        result.todo("check the release policy ESR chart (the former graphic) by eye: rows, colours and the legend")
    return changed


def mobile_line(esr: Esr) -> str:
    """The Compatibility bullet for the next mobile release entry, as the changelog writes it."""
    if not esr.new:
        return ""
    return (f" - **Upgrade to server version {esr.new.short}.0 or later is required.** Support for server "
            "[Extended Support Release](https://docs.mattermost.com/product-overview/release-policy.html#extended-support-releases) "
            f"(ESR) {esr.old.short}.0 has ended and upgrading to server ESR {esr.new.short}.0 or later is required. "
            "As we innovate and offer newer versions of our mobile apps, we maintain backwards compatibility only "
            "with supported server versions. Users who upgrade to the newest mobile apps while being connected to an "
            "unsupported server version can be exposed to compatibility issues, which can cause crashes or severe bugs "
            "that break core functionality of the app.")


def docs_result(esr: Esr, kind: str, files: dict, desktop: dict) -> Result:
    result = Result(DOCS_TASK, f"{esr.old.tag}-{kind}")
    result.repo = "mattermost/mattermost"
    result.files = docs_changes(esr, kind, files, desktop, result)
    action = "reached end of life" if kind == ENDED else "goes out of support in three months"
    result.title = f"Update ESR docs: {esr.old.short} {action} ({long_date(esr.end)})"
    lines = ["#### Summary", f"Server {esr.old.short} ESR support ends {long_date(esr.end)}"
             + (f"; {esr.new.short} is the ESR to upgrade to." if esr.new else "."), "",
             "Updated, from the ESR instructions doc (its mattermost/docs paths map to `docs/main/`):", ""]
    lines += [f"- `{path}`" for path in sorted(result.files)]
    if kind == ENDED and esr.new:
        lines += ["", f"To add by hand to the next release entry in `{MOBILE_CHANGELOG}`:", "", "```", mobile_line(esr), "```"]
    lines += ["", "#### Release Note", "```release-note", "NONE", "```"]
    result.body = "\n".join(lines) + "\n"
    return result


def tickets(esr: Esr, kind: str) -> list[tuple[str, str]]:
    """(summary, description) of the Jira tickets for this day."""
    found = []
    if kind == BEFORE and esr.new:
        description = [f"Server {esr.old.short} ESR support ends {long_date(esr.end)}. Add the mobile ESR prompt for "
                       f"servers on {esr.old.short}, telling users to upgrade to {esr.new.short} or later.",
                       f"Example PR: {MOBILE_EXAMPLE}"]
        if esr.dates[BEFORE].month == 5:
            description.append(f"For the May ESR, also set MIN_REQUIRED_VERSION to the trailing ESR: "
                               f"'{esr.old.short.lstrip('v')}.0'.")
        found.append((f"Mobile: ESR prompt for server {esr.old.short} end of support ({long_date(esr.end)})",
                      "\n".join(description)))
    if kind == ENDED:
        found.append((f"Remove feature flags enabled up to {esr.old.short} ({esr.old.short} ESR out of support)",
                      f"Server {esr.old.short} ESR went out of support on {long_date(esr.end)}. Remove the feature flags "
                      f"that are enabled by default in every release up to {esr.old.short}."))
    return found


def forum_post(esr: Esr, kind: str, desktop: dict, result: Result) -> str:
    title = (f"Mattermost {esr.old.short} Extended Support Release has reached end of life" if kind == ENDED
             else f"Mattermost {esr.old.short} Extended Support Release reaches end of life on {long_date(esr.end)}")
    return f"**{title}**\n\n{section(esr, kind, desktop, result)}"

