"""The per-release status post on Hub, edited in place rather than reposted."""

from dataclasses import dataclass, field
from datetime import date

from . import playbook, workdays

MARKER_PROP = "release_agent_marker"
MAX_ITEMS = 15
MAX_PAGES = 25

NEEDS_ATTENTION = "needs_attention"
OK = "ok"
NOT_DUE = "not_due"
REPORT = "report"
SKIPPED = "skipped"
ERROR = "error"
LOG_ONLY = "log_only"

TITLES = {
    "open_release_items": "Open release bugs and PRs",
    "new_regressions": "New regressions",
    "hub_release_branch": "Hub on the release branch",
    "notice_txt": "NOTICE.txt on the release branch",
    "cherry_picks": "Cherry-picks on the release branch",
    "e2e_results": "E2E results for the latest RC",
    "release_tags": "Release tags",
    "version_go_prs": "version.go PRs",
    "changelog_labels": "Changelog labels",
}


@dataclass
class Outcome:
    rule: dict
    state: str
    result: object = None  # checks.Result, None on error
    due: date | None = None
    error: str = ""
    error_detail: str = ""

    @property
    def title(self) -> str:
        return self.rule.get("playbook_item") or TITLES.get(self.rule["type"], self.rule["task"])


@dataclass
class ReleaseReport:
    release: object
    t_day: int | None
    mode: str
    outcomes: list = field(default_factory=list)
    ticks: list = field(default_factory=list)
    flags: list = field(default_factory=list)
    run: dict | None = None

    @property
    def needs_attention(self) -> bool:
        return bool(self.flags) or any(o.state in (NEEDS_ATTENTION, ERROR) for o in self.outcomes)


def marker(release, mode: str) -> str:
    return f"release-agent:status:{release.short_version}:{mode}"


def _day(value: date | None) -> str:
    return f"{value:%a %b} {value.day}" if value else "not on the calendar"


def _item_line(item) -> str:
    label = f"[{item.label}]({item.url})" if item.url else item.label
    parts = [label]
    if item.title:
        parts.append(item.title)
    if item.owner:
        parts.append(f"({item.owner})")
    if item.note:
        parts.append(f"— {item.note}")
    return "  - " + " ".join(parts)


def _items(items: list) -> list[str]:
    lines = [_item_line(item) for item in items[:MAX_ITEMS]]
    if len(items) > MAX_ITEMS:
        lines.append(f"  - …and {len(items) - MAX_ITEMS} more")
    return lines


def _proof(result) -> str:
    return f" · [proof]({result.proof_url})" if result and result.proof_url else ""


def _tick_note(ticks_by_task: dict, task: str) -> str:
    tick = ticks_by_task.get(task)
    if not tick:
        return ""
    return {
        playbook.TICKED: " · done in the playbook",
        playbook.ALREADY_DONE: " · done in the playbook",
        playbook.WOULD_TICK: " · would tick (test mode)",
        playbook.HANDLED_BY_PERSON: " · not ticked: a person has handled this item",
        playbook.NOT_FOUND: " · not ticked: no checklist item with this title",
        playbook.AMBIGUOUS: " · not ticked: several checklist items have this title",
        playbook.FAILED: " · ticking failed",
    }.get(tick.action, "")


def next_milestone(release, today: date, names: dict) -> str:
    upcoming = sorted((day, key) for key, day in release.milestones.items() if day >= today and key != "release_day")
    if not upcoming:
        return ""
    day, key = upcoming[0]
    return f" · Next: {names.get(key, key)} on {_day(day)}"


def format_post(report: ReleaseReport, today: date, milestone_names: dict) -> str:
    release = report.release
    headline = "Needs attention" if report.needs_attention else "All good"
    icon = ":large_yellow_circle:" if report.needs_attention else ":large_green_circle:"
    lines = [
        f"#### {icon} {release.short_version} release status · {workdays.format_t_day(report.t_day)} · {headline}",
        f"Release Day: {_day(release.release_day)}{next_milestone(release, today, milestone_names)}",
    ]
    if report.mode != "live":
        lines.append("_Test mode: nothing is ticked, and this post is only in the test channel._")

    ticks = {tick.task: tick for tick in report.ticks}
    by_state = {}
    for outcome in report.outcomes:
        by_state.setdefault(outcome.state, []).append(outcome)

    attention = by_state.get(NEEDS_ATTENTION, []) + by_state.get(ERROR, [])
    if attention or report.flags:
        lines += ["", "**Needs attention**"]
        for outcome in attention:
            if outcome.state == ERROR:
                lines.append(f"- :warning: **{outcome.title}** — couldn't check: {outcome.error}")
                continue
            lines.append(f"- :x: **{outcome.title}** — {outcome.result.summary}{_proof(outcome.result)}")
            lines += _items(outcome.result.items)
        lines += [f"- :triangular_flag_on_post: {flag}" for flag in report.flags]

    if by_state.get(OK):
        lines += ["", "**All good**"]
        for outcome in by_state[OK]:
            lines.append(f"- :white_check_mark: **{outcome.title}** — {outcome.result.summary}"
                         f"{_proof(outcome.result)}{_tick_note(ticks, outcome.rule['task'])}")

    waiting = by_state.get(NOT_DUE, []) + by_state.get(SKIPPED, [])
    if waiting:
        lines += ["", "**Not due yet**"]
        for outcome in waiting:
            due = f" (due {_day(outcome.due)})" if outcome.due else ""
            lines.append(f"- **{outcome.title}**{due} — {outcome.result.summary}")

    for outcome in by_state.get(REPORT, []):
        lines += ["", f"**{outcome.title}** — {outcome.result.summary}{_proof(outcome.result)}"]
        groups = {}
        for item in outcome.result.items:
            groups.setdefault(item.owner or "Unassigned", []).append(item)
        for owner in sorted(groups, key=lambda name: (name == "Unassigned", name.lower())):
            lines.append(f"- **{owner}** ({len(groups[owner])})")
            lines += _items(groups[owner])
    return "\n".join(lines)


def find_post(mattermost, channel_id: str, marker_value: str, since_ms: int) -> dict | None:
    """The bot's earlier post carrying ``marker_value``, searching back to ``since_ms``."""
    bot_id = mattermost.me()["id"]
    for page in range(MAX_PAGES):
        posts = mattermost.channel_posts(channel_id, page=page)
        for post in posts:
            if post.get("user_id") == bot_id and (post.get("props") or {}).get(MARKER_PROP) == marker_value:
                return post
        if len(posts) < 200 or posts[-1].get("create_at", 0) < since_ms:
            return None
    return None


def upsert_post(mattermost, channel_id: str, marker_value: str, message: str, since_ms: int) -> tuple[str, dict]:
    """Create the status post, or edit the earlier one when its text changed."""
    existing = find_post(mattermost, channel_id, marker_value, since_ms)
    if existing is None:
        return "created", mattermost.create_post(channel_id, message, {MARKER_PROP: marker_value})
    if existing.get("message") == message:
        return "unchanged", existing
    props = {**(existing.get("props") or {}), MARKER_PROP: marker_value}
    return "updated", mattermost.patch_post(existing["id"], message, props)
