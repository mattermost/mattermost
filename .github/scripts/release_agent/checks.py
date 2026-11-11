"""The Phase 1 checks, one function per rule ``type``.

Each takes the run context and its rule and returns a Result. A Result's ``summary`` is
written to the public Actions log and run.json, so it carries counts and public refs only;
titles, owners and links go in ``items``, which are posted to Hub. Items in a private repo
are shown publicly as "(private repo)".
"""

import json
import re
import sys
from calendar import month_name
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import changelog_release  # noqa: E402  (.github/scripts, shared with the changelog workflow)

PUBLIC_REPOS = frozenset({"mattermost/mattermost"})

PASS = "pass"
FAIL = "fail"
INFO = "info"
SKIPPED = "skipped"


@dataclass
class Item:
    label: str
    title: str = ""
    url: str = ""
    owner: str = ""
    repo: str = ""
    note: str = ""
    reason: str = ""  # why ``owner`` was chosen, such as "unassigned"
    links: list = field(default_factory=list)  # [(label, url)] shown after the item

    @property
    def public_label(self) -> str | None:
        """How the item may appear in public output, or None when it may not."""
        if not self.repo:
            return None
        return self.label if self.repo in PUBLIC_REPOS else "(private repo)"


@dataclass
class Result:
    status: str
    summary: str
    items: list = field(default_factory=list)
    proof_url: str = ""
    hidden: bool = False  # left out of the status post, as when a yearly task is out of season
    unrouted_tickets: int = 0  # unassigned or bot tickets whose Jira Team has no dev lead
    unrouted_teams: list = field(default_factory=list)  # those teams' names: Hub only, never public output


@dataclass
class Context:
    release: object
    today: date
    vars: dict
    has_branch: bool
    rc_numbers: list
    github: object = None
    jira: object = None
    hub: object = None
    testing_alerts_channel: str = ""
    confluence: object = None
    primary: bool = True  # the first active release, which checks the yearly tasks
    branches: set = field(default_factory=set)  # (major, minor) of each release-X.Y branch
    tags: set = field(default_factory=set)  # (major, minor) of each vX.Y.0 tag
    fetch_page: object = None  # (url) -> page text of a public page
    dev_leads: list = field(default_factory=list)  # RELEASE_AGENT_DEV_LEADS: [{teams, username, name}]

    def query(self, rule: dict) -> dict:
        return format_values(rule.get("query") or {}, self.vars)


class CheckError(Exception):
    """A check that can't run, with a message safe for public output."""


def format_values(value, variables: dict):
    if isinstance(value, str):
        try:
            return value.format_map(variables)
        except KeyError as err:
            raise CheckError(f"{{{err.args[0]}}} isn't known for this release") from None
    if isinstance(value, list):
        return [format_values(v, variables) for v in value]
    if isinstance(value, dict):
        return {k: format_values(v, variables) for k, v in value.items()}
    return value


def private_count(items: list) -> str:
    private = sum(1 for item in items if item.repo and item.repo not in PUBLIC_REPOS)
    return f" ({private} in a private repo)" if private else ""


def pr_item(repo: str, pr: dict) -> Item:
    assignees = pr.get("assignees") or []
    owner = assignees[0]["login"] if assignees else (pr.get("user") or {}).get("login", "")
    short = repo.split("/")[-1]
    return Item(f"{short}#{pr['number']}", pr.get("title", ""), pr.get("html_url", ""), owner, repo)


def jira_item(jira, issue: dict) -> Item:
    fields = issue.get("fields") or {}
    owner = (fields.get("assignee") or {}).get("displayName") or "Unassigned"
    return Item(issue["key"], fields.get("summary", ""), jira.browse_url(issue["key"]), owner)


def plural(count: int, word: str, plural_word: str | None = None) -> str:
    return f"{count} {word if count == 1 else (plural_word or word + 's')}"


def _first_line(message: str) -> str:
    return (message or "").split("\n", 1)[0]


def _references(message: str, number: int) -> bool:
    """Whether a commit is PR ``number`` or a cherry-pick of it: its title has ``(#N)`` as a
    squash commit or a cherry-pick carries it ("Fix A (#100) (#150)"), or says "cherry pick of
    #N". A bare mention such as "Fix regression from #N (#M)" is not."""
    return re.search(rf"cherry[- ]?pick(?:ed)?(?: of)? #{number}\b|\(#{number}\)", _first_line(message),
                     re.IGNORECASE) is not None


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ── Checks ──────────────────────────────────────────────────────────────────────────

GITHUB_PR_URL = re.compile(r"https://github\.com/[\w.-]+/([\w.-]+)/pull/(\d+)")


# A Hub lookup that failed, as opposed to one that found nobody (None).
LOOKUP_FAILED = object()


def lookup_with_retry(find):
    """``find()``, tried twice. Returns what it returned, or LOOKUP_FAILED when both tries raised."""
    for _ in range(2):
        try:
            return find()
        except Exception:  # noqa: BLE001 - told apart from "not found" by the caller
            continue
    return LOOKUP_FAILED


