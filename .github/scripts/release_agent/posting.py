"""The per-release status post on Hub, edited in place rather than reposted."""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date

from . import playbook, workdays

MARKER_PROP = "release_agent_marker"
# Alarm id -> when the post first raised it (ms), so a reaction only covers what it saw.
SEEN_PROP = "release_agent_alarms_seen"
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
    # The service's own error text, e.g. Jira's reason for rejecting a JQL. Hub only.
    error_message: str = ""

    @property
    def title(self) -> str:
        return self.rule.get("title") or TITLES.get(self.rule["type"], self.rule["task"])


@dataclass
class ReleaseReport:
    release: object
    t_day: int | None
    mode: str
    outcomes: list = field(default_factory=list)
    ticks: list = field(default_factory=list)
    flags: list = field(default_factory=list)
    run: dict | None = None
    release_channel: str = ""
    false_alarms: set = field(default_factory=set)

    @property
    def needs_attention(self) -> bool:
        return any(alarm_id not in self.false_alarms for alarm_id in alarm_ids(self))


def flag_id(flag: str) -> str:
    return "flag:" + hashlib.sha1(flag.encode()).hexdigest()[:12]


def alarm_ids(report: ReleaseReport) -> dict:
    """What the post raises under Needs attention: {alarm id: what it is (public-safe)}."""
    alarms = {f"check:{o.rule['task']}": o.rule["task"] for o in report.outcomes if o.state in (NEEDS_ATTENTION, ERROR)}
    alarms.update({flag_id(flag): flag for flag in report.flags})
    return alarms


def false_alarms(existing: dict | None, alarms: dict, emoji: str, bot_id: str, reactions: list,
                 now_ms: int) -> tuple[set, dict]:
    """(alarm ids marked as false alarms, the seen map to store on the post).

    A person's ``emoji`` reaction on the status post marks every alarm the post had
    raised by then. Alarms raised later need the reaction removed and added again.
    """
    previous = ((existing or {}).get("props") or {}).get(SEEN_PROP) or {}
    seen = {alarm_id: previous.get(alarm_id, now_ms) for alarm_id in alarms}
    reacted = [r.get("create_at", 0) for r in reactions or []
               if r.get("emoji_name") == emoji and r.get("user_id") != bot_id]
    if not reacted:
        return set(), seen
    latest = max(reacted)
    return {alarm_id for alarm_id, first_seen in seen.items() if first_seen <= latest}, seen


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


def _proof(result, label: str = "proof") -> str:
    return f" · [{label}]({result.proof_url})" if result and result.proof_url else ""


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


# Hub notifies for @name (and @here, @channel, @all) anywhere except inside code.
MENTION = re.compile(r"(?<![\w@/.`])@[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?")


def quiet_mentions(text: str) -> str:
    """``text`` with every mention outside code spans put in code, so it notifies nobody."""
    parts = text.split("`")
    return "`".join(MENTION.sub(lambda m: f"`{m.group(0)}`", part) if i % 2 == 0 else part
                    for i, part in enumerate(parts))


