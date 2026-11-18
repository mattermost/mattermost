"""Fill in the QA feature tracking sheet (T-16, then daily until T-15).

One tab per release, newest first, named like "v12.1 / Mobile v2.46 / Desktop v6.4". A tab that
starts with "vX.Y /" is used as it is; otherwise the newest tab is duplicated (header, widths and
formatting), its data rows cleared, renamed and put first. One row per Resolved Epic or Story with
the release's fix version, matched on its Jira link so a rerun adds nothing. Rows already there,
including QA's mobile and desktop rows, are never changed. Sheet contents go to Hub only.
"""

import re

from .. import release_calendar
from . import engine, text, writers
from .engine import ActionContext, Status

KEY = re.compile(r"\bMM-\d+\b")
COMPANION = re.compile(r"\b(Mobile|Desktop)\s+v(\d+\.\d+)\b", re.IGNORECASE)


def companions(events: list, release, release_day_marker: str = "Release Day") -> dict:
    """{"Mobile": "v2.47", "Desktop": "v6.5"} shipping with the release, from the calendar's
    Release Day events: one that also names the server version wins, else one in Release Day's month."""
    found, fallback = {}, {}
    day = release.release_day
    for event in events:
        if release_day_marker.lower() not in event.summary.lower():
            continue
        names_server = (release.major, release.minor, 0) in release_calendar.server_versions(event.summary)
        same_month = day and (event.start.year, event.start.month) == (day.year, day.month)
        for kind, version in COMPANION.findall(event.summary):
            kind = kind.capitalize()
            if names_server:
                found[kind] = f"v{version}"
            elif same_month:
                fallback.setdefault(kind, f"v{version}")
    return {**fallback, **found}


def tab_name(release, versions: dict) -> str:
    parts = [release.short_version] + [f"{kind} {versions[kind]}" for kind in ("Mobile", "Desktop") if kind in versions]
    return " / ".join(parts)


def quote(title: str) -> str:
    return "'" + title.replace("'", "''") + "'"


def find_tab(tabs: list[dict], release) -> dict | None:
    prefix = f"{release.short_version} /"
    return next((t for t in tabs if t["title"].startswith(prefix) or t["title"] == release.short_version), None)


def _team(value) -> str:
    if isinstance(value, dict):
        return value.get("name") or value.get("title") or value.get("value") or ""
    return value or ""


def ticket_row(ctx: ActionContext, issue: dict, headers: list[str]) -> list:
    cfg = ctx.spec["sheet"]
    fields = issue.get("fields") or {}
    values = {
        cfg["columns"]["release"]: ctx.release.short_version,
        cfg["columns"]["feature"]: fields.get("summary", ""),
        cfg["columns"]["team"]: _team(fields.get(cfg["team_field"])),
        cfg["columns"]["dev"]: (fields.get("assignee") or {}).get("displayName", ""),
        cfg["columns"]["link"]: f"{cfg['browse_url']}{issue['key']}",
    }
    return [values.get(header.strip(), "") for header in headers]


def main_post(ctx: ActionContext) -> dict | None:
    return next((p for p in engine.find_posts(ctx, ctx.channel) if engine.key_of(p) == "main"), None)


def describe(ctx: ActionContext, post: dict | None, due, until) -> Status:
    state = engine.state_of(post)
    if state.get("state") == "done":
        link = text.link(f"{ctx.release.short_version} QA feature tracking tab", state.get("tab_url", ""))
        return Status(engine.DONE, f"{engine.DONE}: {state.get('rows', 0)} tickets in the {link}.", "done", done=True,
                      proof_url=state.get("tab_url", ""), proof=f"{state.get('rows', 0)} tickets in the {link}")
    if state.get("state") == "dry_run":
        return Status(engine.DRY, f"{engine.DRY}: would add {state.get('would_add', 0)} tickets to the "
                                  f"{ctx.release.short_version} QA feature tracking tab.", "dry_run")
    if due is None or ctx.today < due:
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: fill in the QA feature tracking sheet "
                                      f"({text.day_words(due) if due else 'not on the calendar'}).", "not_due")
    if until and ctx.today > until:
        # Filled in by hand, or before the agent did this: nothing to flag, and nothing to tick.
        return Status(engine.CLOSED, f"{engine.CLOSED}: the agent didn't fill in the QA feature tracking sheet "
                                     f"(its window ended {text.day_words(until)}).", "window_passed")
    return Status(engine.WAITING, f"{engine.WAITING}: the QA feature tracking sheet is filled in at the next run.", "pending")


