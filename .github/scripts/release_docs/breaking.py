"""Breaking changes in a milestone, found from what is already there: developers are asked nothing.

Rules read each merged PR's labels (and its Jira ticket's), the lines config-change-checker
writes into its release-note block, and the wording of its release note; the release diff
gives removed WebSocket events and destructive migrations. Claude then reads the
milestone's titles and release notes for anything the rules missed. Every candidate names
its source and why. A person keeps or removes candidates, and notices are drafted only for
the PRs they confirm (the ``confirmed`` input).
"""

import json
import re
from dataclasses import dataclass, field

from changelog_release import (
    MIGRATIONS_DIR,
    WEBSOCKET_EVENTS_FILE,
    jira_keys,
    parse_ls_remote,
    previous_release_base,
    websocket_events,
)
from check_config_changes_ci import _AUTO_LINE_RE as CHECKER_LINE

from . import drafts
from .result import Result
from .versions import Version

TASK = drafts.BREAKING_TASK
DEFAULT_REPO = "mattermost/mattermost"
LABEL_SIGNAL = re.compile(r"(?i)breaking|deprecat")
NEGATED_LABEL = re.compile(r"(?i)\b(?:non|no|not|without)[-_\s]*(?:breaking|deprecat)")


def _is_signal(label: str) -> bool:
    """A breaking-change or deprecation label, not "Non-breaking" or "No deprecation"."""
    return bool(LABEL_SIGNAL.search(label)) and not NEGATED_LABEL.search(label)


NOTE_WORDS = re.compile(r"(?i)\b(?:breaking|removed|deprecated|no longer|must now)\b")
CHECKER_REMOVAL = re.compile(r"^Removed `{1,2}[^`]+`{1,2}.*(?:configuration setting|API endpoint)\.|^🗑️\s+Removed API file:")
DESTRUCTIVE_SQL = re.compile(r"(?i)\bDROP\s+(?:TABLE|COLUMN)\b|\bRENAME\s+(?:COLUMN\b|TO\b)"
                             r"|\bALTER\s+COLUMN\s+\S+\s+(?:TYPE|SET\s+NOT\s+NULL)\b")
CONFIRMED_ID = re.compile(r"^(?:([\w.-]+/[\w.-]+)?#)?(\d+)$")
EXCERPT = 160


def signals(labels, body: str, jira: set = frozenset()) -> list[tuple[str, bool]]:
    """(why a PR may be a breaking change, whether that is strong evidence) for each signal.

    Strong: a breaking-change or deprecation label on the PR or its Jira ticket, or a
    removal config-change-checker wrote into the release note. Weak: the release note's
    wording ("breaking", "removed", "deprecated", "no longer", "must now").
    """
    from generate_changelog import extract_release_notes  # needs requests; imported where used

    found = [(f"PR label `{label}`", True) for label in sorted(labels) if _is_signal(label)]
    found += [(f"Jira label `{label}`", True) for label in sorted(jira) if _is_signal(label)]
    for note in extract_release_notes(body or "") or []:
        for line in (part.strip() for part in note.splitlines()):
            if CHECKER_REMOVAL.match(line):
                found.append((f"config-change-checker: {line}", True))
            elif line and not CHECKER_LINE.match(line):
                match = NOTE_WORDS.search(line)
                if match:
                    text = line if len(line) <= EXCERPT else line[:EXCERPT - 1] + "…"
                    found.append((f"release note says \"{match.group(0).lower()}\": {text}", False))
    return found


@dataclass
class Candidate:
    id: str
    url: str = ""
    title: str = ""
    reasons: list = field(default_factory=list)
    strong: bool = False


def release_refs(gh, repo: str, milestone: Version) -> tuple[str, str] | None:
    """(the previous release's vX.Y.0 tag, or its branch until tagged; this release's branch,
    or the default branch before the cut)."""
    refs = gh.matching_refs(repo, "heads/release-") + gh.matching_refs(repo, "tags/v")
    branches, tags, _ = parse_ls_remote("\n".join(refs))
    previous = previous_release_base(milestone.major, milestone.minor, branches, tags)
    if previous is None:
        return None
    head = f"release-{milestone.major}.{milestone.minor}"
    return previous[0].removeprefix("origin/"), head if milestone.line in branches else gh.default_branch(repo)