class HubPeople:
    """Who to mention on Hub: "@username", or a plain name marked as not found there, or as
    not checked when the Hub request failed (twice). A failed lookup is kept for the run
    so an outage isn't retried for every ticket."""

    def __init__(self, hub):
        self.hub, self.cache = hub, {}

    def by_username(self, username: str, name: str = "") -> str:
        if ("username", username) not in self.cache:
            self.cache[("username", username)] = self._lookup(lambda: self.hub.user_by_username(username))
        return self._show(self.cache[("username", username)], name or username)

    @staticmethod
    def _show(found, name: str) -> str:
        if found is LOOKUP_FAILED:
            return HubPeople.couldnt_check(name)
        return f"@{found['username']}" if found else HubPeople.not_found(name)

    def by_assignee(self, assignee: dict) -> str:
        name = " ".join((assignee.get("displayName") or "").split())
        email = assignee.get("emailAddress") or ""
        key = ("assignee", email or name.casefold())
        if key not in self.cache:
            self.cache[key] = self._lookup(lambda: (email and self.hub.user_by_email(email)) or self._by_name(name))
        return self._show(self.cache[key], name)

    def _by_name(self, name: str) -> dict | None:
        wanted = name.casefold()
        matches = [user for user in self.hub.search_users(name)
                   if " ".join(f"{user.get('first_name', '')} {user.get('last_name', '')}".split()).casefold() == wanted]
        return matches[0] if len(matches) == 1 else None

    @staticmethod
    def _lookup(find):
        found = lookup_with_retry(find)
        if found is LOOKUP_FAILED:
            return found
        return found if found and not found.get("delete_at") else None

    @staticmethod
    def not_found(name: str) -> str:
        return f"{name} (no Hub user found)"

    @staticmethod
    def couldnt_check(name: str) -> str:
        return f"{name} (couldn't check Hub)"


def team_names(value) -> list[str]:
    """The team names in a Jira Team field value: an Atlassian team ({"id", "name", "title"}),
    a select option ({"value"}), a plain string, or a list of these."""
    if isinstance(value, list):
        return [name for entry in value for name in team_names(entry)]
    if isinstance(value, dict):
        value = value.get("name") or value.get("title") or value.get("value") or ""
    return [" ".join(value.split())] if isinstance(value, str) and value.strip() else []


class DevLeads:
    """Who leads a ticket's team: the first route naming its Jira Team, else (with
    ``match_field: team``, as a fallback) the first naming one of its components.

    ``routes`` are the entries of RELEASE_AGENT_DEV_LEADS; ``config`` (from rules.yml) only
    says which Jira field names the team. Team names match without regard to case."""

    def __init__(self, config: dict | None, routes: list | None = None):
        config = config or {}
        self.routes = routes if routes is not None else config.get("routes", [])
        self.team_field = config.get("team_field", "") if config.get("match_field", "team") == "team" else ""
        self.by_team, self.by_component = {}, {}
        for route in self.routes:
            for team in route.get("teams", []):
                self.by_team.setdefault(team.casefold(), route)
            for component in route.get("components", []):
                self.by_component.setdefault(component.casefold(), route)

    @property
    def fields(self) -> list[str]:
        return [self.team_field] if self.team_field else []

    def teams_of(self, fields: dict) -> list[str]:
        return team_names(fields.get(self.team_field)) if self.team_field else []

    def lead_for(self, fields: dict) -> dict | None:
        components = [c.get("name") or "" for c in fields.get("components") or []]
        for name, routes in [(t, self.by_team) for t in self.teams_of(fields)] + [(c, self.by_component) for c in components]:
            if name.casefold() in routes:
                return routes[name.casefold()]
        return None


USERNAME = re.compile(r"^[a-z0-9._-]+$")


def parse_dev_leads(text: str) -> tuple[list[dict], str]:
    """(routes, problem) from RELEASE_AGENT_DEV_LEADS: a JSON list of {teams, username, name}.

    An entry that isn't usable is left out and counted in ``problem``. The message never
    repeats what the variable says, since it ends up in public output.
    """
    if not (text or "").strip():
        return [], ""
    try:
        entries = json.loads(text)
    except ValueError:
        return [], "RELEASE_AGENT_DEV_LEADS isn't valid JSON, so unassigned tickets aren't routed to dev leads."
    if not isinstance(entries, list):
        return [], "RELEASE_AGENT_DEV_LEADS must be a JSON list of {teams, username, name}, so unassigned tickets aren't routed to dev leads."
    routes, bad = [], []
    for number, entry in enumerate(entries, 1):
        names = [entry.get(key) for key in ("teams", "components")] if isinstance(entry, dict) else []
        usable = (isinstance(entry, dict) and set(entry) <= {"teams", "components", "username", "name"}
                  and isinstance(entry.get("username"), str) and USERNAME.match(entry["username"])
                  and any(names) and all(isinstance(n, list) and all(isinstance(t, str) and t.strip() for t in n)
                                         for n in names if n is not None)
                  and isinstance(entry.get("name", ""), str))
        if usable:
            routes.append({**entry, **{key: [t.strip() for t in entry[key]] for key in ("teams", "components") if entry.get(key)}})
        else:
            bad.append(str(number))
    problem = (f"RELEASE_AGENT_DEV_LEADS entries {', '.join(bad)} are not {{teams, username, name}} with a Hub username, so they were ignored."
               if bad else "")
    return routes, problem


def dev_lead_flags(routes: list[dict], hub) -> list[str]:
    """A flag for each dev lead in RELEASE_AGENT_DEV_LEADS who isn't an active Hub user, so a
    lead who has left shows up instead of their tickets quietly losing the mention. They name
    people from a private variable, so they belong in Hub only."""
    flags, seen = [], set()
    for route in routes:
        username = route["username"]
        if username in seen:
            continue
        seen.add(username)
        who = f"{route.get('name') or username} (`{username}`)"
        user = lookup_with_retry(lambda: hub.user_by_username(username))
        if user is LOOKUP_FAILED:
            # Not a missing account: the lookup itself failed, so say only that.
            flags.append(f"Couldn't check that dev lead {who} is on Hub.")
            continue
        if not user:
            flags.append(f"Dev lead {who} in RELEASE_AGENT_DEV_LEADS has no Hub account, so their tickets name them without a mention.")
        elif user.get("delete_at"):
            flags.append(f"Dev lead {who} in RELEASE_AGENT_DEV_LEADS is deactivated on Hub, so their tickets name them without a mention.")
    return flags