def format_post(report: ReleaseReport, today: date, milestone_names: dict, emoji: str = "no_entry_sign") -> str:
    release = report.release
    headline = "Needs attention" if report.needs_attention else "All good"
    icon = ":large_yellow_circle:" if report.needs_attention else ":large_green_circle:"
    lines = [
        f"#### {icon} {release.short_version} release status · {workdays.format_t_day(report.t_day)} · {headline}",
        f"Release Day: {_day(release.release_day)}{next_milestone(release, today, milestone_names)}",
    ]
    if report.mode != "live":
        lines.append("_Test mode: nothing is ticked, this post is only in the test channel, "
                     "and mentions are shown as code so nobody is notified._")

    ticks = {tick.task: tick for tick in report.ticks}
    by_state = {}
    for outcome in report.outcomes:
        by_state.setdefault(outcome.state, []).append(outcome)

    dismissed = report.false_alarms
    raised = by_state.get(NEEDS_ATTENTION, []) + by_state.get(ERROR, [])
    attention = [o for o in raised if f"check:{o.rule['task']}" not in dismissed]
    flags = [flag for flag in report.flags if flag_id(flag) not in dismissed]
    if attention or flags:
        lines += ["", "**Needs attention**"]
        for outcome in attention:
            if outcome.state == ERROR:
                said = f": “{outcome.error_message}”" if outcome.error_message else ""
                lines.append(f"- :warning: **{outcome.title}** — couldn't check: {outcome.error}{said}")
                continue
            lines.append(f"- :x: **{outcome.title}** — {outcome.result.summary}{_proof(outcome.result)}")
            lines += _items(outcome.result.items)
        lines += [f"- :triangular_flag_on_post: {flag}" for flag in flags]

    if by_state.get(OK):
        lines += ["", "**All good**"]
        for outcome in by_state[OK]:
            lines.append(f"- :white_check_mark: **{outcome.title}** — {outcome.result.summary}"
                         f"{_proof(outcome.result)}{_tick_note(ticks, outcome.rule['task'])}")

    waiting = by_state.get(NOT_DUE, []) + [o for o in by_state.get(SKIPPED, []) if not o.result.hidden]
    if waiting:
        lines += ["", "**Not due yet**"]
        for outcome in waiting:
            due = f" (due {_day(outcome.due)})" if outcome.due else ""
            lines.append(f"- **{outcome.title}**{due} — {outcome.result.summary}")

    for outcome in by_state.get(REPORT, []):
        lines += ["", f"**{outcome.title}** — {outcome.result.summary}{_proof(outcome.result, 'Jira filter')}"
                      f"{_tick_note(ticks, outcome.rule['task'])}"]
        if outcome.rule["type"] == "open_release_items":
            lines += release_bugs_lines(outcome.result.items, release)
            continue
        groups = {}
        for item in outcome.result.items:
            groups.setdefault(item.owner or "Unassigned", []).append(item)
        for owner in sorted(groups, key=lambda name: (name == "Unassigned", name.lower())):
            lines.append(f"- **{owner}** ({len(groups[owner])})")
            lines += _items(groups[owner])

    marked = [o.title for o in raised if f"check:{o.rule['task']}" in dismissed]
    marked += [flag for flag in report.flags if flag_id(flag) in dismissed]
    if marked:
        lines += ["", "**Marked as false alarms**"] + [f"- ~~{what}~~" for what in marked]
    if attention or flags:
        lines += ["", f"_Not a real problem? React with :{emoji}: to mark everything under Needs attention "
                      "as a false alarm. For anything raised after your reaction, remove it and react again._"]
    text = "\n".join(lines)
    return text if report.mode == "live" else quiet_mentions(text)


def ordinal(day: int) -> str:
    suffix = "th" if 11 <= day % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suffix}"


def _ticket(item, owner: str) -> str:
    text = f"[{item.label}]({item.url})" if item.url else item.label
    if item.reason and (owner or item.reason != "unassigned"):
        text += f" ({item.reason})"
    return text + "".join(f" [{label}]({url})" for label, url in item.links)


def release_bugs_lines(items: list, release) -> list[str]:
    """The open bugs list: one line per person, most open tickets first, then Unassigned."""
    tickets = [item for item in items if not item.repo]
    prs = [item for item in items if item.repo]
    version = release.short_version
    if not tickets:
        lines = [f"✅ All tickets for {version} are resolved or closed — nothing to action."]
    else:
        freeze = release.milestones.get("code_freeze")
        lines = [f"Kind note that {version} Code Freeze deadline for bug fixes is **{freeze:%B} {ordinal(freeze.day)}** "
                 "— please action your tickets:" if freeze else f"Please action your {version} tickets:"]
        groups = {}
        for item in tickets:
            groups.setdefault(item.owner, []).append(item)
        for owner in sorted(groups, key=lambda o: (o == "", -len(groups[o]), o.casefold())):
            lines.append(f"{owner or '**Unassigned**'} -- " + ", ".join(_ticket(t, owner) for t in groups[owner]))
    if prs:
        lines.append(f"Open PRs with the {release.version} milestone:")
        lines += [line[2:] for line in _items(prs)]
    return lines


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


def upsert_post(mattermost, channel_id: str, marker_value: str, message: str, existing: dict | None,
                props: dict | None = None) -> tuple[str, dict]:
    """Create the status post, or edit ``existing`` (from find_post) when it changed."""
    props = {**(props or {}), MARKER_PROP: marker_value}
    if existing is None:
        return "created", mattermost.create_post(channel_id, message, props)
    old_props = existing.get("props") or {}
    if existing.get("message") == message and all(old_props.get(k) == v for k, v in props.items()):
        return "unchanged", existing
    return "updated", mattermost.patch_post(existing["id"], message, {**old_props, **props})