def diff_signals(gh, repo: str, base: str, head: str) -> tuple[list[dict], int]:
    """Removed WebSocket events and destructive new migrations between ``base`` and ``head``:
    ``[{"pr": "org/repo#1" or None, "url": ..., "reason": ...}]``, and how many other new
    migrations there are."""
    found = []
    removed = websocket_events(gh.file(repo, WEBSOCKET_EVENTS_FILE, base)) - websocket_events(gh.file(repo, WEBSOCKET_EVENTS_FILE, head))
    for event in sorted(removed):
        found.append({"pr": None, "url": "", "event": event,
                      "reason": f"release diff: the ``{event}`` WebSocket event was removed (`{base}...{head}`)"})
    new = sorted(set(gh.list_dir(repo, MIGRATIONS_DIR, head)) - set(gh.list_dir(repo, MIGRATIONS_DIR, base)))
    others = 0
    for name in (n for n in new if n.endswith(".up.sql")):
        path = f"{MIGRATIONS_DIR}/{name}"
        match = DESTRUCTIVE_SQL.search(gh.file(repo, path, head) or "")
        if not match:
            others += 1
            continue
        sha = gh.last_commit_for_path(repo, path, head)
        pulls = gh.commit_pulls(repo, sha) if sha else []
        found.append({"pr": f"{repo}#{pulls[0]['number']}" if pulls else None, "url": pulls[0]["html_url"] if pulls else "",
                      "reason": f"release diff: migration ``{name}`` runs `{' '.join(match.group(0).upper().split())}`"})
    return found, others


CLAUDE_SYSTEM = """You review the merged pull requests of a Mattermost release for breaking changes.

A breaking change makes administrators, integrators or plugin developers act when they upgrade:
a removed or renamed setting, API endpoint, WebSocket event, slash command or plugin API; a
changed default or behavior they rely on; a new minimum requirement (database, OS, browser);
or a database migration that drops or rewrites data.

Reply with JSON only: {"candidates": [{"source": "org/repo#123", "reason": "..."}]}
- List each PR that is likely a breaking change, copying its source id exactly. Never list a source that is not given.
- The reason is one sentence: what changed and who has to act. Base it only on the title, release note and upgrade notes.
- "rule_signals" are what simple rules found. Confirm them only when the change really affects an upgrade, and add PRs the rules missed.
- A person reviews your list, so leave out bug fixes, new features and internal changes that need no action.
"""


def claude_pass(claude, prs: list[dict], found: dict) -> tuple[dict, str | None]:
    """{source: reason} from Claude, keeping only sources it was given, and a problem if it failed."""
    if claude is None:
        return {}, "ANTHROPIC_API_KEY is not set, so Claude did not review the milestone; only the rules ran"
    listing = [{"source": p["id"], "title": p["title"], "release_note": p["note"][:600],
                "upgrade_notes": p.get("upgrade_notes", "")[:400],
                "rule_signals": [reason for reason, _ in found.get(p["id"], [])]} for p in prs]
    try:
        answer = claude.ask_json(CLAUDE_SYSTEM, json.dumps(listing, indent=1), max_tokens=4000)
    except Exception as err:  # noqa: BLE001 - the rules' list still stands
        return {}, f"Claude could not review the milestone: {err}"
    allowed = {p["id"] for p in prs}
    picked = {}
    for item in (answer or {}).get("candidates", []):
        source, reason = str(item.get("source", "")), " ".join(str(item.get("reason", "")).split())
        if source in allowed and reason:
            picked[source] = reason
    return picked, None


