"""Breaking changes in a milestone, found from what is already there: developers are asked nothing.

Rules read each merged PR's labels (and its Jira ticket's), the lines config-change-checker
writes into its release-note block, the wording of its release note (phrases listed in
.github/release-docs/rules.yml are strong evidence, other wording weak), and where the
changelog run placed its bullets (sections.json: Upgrade Impact/Compatibility, removed API
endpoints and config settings, destructive schema changes). The release diff gives removed
WebSocket events, destructive migrations and the changes in breaking_diff.py (plugin API and
hooks, the server/public Go API, config defaults, mmctl commands and flags, minimum versions). Claude then reads the
milestone's titles and release notes for anything the rules missed. Every candidate names
its source and why. A person keeps or removes candidates, and notices are drafted only for
the PRs they confirm (the ``confirmed`` input).
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from changelog_release import (
    MIGRATIONS_DIR,
    WEBSOCKET_EVENTS_FILE,
    jira_keys,
    parse_ls_remote,
    previous_release_base,
    websocket_events,
)
from check_config_changes_ci import _AUTO_LINE_RE as CHECKER_LINE

from . import breaking_diff, drafts
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
RULES_PATH = Path(__file__).resolve().parents[2] / "release-docs" / "rules.yml"


def strong_phrases(path: Path = RULES_PATH) -> list[str]:
    """The release-note phrases that are strong evidence, from rules.yml."""
    import yaml  # installed by the workflow; only this list needs it
    with open(path, encoding="utf-8") as f:
        phrases = (yaml.safe_load(f) or {})["breaking_changes"]["strong_phrases"]
    if not phrases or not all(isinstance(p, str) and p.strip() for p in phrases):
        raise ValueError(f"{path}: breaking_changes.strong_phrases must be a list of phrases")
    return [" ".join(p.split()) for p in phrases]


def _phrase_pattern(phrases: list[str]):
    return re.compile(r"(?i)\b(?:" + "|".join(r"\s+".join(map(re.escape, p.split())) for p in phrases) + r")\b")
CHECKER_REMOVAL = re.compile(r"^Removed `{1,2}[^`]+`{1,2}.*(?:configuration setting|API endpoint)\.|^🗑️\s+Removed API file:")
DESTRUCTIVE_SQL = re.compile(r"(?i)\bDROP\s+(?:TABLE|COLUMN)\b|\bRENAME\s+(?:COLUMN\b|TO\b)"
                             r"|\bALTER\s+COLUMN\s+\S+\s+(?:TYPE|SET\s+NOT\s+NULL)\b")
CONFIRMED_ID = re.compile(r"^(?:([\w.-]+/[\w.-]+)?#)?(\d+)$")
EXCERPT = 160


def _excerpt(text: str) -> str:
    return text if len(text) <= EXCERPT else text[:EXCERPT - 1] + "…"


def signals(labels, body: str, jira: set = frozenset(), phrases: list[str] | None = None) -> list[tuple[str, bool]]:
    """(why a PR may be a breaking change, whether that is strong evidence) for each signal.

    Strong: a breaking-change or deprecation label on the PR or its Jira ticket, a removal
    config-change-checker wrote into the release note, or a release-note phrase from
    rules.yml ("no longer supported", "before upgrading", ...). Weak: other wording
    ("breaking", "removed", "deprecated", "no longer", "must now").
    """
    from generate_changelog import extract_release_notes  # needs requests; imported where used

    strong = _phrase_pattern(phrases) if phrases else None
    found = [(f"PR label `{label}`", True) for label in sorted(labels) if _is_signal(label)]
    found += [(f"Jira label `{label}`", True) for label in sorted(jira) if _is_signal(label)]
    for note in extract_release_notes(body or "") or []:
        for line in (part.strip() for part in note.splitlines()):
            if CHECKER_REMOVAL.match(line):
                found.append((f"config-change-checker: {line}", True))
            elif line and not CHECKER_LINE.match(line):
                match = strong.search(line) if strong else None
                if match:
                    found.append((f"release note says \"{' '.join(match.group(0).lower().split())}\": {_excerpt(line)}", True))
                    continue
                match = NOTE_WORDS.search(line)
                if match:
                    found.append((f"release note says \"{match.group(0).lower()}\": {_excerpt(line)}", False))
    return found


DESTRUCTIVE_TEXT = re.compile(r"(?i)\b(?:drop(?:s|ped)?|removed?|renamed?|rewrit(?:es|ten)|changed\s+the\s+type|type\s+of)\b")


def changelog_signals(all_items: list[dict], migration_pr=lambda name: None) -> dict:
    """``{source: [(reason, True)]}`` from where the changelog run placed each PR's bullet: under
    Upgrade Impact/Compatibility, a removed API endpoint or config setting, or a schema change
    that drops, removes, renames or retypes something. A schema bullet written for a migration
    (``migration:NAME``) belongs to the PR that added it, from ``migration_pr(name)``."""
    found = {}
    for item in all_items:
        section, subsection, text = item["section"], item["subsection"], item["text"]
        if (section, subsection) == ("Upgrade Impact", "Compatibility"):
            reason = "changelog places it under Upgrade Impact/Compatibility"
        elif section == "API Changes" and re.match(r"(?i)removed\b", text):
            reason = "changelog: a removed API endpoint"
        elif subsection == "config.json" and re.match(r"(?i)removed\b", text):
            reason = "changelog: a removed config setting"
        elif subsection == "Database Schema Changes" and DESTRUCTIVE_TEXT.search(text):
            reason = "changelog: a destructive schema change"
        else:
            continue
        owners = [s for s in item["sources"] if "#" in s]
        owners += [pr for s in item["sources"] if s.startswith("migration:") for pr in [migration_pr(s[len("migration:"):])] if pr]
        for owner in dict.fromkeys(owners):
            found.setdefault(owner, []).append((f"{reason}: {_excerpt(text)}", True))
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


def find(gh, repos: list[str], milestone: str, claude, jira_labels=None, changelog_items=None, apidiff=None,
         phrases=None) -> tuple[list[Candidate], list[dict], dict]:
    """(candidates with a PR, release diff findings with no PR, facts for the summary).

    ``changelog_items`` are the changelog runs' bullets (changelog_run.items), or None when they
    couldn't be read; ``apidiff(base, head)`` returns (apidiff's output, a problem), or is None
    when it isn't run; ``phrases`` are rules.yml's strong release-note phrases."""
    prs = drafts.milestone_prs(gh, repos, milestone)
    keys = {p["id"]: jira_keys(p["title"], "", p.get("body", "")) for p in prs}
    labels_by_key = jira_labels(set().union(*keys.values())) if jira_labels and any(keys.values()) else {}
    found = {}
    for p in prs:
        jira = set().union(*(labels_by_key.get(k, set()) for k in keys[p["id"]])) if keys[p["id"]] else set()
        found[p["id"]] = signals(p.get("labels", []), p.get("body", ""), jira, phrases)
    facts = {"prs": len(prs), "range": None, "other_migrations": 0, "problems": []}
    loose = []
    version = Version.parse(milestone)
    refs = release_refs(gh, DEFAULT_REPO, version)

    def add(owner, reason, url=""):
        found.setdefault(owner, []).append((reason, True))
        if owner not in {p["id"] for p in prs}:
            prs.append({"id": owner, "url": url or _pr_url(owner), "title": "(not in the milestone)", "note": "",
                        "upgrade_notes": ""})

    if refs:
        facts["range"] = refs
        diff, facts["other_migrations"] = diff_signals(gh, DEFAULT_REPO, *refs)
        output, problem = apidiff(*refs) if apidiff else (None, "apidiff was not run")
        if problem:
            facts["problems"].append(problem)
        more, problems = breaking_diff.diff_changes(gh, DEFAULT_REPO, *refs, apidiff=output)
        facts["problems"] += problems
        for item in diff + more:
            owner = item["pr"]
            if owner is None and item.get("event"):
                owner = next((p["id"] for p in prs if item["event"] in f"{p['title']} {p.get('body', '')}"), None)
            if owner:
                add(owner, item["reason"], item["url"])
            else:
                loose.append(item)
    else:
        facts["problems"].append(f"no release before {version.short} found, so the release diff was not read")
    if changelog_items is None:
        facts["problems"].append("the changelog run's sections.json was not read, so the changelog's placements "
                                 "were not used")
    else:
        def migration_pr(name):
            sha = gh.last_commit_for_path(DEFAULT_REPO, f"{MIGRATIONS_DIR}/{name}.up.sql", refs[1]) if refs else None
            pulls = gh.commit_pulls(DEFAULT_REPO, sha) if sha else []
            return f"{DEFAULT_REPO}#{pulls[0]['number']}" if pulls else None
        for owner, reasons in changelog_signals(changelog_items, migration_pr).items():
            for reason, _ in reasons:
                add(owner, reason)
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


def _pr_url(source: str) -> str:
    repo, _, number = source.partition("#")
    return f"https://github.com/{repo}/pull/{number}"


def candidate_list(milestone: str, candidates: list[Candidate], loose: list[dict], facts: dict) -> str:
    where = f"the release diff `{facts['range'][0]}...{facts['range'][1]}`" if facts["range"] else "no release diff"
    lines = [f"# Possible breaking changes in {milestone}", "",
             f"From {facts['prs']} merged PRs in the milestone and {where}. Developers were not asked anything: "
             "these come from labels, config-change-checker's lines, release-note wording, the release diff and Claude. "
             "Keep or remove each. To draft notices for the ones you keep, run **Release Docs - Breaking Change Notices** "
             "again with `confirmed` set to their PRs, for example `39001, mattermost/enterprise#1234` (or `none`). The "
             "candidates you don't list count as removed, and the release docs PR then fills Important Upgrade Notes and "
             "Deprecated Features from the confirmed ones; until then they keep their placeholders.", ""]
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


def run(gh, repos: list[str], milestone: str, confirmed: str, claude, jira_labels=None, changelog_items=None,
        apidiff=None, phrases=None, listed=None) -> Result:
    """The candidate list, or the notices for the ``confirmed`` PRs.

    Both record their state for the release docs PR (``result.state``, kept with the Hub post):
    the list its candidates; a confirmation the PRs confirmed and the candidates it decided on,
    which are the ones ``listed`` by the latest list (from Hub) plus those confirmed."""
    chosen = parse_confirmed(confirmed)
    if chosen is None:
        candidates, loose, facts = find(gh, repos, milestone, claude, jira_labels, changelog_items, apidiff, phrases)
        result = Result(TASK, milestone, text=candidate_list(milestone, candidates, loose, facts))
        result.notes += facts["problems"]
        result.counts = {"merged PRs read": facts["prs"], "candidates": len(candidates),
                         "strong signals": sum(1 for c in candidates if c.strong),
                         "release diff findings with no PR": len(loose)}
        result.state = {"candidates": [c.id for c in candidates]}
        return result
    decision = {"confirmed": chosen, "reviewed": sorted(set(listed or []) | set(chosen))}
    if listed is None:
        decision["note"] = "no candidate list was found, so only the confirmed PRs count as decided"
    if not chosen:
        result = Result(TASK, milestone, text=f"No breaking changes confirmed for {milestone}; no notices drafted.\n")
        result.counts = {"confirmed PRs": 0}
        result.state, result.report_kind = decision, DECISION
        return result
    prs = {p["id"]: p for p in drafts.milestone_prs(gh, repos, milestone)}
    missing = [i for i in chosen if i not in prs]
    result = drafts.breaking_notices(milestone, [prs[i] for i in chosen if i in prs], claude)
    for item in missing:
        result.todo(f"{item} is not a merged PR in milestone {milestone}")
    result.counts = {"confirmed PRs": len(chosen), "notices drafted": result.text.count("\nSource: ")}
    result.state, result.report_kind = decision, DECISION
    return result


DECISION = "decision"  # the Hub report of a confirmation, apart from the candidate list
