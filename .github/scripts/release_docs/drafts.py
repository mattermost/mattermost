"""Claude drafts from cited sources: breaking-change notices, and the blog outline and email.

Every point must cite a source it was given (a PR or a Jira ticket). A point citing
nothing it was given keeps a TODO instead, so the run fails rather than passing an
unsourced claim to Marketing.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import date

from .result import Result
from .versions import Version, changelog_url, is_esr

BREAKING_TASK = "breaking-changes"
DRAFTS_TASK = "drafts"


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
            "note": release_note(body), "upgrade_notes": upgrade_notes(body), "body": body,
            "labels": [label["name"] for label in item.get("labels") or []]}


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


def draft_notices(prs: list[dict], claude, result: Result) -> dict:
    """``{PR id: notice}`` drafted by Claude from each PR's title, release note and upgrade notes."""
    drafts = {}
    if claude is None:
        result.todo("ANTHROPIC_API_KEY is not set, so no notices were drafted")
        return drafts
    listing = json.dumps([{"source": p["id"], "title": p["title"], "release_note": p["note"],
                           "upgrade_notes": p.get("upgrade_notes", "")} for p in prs], indent=1)
    try:
        for item in claude.ask_json(BREAKING_SYSTEM, listing).get("notices", []):
            drafts[item.get("source")] = " ".join(str(item.get("notice", "")).split())
    except Exception as err:  # noqa: BLE001 - surfaced as a TODO
        result.todo(f"Claude could not draft the notices: {err}")
    return drafts


def breaking_notices(milestone: str, prs: list[dict], claude) -> Result:
    result = Result(BREAKING_TASK, milestone)
    if not prs:
        result.text = f"No breaking changes confirmed for {milestone}; no notices drafted.\n"
        return result
    drafts = draft_notices(prs, claude, result)
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
- The email goes to customers: its subject is a short list of the main features
  ("Team ABAC, AI Agent Enhancements & More"), and its points name features by their
  public names only, never a PR title, a Jira key or an internal code name.
