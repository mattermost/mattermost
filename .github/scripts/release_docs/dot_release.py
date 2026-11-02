"""Dot release docs (vX.Y.Z with Z > 0): one draft PR for the dot releases shipped together.

Replaces the dot-release-docs skill. For each version, from the commits on release-X.Y after
vX.Y.(Z-1), it edits five files under docs/main: the download links on the two deploy pages,
the server releases row, the changelog entry and both version archive entries.

Never guessed: a checksum that is not published yet is written as TBD, a severity that was
not given as <SEVERITY>, and a bullet Claude could not write as a TODO marker. Each keeps
the run (and the PR's dot release check) failing until a person fills it in.
"""

import json
import re
from collections import Counter
from dataclasses import dataclass, field

from changelog_release import (
    BUILDENV_DOCKERFILE,
    MIGRATIONS_DIR,
    PLUGIN_MAKEFILE,
    go_version_from_buildenv,
    jira_keys,
    plugin_display_name,
    plugin_packages,
    plugin_version_link,
)
from check_config_changes_ci import _AUTO_LINE_RE as CHECKER_LINE
from check_config_changes_ci import _scan_struct_fields

from . import release_docs_pr, templates, version_archive
from .breaking import signals as breaking_signals
from .publish import TRAILER, Target, run_url, skipped_label_note, write
from .result import Result
from .versions import Version, changelog_page

TASK = "dot-release-docs"
REPO = "mattermost/mattermost"
BRANCH_PREFIX = "release-agent/dot-release-docs/"
LABELS = ["release-note-none", "Changelog/Not Needed"]
AWAITING_LABEL = "Do Not Merge/Awaiting Next Release"
SERVER_RELEASES = release_docs_pr.SERVER_RELEASES
DEPLOY_PAGES = release_docs_pr.DEPLOY_PAGES
ARCHIVE = version_archive.ARCHIVE_PATH
DOCS_DIR = "docs/main/product-overview"
CONFIG_GO = "server/public/model/config.go"
GO_VERSION_FILE = "server/.go-version"
# Labels that mark a PR or its Jira ticket as a security fix. GitHub's "3: Security Review"
# and "Security/Review code" are review steps, not fixes, so they are not listed.
SECURITY_LABELS = {"security", "security fix", "security-fix", "securityfix", "kind/security", "type/security"}
# MDX reads a bare <SEVERITY> as a component and fails the build; escaped, it renders as is.
SEVERITY_PLACEHOLDER = "\\<SEVERITY>"
SEVERITY_MARK = re.compile(r"\\?<SEVERITY>")
TBD = "TBD"
STATE_MARKER = "release-agent-state"
CLOSING_NONE = "contains no database or functional changes."
EDITIONS = {"enterprise": "Enterprise", "team": "Team Edition"}

PR_IN_TITLE = re.compile(r"\s*\(#(\d+)\)\s*$")
VERSION_BUMP = re.compile(r"(?i)^Update latest (?:patch |minor |major )?version to ")
REVERT = re.compile(r'^Revert "(.+)"$')
REVERTED_SHA = re.compile(r"This reverts commit ([0-9a-f]{7,40})")
# "go" or "golang" as a word, not a module path such as golang.org/x/net or go-bar.
GO_BUMP = re.compile(r"(?i)\b(?:bump|upgrade|update)\w*\b.*(?<![./-])\bgo(?:lang)?\b(?![./-]).*\d+\.\d+")
PLUGIN_BUMP = re.compile(r"(?i)pre-?packag|\bplugins?\b.*\bv?\d+\.\d+\.\d+")
TOOLING_TITLE = re.compile(r"(?i)^(?:ci|tests?|e2e|lint|build)(?:\([^)]*\))?:|^(?:fix|chore|feat)\((?:e2e|ci|tests?|lint|build)\)"
                           r"|^e2e/|^\[e2e\]")
DEPENDENCY_TITLE = re.compile(r"(?i)^(?:chore|build|fix)\(deps(?:-dev)?\)|^bump \S+ from \S+ to \S+")
DEPENDENCY_AUTHORS = {"dependabot[bot]", "renovate[bot]"}
NON_PRODUCT_PREFIXES = (".github/", "e2e-tests/", "docs/", "server/tests/", "server/build/", "server/scripts/",
                        "webapp/scripts/", "tools/", "scripts/", ".devcontainer/")
NON_PRODUCT_PARTS = ("/__snapshots__/", "/testdata/", "/tests/", "/test/", "/e2e/", "/mocks/", "/__mocks__/")
NON_PRODUCT_SUFFIXES = ("_test.go", ".test.ts", ".test.tsx", ".test.js", ".test.jsx", ".snap",
                        ".golangci.yml", ".eslintrc.json", ".eslintrc.js", ".stylelintrc.json")
WRITTEN_STARTS = ("Fixed an issue where", "Updated", "Added", "Improved")
SECURITY_STARTS = WRITTEN_STARTS + ("Fixed an issue with",)

ROW = re.compile(r"^\| v(\d+)\.(\d+) \[Download\]\(https://releases\.mattermost\.com/(\d+\.\d+\.\d+)/")
ARCHIVE_HEADER = re.compile(r"^Mattermost (?:Enterprise|Team) Edition v(\d+)\.(\d+)\.(\d+)\b")
DOT_BULLET = re.compile(r"^- \*\*(\d+)\.(\d+)\.(\d+), released ")
RELEASE_DAY = re.compile(r"^\*\*Release day: (.+?)\*\*\s*$")
SHA_LINE = re.compile(r"(SHA-256 Checksum: `)([^`]*)(`)")
JSX_LINE = re.compile(r"^<(/?)([A-Z]\w*|details)\b[^>]*>\s*$")
CALLOUTS = {"Attention", "Important", "Note", "Tip", "Warning", "Info", "Caution"}


def _changelog_module():
    """generate_changelog, for PR 39380's release-note rules. It reads its settings at import."""
    import generate_changelog
    return generate_changelog


def changelog_path(version: Version) -> str:
    return f"{DOCS_DIR}/{changelog_page(version)}.mdx"


def _swap(text: str, old: Version, new: Version) -> str:
    """Every ``old`` (``X.Y.Z``, so ``vX.Y.Z`` too) in ``text`` as ``new``; never inside a longer number."""
    return re.sub(rf"(?<![\d.]){re.escape(old.plain)}(?![\d])", new.plain, text)


def _count(text: str, version: Version) -> int:
    return len(re.findall(rf"(?<![\d.]){re.escape(version.plain)}(?![\d])", text or ""))


# ── What kind of minor: server releases table on master ─────────────────────────────

def table_rows(server_releases: str) -> list[dict]:
    rows = []
    for index, line in enumerate((server_releases or "").splitlines()):
        match = ROW.match(line)
        if match:
            cells = [c.strip() for c in re.split(r"(?<!\\)\|", line.strip())[1:-1]]
            rows.append({"index": index, "line": (int(match.group(1)), int(match.group(2))),
                         "listed": Version.parse(match.group(3)), "text": line, "cells": cells})
    return rows


