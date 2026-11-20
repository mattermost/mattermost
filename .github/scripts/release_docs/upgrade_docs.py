"""Important Upgrade Notes rows and Deprecated Features entries from confirmed breaking changes.

Which mattermost/mattermost PRs are confirmed breaking changes is decided elsewhere
(mattermost/release-automation) and written into the release docs PR's description as a hidden
marker: ``<!-- release-automation:confirmed-breaking: 39012,39088 -->`` (an empty list, or
``none``, confirms that there are none). Only those PRs are written. The wording is the PR's
changelog bullet as the entry has it now, from Upgrade Impact (Compatibility, Database Schema
Changes, config.json removals) and API Changes. A confirmed PR with no such bullet gets
Claude's notice, drafted from the PR's title and release note and listed for review in the PR
body. Without the marker, or while a confirmed PR has no wording, the pages keep their
placeholders and the PR check fails from T-2.
"""

import html
import json
import re
from dataclasses import dataclass, field
from datetime import date

from . import markers
from .result import Result

PUBLIC_REPO = markers.PUBLIC_REPO
MARKER_NAME = "release-automation:confirmed-breaking"
WORDING_PLACES = {("Upgrade Impact", "Compatibility"), ("Upgrade Impact", "Database Schema Changes"),
                  ("Upgrade Impact", "config.json"), ("API Changes", None)}
REMOVAL = re.compile(r"(?i)^(?:removed|deprecated)\b|\b(?:is|are|was|were|has been|have been) (?:removed|deprecated)\b"
                     r"|\bno longer (?:supported|available)\b")


@dataclass
class Entry:
    source: str
    text: str  # changelog Markdown
    drafted: bool = False  # Claude's wording, to check


@dataclass
class UpgradeDocs:
    notes: list = field(default_factory=list)  # Entry per confirmed PR, for Important Upgrade Notes
    removed: list = field(default_factory=list)  # Entry per removal or deprecation, for Deprecated Features
    todos: list = field(default_factory=list)  # public wording: never a private PR

    @property
    def complete(self) -> bool:
        return not self.todos

    def drafted(self) -> list[Entry]:
        return [e for e in self.notes + self.removed if e.drafted]


def parse_marker(body: str | None) -> tuple[list[str] | None, str | None]:
    """(the confirmed PRs as ``mattermost/mattermost#N``, a problem) from a PR description; see
    markers.parse."""
    return markers.parse(body, MARKER_NAME)


def _wording(bullets: list[dict]) -> list[str]:
    texts = []
    for bullet in bullets:
        place = (bullet.get("section"), bullet.get("subsection"))
        if place in WORDING_PLACES or (place[0] == "API Changes"):
            if place == ("Upgrade Impact", "config.json") and not REMOVAL.search(bullet["text"]):
                continue
            texts.append(bullet["text"])
    return list(dict.fromkeys(texts))


def has_wording(bullets: list[dict]) -> bool:
    return bool(_wording(bullets))


def plan(confirmed: list[str], bullets_by_source: dict, drafts: dict, problem: str | None = None) -> UpgradeDocs:
    """What the two pages get. ``confirmed`` are the marker's PRs, ``bullets_by_source`` each
    one's changelog bullets (changelog_run.bullets_for) and ``drafts`` Claude's notice for a
    public confirmed PR with none."""
    docs = UpgradeDocs()
    if problem:
        docs.todos.append(problem)
    private_missing = 0
    for source in confirmed:
        texts = _wording(bullets_by_source.get(source, []))
        drafted = False
        if not texts and source.startswith(PUBLIC_REPO + "#") and drafts.get(source):
            texts, drafted = [drafts[source]], True
        if not texts:
            if source.startswith(PUBLIC_REPO + "#"):
                docs.todos.append(f"{source} is a confirmed breaking change with no changelog bullet in Upgrade Impact "
                                  "or API Changes, and no drafted notice: write its upgrade note by hand")
            else:
                private_missing += 1
            continue
        docs.notes.append(Entry(source, " ".join(texts), drafted))
        docs.removed += [Entry(source, text, drafted) for text in texts if REMOVAL.search(text)]
    if private_missing:
        docs.todos.append(f"{private_missing} confirmed breaking change(s) from a private repo have no changelog bullet "
                          "in Upgrade Impact or API Changes: write their upgrade notes by hand")
    return docs


# ── Claude's notice, for a confirmed PR with no changelog bullet ────────────────────

NOTICE_SYSTEM = """You write upgrade notices for Mattermost administrators, one per breaking change.

Reply with JSON only: {"notices": [{"source": "org/repo#123", "notice": "..."}]}
- One notice per PR you are given, using only that PR's title, release note and upgrade notes.
- Two to four plain sentences: what changed, who is affected, and what to do before or
  after upgrading. Past tense for the change, imperative for the action.
- Do not invent settings, versions or steps that the release note does not state.
"""


def release_note(body: str) -> str:
    """The PR's release note, through the changelog generator's own parser; empty for NONE."""
    from generate_changelog import extract_release_notes  # needs requests; imported where used

    return " ".join(extract_release_notes(body or "") or [])


