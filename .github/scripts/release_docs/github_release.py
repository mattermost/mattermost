"""The GitHub release description: one plain sentence (playbook T-0)."""

import re

from . import templates
from .changelog import Highlight, join_names
from .result import Result
from .versions import Version, is_esr

TASK = "github-release"
MARKDOWN = re.compile(r"[\[\]*`#_<>|]")


def plain(text: str) -> str:
    """Single-line text with no markdown, as the playbook item asks."""
    return " ".join(MARKDOWN.sub("", text).split())


def build(version: Version, esr_versions: str, highlights: list[Highlight]) -> Result:
    result = Result(TASK, version.tag, repo="mattermost/mattermost")
    if version.is_dot:
        result.skipped = "dot release descriptions state the security severity, which a person decides"
        return result
    names = [plain(h.name) for h in highlights if plain(h.name)]
    sentence = templates.render("github-release.txt", {
        "release_kind": "Extended Support Release" if is_esr(version, esr_versions) else "Release",
        "version": version.plain,
        "highlights": join_names(names) if names else result.todo("no highlights for the release description"),
    })
    result.text = " ".join(sentence.split())
    return result