def deploy_tabs(server_releases: str, version: Version) -> list[str] | None:
    """The deploy page tabs that show ``version``'s minor: "latest" for the top row, "esr" for
    the newest row whose Support ends cell says EXTENDED. None if the minor has no row."""
    rows = table_rows(server_releases)
    row = next((r for r in rows if r["line"] == version.line), None)
    if row is None:
        return None
    esr = next((r for r in rows if len(r["cells"]) == 3 and "EXTENDED" in r["cells"][2]), None)
    return [tab for tab, chosen in (("latest", rows[0]), ("esr", esr)) if chosen is row]


def kind_name(tabs: list[str]) -> str:
    names = {"latest": "latest feature release", "esr": "current ESR"}
    return " and ".join(names[t] for t in tabs) or "older supported minor"


# ── Commits: what needs a bullet, what is covered elsewhere, what is left out ───────

def _core_title(title: str) -> str:
    while PR_IN_TITLE.search(title):
        title = PR_IN_TITLE.sub("", title)
    return title.strip()


def is_product_file(path: str) -> bool:
    return not (path.startswith(NON_PRODUCT_PREFIXES) or any(part in f"/{path}" for part in NON_PRODUCT_PARTS)
                or path.endswith(NON_PRODUCT_SUFFIXES))


def revert_pairs(commits: list[dict]) -> set[str]:
    """SHAs of reverts and the commits they revert, when both are in the range."""
    by_title = {_core_title(c["title"]): c["sha"] for c in commits}
    shas = {c["sha"] for c in commits}
    paired = set()
    for commit in commits:
        match = REVERT.match(_core_title(commit["title"]))
        if not match:
            continue
        target = by_title.get(_core_title(match.group(1)))
        reverted = REVERTED_SHA.search(commit.get("message", ""))
        if not target and reverted:
            target = next((s for s in shas if s.startswith(reverted.group(1))), None)
        if target:
            paired |= {commit["sha"], target}
    return paired


def skip_reason(commit: dict, go_changed: bool, plugins_changed: bool) -> str | None:
    """Why ``commit`` gets no bullet of its own, from its title and files alone; None if it may."""
    title, files = commit["title"], commit.get("files") or []
    product = [f for f in files if is_product_file(f)]
    if VERSION_BUMP.match(title):
        return "version bump"
    if go_changed and (BUILDENV_DOCKERFILE in files or GO_VERSION_FILE in files or GO_BUMP.search(title)):
        return "Go update: in the Go runtime line"
    if PLUGIN_BUMP.search(title) and set(product) <= {PLUGIN_MAKEFILE}:
        return "plugin update: in the pre-packaged plugin lines" if plugins_changed else "plugin update, undone in this range"
    if TOOLING_TITLE.search(title) or (files and set(product) <= {PLUGIN_MAKEFILE}):
        return "CI, test, e2e, lint or build tooling only"
    return None


def pr_number(commit: dict) -> int | None:
    match = PR_IN_TITLE.search(commit["title"])
    return int(match.group(1)) if match else None


# ── Release notes into bullets ──────────────────────────────────────────────────────

def polish(text: str) -> str:
    """A note as a changelog bullet: no ticket or PR links, double backticks, MDX-safe, one period."""
    gc = _changelog_module()
    text = re.sub(r"\[(?:MM|SEC)-\d+\]\([^)]*\)", "", text or "")
    text = re.sub(r"\(?https://github\.com/[\w.-]+/[\w.-]+/(?:pull|issues)/\d+\)?", "", text)
    text = re.sub(r"\(?\b(?:MM|SEC)-\d+\b\)?:?", "", text)
    text = re.sub(r"\(#\d+\)|(?<![\w&])#\d+\b", "", text)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"(?<!`)`([^`\n]+)`(?!`)", r"``\1``", text)
    text = re.sub(r"\s+([.,;:!?])", r"\1", " ".join(text.split())).strip(" -")
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    if not text.endswith((".", "!", "?", ":")):
        text += "."
    return gc.escape_mdx_unsafe(text)


def _note_items(text: str) -> list[str]:
    """A release note's lines as items: a list marker, or a line ending a sentence followed by
    one starting with a capital, starts a new item; any other line continues the one before."""
    items = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or CHECKER_LINE.match(line):
            continue
        marked = re.match(r"^[-*]\s+", line)
        line = line[marked.end():] if marked else line
        if items and not marked and not (re.search(r"[.!?)]$", items[-1]) and line[:1].isupper()):
            items[-1] += " " + line
        else:
            items.append(line)
    return items


def note_bullets(body: str) -> list[str]:
    """A PR's release note as bullets, read with PR 39380's rules. Lines the config checker
    adds and ``Docs:`` lines are dropped; an "Also fixed ..." sentence is a bullet of its own."""
    gc = _changelog_module()
    bullets = []
    for note in gc.extract_release_notes(body or "") or []:
        text, _ = gc.split_docs_line(note)
        for item in _note_items(text):
            bullets += [polish(part) for part in re.split(r"(?<=[.!?])\s+Also (?=[a-z])", item)]
    return [b for b in bullets if b]


WRITE_SYSTEM = """You write one Mattermost server changelog bullet for a dot release, from a pull request.

Reply with JSON only: {"bullet": "..."}
- One plain sentence in the past tense that starts with "Fixed an issue where", "Updated", "Added" or "Improved".
- Bold UI names (for example **System Console** or **Recent Mentions**). Put configuration settings and code in double backticks, like ``ServiceSettings.SiteURL``.
- No ticket numbers, PR numbers, links or author names. Say what changed for admins or users, not how the code changed.
"""

SECURITY_SYSTEM = WRITE_SYSTEM + """- This is a security fix. Keep it vague: name the area that changed and never describe the
  vulnerability, how it could be exploited, or who could exploit it. It may also start with
  "Fixed an issue with". Examples: "Updated OAuth application management and authorization
  endpoint handling." or "Fixed an issue with user profile update handling."
"""


def write_bullet(claude, pr: dict, security: bool) -> tuple[str | None, str | None]:
    """(the bullet Claude wrote, why there is none)."""
    if claude is None:
        return None, "ANTHROPIC_API_KEY is not set"
    body = re.sub(r"<!--.*?-->", "", pr.get("body") or "", flags=re.DOTALL).strip()[:4000]
    prompt = f"Title: {_core_title(pr.get('title', ''))}\n\nDescription:\n{body or '(empty)'}"
    try:
        answer = claude.ask_json(SECURITY_SYSTEM if security else WRITE_SYSTEM, prompt, max_tokens=400)
    except Exception as err:  # noqa: BLE001 - any failure leaves a TODO, never a guess
        return None, f"Claude could not write it: {err}"
    bullet = polish(str((answer or {}).get("bullet", "")))
    if not bullet.startswith(SECURITY_STARTS if security else WRITTEN_STARTS):
        return None, f"Claude's bullet does not start the changelog way: {bullet!r}"
    return bullet, None


# ── One version's release ───────────────────────────────────────────────────────────

