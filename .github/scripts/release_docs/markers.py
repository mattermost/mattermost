"""Hidden markers that mattermost/release-automation writes into the description of a PR these
tasks open, naming mattermost/mattermost PRs: ``<!-- release-automation:NAME: 39012,39088 -->``.

The release docs PR reads ``confirmed-breaking`` (upgrade_docs.py). There is no security marker:
the public dot release docs PR never identifies security fixes before the release. publish.py
keeps every ``release-automation:`` marker when it rewrites a description, so a task's own edit
never changes one.
"""

import re

PUBLIC_REPO = "mattermost/mattermost"
ITEM = re.compile(r"^(?:(?:mattermost/mattermost)?#)?(\d+)$")


def _pattern(name: str) -> re.Pattern:
    return re.compile(r"<!--\s*" + re.escape(name) + r"\s*:(.*?)-->", re.DOTALL)


def _mentions(name: str) -> re.Pattern:
    """Every occurrence of the marker's name opening an HTML comment, well-formed or not."""
    return re.compile(r"<!--\s*" + re.escape(name) + r"(?![\w-])")


def parse(body: str | None, name: str) -> tuple[list[str] | None, str | None]:
    """(the PRs the ``name`` marker lists, as ``mattermost/mattermost#N``, a problem) from a PR description.

    No marker: ``(None, None)``. An empty list or ``none``: ``([], None)``. Entries are PR
    numbers (``39012``, ``#39012`` or ``mattermost/mattermost#39012``), separated by commas or
    spaces. Anything else, a malformed marker (``<!-- NAME 1,2 -->``, no colon or no ``-->``) or
    two markers that disagree, is a problem and lists nothing; the entries themselves are never
    repeated, since they may not be public."""
    found = [" ".join(m.split()) for m in _pattern(name).findall(body or "")]
    malformed = len(_mentions(name).findall(body or "")) - len(found)
    if malformed > 0:
        return None, (f"the description has {malformed} malformed `{name}` marker{'s' if malformed > 1 else ''} "
                      f"(written `<!-- {name}: 1, 2 -->`)")
    if not found:
        return None, None
    if len(set(found)) > 1:
        return None, f"the description has {len(found)} `{name}` markers that disagree"
    raw = found[0]
    if raw.lower() in ("", "none"):
        return [], None
    items = [part for part in re.split(r"[\s,]+", raw) if part]
    numbers = [ITEM.match(part) for part in items]
    bad = sum(1 for n in numbers if n is None)
    if bad:
        return None, (f"the `{name}` marker has {bad} entr{'y' if bad == 1 else 'ies'} that "
                      f"{'is' if bad == 1 else 'are'} not a {PUBLIC_REPO} PR number")
    return list(dict.fromkeys(f"{PUBLIC_REPO}#{n.group(1)}" for n in numbers)), None


def changed(old_body: str | None, new_body: str | None, name: str) -> bool:
    """Whether an edit changed what the ``name`` marker says (its parsed value, so spacing alone
    is no change; a malformed marker becoming valid, or the reverse, is one). A task's own
    rewrite keeps the marker (publish.kept_markers), so it is none."""
    return parse(old_body, name) != parse(new_body, name)