def find(gh, repos: list[str], milestone: str, claude, jira_labels=None) -> tuple[list[Candidate], list[dict], dict]:
    """(candidates with a PR, release diff findings with no PR, facts for the summary)."""
    prs = drafts.milestone_prs(gh, repos, milestone)
    keys = {p["id"]: jira_keys(p["title"], "", p.get("body", "")) for p in prs}
    labels_by_key = jira_labels(set().union(*keys.values())) if jira_labels and any(keys.values()) else {}
    found = {}
    for p in prs:
        jira = set().union(*(labels_by_key.get(k, set()) for k in keys[p["id"]])) if keys[p["id"]] else set()
        found[p["id"]] = signals(p.get("labels", []), p.get("body", ""), jira)
    facts = {"prs": len(prs), "range": None, "other_migrations": 0, "problems": []}
    loose = []
    version = Version.parse(milestone)
    refs = release_refs(gh, DEFAULT_REPO, version)
    if refs:
        facts["range"] = refs
        diff, facts["other_migrations"] = diff_signals(gh, DEFAULT_REPO, *refs)
        for item in diff:
            owner = item["pr"]
            if owner is None and item.get("event"):
                owner = next((p["id"] for p in prs if item["event"] in f"{p['title']} {p.get('body', '')}"), None)
            if owner:
                found.setdefault(owner, []).append((item["reason"], True))
                if owner not in {p["id"] for p in prs}:
                    prs.append({"id": owner, "url": item["url"], "title": "(not in the milestone)", "note": "", "upgrade_notes": ""})
            else:
                loose.append(item)
    else:
        facts["problems"].append(f"no release before {version.short} found, so the release diff was not read")
    picked, problem = claude_pass(claude, prs, found)
    if problem:
        facts["problems"].append(problem)
    candidates = []
    for p in prs:
        reasons = [reason for reason, _ in found.get(p["id"], [])]
        if p["id"] in picked:
            reasons.append(f"Claude: {picked[p['id']]}")
        if reasons:
            candidates.append(Candidate(p["id"], p["url"], p["title"], reasons, any(s for _, s in found.get(p["id"], []))))
    candidates.sort(key=lambda c: (not c.strong, -len(c.reasons), c.id))
    return candidates, loose, facts


def candidate_list(milestone: str, candidates: list[Candidate], loose: list[dict], facts: dict) -> str:
    where = f"the release diff `{facts['range'][0]}...{facts['range'][1]}`" if facts["range"] else "no release diff"
    lines = [f"# Possible breaking changes in {milestone}", "",
             f"From {facts['prs']} merged PRs in the milestone and {where}. Developers were not asked anything: "
             "these come from labels, config-change-checker's lines, release-note wording, the release diff and Claude. "
             "Keep or remove each. To draft notices for the ones you keep, run **Release Docs - Breaking Change Notices** "
             "again with `confirmed` set to their PRs, for example `39001, mattermost/enterprise#1234`.", ""]
    if not candidates and not loose:
        lines.append("No candidates found.")
    for c in candidates:
        lines.append(f"- [ ] [{c.id}]({c.url}) {c.title}" + (" (strong signal)" if c.strong else ""))
        lines += [f"  - {reason}" for reason in c.reasons]
    if loose:
        lines += ["", "**In the release diff, with no PR found**", ""] + [f"- {item['reason']}" for item in loose]
    if facts["other_migrations"]:
        lines += ["", f"{facts['other_migrations']} other new migration(s) were not flagged: none drops a table or column, "
                      "renames, or changes a column's type."]
    return "\n".join(lines) + "\n"


def parse_confirmed(raw: str) -> list[str] | None:
    """PR ids from the ``confirmed`` input ("39001, mattermost/enterprise#12"); [] for "none"; None if empty."""
    raw = (raw or "").strip()
    if not raw:
        return None
    if raw.lower() == "none":
        return []
    ids = []
    for part in re.split(r"[\s,]+", raw):
        match = CONFIRMED_ID.match(part)
        if not match:
            raise ValueError(f"confirmed: {part!r} is not a PR number or org/repo#number")
        ids.append(f"{match.group(1) or DEFAULT_REPO}#{match.group(2)}")
    return list(dict.fromkeys(ids))


def run(gh, repos: list[str], milestone: str, confirmed: str, claude, jira_labels=None) -> Result:
    chosen = parse_confirmed(confirmed)
    if chosen is None:
        candidates, loose, facts = find(gh, repos, milestone, claude, jira_labels)
        result = Result(TASK, milestone, text=candidate_list(milestone, candidates, loose, facts))
        result.notes += facts["problems"]
        result.counts = {"merged PRs read": facts["prs"], "candidates": len(candidates),
                         "strong signals": sum(1 for c in candidates if c.strong),
                         "release diff findings with no PR": len(loose)}
        return result
    if not chosen:
        result = Result(TASK, milestone, text=f"No breaking changes confirmed for {milestone}; no notices drafted.\n")
        result.counts = {"confirmed PRs": 0}
        return result
    prs = {p["id"]: p for p in drafts.milestone_prs(gh, repos, milestone)}
    missing = [i for i in chosen if i not in prs]
    result = drafts.breaking_notices(milestone, [prs[i] for i in chosen if i in prs], claude)
    for item in missing:
        result.todo(f"{item} is not a merged PR in milestone {milestone}")
    result.counts = {"confirmed PRs": len(chosen), "notices drafted": result.text.count("\nSource: ")}
    return result
