#!/usr/bin/env python3
"""
Feature Flag Monthly Audit
===========================
Runs on a monthly cron. Scans ALL boolean flags set to true in SetDefaults(),
finds ones enabled for 90+ days, and creates one Jira ticket per flag in the
MM project. Skips flags that already have an open ticket (duplicate detection
via JQL search on the flag name label).
 
Required GitHub Secrets:
  JIRA_USER_EMAIL  — Atlassian account email for API auth
  JIRA_API_TOKEN   — Atlassian API token (https://id.atlassian.com/manage-profile/security/api-tokens)
 
Set in workflow env (no secret needed):
  JIRA_BASE_URL    — e.g. https://mattermost.atlassian.net
  JIRA_PROJECT_KEY — e.g. MM
"""
 
import base64
import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
 
FLAG_FILE = "server/public/model/feature_flags.go"
STALE_DAYS = 90
# Label applied to every ticket this script creates — used for duplicate detection
JIRA_LABEL = "feature-flag-cleanup"
 
 
# ---------------------------------------------------------------------------
# 1. Parse feature_flags.go
# ---------------------------------------------------------------------------
 
def get_enabled_flags(filepath: str) -> list[str]:
    with open(filepath) as f:
        source = f.read()
    match = re.search(r"func \(f \*FeatureFlags\) SetDefaults\(\)(.*?)^}", source, re.DOTALL | re.MULTILINE)
    if not match:
        print("ERROR: Could not find SetDefaults()")
        sys.exit(1)
    return re.findall(r"f\.(\w+)\s*=\s*true", match.group(1))
 
 
# ---------------------------------------------------------------------------
# 2. Git history helpers
# ---------------------------------------------------------------------------
 
def git_log_patches(filepath: str) -> list[dict]:
    log_output = subprocess.check_output(
        ["git", "log", "--follow", "--format=%H %aI", "-p", "--", filepath],
        text=True,
    )
    commits = []
    current = None
    diff_lines = []
    for line in log_output.splitlines():
        header = re.match(r"^([0-9a-f]{40}) (\S+)$", line)
        if header:
            if current is not None:
                current["diff"] = "\n".join(diff_lines)
                commits.append(current)
            sha, date_str = header.groups()
            current = {"sha": sha, "date": datetime.fromisoformat(date_str), "diff": ""}
            diff_lines = []
        else:
            diff_lines.append(line)
    if current is not None:
        current["diff"] = "\n".join(diff_lines)
        commits.append(current)
    return commits
 
 
def find_flag_enabled_date(flag_name: str, commits: list[dict]) -> datetime | None:
    # Iterate oldest-first to return the original enable date, not the most recent.
    # commits is newest-first from git log, so we reverse it.
    pattern = re.compile(rf"^\+\s*f\.{re.escape(flag_name)}\s*=\s*true", re.MULTILINE)
    for commit in reversed(commits):
        if pattern.search(commit["diff"]):
            return commit["date"]
    return None
 
 
# ---------------------------------------------------------------------------
# 3. Jira helpers
# ---------------------------------------------------------------------------
 
def jira_auth_header(email: str, token: str) -> str:
    encoded = base64.b64encode(f"{email}:{token}".encode()).decode()
    return f"Basic {encoded}"
 
 
def jira_request(method: str, path: str, auth: str, base_url: str, data: dict | None = None):
    url = f"{base_url}/rest/api/3{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": auth,
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Jira API error {e.code} for {method} {path}: {e.read().decode()}")
        raise
 
 
def find_open_ticket(flag_name: str, project_key: str, auth: str, base_url: str) -> str | None:
    """
    Return the issue key (e.g. MM-12345) if an open ticket for this flag
    already exists, otherwise None.
 
    Uses the JIRA_LABEL + flag name in summary to identify duplicates.
    """
    jql = (
        f'project = "{project_key}" '
        f'AND labels = "{JIRA_LABEL}" '
        f'AND summary ~ "\\"{flag_name}\\"" '
        f'AND statusCategory != Done'
    )
    result = jira_request(
        "GET",
        f"/search?jql={urllib.parse.quote(jql)}&maxResults=1&fields=key,summary",
        auth,
        base_url,
    )
    issues = result.get("issues", [])
    if issues:
        return issues[0]["key"]
    return None
 
 
