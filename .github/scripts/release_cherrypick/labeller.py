"""Label the GitHub PRs of approved cherry-pick tickets (MM tickets in Submitted status).

For each Submitted ticket with the release's fix version, its linked PRs get the
``CherryPick/Approved`` label and the ``vX.Y.0`` milestone. Labels and milestones are only
ever added: a PR that already has ``CherryPick/Approved`` or ``CherryPick/Done`` keeps it, and
a PR with another milestone keeps it and is reported.

Only PRs in ``WRITABLE_REPOS`` are changed: the workflow writes with its own GITHUB_TOKEN,
which reaches no other repo. PRs in mattermost/enterprise are listed for the release manager
to label by hand.
"""

import re
from dataclasses import dataclass, field

from .clients import ServiceError

PROJECT = "MM"
SUBMITTED = "Submitted"
APPROVED = "CherryPick/Approved"
DONE_LABELS = frozenset({APPROVED, "CherryPick/Done"})
ALLOWED_REPOS = ("mattermost/mattermost", "mattermost/enterprise")
PUBLIC_REPOS = frozenset({"mattermost/mattermost"})
WRITABLE_REPOS = frozenset({"mattermost/mattermost"})
BASE_BRANCH = "master"
FIELDS = ["summary", "status", "fixVersions"]

FEATURE_VERSION = re.compile(r"^v(\d+)\.(\d+) \(([A-Z][a-z]+) (\d{4})\)$")
DOT_VERSION = re.compile(r"^v\d+\.\d+\.\d+\b")
PR_URL = re.compile(r"^https://github\.com/([\w.-]+/[\w.-]+)/pull/(\d+)(?:[/?#].*)?$", re.IGNORECASE)
ISSUE_KEY = re.compile(r"^MM-\d+$")

# Change states
ADDED, WOULD_ADD, PRESENT = "added", "would_add", "present"
SET, WOULD_SET, CONFLICT, NO_MILESTONE = "set", "would_set", "conflict", "no_milestone"
BY_HAND = "by_hand"  # needed, in a repo the workflow can't write to


class LabelError(Exception):
    """A run that can't go ahead, with a message safe for public output."""


@dataclass(frozen=True)
class FixVersion:
    id: str
    name: str
    major: int
    minor: int
    released: bool = False
    archived: bool = False

    @property
    def short(self) -> str:
        return f"v{self.major}.{self.minor}"

    @property
    def milestone(self) -> str:
        return f"v{self.major}.{self.minor}.0"

    @property
    def branch(self) -> str:
        return f"release-{self.major}.{self.minor}"


def feature_version(version: dict) -> FixVersion | None:
    """A Jira version named like "v12.2 (December 2026)", else None (dot releases, Mobile…)."""
    match = FEATURE_VERSION.match((version.get("name") or "").strip())
    if not match:
        return None
    return FixVersion(str(version.get("id", "")), version["name"].strip(), int(match.group(1)), int(match.group(2)),
                      bool(version.get("released")), bool(version.get("archived")))


def parse_short_version(text: str) -> tuple[int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)(?:\.0)?", (text or "").strip())
    if not match:
        raise LabelError(f"{text!r} isn't a release version such as v12.2")
    return int(match.group(1)), int(match.group(2))


def find_fix_version(versions: list[dict], major: int, minor: int) -> FixVersion:
    """The release's canonical Jira fix version, preferring an unreleased one."""
    matches = [v for v in map(feature_version, versions) if v and (v.major, v.minor) == (major, minor)]
    if len(matches) > 1:
        matches = [v for v in matches if not v.released] or matches
    if not matches:
        raise LabelError(f"Jira has no v{major}.{minor} (Month Year) fix version")
    if len(matches) > 1:
        raise LabelError(f"Jira has {len(matches)} v{major}.{minor} fix versions, so none is used")
    return matches[0]


def active_versions(versions: list[dict], github) -> list[FixVersion]:
    """Unreleased feature fix versions whose release branch exists, oldest first."""
    candidates = sorted((v for v in map(feature_version, versions) if v and not v.released and not v.archived),
                        key=lambda v: (v.major, v.minor))
    return [v for v in candidates if github.branch_exists(ALLOWED_REPOS[0], v.branch)]