@dataclass
class Change:
    text: str
    kind: str = "fix"  # "fix", or "functional" / "database" for the closing line's list
    source: str = ""  # "#38634"
    url: str = ""
    written: bool = False  # Claude wrote it: the PR had no release note
    security: bool = False
    breaking: bool = False  # a strong signal: an existing breaking-change label, or a removal config-change-checker found
    maybe_breaking: list = field(default_factory=list)  # weak signals (release-note wording), for a person to confirm


@dataclass
class Release:
    version: Version
    tabs: list = field(default_factory=list)
    date: str = ""
    date_source: str = ""
    severity: str | None = None  # None: not given, so <SEVERITY>; "none": no security fixes
    go: tuple | None = None
    plugins: list = field(default_factory=list)
    changes: list = field(default_factory=list)
    skipped: list = field(default_factory=list)  # (source, title, reason)
    checksums: dict = field(default_factory=dict)  # edition -> SHA-256 or None
    commit_range: str = ""

    @property
    def previous(self) -> Version:
        return Version(self.version.major, self.version.minor, self.version.patch - 1)


def plugin_name(package: str, changelogs: list[str]) -> str:
    """The name the changelog gives the plugin most often (the newest on a tie), else the usual one."""
    pattern = rf"Pre-packaged (.+?) plugin version \[v[^\]]+\]\(https://github\.com/mattermost/{re.escape(package)}/"
    names = [name for text in changelogs for name in re.findall(pattern, text or "")]
    if not names:
        return plugin_display_name(package)
    counts = Counter(names)
    return max(counts, key=lambda name: (counts[name], -names.index(name)))


def go_version(gh, ref: str) -> tuple[str | None, str]:
    """(the Go version a tag builds with, a note when the two places that say so disagree).

    ``server/.go-version`` is what the build uses; ``Dockerfile.buildenv`` was left behind on
    some release branches (release-10.11 said 1.24.5 while building with 1.25.8).
    """
    pinned = (gh.file(REPO, GO_VERSION_FILE, ref) or "").strip() or None
    image = go_version_from_buildenv(gh.file(REPO, BUILDENV_DOCKERFILE, ref) or "")
    image = image.removeprefix("go") if image else None
    note = ""
    if pinned and image and pinned != image:
        note = f"{ref}: {GO_VERSION_FILE} says {pinned}, {BUILDENV_DOCKERFILE} says {image}; used {pinned}"
    return pinned or image, note


def _security(labels: set, jira: set) -> bool:
    return bool({label.lower() for label in labels | jira} & SECURITY_LABELS)


def _config_changed(gh, commit: dict) -> bool:
    if CONFIG_GO not in commit.get("files", []) or not commit.get("parents"):
        return False
    before = _scan_struct_fields(gh.file(REPO, CONFIG_GO, commit["parents"][0]) or "")
    after = _scan_struct_fields(gh.file(REPO, CONFIG_GO, commit["sha"]) or "")
    return before != after


def gather(gh, release: Release, changelogs: list[str], claude, fetch, jira_labels, result: Result) -> None:
    """Fill ``release`` from the tags: Go and plugin lines, bullets, and what was left out."""
    version, previous = release.version, release.previous
    tag, previous_tag = version.tag, previous.tag
    tag_commit = gh.commit(REPO, tag)
    release.commit_range = (f"`release-{version.major}.{version.minor}` from `{previous_tag}` (not included) "
                            f"to tag `{tag}` (`{tag_commit['sha'][:10]}`)")
    if not release.date:
        release.date, release.date_source = tag_commit["date"][:10], f"the commit date of tag {tag}"

    (old_go, old_note), (new_go, new_note) = go_version(gh, previous_tag), go_version(gh, tag)
    result.notes += [n for n in (old_note, new_note) if n]
    if not old_go or not new_go:
        result.todo(f"{version}: no Go version in {GO_VERSION_FILE} or {BUILDENV_DOCKERFILE} at "
                    f"{previous_tag if not old_go else tag}")
    elif old_go != new_go:
        release.go = (old_go, new_go)

    old_plugins = plugin_packages(gh.file(REPO, PLUGIN_MAKEFILE, previous_tag) or "")
    new_plugins = plugin_packages(gh.file(REPO, PLUGIN_MAKEFILE, tag) or "")
    for package in sorted(new_plugins):
        plugin_version = new_plugins[package]
        if old_plugins.get(package) == plugin_version:
            continue
        if fetch(f"https://github.com/mattermost/{package}/releases/tag/{plugin_version}", "HEAD")[0] != 200:
            result.todo(f"{version}: the changelog links {package} {plugin_version}, but its GitHub release page "
                        "is not public (not found)")
        release.plugins.append(f"Pre-packaged {plugin_name(package, changelogs)} plugin version "
                               f"{plugin_version_link(package, plugin_version)}.")
    for package in sorted(set(old_plugins) - set(new_plugins)):
        release.plugins.append(f"Removed the pre-packaged {plugin_name(package, changelogs)} plugin; "
                               "it is no longer included with the server.")

    listed = gh.commits_between(REPO, previous_tag, tag)
    commits = []
    for item in listed:
        detail = gh.commit(REPO, item["sha"])
        commits.append({**detail, "title": detail["message"].splitlines()[0].strip()})
    reverted = revert_pairs(commits)
    seen = set()
    for commit in commits:
        number = pr_number(commit)
        source = f"#{number}" if number else commit["sha"][:10]
        title = _core_title(commit["title"])
        if commit["sha"] in reverted:
            release.skipped.append((source, title, "revert pair that cancels out"))
            continue
        reason = skip_reason(commit, release.go is not None, bool(release.plugins))
        if reason:
            release.skipped.append((source, title, reason))
            continue
        pr = gh.pull(REPO, number) if number else None
        if pr is None:
            pulls = gh.commit_pulls(REPO, commit["sha"])
            pr = pulls[0] if pulls else None
        if pr is None:
            result.todo(f"{version}: commit {commit['sha'][:10]} ({title}) has no PR to read a release note from")
            continue
        cherry = _changelog_module().cherry_picked_from(pr.get("title", ""))
        original = gh.pull(REPO, cherry) if cherry and cherry != pr["number"] else None
        original = original or pr
        source = f"#{original['number']}"
        if TOOLING_TITLE.search(_core_title(original.get("title", ""))):
            release.skipped.append((source, _core_title(original.get("title", "")), "CI, test, e2e, lint or build tooling only"))
            continue
        if original["number"] in seen:
            release.skipped.append((f"#{pr['number']}", title, f"same change as {source}"))
            continue
        seen.add(original["number"])
        labels = {l["name"] for l in pr.get("labels", [])} | {l["name"] for l in original.get("labels", [])}
        keys = jira_keys(original.get("title", ""), (original.get("head") or {}).get("ref", ""), original.get("body") or "")
        jira = (jira_labels(keys) or set()) if keys and jira_labels else set()
        security = _security(labels, jira)
        found = breaking_signals(labels, original.get("body") or "", jira)
        breaking = any(strong for _, strong in found)
        maybe = [] if breaking else [reason for reason, _ in found]
        author = (original.get("user") or {}).get("login", "")
        bullets = note_bullets(original.get("body")) or note_bullets(pr.get("body"))
        dependency = author in DEPENDENCY_AUTHORS or bool(DEPENDENCY_TITLE.search(_core_title(original.get("title", ""))))
        if dependency and not bullets:
            release.skipped.append((source, title, "dependency update with no release note"))
            continue
        written = False
        if not bullets:
            bullet, problem = write_bullet(claude, original, security)
            if problem:
                bullet = result.todo(f"{version}: no bullet for {source} ({_core_title(original.get('title', ''))}): {problem}")
            bullets, written = [bullet], bullet and not problem
        kind = "fix"
        if any(f.startswith(MIGRATIONS_DIR) and f.endswith(".up.sql") for f in commit.get("files", [])):
            kind = "database"
        elif _config_changed(gh, commit):
            kind = "functional"
        for text in bullets:
            release.changes.append(Change(text, kind, source, original.get("html_url", ""), bool(written), security, breaking,
                                          maybe))


