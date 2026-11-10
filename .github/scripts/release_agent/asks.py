"""Asks to other teams: rules of ``type: ask`` in rules.yml.

Every message is a template from .github/release-agent/templates filled with release data;
nothing is written by a model. Each run, for every ask due on or before today:

1. not needed this release: its playbook item is ticked, with the reason;
2. not sent: one post in the target channel, found again by its hidden ``ASK_PROP``,
   never by its text (an ask the release manager posted by hand is followed instead);
3. done: the item is ticked, with a proof reply under the status post;
4. not done after ``remind_after`` working days: one reminder in the ask's thread (and
   another every ``remind_every`` working days, when set), never two on one day;
5. past ``escalate_at``: listed under Needs attention for the release manager.

An item a person already ticked, or is working on, is left alone. In test mode nothing is
sent: what would be sent is shown in the test channel's status post.

Message text, names and Hub links go to Hub only. What a Handoff carries for run.json and
the run summary (``public``) is its state, dates and counts.
"""

import fnmatch
import json
import re
import urllib.parse
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import playbook, workdays
from .checks import LOOKUP_FAILED, CheckError, lookup_with_retry
from .clients import ServiceError

TEMPLATES = Path(__file__).resolve().parents[2] / "release-agent" / "templates"
ASK_PROP = "release_agent_ask"
REMINDER_PROP = "release_agent_ask_reminder"
APPROVE_EMOJI = "white_check_mark"
MAX_POST_CHARS = 15000
MAX_LISTED = 25  # PRs listed per repo in a docs reminder
SERVER_REPO = "mattermost/mattermost"

DONE = "done"
WAITING = "waiting"
WOULD_SEND = "would_send"  # test mode: the ask would be sent today
NOT_NEEDED = "not_needed"
NOT_DUE = "not_due"
NOT_READY = "not_ready"  # due, but what it depends on (a tag, a branch) isn't there yet
BY_PERSON = "by_person"
ERROR = "error"

STATE_WORDS = {
    DONE: "Done", WAITING: "Waiting", WOULD_SEND: "Would send (test mode)", NOT_NEEDED: "Not needed",
    NOT_DUE: "Not due yet", NOT_READY: "Not sent yet", BY_PERSON: "Handled by a person", ERROR: "Couldn't check",
}

PR_REF = re.compile(r"\(#(\d+)\)")


@dataclass
class Handoff:
    rule: dict
    state: str = NOT_DUE
    summary: str = ""  # public: states and counts, no names, links or message text
    detail: str = ""  # Hub only: what the status post says beyond the summary
    due: date | None = None
    asked_on: date | None = None
    reminded_on: date | None = None
    proof_url: str = ""  # Hub only
    escalated: bool = False
    previews: list = field(default_factory=list)  # test mode: [(where, text)] it would send
    counts: dict = field(default_factory=dict)  # public counts, e.g. PRs still to document

    @property
    def task(self) -> str:
        return self.rule["task"]

    @property
    def public(self) -> dict:
        entry = {"task": self.task, "state": self.state, "summary": self.summary,
                 "due": self.due.isoformat() if self.due else None,
                 "asked_on": self.asked_on.isoformat() if self.asked_on else None,
                 "reminded_on": self.reminded_on.isoformat() if self.reminded_on else None,
                 "escalated": self.escalated}
        if self.counts:
            entry["counts"] = self.counts
        return entry


@dataclass
class AskEnv:
    """What the asks need beyond a check's Context."""
    ctx: object  # checks.Context
    rules: dict  # the whole rules.yml
    people: dict  # RELEASE_AGENT_PEOPLE
    mode: str
    holidays: frozenset
    release_channel: str = ""
    run: dict | None = None
    manager: dict | None = None  # the playbook run's owner, a Hub user
    healthcheck_github: object = None  # a client that can read mattermost-healthcheck, or None
    sleep: object = None  # time.sleep when None; waits out a GitHub rate limit
    calendar_versions: dict = field(default_factory=dict)  # {"mobile": "v2.47", ...} from the Release Dates calendar
    community: object = None  # clients.Community, read only, or None
    rc_announce_channel: str = ""  # the RC build announcements channel on Community
    rc_announce_author: str = ""  # a Community username; when set, only their posts count
    flags: list = field(default_factory=list)  # public: never names a person
    private_flags: list = field(default_factory=list)  # Hub only
    cache: dict = field(default_factory=dict)

    @property
    def live(self) -> bool:
        return self.mode == "live"

    @property
    def today(self) -> date:
        return self.ctx.today

    @property
    def settings(self) -> dict:
        return self.rules.get("ask_settings") or {}

    def flag(self, text: str, private: bool = False):
        target = self.private_flags if private else self.flags
        if text not in target:
            target.append(text)


# ── People ──────────────────────────────────────────────────────────────────────────

USERNAME = re.compile(r"^[a-z0-9._-]+$")
GITHUB_LOGIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$")


def parse_people(text: str) -> tuple[dict, str]:
    """(roles, problem) from RELEASE_AGENT_PEOPLE: {"role": ["hub.username", ...]} or, for a
    GitHub login such as ces_github, {"role": "login"}. The problem never repeats the value."""
    if not (text or "").strip():
        return {}, ""
    try:
        found = json.loads(text)
    except ValueError:
        return {}, "RELEASE_AGENT_PEOPLE isn't valid JSON, so every ask goes out with no mention."
    if not isinstance(found, dict):
        return {}, "RELEASE_AGENT_PEOPLE must be a JSON object of roles, so every ask goes out with no mention."
    roles, bad = {}, []
    for role, value in found.items():
        names = [value] if isinstance(value, str) else value
        if isinstance(names, list) and all(isinstance(n, str) and n.strip().lstrip("@") for n in names):
            cleaned = [n.strip().lstrip("@") for n in names]
            roles[role] = value.strip().lstrip("@") if isinstance(value, str) else cleaned
        else:
            bad.append(role)
    problem = (f"RELEASE_AGENT_PEOPLE roles {', '.join(sorted(bad))} aren't a username or a list of usernames, so they were ignored."
               if bad else "")
    return roles, problem