def mentions_key(text: str, key: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(key)}(?!\d)", text or "", re.IGNORECASE) is not None


@dataclass
class PrChange:
    ticket: str
    repo: str
    number: int
    url: str
    title: str = ""
    label: str = ""
    milestone: str = ""
    current_milestone: str = ""
    skipped: str = ""  # why the PR was left alone
    by_title: bool = False  # found by the ticket key in its title or branch, not a Jira link

    @property
    def changed(self) -> bool:
        return self.label in (ADDED, WOULD_ADD) or self.milestone in (SET, WOULD_SET)

    @property
    def by_hand(self) -> bool:
        return BY_HAND in (self.label, self.milestone)

    @property
    def public_ref(self) -> str:
        """The PR as it may appear in public output."""
        if self.repo in PUBLIC_REPOS:
            return f"[{self.repo.split('/')[-1]}#{self.number}]({self.url})"
        return f"(private repo) #{self.number}"


@dataclass
class OutsidePr:
    ticket: str
    repo: str
    number: int
    url: str
    public: bool


@dataclass
class Report:
    version: FixVersion | None
    live: bool
    dispatched: bool = False  # one ticket, just moved to Submitted
    tickets: list = field(default_factory=list)  # ticket keys looked at
    changes: list = field(default_factory=list)  # PrChange per allowlisted PR
    no_pr: list = field(default_factory=list)
    outside: list = field(default_factory=list)  # OutsidePr
    other_versions: dict = field(default_factory=dict)  # ticket -> other fix version names
    notes: list = field(default_factory=list)
    errors: list = field(default_factory=list)

    @property
    def labelled(self) -> list:
        return [c for c in self.changes if c.changed]

    @property
    def already_done(self) -> list:
        return [c for c in self.changes if not c.changed and not c.skipped and not c.by_hand and c.milestone == PRESENT]

    @property
    def by_hand(self) -> list:
        return [c for c in self.changes if c.by_hand]

    @property
    def conflicts(self) -> list:
        return [c for c in self.changes if c.milestone == CONFLICT]

    @property
    def skipped(self) -> list:
        return [c for c in self.changes if c.skipped]


