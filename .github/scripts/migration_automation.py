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
import time
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
 
# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # seconds; waits 2, 4, 8 between attempts
 
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
 
 
# ── Startup validation ────────────────────────────────────────────────────────
 
REQUIRED_ENV_VARS = {
    "ANTHROPIC_API_KEY": "Anthropic API key (repo secret)",
    "GITHUB_TOKEN": "GitHub token (provided automatically by Actions)",
    "GITHUB_SHA": "Commit SHA (provided automatically by Actions)",
}
 
OPTIONAL_ENV_VARS = {
    "GITHUB_REPOSITORY": ("mattermost/mattermost", "GitHub repository slug"),
    "MIGRATION_REVIEW_ASSIGNEE": ("", "GitHub username to assign review PRs to"),
}
 
 
def validate_env() -> dict:
    """
    Validate required env vars and return a config dict.
    Exits with a clear error message if any required var is missing.
    """
    missing = []
    for var, description in REQUIRED_ENV_VARS.items():
        if not os.environ.get(var, "").strip():
            missing.append(f"  {var}  ({description})")
 
    if missing:
        print("ERROR: The following required environment variables are not set:\n")
        for m in missing:
            print(m)
        print(
            "\nSet these variables before running this script. "
            "In GitHub Actions they should be declared under the step's `env:` block."
        )
        sys.exit(1)
 
    config = {var: os.environ[var] for var in REQUIRED_ENV_VARS}
    for var, (default, _) in OPTIONAL_ENV_VARS.items():
        config[var] = os.environ.get(var, default).strip() or default
 
    return config
 
 
# ── Retry helper ──────────────────────────────────────────────────────────────
 
def _is_retryable_http_error(code: int) -> bool:
    """Return True for transient HTTP errors worth retrying."""
    return code in (429, 500, 502, 503, 504)
 
 
def with_retry(fn, *, label: str, retries: int = MAX_RETRIES):
    """
    Call fn() up to `retries` times with exponential backoff.
    Raises the last exception if all attempts fail.
    """
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            last_exc = e
            if not _is_retryable_http_error(e.code):
                # Non-retryable HTTP errors (e.g. 401, 403, 404) — fail fast
                raise
            wait = RETRY_BACKOFF_BASE ** attempt
            print(
                f"  [{label}] HTTP {e.code} on attempt {attempt}/{retries}. "
                f"Retrying in {wait}s…"
            )
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_exc = e
            wait = RETRY_BACKOFF_BASE ** attempt
            print(
                f"  [{label}] Network error on attempt {attempt}/{retries}: {e}. "
                f"Retrying in {wait}s…"
            )
            time.sleep(wait)
        except anthropic.RateLimitError as e:
            last_exc = e
            wait = RETRY_BACKOFF_BASE ** attempt
            print(
                f"  [{label}] Anthropic rate limit on attempt {attempt}/{retries}. "
                f"Retrying in {wait}s…"
            )
            time.sleep(wait)
        except anthropic.APIStatusError as e:
            last_exc = e
            if e.status_code not in (429, 500, 502, 503, 529):
                raise
            wait = RETRY_BACKOFF_BASE ** attempt
            print(
                f"  [{label}] Anthropic API error {e.status_code} on attempt "
                f"{attempt}/{retries}. Retrying in {wait}s…"
            )
            time.sleep(wait)
    raise last_exc
 
 
# ── HTTP helpers ──────────────────────────────────────────────────────────────
 