def _names(env: AskEnv, role: str) -> list[str]:
    value = env.people.get(role)
    names = [value] if isinstance(value, str) else list(value or [])
    if not names:
        env.flag(f"Set RELEASE_AGENT_PEOPLE.{role}: asks to that role go out with no mention.")
    return names


def _hub_user(env: AskEnv, username: str):
    key = ("user", username)
    if key not in env.cache:
        env.cache[key] = lookup_with_retry(lambda: env.ctx.hub.user_by_username(username))
    return env.cache[key]


def mentions(env: AskEnv, role: str) -> str:
    """"@a @b" for the role's active Hub users; anyone else is named without a mention and
    flagged (Hub only: the names come from a private variable)."""
    shown = []
    for name in _names(env, role):
        user = _hub_user(env, name)
        if user is LOOKUP_FAILED:
            env.flag(f"Couldn't check that {name} (RELEASE_AGENT_PEOPLE.{role}) is on Hub.", private=True)
            shown.append(name)
        elif not user or user.get("delete_at"):
            env.flag(f"{name} in RELEASE_AGENT_PEOPLE.{role} isn't an active Hub user, so they're named without a mention.",
                     private=True)
            shown.append(name)
        else:
            shown.append(f"@{name}")
    return " ".join(shown)


def role_user_ids(env: AskEnv, role: str) -> set[str]:
    ids = set()
    value = env.people.get(role)
    for name in ([value] if isinstance(value, str) else list(value or [])):
        user = _hub_user(env, name)
        if user and user is not LOOKUP_FAILED and not user.get("delete_at"):
            ids.add(user.get("id") or name)
    return ids


def manager_mention(env: AskEnv) -> str:
    if env.manager:
        return f"@{env.manager['username']}"
    env.flag("The release's playbook run has no owner on Hub, so asks for the release manager mention nobody.")
    return "the release manager"


# ── Templates and values ────────────────────────────────────────────────────────────

def render(name: str, values: dict) -> str:
    text = (TEMPLATES / name).read_text(encoding="utf-8")
    return "\n".join(line.rstrip() for line in text.format_map(values).strip().splitlines())


def ordinal(day: int) -> str:
    suffix = "th" if 11 <= day % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suffix}"


def long_date(day: date) -> str:
    """"November 12th", as the release manager writes dates."""
    return f"{day:%B} {ordinal(day.day)}"


def base_values(env: AskEnv) -> dict:
    release = env.ctx.release
    values = {**env.ctx.vars, "rc1_tag": f"{release.version}-rc1", "rc1_plain": f"{release.major}.{release.minor}.0-rc1",
              "release_day_iso": release.release_day.isoformat() if release.release_day else "not on the calendar"}
    values["changelog_url"] = env.settings.get("changelog_url", "").format_map(values)
    values["changelog_link"] = f"[{release.short_version} changelog]({values['changelog_url']})"
    return values


def same_month_versions(env: AskEnv) -> dict:
    """{"mobile": "v2.47", "desktop": "v6.4"}: the mobile and desktop releases shipping with this
    one. The Release Dates calendar's "Mobile vA.B" and "Desktop vC.D" events come first; a
    kind the calendar doesn't name comes from the GitHub milestone due in Release Day's month
    (desktop ships quarterly, so most months have none). When both name one and disagree, the
    calendar's is used and the difference is flagged in Hub."""
    if "versions" in env.cache:
        return env.cache["versions"]
    day = env.ctx.release.release_day
    from_milestones = {}
    for key in ("mobile", "desktop"):
        repo = env.settings[f"{key}_repo"]
        for milestone in env.ctx.github.milestones(repo):
            match = re.fullmatch(r"v(\d+)\.(\d+)\.0", milestone.get("title") or "")
            due_on = (milestone.get("due_on") or "")[:7]
            if match and day and due_on == f"{day.year}-{day.month:02d}":
                from_milestones[key] = f"v{match.group(1)}.{match.group(2)}"
    found = {**from_milestones, **env.calendar_versions}
    for key, version in env.calendar_versions.items():
        other = from_milestones.get(key)
        if other and other != version:
            env.flag(f"The Release Dates calendar says {key.title()} {version} ships with {env.ctx.release.short_version}, "
                     f"but the GitHub milestone due in {day:%B} is {other}.0: the asks use {version}.", private=True)
    env.cache["versions"] = found
    return found


# ── Changed files between two release branches ─────────────────────────────────────

def _is_glob(pattern: str) -> bool:
    return any(char in pattern for char in "*?[")


def _prefix(pattern: str) -> str:
    """The path to ask the commits API for: the pattern itself, or a glob's directory."""
    if not _is_glob(pattern):
        return pattern.rstrip("/")
    return re.split(r"[*?\[]", pattern, maxsplit=1)[0].rsplit("/", 1)[0]


def changed_prs(github, repo: str, base: str, head: str, patterns: list[str]) -> list[dict]:
    """The commits on ``head`` that ``base`` doesn't have and that touch ``patterns`` (files,
    directories ending in "/", or globs), as [{"number": PR or None, "sha", "title"}], one
    per PR, in number order. A PR already on ``base`` (a cherry-pick) isn't counted."""
    since = (_parse_time(github.commit_date(repo, base)) - timedelta(days=120)).strftime("%Y-%m-%dT%H:%M:%SZ")
    head_commits, matched_by, base_commits = {}, {}, {}
    for pattern in patterns:
        for commit in github.commits(repo, head, since=since, path=_prefix(pattern)):
            head_commits[commit["sha"]] = commit
            matched_by.setdefault(commit["sha"], []).append(pattern)
        for commit in github.commits(repo, base, since=since, path=_prefix(pattern)):
            base_commits[commit["sha"]] = commit
    on_base = {number for commit in base_commits.values() for number in PR_REF.findall(_title(commit))}
    found = {}
    for sha, commit in head_commits.items():
        if sha in base_commits:
            continue
        globs = [p for p in matched_by[sha] if _is_glob(p)]
        if len(globs) == len(matched_by[sha]):
            files = github.commit_files(repo, sha)
            if not any(fnmatch.fnmatch(name, glob) for glob in globs for name in files):
                continue
        numbers = PR_REF.findall(_title(commit))
        number = numbers[0] if numbers else None
        if number in on_base:
            continue
        found.setdefault(number or sha, {"number": int(number) if number else None, "sha": sha, "title": _title(commit)})
    return sorted(found.values(), key=lambda c: (c["number"] is None, c["number"] or 0, c["sha"]))


