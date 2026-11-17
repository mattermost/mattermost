"""Release candidates: RC-1 at T-15 (notice, then a stop window), later RCs only as proposals
that the release manager or a backup approves with ``go``. Each build is cut with
release-mattermost-platform.yml in delivery-platform, which works out the next rcN from the
release's latest tag, so a cut only starts when that tag is the one before it. QA is told in the
release channel when the build is done."""

import re
from datetime import datetime

from . import engine, gated, text
from .engine import ActionContext, Status

MM = "mattermost/mattermost"
JIRA_KEY = re.compile(r"\b(MM-\d+)\b")
PR_REFS = re.compile(r"(\s*\(#\d+\))+\s*$")


def fix_line(commit: dict) -> str:
    """``MM-12345: title`` for a commit on the release branch."""
    first = ((commit.get("commit") or {}).get("message") or "").split("\n", 1)[0].strip()
    title = PR_REFS.sub("", first)
    key = JIRA_KEY.search(title)
    if not key:
        return title
    rest = re.sub(rf"^\W*{key.group(1)}\W*", "", title) if title.find(key.group(1)) < 3 else title
    return f"{key.group(1)}: {rest.strip() or title}"


def _tags(ctx: ActionContext) -> list[int]:
    if ctx.execute:
        found = ctx.services.github.tags_with_prefix(MM, f"{ctx.release.version}-rc")
        return sorted(int(m.group(1)) for t in found if (m := re.fullmatch(rf"{re.escape(ctx.release.version)}-rc(\d+)", t)))
    return list(ctx.rc_numbers)


def _inputs(ctx: ActionContext) -> dict:
    values = {"major": ctx.release.major, "minor": ctx.release.minor}
    return {k: (v.format_map(values) if isinstance(v, str) else v) for k, v in ctx.spec["run"]["inputs"].items()}


def _build_url(ctx: ActionContext, tag: str) -> str:
    return ctx.spec["run"]["build_url"].format(release=tag.lstrip("v"), tag=tag)


def _ready_on_success(ctx: ActionContext, number: int, gate_ref: list):
    tag = f"{ctx.release.version}-rc{number}"

    def on_success(c, post, state):
        gate = gate_ref[0]
        if tag not in c.services.github.tags_with_prefix(MM, tag):
            return gated.fail(c, gate, post, state, f"the release workflow finished, but {tag} isn't tagged", [])
        channel = c.settings.release_channels.get(c.release.short_version) or c.release_channel or gate.channel
        ready = c.services.hub.create_post(channel, c.say(text.render(
            "rc-ready", rc_tag=tag, build_url=_build_url(c, tag), mention=c.settings.people.mention("qa"))))
        state["ready_post"] = ready.get("id", "")
        return gated.finish(c, gate, post, state, f"{tag} cut and QA notified",
                            text.render("done", summary=f"{tag} is cut and QA was told in the release channel."))
    return on_success


def _rc1_gate(ctx: ActionContext) -> gated.Gate:
    ref = []
    tag = f"{ctx.release.version}-rc1"
    gate = gated.Gate(what=f"the {tag} cut", notice="rc-notice", values={"rc_tag": tag}, channel=ctx.channel,
                      dispatches=[(ctx.spec["run"]["workflow"], _inputs(ctx), tag)], window=ctx.spec["stop_window"],
                      on_success=_ready_on_success(ctx, 1, ref), failure="the RC-1 build workflow failed")
    ref.append(gate)
    return gate


def _proposal_gate(ctx: ActionContext, number: int, fixes: list[str]) -> gated.Gate:
    ref = []
    tag, previous = f"{ctx.release.version}-rc{number}", f"rc{number - 1}"
    gate = gated.Gate(
        what=f"the {tag} cut", notice="rc-proposal", key=f"rc{number}", channel=ctx.channel, proposal=True, window=0,
        values={"rc_tag": tag, "previous_rc": previous, "fix_count": f"{len(fixes)} fix{'es' if len(fixes) != 1 else ''}",
                "fixes": text.bullet_list(fixes)},
        dispatches=[(ctx.spec["run"]["workflow"], _inputs(ctx), tag)], notice_mention=True,
        on_success=_ready_on_success(ctx, number, ref), failure=f"the RC-{number} build workflow failed")
    ref.append(gate)
    return gate


def _blockers(ctx: ActionContext) -> int:
    from ..checks import format_values
    jql = format_values(ctx.spec["blocker_jql"], {"fix_version": ctx.fix_version})
    return len(ctx.services.jira.search(jql))


