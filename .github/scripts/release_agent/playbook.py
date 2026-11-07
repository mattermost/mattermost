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
    indexes: tuple | None = None  # (checklist, item) to close, while the tick is planned but not done
    done: bool = False  # the item was closed


MARKDOWN_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")


def normalize(title: str) -> str:
    """A checklist title as it reads on screen: link text without URLs, no code or bold marks."""
    text = MARKDOWN_LINK.sub(r"\1", title or "").replace("`", "").replace("**", "")
    return " ".join(text.split()).casefold()


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


def title_matches(item_title: str, wanted: str) -> bool:
    """Whether a checklist item has the expected title.

    Without "…" the titles must be the same. A trailing "…" matches any item that starts with
    the text before it, and a "…" inside the text matches anything, so a title that names a
    person is written without them: "Check with … that tests get done…" still matches after
    the owner in the title changes.
    """
    title, expected = normalize(item_title), normalize(wanted)
    if "…" not in expected:
        return title == expected
    parts = [part.strip() for part in expected.split("…")]
    # A trailing "…" leaves an empty last part, so the pattern ends in ".*": any ending matches.
    pattern = ".*".join(re.escape(part) for part in parts)
    return re.fullmatch(pattern, title, re.DOTALL) is not None


def find_items(run: dict, title: str) -> list[tuple[int, int, dict]]:
    return [
        (checklist_index, item_index, item)
        for checklist_index, checklist in enumerate(run.get("checklists") or [])
        for item_index, item in enumerate(checklist.get("items") or [])
        if title_matches(item.get("title"), title)
    ]


def is_untouched(item: dict) -> bool:
    return (item.get("state") or "") == "" and not item.get("state_modified")


def plan_tick(run: dict, title: str, former_titles: list | None = None) -> tuple[str, tuple | None]:
    """What ticking ``title`` (or, on older runs, a former title) in ``run`` would do, and the
    (checklist, item) indexes to close."""
    matches = find_items(run, title)
    for former in former_titles or []:
        matches = matches or find_items(run, former)
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


def tick_items(playbooks, run: dict, passing: list[tuple[dict, object]], live: bool, execute: bool = True) -> list[Tick]:
    """Plan, and in live mode with ``execute`` also close, the playbook item of each passing,
    due rule. ``passing`` is [(rule, Result)]. With ``execute`` False a live tick stays planned
    (action TICKED, not done) until ``execute_ticks``, so items can be closed only once the
    status post that reports them is up."""
    ticks = []
    for rule, result in passing:
        title = rule["playbook_item"]
        action, indexes = plan_tick(run, title, rule.get("former_playbook_items"))
        tick = Tick(rule["task"], title, action, result.proof_url, result.summary)
        if action == TICKED and not live:
            tick.action = WOULD_TICK
        elif action == TICKED:
            tick.indexes = indexes
        ticks.append(tick)
    if execute:
        execute_ticks(playbooks, run, ticks)
    return ticks


def execute_ticks(playbooks, run: dict, ticks: list[Tick]) -> list[Tick]:
    """Close the planned ticks. Returns the ones that failed, which are marked FAILED."""
    failed = []
    for tick in ticks:
        if tick.action != TICKED or tick.done or tick.indexes is None:
            continue
        try:
            playbooks.close_item(run["id"], *tick.indexes)
            tick.done = True
        except Exception:  # noqa: BLE001 - one failed tick must not stop the others
            tick.action = FAILED
            failed.append(tick)
    return failed