def _title(commit: dict) -> str:
    return ((commit.get("commit") or {}).get("message") or "").split("\n", 1)[0]


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def pr_link(repo: str, change: dict) -> str:
    name = repo.split("/")[-1]
    if change["number"]:
        return f"[{name}#{change['number']}](https://github.com/{repo}/pull/{change['number']})"
    return f"[{name} commit {change['sha'][:7]}](https://github.com/{repo}/commit/{change['sha']})"


def previous_line(ctx) -> tuple[int, int] | None:
    earlier = sorted(key for key in ctx.branches if key < ctx.release.key)
    return earlier[-1] if earlier else None


# ── Needed when ─────────────────────────────────────────────────────────────────────
# Each returns (True/False, or None when it can't be told yet, reason, facts for the message).

def needed_always(env: AskEnv, rule: dict):
    return True, "", {}


def needed_rc1_tagged(env: AskEnv, rule: dict):
    if 1 in env.ctx.rc_numbers:
        return True, "", {}
    return None, f"waiting for {env.ctx.release.version}-rc1 to be tagged", {}


def needed_final_build_tagged(env: AskEnv, rule: dict):
    release = env.ctx.release
    if release.key not in env.ctx.tags:
        return None, f"waiting for {release.version} to be tagged", {}
    freeze = release.milestones.get("code_freeze")
    if freeze and env.today <= freeze:
        return None, "waiting for code freeze to pass", {}
    return True, "", {}


def needed_support_packet_changed(env: AskEnv, rule: dict):
    ctx = env.ctx
    if not ctx.has_branch:
        return None, f"waiting for {ctx.vars['branch']}", {}
    previous = previous_line(ctx)
    if previous is None:
        return None, "no earlier release branch to compare with", {}
    base = f"v{previous[0]}.{previous[1]}.0" if previous in ctx.tags else f"release-{previous[0]}.{previous[1]}"
    changes = changed_prs(ctx.github, SERVER_REPO, base, ctx.vars["branch"], env.rules["support_packet_files"])
    if not changes:
        return False, f"no Support Packet changes since v{previous[0]}.{previous[1]}", {}
    return True, "", {"changes": changes, "since": f"v{previous[0]}.{previous[1]}"}


def needed_manual_test_areas_changed(env: AskEnv, rule: dict):
    versions = same_month_versions(env)
    touched, compared = [], []
    for key in ("mobile", "desktop"):
        if key not in versions:
            continue
        repo = env.settings[f"{key}_repo"]
        major, minor = (int(part) for part in versions[key].lstrip("v").split("."))
        head, base = f"release-{major}.{minor}", f"release-{major}.{minor - 1}"
        if not env.ctx.github.branch_exists(repo, head):
            return None, f"waiting for {repo.split('/')[-1]} {head}", {}
        compared.append(f"{key.title()} {versions[key]}")
        for area in env.rules["manual_test_areas"]:
            if area["repo"] == key:
                changes = changed_prs(env.ctx.github, repo, base, head, area["paths"])
                if changes:
                    touched.append((key, repo, area, changes))
    if not compared:
        return False, "no mobile or desktop release ships this month", {}
    if not touched:
        return False, "no changes in the manual test areas", {}
    return True, "", {"touched": touched, "compared": compared}


NEEDED = {
    "always": needed_always,
    "rc1_tagged": needed_rc1_tagged,
    "final_build_tagged": needed_final_build_tagged,
    "support_packet_changed": needed_support_packet_changed,
    "manual_test_areas_changed": needed_manual_test_areas_changed,
}


# ── Done when ───────────────────────────────────────────────────────────────────────
# Each returns (done, summary, proof URL). The summary is public; the proof is Hub only.

def done_sent(env: AskEnv, rule: dict, post: dict | None, facts: dict):
    if post:
        return True, "asked", env.ctx.hub.post_link(post["id"]) if post.get("id") else ""
    return False, "not asked yet", ""


def ces_title(env: AskEnv) -> str:
    return f"Mattermost {env.ctx.release.short_version} Support Packet changes"


def done_ces_issue(env: AskEnv, rule: dict, post: dict | None, facts: dict):
    repo, title = env.settings["healthcheck_repo"], ces_title(env)
    if env.healthcheck_github is None:
        env.flag("The read app can't read mattermost-healthcheck, so the CES issue can't be checked: install it there (read only).")
        return False, "can't check mattermost-healthcheck (private repo)", ""
    found = [i for i in env.healthcheck_github.search_issues(f'repo:{repo} is:issue in:title "{title}"')
             if " ".join((i.get("title") or "").split()).casefold() == title.casefold()]
    if found:
        return True, "the issue is open in mattermost-healthcheck (private repo)", found[0].get("html_url", "")
    return False, "no issue in mattermost-healthcheck yet (private repo)", ""


def docs_searches(env: AskEnv) -> list[tuple[str, str, str, str]]:
    """[(key, label, repo, milestone)] of the Docs/Needed searches."""
    versions = same_month_versions(env)
    searches = [("server", "Server", SERVER_REPO, env.ctx.vars["milestone"])]
    for key in ("mobile", "desktop"):
        if key in versions:
            searches.append((key, key.title(), env.settings[f"{key}_repo"], f"{versions[key]}.0"))
    return searches


def docs_query(repo: str, milestone: str) -> str:
    return f'repo:{repo} is:pr is:closed label:"Docs/Needed" milestone:"{milestone}"'


def docs_url(repo: str, milestone: str) -> str:
    query = urllib.parse.quote_plus(f"is:pr is:closed label:Docs/Needed milestone:{milestone}")
    return f"https://github.com/{repo}/pulls?q={query}"


