"""Prepare the release metrics (T-0): the release's column in the Release Scorecard.

Tab "Cloud & Self-Hosted": one row per metric (A to D: Type, Metric, Data source, Target), one
column per release, newest first from column E, headed "vX.Y (Month)". A missing column is
inserted at E with the formatting of the column to its right. Each metric is found by its text in
column B (rules.yml scorecard_metrics), never by row number; one that isn't found is reported. A
cell that has a value is never overwritten. A count that fails is reported and left blank, never 0.
"""

import re
from datetime import date, datetime, timedelta

from ..checks import format_values
from . import engine, text, writers
from .engine import ActionContext, Status

MM = "mattermost/mattermost"


def norm(value) -> str:
    return " ".join(str(value or "").split()).casefold()


def column_letter(index: int) -> str:
    letters = ""
    index += 1
    while index:
        index, rest = divmod(index - 1, 26)
        letters = chr(65 + rest) + letters
    return letters


def placeholders(ctx: ActionContext, rc1: date | None, next_fix: str) -> dict:
    day = ctx.release.release_day
    prev = date(day.year - (day.month == 1), (day.month - 2) % 12 + 1, 17)
    return {**ctx.vars, "fix_version": ctx.fix_version, "next_fix_version": next_fix,
            "rc1_date": rc1.isoformat() if rc1 else "", "release_day": day.isoformat(), "prev_17th": prev.isoformat(),
            "week_after": (day + timedelta(days=7)).isoformat(), "short_version": ctx.release.short_version}


def _tag_date(ctx: ActionContext, tag: str) -> date | None:
    if tag not in ctx.services.github.tags_with_prefix(MM, tag):
        return None
    return datetime.fromisoformat(ctx.services.github.tag_date(MM, tag).replace("Z", "+00:00")).date()


def rc1_date(ctx: ActionContext) -> date | None:
    return ctx.release.milestones.get("rc1") or _tag_date(ctx, f"{ctx.release.version}-rc1")


def value_for(ctx: ActionContext, metric: dict, values: dict) -> tuple[str | None, str]:
    """(the value to write or None, why not)."""
    source = metric["source"]
    if metric.get("after_days") and ctx.today < ctx.release.release_day + timedelta(days=metric["after_days"]):
        when = ctx.release.release_day + timedelta(days=metric["after_days"])
        return None, f"filled on {text.day_words(when)}"
    if source == "rc1_date":
        day = rc1_date(ctx)
        return (f"{day:%Y/%m/%d}", "") if day else (None, "no RC-1 event or rc1 tag")
    if source == "rc_count":
        tags = ctx.services.github.tags_with_prefix(MM, f"{ctx.release.version}-rc")
        return str(sum(1 for t in tags if re.fullmatch(rf"{re.escape(ctx.release.version)}-rc\d+", t))), ""
    if source == "days_before_16th":
        day = _tag_date(ctx, ctx.release.version)
        return (str(16 - day.day), "") if day else (None, f"{ctx.release.version} isn't tagged")
    if source == "jira_count":
        return str(ctx.services.jira.count(format_values(metric["jql"], values))), ""
    if source == "github_count":
        return str(len(ctx.services.github.search_issues(format_values(metric["query"], values)))), ""
    raise ValueError(f"unknown metric source {source}")


def main_post(ctx: ActionContext) -> dict | None:
    return next((p for p in engine.find_posts(ctx, ctx.channel) if engine.key_of(p) == "main"), None)