def create_jira_ticket(entry: dict, project_key: str, auth: str, base_url: str) -> str:
    """Create a Jira task and return the issue key."""
    flag = entry["flag"]
    days = entry["days"]
    since = entry["since"].strftime("%Y-%m-%d")
    priority_note = (
        "\n\nA `FEATURE_FLAG_REMOVAL` comment is already present in the source — this is high priority."
        if entry["removal_comment"] else ""
    )
 
    # Jira description in Atlassian Document Format (ADF)
    description_adf = {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "The feature flag "},
                    {"type": "text", "text": flag, "marks": [{"type": "code"}]},
                    {"type": "text", "text": (
                        f" has been set to {chr(96)}true{chr(96)} in {chr(96)}SetDefaults(){chr(96)} "
                        f"since {since} ({days} days). It is now a candidate for removal."
                    )},
                ],
            },
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "File: "},
                    {
                        "type": "inlineCard",
                        "attrs": {
                            "url": f"https://github.com/mattermost/mattermost/blob/master/{FLAG_FILE}"
                        },
                    },
                ],
            },
            *(
                [{
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "⚠️ A ",
                        },
                        {
                            "type": "text",
                            "text": "FEATURE_FLAG_REMOVAL",
                            "marks": [{"type": "code"}],
                        },
                        {
                            "type": "text",
                            "text": " comment is already present in the source — this is high priority.",
                        },
                    ],
                }]
                if entry["removal_comment"] else []
            ),
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "Generated by the monthly feature flag audit workflow.",
                        "marks": [{"type": "em"}],
                    }
                ],
            },
        ],
    }
 
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": f"Remove feature flag `{flag}` (enabled {days} days ago)",
            "issuetype": {"name": "Task"},
            "description": description_adf,
            "labels": [JIRA_LABEL],
            **({"priority": {"name": "High"}} if entry["removal_comment"] else {}),
        }
    }
 
    result = jira_request("POST", "/issue", auth, base_url, payload)
    return result["key"]
 
 
# ---------------------------------------------------------------------------
# 4. Main
# ---------------------------------------------------------------------------
 
# Import urllib.parse (needed for URL encoding the JQL)
import urllib.parse  # noqa: E402 — imported here to keep the top clean
 
 
def main():
    jira_email = os.environ.get("JIRA_USER_EMAIL")
    jira_token = os.environ.get("JIRA_API_TOKEN")
    jira_base_url = os.environ.get("JIRA_BASE_URL", "https://mattermost.atlassian.net")
    project_key = os.environ.get("JIRA_PROJECT_KEY", "MM")
 
    if not all([jira_email, jira_token]):
        print("ERROR: JIRA_USER_EMAIL and JIRA_API_TOKEN must be set.")
        sys.exit(1)
 
    auth = jira_auth_header(jira_email, jira_token)
 
    print(f"Parsing {FLAG_FILE}...")
    enabled_flags = [f for f in get_enabled_flags(FLAG_FILE) if not f.startswith("Test")]
    print(f"Enabled flags to check: {enabled_flags}")
 
    print("Loading git history...")
    commits = git_log_patches(FLAG_FILE)
    print(f"Loaded {len(commits)} commits")
 
    with open(FLAG_FILE) as f:
        source = f.read()
 
    now = datetime.now(timezone.utc)
    stale = []
 
    for flag in enabled_flags:
        enabled_date = find_flag_enabled_date(flag, commits)
        if enabled_date is None:
            print(f"  {flag}: no enable date found in history — skipping")
            continue
        days_enabled = (now - enabled_date).days
        if days_enabled < STALE_DAYS:
            print(f"  {flag}: {days_enabled} days — not yet stale")
            continue
        removal_comment = bool(re.search(
            rf"FEATURE_FLAG_REMOVAL[^\n]*\b{re.escape(flag)}\b",
            source,
        ))
        stale.append({
            "flag": flag,
            "since": enabled_date,
            "days": days_enabled,
            "removal_comment": removal_comment,
        })
 
    print(f"\n{len(stale)} stale flag(s): {[e['flag'] for e in stale]}")
 
    if not stale:
        print("Nothing to do.")
        return
 
    created = []
    skipped = []
 
    for entry in stale:
        flag = entry["flag"]
        existing = find_open_ticket(flag, project_key, auth, jira_base_url)
        if existing:
            print(f"  {flag}: open ticket already exists ({existing}) — skipping")
            skipped.append((flag, existing))
        else:
            key = create_jira_ticket(entry, project_key, auth, jira_base_url)
            print(f"  {flag}: created {key} — {jira_base_url}/browse/{key}")
            created.append((flag, key))
 
    print(f"\nSummary: {len(created)} ticket(s) created, {len(skipped)} already existed.")
    for flag, key in created:
        print(f"  Created:  {key}  ({flag})")
    for flag, key in skipped:
        print(f"  Existing: {key}  ({flag})")
 
 
if __name__ == "__main__":
    main()