def linked_prs(jira, key: str) -> list[tuple[str, str]]:
    """The ticket's GitHub PR remote links, as ("pr-mattermost-36558", url)."""
    found = {}
    for link in jira.remote_links(key):
        url = (link.get("object") or {}).get("url") or ""
        match = GITHUB_PR_URL.match(url)
        if match:
            found.setdefault(f"pr-{match.group(1)}-{match.group(2)}", url)
    return list(found.items())


def open_release_items(ctx: Context, rule: dict) -> Result:
    """Jira issues with the release's fix version that aren't Closed, and open milestone PRs.

    Each issue's ``owner`` is who the post mentions: its assignee, or for an unassigned or
    bot ticket the dev lead of its Jira Team (or component) in ``dev_leads``, else nobody.
    """
    query = ctx.query(rule)
    people = HubPeople(ctx.hub)
    bots = {name.casefold() for name in query.get("bot_assignees", [])}
    leads = DevLeads(query.get("dev_leads"), ctx.dev_leads)
    unrouted = {}  # team name (any case) -> name as first seen, for tickets with no dev lead
    unrouted_tickets = 0
    with_links = query.get("linked_prs_status", "").casefold()
    issues = []
    for issue in ctx.jira.search(query["jql"], extra_fields=leads.fields):
        item, fields = jira_item(ctx.jira, issue), issue.get("fields") or {}
        assignee = fields.get("assignee") or {}
        name = assignee.get("displayName") or ""
        if name and name.casefold() not in bots:
            item.owner = people.by_assignee(assignee)
        else:
            item.reason = name or "unassigned"
            lead = leads.lead_for(fields)
            item.owner = people.by_username(lead["username"], lead.get("name", "")) if lead else ""
            teams = leads.teams_of(fields)
            if not lead and teams:
                unrouted_tickets += 1
                for team in teams:
                    unrouted.setdefault(team.casefold(), team)
        if with_links and ((fields.get("status") or {}).get("name") or "").casefold() == with_links:
            item.links = linked_prs(ctx.jira, issue["key"])
        issues.append(item)
    prs = []
    excluded = "".join(f" -author:{author}" for author in query.get("exclude_authors", []))
    for repo in query.get("repos", []):
        search = f'repo:{repo} is:pr is:open milestone:"{ctx.vars["milestone"]}"{excluded}'
        prs += [pr_item(repo, pr) for pr in ctx.github.search_issues(search)]
    summary = f"{plural(len(issues), 'open Jira issue')} and {plural(len(prs), 'open PR')}{private_count(prs)}"
    return Result(INFO, summary, issues + prs, ctx.jira.filter_url(query["jql"]), unrouted_tickets=unrouted_tickets,
                  unrouted_teams=sorted(unrouted.values(), key=str.casefold))


REPO_PR_URL = re.compile(r"^https://github\.com/([\w.-]+/[\w.-]+)/pull/(\d+)(?:[/?#].*)?$", re.IGNORECASE)


def _mentions_key(text: str, key: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(key)}(?!\d)", text or "", re.IGNORECASE) is not None


def cherry_picks_to_label(ctx: Context, rule: dict) -> Result:
    """Submitted tickets' PRs in ``repos`` that still need a cherry-pick label or the milestone.

    These are the repos release-cherry-pick-labels.yml can't write to (its GITHUB_TOKEN only
    reaches mattermost/mattermost), so the release manager labels them by hand. PRs are found
    as that workflow finds them: the ticket's Jira links, else PRs naming the ticket in their
    title or branch, leaving out by-title matches with another milestone (earlier fixes).
    Only PRs against ``base_branch`` that weren't closed unmerged count.
    """
    query = ctx.query(rule)
    repos = [repo.lower() for repo in query["repos"]]
    done_labels, milestone = {label.casefold() for label in query["labels"]}, query["milestone"]
    todo, seen = [], set()
    for issue in ctx.jira.search(query["jql"]):
        key = issue["key"]
        linked = {}
        for link in ctx.jira.remote_links(key):
            match = REPO_PR_URL.match(((link.get("object") or {}).get("url") or "").strip())
            if match:
                linked.setdefault((match.group(1).lower(), int(match.group(2))), False)
        if not linked:
            for repo in repos:
                for found in ctx.github.search_issues(f'repo:{repo} is:pr "{key}"'):
                    linked.setdefault((repo, found["number"]), True)
        for (repo, number), by_title in sorted(linked.items()):
            if repo not in repos or (repo, number) in seen:
                continue
            pull = ctx.github.pull(repo, number)
            if by_title and not (_mentions_key(pull.get("title"), key)
                                 or _mentions_key((pull.get("head") or {}).get("ref"), key)):
                continue
            current = (pull.get("milestone") or {}).get("title") or ""
            if ((pull.get("base") or {}).get("ref") != query["base_branch"]
                    or (pull.get("state") == "closed" and not pull.get("merged_at"))
                    or (by_title and current not in ("", milestone))):
                continue
            seen.add((repo, number))
            needs = []
            if not done_labels & {label["name"].casefold() for label in pull.get("labels") or []}:
                needs.append(f"`{query['labels'][0]}`")
            if not current:
                needs.append(f"milestone {milestone}")
            elif current != milestone:
                needs.append(f"milestone {milestone} (it has {current})")
            if needs:
                todo.append(Item(f"{repo.split('/')[-1]}#{number}", pull.get("title", ""), pull.get("html_url", ""),
                                 repo=repo, note=f"{key}: add {' and '.join(needs)}"))
    if todo:
        return Result(FAIL, f"{plural(len(todo), 'cherry-pick PR')} to label by hand{private_count(todo)}", todo)
    return Result(PASS, f"No cherry-pick PRs to label by hand ({plural(len(seen), 'PR')} checked)")


