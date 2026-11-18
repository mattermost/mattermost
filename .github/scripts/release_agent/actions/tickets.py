"""Create the tickets for the next release (T-0): the playbook item "Create tickets for next
release:". The set is in rules.yml (standard_tickets): the plugin tickets and the loadtest epic.

Each is copied from the newest earlier ticket of its kind (found by its summary pattern): type,
description, components, labels and team. Dates, due dates, assignees and version numbers are not
copied; versions and dates in the description become "TBD". Each summary is searched for first,
so a rerun creates nothing. The epic's Start Date is the target release's Feature Complete date.
"""

import copy
import re

from . import engine, text, versions
from .engine import ActionContext, Status

VERSION = re.compile(r"\bv?\d+\.\d+(?:\.\d+)?\b")
WEEKDAYS = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"
MONTH = "|".join(versions.MONTHS)
DATES = re.compile(rf"(?:(?:{WEEKDAYS}),?\s+)?(?:{MONTH})\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s*\d{{4}})?|\b\d{{4}}-\d{{2}}-\d{{2}}\b")
RC_LABEL = re.compile(r"^rc\d+$", re.IGNORECASE)


def scrub(value: str) -> str:
    """Text with dates and version numbers replaced by TBD. Links are left alone."""
    if re.match(r"^\w+://", value):
        return value
    return VERSION.sub("TBD", DATES.sub("TBD", value))


def scrub_adf(node):
    """A copy of an Atlassian Document Format description with scrub() applied to its text."""
    node = copy.deepcopy(node)
    stack = [node]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            if current.get("type") == "text" and isinstance(current.get("text"), str):
                if not any(m.get("type") == "link" for m in current.get("marks") or []):
                    current["text"] = scrub(current["text"])
            stack.extend(v for v in current.values() if isinstance(v, (dict, list)))
        elif isinstance(current, list):
            stack.extend(current)
    return node


def summary_for(kind: dict, target: versions.Next, previous_short: str, previous_month: str, target_month: str) -> str:
    return kind["summary"].format(short=target.short.lstrip("v"), short_version=target.short, month=target_month,
                                  previous_short=previous_short.lstrip("v"), previous_month=previous_month)


def pattern_for(kind: dict) -> re.Pattern:
    """The summary template as a regex matching any release's ticket of that kind."""
    parts = re.split(r"(\{[a-z_]+\})", kind["summary"])
    out = []
    for part in parts:
        if part in ("{short}", "{previous_short}"):
            out.append(r"\d+\.\d+")
        elif part == "{short_version}":
            out.append(r"v\d+\.\d+")
        elif part in ("{month}", "{previous_month}"):
            out.append(rf"(?:{MONTH})")
        else:
            out.append(re.escape(part))
    return re.compile("^" + "".join(out) + "$")


def _search_text(kind: dict) -> str:
    """The longest literal run of the summary, for Jira's text search."""
    literal = max(re.split(r"\{[a-z_]+\}", kind["summary"]), key=lambda s: len(s.strip()))
    return literal.strip().replace('"', "")


def find_existing(ctx: ActionContext, summary: str) -> dict | None:
    jql = f'project = {ctx.spec["jira_project"]} AND summary ~ "\\"{summary.replace(chr(34), "")}\\"" ORDER BY created DESC'
    return next((i for i in ctx.services.jira.search(jql, extra_fields=[ctx.spec["start_date_field"]])
                 if (i.get("fields") or {}).get("summary", "").strip() == summary), None)


def find_source(ctx: ActionContext, kind: dict, summary: str) -> dict | None:
    jql = f'project = {ctx.spec["jira_project"]} AND summary ~ "\\"{_search_text(kind)}\\"" ORDER BY created DESC'
    pattern = pattern_for(kind)
    copy_fields = list(ctx.spec["copy_fields"])
    for issue in ctx.services.jira.search(jql, extra_fields=copy_fields):
        found = (issue.get("fields") or {}).get("summary", "").strip()
        if pattern.match(found) and found != summary:
            return issue
    return None


def new_fields(ctx: ActionContext, source: dict, summary: str, fix_version: str, start_date: str) -> dict:
    fields = source.get("fields") or {}
    out = {"project": {"key": ctx.spec["jira_project"]}, "summary": summary, "fixVersions": [{"name": fix_version}]}
    for name in ctx.spec["copy_fields"]:
        value = fields.get(name)
        if value in (None, [], ""):
            continue
        if name == "issuetype":
            out[name] = {"id": value["id"]}
        elif name == "components":
            out[name] = [{"id": c["id"]} for c in value]
        elif name == "labels":
            labels = [label for label in value if not RC_LABEL.match(label)]
            if labels:
                out[name] = labels
        elif name == "description":
            out[name] = scrub_adf(value) if isinstance(value, dict) else scrub(str(value))
        elif isinstance(value, dict) and "id" in value:
            out[name] = value["id"]  # the Team field takes the team's id
        else:
            out[name] = value
    if start_date:
        out[ctx.spec["start_date_field"]] = start_date
    return out


