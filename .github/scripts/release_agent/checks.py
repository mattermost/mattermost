"""The Phase 1 checks, one function per rule ``type``.

Each takes the run context and its rule and returns a Result. A Result's ``summary`` is
written to the public Actions log and run.json, so it carries counts and public refs only;
titles, owners and links go in ``items``, which are posted to Hub. Items in a private repo
are shown publicly as "(private repo)".
"""

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

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

    def query(self, rule: dict) -> dict:
        return format_values(rule.get("query") or {}, self.vars)


def format_values(value, variables: dict):
    if isinstance(value, str):
        return value.format_map(variables)
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
    return re.search(rf"#{number}\b", _first_line(message)) is not None


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ── Checks ──────────────────────────────────────────────────────────────────────────

def open_release_items(ctx: Context, rule: dict) -> Result:
    """Jira issues with the release's fix version that aren't Closed, and open milestone PRs."""
    query = ctx.query(rule)
    issues = [jira_item(ctx.jira, issue) for issue in ctx.jira.search(query["jql"])]
    prs = []
    for repo in query.get("repos", []):
        search = f'repo:{repo} is:pr is:open milestone:"{ctx.vars["milestone"]}"'
        prs += [pr_item(repo, pr) for pr in ctx.github.search_issues(search)]
    summary = f"{plural(len(issues), 'open Jira issue')} and {plural(len(prs), 'open PR')}{private_count(prs)}"
    return Result(INFO, summary, issues + prs, ctx.jira.filter_url(query["jql"]))


def new_regressions(ctx: Context, rule: dict) -> Result:
    """Regressions filed since the branch cut, which pass once every one has a fix version."""
    query = ctx.query(rule)
    labels = {label.lower() for label in query.get("labels", [])}
    prefix = query.get("title_prefix", "").lower()
    regressions, missing = [], []
    for issue in ctx.jira.search(query["jql"]):
        fields = issue.get("fields") or {}
        is_labelled = labels & {label.lower() for label in fields.get("labels") or []}
        is_titled = prefix and (fields.get("summary") or "").strip().lower().startswith(prefix)
        if not (is_labelled or is_titled):
            continue
        regressions.append(issue)
        if not fields.get("fixVersions"):
            missing.append(jira_item(ctx.jira, issue))
    proof = ctx.jira.filter_url(query["jql"])
    if missing:
        return Result(FAIL, f"{len(missing)} of {plural(len(regressions), 'new regression')} have no fix version", missing, proof)
    return Result(PASS, f"All {plural(len(regressions), 'new regression')} have a fix version", [], proof)


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
    if build_hash and build_hash.lower() not in ("none", "dev"):
        try:
            on_branch = ctx.github.is_on_branch(repo, build_hash, branch)
        except Exception:  # noqa: BLE001 - an unknown commit means it isn't on the branch
            on_branch = False
        if not on_branch:
            return Result(FAIL, f"Hub's build isn't from {branch}",
                          [Item("Hub", note=f"Hub runs {version}, build {build_hash[:12]}, which isn't on {branch}")])
        proof = f"https://github.com/{repo}/commit/{build_hash}"
    else:
        proof = ""
    return Result(PASS, f"Hub runs {ctx.release.short_version} from {branch}", [], proof)