# ── Severity ────────────────────────────────────────────────────────────────────────

LEVEL = r"(?:low|medium|high|critical)"
SEVERITY_VALUE = re.compile(rf"(?i)^(?:none|{LEVEL}(?: to {LEVEL})?(?: fix)?)$")


def parse_severities(raw: str, versions: list[Version], result: Result) -> dict:
    """``v12.1.1=Medium, v11.7.15=Low to Medium``, or one value for every version.

    ``none`` drops the security line; a trailing ``fix`` means a single fix.
    """
    found = {}
    raw = (raw or "").strip()
    if not raw:
        return found
    if "=" not in raw and ":" not in raw:
        pairs = [(v.tag, raw) for v in versions]
    else:
        pairs = []
        for part in re.split(r"[;,\n]+", raw):
            if part.strip():
                key, _, value = re.split(r"([=:])", part, maxsplit=1) if re.search(r"[=:]", part) else (part, "", "")
                pairs.append((key.strip(), value.strip()))
    for key, value in pairs:
        try:
            tag = Version.parse(key).tag
        except ValueError:
            result.todo(f"severity input: {key!r} is not a version")
            continue
        if not SEVERITY_VALUE.match(value):
            result.todo(f"severity input for {tag}: {value!r} is not Low, Medium, High, Critical, a range such as "
                        "'Low to Medium', 'none', or one of those followed by 'fix'")
            continue
        words = value.split()
        found[tag] = " ".join(w.lower() if w.lower() in ("to", "fix", "none") else w.capitalize() for w in words)
    return found


def security_line(version: Version, severity: str | None) -> str | None:
    if severity == "none":
        return None
    value = severity or SEVERITY_PLACEHOLDER
    if value.endswith(" fix"):
        fixes = f"a {value.removesuffix(' fix')} severity level security fix"
    else:
        fixes = f"{value} severity level security fixes"
    return templates.render("dot-release-security.md", {"version": version.plain, "fixes": fixes}).strip()


# ── The changelog entry ─────────────────────────────────────────────────────────────

def entry_lines(release: Release) -> list[str]:
    v = release.version
    lines = [f"- **{v.plain}, released {release.date}**"]
    security = security_line(v, release.severity)
    if security:
        lines.append(f"  - {security}")
    if release.go:
        lines.append(f"  - Go runtime was updated from {release.go[0]} to {release.go[1]}.")
    lines += [f"  - {text}" for text in release.plugins]
    fixes = [c for c in release.changes if c.kind == "fix"]
    fixes = [c for c in fixes if not c.text.startswith("Fixed")] + [c for c in fixes if c.text.startswith("Fixed")]
    lines += [f"  - {c.text}" for c in fixes]
    functional = [c for c in release.changes if c.kind == "functional"]
    database = [c for c in release.changes if c.kind == "database"]
    if not functional and not database:
        lines.append(f"  - Mattermost v{v.plain} {CLOSING_NONE}")
    for title, items in (("functional", functional), ("database", database)):
        if items:
            lines.append(f"  - Mattermost v{v.plain} contains the following {title} changes:")
            lines += [f"     - {c.text}" for c in items]
    return lines


