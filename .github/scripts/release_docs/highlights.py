"""Release Highlights: the month's slide in the Release Highlights deck (playbook T-0).

Replaces /release-highlights. The features are the Jira epics with the server fix version
``vX.Y (Month Year)`` and, if one is released that month, the mobile fix version
``v2.NN Mobile (Month Year)``, found through the Jira versions API. An epic in both is
listed once, as a server epic. Internal and process epics are left out by the rules in
``.github/release-docs/highlights.json``, and Claude may leave out others; each comes with
a reason in the run summary.

Each feature links to its docs page: a docs.mattermost.com URL in the epic description,
else the one docs page whose title is the feature's name, else ``[doc link TBD]``. Every
link is checked against the docs site built from this checkout, the changelog link check.
Claude writes one sentence per feature from the epic. Nothing is written to the deck.
"""

import glob
import html
import json
import os
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from changelog_release import NOT_A_FEATURE_PAGE, REDIRECTS_FILE, DocsSite, docs_urls, page_title

from .result import Result
from .versions import Version

TASK = "release-highlights"
REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = REPO_ROOT / ".github" / "release-docs" / "highlights.json"
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December")
SERVER_NAME = re.compile(r"^v(\d+)\.(\d+) \((%s) (\d{4})\)$" % "|".join(MONTHS))
MOBILE_NAME = re.compile(r"^v\d+\.\d+(?:\.\d+)? Mobile\b", re.IGNORECASE)
EPIC_FIELDS = ["summary", "description", "labels", "components"]
TBD = "[doc link TBD]"
STOP_WORDS = frozenset({"a", "an", "and", "the", "of", "for", "in", "on", "to", "with", "mattermost"})


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Versions ────────────────────────────────────────────────────────────────────────

def _release_month(version: dict) -> tuple[int, int] | None:
    day = version.get("releaseDate") or ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return int(day[:4]), int(day[5:7])
    named = re.search(r"\((%s) (\d{4})\)" % "|".join(MONTHS), version.get("name", ""))
    return (int(named.group(2)), MONTHS.index(named.group(1)) + 1) if named else None


def server_version(versions: list[dict], version: Version) -> dict | None:
    """The canonical ``vX.Y (Month Year)`` fix version, preferring an unreleased one if there are two."""
    matches = [v for v in versions if (m := SERVER_NAME.match((v.get("name") or "").strip()))
               and (int(m.group(1)), int(m.group(2))) == version.line]
    if len(matches) > 1:
        matches = [v for v in matches if not v.get("released")] or matches
    return matches[0] if len(matches) == 1 else None


def mobile_version(versions: list[dict], month: tuple[int, int]) -> tuple[dict | None, str]:
    """The mobile fix version released in ``month`` (year, month), and a note when there isn't one."""
    matches = [v for v in versions if MOBILE_NAME.match((v.get("name") or "").strip()) and _release_month(v) == month]
    if len(matches) > 1:
        return None, f"{len(matches)} mobile fix versions are released that month ({', '.join(v['name'] for v in matches)}), so none is used"
    if not matches:
        return None, "no mobile fix version is released that month"
    return matches[0], ""


def epics_jql(version_id: str) -> str:
    return f"project = MM AND issuetype = Epic AND fixVersion = {version_id}"


# ── Epics ───────────────────────────────────────────────────────────────────────────

def adf_text(node) -> str:
    """The plain text of an Atlassian Document Format description (or a plain string)."""
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        return "".join(adf_text(n) for n in node)
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    if node.get("type") == "hardBreak":
        return "\n"
    if node.get("type") in ("inlineCard", "blockCard", "embedCard"):
        return " " + (node.get("attrs") or {}).get("url", "") + " "
    text = adf_text(node.get("content") or [])
    return text + "\n" if node.get("type") in ("paragraph", "heading", "listItem", "codeBlock") else text


def adf_links(node) -> list[str]:
    """Link targets in an ADF description: link marks and smart-link cards."""
    found = []
    if isinstance(node, list):
        for n in node:
            found += adf_links(n)
    elif isinstance(node, dict):
        for mark in node.get("marks") or []:
            if mark.get("type") == "link":
                found.append((mark.get("attrs") or {}).get("href", ""))
        if node.get("type") in ("inlineCard", "blockCard", "embedCard"):
            found.append((node.get("attrs") or {}).get("url", ""))
        found += adf_links(node.get("content") or [])
    return [url for url in found if url]


@dataclass
class Epic:
    key: str
    summary: str
    description: str = ""
    links: list = field(default_factory=list)
    labels: list = field(default_factory=list)
    components: list = field(default_factory=list)
    kind: str = "server"  # or "mobile"

    @classmethod
    def from_issue(cls, issue: dict, kind: str) -> "Epic":
        fields = issue.get("fields") or {}
        description = fields.get("description")
        return cls(issue["key"], " ".join((fields.get("summary") or "").split()),
                   " ".join(adf_text(description).split()), adf_links(description),
                   list(fields.get("labels") or []), [c.get("name", "") for c in fields.get("components") or []], kind)