def done_docs_labels(env: AskEnv, rule: dict, post: dict | None, facts: dict):
    found = {key: env.ctx.github.search_issues(docs_query(repo, milestone)) for key, _, repo, milestone in docs_searches(env)}
    facts["docs_prs"] = found  # every PR still labelled Docs/Needed, for the reminder (Hub only)
    counts = {key: len(prs) for key, prs in found.items()}
    facts["counts"] = counts
    left = sum(counts.values())
    text = ", ".join(f"{count} {key}" for key, count in counts.items())
    if not left:
        return True, f"no PRs left with Docs/Needed ({text})", ""
    return False, f"{left} PRs still have Docs/Needed ({text})", ""


MANUAL_DONE = re.compile(r"manual[\w -]*?\b(?:is |are )?(?:done|complete|completed|passed|finished)\b"
                         r"|\b(?:done|completed|finished) (?:with )?(?:the )?manual", re.IGNORECASE)


def done_qa(env: AskEnv, rule: dict, post: dict | None, facts: dict):
    if not post:
        return False, "not asked yet", ""
    hub, owners = env.ctx.hub, role_user_ids(env, "qa")
    bot = hub.me()["id"]
    for reply in hub.thread(post["id"])[1:]:
        by_owner = reply.get("user_id") in owners if owners else reply.get("user_id") != bot
        if by_owner and MANUAL_DONE.search(reply.get("message") or ""):
            return True, "QA said manual testing is done", hub.post_link(reply["id"])
    for reaction in hub.reactions(post["id"]):
        if reaction.get("emoji_name") == APPROVE_EMOJI and (reaction.get("user_id") in owners if owners
                                                             else reaction.get("user_id") != bot):
            return True, "QA reacted to the ask as done", hub.post_link(post["id"])
    if env.ctx.testing_alerts_channel:
        version = env.ctx.release.short_version
        for alert in hub.posts_since(env.ctx.testing_alerts_channel, post.get("create_at", 0)):
            text = alert.get("message") or ""
            if playbook.name_matches(text, version) and MANUAL_DONE.search(text):
                return True, "Release: Testing Alerts says manual testing is done", hub.post_link(alert["id"])
    return False, "QA hasn't said manual testing is done", ""


RINGS = {"beta": r"\bbeta\b", "freemium": r"\bfreemium\b", "professional": r"\bprofessional\b|\bpro\b",
         "enterprise": r"\benterprise\b"}
DONE_WORD = re.compile(r"\b(?:done|complete|completed|finished|rolled out)\b", re.IGNORECASE)
NOT_DONE = re.compile(r"\bnot (?:yet )?(?:done|complete|completed|finished|rolled out)\b", re.IGNORECASE)


def rings_done(texts: list[str]) -> set[str]:
    """The rings the replies say are done: "Beta, Freemium done. Proceeding to professional",
    then "professional and enterprise done", is all four. Each clause (split at . ; ! or a new
    line) that says done counts for the rings it names."""
    found = set()
    for text in texts:
        for clause in re.split(r"[.;!\n]+", text or ""):
            if DONE_WORD.search(clause) and not NOT_DONE.search(clause):
                found |= {ring for ring, pattern in RINGS.items() if re.search(pattern, clause, re.IGNORECASE)}
    return found


def _sre_thread(env: AskEnv, post: dict | None) -> list[dict]:
    if not post:
        return []
    hub, owners, bot = env.ctx.hub, role_user_ids(env, "sre"), env.ctx.hub.me()["id"]
    return [p for p in hub.thread(post["id"])[1:]
            if (p.get("user_id") in owners if owners else p.get("user_id") != bot)]


def done_sre_rings(env: AskEnv, rule: dict, post: dict | None, facts: dict):
    """The rings in ``rule["rings"]`` are done, by SRE replies in the rollout thread (the ask's
    own, or for the Enterprise ask the Freemium and Professional one it replies in)."""
    thread_root = facts.get("parent") or post
    wanted = set(rule.get("rings") or [])
    seen = set()
    for reply in _sre_thread(env, thread_root):
        seen |= rings_done([reply.get("message") or ""])
        if wanted <= seen:
            return True, f"SRE says {' and '.join(sorted(wanted))} {'is' if len(wanted) == 1 else 'are'} done", \
                env.ctx.hub.post_link(reply["id"])
    return False, f"SRE hasn't said {' and '.join(sorted(wanted))} {'is' if len(wanted) == 1 else 'are'} done", ""


DONE_WHEN = {
    "sent": done_sent,
    "ces_issue": done_ces_issue,
    "docs_labels": done_docs_labels,
    "qa_reply": done_qa,
    "sre_reply": done_sre_rings,
}


# ── Messages ────────────────────────────────────────────────────────────────────────

def values_ces(env: AskEnv, rule: dict, facts: dict) -> dict:
    values = base_values(env)
    ces_github = env.people.get("ces_github")
    if not isinstance(ces_github, str) or not GITHUB_LOGIN.match(ces_github or ""):
        env.flag("Set RELEASE_AGENT_PEOPLE.ces_github (a GitHub login): the Support Packet issue has no cc.")
        ces_github = ""
    lines = [f"[{SERVER_REPO}#{c['number']}](https://github.com/{SERVER_REPO}/pull/{c['number']})" if c["number"]
             else f"[{SERVER_REPO}@{c['sha'][:7]}](https://github.com/{SERVER_REPO}/commit/{c['sha']})"
             for c in facts["changes"]]
    body = "\n".join([f"Mattermost {values['short_version']} ({values['release_day_iso']} release) will have support packet changes:",
                      "", *lines, "",
                      "Review changes to see if they are worth adding to the health check report. Verify that the "
                      "health check tool still works with updated support packet structure." + (f" cc @{ces_github}" if ces_github else "")])
    title = ces_title(env)
    new_issue = (f"https://github.com/{env.settings['healthcheck_repo']}/issues/new?"
                 + urllib.parse.urlencode({"title": title, "body": body}))
    return {**values, "manager": manager_mention(env), "ces": mentions(env, "ces"), "issue_title": title,
            "issue_body": body, "new_issue_link": f"[Open a new issue in mattermost-healthcheck with this text]({new_issue})",
            "changes": f"{len(facts['changes'])} PR{'s' if len(facts['changes']) != 1 else ''}", "since": facts["since"]}


