"""Claude drafts from cited sources: breaking-change notices, and the blog outline and email.

Every point must cite a source it was given (a PR or a Jira ticket). A point citing
nothing it was given keeps a TODO instead, so the run fails rather than passing an
unsourced claim to Marketing.
"""

import json
import re

from .result import Result
from .versions import Version

BREAKING_TASK = "breaking-changes"
DRAFTS_TASK = "drafts"
BREAKING_LABEL = "Breaking Change"


def release_note(body: str) -> str:
    """The PR's release note, through the changelog generator's own parser; empty for NONE."""
    from generate_changelog import extract_release_notes  # needs requests; only these tasks import it

    return " ".join(extract_release_notes(body or "") or [])


def upgrade_notes(body: str) -> str:
    """Text under a PR body heading that mentions upgrading, such as "#### Upgrade Notes"."""
    text = re.sub(r"<!--.*?-->", "", body or "", flags=re.DOTALL)
    match = re.search(r"(?mi)^#+[^\n]*upgrad[^\n]*\n(.*?)(?=^#|\Z)", text, re.DOTALL)
    return " ".join(match.group(1).split()) if match else ""


def pr_source(item: dict) -> dict:
    repo = item["repository_url"].split("/repos/", 1)[1]
    body = item.get("body") or ""
    return {"id": f"{repo}#{item['number']}", "url": item["html_url"], "title": item["title"],
            "note": release_note(body), "upgrade_notes": upgrade_notes(body)}


def milestone_prs(gh, repos: list[str], milestone: str, label: str = "") -> list[dict]:
    query_label = f' label:"{label}"' if label else ""
    sources = []
    for repo in repos:
        for item in gh.search_issues(f'repo:{repo} is:pr is:merged milestone:"{milestone}"{query_label}'):
            sources.append(pr_source(item))
    return sources


def _cited(text: str, allowed: set[str]) -> list[str]:
    return [s for s in re.findall(r"[\w.-]+/[\w.-]+#\d+|\b[A-Z][A-Z0-9]+-\d+\b", text) if s in allowed]


# ── Breaking changes ────────────────────────────────────────────────────────────────

BREAKING_SYSTEM = """You write upgrade notices for Mattermost administrators, one per breaking change.

Reply with JSON only: {"notices": [{"source": "org/repo#123", "notice": "..."}]}
- One notice per PR you are given, using only that PR's title, release note and upgrade notes.
- Two to four plain sentences: what changed, who is affected, and what to do before or
  after upgrading. Past tense for the change, imperative for the action.
- Do not invent settings, versions or steps that the release note does not state.
"""


def breaking_notices(milestone: str, prs: list[dict], claude) -> Result:
    result = Result(BREAKING_TASK, milestone)
    if not prs:
        result.text = f"No merged PRs in milestone {milestone} have the `{BREAKING_LABEL}` label.\n"
        return result
    drafts = {}
    if claude is None:
        result.todo("ANTHROPIC_API_KEY is not set, so no notices were drafted")
    else:
        listing = json.dumps([{"source": p["id"], "title": p["title"], "release_note": p["note"],
                               "upgrade_notes": p.get("upgrade_notes", "")} for p in prs], indent=1)
        try:
            for item in claude.ask_json(BREAKING_SYSTEM, listing).get("notices", []):
                drafts[item.get("source")] = " ".join(str(item.get("notice", "")).split())
        except Exception as err:  # noqa: BLE001 - surfaced as a TODO
            result.todo(f"Claude could not draft the notices: {err}")
    parts = [f"# Breaking changes in {milestone}", ""]
    for pr in prs:
        if not pr["note"]:
            result.todo(f"{pr['id']} has no release note to base a notice on")
        notice = drafts.get(pr["id"]) or result.todo(f"no notice drafted for {pr['id']}")
        parts += [f"## {pr['title']}", "", notice, "", f"Source: [{pr['id']}]({pr['url']})",
                  f"Release note: {pr['note'] or '(none)'}", ""]
    result.text = "\n".join(parts)
    return result


# ── Blog outline and announcement email ─────────────────────────────────────────────

DRAFTS_SYSTEM = """You draft a release blog outline and announcement email for Mattermost Marketing.

You get the changelog's Improvements bullets for context, and the sources you may cite:
merged PRs ("org/repo#123") and Jira epics ("MM-123"). Reply with JSON only:
{"blog_outline": [{"heading": "...", "points": [{"text": "...", "sources": ["MM-123"]}]}],
 "email": {"subject": "...", "points": [{"text": "...", "sources": ["mattermost/mattermost#1"]}]}}
- Every point cites at least one source id from the lists, copied exactly. Never cite
  anything else, and leave out a point you can't source.
- Lead with the features customers will notice most. Plain, specific language; no hype.
- Up to 6 blog sections with 2-4 points each; the email has up to 6 points.
"""


def blog_and_email(version: Version, bullets: list[str], prs: list[dict], epics: list[dict], claude,
                   problems: list[str]) -> Result:
    result = Result(DRAFTS_TASK, version.tag)
    for problem in problems:
        result.todo(problem)
    allowed = {p["id"]: p["url"] for p in prs} | {e["key"]: e["url"] for e in epics}
    if claude is None:
        result.todo("ANTHROPIC_API_KEY is not set, so nothing was drafted")
        result.text = _sources_appendix(prs, epics)
        return result
    prompt = json.dumps({
        "version": version.short,
        "improvements": bullets,
        "pull_requests": [{"id": p["id"], "title": p["title"], "release_note": p["note"]} for p in prs if p["note"]],
        "jira_epics": [{"id": e["key"], "summary": e["summary"]} for e in epics],
    }, indent=1)
    try:
        answer = claude.ask_json(DRAFTS_SYSTEM, prompt, max_tokens=6000)
    except Exception as err:  # noqa: BLE001 - surfaced as a TODO
        result.todo(f"Claude could not draft: {err}")
        result.text = _sources_appendix(prs, epics)
        return result

    def point(item: dict) -> str:
        cited = [s for s in item.get("sources", []) if s in allowed] or _cited(item.get("text", ""), set(allowed))
        text = " ".join(str(item.get("text", "")).split())
        if not cited:
            return f"- {text} {result.todo(f'no valid source for: {text[:60]}')}"
        return f"- {text} ({', '.join(f'[{s}]({allowed[s]})' for s in dict.fromkeys(cited))})"

    lines = [f"# Mattermost {version.short}: blog outline", ""]
    for section in answer.get("blog_outline", []):
        lines += [f"## {section.get('heading', '')}", ""] + [point(p) for p in section.get("points", [])] + [""]
    email = answer.get("email", {})
    lines += [f"# Mattermost {version.short}: announcement email", "", f"Subject: {email.get('subject', '')}", ""]
    lines += [point(p) for p in email.get("points", [])] + [""]
    result.text = "\n".join(lines) + _sources_appendix(prs, epics)
    return result


def _sources_appendix(prs: list[dict], epics: list[dict]) -> str:
    lines = ["", "## Sources given to the draft", ""]
    lines += [f"- [{e['key']}]({e['url']}) {e['summary']}" for e in epics]
    lines += [f"- [{p['id']}]({p['url']}) {p['title']}" for p in prs if p["note"]]
    return "\n".join(lines) + "\n"
