#!/usr/bin/env python3
"""
migration_automation.py
 
Triggered by GitHub Actions when a new .up.sql file lands on master.
 
For each new migration file:
  1. Reads the .up.sql and .down.sql from the repo
  2. Fetches the review-migration skill from the AI marketplace
  3. Calls Claude to produce the schema review report
  4. Calls Claude to produce the RST release note draft + changelog summary
  5. Commits the combined .md to a new branch and opens a review PR
     assigned to the release manager
  6. Posts a comment on the original migration PR linking to the review PR
 
Required environment variables:
  ANTHROPIC_API_KEY           — already a repo secret
  GITHUB_TOKEN                — provided automatically by GitHub Actions
  GITHUB_SHA                  — provided automatically by GitHub Actions
  GITHUB_REPOSITORY           — provided automatically by GitHub Actions
  MIGRATION_REVIEW_ASSIGNEE   — repo variable (GitHub username, e.g. amyblais)
"""
 
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
 
import anthropic
 
 
# ── Config ────────────────────────────────────────────────────────────────────
 
MODEL = "claude-sonnet-4-6"
REVIEWS_DIR = "server/channels/db/migrations/reviews"
 
MARKETPLACE_BASE = (
    "https://raw.githubusercontent.com/mattermost/mattermost-ai-marketplace"
    "/main/plugins/review-migration/skills/review-migration"
)
MM_GUIDE_URL = (
    "https://developers.mattermost.com/contribute/more-info/server/schema-migration-guide/"
)
 
RELEASE_NOTES_SKILL = """
You are helping a Mattermost release manager write database migration release notes.
 
When given a migration review report, produce two things:
 
## 1. Release Note Block
 
Three parts in this exact order:
 
### Part A — Description
A clear, concise paragraph (2–5 sentences) describing what changed and why.
Write for database admins and self-hosters who need to understand the change at a glance.
Cover what tables/columns/indexes changed, the purpose, and any performance impact.
Do NOT include upgrade instructions here.
 
Inline code formatting: use DOUBLE backticks for all table names, column names, and
identifiers in prose (RST/Sphinx style). E.g. ``roles``, ``schemeid``, ``permission_level``.
Never use single backticks in description prose.
 
### Part B — Fixed compatibility statement (copy verbatim every time):
The migrations are fully backwards-compatible and no database downtime is expected for this upgrade. The SQL queries included are:
 
### Part C — SQL in RST format (NOT markdown fences):
.. code-block:: sql
 
    <SQL here, indented 4 spaces>
 
For multiple SQL dialects use a separate labeled ``.. code-block:: sql`` block for each.
 
## 2. One-Line Changelog Summary
 
**Changelog summary:** `<one sentence under ~30 words, ending with an impact note>`
"""
 
 
# ── HTTP helpers ──────────────────────────────────────────────────────────────
 
def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "migration-bot/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode()
 
 
def gh_api(
    path: str,
    method: str = "GET",
    body: dict | None = None,
) -> dict | list | None:
    url = f"https://api.github.com/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
 
 
# ── GitHub helpers ────────────────────────────────────────────────────────────
 
def find_pr_for_sha(sha: str, repo: str) -> int | None:
    """Return the first PR number associated with this commit, or None."""
    result = gh_api(f"repos/{repo}/commits/{sha}/pulls")
    return result[0]["number"] if result else None
 
 
def get_default_branch_sha(repo: str) -> str:
    result = gh_api(f"repos/{repo}/git/refs/heads/master")
    return result["object"]["sha"]
 
 
def create_branch(repo: str, branch: str, sha: str) -> None:
    gh_api(
        f"repos/{repo}/git/refs",
        method="POST",
        body={"ref": f"refs/heads/{branch}", "sha": sha},
    )
 
 
def commit_file_to_branch(
    repo: str, path: str, content: str, message: str, branch: str
) -> str:
    """Create a file on the given branch. Returns the html_url of the committed file."""
    encoded = base64.b64encode(content.encode()).decode()
    body: dict = {"message": message, "content": encoded, "branch": branch}
    result = gh_api(f"repos/{repo}/contents/{path}", method="PUT", body=body)
    return result["content"]["html_url"]
 
 
def open_pr(
    repo: str,
    head: str,
    title: str,
    body: str,
    assignee: str | None,
) -> tuple[int, str]:
    """Open a PR and optionally assign it. Returns (pr_number, html_url)."""
    pr = gh_api(
        f"repos/{repo}/pulls",
        method="POST",
        body={"title": title, "body": body, "head": head, "base": "master"},
    )
    pr_number = pr["number"]
    pr_url = pr["html_url"]
 
    if assignee:
        gh_api(
            f"repos/{repo}/issues/{pr_number}/assignees",
            method="POST",
            body={"assignees": [assignee]},
        )
 
    return pr_number, pr_url
 
 
def post_pr_comment(pr_number: int, repo: str, body: str) -> None:
    gh_api(
        f"repos/{repo}/issues/{pr_number}/comments",
        method="POST",
        body={"body": body},
    )
 
 
# ── Claude calls ──────────────────────────────────────────────────────────────
 
def call_claude(system: str, user: str) -> str:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text
 
 
def run_review(
    up_sql: str,
    down_sql: str,
    skill_md: str,
    reference_md: str,
    guide_text: str,
) -> str:
    system = f"""You are a Mattermost database migration reviewer.
 
Your instructions (the review-migration skill):
{skill_md}
 
Supplementary internal reference:
{reference_md}
 
Official Mattermost DB Migration Guide (source of truth for rules and lock types):
{guide_text[:12000]}
"""
    user = f"""Review this migration and produce the full report in the markdown
template format from your instructions.
 
## Up migration (.up.sql):
```sql
{up_sql}
```
 
## Down migration (.down.sql):
```sql
{down_sql}
```
"""
    return call_claude(system, user)
 
 