def new_regressions(ctx: Context, rule: dict) -> Result:
    """Regressions filed since the branch cut, which pass once every one has a fix version.

    The JQL decides what counts as a regression, including bugs that only mention the release
    in their text. Duplicates and other ``excluded_resolutions`` are skipped here too.
    """
    query = ctx.query(rule)
    excluded = {name.casefold() for name in query.get("excluded_resolutions", [])}
    regressions, missing = [], []
    for issue in ctx.jira.search(query["jql"]):
        fields = issue.get("fields") or {}
        if ((fields.get("resolution") or {}).get("name") or "").casefold() in excluded:
            continue
        regressions.append(issue)
        if not fields.get("fixVersions"):
            missing.append(jira_item(ctx.jira, issue))
    proof = ctx.jira.filter_url(query["jql"])
    if missing:
        return Result(FAIL, f"{len(missing)} of {plural(len(regressions), 'new regression')} have no fix version", missing, proof)
    return Result(PASS, f"All {plural(len(regressions), 'new regression')} have a fix version", [], proof)


def resolved_tickets(ctx: Context, rule: dict) -> Result:
    """Every ticket with the release's fix version that is Resolved has been Closed."""
    issues = ctx.jira.search(ctx.query(rule)["jql"])
    proof = ctx.jira.filter_url(ctx.query(rule)["jql"])
    if issues:
        return Result(FAIL, f"{plural(len(issues), 'ticket')} still Resolved, not Closed",
                      [jira_item(ctx.jira, issue) for issue in issues], proof)
    return Result(PASS, "No Resolved tickets are left to close", [], proof)


def hub_release_branch(ctx: Context, rule: dict) -> Result:
    """Hub runs a build of the release branch: its version and build commit both match."""
    branch = ctx.vars["branch"]
    if not ctx.has_branch:
        return Result(SKIPPED, f"{branch} doesn't exist yet")
    repo = ctx.query(rule).get("repo", "mattermost/mattermost")
    version, build_hash = ctx.hub.server_version()
    match = re.match(r"(\d+)\.(\d+)", version or "")
    if not match or (int(match.group(1)), int(match.group(2))) != ctx.release.key:
        return Result(FAIL, f"Hub isn't running {ctx.release.short_version}",
                      [Item("Hub", note=f"Hub reports version {version or 'unknown'}")])
    if not build_hash or build_hash.lower() in ("none", "dev"):
        # Without a build commit the version alone can't show the build is from the branch.
        return Result(FAIL, f"Hub's build commit isn't known, so it can't be matched to {branch}",
                      [Item("Hub", note=f"Hub reports version {version} with no build commit")])
    try:
        on_branch = ctx.github.is_on_branch(repo, build_hash, branch)
    except Exception:  # noqa: BLE001 - an unknown commit means it isn't on the branch
        on_branch = False
    if not on_branch:
        return Result(FAIL, f"Hub's build isn't from {branch}",
                      [Item("Hub", note=f"Hub runs {version}, build {build_hash[:12]}, which isn't on {branch}")])
    proof = f"https://github.com/{repo}/commit/{build_hash}"
    return Result(PASS, f"Hub runs {ctx.release.short_version} from {branch}", [], proof)


def _labels(items: list) -> str:
    return ", ".join(item.public_label for item in items)


def notice_txt(ctx: Context, rule: dict) -> Result:
    """Every NOTICE.txt bot PR with the release's milestone is merged and on the release branch.

    PRs with another milestone don't count: the next release's is merged to master after the
    cut and needn't be on this branch. An open one fails; one closed unmerged is ignored.
    """
    branch = ctx.vars["branch"]
    if not ctx.has_branch:
        return Result(SKIPPED, f"{branch} doesn't exist yet")
    query = ctx.query(rule)
    repo, milestone = query["repo"], query["milestone"]
    search = f'repo:{repo} is:pr author:{query["author"]} in:title "{query["title"]}" milestone:"{milestone}"'
    found = ctx.github.search_issues(search, sort="created")
    unmerged, missing, on_branch, commits = [], [], [], None
    for pr in found:
        item = pr_item(repo, pr)
        if pr.get("state") == "open":
            unmerged.append(item)
            continue
        pull = ctx.github.pull(repo, pr["number"])
        if not pull.get("merged_at"):
            continue
        if commits is None:
            commits = ctx.github.commits(repo, branch, path="NOTICE.txt", limit=100)
        sha = pull.get("merge_commit_sha", "")
        landed = any(c.get("sha") == sha or _references(c["commit"]["message"], pr["number"]) for c in commits)
        (on_branch if landed else missing).append(item)
    problems = []
    if unmerged:
        problems.append(f"{_labels(unmerged)} {'isn' if len(unmerged) == 1 else 'aren'}'t merged")
    if missing:
        problems.append(f"{_labels(missing)} {'is' if len(missing) == 1 else 'are'} merged but not on {branch}")
    if problems:
        bad = unmerged + missing
        return Result(FAIL, "; ".join(problems), bad, bad[0].url)
    if not on_branch:
        return Result(SKIPPED, f"No NOTICE.txt PR has the {milestone} milestone")
    if len(on_branch) == 1:
        return Result(PASS, f"{on_branch[0].public_label} is merged and on {branch}", [], on_branch[0].url)
    return Result(PASS, f"All {len(on_branch)} NOTICE.txt PRs with the {milestone} milestone are merged and on {branch}",
                  [], on_branch[0].url)