def run(ctx: ActionContext) -> Status:
    release = ctx.release
    due = ctx.due()
    if release.key not in ctx.branches and not (ctx.execute and ctx.services.github.branch_exists(MM, release.branch)):
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: RC cuts wait for {release.branch}.", "no_branch")
    numbers = _tags(ctx)
    final = release.milestones.get("final_build")
    rc1 = _rc1_gate(ctx)
    rc1_post = gated.latest_post(ctx, rc1)
    rc1_state = engine.state_of(rc1_post)

    if not numbers:
        if release.key in ctx.tags:
            return Status(engine.NOT_NEEDED, f"{engine.NOT_NEEDED}: {release.version} is already tagged.", "not_needed")
        if due is None or ctx.today < due:
            return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: RC-1 cut ({text.day_words(due) if due else 'not on the calendar'}).", "not_due")
        return gated.advance(ctx, rc1)

    if ctx.execute and 1 in numbers and rc1_state.get("state") in ("started", "failed"):
        _settle_rc1(ctx, rc1, rc1_post, rc1_state)
        rc1_state = engine.state_of(gated.latest_post(ctx, rc1))
    rc1_done = rc1_state.get("state") == "done"
    head = Status(engine.DONE, f"{engine.DONE}: {release.version}-rc1 cut and QA notified.", "rc1_done", done=True,
                  proof=f"{release.version}-rc1 is cut and QA was told in the release channel") if rc1_done else \
        Status(engine.DONE, f"{engine.DONE}: {release.version}-rc{numbers[-1]} is tagged.", "tagged")

    latest, number = numbers[-1], numbers[-1] + 1
    if ctx.execute:
        _close_overtaken(ctx, latest)
    gate_probe = _proposal_gate(ctx, number, [])
    open_post = gated.latest_post(ctx, gate_probe)
    open_state = engine.state_of(open_post).get("state")
    if open_state in ("started", "failed", "stopped", "done") or (open_state == "proposed" and not ctx.execute):
        status = gated.advance(ctx, gate_probe) if open_state != "proposed" else gated.describe(ctx, gate_probe, open_post)
        return _combine(head, status)
    if final and ctx.today >= final:
        if open_state == "proposed" and ctx.execute:
            state = engine.state_of(open_post)
            state["state"] = "closed"
            engine.save_state(ctx, open_post, state, text.render(
                "closed", reason=f"no more RCs are proposed after the Final Release Build Cut. {gate_probe.what} wasn't cut."))
        return head
    if not ctx.execute:
        return head
    commits = ctx.services.github.compare_commits(MM, f"{release.version}-rc{latest}", release.branch)
    fixes = [fix_line(c) for c in commits]
    if not fixes:
        return head
    gate = _proposal_gate(ctx, number, fixes)
    if open_state == "proposed":
        gated.update_proposal(ctx, gate, open_post)
        return _combine(head, gated.advance(ctx, gate))
    if _blockers(ctx):
        return _combine(head, Status(engine.WAITING, f"{engine.WAITING}: no RC proposal while a Blocker ticket is open.", "blocked"))
    return _combine(head, gated.advance(ctx, gate))


def _settle_rc1(ctx: ActionContext, gate: gated.Gate, post: dict, state: dict) -> None:
    """rc1 is tagged, so RC-1 is never dispatched again (the workflow would cut rc2). A failed post is
    finished once its runs turn out to have succeeded, or on an approved ``go``."""
    if state["state"] == "started":
        gated.advance(ctx, gate)
        return
    result, _ = engine.runs_state(ctx, state.get("runs") or [])
    since = engine.ms(datetime.fromisoformat(state["failed_at"]))
    if result == "success" or engine.first_go(ctx, post, state, since, gate.what):
        gate.on_success(ctx, post, state)


def _close_overtaken(ctx: ActionContext, latest: int) -> None:
    """A proposal for an RC that has been tagged since (cut by hand) is closed."""
    for post in engine.find_posts(ctx, ctx.channel):
        key, state = engine.key_of(post), engine.state_of(post)
        if state.get("state") == "proposed" and re.fullmatch(r"rc\d+", key) and int(key[2:]) <= latest:
            state["state"] = "closed"
            engine.save_state(ctx, post, state, text.render(
                "closed", reason=f"{ctx.release.version}-{key} was tagged without this proposal."))


def _combine(head: Status, extra: Status) -> Status:
    head.line = f"{head.line}\n  - {extra.line}"
    head.attention += extra.attention
    head.public = f"{head.public}; {extra.public}"
    return head
