"""Notice, stop window, then start the delivery-platform workflow; or, for an RC proposal, wait for
an approved ``go``. One Hub post a day holds each attempt:

  noticed  → stopped (a ``stop`` from anyone)  → started (a ``go`` from the release manager or backup)
           → started (the window passed, or an approved ``go``)
  proposed → started (an approved ``go``)
  started  → done (the run succeeded and the result is there) | failed (never retried on its own)
  failed   → started (an approved ``go``)
  dry_run  → (a new notice on the next working day while still needed)
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from . import engine, text
from .engine import ActionContext, Status


DAY_KEY = re.compile(r"\d{4}-\d{2}-\d{2}")


@dataclass
class Gate:
    what: str  # "the release-12.2 branch cut"
    notice: str  # template name
    values: dict  # template values, besides when and mention
    dispatches: list  # [(workflow, inputs, target)]
    channel: str
    key: str = ""  # post key; "" means one post per day
    window: int = 60  # working minutes; 0 with ``proposal``
    proposal: bool = False  # needs an approved go; no stop window
    mention_role: str = "release_manager"
    # (ctx, post, state) -> Status, once the runs succeeded: checks the result and posts Done.
    on_success: Callable = None
    plan_lines: list = field(default_factory=list)  # dry-run detail (Hub only)
    failure: str = ""
    notice_mention: bool = False  # mention the release manager in the notice itself
    also_in: list = field(default_factory=list)  # other channels an earlier post may be in  # "the branch cut workflow failed"


def latest_post(ctx: ActionContext, gate: Gate) -> dict | None:
    channels = [gate.channel] + [c for c in gate.also_in if c and c != gate.channel]
    posts = sorted((p for channel in channels for p in engine.find_posts(ctx, channel)),
                   key=lambda p: p.get("create_at", 0), reverse=True)
    if gate.key:
        posts = [p for p in posts if engine.key_of(p) == gate.key]
    else:
        posts = [p for p in posts if DAY_KEY.fullmatch(engine.key_of(p))]
    return posts[0] if posts else None


def describe(ctx: ActionContext, gate: Gate, post: dict | None) -> Status:
    """Read only: the action's state from its latest post, for the status post."""
    state = engine.state_of(post)
    kind = state.get("state")
    if kind == "noticed":
        planned = datetime.fromisoformat(state["planned_at"])
        return Status(engine.WAITING, f"{engine.WAITING}: notice sent, {gate.what} starts {text.when(planned)} "
                                      "unless someone replies `stop`.", "noticed")
    if kind == "proposed":
        return Status(engine.WAITING, f"{engine.WAITING}: {gate.what} proposal sent, waiting for the release manager.", "proposed")
    if kind == "stopped":
        stopped = datetime.fromisoformat(state["stopped_at"])
        return Status(engine.STOPPED, f"{engine.STOPPED}: {gate.what} stopped by {state.get('stopped_by', 'someone')} "
                                      f"on {text.day_words(stopped.date())} at {text.time_only(stopped)}.", "stopped")
    if kind == "started":
        return Status(engine.STARTED, f"{engine.STARTED}: {gate.what} is running.", "started")
    if kind == "failed":
        return Status(engine.FAILED, f"{engine.FAILED}: {gate.what} failed; see the notice thread.", "failed",
                      attention=[f"{engine.FAILED}: {gate.what} failed and isn't retried on its own."])
    if kind == "dry_run":
        return Status(engine.DRY, f"{engine.DRY}: {gate.what} would have started today.", "dry_run")
    if kind == "done":
        return Status(engine.DONE, f"{engine.DONE}: {state.get('summary') or gate.what}.", "done")
    return Status(engine.WAITING, f"{engine.WAITING}: {gate.what} has no notice yet.", "pending")


def advance(ctx: ActionContext, gate: Gate) -> Status:
    """One step for the action. Read-only when ``ctx.execute`` is False."""
    post = latest_post(ctx, gate)
    if not ctx.execute:
        return describe(ctx, gate, post)
    state = engine.state_of(post)
    kind = state.get("state")
    if kind == "started":
        return follow(ctx, gate, post, state)
    if kind == "noticed":
        noticed = engine.ms(datetime.fromisoformat(state["noticed_at"]))
        stop = engine.first_stop(ctx, post, noticed)
        if stop:
            return stopped(ctx, gate, post, state, stop)
        go = engine.first_go(ctx, post, state, noticed, gate.what)
        if go or ctx.now >= datetime.fromisoformat(state["planned_at"]):
            return start(ctx, gate, post, state, f"{engine.username(ctx, go.user_id)}'s go" if go else "schedule")
        return describe(ctx, gate, post)
    if kind == "proposed":
        go = engine.first_go(ctx, post, state, 0, gate.what)
        if go:
            return start(ctx, gate, post, state, f"{engine.username(ctx, go.user_id)}'s go")
        return describe(ctx, gate, post)
    if kind in ("stopped", "failed"):
        since = engine.ms(datetime.fromisoformat(state.get("stopped_at") or state.get("failed_at")))
        go = engine.first_go(ctx, post, state, since, gate.what)
        if go:
            return start(ctx, gate, post, state, f"{engine.username(ctx, go.user_id)}'s go")
        if kind == "stopped" and not gate.key and engine.key_of(post) < ctx.today.isoformat():
            return notice(ctx, gate)
        return describe(ctx, gate, post)
    if kind == "dry_run":
        if not gate.key and engine.key_of(post) < ctx.today.isoformat():
            return notice(ctx, gate)
        return describe(ctx, gate, post)
    if kind == "done":
        return describe(ctx, gate, post)
    return notice(ctx, gate)