def cherry_picks(ctx: Context, rule: dict) -> Result:
    """Every approved cherry-pick in the milestone that's merged to master is on the release branch."""
    branch = ctx.vars["branch"]
    if not ctx.has_branch:
        return Result(SKIPPED, f"{branch} doesn't exist yet")
    query = ctx.query(rule)
    labels = ",".join(f'"{label}"' for label in query["labels"])
    total, missing = 0, []
    for repo in query["repos"]:
        search = f'repo:{repo} is:pr is:merged base:master label:{labels} milestone:"{ctx.vars["milestone"]}"'
        prs = ctx.github.search_issues(search)
        if not prs:
            continue
        total += len(prs)
        earliest = min(pr["pull_request"]["merged_at"] for pr in prs)
        messages = [c["commit"]["message"] for c in ctx.github.commits(repo, branch, since=earliest, limit=3000)]
        for pr in prs:
            if any(_references(message, pr["number"]) for message in messages):
                continue
            sha = ctx.github.pull(repo, pr["number"]).get("merge_commit_sha")
            if sha and ctx.github.is_on_branch(repo, sha, branch):
                continue
            missing.append(pr_item(repo, pr))
    if missing:
        return Result(FAIL, f"{len(missing)} of {plural(total, 'approved cherry-pick')} aren't on {branch}{private_count(missing)}", missing)
    return Result(PASS, f"All {plural(total, 'approved cherry-pick')} are on {branch}")


def _post_text(post: dict) -> str:
    parts = [post.get("message", "")]
    for attachment in (post.get("props") or {}).get("attachments") or []:
        parts += [attachment.get(key) or "" for key in ("pretext", "title", "text", "fallback")]
        for item in attachment.get("fields") or []:
            parts += [str(item.get("title") or ""), str(item.get("value") or "")]
    return "\n".join(parts).lower()


def e2e_results(ctx: Context, rule: dict) -> Result:
    """E2E results for the latest RC are posted in the Release: Testing Alerts channel."""
    if not ctx.rc_numbers:
        return Result(SKIPPED, f"No {ctx.release.short_version} RC is tagged yet")
    rc_tag = ctx.vars["rc_tag"]
    since = _parse_time(ctx.github.commit_date("mattermost/mattermost", rc_tag))
    since_ms = int(since.timestamp() * 1000)
    patterns = [p.lower() for p in ctx.query(rule)["match_any"]]
    # A post that names an earlier RC (rc1 when rc2 is the latest) isn't this RC's result,
    # even when it also names the shared release branch.
    base = rc_tag.rsplit("-rc", 1)[0]
    earlier = [f"{base}-rc{n}".lower() for n in ctx.rc_numbers if f"{base}-rc{n}" != rc_tag]
    posts = [p for p in ctx.hub.posts_since(ctx.testing_alerts_channel, since_ms)
             if p.get("create_at", 0) >= since_ms and not p.get("delete_at")]

    def is_for_latest(text: str) -> bool:
        if not any(pattern in text for pattern in patterns):
            return False
        if rc_tag.lower() in text:
            return True
        return not any(re.search(rf"{re.escape(tag)}(?!\d)", text) for tag in earlier)

    found = sorted((p for p in posts if is_for_latest(_post_text(p))), key=lambda p: p["create_at"])
    if not found:
        return Result(FAIL, f"No E2E results posted for {rc_tag} yet")
    proof = f"{ctx.hub.base_url}/_redirect/pl/{found[-1]['id']}"
    return Result(PASS, f"E2E results posted for {rc_tag}", [], proof)


def release_tags(ctx: Context, rule: dict) -> Result:
    """The RC (``tag_prefix``) or final (``tag``) tag exists in every repo."""
    query = ctx.query(rule)
    wanted = query.get("tag") or f"{query['tag_prefix']}*"
    missing = []
    for repo in query["repos"]:
        if query.get("tag"):
            present = query["tag"] in ctx.github.tags_with_prefix(repo, query["tag"])
        else:
            prefix = query["tag_prefix"]
            present = any(re.fullmatch(rf"{re.escape(prefix)}\d+", tag) for tag in ctx.github.tags_with_prefix(repo, prefix))
        if not present:
            missing.append(Item(repo.split("/")[-1], f"No {wanted} tag", f"https://github.com/{repo}/tags", repo=repo))
    if missing:
        where = ", ".join(item.public_label for item in missing)
        return Result(FAIL, f"{wanted} isn't tagged in {where}", missing)
    return Result(PASS, f"{wanted} is tagged in {plural(len(query['repos']), 'repo')}")


BATCH_WINDOW = timedelta(hours=12)
# The X.Y.0 title is unique to the release, so searching from before the final build is
# safe, and it allows for a calendar date that's a little late.
VERSION_GO_LOOKBACK = timedelta(days=7)


def version_go_prs(ctx: Context, rule: dict) -> Result:
    """The bot's "Update latest … version" PRs opened with the final build are all merged.

    The batch is the PR updating to this release's X.Y.0 and every other "Update latest" PR
    opened with it, such as the patch versions of older releases.
    """
    query = ctx.query(rule)
    repo, since = query["repo"], date.fromisoformat(query["created_since"])
    version = ctx.release.version.lstrip("v")
    if ctx.today < since:
        return Result(SKIPPED, f"The version.go PRs are opened on {since.isoformat()}")
    search_from = (since - VERSION_GO_LOOKBACK).isoformat()
    search = f'repo:{repo} is:pr author:{query["author"]} in:title "Update latest" created:>={search_from}'
    prs = ctx.github.search_issues(search)
    # Search indexes "12.2.0" as one token but drops the dots, so match the title here.
    title = re.compile(rf"version to {re.escape(version)}\s*$")
    targets = [_parse_time(pr["created_at"]) for pr in prs if title.search(pr.get("title", ""))]
    if not targets:
        return Result(FAIL, f"No “Update latest … version to {version}” PR since {search_from}")
    batch = [pr for pr in prs if any(abs(_parse_time(pr["created_at"]) - t) <= BATCH_WINDOW for t in targets)]
    # A PR closed without merging isn't merged either.
    unmerged = [pr_item(repo, pr) for pr in batch
                if pr.get("state") == "open" or not ctx.github.pull(repo, pr["number"]).get("merged_at")]
    if unmerged:
        labels = ", ".join(item.public_label for item in unmerged)
        return Result(FAIL, f"{len(unmerged)} of {plural(len(batch), 'version.go PR')} not merged: {labels}", unmerged)
    return Result(PASS, f"All {plural(len(batch), 'version.go PR')} merged")