"""


def blog_and_email(version: Version, bullets: list[str], prs: list[dict], epics: list[dict], claude,
                   problems: list[str], facts: "EmailFacts | None" = None, esr_versions: str = "") -> Result:
    result = Result(DRAFTS_TASK, version.tag)
    for problem in problems:
        result.todo(problem)
    result.counts = {"PRs with a release note": sum(1 for p in prs if p["note"]), "Jira epics": len(epics)}
    # Only PRs with a release note: those are the ones Claude is shown, so a citation of another is unsourced.
    allowed = {p["id"]: p["url"] for p in prs if p["note"]} | {e["key"]: e["url"] for e in epics}
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

    if not answer.get("blog_outline"):
        result.todo("Claude returned no blog outline sections")
    lines = [f"# Mattermost {version.short}: blog outline", ""]
    for section in answer.get("blog_outline", []):
        lines += [f"## {section.get('heading', '')}", ""] + [point(p) for p in section.get("points", [])] + [""]
    if facts and facts.esr_blog:
        lines += ["## Extended Support Release Updates", "", facts.esr_blog, ""]
    email = answer.get("email", {})
    points = email.get("points", [])
    result.counts.update({"blog sections": len(answer.get("blog_outline", [])), "email points": len(points)})
    lines += [f"# Mattermost {version.short}: announcement email (with sources, for review)", "",
              f"Subject: {email.get('subject', '')}", ""]
    lines += [point(p) for p in points] + [""]
    if facts is not None:
        public = email_text(version, esr_versions, email.get("subject", ""), [p.get("text", "") for p in points],
                            facts, result)
        result.artifacts["email.md"] = public
        lines += [f"# Mattermost {version.short}: email as sent (no sources)", "", public, ""]
    result.text = "\n".join(lines) + _sources_appendix(prs, epics)
    return result


# ── The monthly email, shaped like the August 2026 one ─────────────────────────────

RECIPIENTS = ("All customers who are subscribed to Mattermost [security updates](https://mattermost.com/security-updates/) "
              "and [newsletters](https://mattermost.com/blog/category/platform/releases/)")
FOOTER = ("Your safety and data security is of utmost priority for Mattermost. For all our customers' protection, and as "
          "outlined in our [Responsible Disclosure policy](https://mattermost.com/security-vulnerability-report/), "
          "Mattermost does not disclose specifics on the vulnerability until 30 days after this announcement. After 30 "
          "days, we will publish specific details on the vulnerability on our "
          "[Security Updates webpage](https://mattermost.com/security-updates/).\n\n"
          "Sincerely,\nThe Mattermost product and security team")
VERSION_ARCHIVE = "https://docs.mattermost.com/product-overview/version-archive.html"
RULE = "_____________________________________"
PLUGIN = re.compile(r"Pre-packaged (.+?) plugin version \[(v[^\]]+)\]\(([^)]+)\)")
# Internal references that must never reach Marketing: Jira keys and enterprise PRs.
INTERNAL = re.compile(r"\b(?!SHA-|UTF-|ISO-)[A-Z][A-Z0-9]+-\d+\b|mattermost/enterprise|mattermost-enterprise|#\d+\b")
CITATION = re.compile(r"\s*\((?:[\w.-]+/[\w.-]+#\d+|[A-Z][A-Z0-9]+-\d+)(?:,\s*(?:[\w.-]+/[\w.-]+#\d+|[A-Z][A-Z0-9]+-\d+))*\)")


@dataclass
class EmailFacts:
    release_day: date | None = None
    blog_url: str = ""
    plugins: list = field(default_factory=list)  # (name, version, url) from the changelog entry
    security: list = field(default_factory=list)  # (Version, severity or None): dot releases since the last email
    patches: list = field(default_factory=list)  # (label, changelog url): mobile and desktop patch releases
    esr_blog: str = ""
    esr_email: str = ""
    breaking: list = field(default_factory=list)  # confirmed notices, plain text


def plugins_in(entry: str) -> list[tuple[str, str, str]]:
    return list(dict.fromkeys(PLUGIN.findall(entry or "")))


def internal_references(text: str) -> list[str]:
    return sorted(set(INTERNAL.findall(text or "")))


def _day(day: date | None) -> str:
    return f"{day.strftime('%B')} {day.day}, {day.year}" if day else ""


def email_text(version: Version, esr_versions: str, subject: str, points: list[str], facts: EmailFacts,
               result: Result) -> str:
    """The email for Marketing: no sources, no Jira keys, no enterprise PRs."""
    release = Version(version.major, version.minor, 0)
    day = _day(facts.release_day) or result.todo(f"no Release Day for {version.short}")
    lines = [f"Date: {day}", f"Recipients: {RECIPIENTS}", "",
             f"Subject: Mattermost {version.short} and recent security updates available", "",
             "Dear customer,", "", "We’re writing to inform you about recent Mattermost releases and security updates.",
             RULE, "", f"**Mattermost {version.short}{f' - {subject}' if subject else ''}**"]
    summary = [CITATION.sub("", " ".join(str(p).split())).strip() for p in points if str(p).strip()]
    lines += [f"- {p}" for p in summary] or [result.todo("no release summary points")]
    links = f"See the [Server {release.plain} changelog]({changelog_url(release, esr_versions)})"
    if facts.blog_url:
        links = f"See [the blog post]({facts.blog_url}) and the [Server {release.plain} changelog]({changelog_url(release, esr_versions)})"
    lines += ["", f"{links} for everything that's new."]
    if facts.plugins:
        names = [f"{name} plugin [{plugin_version}]({url})" for name, plugin_version, url in facts.plugins]
        joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + f", and {names[-1]}"
        lines[-1] += f" Mattermost {version.short} also contains pre-packaged {joined}."
    lines += ["", "**Mattermost Server - security release updates**"]
    if facts.security:
        lines.append(f"Security updates are available for the following releases. They are [available for download here]"
                     f"({VERSION_ARCHIVE}). We highly recommend that you apply the update.")
        for dot, severity in facts.security:
            label = f"{dot.plain} (Extended Support Release)" if is_esr(dot, esr_versions) else dot.plain
            severity_text = severity or result.todo(f"no severity for {dot.tag} in its changelog entry")
            lines.append(f"- {label}: {severity_text} severity. See the [v{dot.plain} changelog]({changelog_url(dot, esr_versions)}).")
    else:
        lines.append("No server security releases since the last email.")
    lines += ["", "**Mattermost Mobile and Desktop Apps - patch releases**"]
    lines += [f"- {label}: see the [changelog]({url})." for label, url in facts.patches] or \
             ["No mobile or desktop patch releases since the last email."]
    if facts.esr_email:
        lines += ["", "**Extended Support Release Updates**", facts.esr_email]
    if facts.breaking:
        lines += ["", f"**Mattermost {version.short} - Upcoming Breaking Changes**"] + [f"- {n}" for n in facts.breaking]
    lines += [RULE, "", FOOTER]
    text = "\n".join(lines) + "\n"
    found = internal_references(text)
    if found:
        result.todo(f"the email names {len(found)} internal reference(s) (Jira keys or enterprise PRs); use public names")
    return text


def _sources_appendix(prs: list[dict], epics: list[dict]) -> str:
    lines = ["", "## Sources given to the draft", ""]
    lines += [f"- [{e['key']}]({e['url']}) {e['summary']}" for e in epics]
    lines += [f"- [{p['id']}]({p['url']}) {p['title']}" for p in prs if p["note"]]
    return "\n".join(lines) + "\n"
