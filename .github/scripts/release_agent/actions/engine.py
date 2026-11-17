"""What every release action shares: its Hub post and state, stop and go, the stop window,
dry run and live, and the delivery-platform workflow runs it starts.

Nothing is kept between runs. Each action has one Hub post per release (a notice action, one
per day), found again by its hidden ``release_action`` prop, whose ``release_action_state``
prop holds where it got to. Replies and reactions on that post are how people stop it
(``stop`` or :no_entry_sign:, anyone) or start it (``go`` or :white_check_mark:, the playbook
run's owner, RELEASE_AGENT_PEOPLE.release_manager or .release_backup).
"""

import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone

from .. import posting, workdays
from . import text
from .people import People

ACTION_PROP = "release_action"
STATE_PROP = "release_action_state"
MAX_PAGES = 25
WORK_START, WORK_END = 8, 18  # UTC hours the hourly workflow runs in

DRY_RUN, LIVE = "dry_run", "live"
ACTION_NAMES = ("qa_sheet", "tickets", "metrics", "versions", "rc", "branch_cut")
STOP_EMOJI, GO_EMOJI = "no_entry_sign", "white_check_mark"
FAILED_CONCLUSIONS = {"failure", "cancelled", "timed_out", "startup_failure", "action_required", "stale"}
RUN_TIMEOUT = timedelta(hours=8)

# Status words, first in every line.
DONE, WAITING, STOPPED, FAILED, STARTED = "Done", "Waiting", "Stopped", "Failed", "Started"
NOT_DUE, NOT_NEEDED, DRY, CLOSED, ATTENTION = "Not due yet", "Not needed", "Dry run", "Closed", "Needs attention"


@dataclass
class Settings:
    mode: str = DRY_RUN
    live_actions: frozenset = frozenset()
    trigger: str = "schedule"  # or workflow_dispatch, which is always a dry run
    release_override: str = ""
    test_channel: str = ""
    log_channel: str = ""
    playbook_id: str = ""
    release_channels: dict = field(default_factory=dict)
    people: People = field(default_factory=People)
    qa_sheet_id: str = ""
    scorecard_sheet_id: str = ""
    holidays_page_id: str = ""

    def is_live(self, action: str) -> bool:
        return self.mode == LIVE and self.trigger == "schedule" and action in self.live_actions


def parse_mode(value: str) -> str:
    value = (value or DRY_RUN).strip().lower()
    if value not in (DRY_RUN, LIVE):
        raise ValueError(f"RELEASE_ACTIONS_MODE must be dry_run or live, not {value!r}")
    return value


def parse_live(value: str) -> frozenset:
    names = {n.strip() for n in (value or "").split(",") if n.strip()}
    unknown = names - set(ACTION_NAMES)
    if unknown:
        raise ValueError(f"RELEASE_ACTIONS_LIVE names unknown actions: {', '.join(sorted(unknown))}")
    return frozenset(names)


def settings_from_env(env, trigger: str | None = None) -> Settings:
    import json
    channels = env.get("RELEASE_CHANNEL_IDS", "").strip()
    return Settings(
        mode=parse_mode(env.get("RELEASE_ACTIONS_MODE", "")),
        live_actions=parse_live(env.get("RELEASE_ACTIONS_LIVE", "")),
        # Only the schedule acts live; a dispatch from the Actions tab is always a dry run.
        trigger=trigger or ("schedule" if env.get("GITHUB_EVENT_NAME", "") == "schedule" else "workflow_dispatch"),
        release_override=env.get("INPUT_RELEASE", "").strip(),
        test_channel=env.get("TEST_CHANNEL_ID", ""),
        log_channel=env.get("LOG_CHANNEL_ID", ""),
        playbook_id=env.get("PLAYBOOK_ID", ""),
        release_channels=json.loads(channels) if channels else {},
        people=People.parse(env.get("PEOPLE", "")),
        qa_sheet_id=env.get("QA_SHEET_ID", "").strip(),
        scorecard_sheet_id=env.get("SCORECARD_SHEET_ID", "").strip(),
        holidays_page_id=env.get("HOLIDAYS_PAGE_ID", "").strip(),
    )