# A holiday on the Confluence page, as in "(11/11/2026)": month/day/year.
HOLIDAY_DATE = re.compile(r"(?<![\d/])(\d{1,2})/(\d{1,2})/(\d{4})(?!\d)")


def page_holidays(text: str, heading: str, years) -> set[date]:
    """Every M/DD/YYYY date in each year's section of the holidays page.

    ``heading`` has a ``{year}`` placeholder. A section runs from its heading to the next
    heading of that form, whatever its year.
    """
    text, heading = " ".join(text.split()), " ".join(heading.split())
    before, _, after = heading.partition("{year}")
    any_heading = re.compile(re.escape(before) + r"\d{4}" + re.escape(after), re.IGNORECASE)
    starts = [(m.start(), m.end(), m.group(0)) for m in any_heading.finditer(text)]
    wanted = {heading.format(year=year).casefold() for year in years}
    days = set()
    for index, (_, end, found) in enumerate(starts):
        if " ".join(found.split()).casefold() not in wanted:
            continue
        stop = starts[index + 1][0] if index + 1 < len(starts) else len(text)
        for match in HOLIDAY_DATE.finditer(text[end:stop]):
            month, day, year = (int(g) for g in match.groups())
            try:
                days.add(date(year, month, day))
            except ValueError:
                continue
    return days


def holidays_page(ctx: Context, rule: dict) -> Result:
    """In October, the Confluence holidays page has next year's heading and holiday list.

    The list is at least ``min_dates`` dates in next year, such as "(1/01/2028)", after the
    heading. It's a yearly task rather than a release one, so only the first active release
    checks it. The page is private: its URL is the proof, and only counts go in the summary.
    """
    query = ctx.query(rule)
    month = int(query["month"])
    if ctx.today.month != month or not ctx.primary:
        why = "it's checked by the earlier active release" if ctx.today.month == month else f"it's checked in {month_name[month]}"
        return Result(SKIPPED, f"Not checked: {why}", hidden=True)
    page_id = str(query.get("page_id") or "").strip()
    if not page_id:
        raise CheckError("RELEASE_AGENT_HOLIDAYS_PAGE_ID isn't set")
    year, heading, wanted = ctx.today.year + 1, " ".join(query["heading"].split()), int(query["min_dates"])
    text, url = ctx.confluence.page(page_id)
    text = " ".join(text.split())
    start = text.casefold().find(heading.casefold())
    if start < 0:
        problem = f"The holidays page has no “{heading}” heading yet"
    else:
        # The section ends at the next year's heading, so dates under a later heading don't count.
        end = start + len(heading)
        other = re.compile(re.escape(heading).replace(str(year), r"\d{4}"), re.IGNORECASE)
        stop = next((m.start() for m in other.finditer(text, end) if m.group(0).casefold() != heading.casefold()), len(text))
        days = set()
        for m in HOLIDAY_DATE.finditer(text[end:stop]):
            month_, day_, year_ = (int(g) for g in m.groups())
            try:
                if year_ == year:
                    days.add(date(year_, month_, day_))
            except ValueError:
                continue  # not a calendar date
        dates = len(days)
        if dates >= wanted:
            return Result(PASS, f"The holidays page lists {dates} holidays in {year}", [], url)
        problem = f"The holidays page lists {dates} of at least {wanted} holidays in {year}"
    return Result(FAIL, problem, [Item("Holidays page", "Add next year's holidays", url)], url)


# ── The changelog PR (opened by the changelog workflow) and its entry ─────────────────

# generate_changelog.RELEASE_DATE_PLACEHOLDER: a scheduled run isn't given the date, so the
# entry says "**Release day: TBD**" until someone sets it. generate_changelog needs
# `requests`, which this agent doesn't install, so the two small helpers below mirror its
# entry parsing (_entry_start) rather than importing it.
RELEASE_DAY_TBD = re.compile(r"Release day:\s*\**\s*TBD\b", re.IGNORECASE)
MIGRATION_NAME = re.compile(r"^(\d+)_(.+)\.up\.sql$")


def changelog_file(ctx: Context) -> str:
    """The changelog file of the release's major version, as the changelog workflow names it."""
    return changelog_release.changelog_path(ctx.release.version)


