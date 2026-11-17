"""Important Upgrade Notes rows and Deprecated Features entries from confirmed breaking changes.

Only PRs a person confirmed (breaking-changes with ``confirmed``) are written. The wording is
the PR's changelog bullet as the entry has it now, from Upgrade Impact (Compatibility,
Database Schema Changes, config.json removals) and API Changes. A confirmed PR with no such
bullet gets Claude's notice, marked for review in the PR body; a PR in a private repo never
does, since its title and description would reach a public PR. While a candidate is neither
confirmed nor removed, or a confirmed PR has no wording, the page keeps its placeholder and
the run fails, so the PR check does too.
"""

import html
import re
from dataclasses import dataclass, field
from datetime import date

PUBLIC_REPO = "mattermost/mattermost"
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
    pending: int = 0  # candidates neither confirmed nor removed yet
    todos: list = field(default_factory=list)  # public wording: never a private PR

    @property
    def complete(self) -> bool:
        return not self.todos

    def drafted(self) -> list[Entry]:
        return [e for e in self.notes + self.removed if e.drafted]


def _wording(bullets: list[dict]) -> list[str]:
    texts = []
    for bullet in bullets:
        place = (bullet.get("section"), bullet.get("subsection"))
        if place in WORDING_PLACES or (place[0] == "API Changes"):
            if place == ("Upgrade Impact", "config.json") and not REMOVAL.search(bullet["text"]):
                continue
            texts.append(bullet["text"])
    return list(dict.fromkeys(texts))


def plan(confirmed: list[str], candidates: list[str] | None, reviewed: list[str] | None,
         bullets_by_source: dict, drafts: dict, problem: str | None = None) -> UpgradeDocs:
    """What the two pages get. ``candidates`` are the latest list's (None: the list never ran),
    ``reviewed`` the candidates the confirmation decided on (None: no confirmation yet),
    ``bullets_by_source`` each confirmed PR's changelog bullets (changelog_run.bullets_for) and
    ``drafts`` Claude's notice for a public confirmed PR with none."""
    docs = UpgradeDocs()
    if problem:
        docs.todos.append(problem)
    elif candidates is None:
        docs.todos.append("the breaking-change list hasn't run for this release, so the Important Upgrade Notes and "
                          "Deprecated Features can't be filled yet")
    docs.pending = len([c for c in candidates or [] if c not in set(reviewed or [])])
    if docs.pending:
        docs.todos.append(f"{docs.pending} breaking-change candidate(s) are neither confirmed nor removed: run Release "
                          "Docs - Breaking Change Notices with `confirmed` set to the ones to keep (or `none`)")
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


def fill(content: str, after: str, block: str, placeholder: str, keep_placeholder: bool) -> str:
    """``content`` with ``block`` right after ``after``, and the placeholder there only when it's kept.
    Built from the base branch's page each run, so a rerun gives the same text."""
    content = content.replace(placeholder, "")
    at = content.find(after)
    if at < 0:
        return content
    at += len(after)
    return content[:at] + block + (placeholder if keep_placeholder else "") + content[at:]