def upgrade_section(body: str) -> str:
    """Text under a PR body heading that mentions upgrading, such as "#### Upgrade Notes"."""
    text = re.sub(r"<!--.*?-->", "", body or "", flags=re.DOTALL)
    match = re.search(r"(?mi)^#+[^\n]*upgrad[^\n]*\n(.*?)(?=^#|\Z)", text, re.DOTALL)
    return " ".join(match.group(1).split()) if match else ""


def draft_notices(prs: dict, claude, result: Result) -> dict:
    """``{source: notice}`` drafted by Claude for ``prs`` (``{source: PR from the GitHub API}``),
    each from its title, release note and upgrade notes only. Public PRs only: the notice goes into
    a public PR."""
    drafts = {}
    prs = {source: pr for source, pr in prs.items() if source.startswith(PUBLIC_REPO + "#")}
    if not prs:
        return drafts
    if claude is None:
        result.todo("ANTHROPIC_API_KEY is not set, so no upgrade notice was drafted for the confirmed breaking "
                    "changes with no changelog bullet")
        return drafts
    listing = json.dumps([{"source": source, "title": pr.get("title", ""), "release_note": release_note(pr.get("body")),
                           "upgrade_notes": upgrade_section(pr.get("body"))} for source, pr in prs.items()], indent=1)
    try:
        for item in claude.ask_json(NOTICE_SYSTEM, listing).get("notices", []):
            if item.get("source") in prs:
                drafts[item["source"]] = " ".join(str(item.get("notice", "")).split())
    except Exception as err:  # noqa: BLE001 - surfaced as a TODO
        result.todo(f"Claude could not draft the upgrade notices: {type(err).__name__}")
    return {source: text for source, text in drafts.items() if text}


# ── The templates ───────────────────────────────────────────────────────────────────

def to_html(markdown: str) -> str:
    """A changelog bullet as the upgrade notes table's HTML: code, links, bold and italics. Braces
    and angle brackets become entities, so MDX reads them as text."""
    text = markdown.replace("\\{", "{").replace("\\<", "<")
    parts, pos = [], 0
    for match in re.finditer(r"``(.+?)``|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)", text):
        parts.append(("text", text[pos:match.start()]))
        if match.group(1) or match.group(2):
            parts.append(("code", match.group(1) or match.group(2)))
        else:
            parts.append(("link", (match.group(3), match.group(4))))
        pos = match.end()
    parts.append(("text", text[pos:]))

    def escape(value: str) -> str:
        return html.escape(value, quote=False).replace("{", "&#123;").replace("}", "&#125;")

    def inline(value: str) -> str:
        value = escape(value)
        value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)
        return re.sub(r"(?<![\w*])[*_](?![\s*_])(.+?)(?<![\s*_])[*_](?![\w*])", r"<em>\1</em>", value)

    out = []
    for kind, value in parts:
        if kind == "code":
            out.append(f"<code>{escape(value)}</code>")
        elif kind == "link":
            out.append(f'<a href="{html.escape(value[1])}">{inline(value[0])}</a>')
        else:
            out.append(inline(value))
    return "".join(out).strip()


def note_rows(short: str, entries: list[Entry]) -> str:
    """The release's rows: its version cell spans them all, as the page's other releases do."""
    rows = []
    for index, entry in enumerate(entries):
        cell = "" if index else (f'<td rowspan="{len(entries)}">{short}</td>\n' if len(entries) > 1 else f"<td>{short}</td>\n")
        rows.append(f"<tr>\n{cell}<td><p>{to_html(entry.text)}</p></td>\n</tr>\n")
    return "".join(rows)


def removed_section(short: str, release_day: date | None, entries: list[Entry]) -> str:
    when = f" ({release_day.strftime('%B')} {release_day.year})" if release_day else ""
    return f"### Mattermost Server {short}{when}\n\n" + "".join(f"- {entry.text}\n" for entry in entries) + "\n"


def without_rows(content: str, short: str) -> str:
    """``content`` without the release's rows in the upgrade notes table: its version cell and the
    rows it spans."""
    start = re.search(rf'<tr>\s*<td(?:\s+rowspan="(\d+)")?>\s*{re.escape(short)}\s*</td>', content)
    if not start:
        return content
    end = start.start()
    for _ in range(int(start.group(1) or 1)):
        close = content.find("</tr>", end)
        if close < 0:
            return content
        end = close + len("</tr>")
    if content.startswith("\n", end):
        end += 1
    return content[:start.start()] + content[end:]


def without_section(content: str, short: str) -> str:
    """``content`` without the release's section in Removed features, up to the next heading."""
    return re.sub(rf"^### Mattermost Server {re.escape(short)}(?![\d.])[^\n]*\n(?:(?!#)[^\n]*\n)*", "", content,
                  count=1, flags=re.MULTILINE)


def fill(content: str, after: str, block: str, placeholder: str, keep_placeholder: bool) -> str:
    """``content`` with ``block`` right after ``after``, and the placeholder there only when it's kept.
    The page may be the PR branch's, so the caller removes the release's earlier block first."""
    content = content.replace(placeholder, "")
    at = content.find(after)
    if at < 0:
        return content
    at += len(after)
    return content[:at] + block + (placeholder if keep_placeholder else "") + content[at:]