@dataclass
class Status:
    """One action's line in the status post and run.json. ``line`` is Hub only; ``public`` is
    counts and states only, for run.json and the step summary."""
    word: str
    line: str
    public: str = ""
    done: bool = False  # ready to tick the playbook item
    proof_url: str = ""
    proof: str = ""  # the tick's proof reply text (Hub only)
    attention: list = field(default_factory=list)  # Needs attention lines (Hub only)


@dataclass
class Command:
    kind: str  # stop | go
    user_id: str
    at: int  # ms
    ref: str  # reply post id, or "reaction:<user>:<emoji>:<at>"
    via: str  # reply | reaction


@dataclass
class ActionContext:
    """One release, as one action sees it."""
    release: object
    now: datetime
    holidays: frozenset
    rules: dict
    spec: dict
    settings: Settings
    services: object
    events: list = field(default_factory=list)
    releases: dict = field(default_factory=dict)
    branches: set = field(default_factory=set)  # (major, minor) with a release branch in mattermost
    tags: set = field(default_factory=set)  # (major, minor) with a vX.Y.0 tag
    rc_numbers: list = field(default_factory=list)
    release_channel: str = ""
    run: dict | None = None  # the playbook run
    flags: list = field(default_factory=list)  # public-safe
    private_flags: list = field(default_factory=list)  # Hub only
    audit: list = field(default_factory=list)  # (Hub text) lines for release-agent-log
    execute: bool = True  # False for the daily status post: read only
    vars: dict = field(default_factory=dict)  # agent.template_vars: fix_version, milestone, ...

    @property
    def fix_version(self) -> str:
        return self.vars.get("fix_version", "")

    @property
    def today(self) -> date:
        return self.now.date()

    @property
    def action(self) -> str:
        return self.spec["action"]

    @property
    def live(self) -> bool:
        return self.execute and self.settings.is_live(self.action)

    @property
    def channel(self) -> str:
        """Live: the release channel. Dry run: the test channel."""
        if self.settings.is_live(self.action):
            return self.settings.release_channels.get(self.release.short_version) or self.release_channel
        return self.settings.test_channel

    def due(self, key: str = "due") -> date | None:
        from ..release_calendar import resolve_due
        return resolve_due(self.spec[key], self.release, self.holidays) if self.spec.get(key) else None

    def since_ms(self) -> int:
        start = self.release.window(0)[0] - timedelta(days=30)
        return int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp() * 1000)

    def say(self, message: str) -> str:
        """Live posts mention people; dry-run posts show mentions as code so nobody is notified."""
        return message if self.settings.is_live(self.action) else posting.quiet_mentions(message)


# ── Working time ─────────────────────────────────────────────────────────────────────

def is_working(moment: datetime, holidays: frozenset) -> bool:
    return workdays.is_working_day(moment.date(), holidays) and WORK_START <= moment.hour < WORK_END


def add_working_minutes(start: datetime, minutes: int, holidays: frozenset) -> datetime:
    """``minutes`` working minutes (08:00-18:00 UTC on working days) after ``start``, rounded up to
    the hour, when the hourly workflow can act on it."""
    moment, left = start, minutes
    while left > 0:
        if not is_working(moment, holidays):
            day = moment.date() + (timedelta(days=1) if moment.hour >= WORK_END or not workdays.is_working_day(moment.date(), holidays) else timedelta())
            while not workdays.is_working_day(day, holidays):
                day += timedelta(days=1)
            moment = datetime.combine(day, time(WORK_START), tzinfo=timezone.utc)
            continue
        end_of_day = datetime.combine(moment.date(), time(WORK_END), tzinfo=timezone.utc)
        step = min(left, math.ceil((end_of_day - moment).total_seconds() / 60))
        moment += timedelta(minutes=step)
        left -= step
    # Rounded up to the hour, when the hourly run acts on it, so the window is never shorter
    # than ``minutes``.
    if moment.minute or moment.second or moment.microsecond:
        moment = moment.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    return moment


def ms(moment: datetime) -> int:
    return int(moment.timestamp() * 1000)


def from_ms(value: int) -> datetime:
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc)


