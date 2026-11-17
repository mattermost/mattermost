"""Close the release in Jira and add the next three fix versions in Jira and GitHub (T-0).

Runs on Release Day once the vX.Y.0 GitHub release is published (not a pre-release). The
release's Jira version is marked released with Release Day's date; the next three releases get a
Jira fix version (naming.fix_version) and a vX.Y.0 milestone in mattermost and enterprise. Any
that already exist are skipped, and the current milestone stays open for dot releases.

A next version is "clear" when Jira, the calendar or a milestone names it. A major bump is never
guessed: when a name is only worked out (minor + 1, month + 1), the planned names are posted from
T-1 and nothing is created until the release manager or a backup replies ``go``.
"""

import re
from dataclasses import dataclass, field
from datetime import date

from . import engine, text
from .engine import ActionContext, Status

JIRA_NAME = re.compile(r"^v(\d+)\.(\d+) \(([A-Za-z]+) (\d{4})\)$")
MILESTONE = re.compile(r"^v(\d+)\.(\d+)\.0$")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December")


@dataclass
class Next:
    major: int
    minor: int
    name: str
    release_date: str = ""
    clear: bool = True
    source: str = ""

    @property
    def short(self) -> str:
        return f"v{self.major}.{self.minor}"


@dataclass
class Plan:
    current: str
    current_version: dict | None
    upcoming: list = field(default_factory=list)

    @property
    def clear(self) -> bool:
        return all(n.clear for n in self.upcoming)


def _fix_name(ctx: ActionContext, major: int, minor: int, day: date) -> str:
    return ctx.rules["naming"]["fix_version"].format(major=major, minor=minor, release_month=MONTHS[day.month - 1],
                                                     release_year=day.year)