def notice_txt(ctx: Context, rule: dict) -> Result:
    """The latest NOTICE.txt bot PR is merged and its commit is on the release branch."""
    branch = ctx.vars["branch"]
    if not ctx.has_branch:
        return Result(SKIPPED, f"{branch} doesn't exist yet")
    query = ctx.query(rule)
    repo = query["repo"]
    search = f'repo:{repo} is:pr author:{query["author"]} in:title "{query["title"]}"'
    found = ctx.github.search_issues(search, limit=1, sort="created")
    if not found:
        return Result(FAIL, "No NOTICE.txt PR found")
    latest = pr_item(repo, found[0])
    number = found[0]["number"]
    pull = ctx.github.pull(repo, number)
    if not pull.get("merged_at"):
        return Result(FAIL, f"The latest NOTICE.txt PR, {latest.public_label}, isn't merged", [latest], latest.url)
    sha = pull.get("merge_commit_sha", "")
    commits = ctx.github.commits(repo, branch, path="NOTICE.txt", limit=100)
    if any(c.get("sha") == sha or _references(c["commit"]["message"], number) for c in commits):
        return Result(PASS, f"{latest.public_label} is merged and on {branch}", [], latest.url)
    return Result(FAIL, f"{latest.public_label} is merged but not on {branch}", [latest], latest.url)


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
    posts = [p for p in ctx.hub.posts_since(ctx.testing_alerts_channel, since_ms)
             if p.get("create_at", 0) >= since_ms and not p.get("delete_at")]
    found = sorted((p for p in posts if any(pattern in _post_text(p) for pattern in patterns)),
                   key=lambda p: p["create_at"])
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
            present = bool(ctx.github.tags_with_prefix(repo, query["tag_prefix"]))
        if not present:
            missing.append(Item(repo.split("/")[-1], f"No {wanted} tag", f"https://github.com/{repo}/tags", repo=repo))
    if missing:
        where = ", ".join(item.public_label for item in missing)
        return Result(FAIL, f"{wanted} isn't tagged in {where}", missing)
    return Result(PASS, f"{wanted} is tagged in {plural(len(query['repos']), 'repo')}")


def version_go_prs(ctx: Context, rule: dict) -> Result:
    """The bot's version.go PRs for this release are merged."""
    query = ctx.query(rule)
    repo = query["repo"]
    major, minor = ctx.release.key
    # Search indexes "12.2.0" as one token, so "12.2" can't be searched for; filter instead.
    since = date.fromisoformat(ctx.vars["branch_cut"]) - timedelta(days=45)
    search = f'repo:{repo} is:pr author:{query["author"]} in:title "Update latest" created:>={since.isoformat()}'
    title = re.compile(rf"version to {major}\.{minor}\.\d+\s*$")
    prs = [pr for pr in ctx.github.search_issues(search) if title.search(pr.get("title", ""))]
    if not prs:
        return Result(FAIL, f"No version.go PRs for {ctx.release.short_version} found")
    unmerged = [pr_item(repo, pr) for pr in prs if pr.get("state") == "open"]
    if unmerged:
        labels = ", ".join(item.public_label for item in unmerged)
        return Result(FAIL, f"{plural(len(unmerged), 'version.go PR')} not merged: {labels}", unmerged)
    return Result(PASS, f"{plural(len(prs), 'version.go PR')} merged")


def changelog_labels(ctx: Context, rule: dict) -> Result:
    """Every merged milestone PR has one of the changelog labels."""
    query = ctx.query(rule)
    exclusions = " ".join(f'-label:"{label}"' for label in query["labels"])
    missing = []
    for repo in query["repos"]:
        search = f'repo:{repo} is:pr is:merged milestone:"{ctx.vars["milestone"]}" {exclusions}'
        missing += [pr_item(repo, pr) for pr in ctx.github.search_issues(search)]
    if missing:
        return Result(FAIL, f"{plural(len(missing), 'merged PR')} without a changelog label{private_count(missing)}", missing)
    return Result(PASS, "Every merged milestone PR has a changelog label")


CHECKS = {
    "open_release_items": (open_release_items, "report_only"),
    "new_regressions": (new_regressions, "all_have_fix_version"),
    "hub_release_branch": (hub_release_branch, "versions_match"),
    "notice_txt": (notice_txt, "merged_and_on_release_branch"),
    "cherry_picks": (cherry_picks, "all_on_release_branch"),
    "e2e_results": (e2e_results, "found"),
    "release_tags": (release_tags, "present"),
    "version_go_prs": (version_go_prs, "merged"),
    "changelog_labels": (changelog_labels, "none_missing"),
}