class Labeller:
    def __init__(self, jira, github, live: bool):
        self.jira, self.github, self.live = jira, github, live
        self._milestones = {}
        self._pulls = {}

    def run_version(self, version: FixVersion) -> Report:
        report = Report(version, self.live)
        jql = f"project = {PROJECT} AND fixVersion = {version.id} AND status = {SUBMITTED}"
        for issue in self.jira.search(jql, FIELDS):
            self.process(report, issue, version)
        return report

    def run_ticket(self, key: str, versions: list[dict]) -> Report:
        """One ticket, from the Jira Automation dispatch when it moves to Submitted."""
        if not ISSUE_KEY.match(key or ""):
            raise LabelError("The dispatch event needs an issue_key such as MM-12345")
        issue = self.jira.issue(key, FIELDS)
        fields = issue.get("fields") or {}
        status = (fields.get("status") or {}).get("name") or ""
        names = [v.get("name", "") for v in fields.get("fixVersions") or []]
        known = {v.name: v for v in map(feature_version, versions) if v}
        targets = sorted((known[n] for n in names if n in known and not known[n].released),
                         key=lambda v: (v.major, v.minor))
        report = Report(targets[0] if targets else None, self.live, dispatched=True)
        if status.casefold() != SUBMITTED.casefold():
            report.notes.append(f"{key} isn't {SUBMITTED} (it's {status or 'unknown'}), so nothing was changed.")
            return report
        if not targets:
            report.tickets.append(key)
            if names:
                report.other_versions[key] = names
            report.notes.append(f"{key} has no unreleased vX.Y (Month Year) fix version, so nothing was changed.")
            return report
        self.process(report, issue, targets[0])
        return report

    def process(self, report: Report, issue: dict, version: FixVersion) -> None:
        key = issue["key"]
        report.tickets.append(key)
        names = [v.get("name", "") for v in (issue.get("fields") or {}).get("fixVersions") or []]
        others = [n for n in names if n != version.name]
        if others:
            report.other_versions[key] = others
        try:
            prs = self.linked_prs(key)
            if not prs:
                report.no_pr.append(key)
            for repo, number, url, by_title in prs:
                if repo not in ALLOWED_REPOS:
                    report.outside.append(OutsidePr(key, repo, number, url, self.github.is_public(repo)))
                elif not any((c.repo, c.number) == (repo, number) for c in report.changes):
                    report.changes.append(self.apply(key, repo, number, url, version, report, by_title))
        except ServiceError as err:
            report.errors.append(f"{key}: {err}")

    def linked_prs(self, key: str) -> list[tuple[str, int, str, bool]]:
        """PRs in the ticket's remote links, else PRs in the allowlist naming it in their title or
        branch, as (repo, number, url, found by title)."""
        found = {}
        for link in self.jira.remote_links(key):
            url = ((link.get("object") or {}).get("url") or "").strip()
            match = PR_URL.match(url)
            if match:
                repo, number = match.group(1).lower(), int(match.group(2))
                found.setdefault((repo, number), f"https://github.com/{repo}/pull/{number}")
        if not found:
            for repo in ALLOWED_REPOS:
                for item in self.github.search_prs(f'repo:{repo} is:pr "{key}"'):
                    pull = self.pull(repo, item["number"])
                    if mentions_key(pull.get("title"), key) or mentions_key((pull.get("head") or {}).get("ref"), key):
                        found.setdefault((repo, item["number"]), pull.get("html_url") or item.get("html_url", ""))
            return [(repo, number, url, True) for (repo, number), url in sorted(found.items())]
        return [(repo, number, url, False) for (repo, number), url in sorted(found.items())]

    def pull(self, repo: str, number: int) -> dict:
        if (repo, number) not in self._pulls:
            self._pulls[(repo, number)] = self.github.pull(repo, number)
        return self._pulls[(repo, number)]

    def milestone_number(self, repo: str, title: str) -> int | None:
        if repo not in self._milestones:
            self._milestones[repo] = {m["title"]: m["number"] for m in self.github.milestones(repo)}
        return self._milestones[repo].get(title)

    def apply(self, key: str, repo: str, number: int, url: str, version: FixVersion, report: Report,
              by_title: bool = False) -> PrChange:
        """Label the PR and set its milestone. A PR found only by its title or branch that has
        another milestone is likely an earlier fix for the same ticket, so it isn't labelled."""
        pull = self.pull(repo, number)
        change = PrChange(key, repo, number, pull.get("html_url") or url, pull.get("title") or "", by_title=by_title)
        base = (pull.get("base") or {}).get("ref")
        if base != BASE_BRANCH:
            change.skipped = f"is against {base or 'an unknown branch'}, not {BASE_BRANCH}"
            return change
        if pull.get("state") == "closed" and not pull.get("merged_at"):
            change.skipped = "was closed without merging"
            return change

        change.current_milestone = (pull.get("milestone") or {}).get("title") or ""
        labels = {label["name"] for label in pull.get("labels") or []}
        if by_title and change.current_milestone not in ("", version.milestone):
            change.milestone = CONFLICT
            return change
        writable = repo in WRITABLE_REPOS
        if labels & DONE_LABELS:
            change.label = PRESENT
        elif not writable:
            change.label = BY_HAND
        elif self.live:
            self.github.add_label(repo, number, APPROVED)
            change.label = ADDED
        else:
            change.label = WOULD_ADD

        if change.current_milestone == version.milestone:
            change.milestone = PRESENT
        elif change.current_milestone:
            change.milestone = CONFLICT
        elif not writable:
            change.milestone = BY_HAND
        else:
            milestone = self.milestone_number(repo, version.milestone)
            if milestone is None:
                change.milestone = NO_MILESTONE
                note = f"{'mattermost' if repo in PUBLIC_REPOS else '(private repo)'} has no {version.milestone} milestone, so it wasn't set."
                if note not in report.notes:
                    report.notes.append(note)
            elif self.live:
                self.github.set_milestone(repo, number, milestone)
                change.milestone = SET
            else:
                change.milestone = WOULD_SET
        return change
