#!/usr/bin/env python3
"""
migration_automation.py
 
Triggered by GitHub Actions when a new .up.sql file lands on master.
 
Each Mattermost migration ships as a pair of files: NNNNNN_slug.up.sql
(applied on upgrade) and NNNNNN_slug.down.sql (applied on rollback).  The
workflow filters on .up.sql files only because:
  - The .up.sql is the canonical identifier for a new migration.
  - Both files are committed together, so detecting the up file is enough
    to locate the pair.
  - We never want to trigger a separate review run for a down migration
    that arrives without a matching up migration.
 
For each new .up.sql file detected:
  1. Reads the .up.sql and its paired .down.sql (if present) from the repo
  2. Fetches the review-migration skill from the AI marketplace
  3. Calls Claude to produce the schema review report
  4. Calls Claude to produce the RST release note draft + changelog summary
  5. Appends the combined output to $GITHUB_STEP_SUMMARY so it renders
     inline in the Actions run UI — no branch, PR, or extra secrets needed
 
Required environment variables:
  ANTHROPIC_API_KEY    — repo secret
  GITHUB_STEP_SUMMARY  — file path provided automatically by GitHub Actions
"""
 
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
 
import anthropic
 
 
# ── Config ────────────────────────────────────────────────────────────────────
 
MODEL = "claude-sonnet-4-6"
 
# The marketplace URL intentionally points to /main so the script always uses
# the latest version of Ben Cooke's review-migration skill.  Any push to
# mattermost-ai-marketplace/main WILL change the skill used by this workflow —
# that is by design.  To pin to a specific revision instead, replace "main"
# with a commit SHA (e.g. "/abc1234/plugins/...").
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
 
# Allowlist pattern for migration file paths accepted by this script.
# Format: server/channels/db/migrations/postgres/NNNNNN_slug.up.sql
MIGRATION_PATH_RE = re.compile(
    r"^server/channels/db/migrations/postgres/\d{6}_[\w-]+\.up\.sql$"
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
 
 
# ── Startup validation ────────────────────────────────────────────────────────
 
def validate_env() -> str:
    """
    Validate required env vars and return the GITHUB_STEP_SUMMARY path.
    Exits with a clear error message if any required var is missing.
 
    ANTHROPIC_API_KEY is validated here so we fail fast with a readable
    message rather than an opaque SDK error, but it is not returned —
    the Anthropic SDK reads it directly from the environment.
    """
    required = {
        "ANTHROPIC_API_KEY": "Anthropic API key (repo secret)",
        "GITHUB_STEP_SUMMARY": "Job summary file path (provided automatically by Actions)",
    }
    missing = [
        f"  {var}  ({desc})"
        for var, desc in required.items()
        if not os.environ.get(var, "").strip()
    ]
    if missing:
        print("ERROR: The following required environment variables are not set:\n")
        for m in missing:
            print(m)
        sys.exit(1)
 
    return os.environ["GITHUB_STEP_SUMMARY"]
 
 
# ── Input validation ──────────────────────────────────────────────────────────
 
def validate_migration_paths(paths: list[str]) -> None:
    """
    Server-side validation: reject any path that does not match the canonical
    migration file pattern.  Defense-in-depth against path traversal or
    unexpected input if the workflow filter is ever bypassed.
    """
    invalid = [p for p in paths if not MIGRATION_PATH_RE.match(p)]
    if invalid:
        print(
            "ERROR: The following paths do not match the expected migration pattern "
            f"({MIGRATION_PATH_RE.pattern}):"
        )
        for p in invalid:
            print(f"  {p!r}")
        print("Aborting — only files under the canonical migrations directory are accepted.")
        sys.exit(1)
 
 
# ── Retry helper ──────────────────────────────────────────────────────────────
 
def _is_retryable_http_error(code: int) -> bool:
    return code in (429, 500, 502, 503, 504)
 
 
def with_retry(fn, *, label: str, retries: int = MAX_RETRIES):
    """Call fn() up to `retries` times with exponential backoff."""
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            last_exc = e
            if not _is_retryable_http_error(e.code):
                raise
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"  [{label}] HTTP {e.code} on attempt {attempt}/{retries}. "
                  f"Retrying in {wait}s…")
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_exc = e
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"  [{label}] Network error on attempt {attempt}/{retries}: {e}. "
                  f"Retrying in {wait}s…")
            time.sleep(wait)
        except anthropic.RateLimitError as e:
            last_exc = e
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"  [{label}] Anthropic rate limit on attempt {attempt}/{retries}. "
                  f"Retrying in {wait}s…")
            time.sleep(wait)
        except anthropic.APIStatusError as e:
            last_exc = e
            if e.status_code not in (429, 500, 502, 503, 529):
                raise
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"  [{label}] Anthropic API error {e.status_code} on attempt "
                  f"{attempt}/{retries}. Retrying in {wait}s…")
            time.sleep(wait)
    raise last_exc
 
 