def _section(lines: list[str], version: Version) -> tuple[int, int] | None:
    heading = re.compile(rf"^## Release {re.escape(version.short)} - \[")
    start = next((i for i, line in enumerate(lines) if heading.match(line)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    return start, end


def _callout_after(lines: list[str], index: int, end: int) -> tuple[int, int] | None:
    """The ``<Attention>`` block holding **Breaking Changes** at the first non-blank line after ``index``."""
    first = next((i for i in range(index + 1, end) if lines[i].strip()), None)
    if first is None or lines[first].strip() != "<Attention>":
        return None
    close = next((i for i in range(first, end) if lines[i].strip() == "</Attention>"), None)
    if close is None or not any("**Breaking Changes**" in lines[i] for i in range(first, close)):
        return None
    return first, close


def update_changelog(content: str, release: Release, result: Result) -> str:
    """The new bullet in the ``## Release vX.Y`` section; the heading never changes."""
    v = release.version
    lines = content.split("\n")
    section = _section(lines, v)
    if section is None:
        result.todo(f"{changelog_path(v)} has no '## Release {v.short} - [...]' section")
        return content
    start, end = section
    if any(DOT_BULLET.match(line) and tuple(map(int, DOT_BULLET.match(line).groups())) == (v.major, v.minor, v.patch)
           for line in lines[start:end]):
        result.notes.append(f"{changelog_path(v)} already has {v.plain}; left as is.")
        return content
    new = entry_lines(release)
    breaking = [c for c in release.changes if c.breaking]
    day = next((i for i in range(start, end) if RELEASE_DAY.match(lines[i])), None)
    if day is not None:
        callout = _callout_after(lines, start, day)
        moved = []
        if callout:
            first, close = callout
            moved = [""] + lines[first:close + 1]
            gap = close + 1
            while gap < day and not lines[gap].strip():
                gap += 1
            del lines[first:gap]
            day -= gap - first
        stub = [f"- **{v.major}.{v.minor}.0, released {RELEASE_DAY.match(lines[day]).group(1)}**",
                f"  - Original {v.major}.{v.minor}.0 release."]
        lines[day:day + 1] = new + stub + moved
    else:
        bullets = [i for i in range(start, end) if DOT_BULLET.match(lines[i])]
        if not bullets:
            result.todo(f"the {v.short} section of {changelog_path(v)} has neither a Release day line nor dot release bullets")
            return content
        later = [i for i in bullets if tuple(map(int, DOT_BULLET.match(lines[i]).groups())) < (v.major, v.minor, v.patch)]
        at = later[0] if later else bullets[-1] + 1
        lines[at:at] = new
    if breaking:
        lines = _add_breaking(lines, v, breaking)
    return "\n".join(lines)


def _add_breaking(lines: list[str], version: Version, changes: list[Change]) -> list[str]:
    """A **Breaking Changes** callout right under the heading, or more items in the one there."""
    start, end = _section(lines, version)
    items = [f" - {version.tag}: {c.text}" for c in changes]
    callout = _callout_after(lines, start, end)
    if callout:
        close = callout[1]
        at = close
        while at > callout[0] and not lines[at - 1].strip():
            at -= 1
        lines[at:at] = items
        return lines
    block = ["<Attention>", "", "**Breaking Changes**", *items, "", "</Attention>", ""]
    at = start + 1
    while at < end and not lines[at].strip():
        at += 1
    lines[at:at] = block
    return lines


def changelog_listed(content: str, version: Version) -> Version | None:
    """The newest release the changelog lists for ``version``'s minor: a dot bullet, else X.Y.0."""
    lines = (content or "").split("\n")
    section = _section(lines, version)
    if section is None:
        return None
    for line in lines[section[0]:section[1]]:
        match = DOT_BULLET.match(line)
        if match:
            return Version(*map(int, match.groups()))
        if RELEASE_DAY.match(line):
            return Version(version.major, version.minor, 0)
    return None


def set_severity(content: str, version: Version, severity: str) -> str:
    """The security line of an entry that still has <SEVERITY>, with the given severity."""
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if line.startswith(f"  - Mattermost v{version.plain} contains ") and SEVERITY_MARK.search(line):
            replacement = security_line(version, severity)
            if replacement:
                lines[i] = f"  - {replacement}"
            else:
                del lines[i]
            break
    return "\n".join(lines)


# ── Deploy pages, server releases row, version archive ──────────────────────────────

def _tab_block(content: str, tab: str) -> tuple[int, int] | None:
    start = content.find(f'<TabItem value="{tab}"')
    end = content.find("</TabItem>", start)
    return (start, end) if start >= 0 and end >= 0 else None


def tab_version(content: str, tab: str) -> Version | None:
    block = _tab_block(content or "", tab)
    match = release_docs_pr.WGET.search(content[block[0]:block[1]]) if block else None
    return Version.parse(match.group(1)) if match else None


def update_deploy(content: str, version: Version, tabs: list[str], path: str, result: Result) -> str:
    """Both version strings in each tab that shows ``version``'s minor. Never lowered."""
    for tab in tabs:
        block = _tab_block(content, tab)
        listed = tab_version(content, tab)
        if block is None or listed is None:
            result.todo(f"{path} has no download link in a '{tab}' tab")
            continue
        if listed >= version:
            continue
        start, end = block
        content = content[:start] + _swap(content[start:end], listed, version) + content[end:]
    return content


def update_server_row(content: str, version: Version, result: Result) -> str:
    """In the vX.Y row, the download, GitHub SBOM and enterprise SBOM links for X.Y.Z; nothing else."""
    lines = content.split("\n")
    row = next((r for r in table_rows(content) if r["line"] == version.line), None)
    if row is None:
        result.todo(f"{SERVER_RELEASES} has no {version.short} row")
        return content
    old = row["listed"]
    if old >= version:
        return content
    line = row["text"]
    links = (
        (f"releases.mattermost.com/{old.plain}/mattermost-{old.plain}-linux-amd64",
         f"releases.mattermost.com/{version.plain}/mattermost-{version.plain}-linux-amd64"),
        (f"releases/download/{old.tag}/sbom-mattermost-{old.tag}.json",
         f"releases/download/{version.tag}/sbom-mattermost-{version.tag}.json"),
        (f"releases.mattermost.com/{old.plain}/sbom-enterprise-{old.tag}.json",
         f"releases.mattermost.com/{version.plain}/sbom-enterprise-{version.tag}.json"),
    )
    for before, after in links:
        if line.count(before) != 1:
            result.todo(f"the {version.short} row in {SERVER_RELEASES} does not have exactly one link with {before}")
            return content
        line = line.replace(before, after)
    lines[row["index"]] = line
    return "\n".join(lines)


def _archive_block(lines: list[str], tab: str, version: Version) -> tuple[int, int, Version] | None:
    start = next((i for i, line in enumerate(lines) if f'<TabItem value="{tab}"' in line), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("</TabItem>")), len(lines))
    headers = [(i, Version(*map(int, m.groups()))) for i in range(start + 1, end) if (m := ARCHIVE_HEADER.match(lines[i]))]
    for n, (index, listed) in enumerate(headers):
        if listed.line == version.line:
            return index, headers[n + 1][0] if n + 1 < len(headers) else end, listed
    return None


def archive_listed(content: str, tab: str, version: Version) -> Version | None:
    block = _archive_block((content or "").split("\n"), tab, version)
    return block[2] if block else None


def update_archive(content: str, version: Version, checksums: dict, result: Result) -> str:
    """Each tab's entry for the minor, edited in place: every earlier version becomes X.Y.Z and the
    SHA-256 is the published one, or TBD. The View Changelog anchor and ESR marker stay."""
    lines = content.split("\n")
    for edition, _, tab in version_archive.EDITIONS:
        block = _archive_block(lines, tab, version)
        if block is None:
            result.todo(f"{ARCHIVE} has no {version.short} entry in the {tab} tab")
            continue
        start, end, listed = block
        if listed > version:
            continue
        text = _swap("\n".join(lines[start:end]), listed, version) if listed < version else "\n".join(lines[start:end])
        text = SHA_LINE.sub(lambda m: m.group(1) + (checksums.get(edition) or TBD) + m.group(3), text, count=1)
        lines[start:end] = text.split("\n")
    return "\n".join(lines)


def archive_tbd(content: str, version: Version) -> list[str]:
    """The editions whose entry for ``version`` still has a TBD checksum."""
    lines = (content or "").split("\n")
    missing = []
    for edition, _, tab in version_archive.EDITIONS:
        block = _archive_block(lines, tab, version)
        if block and block[2] == version and f"SHA-256 Checksum: `{TBD}`" in "\n".join(lines[block[0]:block[1]]):
            missing.append(edition)
    return missing


def checksums_for(version: Version, fetch, attempts: int, interval: float, sleep=None) -> dict:
    """The published SHA-256 per edition, waiting as the version archive task does. Never computed."""
    kwargs = {"sleep": sleep} if sleep else {}
    facts = version_archive.wait_for_facts(version, _sha_only(fetch), attempts, interval, **kwargs)
    return {edition: facts[edition]["sha256"] for edition in EDITIONS}


def _sha_only(fetch):
    """Only the .sha256 files are needed; the tarballs, signatures and SBOMs are not fetched."""
    def wrapped(url, method="GET"):
        return fetch(url, method) if url.endswith(".sha256") else (200, "")
    return wrapped


# ── Consistency: before each commit ─────────────────────────────────────────────────

def mdx_issues(text: str, table: bool = False) -> Counter:
    """Problems that break MDX or the tables: unmatched JSX tags, callouts without blank lines
    around them, and server releases rows without three cells."""
    issues = Counter()
    lines = (text or "").split("\n")
    depth = Counter()
    for i, line in enumerate(lines):
        match = JSX_LINE.match(line.strip()) if line.startswith("<") else None
        if match:
            closing, tag = match.group(1) == "/", match.group(2)
            depth[tag] += -1 if closing else 1
            if depth[tag] < 0:
                issues[f"</{tag}> without an opening tag"] += 1
                depth[tag] = 0
            if tag in CALLOUTS:
                for neighbour in (i - 1, i + 1):
                    if 0 <= neighbour < len(lines) and lines[neighbour].strip() and not JSX_LINE.match(lines[neighbour].strip()):
                        issues[f"no blank line around <{'/' if closing else ''}{tag}>"] += 1
        if table and ROW.match(line) and len(re.split(r"(?<!\\)\|", line.strip())[1:-1]) != 3:
            issues["a server releases row without three cells"] += 1
    for tag, open_count in depth.items():
        if open_count:
            issues[f"<{tag}> without a closing tag"] += open_count
    return issues


def consistency(files: dict, base: dict, releases: list[Release]) -> tuple[list[str], list[str]]:
    """(problems with the versions in this PR, other minors already out of date). ``files`` and
    ``base`` map each path to its text after and before this run's edits."""
    problems, others = [], []
    for path, text in files.items():
        new = mdx_issues(text, path == SERVER_RELEASES) - mdx_issues(base.get(path) or "", path == SERVER_RELEASES)
        problems += [f"{path}: {issue}" for issue in new.elements()]

    server, archive = files.get(SERVER_RELEASES) or "", files.get(ARCHIVE) or ""
    old_server, old_archive = base.get(SERVER_RELEASES) or "", base.get(ARCHIVE) or ""
    ours = {r.version.line: r for r in releases}
    for release in releases:
        v, old = release.version, None
        row_before = next((r for r in table_rows(old_server) if r["line"] == v.line), None)
        row_after = next((r for r in table_rows(server) if r["line"] == v.line), None)
        if row_before and row_after and row_before["listed"] < v:
            old = row_before["listed"]
            if _count(row_after["text"], old) or _count(row_after["text"], v) != _count(row_before["text"], old):
                problems.append(f"{SERVER_RELEASES}: the {v.short} row still has {old.plain} or not every link moved to {v.plain}")
        for edition, _, tab in version_archive.EDITIONS:
            before = _archive_block(old_archive.split("\n"), tab, v)
            after = _archive_block(archive.split("\n"), tab, v)
            if before and after and before[2] < v:
                was = "\n".join(old_archive.split("\n")[before[0]:before[1]])
                now = "\n".join(archive.split("\n")[after[0]:after[1]])
                if _count(now, before[2]) or _count(now, v) != _count(was, before[2]):
                    problems.append(f"{ARCHIVE}: the {tab} {v.short} entry still has {before[2].plain} "
                                    f"or {v.plain} appears an unexpected number of times")
        path = changelog_path(v)
        bullets = [line for line in (files.get(path) or "").split("\n") if line.startswith(f"- **{v.plain}, released ")]
        if len(bullets) != 1:
            problems.append(f"{path}: {len(bullets)} entries for {v.plain}, expected one")
        for page in DEPLOY_PAGES:
            for tab in release.tabs:
                listed = tab_version(files.get(page) or "", tab)
                if listed != v and not (listed and listed > v):
                    problems.append(f"{page}: the {tab} tab downloads {listed.plain if listed else 'nothing'}, not {v.plain}")

    changelogs = {path: text for path, text in files.items() if path.startswith(f"{DOCS_DIR}/mattermost-v")}
    for row in table_rows(server):
        line_version = Version(*row["line"], 0)
        listed = {"server releases": row["listed"]}
        for edition, _, tab in version_archive.EDITIONS:
            listed[f"version archive ({EDITIONS[edition]})"] = archive_listed(archive, tab, line_version)
        page = changelog_path(line_version)
        if page in changelogs:
            listed["changelog"] = changelog_listed(changelogs[page], line_version)
        values = {k: v for k, v in listed.items() if v is not None}
        if len(set(values.values())) > 1:
            where = ", ".join(f"{k} {v.plain}" for k, v in values.items())
            (problems if row["line"] in ours else others).append(f"{line_version.short} does not agree: {where}")
    rows = table_rows(server)
    if rows:
        esr = next((r for r in rows if len(r["cells"]) == 3 and "EXTENDED" in r["cells"][2]), None)
        for page in DEPLOY_PAGES:
            for tab, row in (("latest", rows[0]), ("esr", esr)):
                listed = tab_version(files.get(page) or "", tab)
                if row and listed and listed != row["listed"]:
                    message = f"{page}: the {tab} tab downloads {listed.plain}, the server releases row lists {row['listed'].plain}"
                    (problems if row["line"] in ours else others).append(message)
    return problems, others


# ── The PR: one for the dot releases shipped together ───────────────────────────────

def read_state(body: str) -> dict:
    match = re.search(rf"<!-- {STATE_MARKER}: (.*?) -->", body or "", re.DOTALL)
    try:
        state = json.loads(match.group(1)) if match else {}
    except json.JSONDecodeError:
        state = {}
    state.setdefault("order", [])
    state.setdefault("versions", {})
    return state


def versions_in_title(title: str) -> list[str]:
    return re.findall(r"v\d+\.\d+\.\d+", title or "")


def release_state(release: Release) -> dict:
    return {
        "kind": kind_name(release.tabs), "tabs": release.tabs, "date": release.date, "date_source": release.date_source,
        "severity": release.severity, "checksums": release.checksums, "range": release.commit_range,
        "written": [[c.text, c.source, c.url] for c in release.changes if c.written],
        "security": [[c.text, c.source, c.url] for c in release.changes if c.security],
        "breaking": [[c.text, c.source, c.url] for c in release.changes if c.breaking],
        "maybe_breaking": [[c.text, c.source, c.url, "; ".join(c.maybe_breaking)] for c in release.changes if c.maybe_breaking],
        "skipped": [list(s) for s in release.skipped],
    }


def _link(source: str, url: str) -> str:
    return f"[{source}]({url})" if url else source


def files_table(state: dict) -> str:
    order = [Version.parse(t) for t in state["order"]]
    info = state["versions"]
    rows = []
    for page in DEPLOY_PAGES:
        parts, unchanged = [], []
        for v in order:
            tabs = info[v.tag]["tabs"]
            if tabs:
                parts.append("; ".join(f"{'Latest release' if t == 'latest' else 'Current ESR'} → {v.plain}" for t in tabs))
            else:
                unchanged.append(f"{v.short} is an older supported minor")
        text = "; ".join(parts) or "No change"
        if unchanged:
            text += f" ({', '.join(unchanged)}, so no change for it)"
        rows.append((page, text))
    shorts = ", ".join(v.short for v in order)
    rows.append((SERVER_RELEASES, f"Download and SBOM links for the {shorts} row{'s' if len(order) > 1 else ''}"))
    for path in sorted({changelog_path(v) for v in order}, reverse=True):
        entries = [v.plain for v in order if changelog_path(v) == path]
        rows.append((path, f"New {', '.join(entries)} entr{'ies' if len(entries) > 1 else 'y'}"))
    rows.append((ARCHIVE, f"Enterprise and Team entries for {shorts}, edited in place"))
    lines = ["| File | Change |", "|---|---|"]
    lines += [f"| `{path.removeprefix('docs/main/')}` | {text} |" for path, text in rows]
    return "\n".join(lines)


def details(state: dict, files: dict, others: list[str], branch: str) -> str:
    order = [Version.parse(t) for t in state["order"]]
    info = state["versions"]
    needs = []
    for v in order:
        s = info[v.tag]
        needs.append(f"- **{v.tag} release date:** {s['date']}, {s['date_source']}.")
        changelog = files.get(changelog_path(v)) or ""
        entry = _entry_text(changelog, v)
        if SEVERITY_MARK.search(entry):
            needs.append(f"- [ ] **{v.tag} severity:** not given, so the changelog says `<SEVERITY>`. Rerun with the "
                         "`severity` input (Low, Medium, High, a range such as `Low to Medium`, or `none`) or edit it.")
        elif s.get("severity"):
            needs.append(f"- **{v.tag} severity:** {s['severity']}, from the `severity` input.")
        for edition in archive_tbd(files.get(ARCHIVE), v):
            needs.append(f"- [ ] **{v.tag} {EDITIONS[edition]} SHA-256:** TBD, the `.sha256` file is not published yet. "
                         "Rerun the workflow once it is.")
        for text, source, url in s["written"]:
            needs.append(f"- **{v.tag} bullet written by Claude** (the PR has no release note), from {_link(source, url)}: {text}")
        for text, source, url in s.get("breaking", []):
            needs.append(f"- **{v.tag} breaking change callout**, from {_link(source, url)}: {text}")
        for text, source, url, why in s.get("maybe_breaking", []):
            needs.append(f"- [ ] **{v.tag} possible breaking change** (no callout added), from {_link(source, url)}: {text} "
                         f"Signals: {why}. Add a Breaking Changes callout if admins must act.")
    needs += [f"- [ ] **Consistency check:** {p}" for p in state.get("problems", [])]
    sections = ["**Needs confirming**", "", *needs]
    security = [f"- {v.tag}, {_link(source, url)}: {text}" for v in order for text, source, url in info[v.tag]["security"]]
    if security:
        sections += ["", "**Security fixes to review** (the wording must not describe the vulnerability)", "", *security]
    if others:
        sections += ["", "**Other minors already out of date** (reported, not fixed here)", "", *[f"- {o}" for o in others]]
    skipped = []
    for v in order:
        for source, title, reason in info[v.tag]["skipped"]:
            skipped.append(f"- {v.tag}: {source} {title}: {reason}")
    if skipped:
        sections += ["", "**Left out**", "", *skipped]
    sections += ["", "**Source**", ""]
    sections += [f"- {v.tag}: commits on {info[v.tag]['range']}. {v.short} is the {info[v.tag]['kind']}." for v in order]
    url = run_url()
    made_by = f"the [release docs workflow]({url})" if url else "the release docs workflow"
    sections += ["", f"Opened as a draft by {made_by} on `{branch}`. Dot releases shipped together go in this PR; "
                     "commits from people are kept, and new versions are added on top of them."]
    return "\n".join(sections)


def _entry_text(changelog: str, version: Version) -> str:
    lines = (changelog or "").split("\n")
    start = next((i for i, line in enumerate(lines) if line.startswith(f"- **{version.plain}, released ")), None)
    if start is None:
        return ""
    end = next((i for i in range(start + 1, len(lines)) if not lines[i].startswith(" ")), len(lines))
    return "\n".join(lines[start:end])


def pr_body(state: dict, files: dict, others: list[str], branch: str) -> str:
    text = templates.render("dot-release-pr-body.md", {
        "versions": ", ".join(state["order"]),
        "files": files_table(state),
        "details": details(state, files, others, branch),
    })
    return text + f"\n<!-- {STATE_MARKER}: {json.dumps(state, sort_keys=True)} -->\n"


def title_for(state: dict) -> str:
    return f"Add dot release docs for server {', '.join(state['order'])}"


def locate(gh, base: str) -> tuple[Target | None, str]:
    """The open dot release docs PR, if there is one, and a note about any others."""
    found = []
    for branch in gh.branches_with_prefix(REPO, BRANCH_PREFIX):
        for pr in gh.pulls_for_branch(REPO, branch):
            if pr.get("state") == "open":
                found.append((pr["number"], branch, pr))
    if not found:
        return None, ""
    number, branch, pr = max(found, key=lambda item: item[0])
    note = ""
    if len(found) > 1:
        note = f"Several open dot release docs PRs; adding to the newest, #{number}."
    return Target(REPO, branch, base, branch, gh.branch_sha(REPO, branch), pr=pr), note


def new_target(gh, base: str, first: Version) -> Target:
    branch = BRANCH_PREFIX + first.tag
    target = Target(REPO, branch, base, base, gh.branch_sha(REPO, base))
    if gh.branch_sha(REPO, branch):
        pulls = gh.pulls_for_branch(REPO, branch)
        closed = next((p for p in pulls if p.get("state") != "open"), None)
        target.blocked = (f"{branch} already exists" + (f" (PR #{closed['number']} was closed)" if closed else "") +
                          "; not reusing it. Delete the branch to start again.")
    return target


def sync_awaiting(gh, pr: dict, tags: list[str]) -> str:
    """``Do Not Merge/Awaiting Next Release`` stays until no GitHub release in the PR is a pre-release."""
    labels = {label["name"] if isinstance(label, dict) else label for label in pr.get("labels", [])}
    waiting = [t for t in tags if (gh.release_by_tag(REPO, t) or {"prerelease": True}).get("prerelease")]
    if waiting:
        if AWAITING_LABEL not in labels:
            gh.add_labels(REPO, pr["number"], [AWAITING_LABEL])
        return f"{AWAITING_LABEL}: {', '.join(waiting)} still a pre-release."
    if AWAITING_LABEL in labels:
        gh.remove_label(REPO, pr["number"], AWAITING_LABEL)
        return f"Removed {AWAITING_LABEL}: every release in the PR is published."
    return "Every release in the PR is published."


def check_pr(title: str, files: dict, base: dict) -> list[str]:
    """What keeps the dot release docs PR's check failing: ``<SEVERITY>``, TBD checksums, TODO
    markers, and the consistency and MDX checks. ``files`` and ``base`` are the five files (and
    the changelogs) on the PR and on the branch it merges into."""
    problems = []
    releases = []
    for tag in versions_in_title(title):
        v = Version.parse(tag)
        releases.append(Release(v, tabs=deploy_tabs(base.get(SERVER_RELEASES) or "", v) or []))
        if SEVERITY_MARK.search(_entry_text(files.get(changelog_path(v)) or "", v)):
            problems.append(f"{tag}: the changelog still says <SEVERITY>")
        problems += [f"{tag}: the {EDITIONS[e]} SHA-256 in the version archive is TBD" for e in archive_tbd(files.get(ARCHIVE), v)]
    for path, text in files.items():
        if "TODO(release-agent)" in (text or "") and "TODO(release-agent)" not in (base.get(path) or ""):
            problems.append(f"{path} has a TODO(release-agent) marker")
    found, _ = consistency(files, base, releases)
    return problems + found


def run(gh, versions: list[Version], env: dict, claude, fetch, live: bool, jira_labels=None, sleep=None) -> tuple[Result, str, dict]:
    """Add ``versions`` to the open dot release docs PR, or open one. Returns (result, outcome,
    the files before this run's edits)."""
    result = Result(TASK, ", ".join(v.tag for v in versions), repo=REPO)
    base = gh.default_branch(REPO)
    target, note = locate(gh, base)
    if note:
        result.notes.append(note)
    state = read_state(target.pr.get("body")) if target else read_state("")
    if target and not state["order"]:
        state["order"] = versions_in_title(target.pr.get("title"))
    master = {path: gh.file(REPO, path, base) for path in (SERVER_RELEASES, ARCHIVE)}
    severities = parse_severities(env.get("SEVERITY", ""), versions, result)
    attempts, interval = int(env.get("WAIT_ATTEMPTS") or 12), float(env.get("WAIT_SECONDS") or 300)

    files, base_files = {}, {}

    def ref():
        return target.ref if target else base

    def current(path: str) -> str | None:
        if path not in files:
            files[path] = base_files[path] = gh.file(REPO, path, ref())
        return files[path]

    releases, todo = [], []
    for v in versions:
        if not v.is_dot:
            result.todo(f"{v} is a feature release: the version archive task handles it")
        elif v.tag in state["order"]:
            todo.append(("refresh", v))
        elif not gh.tag_sha(REPO, v.tag):
            result.todo(f"{v}: not tagged yet")
        elif archive_listed(master[ARCHIVE], "mattermost-enterprise", v) == v:
            result.notes.append(f"{v} is already in the version archive on {base}; skipped.")
        elif (tabs := deploy_tabs(master[SERVER_RELEASES], v)) is None:
            result.todo(f"{v}: the server releases table on {base} has no {v.short} row, so this is a feature release")
        else:
            todo.append(("add", v, tabs))
    if not target and any(item[0] == "add" for item in todo):
        target = new_target(gh, base, next(item[1] for item in todo if item[0] == "add"))
        if target.blocked:
            result.todo(target.blocked)
            return result, f"Nothing written: {target.blocked}", {}

    for item in todo:
        v = item[1]
        if item[0] == "refresh":
            _refresh(v, state, severities, files, current, fetch, attempts, interval, sleep, result)
            continue
        changelogs = [current(changelog_path(v))]
        release = Release(v, tabs=item[2], severity=severities.get(v.tag))
        if env.get("RELEASE_DATE", "").strip():
            release.date, release.date_source = env["RELEASE_DATE"].strip(), "from the release_date input"
        gather(gh, release, changelogs, claude, fetch, jira_labels, result)
        release.checksums = checksums_for(v, fetch, attempts, interval, sleep)
        for page in DEPLOY_PAGES:
            files[page] = update_deploy(current(page) or "", v, release.tabs, page, result)
        files[SERVER_RELEASES] = update_server_row(current(SERVER_RELEASES) or "", v, result)
        files[changelog_path(v)] = update_changelog(current(changelog_path(v)) or "", release, result)
        files[ARCHIVE] = update_archive(current(ARCHIVE) or "", v, release.checksums, result)
        releases.append(release)
        state["order"].append(v.tag)
        state["versions"][v.tag] = release_state(release)

    for path in [SERVER_RELEASES, ARCHIVE, *DEPLOY_PAGES]:
        current(path)
    problems, others = consistency(files, base_files, releases)
    for problem in problems:
        result.todo(f"consistency check: {problem}")
    state["problems"] = problems
    for tag in state["order"]:
        v = Version.parse(tag)
        if SEVERITY_MARK.search(_entry_text(current(changelog_path(v)) or "", v)):
            result.todo(f"{tag}: severity not given (<SEVERITY> in the changelog)")
        for edition in archive_tbd(current(ARCHIVE), v):
            result.todo(f"{tag}: the {EDITIONS[edition]} SHA-256 is TBD (its .sha256 file is not published yet)")
    result.notes += [f"Out of date already, not fixed here: {o}" for o in others]

    result.files = {p: t for p, t in files.items() if t is not None and t != base_files.get(p)}
    if not state["order"]:
        return result, "Nothing to do: no dot release to add.", base_files
    result.title, result.pr_branch = title_for(state), target.branch
    result.body = pr_body(state, files, others, target.branch)
    if not result.files:
        outcome = f"PR #{target.pr['number']} is already up to date." if target.pr else "Nothing to change."
        if live and target.pr:
            outcome += " " + sync_awaiting(gh, target.pr, state["order"])
        return result, outcome, base_files
    paths = ", ".join(f"`{p}`" for p in result.files)
    if not live:
        action = f"updated PR #{target.pr['number']}" if target.pr else f"opened a draft PR from `{target.branch}`"
        return result, f"Dry run: would have {action} in {REPO}, changing {paths}.", base_files
    message = f"{result.title}\n\n{TRAILER}: {TASK}\n"
    action, number, skipped = write(gh, target, result.files, message, result.title, result.body, LABELS)
    pr = target.pr or {"number": number, "labels": []}
    return result, (f"{action} PR {REPO}#{number}, changing {paths}.{skipped_label_note(skipped, REPO)} "
                    f"{sync_awaiting(gh, pr, state['order'])}"), base_files


def _refresh(v: Version, state: dict, severities: dict, files: dict, current, fetch, attempts, interval, sleep,
             result: Result) -> None:
    """A version already in the PR: fill in a checksum published since, or a severity given now."""
    tbd = archive_tbd(current(ARCHIVE), v)
    found = {}
    if tbd:
        published = checksums_for(v, fetch, attempts, interval, sleep)
        found = {edition: sha for edition, sha in published.items() if sha and edition in tbd}
    if found:
        lines = current(ARCHIVE).split("\n")
        for edition, _, tab in version_archive.EDITIONS:
            block = _archive_block(lines, tab, v)
            if edition in found and block and block[2] == v:
                text = "\n".join(lines[block[0]:block[1]])
                text = text.replace(f"SHA-256 Checksum: `{TBD}`", f"SHA-256 Checksum: `{found[edition]}`", 1)
                lines[block[0]:block[1]] = text.split("\n")
        files[ARCHIVE] = "\n".join(lines)
        state["versions"][v.tag]["checksums"].update(found)
        result.notes.append(f"{v}: filled in the published SHA-256 for {', '.join(EDITIONS[e] for e in found)}.")
    path = changelog_path(v)
    severity = severities.get(v.tag)
    if severity and SEVERITY_MARK.search(_entry_text(current(path) or "", v)):
        files[path] = set_severity(current(path), v, severity)
        state["versions"][v.tag]["severity"] = severity
    elif not found:
        result.notes.append(f"{v} is already in the open dot release docs PR; nothing new for it.")