def _add_month(day: date) -> date:
    return date(day.year + day.month // 12, day.month % 12 + 1, min(day.day, 28))


def plan(ctx: ActionContext, jira_versions: list[dict], milestones: list[str]) -> Plan:
    release = ctx.release
    current = next((v for v in jira_versions if (v.get("name") or "").startswith(f"{release.short_version} (")), None)
    known = {}
    for key, rel in ctx.releases.items():
        if rel.release_day:
            known[key] = Next(key[0], key[1], _fix_name(ctx, key[0], key[1], rel.release_day),
                              rel.release_day.isoformat(), True, "calendar")
    for version in jira_versions:
        match = JIRA_NAME.match(version.get("name") or "")
        if match:
            key = (int(match.group(1)), int(match.group(2)))
            known[key] = Next(key[0], key[1], version["name"], version.get("releaseDate") or
                              (known[key].release_date if key in known else ""), True, "Jira")
    for title in milestones:
        match = MILESTONE.match(title or "")
        if match:
            key = (int(match.group(1)), int(match.group(2)))
            known.setdefault(key, Next(key[0], key[1], "", "", False, "milestone"))
    result = Plan(current["name"] if current else ctx.fix_version, current)
    prev_key, prev_day = release.key, release.release_day or ctx.today
    for _ in range(3):
        candidates = [(prev_key[0], prev_key[1] + 1), (prev_key[0] + 1, 0)]
        found = next((known[k] for k in candidates if k in known), None)
        guess_day = _add_month(prev_day)
        if found is None:
            key = candidates[0]
            found = Next(key[0], key[1], _fix_name(ctx, key[0], key[1], guess_day), "", False, "worked out")
        elif not found.name:
            found = Next(found.major, found.minor, _fix_name(ctx, found.major, found.minor, guess_day), "", False, "milestone")
        result.upcoming.append(found)
        prev_key = (found.major, found.minor)
        prev_day = date.fromisoformat(found.release_date) if found.release_date else guess_day
    return result


def _milestones(ctx: ActionContext) -> dict:
    return {repo: [m.get("title", "") for m in ctx.services.github.milestones(repo)] for repo in ctx.spec["repos"]}


def main_post(ctx: ActionContext, key: str = "main") -> dict | None:
    return next((p for p in engine.find_posts(ctx, ctx.channel) if engine.key_of(p) == key), None)


def names_list(p: Plan) -> str:
    return text.bullet_list([f"{n.name}{'' if n.clear else ' (worked out, not confirmed)'}" for n in p.upcoming])


def run(ctx: ActionContext) -> Status:
    release = ctx.release
    due, preview = ctx.due(), ctx.due("preview")
    done_post = main_post(ctx)
    if engine.state_of(done_post).get("state") == "done":
        state = engine.state_of(done_post)
        return Status(engine.DONE, f"{engine.DONE}: {state.get('summary')}.", "done", done=True, proof=state.get("summary", ""))
    if due is None or (preview and ctx.today < preview) or (not preview and ctx.today < due):
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: close {release.short_version} and add the next three fix "
                                      f"versions ({text.day_words(due) if due else 'Release Day'}).", "not_due")
    project = ctx.spec["jira_project"]
    milestones = _milestones(ctx)
    p = plan(ctx, ctx.services.jira.versions(project), sorted({t for ts in milestones.values() for t in ts}))
    names = ", ".join(n.name for n in p.upcoming)
    confirm = main_post(ctx, "confirm")
    approved = engine.state_of(confirm).get("state") == "approved"
    if not p.clear and not approved:
        if ctx.execute and confirm is None and ctx.channel:
            engine.create_post(ctx, ctx.channel, text.render("versions-confirm", short_version=release.short_version,
                                                            names=names_list(p),
                                                            mention=ctx.settings.people.mention("release_manager")),
                               "confirm", {"state": "proposed"})
        elif ctx.execute and confirm is not None and engine.first_go(ctx, confirm, engine.state_of(confirm), 0, "the fix version names"):
            state = engine.state_of(confirm)
            state["state"] = "approved"
            engine.save_state(ctx, confirm, state)
            approved = True
        if not approved:
            line = f"Confirm the next fix versions for {release.short_version} by replying `go` on the request: {names}."
            return Status(engine.WAITING, f"{engine.WAITING}: the next fix version names need the release manager's `go`: "
                                          f"{names}.", "waiting_confirm", attention=[line])
    if ctx.today < due:
        return Status(engine.NOT_DUE, f"{engine.NOT_DUE}: on Release Day, close {p.current} and add {names}.", "preview")
    published = ctx.services.github.release_by_tag("mattermost/mattermost", release.version)
    if not published or published.get("prerelease") or published.get("draft"):
        return Status(engine.WAITING, f"{engine.WAITING}: closing {p.current} waits for the {release.version} GitHub release.",
                      "waiting_release")
    if not ctx.execute:
        return Status(engine.WAITING, f"{engine.WAITING}: closing {p.current} and adding {names} at the next run.", "pending")

    existing = {v["name"]: v for v in ctx.services.jira.versions(project)}
    steps = []
    current = p.current_version
    if current and not current.get("released"):
        steps.append(("release", current))
    elif not current:
        return Status(engine.ATTENTION, f"{engine.ATTENTION}: Jira has no {release.short_version} fix version to close.",
                      "no_version", attention=[f"Jira has no {release.short_version} fix version to close."])
    for n in p.upcoming:
        if n.name not in existing and not any(name.startswith(f"{n.short} (") for name in existing):
            steps.append(("jira", n))
        for repo, titles in milestones.items():
            title = f"{n.short}.0"
            if title not in titles:
                steps.append(("milestone", (repo, n)))
    lines = [_step_line(kind, item, release) for kind, item in steps] or ["Nothing to do: everything already exists."]
    summary = f"closed {p.current} in Jira and added {names}"
    if not ctx.settings.is_live(ctx.action):
        message = text.render("dry-run", what=f"would close {p.current} and add the next three fix versions",
                              plan=text.bullet_list(lines))
        post = main_post(ctx)
        if post is None and ctx.channel:
            engine.create_post(ctx, ctx.channel, message, "main", {"state": "dry_run"})
        elif post is not None and post.get("message") != ctx.say(message):
            engine.save_state(ctx, post, {"state": "dry_run"}, message)
        return Status(engine.DRY, f"{engine.DRY}: would close {p.current} and add {names}.", f"dry_run: {len(steps)} steps")
    writer = ctx.services.jira_writer
    project_id = None
    for kind, item in steps:
        if kind == "release":
            writer.release_version(item["id"], release.release_day.isoformat())
        elif kind == "jira":
            project_id = project_id or writer.project_id(project)
            writer.create_version(project_id, item.name, item.release_date)
        else:
            repo, n = item
            ctx.services.milestones.create_milestone(repo, f"{n.short}.0", n.release_date)
    message = text.render("versions-done", closed=f"{p.current} is released in Jira with {text.day_words(release.release_day)}'s date.",
                          names=text.bullet_list(lines))
    if done_post:
        engine.save_state(ctx, done_post, {"state": "done", "summary": summary}, message)
    else:
        engine.create_post(ctx, ctx.channel, message, "main", {"state": "done", "summary": summary})
    return Status(engine.DONE, f"{engine.DONE}: {summary}.", f"done: {len(steps)} steps", done=True, proof=summary)


def _step_line(kind: str, item, release) -> str:
    if kind == "release":
        return f"Mark {item['name']} as released on {release.release_day.isoformat()}"
    if kind == "jira":
        return f"Add the Jira fix version {item.name}"
    repo, n = item
    return f"Add the {n.short}.0 milestone in {repo.split('/')[-1]}"
