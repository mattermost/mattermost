"""A release's changelog entry, its Improvements section, and highlights picked from it."""

import re
from dataclasses import dataclass

from .versions import Version

HIGHLIGHT_LIMIT = 6
PLUGIN_BUMP = re.compile(r"^Pre-packaged .+ plugin version", re.IGNORECASE)
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")
BARE_URL = re.compile(r"https?://[^\s)>\]]+")


@dataclass(frozen=True)
class Highlight:
    name: str
    url: str  # a docs link from the cited bullet, or ""
    source: str  # the Improvements bullet it came from


def entry(content: str, version: Version) -> str | None:
    """The ``## Release vX.Y`` entry, up to the next release heading."""
    match = re.search(rf"(?m)^## Release {re.escape(version.short)} - .*$", content or "")
    if not match:
        return None
    rest = content[match.end():]
    end = re.search(r"(?m)^## ", rest)
    return content[match.start():match.end() + (end.start() if end else len(rest))]


def section(entry_text: str, title: str) -> str:
    match = re.search(rf"(?m)^### {re.escape(title)}\s*$", entry_text or "")
    if not match:
        return ""
    rest = entry_text[match.end():]
    end = re.search(r"(?m)^### ", rest)
    return rest[:end.start()] if end else rest


def improvement_bullets(entry_text: str) -> list[str]:
    """Top-level bullets in Improvements, without the pre-packaged plugin version bumps."""
    bullets = []
    for line in section(entry_text, "Improvements").splitlines():
        match = re.match(r"^ ?[-*] (.+)$", line)
        if match and not PLUGIN_BUMP.match(match.group(1).strip()):
            bullets.append(match.group(1).strip())
    return bullets


def blog_url(entry_text: str, version: Version) -> str:
    """The blog post the Improvements section links, else the URL the changelog workflow builds."""
    match = re.search(r"\[this blog post\]\((https?://[^)\s]+)\)", section(entry_text, "Improvements"))
    if match:
        return match.group(1)
    return f"https://mattermost.com/blog/mattermost-v{version.major}-{version.minor}-is-now-available/"


def urls_in(text: str) -> set[str]:
    return {url.rstrip(".,;:") for url in BARE_URL.findall(text or "")}


HIGHLIGHTS_SYSTEM = """You pick the feature highlights of a Mattermost server release from its changelog.

Reply with JSON only: {"highlights": [{"name": "...", "source": 0, "url": ""}]}
- Up to %d highlights, most important first: new features and notable capabilities, not fixes,
  dependency bumps or small UI tweaks.
- "name" is a short feature name in title case, as a release announcement would list it
  (e.g. "Attribute Management", "Multi-Window Pop-outs for Channels"). No markdown, no period.
- "source" is the number of the bullet the highlight comes from. Every highlight must come
  from a bullet; never invent one.
- "url" is a docs.mattermost.com link copied exactly from that bullet, or "" if it has none.
""" % HIGHLIGHT_LIMIT


def pick_highlights(bullets: list[str], claude) -> tuple[list[Highlight], str | None]:
    """(highlights, why there are none). Each must cite a bullet and only use its links."""
    if not bullets:
        return [], "the changelog entry has no Improvements bullets"
    if claude is None:
        return [], "ANTHROPIC_API_KEY is not set, so no highlights were picked from the changelog"
    numbered = "\n".join(f"{i}. {text}" for i, text in enumerate(bullets))
    try:
        answer = claude.ask_json(HIGHLIGHTS_SYSTEM, f"Improvements bullets:\n{numbered}")
    except Exception as err:  # noqa: BLE001 - any failure leaves a TODO, never a guess
        return [], f"Claude could not pick highlights: {err}"
    highlights = []
    for item in (answer or {}).get("highlights", [])[:HIGHLIGHT_LIMIT]:
        source = item.get("source")
        name = re.sub(r"[\s.]+$", "", " ".join(str(item.get("name", "")).split()))
        if not isinstance(source, int) or not 0 <= source < len(bullets) or not name:
            continue
        url = str(item.get("url") or "").strip()
        if url and url not in urls_in(bullets[source]):
            url = ""
        highlights.append(Highlight(name, url, bullets[source]))
    if not highlights:
        return [], "Claude returned no highlights that cite an Improvements bullet"
    return highlights, None


def join_names(names: list[str]) -> str:
    """``A``, ``A and B``, ``A, B, and C``, as the release descriptions list highlights."""
    if len(names) <= 2:
        return " and ".join(names)
    return ", ".join(names[:-1]) + ", and " + names[-1]