def _pr_line(repo: str, pr: dict) -> str:
    """"[mattermost#39001](url) Add shared drafts": the link names the PR, then its title."""
    url = pr.get("html_url") or f"https://github.com/{repo}/pull/{pr['number']}"
    title = " ".join((pr.get("title") or "").split())
    return f"[{repo.split('/')[-1]}#{pr['number']}]({url})" + (f" {title}" if title else "")


def values_docs(env: AskEnv, rule: dict, facts: dict) -> dict:
    values = base_values(env)
    versions = same_month_versions(env)
    names = [values["short_version"]] + [f"{key.title()} {versions[key]}" for key in ("mobile", "desktop") if key in versions]
    due = workdays.add_working_days(env.ctx.release.release_day, -2, env.holidays)
    links = "\n".join(f" - [{label} PRs]({docs_url(repo, milestone)})" for _, label, repo, milestone in docs_searches(env))
    counts = facts.get("counts") or {}
    left = ", ".join(f"{counts.get(key, 0)} {label.lower()}" for key, label, _, _ in docs_searches(env))
    lines = []
    for key, label, repo, _ in docs_searches(env):
        prs = (facts.get("docs_prs") or {}).get(key) or []
        shown = [_pr_line(repo, pr) for pr in prs[:MAX_LISTED]]
        more = f", and {len(prs) - MAX_LISTED} more" if len(prs) > MAX_LISTED else ""
        lines.append(f"- {label}: " + ("; ".join(shown) + more if shown else "none"))
    return {**values, "versions": " / ".join(names), "due_date": long_date(due), "links": links,
            "docs": mentions(env, "docs"), "left": left, "left_list": "\n".join(lines)}


def loadtest_epic(env: AskEnv):
    jql = env.settings["loadtest_epic_jql"].format_map(env.ctx.vars)
    release = env.ctx.release
    wanted = re.compile(rf"\bLoadtest {release.major}\.{release.minor}(?![\d.])", re.IGNORECASE)
    found = [i for i in env.ctx.jira.search(jql) if wanted.search((i.get("fields") or {}).get("summary") or "")]
    return found[0] if found else None


def rc1_tag_day(env: AskEnv) -> date:
    return _parse_time(env.ctx.github.commit_date(SERVER_REPO, f"{env.ctx.release.version}-rc1")).date()


def _is_author(user: dict | None, wanted: str) -> bool:
    """Whether a Community user is ``wanted``: their username, or their display name. A bot's
    display name, such as "Mattermost Release bot", is its user's first name."""
    if not user:
        return False
    wanted = " ".join(wanted.split()).casefold()
    names = {user.get("username") or "", user.get("nickname") or "",
             " ".join(f"{user.get('first_name') or ''} {user.get('last_name') or ''}".split())}
    return wanted in {name.casefold() for name in names if name}


def rc_announcement(env: AskEnv, rc: int = 1) -> dict | None:
    """The RC build's announcement on Community: the newest post in Release: Self-Hosted &
    Cloud (RELEASE_AGENT_RC_ANNOUNCE_CHANNEL_ID) since the RC was tagged whose first line is
    "Release 12.2.0 Download Links" (or "Release 12.2.0-rc1 Download Links") and that names
    this exact RC (12.2.0-rc1 or v12.2.0-RC1, never 12.20.0-rc1 or rc10). When
    RELEASE_AGENT_RC_ANNOUNCE_AUTHOR is set (a username or display name, "Mattermost Release
    bot"), only that author's posts count. Only that channel is read, with the read-only
    Community client. None when there's none, or no client or channel."""
    release, community = env.ctx.release, env.community
    if community is None or not env.rc_announce_channel:
        return None
    tag = f"{release.version}-rc{rc}"
    since = int(_parse_time(env.ctx.github.commit_date(SERVER_REPO, tag)).timestamp() * 1000)
    heading = re.compile(rf"^Release v?{release.major}\.{release.minor}\.0(?:-rc\d+)? Download Links$", re.IGNORECASE)
    names_rc = re.compile(rf"(?<![\w.])v?{release.major}\.{release.minor}\.0-rc0*{rc}(?!\d)", re.IGNORECASE)

    def first_line(text: str) -> str:
        line = next((candidate for candidate in (text or "").splitlines() if candidate.strip()), "")
        return " ".join(line.strip().strip("#*_ ").split())

    try:
        posts = community.posts_since(env.rc_announce_channel, since)
        found = [p for p in posts if p.get("create_at", 0) >= since and not p.get("delete_at") and not p.get("root_id")
                 and heading.match(first_line(p.get("message"))) and names_rc.search(p.get("message") or "")]
        if env.rc_announce_author:
            authors = {}
            for post in found:
                if post.get("user_id") not in authors:
                    authors[post.get("user_id")] = _is_author(community.user(post.get("user_id") or ""), env.rc_announce_author)
            found = [p for p in found if authors[p.get("user_id")]]
    except ServiceError:
        env.flag("Couldn't read the RC build announcements on Community: check the Community bot is in that channel.")
        return None
    return max(found, key=lambda p: p.get("create_at", 0)) if found else None


def needed_rc1_announced(env: AskEnv, rule: dict):
    """RC-1 is tagged, and its build announcement is on Community. Without one yet, the ask
    waits a working day from when it could first go out, then links the releases.mattermost.com
    build instead. With no Community channel set, it doesn't wait."""
    needed, reason, facts = needed_rc1_tagged(env, rule)
    if not needed:
        return needed, reason, facts
    if env.community is None or not env.rc_announce_channel:
        return True, "", {}
    post = rc_announcement(env)
    if post:
        return True, "", {"announcement": post}
    start = max(rc1_tag_day(env), env.cache.get(("due", rule["task"])) or env.today)
    if workdays.working_days_between(start, env.today, env.holidays) < 1:
        return None, f"waiting for the {env.ctx.release.version}-RC1 build announcement on Community", {}
    return True, "", {}