def fetch_url(url: str) -> str:
    """Fetch a URL with retry logic. Raises on persistent failure."""
    def _do():
        req = urllib.request.Request(url, headers={"User-Agent": "migration-bot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode()
 
    return with_retry(_do, label=f"GET {url}")
 
 
def gh_api(
    path: str,
    method: str = "GET",
    body: dict | None = None,
    *,
    token: str,
) -> dict | list | None:
    """
    Call the GitHub REST API with retry logic.
    Returns parsed JSON or None on 404.
    Raises on other non-retryable HTTP errors.
    """
    url = f"https://api.github.com/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body else None
 
    def _do():
        req = urllib.request.Request(
            url, data=data, method=method,
            headers={
                "Authorization": f"Bearer {token}",
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
 
    return with_retry(_do, label=f"{method} {path}")
 
 
# ── GitHub helpers ────────────────────────────────────────────────────────────
 
def find_pr_for_sha(sha: str, repo: str, *, token: str) -> int | None:
    """Return the first PR number associated with this commit, or None."""
    result = gh_api(f"repos/{repo}/commits/{sha}/pulls", token=token)
    return result[0]["number"] if result else None
 
 
def get_default_branch_sha(repo: str, *, token: str) -> str:
    result = gh_api(f"repos/{repo}/git/refs/heads/master", token=token)
    if not result or "object" not in result:
        raise RuntimeError(
            f"Could not resolve master branch SHA for {repo}. "
            "Check that GITHUB_TOKEN has 'contents: read' permission."
        )
    return result["object"]["sha"]
 
 
def create_branch(repo: str, branch: str, sha: str, *, token: str) -> None:
    """
    Create a branch pointing at sha.  Idempotent: if the ref already exists
    and points at the right SHA, this is a no-op; if it exists at a different
    SHA (e.g. a stale partial run), it is force-updated to sha.
    """
    try:
        gh_api(
            f"repos/{repo}/git/refs",
            method="POST",
            body={"ref": f"refs/heads/{branch}", "sha": sha},
            token=token,
        )
    except urllib.error.HTTPError as e:
        if e.code != 422:
            raise
        # 422 = "Reference already exists" — check whether it's already correct.
        ref = gh_api(f"repos/{repo}/git/refs/heads/{branch}", token=token)
        existing_sha = (ref or {}).get("object", {}).get("sha")
        if existing_sha == sha:
            print(f"  Branch '{branch}' already exists at {sha[:7]} — reusing.")
        else:
            # Exists but points elsewhere (stale partial run) — update it.
            gh_api(
                f"repos/{repo}/git/refs/heads/{branch}",
                method="PATCH",
                body={"sha": sha, "force": True},
                token=token,
            )
            print(
                f"  Branch '{branch}' existed at {str(existing_sha)[:7]}; "
                f"updated to {sha[:7]}."
            )
 
 
def delete_branch(repo: str, branch: str, *, token: str) -> None:
    """Best-effort branch deletion — used for cleanup on failure."""
    try:
        gh_api(
            f"repos/{repo}/git/refs/heads/{branch}",
            method="DELETE",
            token=token,
        )
        print(f"  Cleaned up branch: {branch}")
    except Exception as e:
        print(f"  Warning: could not delete branch {branch}: {e}")
 
 
def close_pr(repo: str, pr_number: int, *, token: str) -> None:
    """Best-effort PR close — used for cleanup on failure."""
    try:
        gh_api(
            f"repos/{repo}/pulls/{pr_number}",
            method="PATCH",
            body={"state": "closed"},
            token=token,
        )
        print(f"  Cleaned up PR #{pr_number}")
    except Exception as e:
        print(f"  Warning: could not close PR #{pr_number}: {e}")
 
 
def commit_file_to_branch(
    repo: str, path: str, content: str, message: str, branch: str, *, token: str
) -> str:
    """Create a file on the given branch. Returns the html_url of the committed file."""
    encoded = base64.b64encode(content.encode()).decode()
    body: dict = {"message": message, "content": encoded, "branch": branch}
    result = gh_api(
        f"repos/{repo}/contents/{path}", method="PUT", body=body, token=token
    )
    if not result or "content" not in result:
        raise RuntimeError(f"Unexpected response when committing {path}: {result}")
    return result["content"]["html_url"]
 
 
def open_pr(
    repo: str,
    head: str,
    title: str,
    body: str,
    assignee: str | None,
    *,
    token: str,
) -> tuple[int, str]:
    """Open a PR and optionally assign it. Returns (pr_number, html_url)."""
    pr = gh_api(
        f"repos/{repo}/pulls",
        method="POST",
        body={"title": title, "body": body, "head": head, "base": "master"},
        token=token,
    )
    if not pr or "number" not in pr:
        raise RuntimeError(f"Failed to open PR — unexpected response: {pr}")
 
    pr_number = pr["number"]
    pr_url = pr["html_url"]
 
    if assignee:
        gh_api(
            f"repos/{repo}/issues/{pr_number}/assignees",
            method="POST",
            body={"assignees": [assignee]},
            token=token,
        )
 
    return pr_number, pr_url
 
 
def post_pr_comment(pr_number: int, repo: str, body: str, *, token: str) -> None:
    gh_api(
        f"repos/{repo}/issues/{pr_number}/comments",
        method="POST",
        body={"body": body},
        token=token,
    )
 
 
# ── Claude calls ──────────────────────────────────────────────────────────────
 
def call_claude(system: str, user: str, *, api_key: str) -> str:
    """Call Claude with retry logic for rate limits and transient API errors."""
    client = anthropic.Anthropic(api_key=api_key)
 
    def _do():
        msg = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text
 
    return with_retry(_do, label="Anthropic API")
 
 
def run_review(
    up_sql: str,
    down_sql: str,
    skill_md: str,
    reference_md: str,
    guide_text: str,
    *,
    api_key: str,
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
    return call_claude(system, user, api_key=api_key)
 
 
def run_release_notes(review: str, *, api_key: str) -> str:
    user = f"""Based on this migration review, produce the formatted release note
block and one-line changelog summary.
 
## Migration Review:
{review}
"""
    return call_claude(RELEASE_NOTES_SKILL, user, api_key=api_key)
 
 
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
    *,
    api_key: str,
) -> str:
    """Run both skills for one migration. Returns the combined markdown."""
    up_sql = up_path.read_text()
    down_path = up_path.with_name(up_path.name.replace(".up.sql", ".down.sql"))
    down_sql = down_path.read_text() if down_path.exists() else "(no down migration)"
 
    print("  Running review-migration skill…")
    review = run_review(up_sql, down_sql, skill_md, reference_md, guide_text, api_key=api_key)
 
    print("  Running migration-release-notes skill…")
    release_notes = run_release_notes(review, api_key=api_key)
 
    return build_review_file(review, release_notes)
 
 
def main() -> None:
    # ── Validate environment before doing anything else ──────────────────────
    config = validate_env()
 
    new_files = [f for f in sys.argv[1:] if f.strip()]
    if not new_files:
        print("No new migration files provided. Exiting.")
        return
 
    repo = config["GITHUB_REPOSITORY"]
    sha = config["GITHUB_SHA"]
    token = config["GITHUB_TOKEN"]
    api_key = config["ANTHROPIC_API_KEY"]
    assignee = config["MIGRATION_REVIEW_ASSIGNEE"] or None
 
    print(f"Processing {len(new_files)} migration(s): {new_files}\n")
 
    # ── Fetch shared resources once; fail fast if marketplace is unreachable ──
    print("Fetching review-migration skill from AI marketplace…")
    try:
        skill_md = fetch_url(f"{MARKETPLACE_BASE}/SKILL.md")
        reference_md = fetch_url(f"{MARKETPLACE_BASE}/reference.md")
    except Exception as e:
        print(
            f"\nERROR: Could not fetch review-migration skill from AI marketplace.\n"
            f"URL: {MARKETPLACE_BASE}\nReason: {e}\n\n"
            "Check that the marketplace repository is accessible and the path is correct."
        )
        sys.exit(1)
 
    print("Fetching Mattermost DB Migration Guide…")
    try:
        guide_text = fetch_url(MM_GUIDE_URL)
    except Exception as e:
        # Non-fatal: the guide supplements the skill but is not strictly required.
        print(
            f"WARNING: Could not fetch DB Migration Guide ({e}). "
            "Proceeding without it — review quality may be reduced."
        )
        guide_text = ""
 
    print()
 
    # ── Derive branch name ───────────────────────────────────────────────────
    first_name = Path(new_files[0]).name.replace(".up.sql", "")
    short_sha = sha[:7]
    review_branch = f"auto/migration-review/{first_name}-{short_sha}"
 
    # ── Create review branch ─────────────────────────────────────────────────
    print(f"Creating branch: {review_branch}")
    try:
        master_sha = get_default_branch_sha(repo, token=token)
        create_branch(repo, review_branch, master_sha, token=token)
    except Exception as e:
        print(f"\nERROR: Could not create branch '{review_branch}': {e}")
        sys.exit(1)
 
    # ── Process migrations — clean up branch/PR on unrecoverable failure ──────
    created_pr_number: int | None = None
    file_entries: list[tuple[str, str]] = []
 
    try:
        for filepath in new_files:
            up_path = Path(filepath)
            print(f"\n→ {up_path.name}")
 
            try:
                content = process(
                    up_path, skill_md, reference_md, guide_text, api_key=api_key
                )
            except anthropic.AuthenticationError as e:
                print(
                    f"\nERROR: Anthropic authentication failed. "
                    f"Check that ANTHROPIC_API_KEY is valid.\nDetail: {e}"
                )
                raise
            except Exception as e:
                print(f"\nERROR: Claude invocation failed for {up_path.name}: {e}")
                raise
 
            review_name = up_path.name.replace(".up.sql", ".md")
            review_path = f"{REVIEWS_DIR}/{review_name}"
            commit_msg = f"Add migration review: {review_name} [skip ci]"
 
            print(f"  Committing {review_path} to {review_branch}…")
            try:
                file_url = commit_file_to_branch(
                    repo, review_path, content, commit_msg, review_branch, token=token
                )
            except Exception as e:
                print(f"\nERROR: Could not commit {review_path}: {e}")
                raise
 
            file_entries.append((review_name, file_url))
            print(f"  Committed: {file_url}")
 
        # ── Open review PR ───────────────────────────────────────────────────
        if len(file_entries) == 1:
            pr_title = f"Migration review: {file_entries[0][0]}"
        else:
            pr_title = f"Migration review: {len(file_entries)} migrations ({first_name}…)"
 
        print(f"\nOpening review PR: '{pr_title}'…")
        pr_body = build_pr_body(file_entries)
        try:
            pr_number, pr_url = open_pr(
                repo, review_branch, pr_title, pr_body, assignee, token=token
            )
        except Exception as e:
            print(f"\nERROR: Could not open review PR: {e}")
            raise
 
        created_pr_number = pr_number
        print(
            f"Review PR: {pr_url}"
            + (f" — assigned to {assignee}" if assignee else "")
        )
 
        # ── Comment on the original migration PR ─────────────────────────────
        try:
            migration_pr = find_pr_for_sha(sha, repo, token=token)
        except Exception as e:
            print(
                f"WARNING: Could not look up migration PR for {sha}: {e} — skipping comment."
            )
            migration_pr = None
 
        if migration_pr:
            file_list = "\n".join(f"- `{name}`" for name, _ in file_entries)
            comment = (
                "### 🤖 Migration Review & Release Notes\n\n"
                f"New migration(s) detected in this PR:\n{file_list}\n\n"
                "I've run the schema safety review and drafted the release notes:\n\n"
                f"📋 **[Review PR #{pr_number}]({pr_url})**\n\n"
                "_The review PR contains the safety analysis and a ready-to-publish "
                "release note draft. Please verify the description paragraph for accuracy "
                "before merging._"
            )
            try:
                post_pr_comment(migration_pr, repo, comment, token=token)
                print(f"Posted comment on migration PR #{migration_pr}")
            except Exception as e:
                # A comment failure is non-fatal — the review PR already exists.
                print(f"WARNING: Could not post comment on PR #{migration_pr}: {e}")
        else:
            print(f"No migration PR found for {sha} — skipping comment.")
 
    except Exception:
        # ── Cleanup: close the PR (if opened) and delete the branch ──────────
        print("\n⚠ Workflow failed — cleaning up partial state…")
        if created_pr_number is not None:
            close_pr(repo, created_pr_number, token=token)
        delete_branch(repo, review_branch, token=token)
        print("Cleanup complete. See errors above for details.")
        sys.exit(1)
 
 
if __name__ == "__main__":
    main()