def run(ctx: ActionContext) -> Status:
    due, until = ctx.due(), ctx.due("until")
    post = main_post(ctx)
    if not ctx.execute or due is None or ctx.today < due or (until and ctx.today > until):
        return describe(ctx, post, due, until)
    sheet_id = ctx.settings.qa_sheet_id
    if not sheet_id:
        return Status(engine.ATTENTION, f"{engine.ATTENTION}: RELEASE_ACTIONS_QA_SHEET_ID isn't set.", "no_sheet",
                      attention=["Set RELEASE_ACTIONS_QA_SHEET_ID to fill in the QA feature tracking sheet."])
    cfg = ctx.spec["sheet"]
    from ..checks import format_values
    issues = ctx.services.jira.search(format_values(cfg["jql"], ctx.vars), extra_fields=[cfg["team_field"]])
    sheets = ctx.services.sheets
    tabs = sheets.tabs(sheet_id)
    tab = find_tab(tabs, ctx.release)
    name = tab["title"] if tab else tab_name(ctx.release, companions(ctx.events, ctx.release))
    source = tabs[0] if tabs else None
    if tab:
        grid = sheets.values(sheet_id, f"{quote(name)}!A1:Z")
        headers = [str(h) for h in (grid[0] if grid else [])]
    else:
        if source is None:
            raise ValueError("The QA sheet has no tab to copy")
        grid = []
        headers = [str(h) for h in (sheets.values(sheet_id, f"{quote(source['title'])}!1:1") or [[]])[0]]
    missing_headers = [h for h in cfg["columns"].values() if h not in [x.strip() for x in headers]]
    if missing_headers:
        return Status(engine.ATTENTION, f"{engine.ATTENTION}: the QA sheet has no column named "
                                        f"{', '.join(missing_headers)}, so nothing was added.", "bad_header",
                      attention=[f"The QA sheet's header has no {', '.join(missing_headers)} column."])
    link_col = [x.strip() for x in headers].index(cfg["columns"]["link"])
    have = {m.group(0) for row in grid[1:] if len(row) > link_col for m in KEY.finditer(str(row[link_col]))}
    new = sorted((i for i in issues if i["key"] not in have), key=lambda i: int(i["key"].split("-")[1]))
    rows = [ticket_row(ctx, issue, headers) for issue in new]
    lines = [f"{issue['key']}: {(issue.get('fields') or {}).get('summary', '')}" for issue in new]
    state = engine.state_of(post)

    if not ctx.settings.is_live(ctx.action):
        plan = (f"would create the tab “{name}” from “{source['title']}” and " if not tab else f"in the tab “{name}”, ") + \
               f"would add {len(rows)} of {len(issues)} Resolved Epics and Stories"
        message = text.render("dry-run", what=plan, plan=text.bullet_list(lines) or "- Nothing new to add.")
        new_state = {"state": "dry_run", "would_add": len(rows), "day": ctx.today.isoformat()}
        if post:
            if post.get("message") != ctx.say(message):
                engine.save_state(ctx, post, new_state, message)
        elif ctx.channel:
            engine.create_post(ctx, ctx.channel, message, "main", new_state)
        return Status(engine.DRY, f"{engine.DRY}: would add {len(rows)} tickets to the {ctx.release.short_version} QA "
                                  "feature tracking tab.", f"dry_run: {len(rows)} rows")

    created = ""
    if not tab:
        reply = sheets.batch_update(sheet_id, [{"duplicateSheet": {
            "sourceSheetId": source["sheetId"], "insertSheetIndex": 0, "newSheetName": name}}])
        props = ((reply.get("replies") or [{}])[0].get("duplicateSheet") or {}).get("properties") or {}
        tab = {"title": name, "sheetId": props.get("sheetId", 0)}
        sheets.clear(sheet_id, f"{quote(name)}!A2:Z")
        created = f" The tab is new, copied from “{source['title']}”."
    if rows:
        sheets.append(sheet_id, f"{quote(name)}!A1", rows)
    url = writers.tab_url(sheet_id, tab["sheetId"])
    total = len(have) + len(rows)
    if post is None or state.get("state") != "done":
        message = text.render("qa-sheet-done", count=f"{len(rows)} ticket{'s' if len(rows) != 1 else ''}",
                              short_version=ctx.release.short_version, tab_url=url, created=created,
                              rows=text.bullet_list(lines))
        new_state = {"state": "done", "tab_url": url, "rows": total}
        if post:
            engine.save_state(ctx, post, new_state, message)
        else:
            engine.create_post(ctx, ctx.channel, message, "main", new_state)
    elif rows:
        state["rows"] = total
        engine.save_state(ctx, post, state)
        engine.reply(ctx, post, text.render("done", summary=f"added {len(rows)} more tickets that reached Resolved:\n\n"
                                                           + text.bullet_list(lines)))
    status = describe(ctx, main_post(ctx) or post, due, until)
    status.public = f"done: {len(rows)} rows added"
    return status