NEEDED["rc1_announced"] = needed_rc1_announced


def values_loadtest(env: AskEnv, rule: dict, facts: dict) -> dict:
    values = base_values(env)
    epic = loadtest_epic(env)
    if epic:
        epic_line = f" Loadtest epic: [{epic['key']}]({env.ctx.jira.browse_url(epic['key'])})."
    else:
        epic_line = ""
        env.flag(f"No loadtest epic for {env.ctx.release.short_version} was found in Jira, so the ask doesn't link it.")
    rc_name = f"{env.ctx.release.version}-RC1"
    announcement = facts.get("announcement")
    if announcement:
        rc_link = f"[{rc_name} build announcement]({env.community.post_link(announcement['id'])})"
    else:
        rc_link = f"[{values['rc1_tag']} build]({env.settings['rc_build_url'].format_map(values)})"
    return {**values, "rc_name": rc_name, "rc_link": rc_link, "epic_line": epic_line,
            "loadtest": mentions(env, "loadtest")}


def values_manual(env: AskEnv, rule: dict, facts: dict) -> dict:
    values = base_values(env)
    guidelines = env.rules["manual_test_guidelines"]
    blocks = []
    for key, repo, area, changes in facts["touched"]:
        blocks.append(f"- **{key.title()}: {area['name']}**. What you do: {area['what']} Test IDs: {area['tests']}. "
                      f"Changed by {', '.join(pr_link(repo, c) for c in changes)}.")
    return {**values, "qa": mentions(env, "qa"), "areas": "\n".join(blocks), "compared": " and ".join(facts["compared"]),
            "guidelines_link": f"[{guidelines['title']}]({guidelines['url']})"}


def values_sre(env: AskEnv, rule: dict, facts: dict) -> dict:
    return {**base_values(env), "sre": mentions(env, "sre")}


VALUES = {
    "ces-support-packet.md": values_ces,
    "docs.md": values_docs,
    "docs-reminder.md": values_docs,
    "loadtest.md": values_loadtest,
    "manual-tests.md": values_manual,
    "sre-freemium-pro.md": values_sre,
    "sre-enterprise.md": values_sre,
    "reminder.md": lambda env, rule, facts: {**base_values(env), "title": rule["title"],
                                             "to": " ".join(mentions(env, role) for role in rule["send"]["to"])},
}


# ── Finding asks on Hub ─────────────────────────────────────────────────────────────

def ask_marker(env: AskEnv, rule: dict) -> str:
    return f"{rule['task']}:{env.ctx.release.short_version}"


def since_ms(env: AskEnv) -> int:
    cut = env.ctx.release.milestones.get("branch_cut") or env.ctx.release.window(0)[0]
    start = cut - timedelta(days=14)
    return int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp() * 1000)


def resolve_channel(env: AskEnv, key: str) -> str:
    value = str((env.rules.get("channels") or {}).get(key) or "")
    return env.release_channel if value == "{release_channel}" else value


def find_ask(env: AskEnv, channel: str, marker: str) -> dict | None:
    hub, bot = env.ctx.hub, env.ctx.hub.me()["id"]
    found = [p for p in hub.posts_since(channel, since_ms(env))
             if p.get("user_id") == bot and (p.get("props") or {}).get(ASK_PROP) == marker and not p.get("delete_at")]
    return min(found, key=lambda p: p.get("create_at", 0)) if found else None


def find_by_hand(env: AskEnv, rule: dict, channel: str) -> dict | None:
    """The release manager's own ask: a post in the channel since the branch cut that names the
    release and mentions every person the ask would."""
    if not env.manager:
        return None
    people = [name for role in rule["send"]["to"] for name in _names(env, role)]
    if not people:
        return None
    release = env.ctx.release
    # "v12.2" or "v12.2.0", not v12.20 or the dot release v12.2.1.
    names_release = re.compile(rf"(?<![\w.])v?{release.major}\.{release.minor}(?!\d)(?!\.[1-9])", re.IGNORECASE)
    for post in sorted(env.ctx.hub.posts_since(channel, since_ms(env)), key=lambda p: p.get("create_at", 0)):
        text = post.get("message") or ""
        if (post.get("user_id") == env.manager["id"] and not post.get("root_id") and not post.get("delete_at")
                and names_release.search(text)
                and all(re.search(rf"@{re.escape(name)}(?![\w.-])", text) for name in people)):
            return post
    return None


def _post_day(post: dict) -> date:
    return datetime.fromtimestamp(post.get("create_at", 0) / 1000, timezone.utc).date()


def reminders(env: AskEnv, rule: dict, post: dict) -> list[dict]:
    """The bot's reminders for this ask: two asks can share a thread (the SRE rollout)."""
    bot = env.ctx.hub.me()["id"]
    return [p for p in env.ctx.hub.thread(post.get("root_id") or post["id"])
            if p.get("user_id") == bot and str((p.get("props") or {}).get(REMINDER_PROP) or "").startswith(f"{rule['task']}:")]


# ── One ask ─────────────────────────────────────────────────────────────────────────

def item_state(env: AskEnv, rule: dict) -> str:
    """"closed", "touched" (a person is on it), "open", or "" with no run or item."""
    if not env.run or not rule.get("playbook_item"):
        return ""
    matches = playbook.find_items(env.run, rule["playbook_item"])
    if len(matches) != 1:
        return ""
    item = matches[0][2]
    if item.get("state") == "closed":
        return "closed"
    return "open" if playbook.is_untouched(item) else "touched"


def send(env: AskEnv, handoff: Handoff, where: str, channel: str, text: str, props: dict, root_id: str = "") -> dict | None:
    if not env.live:
        handoff.previews.append((where, text))
        return None
    return env.ctx.hub.create_post(channel, text, props, root_id=root_id)