def merge_epics(server: list[Epic], mobile: list[Epic]) -> list[Epic]:
    """Server epics, then mobile epics not already listed: an epic in both stays a server epic."""
    merged = {}
    for epic in server + mobile:
        merged.setdefault(epic.key, epic)
    return list(merged.values())


def _has_phrase(text: str, phrase: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", text, re.IGNORECASE) is not None


def excluded_by_rules(epic: Epic, rules: dict) -> str:
    """Why the config leaves ``epic`` out, or an empty string."""
    labels = {label.casefold() for label in rules.get("labels", [])}
    components = {component.casefold() for component in rules.get("components", [])}
    for label in epic.labels:
        if label.casefold() in labels:
            return f"label {label}"
    for component in epic.components:
        if component.casefold() in components:
            return f"component {component}"
    for keyword in rules.get("title_keywords", []):
        if _has_phrase(epic.summary, keyword):
            return f"title mentions “{keyword}”"
    return ""


# ── Docs links ──────────────────────────────────────────────────────────────────────

def _words(text: str) -> tuple[str, ...]:
    return tuple(w for w in re.findall(r"[a-z0-9]+", text.casefold()) if w not in STOP_WORDS)


class DocsIndex:
    """The docs site built from this checkout's docs/ tree, with the title of each product docs
    page (docs/main, not the developer docs) that can document a feature."""

    def __init__(self, site: DocsSite):
        self.site = site
        self.titles = {}
        for site_path, path in site.pages.items():
            if path.startswith("docs/main/") and not NOT_A_FEATURE_PAGE.search(path):
                self.titles["https://docs.mattermost.com" + ("" if site_path == "/" else site_path)] = (
                    page_title(path, site.read(path)), path)

    @classmethod
    def from_checkout(cls, root: Path = REPO_ROOT) -> "DocsIndex":
        def read(path):
            full = root / path
            return full.read_text(encoding="utf-8") if full.is_file() else None

        files = [os.path.relpath(p, root) for base in ("docs/main", "docs/develop")
                 for p in glob.glob(str(root / base / "**" / "*.md*"), recursive=True)]
        return cls(DocsSite(sorted(files), read, None, read(REDIRECTS_FILE)))

    def check(self, url: str) -> str | None:
        return self.site.check(url)

    def page_for(self, name: str) -> tuple[str, str] | None:
        """(url, path) of the one page whose title is ``name``, or None when no page or several match."""
        wanted = _words(name)
        if not wanted:
            return None
        exact = [(url, path) for url, (title, path) in self.titles.items() if _words(title) == wanted]
        if len(exact) == 1:
            return exact[0]
        if exact:
            return None
        phrase = " ".join(wanted)
        containing = [(url, path) for url, (title, path) in self.titles.items()
                      if re.search(rf"(?<!\S){re.escape(phrase)}(?!\S)", " ".join(_words(title)))]
        return containing[0] if len(containing) == 1 else None


def doc_link(epic: Epic, name: str, docs: DocsIndex, notes: list) -> tuple[str, str]:
    """(docs URL or "", where it came from)."""
    for url in list(dict.fromkeys(epic.links + docs_urls(epic.description))):
        if not url.startswith(("https://docs.mattermost.com", "http://docs.mattermost.com")):
            continue
        url = url.rstrip(".,;:")
        problem = docs.check(url)
        if problem is None:
            return url, "the epic description"
        notes.append(f"{epic.key}: the description links {url}, which fails the link check ({problem}).")
    found = docs.page_for(name)
    if found:
        return found[0], f"the page title of {found[1]}"
    return "", "no docs page found"


# ── Claude ──────────────────────────────────────────────────────────────────────────

SYSTEM = """You write the Release Highlights slide for a Mattermost release: one line per
customer-facing feature, for customers and the field team.

You get Jira epics (key, summary, description). Reply with JSON only:
{"epics": [{"key": "MM-123", "include": true, "reason": "...", "name": "...", "description": "..."}]}
- One entry per epic you are given, with its key copied exactly.
- include is false for internal or process work customers never see: load tests,
  maintenance, CI, E2E or other test work, infrastructure, refactoring, tech debt. reason
  says in a few words why an epic is in or out.
- name: the feature's short name in Title Case, as a docs page would title it.
- description: one plain sentence, at most 25 words, saying what customers can now do. Use
  only what the summary and description say; no hype, no Jira keys, no links.
"""


def write_lines(epics: list[Epic], claude, result: Result) -> dict:
    """{key: {"include", "reason", "name", "description"}} from Claude, or {} without it."""
    if not epics:
        return {}
    if claude is None:
        result.todo("ANTHROPIC_API_KEY is not set, so no descriptions were written")
        return {}
    prompt = json.dumps([{"key": e.key, "summary": e.summary, "description": e.description[:3000]} for e in epics], indent=1)
    try:
        answer = claude.ask_json(SYSTEM, prompt, max_tokens=6000)
    except Exception as err:  # noqa: BLE001 - surfaced as a TODO
        result.todo(f"Claude could not write the descriptions: {err}")
        return {}
    keys = {e.key for e in epics}
    return {item["key"]: item for item in answer.get("epics", []) if isinstance(item, dict) and item.get("key") in keys}


# ── Output ──────────────────────────────────────────────────────────────────────────

@dataclass
class Line:
    epic: Epic
    name: str
    description: str
    url: str
    link_basis: str

    @property
    def slide_text(self) -> str:
        name = f"[{self.name}]({self.url})" if self.url else f"{self.name} {TBD}"
        return f"{name} — {self.description}"

    @property
    def html(self) -> str:
        name = (f'<a href="{html.escape(self.url)}">{html.escape(self.name)}</a>' if self.url
                else f"{html.escape(self.name)} {TBD}")
        return f"{name} — {html.escape(self.description)}<!-- {self.epic.key} -->"


def slide_title(month: tuple[int, int], version: Version) -> str:
    return f"{MONTHS[month[1] - 1]} {month[0]} {version.short}"


def artifact_name(month: tuple[int, int], extension: str) -> str:
    return f"release-highlights-{MONTHS[month[1] - 1]}-{month[0]}.{extension}"


STYLE = "font-family: Arial, sans-serif; font-size: 13.5pt;"


def html_artifact(title: str, lines: list[Line]) -> str:
    items = "\n".join(f'<li style="{STYLE}">{line.html}</li>' for line in lines)
    return (f'<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>{html.escape(title)}</title>\n</head>\n'
            f'<body style="{STYLE}">\n<ul style="{STYLE}">\n{items}\n</ul>\n</body>\n</html>\n')


def _day(value: date | None) -> str:
    return f"{value:%B} {value.day}, {value.year}" if value else "not set"


def build(version: Version, jira, claude, docs: DocsIndex, config: dict, release_day: date | None = None) -> Result:
    result = Result(TASK, version.tag)
    if version.is_dot:
        result.skipped = "dot releases have no Release Highlights slide"
        return result
    versions = jira.versions()
    server = server_version(versions, version)
    if not server:
        result.todo(f"Jira has no single {version.short} (Month Year) fix version")
        return result
    month = _release_month(server)
    mobile, problem = mobile_version(versions, month)
    if problem:
        result.notes.append(f"Mobile: {problem}.")

    queries = [("server", server, epics_jql(server["id"]))]
    if mobile:
        queries.append(("mobile", mobile, epics_jql(mobile["id"])))
    found = {kind: [Epic.from_issue(issue, kind) for issue in jira.search(jql, EPIC_FIELDS)] for kind, _, jql in queries}
    epics = merge_epics(found["server"], found.get("mobile", []))

    excluded, kept = [], []
    for epic in epics:
        reason = excluded_by_rules(epic, config.get("exclude", {}))
        if reason:
            excluded.append((epic, f"rule: {reason}"))
        else:
            kept.append(epic)
    answers = write_lines(kept, claude, result)
    lines = []
    for epic in kept:
        answer = answers.get(epic.key)
        if answer is not None and answer.get("include") is False:
            excluded.append((epic, f"Claude: {' '.join(str(answer.get('reason', 'internal work')).split())}"))
            continue
        name = " ".join(str((answer or {}).get("name") or epic.summary).split())
        description = " ".join(str((answer or {}).get("description") or "").split())
        if not description:
            description = result.todo(f"no description for {epic.key}")
        url, basis = doc_link(epic, name, docs, result.notes)
        lines.append(Line(epic, name, description, url, basis))
    if not lines:
        result.todo(f"no feature epics for {version.short}")

    title = slide_title(month, version)
    day = date.fromisoformat(server["releaseDate"]) if server.get("releaseDate") else release_day
    out = [f"# {title}", "", f"Release date: {_day(day)}", ""]
    out += [f"- {line.slide_text}" for line in lines] + [""]
    out += [f"Jira: [server epics, {server['name']}]({jira.filter_url(queries[0][2])})"
            + (f" · [mobile epics, {mobile['name']}]({jira.filter_url(queries[1][2])})" if mobile else ""), ""]
    out += [f"Deck: {config.get('deck_url', '')}", "", "## Where each line came from", ""]
    out += [f"- {line.name}: {line.epic.kind} epic [{line.epic.key}]({jira.browse_url(line.epic.key)}); link from {line.link_basis}"
            for line in lines]
    out += ["", "## Left out", ""]
    out += [f"- [{e.key}]({jira.browse_url(e.key)}) {e.summary} ({e.kind}): {reason}" for e, reason in excluded] or ["- None"]
    result.text = "\n".join(out) + "\n"

    result.artifacts[artifact_name(month, "html")] = html_artifact(title, lines)
    result.artifacts[artifact_name(month, "json")] = json.dumps({
        "title": title, "release_date": day.isoformat() if day else None,
        "server_fix_version": server["name"], "mobile_fix_version": mobile["name"] if mobile else None,
        "lines": [{"epic": line.epic.key, "kind": line.epic.kind, "name": line.name, "description": line.description,
                   "url": line.url, "link_from": line.link_basis} for line in lines],
        "left_out": [{"epic": e.key, "summary": e.summary, "kind": e.kind, "reason": reason} for e, reason in excluded],
    }, indent=2) + "\n"
    return result