def main_post(ctx: ActionContext) -> dict | None:
    return next((p for p in engine.find_posts(ctx, ctx.channel) if engine.key_of(p) == "main"), None)


def run(ctx: ActionContext) -> Status:
    release = ctx.release
    due = ctx.due()
    post = main_post(ctx)
    state = engine.state_of(post)
    if state.get("state") == "done":
        return Status(engine.DONE, f"{engine.DONE}: {state.get('summary')}.", "done", done=True,
                      proof=state.get("proof", state.get("summary", "")))
    if due is None or ctx.today < due:
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: create the tickets for the next release "
                                      f"({text.day_words(due) if due else 'Release Day'}).", "not_due")
    if not ctx.execute:
        return Status(engine.WAITING, f"{engine.WAITING}: the tickets for the next release are created at the next run.", "pending")
    milestones = [m.get("title", "") for m in ctx.services.github.milestones("mattermost/mattermost")]
    plan = versions.plan(ctx, ctx.services.jira.versions(ctx.spec["jira_project"]), milestones)
    offset = {"next": 0, "after_next": 1}[ctx.spec["target"]]
    target = plan.upcoming[offset]
    if not target.clear or not any(v.get("name") == target.name for v in ctx.services.jira.versions(ctx.spec["jira_project"])):
        return Status(engine.WAITING, f"{engine.WAITING}: the {target.short} tickets wait for its fix version in Jira.",
                      "waiting_version")
    previous = plan.upcoming[offset - 1] if offset else versions.Next(release.major, release.minor, ctx.fix_version,
                                                                     release.release_day.isoformat())
    target_release = ctx.releases.get((target.major, target.minor))
    feature_complete = target_release.milestones.get("feature_complete") if target_release else None
    month = lambda n: versions.MONTHS[int((n.release_date or "0000-01")[5:7]) - 1] if n.release_date else ""  # noqa: E731
    lines, attention, created = [], [], 0
    planned = []
    for kind in ctx.spec["kinds"]:
        summary = summary_for(kind, target, previous.short, month(previous), month(target))
        existing = find_existing(ctx, summary)
        is_epic = kind.get("start_date") == "feature_complete"
        start = feature_complete.isoformat() if is_epic and feature_complete else ""
        if existing:
            key = existing["key"]
            if is_epic and not (existing.get("fields") or {}).get(ctx.spec["start_date_field"]):
                if start and ctx.settings.is_live(ctx.action):
                    ctx.services.jira_writer.update_issue(key, {ctx.spec["start_date_field"]: start})
                    planned.append(f"Set the Start Date of {key} to {start}")
                elif start:
                    planned.append(f"Would set the Start Date of {key} to {start}")
                else:
                    attention.append(f"Set the Start Date on the {target.short} loadtest epic: the calendar has no "
                                     f"Feature Complete event for {target.short} yet.")
            lines.append(text.link(f"{key}: {summary}", ctx.services.jira.browse_url(key)))
            continue
        source = find_source(ctx, kind, summary)
        if source is None:
            attention.append(f"No earlier ticket like “{kind['summary']}” to copy, so it wasn't created.")
            continue
        if is_epic and not start:
            attention.append(f"Set the Start Date on the {target.short} loadtest epic: the calendar has no "
                             f"Feature Complete event for {target.short} yet.")
        fields = new_fields(ctx, source, summary, target.name, start)
        if ctx.settings.is_live(ctx.action):
            made = ctx.services.jira_writer.create_issue(fields)
            created += 1
            lines.append(text.link(f"{made['key']}: {summary}", ctx.services.jira.browse_url(made["key"])))
        else:
            planned.append(f"Would create “{summary}” in {target.name}, copied from {source['key']}")
    if not ctx.settings.is_live(ctx.action):
        message = text.render("dry-run", what=f"would create the tickets for {target.short}",
                              plan=text.bullet_list(planned + [f"Exists: {line}" for line in lines]))
        if post is None and ctx.channel:
            engine.create_post(ctx, ctx.channel, message, "main", {"state": "dry_run"})
        elif post is not None and post.get("message") != ctx.say(message):
            engine.save_state(ctx, post, {"state": "dry_run"}, message)
        return Status(engine.DRY, f"{engine.DRY}: would create {len([p for p in planned if p.startswith('Would create')])} "
                                  f"tickets for {target.short}.", "dry_run", attention=attention)
    complete = len(lines) == len(ctx.spec["kinds"]) and not attention
    summary = f"the {len(lines)} tickets for {target.short} exist"
    if complete:
        message = text.render("tickets-done", target_short=target.short, tickets=text.bullet_list(lines))
        if post:
            engine.save_state(ctx, post, {"state": "done", "summary": summary}, message)
        else:
            engine.create_post(ctx, ctx.channel, message, "main", {"state": "done", "summary": summary})
        return Status(engine.DONE, f"{engine.DONE}: {summary}.", f"done: {created} created", done=True,
                      proof=f"{summary}: " + "; ".join(lines))
    return Status(engine.WAITING, f"{engine.WAITING}: {len(lines)} of {len(ctx.spec['kinds'])} tickets for {target.short} exist.",
                  f"partial: {created} created", attention=attention)