def process(env: AskEnv, rule: dict, due: date | None, escalate_on: date | None) -> Handoff:
    handoff = Handoff(rule, due=due)
    env.cache[("due", rule["task"])] = due
    if due is None:
        handoff.summary = "not on the calendar"
        return handoff
    if env.today < due:
        handoff.summary = f"due {due.isoformat()}"
        return handoff
    state = item_state(env, rule)
    if state == "closed":
        handoff.state, handoff.summary = DONE, "done in the playbook"
        return handoff
    if state == "touched":
        handoff.state, handoff.summary = BY_PERSON, "a person is handling the playbook item, so the ask is left to them"
        return handoff
    send_config = rule["send"]
    channel = resolve_channel(env, send_config["channel"])
    if not channel:
        handoff.state, handoff.summary = ERROR, f"no Hub channel for {send_config['channel']}"
        return handoff
    marker, facts = ask_marker(env, rule), {}
    root = ""
    if send_config.get("reply_to"):
        parent_rule = next(r for r in env.rules["rules"] if r["task"] == send_config["reply_to"])
        parent = find_ask(env, channel, ask_marker(env, parent_rule)) or find_by_hand(env, parent_rule, channel)
        if not parent:
            handoff.state, handoff.summary = NOT_READY, f"waiting for the {parent_rule['title']} ask to be sent"
            _escalate(env, handoff, escalate_on)
            return handoff
        facts["parent"], root = parent, parent["id"]
    post = find_ask(env, channel, marker) or (None if root else find_by_hand(env, rule, channel))
    done_check = DONE_WHEN[rule["done_when"]]
    if post is None:
        needed, reason, found = NEEDED[rule["needed_when"]](env, rule)
        facts.update(found)
        if needed is None:
            handoff.state, handoff.summary = NOT_READY, reason
            _escalate(env, handoff, escalate_on)
            return handoff
        if needed is False:
            handoff.state, handoff.summary = NOT_NEEDED, f"not needed: {reason}"
            return handoff
        if rule.get("done_before_ask", True) and rule["done_when"] != "sent":
            done, summary, proof = done_check(env, rule, None, facts)
            if done:
                handoff.state, handoff.summary, handoff.proof_url = DONE, f"Already done, ask not sent: {summary}", proof
                return handoff
        template = send_config["template"]
        text = render(template, VALUES[template](env, rule, facts))
        post = send(env, handoff, send_config["channel"], channel, text, {ASK_PROP: marker}, root_id=root)
        if post is None:
            handoff.state = WOULD_SEND
            if rule["done_when"] == "sent":
                handoff.state, handoff.summary = DONE, "would ask today (test mode)"
            else:
                handoff.summary = "would ask today (test mode)"
            return handoff
        handoff.asked_on = env.today
    else:
        handoff.asked_on = _post_day(post)
    done, summary, proof = done_check(env, rule, post, facts)
    if done:
        handoff.state, handoff.summary, handoff.proof_url = DONE, summary, proof
        return handoff
    handoff.state, handoff.summary = WAITING, summary
    if facts.get("counts"):
        handoff.counts = dict(facts["counts"])
    _remind(env, rule, handoff, post, facts)
    _escalate(env, handoff, escalate_on)
    return handoff


def _remind(env: AskEnv, rule: dict, handoff: Handoff, post: dict, facts: dict):
    after = rule.get("remind_after", 0)
    if not after or not post.get("id"):
        return
    sent = reminders(env, rule, post)
    if sent:
        handoff.reminded_on = max(_post_day(p) for p in sent)
    last = handoff.reminded_on or handoff.asked_on
    every = rule.get("remind_every")
    if handoff.reminded_on == env.today or (sent and not every):
        return
    if workdays.working_days_between(last, env.today, env.holidays) < (every if sent else after):
        return
    template = rule["send"].get("reminder", "reminder.md")
    text = render(template, VALUES[template](env, rule, facts))
    channel = resolve_channel(env, rule["send"]["channel"])
    if send(env, handoff, f"{rule['send']['channel']} (reminder, in the ask's thread)", channel, text,
            {REMINDER_PROP: f"{rule['task']}:{env.today.isoformat()}"}, root_id=post.get("root_id") or post["id"]) is not None:
        handoff.reminded_on = env.today


def _escalate(env: AskEnv, handoff: Handoff, escalate_on: date | None):
    """Overdue from ``escalate_at``, or ``escalate_after`` working days after the ask was sent
    (so an ask that went out late isn't overdue the day it goes out)."""
    if escalate_on and env.today >= escalate_on:
        handoff.escalated = True
    after = handoff.rule.get("escalate_after")
    if after and handoff.asked_on and workdays.working_days_between(handoff.asked_on, env.today, env.holidays) >= after:
        handoff.escalated = True


# ── Contributors of the month ───────────────────────────────────────────────────────

def previous_month(today: date) -> tuple[int, int]:
    first = today.replace(day=1) - timedelta(days=1)
    return first.year, first.month


def first_working_day(today: date, holidays: frozenset) -> date:
    day = today.replace(day=1)
    while not workdays.is_working_day(day, holidays):
        day += timedelta(days=1)
    return day


RATE_LIMITED = (403, 429)


def _with_rate_limit_retry(call, sleep, tries: int = 3):
    """``call()``, waiting a minute and trying again when GitHub says a rate limit was hit."""
    for attempt in range(tries + 1):
        try:
            return call()
        except ServiceError as err:
            if err.status not in RATE_LIMITED or attempt == tries:
                raise
            sleep(60)
    raise AssertionError("unreachable")


