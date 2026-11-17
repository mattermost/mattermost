"""Cut the release branches (Release Branch Cut day): create-release-branches-universal.yaml in
delivery-platform, once per repo that doesn't have release-X.Y yet. Done when the runs succeeded
and the branch is in mattermost and enterprise; then version.go on master must list X.Y.0."""

import re

from . import engine, gated, text
from .engine import ActionContext, Status

MM = "mattermost/mattermost"


def _exists(ctx: ActionContext, repo: str) -> bool:
    if repo == MM and not ctx.execute:
        return ctx.release.key in ctx.branches
    return ctx.services.github.branch_exists(repo, ctx.release.branch)


def version_go_attention(ctx: ActionContext) -> list[str]:
    cfg = ctx.spec["run"]
    version = f"{ctx.release.major}.{ctx.release.minor}.0"
    source = ctx.services.github.file_text(MM, cfg["version_go"], "master") or ""
    if f'"{version}"' in source:
        return []
    line = f"version.go on master doesn't list {version} yet"
    try:
        prs = ctx.services.github.search_issues(f"repo:{MM} is:pr is:open author:{cfg['version_go_author']} in:title version")
    except Exception:  # noqa: BLE001 - the flag still goes out without the PR
        prs = []
    pr = next((p for p in prs if re.search(rf"(?<![\d.]){re.escape(version)}(?![\d.])", p.get("title", ""))), None)
    if pr:
        label = f"the open version.go PR #{pr['number']}"
        line += f": {text.link(label, pr.get('html_url', ''))}"
    return [line + "."]


def run(ctx: ActionContext) -> Status:
    release, cfg = ctx.release, ctx.spec["run"]
    repos = cfg["repos"]
    missing = [repo for repo in repos if not _exists(ctx, repo)]
    what = f"the {release.branch} branch cut"
    live = ctx.settings.is_live(ctx.action)
    channel = ctx.channel
    fallback = live and not channel
    if fallback:
        channel = ctx.settings.log_channel

    def on_success(c, post, state):
        still = [repo for repo in repos if not c.services.github.branch_exists(repo, release.branch)]
        if still:
            return gated.fail(c, gate, post, state, f"the branch cut workflow finished, but {release.branch} isn't in "
                              f"{', '.join(r.split('/')[-1] for r in still)}", [])
        summary = f"{release.branch} branches cut in {' and '.join(r.split('/')[-1] for r in repos)}"
        return gated.finish(c, gate, post, state, summary, text.render("done", summary=summary + "."))

    gate = gated.Gate(
        what=what, notice="branch-cut-notice", values={"branch": release.branch}, channel=channel,
        dispatches=[(cfg["workflow"], {"RELEASE_BRANCH": release.branch, "REPOSITORY_NAME": repo.split("/")[-1],
                                       "REPOSITORY_SRC_BRANCH": cfg["source_branch"]}, repo.split("/")[-1])
                    for repo in missing],
        window=ctx.spec["stop_window"], on_success=on_success, failure="the branch cut workflow failed",
        notice_mention=fallback,
        # A notice sent to release-agent-log before the release channel existed is still the notice.
        also_in=[ctx.settings.log_channel] if live else [])

    if not missing:
        post = gated.latest_post(ctx, gate)
        if ctx.execute and engine.state_of(post).get("state") == "started":
            gated.advance(ctx, gate)
        attention = version_go_attention(ctx)
        summary = f"{release.branch} branches cut"
        status = Status(engine.DONE, f"{engine.DONE}: {summary}.", "done", done=not attention,
                        proof=f"{summary} in {' and '.join(r.split('/')[-1] for r in repos)}; version.go on master lists "
                              f"{release.major}.{release.minor}.0", attention=attention)
        if attention:
            status.line += " " + attention[0]
        return status
    due = ctx.due()
    if due is None or ctx.today < due:
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: {what} ({text.day_words(due) if due else 'not on the calendar'}).", "not_due")
    return gated.advance(ctx, gate)