def notice(ctx: ActionContext, gate: Gate) -> Status:
    if not gate.channel:
        return Status(engine.ATTENTION, f"{engine.ATTENTION}: there's no channel to post the notice for {gate.what} in.",
                      "no channel", attention=[f"There's no channel to post the notice for {gate.what} in."])
    if not engine.is_working(ctx.now, ctx.holidays):
        return Status(engine.WAITING, f"{engine.WAITING}: the notice for {gate.what} goes out in working hours.", "pending")
    mention = ctx.settings.people.mention(gate.mention_role) if gate.notice_mention else ""
    key = gate.key or ctx.today.isoformat()
    if gate.proposal:
        message = text.render(gate.notice, mention=mention, **gate.values)
        state = {"state": "proposed", "proposed_at": ctx.now.isoformat(timespec="seconds"), "values": _plain(gate.values)}
    else:
        planned = engine.add_working_minutes(ctx.now, gate.window, ctx.holidays)
        message = text.render(gate.notice, when=text.when(planned), mention=mention, **gate.values)
        state = {"state": "noticed", "noticed_at": ctx.now.isoformat(timespec="seconds"),
                 "planned_at": planned.isoformat(timespec="seconds")}
    if not ctx.settings.is_live(ctx.action):
        message = f"{message}\n\n_Dry run: this shows what the live agent would post. Nothing will be started._"
    post = engine.create_post(ctx, gate.channel, message, key, state)
    return describe(ctx, gate, post)


def update_proposal(ctx: ActionContext, gate: Gate, post: dict) -> None:
    """Rewrite an open proposal in place when more fixes landed."""
    state = engine.state_of(post)
    if state.get("state") != "proposed" or state.get("values") == _plain(gate.values) or not ctx.execute:
        return
    state["values"] = _plain(gate.values)
    message = text.render(gate.notice, mention=ctx.settings.people.mention(gate.mention_role), **gate.values)
    if not ctx.settings.is_live(ctx.action):
        message = f"{message}\n\n_Dry run: this shows what the live agent would post. Nothing will be started._"
    engine.save_state(ctx, post, state, message)


def _plain(values: dict) -> dict:
    return {k: v for k, v in values.items() if isinstance(v, (str, int))}


def stopped(ctx: ActionContext, gate: Gate, post: dict, state: dict, stop: engine.Command) -> Status:
    who = engine.username(ctx, stop.user_id)
    at = engine.from_ms(stop.at)
    state.update(state="stopped", stopped_by=who, stopped_at=at.isoformat(timespec="seconds"))
    engine.save_state(ctx, post, state)
    engine.reply(ctx, post, text.render("stopped", what=gate.what, who=who,
                                        time=f"{text.day_words(at.date())} at {text.time_only(at)}"))
    return describe(ctx, gate, post)


def start(ctx: ActionContext, gate: Gate, post: dict, state: dict, trigger: str) -> Status:
    if not ctx.settings.is_live(ctx.action):
        state["state"] = "dry_run"
        engine.save_state(ctx, post, state)
        plan = [f"Start {workflow} with {', '.join(f'{k}={v}' for k, v in inputs.items())} ({target})"
                for workflow, inputs, target in gate.dispatches] + gate.plan_lines
        engine.reply(ctx, post, text.render("dry-run", what=f"would start {gate.what} now ({trigger})",
                                            plan=text.bullet_list(plan)))
        return describe(ctx, gate, post)
    records = []
    try:
        for workflow, inputs, target in gate.dispatches:
            records.append(engine.dispatch(ctx, workflow, inputs, target, trigger))
    except Exception as err:  # noqa: BLE001 - recorded as failed, never retried on its own
        state.update(state="failed", failed_at=ctx.now.isoformat(timespec="seconds"), runs=records)
        engine.save_state(ctx, post, state)
        engine.reply(ctx, post, text.render("failed", reason=f"{gate.what} couldn't be started ({type(err).__name__})",
                                            runs="no run was started" if not records else "some runs were started",
                                            mention=ctx.settings.people.mention(gate.mention_role)))
        return describe(ctx, gate, post)
    state.update(state="started", started_at=ctx.now.isoformat(timespec="seconds"), runs=records, trigger=trigger)
    engine.save_state(ctx, post, state)
    links = ", ".join(text.link(f"{r['target']} run", r["url"]) for r in records if r["url"]) or "runs listed in release-agent-log"
    engine.reply(ctx, post, text.render("started", what=gate.what, trigger=trigger, runs=links))
    return describe(ctx, gate, post)


def follow(ctx: ActionContext, gate: Gate, post: dict, state: dict) -> Status:
    result, links = engine.runs_state(ctx, state.get("runs") or [])
    if result == "running":
        return describe(ctx, gate, post)
    if result == "success" and gate.on_success:
        return gate.on_success(ctx, post, state)
    return fail(ctx, gate, post, state, gate.failure or f"the workflow for {gate.what} failed", links)


def fail(ctx: ActionContext, gate: Gate, post: dict, state: dict, reason: str, links: list) -> Status:
    state.update(state="failed", failed_at=ctx.now.isoformat(timespec="seconds"))
    engine.save_state(ctx, post, state)
    engine.reply(ctx, post, text.render("failed", reason=reason,
                                        runs=", ".join(links) or "the run wasn't found",
                                        mention=ctx.settings.people.mention(gate.mention_role)))
    return describe(ctx, gate, post)


def finish(ctx: ActionContext, gate: Gate, post: dict, state: dict, summary: str, message: str) -> Status:
    state.update(state="done", done_at=ctx.now.isoformat(timespec="seconds"), summary=summary)
    engine.save_state(ctx, post, state)
    engine.reply(ctx, post, message)
    return describe(ctx, gate, post)