def entry_text(content: str | None, short: str) -> str | None:
    """The ``## Release vX.Y`` entry of a changelog file, up to the next release's, or None."""
    lines = (content or "").split("\n")
    heading = re.compile(r"^## Release " + re.escape(short) + r"\b(?!\.)")
    start = next((i for i, line in enumerate(lines) if heading.match(line)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## Release ")), len(lines))
    return "\n".join(lines[start:end])


def _bot_name(login: str) -> str:
    return (login or "").removesuffix("[bot]").removeprefix("app/").casefold()


def changelog_prs(ctx: Context, query: dict) -> list[dict]:
    """The changelog workflow's PRs for this release, newest first.

    Found by head branch (``changelog/vX.Y.0``) and, when ``author`` is set, by the bot that
    opens them, whether the login is written ``app/name`` or ``name[bot]``.
    """
    repo = query["repo"]
    found = ctx.github.pulls_by_head(repo, f"{repo.split('/')[0]}:{query['branch']}")
    wanted = _bot_name(query.get("author", ""))
    # Only PRs into the base branch: one retargeted to a release branch isn't the changelog PR.
    found = [pr for pr in found if (pr.get("base") or {}).get("ref") == query["base_branch"]]
    found = [pr for pr in found if not wanted or _bot_name((pr.get("user") or {}).get("login", "")) == wanted]
    return sorted(found, key=lambda pr: pr.get("created_at", ""), reverse=True)


def _pr_state(pr: dict) -> str:
    if pr.get("merged_at"):
        return "merged"
    return "closed without merging" if pr.get("state") == "closed" else ("draft" if pr.get("draft") else "open")


def _changelog_pr(ctx: Context, query: dict):
    """(newest changelog PR, items for the older ones, Result when there is no usable PR)."""
    repo = query["repo"]
    prs = changelog_prs(ctx, query)
    if not prs:
        return None, [], Result(FAIL, f"No changelog PR yet ({query['branch']})")
    pr, others = prs[0], prs[1:]
    items = [Item(f"{repo.split('/')[-1]}#{other['number']}", other.get("title", ""), other.get("html_url", ""),
                  repo=repo, note=f"another changelog PR for this release, {_pr_state(other)}") for other in others]
    if _pr_state(pr) == "closed without merging":
        return pr, items, Result(FAIL, f"The changelog PR {pr_item(repo, pr).label} was closed without merging",
                                 [pr_item(repo, pr)] + items, pr.get("html_url", ""))
    return pr, items, None


def _has_reviewers(ctx: Context, repo: str, pr: dict) -> bool:
    if pr.get("requested_reviewers") or pr.get("requested_teams"):
        return True
    return any(review.get("state") != "PENDING" for review in ctx.github.reviews(repo, pr["number"]))


def _live_page_has_entry(ctx: Context, url: str, short: str) -> bool:
    try:
        page = ctx.fetch_page(url)
    except Exception:  # noqa: BLE001 - a page that can't be read isn't live yet
        return False
    # The entry's heading, "Release v12.2 - Feature Release", not a mention of "Release v12.2" in
    # navigation or related links. The dash may be rendered as an en or em dash.
    return re.search(rf"Release {re.escape(short)}\s+[-–—]\s", page or "") is not None


def changelog_pr(ctx: Context, rule: dict) -> Result:
    """The changelog workflow's PR exists (``state: exists``), is ready for review
    (``ready``) or is merged and live on docs.mattermost.com (``merged``)."""
    query = ctx.query(rule)
    state, repo = query["state"], query["repo"]
    pr, extra, failed = _changelog_pr(ctx, query)
    if failed:
        return failed
    item, url = pr_item(repo, pr), pr.get("html_url", "")
    short = ctx.release.short_version
    if state == "exists":
        return Result(PASS, f"The changelog PR {item.label} exists ({_pr_state(pr)})", extra, url)
    merged = bool(pr.get("merged_at"))
    if state == "ready":
        if not merged and pr.get("draft"):
            return Result(FAIL, f"The changelog PR {item.label} is still a draft", [item] + extra, url)
        if not merged and not _has_reviewers(ctx, repo, pr):
            return Result(FAIL, f"The changelog PR {item.label} is ready but has no reviewers", [item] + extra, url)
        notes = list(extra)
        if not merged:
            entry = entry_text(ctx.github.file_text(repo, changelog_file(ctx), (pr.get("head") or {}).get("sha", "")), short)
            if entry and RELEASE_DAY_TBD.search(entry):
                notes.insert(0, Item(item.label, "", url, repo=repo, note="the entry still says Release day: TBD"))
        return Result(PASS, f"The changelog PR {item.label} is ready for review"
                      + (" (merged)" if merged else ""), notes, url)
    # state == "merged"
    if not merged:
        return Result(FAIL, f"The changelog PR {item.label} isn't merged yet ({_pr_state(pr)})", [item] + extra, url)
    if entry_text(ctx.github.file_text(repo, changelog_file(ctx), query["base_branch"]), short) is None:
        return Result(FAIL, f"The changelog PR {item.label} is merged, but {query['base_branch']} has no "
                      f"{short} entry", [item] + extra, url)
    if not _live_page_has_entry(ctx, query["live_url"], short):
        return Result(FAIL, f"The changelog PR {item.label} is merged, not live on docs.mattermost.com yet",
                      [item] + extra, url)
    return Result(PASS, f"The changelog PR {item.label} is merged and {short} is live on docs.mattermost.com",
                  extra, query["live_url"])


def _identifiers(sql: str) -> set[str]:
    """Table, column, index, type and view names a PostgreSQL migration creates, alters or drops."""
    name = r'"?([A-Za-z_][A-Za-z0-9_]*)"?'
    schema = r'(?:"?[A-Za-z_][A-Za-z0-9_]*"?\.)?'
    found = set()
    for pattern in (
        rf"\b(?:CREATE|DROP|ALTER)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:ONLY\s+)?{schema}{name}",
        rf"\b(?:ADD|DROP|ALTER|RENAME)\s+COLUMN\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?{name}",
        rf"\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?{name}\s+ON\s+(?:ONLY\s+)?{schema}{name}",
        rf"\bDROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?{schema}{name}",
        rf"\b(?:CREATE|ALTER|DROP)\s+TYPE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?{schema}{name}",
        rf"\b(?:CREATE\s+(?:OR\s+REPLACE\s+)?|DROP\s+|ALTER\s+|REFRESH\s+)(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?{schema}{name}",
    ):
        for match in re.finditer(pattern, sql or "", re.IGNORECASE):
            found |= {g.lower() for g in match.groups() if g}
    return found - {"if", "not", "exists", "only", "column"}


def _mentions(section: str, number: int, identifiers: set[str]) -> bool:
    """Whether the Database Schema Changes text names the migration by number or by a table
    or column it changes. The wording is the writer's; only the names are looked for."""
    text = section.lower()
    # By number: the file's zero-padded form (000150), or "migration 150" / "migration #150".
    if number >= 0 and re.search(rf"(?<!\d)0+{number}(?!\d)|migrations?\s*(?:number\s*)?#?0*{number}(?!\d)", text):
        return True
    return any(re.search(rf"(?<![a-z0-9_]){re.escape(name)}(?![a-z0-9_])", text) for name in identifiers)


def _schema_section(entry: str | None) -> str | None:
    lines = (entry or "").split("\n")
    start = next((i for i, line in enumerate(lines) if re.match(r"^#### +Database Schema Changes\b", line)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if re.match(r"^#{1,4} ", lines[i])), len(lines))
    return "\n".join(lines[start:end])


def changelog_migrations(ctx: Context, rule: dict) -> Result:
    """New PostgreSQL migrations in the release are described in the changelog entry.

    The release's migrations are the ``*.up.sql`` files on its branch that the previous
    release lacks: its vX.Y.0 tag, or its branch until it is tagged (the base the changelog
    workflow uses). The check never fails on wording, only when the entry can't be checked.
    """
    query = ctx.query(rule)
    branch, repo = ctx.vars["branch"], query["repo"]
    if not ctx.has_branch:
        return Result(SKIPPED, f"{branch} doesn't exist yet")
    base = changelog_release.previous_release_base(ctx.release.major, ctx.release.minor, ctx.branches, ctx.tags)
    if base is None:
        return Result(SKIPPED, "There's no earlier release to compare with")
    base_ref = base[0].removeprefix("origin/")
    before = ctx.github.tree_files(repo, base_ref, query["migrations_path"])
    names = sorted(name for name in ctx.github.tree_files(repo, branch, query["migrations_path"])
                   if name.endswith(".up.sql") and name not in before)
    if not names:
        return Result(PASS, "No new migrations this release")
    pr, extra, failed = _changelog_pr(ctx, query)
    if failed:
        return Result(FAIL, f"{plural(len(names), 'new migration')} to check, but the changelog PR is missing or closed",
                      failed.items, failed.proof_url)
    url = pr.get("html_url", "")
    ref = query["base_branch"] if pr.get("merged_at") else (pr.get("head") or {}).get("sha", "")
    section = _schema_section(entry_text(ctx.github.file_text(repo, changelog_file(ctx), ref), ctx.release.short_version))
    if section is None:
        return Result(FAIL, f"{plural(len(names), 'new migration')}, but the changelog entry has no "
                      "Database Schema Changes section", [pr_item(repo, pr)], url)
    missing = []
    for name in names:
        match = MIGRATION_NAME.match(name)
        number = int(match.group(1)) if match else -1
        sql = ctx.github.file_text(repo, f"{query['migrations_path']}/{name}", branch)
        if not _mentions(section, number, _identifiers(sql or "")):
            missing.append(Item(name.removesuffix(".up.sql"), "", url, note="not mentioned in Database Schema Changes"))
    if missing:
        return Result(PASS, f"{plural(len(names), 'new migration')}, {len(missing)} not mentioned in the changelog entry", missing + extra, url)
    return Result(PASS, f"The changelog entry covers {plural(len(names), 'new migration')}", extra, url)


def changelog_labels(ctx: Context, rule: dict) -> Result:
    """Every merged milestone PR has one of the changelog labels.

    generate-changelog.yml adds the labels itself, so this is a backstop: a PR listed here is
    one the changelog workflow hasn't labelled yet, not a task for its developer.
    """
    query = ctx.query(rule)
    exclusions = " ".join(f'-label:"{label}"' for label in query["labels"])
    missing = []
    for repo in query["repos"]:
        search = f'repo:{repo} is:pr is:merged milestone:"{ctx.vars["milestone"]}" {exclusions}'
        # No owner: labelling is the workflow's job, so no developer is named.
        missing += [Item(item.label, item.title, item.url, repo=repo)
                    for item in (pr_item(repo, pr) for pr in ctx.github.search_issues(search))]
    if missing:
        return Result(FAIL, f"{plural(len(missing), 'merged PR')}{private_count(missing)}: the changelog workflow "
                      "hasn't labelled these yet", missing)
    return Result(PASS, "Every merged milestone PR has a changelog label")


CHECKS = {
    "open_release_items": (open_release_items, "report_only"),
    "cherry_picks_to_label": (cherry_picks_to_label, "none_missing"),
    "new_regressions": (new_regressions, "all_have_fix_version"),
    "resolved_tickets": (resolved_tickets, "none_missing"),
    "hub_release_branch": (hub_release_branch, "versions_match"),
    "notice_txt": (notice_txt, "merged_and_on_release_branch"),
    "cherry_picks": (cherry_picks, "all_on_release_branch"),
    "e2e_results": (e2e_results, "found"),
    "release_tags": (release_tags, "present"),
    "version_go_prs": (version_go_prs, "merged"),
    "changelog_pr": (changelog_pr, "state_reached"),
    "changelog_migrations": (changelog_migrations, "described_or_none"),
    "changelog_labels": (changelog_labels, "none_missing"),
    "holidays_page": (holidays_page, "next_year_listed"),
}

