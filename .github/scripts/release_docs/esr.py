"""ESR comms: three months before an ESR goes out of support, and on the day it does.

- The monthly blog and email get an "Extended Support Release Updates" section in those
  two months (``section``), as in the v11.10 (August 2026) release; no separate blog or email.
- On each of the two days (or the next working day) a weekday run:
  - opens one draft docs PR for the ESR support snippets, the release policy and the
    upgrade page (``docs_changes``);
  - three months before: opens a draft PR in mattermost/mattermost-mobile that makes the new
    ESR the minimum supported server (the mobile ESR prompt), as mattermost-mobile#9954 did,
    and sets MIN_REQUIRED_VERSION to the ESR two before it (``mobile_result``);
  - when support ends: creates a Jira ticket for removing the feature flags enabled up to
    that ESR. Ticket keys go to Hub only.
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
MOBILE_TASK = "mobile-esr"
MOBILE_REPO = "mattermost/mattermost-mobile"
MOBILE_CONSTANTS = "app/constants/supported_server.ts"
# The four files mattermost-mobile#9954 changed, each with the pattern of the version it sets.
MOBILE_TEXT = {
    "README.md": (re.compile(r"Current ESR version \(\d+\.\d+\.\d+\+\)"), "Current ESR version ({version}+)"),
    "fastlane/metadata/android/en-US/full_description.txt": (re.compile(r"Requires Mattermost Server v\d+\.\d+\.\d+\+"),
                                                             "Requires Mattermost Server v{version}+"),
    "fastlane/metadata/changelog": (re.compile(r"compatible with Mattermost servers v\d+\.\d+\.\d+\+"),
                                    "compatible with Mattermost servers v{version}+"),
}
MOBILE_FILES = (MOBILE_CONSTANTS, *MOBILE_TEXT)
JIRA_LABEL = "release-agent-esr"
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
    """(summary, description) of the Jira tickets for this day: the feature-flag cleanup."""
    if kind != ENDED:
        return []
    return [(f"Remove feature flags enabled up to {esr.old.short} ({esr.old.short} ESR out of support)",
             f"Server {esr.old.short} ESR went out of support on {long_date(esr.end)}. Remove the feature flags "
             f"that are enabled by default in every release up to {esr.old.short}.")]


# ── The mobile ESR prompt PR (mattermost-mobile#9954) ───────────────────────────────

def _constant(text: str, name: str, value: str, quoted: bool, result: Result) -> str:
    """``text`` with ``export const <name> = <value>;`` set, keeping the file's quote style."""
    value_pattern = r"""(['"])[^'"]*\2""" if quoted else r"\d+"
    pattern = re.compile(rf"^(export const {name} = ){value_pattern};$", re.M)
    if not pattern.search(text):
        result.todo(f"{MOBILE_CONSTANTS} has no `export const {name} = …;` line to set")
        return text
    if quoted:
        return pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}{value}{m.group(2)};", text)
    return pattern.sub(lambda m: f"{m.group(1)}{value};", text)


def min_required(text: str, esr: Esr, esr_versions: str, result: Result) -> str:
    """MIN_REQUIRED_VERSION is the ESR two before the new one: the app supports two trailing ESRs.

    Taken from CHANGELOG_ESR_VERSIONS in version order, so for the new ESR v11.7.0 it is '9.11.0'
    (as mattermost-mobile#9954 has it) and for v12.4.0 it is '10.11.0'. With fewer than two ESRs
    listed before the new one it is a TODO, never a guess; a file that already has the value is left.
    """
    new = esr.new
    before = [line for line in esr_lines(esr_versions) if line.line < new.line]
    if len(before) < 2:
        result.todo(f"{MOBILE_CONSTANTS}: CHANGELOG_ESR_VERSIONS lists {len(before)} ESR(s) before {new.short}, but "
                    f"MIN_REQUIRED_VERSION is the ESR two before it, so it wasn't set; add the older ESRs or set it by hand")
        return text
    target = f"{before[-2].short.lstrip('v')}.0"
    match = re.search(r"^export const MIN_REQUIRED_VERSION = '([^']*)';$", text, re.M)
    if match and match.group(1) == target:
        result.notes.append(f"MIN_REQUIRED_VERSION is already {target}.")
        return text
    return _constant(text, "MIN_REQUIRED_VERSION", target, True, result)


def mobile_changes(esr: Esr, files: dict, esr_versions: str, result: Result) -> dict:
    """The new ESR as the minimum supported server, in the four files #9954 changed."""
    new = esr.new
    changed = {}
    text = files.get(MOBILE_CONSTANTS) or ""
    updated = _constant(text, "FULL_VERSION", new.plain, True, result)
    updated = _constant(updated, "MAJOR_VERSION", str(new.major), False, result)
    updated = _constant(updated, "MIN_VERSION", str(new.minor), False, result)
    updated = _constant(updated, "PATCH_VERSION", "0", False, result)
    updated = min_required(updated, esr, esr_versions, result)
    if updated != text:
        changed[MOBILE_CONSTANTS] = updated
    for path, (pattern, replacement) in MOBILE_TEXT.items():
        text = files.get(path) or ""
        if not pattern.search(text):
            result.todo(f"{path} has no minimum server version to set")
            continue
        updated = pattern.sub(replacement.format(version=new.plain), text, count=1)
        if updated != text:
            changed[path] = updated
    return changed


def mobile_body(esr: Esr) -> str:
    new = esr.new
    lower = f"v{new.major}.{new.minor - 1}" if new.minor else f"v{new.major - 1}.x"
    return "\n".join([
        "QA Test Steps:",
        f"1. Connect to a server with a version lower than ESR (e.g. {lower}). Expected: Prompt to upgrade the server "
        "is received.",
        f"2. Connect to a server with a version equal to ESR ({new.short}). Expected: Prompt to upgrade the server is "
        "not received.",
        f"3. Connect to a server with a version greater than ESR (e.g. v{new.major}.{new.minor + 1}). Expected: Prompt "
        "to upgrade the server is not received.",
        "",
        f"Merge on {long_date(esr.end)}, when {esr.old.short} goes out of support.",
        "",
        "```release-note",
        f"Updated minimum supported version to {new.tag}.",
        "```",
    ]) + "\n"


def mobile_result(esr: Esr, files: dict, esr_versions: str) -> Result:
    """The draft PR on ``release-agent/<new ESR>-before/mobile-esr``; ``esr.new`` must be known."""
    result = Result(MOBILE_TASK, f"{esr.new.tag}-before")
    result.repo = MOBILE_REPO
    result.title = f"Update supported ESR version to {esr.new.tag}"
    result.files = mobile_changes(esr, files, esr_versions, result)
    result.body = mobile_body(esr)
    return result


def forum_post(esr: Esr, kind: str, desktop: dict, result: Result) -> str:
    title = (f"Mattermost {esr.old.short} Extended Support Release has reached end of life" if kind == ENDED
             else f"Mattermost {esr.old.short} Extended Support Release reaches end of life on {long_date(esr.end)}")
    return f"**{title}**\n\n{section(esr, kind, desktop, result)}"

