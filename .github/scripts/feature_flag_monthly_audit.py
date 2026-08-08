#!/usr/bin/env python3
"""
Feature Flag Monthly Audit
===========================
Runs on a monthly cron. Scans ALL boolean flags set to true in SetDefaults(),
determines which ESR each flag first shipped in, and creates a Jira MM Task
for any flag whose governing ESR has reached end-of-life.
 
Staleness signal: "the ESR that first shipped this flag as true is now EOL"
 
ESR detection is fully automatic — ESR release dates are derived from
a fixed schedule (every 9 months, supported for 12 months) anchored to
the first known ESR (v10.11, August 2025). No config file to maintain.
 
Required GitHub Secrets:
  JIRA_USER_EMAIL  — Atlassian account email for API auth
  JIRA_API_TOKEN   — Atlassian API token (https://id.atlassian.com/manage-profile/security/api-tokens)
 
Set in workflow env (no secret needed):
  JIRA_BASE_URL    — e.g. https://mattermost.atlassian.net
  JIRA_PROJECT_KEY — e.g. MM
"""
 
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
 
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FLAG_FILE_REL = "server/public/model/feature_flags.go"
FLAG_FILE = os.path.join(REPO_ROOT, FLAG_FILE_REL)
JIRA_LABEL = "feature-flag-cleanup"
 
# ESR schedule constants — only the anchor date ever needs to change,
# and only if Mattermost retroactively redefines what the first ESR was.
ESR_ANCHOR_DATE = date(2025, 8, 1)   # v10.11: first known ESR release date
ESR_INTERVAL_MONTHS = 9              # new ESR every 9 months
ESR_SUPPORT_MONTHS = 12              # each ESR supported for 12 months
ESR_TAG_WINDOW_DAYS = 45             # how close a vX.Y.0 tag must be to the computed slot
 
 
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
# 2. Git history: find when each flag was first set to true
# ---------------------------------------------------------------------------
 