# ── Action posts ─────────────────────────────────────────────────────────────────────

def action_id(task: str, version: str, key: str = "") -> str:
    return f"{task}:{version}:{key}"


def find_posts(ctx: ActionContext, channel: str, task: str | None = None) -> list[dict]:
    """The bot's root posts in ``channel`` for this release's action, newest first."""
    if not channel:
        return []
    hub = ctx.services.hub
    bot_id = hub.me()["id"]
    prefix = action_id(task or ctx.spec["task"], ctx.release.short_version)
    since, found = ctx.since_ms(), []
    for page in range(MAX_PAGES):
        posts = hub.channel_posts(channel, page=page)
        for post in posts:
            mark = str((post.get("props") or {}).get(ACTION_PROP) or "")
            if post.get("user_id") == bot_id and not post.get("root_id") and mark.startswith(prefix) \
                    and not post.get("delete_at"):
                found.append(post)
        if len(posts) < 200 or posts[-1].get("create_at", 0) < since:
            break
    return sorted(found, key=lambda p: p.get("create_at", 0), reverse=True)


def state_of(post: dict | None) -> dict:
    return dict(((post or {}).get("props") or {}).get(STATE_PROP) or {})


def key_of(post: dict) -> str:
    return str((post.get("props") or {}).get(ACTION_PROP, "")).split(":", 2)[-1]


def create_post(ctx: ActionContext, channel: str, message: str, key: str, state: dict) -> dict:
    props = {ACTION_PROP: action_id(ctx.spec["task"], ctx.release.short_version, key), STATE_PROP: state}
    return ctx.services.hub.create_post(channel, ctx.say(message), props)


def save_state(ctx: ActionContext, post: dict, state: dict, message: str | None = None) -> dict:
    props = {**(post.get("props") or {}), STATE_PROP: state}
    updated = ctx.services.hub.patch_post(post["id"], ctx.say(message) if message is not None else post["message"], props)
    post.update(props=props, message=updated.get("message", post["message"]) if isinstance(updated, dict) else post["message"])
    return post


def reply(ctx: ActionContext, post: dict, message: str) -> dict:
    return ctx.services.hub.create_post(post["channel_id"], ctx.say(message), root_id=post["id"])


WORD = re.compile(r"^[\s`*_~>]*(stop|go)[\s`*_~.!]*$", re.IGNORECASE)


def commands(ctx: ActionContext, post: dict, since: int = 0) -> list[Command]:
    """Stops and goes on ``post`` from people (not the bot) after ``since`` (ms), oldest first."""
    hub = ctx.services.hub
    bot_id = hub.me()["id"]
    found = []
    for reply_post in hub.thread(post["id"]):
        if reply_post["id"] == post["id"] or reply_post.get("user_id") == bot_id or reply_post.get("delete_at"):
            continue
        match = WORD.match(reply_post.get("message") or "")
        if match and reply_post.get("create_at", 0) > since:
            found.append(Command(match.group(1).lower(), reply_post["user_id"], reply_post["create_at"], reply_post["id"], "reply"))
    for reaction in hub.reactions(post["id"]):
        kind = {STOP_EMOJI: "stop", GO_EMOJI: "go"}.get(reaction.get("emoji_name"))
        if kind and reaction.get("user_id") != bot_id and reaction.get("create_at", 0) > since:
            ref = f"reaction:{reaction['user_id']}:{reaction['emoji_name']}:{reaction.get('create_at', 0)}"
            found.append(Command(kind, reaction["user_id"], reaction.get("create_at", 0), ref, "reaction"))
    return sorted(found, key=lambda c: c.at)


def approvers(ctx: ActionContext) -> set:
    """Hub user ids whose ``go`` counts: the playbook run's owner and the release manager and
    backups in RELEASE_AGENT_PEOPLE."""
    ids = {ctx.run.get("owner_user_id")} if ctx.run and ctx.run.get("owner_user_id") else set()
    for role in ("release_manager", "release_backup"):
        for username in ctx.settings.people.roles.get(role) or []:
            try:
                user = ctx.services.hub.user_by_username(username)
            except Exception:  # noqa: BLE001 - one lookup failing doesn't block the others
                user = None
            if user and not user.get("delete_at"):
                ids.add(user["id"])
    return ids