def month_contributors(github, org: str, year: int, month: int, bot_logins: list[str], sleep=None) -> list[str]:
    """GitHub logins of the commits dated in the month on the default branch of each of the
    org's repos that isn't a fork (every public one and the private ones the token reads),
    without bots, deduplicated and sorted without regard to case. Commits with no linked
    account are left out. A failure raises: a partial list is never returned."""
    last = (date(year + month // 12, month % 12 + 1, 1) - timedelta(days=1))
    since, until = f"{year}-{month:02d}-01T00:00:00Z", f"{last.isoformat()}T23:59:59Z"
    import time
    sleep = sleep or time.sleep
    bots = {login.casefold() for login in bot_logins}
    logins = {}
    for repo in _with_rate_limit_retry(lambda: github.org_repos(org), sleep):
        if repo.get("fork"):
            continue
        commits = _with_rate_limit_retry(lambda name=repo["full_name"]: github.commits_in_range(name, since, until), sleep)
        for commit in commits:
            login = (commit.get("author") or {}).get("login")
            if not login or login.casefold().endswith("[bot]") or login.casefold() in bots:
                continue
            logins.setdefault(login.casefold(), login)
    return sorted(logins.values(), key=str.casefold)


def contributors_messages(month_name: str, mugs: str, logins: list[str]) -> list[str]:
    """The Monthly Mugs post, and when it's too long for one post, numbered thread replies."""
    links = [f"[{login}](https://github.com/{login})" for login in logins]
    head = f"Contributors from the month of {month_name}:" + (f" cc {mugs}" if mugs else "")
    chunks, current = [], []
    for link in links:
        if current and len(", ".join(current + [link])) > MAX_POST_CHARS - 200:
            chunks.append(current)
            current = []
        current.append(link)
    chunks.append(current)
    if len(chunks) == 1:
        return [f"{head}\n\n```\n{', '.join(chunks[0])}\n```"]
    return [f"{head}\n\nThe list is in {len(chunks)} parts, in the replies."] + [
        f"Part {n} of {len(chunks)}:\n\n```\n{', '.join(chunk)}\n```" for n, chunk in enumerate(chunks, 1)]


def process_contributors(env: AskEnv, rule: dict) -> Handoff:
    """The month's contributors, posted in Monthly Mugs on the first working day of the month
    (or the next run after it), once: a ``contributors:YYYY-MM`` marker finds the post again."""
    due = first_working_day(env.today, env.holidays)
    handoff = Handoff(rule, due=due)
    if env.today < due:
        handoff.summary = f"due {due.isoformat()}"
        return handoff
    state = item_state(env, rule)
    if state == "touched":
        handoff.state, handoff.summary = BY_PERSON, "a person is handling the playbook item, so it is left to them"
        return handoff
    year, month = previous_month(env.today)
    marker = f"contributors:{year}-{month:02d}"
    channel = resolve_channel(env, rule["send"]["channel"])
    start = datetime(env.today.year, env.today.month, 1, tzinfo=timezone.utc)
    hub, bot = env.ctx.hub, env.ctx.hub.me()["id"]
    posted = [p for p in hub.posts_since(channel, int(start.timestamp() * 1000))
              if p.get("user_id") == bot and (p.get("props") or {}).get(ASK_PROP) == marker]
    if posted:
        handoff.state, handoff.summary = DONE, "the list is posted"
        handoff.asked_on, handoff.proof_url = _post_day(posted[0]), hub.post_link(posted[0]["id"])
        return handoff
    logins = month_contributors(env.ctx.github, env.settings["contributors_org"], year, month,
                                env.rules.get("contributor_bot_logins") or [], sleep=env.sleep)
    month_name = date(year, month, 1).strftime("%B")
    if not logins:
        # A month with no contributors at all means the repos couldn't be read, not a quiet month.
        handoff.state, handoff.summary = ERROR, "no contributors found, so nothing was posted"
        return handoff
    messages = contributors_messages(month_name, mentions(env, "mugs"), logins)
    handoff.counts = {"contributors": len(logins)}
    root = send(env, handoff, rule["send"]["channel"], channel, messages[0], {ASK_PROP: marker})
    for reply in messages[1:]:
        send(env, handoff, f"{rule['send']['channel']} (thread)", channel, reply, {}, root_id=root["id"] if root else "")
    if root is None:
        handoff.state, handoff.summary = DONE, f"would post {len(logins)} contributors (test mode)"
    else:
        handoff.state, handoff.summary, handoff.proof_url = DONE, f"posted {len(logins)} contributors", hub.post_link(root["id"])
        handoff.asked_on = env.today
    return handoff


# ── Every ask of a release ──────────────────────────────────────────────────────────

def ask_rules(rules: dict) -> list[dict]:
    return [rule for rule in rules["rules"] if rule["type"] == "ask"]


def check_guidelines(env: AskEnv):
    """Flag the manual test guidelines page when its version moved on from manual_test_areas'."""
    guidelines = env.rules.get("manual_test_guidelines")
    confluence = env.ctx.confluence
    if not guidelines or confluence is None:
        return
    try:
        version = confluence.page_version(str(guidelines["page_id"]))
    except Exception:  # noqa: BLE001 - a flag, not a failed run
        env.flag("Couldn't read the manual test guidelines page's version.")
        return
    if version and version != guidelines["version"]:
        env.flag(f"The manual test guidelines changed (now version {version}): update manual_test_areas in rules.yml.")


def process_rule(env: AskEnv, rule: dict, resolve_due) -> Handoff | None:
    """One ask; None for the monthly one when this isn't the first active release.
    ``resolve_due(text)`` turns ``due`` or ``escalate_at`` into a date (None when the calendar
    lacks it)."""
    try:
        if rule["needed_when"] == "monthly":
            return process_contributors(env, rule) if env.ctx.primary else None
        due = resolve_due(rule["due"])
        if due and rule.get("avoid_friday") and due.weekday() == 4:
            due = workdays.add_working_days(due, 1, env.holidays)
        escalate_on = resolve_due(rule["escalate_at"]) if rule.get("escalate_at") else None
        return process(env, rule, due, escalate_on)
    except Exception as err:  # noqa: BLE001 - one failing ask must not stop the others
        said = str(err) if isinstance(err, (ServiceError, CheckError)) else f"unexpected {type(err).__name__}"
        print(f"::warning::{env.ctx.release.short_version} {rule['task']}: {said}")
        return Handoff(rule, ERROR, f"couldn't check: {said}")


def process_all(env: AskEnv, resolve_due) -> list[Handoff]:
    """Every ask of the release, in rules.yml order."""
    if env.ctx.primary:
        check_guidelines(env)
    return [h for h in (process_rule(env, rule, resolve_due) for rule in ask_rules(env.rules)) if h]