# ── HTTP helpers ──────────────────────────────────────────────────────────────
 
def fetch_url(url: str) -> str:
    def _do():
        req = urllib.request.Request(url, headers={"User-Agent": "migration-bot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode()
    return with_retry(_do, label=f"GET {url}")
 
 
# ── Claude calls ──────────────────────────────────────────────────────────────
 
def call_claude(system: str, user: str) -> str:
    # No explicit api_key — the SDK reads ANTHROPIC_API_KEY from the environment
    # automatically, keeping the key out of the call stack and reducing the
    # chance of accidental logging.
    client = anthropic.Anthropic()
 
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
 
 
# ── Processing ────────────────────────────────────────────────────────────────
 
def process(
    up_path: Path,
    skill_md: str,
    reference_md: str,
    guide_text: str,
) -> str:
    """Run both skills for one migration. Returns the combined markdown."""
    up_sql = up_path.read_text(encoding="utf-8")
    down_path = up_path.with_name(up_path.name.replace(".up.sql", ".down.sql"))
    down_sql = down_path.read_text(encoding="utf-8") if down_path.exists() else "(no down migration)"
 
    print("  Running review-migration skill…")
    review = run_review(up_sql, down_sql, skill_md, reference_md, guide_text)
 
    print("  Running migration-release-notes skill…")
    release_notes = run_release_notes(review)
 
    return f"{review}\n\n---\n\n## Release Note Draft\n\n{release_notes}"
 
 
# ── Job Summary output ────────────────────────────────────────────────────────
 
def write_summary(summary_path: str, sections: list[tuple[str, str]]) -> None:
    """Append all review sections to the GitHub Actions job summary file."""
    with open(summary_path, "a", encoding="utf-8") as f:
        f.write("# 🔍 Migration Review & Release Notes\n\n")
        for name, content in sections:
            f.write(f"## `{name}`\n\n")
            f.write(content)
            f.write("\n\n---\n\n")
    print(f"\nSummary written to job summary ({len(sections)} migration(s)).")
 
 
# ── Main ──────────────────────────────────────────────────────────────────────
 
def main() -> None:
    summary_path = validate_env()
 
    new_files = [f for f in sys.argv[1:] if f.strip()]
    if not new_files:
        print("No new migration files provided. Exiting.")
        return
 
    validate_migration_paths(new_files)
 
    print(f"Processing {len(new_files)} migration(s): {new_files}\n")
 
    # Fetch shared resources once
    print("Fetching review-migration skill from AI marketplace…")
    try:
        skill_md = fetch_url(f"{MARKETPLACE_BASE}/SKILL.md")
        reference_md = fetch_url(f"{MARKETPLACE_BASE}/reference.md")
    except Exception as e:
        print(
            f"\nERROR: Could not fetch review-migration skill.\n"
            f"URL: {MARKETPLACE_BASE}\nReason: {e}"
        )
        sys.exit(1)
 
    print("Fetching Mattermost DB Migration Guide…")
    try:
        guide_text = fetch_url(MM_GUIDE_URL)
    except Exception as e:
        print(f"WARNING: Could not fetch DB Migration Guide ({e}). Proceeding without it.")
        guide_text = ""
 
    print()
 
    # Process each migration
    sections: list[tuple[str, str]] = []
    for filepath in new_files:
        up_path = Path(filepath)
        print(f"→ {up_path.name}")
        try:
            content = process(up_path, skill_md, reference_md, guide_text)
        except anthropic.AuthenticationError as e:
            print(f"\nERROR: Anthropic authentication failed. "
                  f"Check that ANTHROPIC_API_KEY is valid.\nDetail: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"\nERROR: Failed to process {up_path.name}: {e}")
            sys.exit(1)
        sections.append((up_path.name, content))
 
    write_summary(summary_path, sections)
 
 
if __name__ == "__main__":
    main()