def run(ctx: ActionContext) -> Status:
    release = ctx.release
    due = ctx.due()
    post = main_post(ctx)
    state = engine.state_of(post)
    done = state.get("state") == "done"
    pending = state.get("pending") or []
    if done and (not pending or not ctx.execute):
        return Status(engine.DONE, f"{engine.DONE}: {state.get('summary')}.", "done", done=True,
                      proof_url=state.get("column_url", ""), proof=state.get("proof", ""))
    if due is None or ctx.today < due:
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: prepare the release metrics "
                                      f"({text.day_words(due) if due else 'Release Day'}).", "not_due")
    if not ctx.execute:
        return Status(engine.WAITING, f"{engine.WAITING}: the release metrics are filled in once the release is closed in Jira.",
                      "pending")
    versions_closed = next((v for v in ctx.services.jira.versions(ctx.spec["jira_project"])
                            if v.get("name") == ctx.fix_version and v.get("released")), None)
    if not versions_closed:
        return Status(engine.WAITING, f"{engine.WAITING}: the release metrics wait for {ctx.fix_version} to be closed in Jira.",
                      "waiting_close")
    sheet_id = ctx.settings.scorecard_sheet_id
    if not sheet_id:
        return Status(engine.ATTENTION, f"{engine.ATTENTION}: RELEASE_ACTIONS_SCORECARD_SHEET_ID isn't set.", "no_sheet",
                      attention=["Set RELEASE_ACTIONS_SCORECARD_SHEET_ID to fill in the release metrics."])
    cfg = ctx.spec["sheet"]
    sheets = ctx.services.sheets
    tab = next((t for t in sheets.tabs(sheet_id) if t["title"] == cfg["tab"]), None)
    if tab is None:
        return Status(engine.ATTENTION, f"{engine.ATTENTION}: the scorecard has no “{cfg['tab']}” tab.", "no_tab",
                      attention=[f"The Release Scorecard has no “{cfg['tab']}” tab."])
    quoted = "'" + cfg["tab"].replace("'", "''") + "'"
    grid = sheets.values(sheet_id, f"{quoted}!A1:ZZ")
    header = grid[0] if grid else []
    heading = f"{release.short_version} ({release.release_day:%B})"
    first = cfg["first_release_column"]
    col = next((i for i, h in enumerate(header) if i >= first and
                (norm(h) == norm(heading) or norm(h).startswith(norm(f"{release.short_version} (")))), None)
    live = ctx.settings.is_live(ctx.action)
    insert = col is None
    if insert:
        col = first
        grid = [row[:first] + [""] + row[first:] for row in grid]
    letter = column_letter(col)
    rows = {norm(row[1]): index for index, row in enumerate(grid) if len(row) > 1 and norm(row[1])}
    from .versions import plan as plan_versions
    milestones = [m.get("title", "") for m in ctx.services.github.milestones(MM)]
    nxt = plan_versions(ctx, ctx.services.jira.versions(ctx.spec["jira_project"]), milestones).upcoming[0].name
    values = placeholders(ctx, rc1_date(ctx), nxt)
    writes, lines, left, filled, failed = [], [], [], 0, []
    metrics = ctx.rules["scorecard_metrics"]
    for name, metric in metrics.items():
        index = rows.get(norm(name))
        if index is None:
            left.append(f"{name} (not found in column B)")
            continue
        row = grid[index]
        current = row[col] if len(row) > col else ""
        if str(current).strip():
            filled += 1
            continue
        try:
            value, why = value_for(ctx, metric, values)
        except Exception as err:  # noqa: BLE001 - reported and left blank, never written as 0
            from ..agent import private_error
            failed.append(name)
            left.append(f"{name} (couldn't count: {private_error(err)})")
            continue
        if value is None:
            left.append(f"{name} ({why})")
            continue
        writes.append((f"{quoted}!{letter}{index + 1}", value))
        lines.append(f"{name}: {value}")
        filled += 1
    left += [f"{name} (left for you)" for name in ctx.rules.get("scorecard_manual", [])]
    total = len(metrics)
    url = writers.tab_url(sheet_id, tab["sheetId"], f"{letter}1")
    if not live:
        plan = (["Insert a column at E headed " + heading] if insert else []) + [f"Write {line}" for line in lines] + \
               [f"Leave {item}" for item in left]
        message = text.render("dry-run", what=f"would fill {len(writes)} cells of the {release.short_version} scorecard column",
                              plan=text.bullet_list(plan))
        if post is None and ctx.channel:
            engine.create_post(ctx, ctx.channel, message, "main", {"state": "dry_run"})
        elif post is not None and post.get("message") != ctx.say(message):
            engine.save_state(ctx, post, {"state": "dry_run"}, message)
        return Status(engine.DRY, f"{engine.DRY}: would fill {len(writes)} scorecard cells.", f"dry_run: {len(writes)} cells")
    if insert:
        sheets.batch_update(sheet_id, [{"insertDimension": {"range": {"sheetId": tab["sheetId"], "dimension": "COLUMNS",
                                                                      "startIndex": col, "endIndex": col + 1},
                                                            "inheritFromBefore": False}}])
        sheets.update(sheet_id, f"{quoted}!{letter}1", [[heading]])
    for a1, value in writes:
        sheets.update(sheet_id, a1, [[value]])
    later = [name for name, metric in metrics.items() if metric.get("after_days") and any(item.startswith(name) for item in left)]
    summary = f"filled {filled} of {total} scorecard metrics"
    left_text = f" Left for you: {'; '.join(left)}." if left else ""
    if not done:
        message = text.render("metrics-done", filled=filled, total=total, short_version=release.short_version,
                              column_url=url, left=left_text)
        new_state = {"state": "done", "summary": summary, "column_url": url, "pending": later,
                     "proof": f"Filled {filled} of {total}.{left_text}"}
        if post:
            engine.save_state(ctx, post, new_state, message)
        else:
            engine.create_post(ctx, ctx.channel, message, "main", new_state)
    elif writes:
        state.update(pending=later, summary=summary)
        engine.save_state(ctx, post, state)
        engine.reply(ctx, post, text.render("done", summary="filled " + "; ".join(lines) + "."))
    return Status(engine.DONE, f"{engine.DONE}: {summary}.", f"done: {filled} of {total}", done=True, proof_url=url,
                  proof=f"Filled {filled} of {total} in the {text.link(f'{release.short_version} scorecard column', url)}.{left_text}",
                  attention=[f"Release metrics: couldn't count {name}." for name in failed])