def run_release_notes(review: str) -> str:
    user = f"""Based on this migration review, produce the formatted release note
block and one-line changelog summary.
 
## Migration Review:
{review}
"""
    return call_claude(RELEASE_NOTES_SKILL, user)
 
 
# ── File assembly ─────────────────────────────────────────────────────────────
 
def build_review_file(review: str, release_notes: str) -> str:
    return f"""{review}
 
---
 
## Release Note Draft
 
{release_notes}
"""
 
 
def build_pr_body(file_entries: list[tuple[str, str]]) -> str:
    """
    Build the review PR description.
    file_entries: list of (migration_filename, file_html_url)
    """
    file_list = "\n".join(f"- [{name}]({url})" for name, url in file_entries)
    return f"""## Auto-generated migration review
 
This PR was opened automatically by the migration review workflow.
It contains the schema safety analysis and release note draft for the following migration(s):
 
{file_list}
 
### Review checklist
 
- [ ] Schema Changes section accurately reflects what was added/modified
- [ ] Safety Analysis flags look correct (especially any ❌ items)
- [ ] Backwards Compatibility assessment is accurate
- [ ] Release Note description paragraph reads clearly and is factually correct
- [ ] Changelog summary is concise and complete
 
Once reviewed, merge this PR to keep the review file alongside the migration.
 
_Generated by the [migration-automation workflow](/.github/workflows/migration-automation.yml)_
"""
 
 
# ── Main ──────────────────────────────────────────────────────────────────────
 
def process(
    up_path: Path,
    skill_md: str,
    reference_md: str,
    guide_text: str,
) -> str:
    """Run both skills for one migration. Returns the combined markdown."""
    up_sql = up_path.read_text()
    down_path = up_path.with_name(up_path.name.replace(".up.sql", ".down.sql"))
    down_sql = down_path.read_text() if down_path.exists() else "(no down migration)"
 
    print("  Running review-migration skill...")
    review = run_review(up_sql, down_sql, skill_md, reference_md, guide_text)
 
    print("  Running migration-release-notes skill...")
    release_notes = run_release_notes(review)
 
    return build_review_file(review, release_notes)
 
 
def main() -> None:
    new_files = [f for f in sys.argv[1:] if f.strip()]
    if not new_files:
        print("No new migration files provided. Exiting.")
        return
 
    repo      = os.environ.get("GITHUB_REPOSITORY", "mattermost/mattermost")
    sha       = os.environ["GITHUB_SHA"]
    assignee  = os.environ.get("MIGRATION_REVIEW_ASSIGNEE", "").strip() or None
 
    print(f"Processing {len(new_files)} migration(s): {new_files}\n")
 
    # Fetch shared resources once
    print("Fetching review-migration skill from AI marketplace...")
    skill_md     = fetch_url(f"{MARKETPLACE_BASE}/SKILL.md")
    reference_md = fetch_url(f"{MARKETPLACE_BASE}/reference.md")
    print("Fetching Mattermost DB Migration Guide...")
    guide_text = fetch_url(MM_GUIDE_URL)
    print()
 
    # Derive a branch name from the first migration + short SHA
    first_name   = Path(new_files[0]).name.replace(".up.sql", "")
    short_sha    = sha[:7]
    review_branch = f"auto/migration-review/{first_name}-{short_sha}"
 
    # Create the review branch off master
    print(f"Creating branch: {review_branch}")
    master_sha = get_default_branch_sha(repo)
    create_branch(repo, review_branch, master_sha)
 
    # Process each migration and commit its review file to the branch
    file_entries: list[tuple[str, str]] = []
    for filepath in new_files:
        up_path = Path(filepath)
        print(f"\n→ {up_path.name}")
 
        content       = process(up_path, skill_md, reference_md, guide_text)
        review_name   = up_path.name.replace(".up.sql", ".md")
        review_path   = f"{REVIEWS_DIR}/{review_name}"
        commit_msg    = f"Add migration review: {review_name} [skip ci]"
 
        print(f"  Committing {review_path} to {review_branch}...")
        file_url = commit_file_to_branch(repo, review_path, content, commit_msg, review_branch)
        file_entries.append((review_name, file_url))
        print(f"  Committed: {file_url}")
 
    # Open the review PR
    if len(file_entries) == 1:
        pr_title = f"Migration review: {file_entries[0][0]}"
    else:
        pr_title = f"Migration review: {len(file_entries)} migrations ({first_name}…)"
 
    print(f"\nOpening review PR: '{pr_title}'...")
    pr_body    = build_pr_body(file_entries)
    pr_number, pr_url = open_pr(repo, review_branch, pr_title, pr_body, assignee)
    print(f"Review PR: {pr_url}" + (f" — assigned to {assignee}" if assignee else ""))
 
    # Comment on the original migration PR
    migration_pr = find_pr_for_sha(sha, repo)
    if migration_pr:
        file_list = "\n".join(f"- `{name}`" for name, _ in file_entries)
        comment = (
            "### 🤖 Migration Review & Release Notes\n\n"
            f"New migration(s) detected in this PR:\n{file_list}\n\n"
            f"I've run the schema safety review and drafted the release notes:\n\n"
            f"📋 **[Review PR #{pr_number}]({pr_url})**\n\n"
            "_The review PR contains the safety analysis and a ready-to-publish "
            "release note draft. Please verify the description paragraph for accuracy "
            "before merging._"
        )
        post_pr_comment(migration_pr, repo, comment)
        print(f"Posted comment on migration PR #{migration_pr}")
    else:
        print(f"No migration PR found for {sha} — skipping comment.")
 
 
if __name__ == "__main__":
    main()
  