def username(ctx: ActionContext, user_id: str) -> str:
    try:
        user = ctx.services.hub.user(user_id)
    except Exception:  # noqa: BLE001
        user = None
    return (user or {}).get("username") or "someone"


def first_go(ctx: ActionContext, post: dict, state: dict, since: int, what: str) -> Command | None:
    """The first approved ``go`` after ``since``. Anyone else's ``go`` gets one refusal reply."""
    allowed = None
    refused = set(state.get("refused") or [])
    for command in commands(ctx, post, since):
        if command.kind != "go":
            continue
        if allowed is None:
            allowed = approvers(ctx)
        if command.user_id in allowed:
            return command
        if command.ref not in refused and ctx.execute:
            refused.add(command.ref)
            reply(ctx, post, text.render("refused", what=what))
    if ctx.execute and refused != set(state.get("refused") or []):
        state["refused"] = sorted(refused)
        save_state(ctx, post, state)
    return None


def first_stop(ctx: ActionContext, post: dict, since: int) -> Command | None:
    return next((c for c in commands(ctx, post, since) if c.kind == "stop"), None)


# ── Workflow runs in delivery-platform ───────────────────────────────────────────────

def dispatch(ctx: ActionContext, workflow: str, inputs: dict, target: str, trigger: str) -> dict:
    """Start one delivery-platform workflow and record it for release-agent-log."""
    run_cfg = ctx.rules["release_actions"]["delivery_platform"]
    started = ctx.now.isoformat(timespec="seconds")
    details = ctx.services.dispatcher.dispatch(run_cfg["repo"], workflow, run_cfg["ref"], inputs)
    record = {"workflow": workflow, "target": target, "at": started,
              "run_id": details.get("workflow_run_id"), "url": details.get("html_url", "")}
    ctx.audit.append(text.render("audit", workflow=workflow, short_version=ctx.release.short_version, target=target,
                                 trigger=trigger, run_text=f"{workflow} runs",
                                 run_url=record["url"] or f"https://github.com/{run_cfg['repo']}/actions/workflows/{workflow}"))
    return record


def runs_state(ctx: ActionContext, records: list[dict]) -> tuple[str, list[str]]:
    """("success" | "failure" | "running", [Hub links to the runs]) for the dispatched runs."""
    run_cfg = ctx.rules["release_actions"]["delivery_platform"]
    repo, links, conclusions = run_cfg["repo"], [], []
    claimed = set()
    for record in records:
        run = None
        if record.get("run_id"):
            run = ctx.services.dispatcher.workflow_run(repo, record["run_id"])
        else:
            # Older API answers have no run id: take the first run of that workflow started
            # within a few minutes of the dispatch that another record hasn't claimed.
            at = datetime.fromisoformat(record["at"])
            since = (at - timedelta(minutes=1)).isoformat(timespec="seconds")
            candidates = sorted(ctx.services.dispatcher.workflow_runs(repo, record["workflow"], since),
                                key=lambda r: r.get("created_at", ""))
            for candidate in candidates:
                created = datetime.fromisoformat(candidate["created_at"].replace("Z", "+00:00"))
                if candidate["id"] not in claimed and created <= at + timedelta(minutes=10):
                    run = candidate
                    claimed.add(candidate["id"])
                    break
        if run is None:
            started = datetime.fromisoformat(record["at"])
            conclusions.append("failure" if ctx.now - started > RUN_TIMEOUT else "running")
            continue
        links.append(text.link(f"{record['target']} run", run.get("html_url", "")))
        if run.get("status") != "completed":
            started = datetime.fromisoformat(record["at"])
            conclusions.append("failure" if ctx.now - started > RUN_TIMEOUT else "running")
        else:
            conclusions.append("success" if run.get("conclusion") == "success" else "failure"
                               if run.get("conclusion") in FAILED_CONCLUSIONS else "running")
    if "failure" in conclusions:
        return "failure", links
    if conclusions and all(c == "success" for c in conclusions):
        return "success", links
    return "running", links
