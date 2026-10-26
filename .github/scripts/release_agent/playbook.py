"""Finding a release's playbook run and ticking its checklist items.

Items are only ever closed, never reopened, and only while nobody has touched them: an
item a person ticked, skipped, started or reopened is left alone.
"""

import re
from dataclasses import dataclass

TICKED = "ticked"
WOULD_TICK = "would_tick"
ALREADY_DONE = "already_done"
HANDLED_BY_PERSON = "handled_by_person"
NOT_FOUND = "not_found"
AMBIGUOUS = "ambiguous"
FAILED = "failed"


@dataclass
class Tick:
    task: str
    playbook_item: str
    action: str
    proof_url: str = ""
    summary: str = ""


def normalize(title: str) -> str:
    return " ".join((title or "").split()).casefold()


def name_matches(name: str, fragment: str) -> bool:
    """``v12.2`` matches "Release v12.2" but not "v12.20" or "v12.2.1"."""
    return re.search(rf"(?<![\w.]){re.escape(fragment)}(?!\w|\.\d)", name or "", re.IGNORECASE) is not None


def find_run(runs: list[dict], fragment: str, by_name: bool = True) -> tuple[dict | None, str | None]:
    """The single in-progress run for the release, else None and why.

    ``runs`` are those in the release channel, or with ``by_name`` any that may be named
    for it, of which only names containing ``fragment`` as a whole word count.
    """
    matches = [run for run in runs if not by_name or name_matches(run.get("name", ""), fragment)]
    where = f"named for {fragment}" if by_name else f"in the {fragment} channel"
    if not matches:
        return None, f"No in-progress playbook run {where} was found, so nothing is ticked."
    if len(matches) > 1:
        return None, f"{len(matches)} in-progress playbook runs are {where}, so nothing is ticked."
    return matches[0], None


def find_items(run: dict, title: str) -> list[tuple[int, int, dict]]:
    wanted = normalize(title)
    return [
        (checklist_index, item_index, item)
        for checklist_index, checklist in enumerate(run.get("checklists") or [])
        for item_index, item in enumerate(checklist.get("items") or [])
        if normalize(item.get("title")) == wanted
    ]


def is_untouched(item: dict) -> bool:
    return (item.get("state") or "") == "" and not item.get("state_modified")


def plan_tick(run: dict, title: str) -> tuple[str, tuple | None]:
    """What ticking ``title`` in ``run`` would do, and the (checklist, item) indexes to close."""
    matches = find_items(run, title)
    if not matches:
        return NOT_FOUND, None
    if len(matches) > 1:
        return AMBIGUOUS, None
    checklist_index, item_index, item = matches[0]
    if item.get("state") == "closed":
        return ALREADY_DONE, None
    if not is_untouched(item):
        return HANDLED_BY_PERSON, None
    return TICKED, (checklist_index, item_index)


def tick_items(playbooks, run: dict, passing: list[tuple[dict, object]], live: bool) -> list[Tick]:
    """Tick the playbook item of each passing, due rule. ``passing`` is [(rule, Result)]."""
    ticks = []
    for rule, result in passing:
        title = rule["playbook_item"]
        action, indexes = plan_tick(run, title)
        if action == TICKED and not live:
            action = WOULD_TICK
        elif action == TICKED:
            try:
                playbooks.close_item(run["id"], *indexes)
            except Exception:  # noqa: BLE001 - one failed tick must not stop the others
                action = FAILED
        ticks.append(Tick(rule["task"], title, action, result.proof_url, result.summary))
    return ticks