def git_log_patches(filepath: str) -> list[dict]:
    """Return commits newest-first, each with sha, date, and diff."""
    log_output = subprocess.check_output(
        ["git", "log", "--follow", "--format=%H %aI", "-p", "--", filepath],
        text=True,
        cwd=REPO_ROOT,
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
 
 
def find_flag_enable_date(flag_name: str, commits: list[dict]) -> datetime | None:
    """
    Return the *original* date the flag was first set to true.
    Iterates oldest-first (reversed) so the first match is the earliest commit.
    """
    pattern = re.compile(rf"^\+\s*f\.{re.escape(flag_name)}\s*=\s*true", re.MULTILINE)
    for commit in reversed(commits):
        if pattern.search(commit["diff"]):
            return commit["date"]
    return None
 
 
# ---------------------------------------------------------------------------
# 3. Release tags: find which vX.Y.0 first shipped after the flag was enabled
# ---------------------------------------------------------------------------
 
def get_release_tags() -> list[tuple[str, datetime]]:
    """
    Return all vX.Y.0 release tags as (version_str, tag_date) sorted oldest-first.
    version_str is the "X.Y" minor version, e.g. "10.11".
    """
    output = subprocess.check_output(
        [
            "git", "tag", "-l", "v[0-9]*.[0-9]*.0",
            "--sort=creatordate",
            "--format=%(refname:short)\t%(creatordate:iso-strict)",
        ],
        text=True,
        cwd=REPO_ROOT,
    ).strip()
 
    tags = []
    for line in output.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t", 1)
        if len(parts) != 2:
            continue
        tag_name, date_str = parts
        m = re.match(r"^v(\d+\.\d+)\.\d+$", tag_name)
        if not m:
            continue
        try:
            tag_date = datetime.fromisoformat(date_str)
        except ValueError:
            continue
        tags.append((m.group(1), tag_date))
 
    return tags
 
 
def find_ship_version(enable_date: datetime, release_tags: list[tuple[str, datetime]]) -> str | None:
    """
    Return the minor version string (e.g. "10.11") of the first release
    that shipped after enable_date. Returns None if no such release exists yet.
    release_tags must be sorted oldest-first.
    """
    for version, tag_date in release_tags:
        if tag_date > enable_date:
            return version
    return None
 
 
# ---------------------------------------------------------------------------
# 4. ESR detection: derive all shipped ESRs from the fixed schedule
# ---------------------------------------------------------------------------
 
def add_months(d: date, months: int) -> date:
    """Add a number of calendar months to a date."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return d.replace(year=year, month=month)
 
 
def detect_esrs(release_tags: list[tuple[str, datetime]]) -> list[dict]:
    """
    Derive all shipped ESRs from the fixed schedule anchored at ESR_ANCHOR_DATE.
    For each computed ESR slot, finds the closest vX.Y.0 tag within
    ±ESR_TAG_WINDOW_DAYS days. EOL = tag date + ESR_SUPPORT_MONTHS.
 
    Returns a list of dicts sorted oldest-first:
      {version, released, eol, _version_tuple, _released_date, _eol_date}
    """
    today = date.today()
    esrs = []
    slot = ESR_ANCHOR_DATE
 
    while slot <= today:
        best_version = None
        best_tag_date = None
        best_delta = None
 
        for version, tag_dt in release_tags:
            tag_date = tag_dt.date()
            delta = abs((tag_date - slot).days)
            if delta <= ESR_TAG_WINDOW_DAYS:
                if best_delta is None or delta < best_delta:
                    best_version = version
                    best_tag_date = tag_date
                    best_delta = delta
 
        if best_version:
            eol_date = add_months(best_tag_date, ESR_SUPPORT_MONTHS)
            esrs.append({
                "version": best_version,
                "released": best_tag_date.isoformat(),
                "eol": eol_date.isoformat(),
                "_version_tuple": tuple(int(x) for x in best_version.split(".")),
                "_released_date": best_tag_date,
                "_eol_date": eol_date,
            })
        else:
            print(f"  WARNING: no release tag found within ±{ESR_TAG_WINDOW_DAYS} days of computed ESR slot {slot} — skipping slot")
 
        slot = add_months(slot, ESR_INTERVAL_MONTHS)
 
    return sorted(esrs, key=lambda e: e["_version_tuple"])
 
 
def find_governing_esr(ship_version: str, esrs: list[dict]) -> dict | None:
    """
    Return the most recent ESR whose version is <= ship_version.
    e.g. ship_version "10.12" → governs under ESR "10.11"
         ship_version "11.7"  → governs under ESR "11.7"
         ship_version "10.5"  → None (predates detected ESRs)
    """
    ship_tuple = tuple(int(x) for x in ship_version.split("."))
    governing = None
    for esr in esrs:
        if esr["_version_tuple"] <= ship_tuple:
            governing = esr
    return governing
 
 
# ---------------------------------------------------------------------------
# 5. Jira helpers
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
    """Return existing open ticket key for this flag, or None."""
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
    return issues[0]["key"] if issues else None
 
 
def create_jira_ticket(entry: dict, project_key: str, auth: str, base_url: str) -> str:
    """Create a Jira task for a stale flag and return the issue key."""
    flag = entry["flag"]
    ship_version = entry["ship_version"]
    esr = entry["esr"]
    removal_comment = entry["removal_comment"]
 
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
                        f" first shipped as enabled in v{ship_version}. "
                        f"Its governing ESR (v{esr['version']}) reached end-of-life on {esr['eol']} "
                        f"and is now eligible for removal."
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
                            "url": f"https://github.com/mattermost/mattermost/blob/master/{FLAG_FILE_REL}"
                        },
                    },
                ],
            },
            *(
                [{
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "⚠️ A "},
                        {"type": "text", "text": "FEATURE_FLAG_REMOVAL", "marks": [{"type": "code"}]},
                        {"type": "text", "text": " comment is already present in the source — this is high priority."},
                    ],
                }]
                if removal_comment else []
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
            "summary": f"Remove feature flag `{flag}` (shipped in v{ship_version}, ESR v{esr['version']} EOL)",
            "issuetype": {"name": "Task"},
            "description": description_adf,
            "labels": [JIRA_LABEL],
            **({"priority": {"name": "High"}} if removal_comment else {}),
        }
    }
 
    result = jira_request("POST", "/issue", auth, base_url, payload)
    return result["key"]
 
 
# ---------------------------------------------------------------------------
# 6. Main
# ---------------------------------------------------------------------------
 
def main():
    parser = argparse.ArgumentParser(description="Feature flag monthly audit")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without creating Jira tickets",
    )
    args = parser.parse_args()

    jira_base_url = os.environ.get("JIRA_BASE_URL", "https://mattermost.atlassian.net")
    project_key = os.environ.get("JIRA_PROJECT_KEY", "MM")

    if args.dry_run:
        print("DRY RUN — no Jira tickets will be created.")

    jira_email = os.environ.get("JIRA_USER_EMAIL")
    jira_token = os.environ.get("JIRA_API_TOKEN")
    if not all([jira_email, jira_token]):
        print("ERROR: JIRA_USER_EMAIL and JIRA_API_TOKEN must be set.")
        sys.exit(1)
    auth = jira_auth_header(jira_email, jira_token)

    today = date.today()
 
    print(f"Parsing {FLAG_FILE}...")
    enabled_flags = [f for f in get_enabled_flags(FLAG_FILE) if not f.startswith("Test")]
    print(f"Enabled flags to check: {enabled_flags}")
 
    print("\nLoading git history and release tags...")
    commits = git_log_patches(FLAG_FILE)
    release_tags = get_release_tags()
    print(f"Loaded {len(commits)} commits, {len(release_tags)} vX.Y.0 release tags")
 
    print("\nDetecting ESRs from fixed schedule...")
    esrs = detect_esrs(release_tags)
    for esr in esrs:
        status = "EOL" if esr["_eol_date"] <= today else "active"
        print(f"  ESR v{esr['version']}: released {esr['released']}, EOL {esr['eol']} [{status}]")
 
    with open(FLAG_FILE) as f:
        source = f.read()
 
    eligible = []
    skipped = []
 
    for flag in enabled_flags:
        enable_date = find_flag_enable_date(flag, commits)
        if enable_date is None:
            print(f"  {flag}: no enable date found — skipping")
            skipped.append((flag, "no enable date in git history"))
            continue
 
        ship_version = find_ship_version(enable_date, release_tags)
        if ship_version is None:
            print(f"  {flag}: no release tag after enable date — not yet shipped, skipping")
            skipped.append((flag, "no release tag found after enable date"))
            continue
 
        esr = find_governing_esr(ship_version, esrs)
        if esr is None:
            print(f"  {flag}: ship version v{ship_version} predates detected ESRs — skipping")
            skipped.append((flag, f"ship version v{ship_version} predates detected ESRs"))
            continue
 
        if esr["_eol_date"] > today:
            print(f"  {flag}: shipped in v{ship_version}, ESR v{esr['version']} EOL is {esr['eol']} — not yet eligible")
            continue
 
        removal_comment = bool(re.search(
            rf"FEATURE_FLAG_REMOVAL[^\n]*\b{re.escape(flag)}\b",
            source,
        ))
        print(f"  {flag}: shipped in v{ship_version}, ESR v{esr['version']} EOL was {esr['eol']} — ELIGIBLE")
        eligible.append({
            "flag": flag,
            "ship_version": ship_version,
            "esr": esr,
            "removal_comment": removal_comment,
        })
 
    print(f"\n{len(eligible)} eligible flag(s), {len(skipped)} skipped")
    if skipped:
        print("\nSkipped (manual review recommended):")
        for flag, reason in skipped:
            print(f"  {flag}: {reason}")
 
    if not eligible:
        print("\nNothing to do.")
        return
 
    created = []
    deduped = []
 
    for entry in eligible:
        flag = entry["flag"]
        existing = find_open_ticket(flag, project_key, auth, jira_base_url)
        if existing:
            print(f"  {flag}: open ticket already exists ({existing}) — skipping")
            deduped.append((flag, existing))
        elif args.dry_run:
            print(f"  {flag}: would create Jira ticket (dry run)")
            created.append((flag, "<dry-run>"))
        else:
            key = create_jira_ticket(entry, project_key, auth, jira_base_url)
            print(f"  {flag}: created {key} — {jira_base_url}/browse/{key}")
            created.append((flag, key))
 
    print(f"\nSummary: {len(created)} ticket(s) created, {len(deduped)} already existed.")
    for flag, key in created:
        print(f"  Created:  {key}  ({flag})")
    for flag, key in deduped:
        print(f"  Existing: {key}  ({flag})")
 
 
if __name__ == "__main__":
    main()
