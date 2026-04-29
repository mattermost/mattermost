#!/usr/bin/env python3
"""
.github/scripts/check_config_changes_ci.py
 
CI script that detects notable changes across several Mattermost source files
and appends structured release-note entries to the PR description.
 
Checkers
────────
1. config.go          — exported struct field additions/removals
2. api4/              — API endpoint additions/removals (Handle() calls)
3. audit_events.go    — AuditEvent* constant additions/removals
4. Dockerfile.buildenv — Go (base-image) version changes
 
All inputs come from environment variables set by the GitHub Actions workflow:
  GITHUB_TOKEN  — built-in Actions token  (pull-requests: write scope)
  PR_NUMBER     — pull request number
  BASE_SHA      — base commit SHA
  HEAD_SHA      — head commit SHA
  REPO          — owner/repo  (e.g. mattermost/mattermost)
"""
 
import os
import re
import sys
import subprocess
import requests
from dataclasses import dataclass, field
from typing import Optional
 
# ── Environment ────────────────────────────────────────────────────────────────
 
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
PR_NUMBER    = int(os.environ["PR_NUMBER"])
BASE_SHA     = os.environ["BASE_SHA"]
HEAD_SHA     = os.environ["HEAD_SHA"]
REPO         = os.environ.get("REPO", "mattermost/mattermost")
 
BASE_URL = "https://api.github.com"
HEADERS  = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept":        "application/vnd.github.v3+json",
}
 
# Paths watched by this script (must align with `paths:` in the workflow YAML)
WATCHED_PATHS = [
    "server/public/model/config.go",
    "server/channels/api4/",
    "server/public/model/audit_events.go",
    "server/build/Dockerfile.buildenv",
]
 
 
# ── Data types ─────────────────────────────────────────────────────────────────
 
@dataclass
class CheckResult:
    """Holds the findings from one checker."""
    label:     str                    # Section heading, e.g. "`config.json` Changes"
    additions: list  = field(default_factory=list)
    removals:  list  = field(default_factory=list)
    changes:   list  = field(default_factory=list)  # for free-form entries (version bumps)
 
    def has_findings(self) -> bool:
        return bool(self.additions or self.removals or self.changes)
 
    def to_markdown(self) -> str:
        lines = [f"### {self.label}"]
        if self.additions:
            lines.append("**Added:** "   + ", ".join(self.additions))
        if self.removals:
            lines.append("**Removed:** " + ", ".join(self.removals))
        for change in self.changes:
            lines.append(change)
        return "\n".join(lines)
 
 
# ── Diff helpers ───────────────────────────────────────────────────────────────
 
def get_full_patch() -> str:
    """Return unified diff for all watched paths between base and head."""
    result = subprocess.run(
        ["git", "diff", f"{BASE_SHA}...{HEAD_SHA}", "--"] + WATCHED_PATHS,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout
 
 
def split_patch_by_file(full_patch: str) -> dict[str, str]:
    """
    Split a multi-file unified diff into {filename: patch} mapping.
    Filenames are the b-side (new) path, stripped of the 'b/' prefix.
    """
    patches: dict[str, str] = {}
    current_file: Optional[str] = None
    current_lines: list[str] = []
 
    for line in full_patch.splitlines(keepends=True):
        if line.startswith("diff --git "):
            if current_file:
                patches[current_file] = "".join(current_lines)
            current_lines = [line]
            # Extract filename from "diff --git a/foo b/foo"
            m = re.search(r" b/(.+)$", line.rstrip())
            current_file = m.group(1) if m else None
        else:
            current_lines.append(line)
 
    if current_file:
        patches[current_file] = "".join(current_lines)
 
    return patches
 
 
def lines_by_sign(patch: str) -> tuple[list[str], list[str]]:
    """Return (added_lines, removed_lines) from a patch, skipping file headers."""
    added, removed = [], []
    for line in patch.splitlines():
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            added.append(line[1:])
        elif line.startswith("-"):
            removed.append(line[1:])
    return added, removed
 
 
# ── Checker 1 — config.go ──────────────────────────────────────────────────────
 
def check_config(patches: dict[str, str]) -> CheckResult:
    """
    Detect exported Go struct field additions/removals in config.go.
 
    Deduplication is keyed by StructName.FieldName so that a field with the
    same name in two different structs (one added, one removed) is not
    incorrectly cancelled out.
    """
    result = CheckResult(label="`config.json` Field Changes")
    patch = patches.get("server/public/model/config.go", "")
    if not patch:
        return result
 
    struct_re = re.compile(r"^\s*type\s+(\w+)\s+struct\s*\{")
    field_re  = re.compile(r"^\t([A-Z][A-Za-z0-9_]*)\s+\S")
 
    additions: list[str] = []   # "StructName.FieldName"
    removals:  list[str] = []
    current_struct = "Unknown"
 
    for line in patch.splitlines():
        # Skip diff file-header lines
        if line.startswith(("+++", "---", "diff ", "@@")):
            continue
 
        # Strip the diff sign to get the raw Go source line
        if line.startswith(("+", "-", " ")):
            content = line[1:]
        else:
            continue
 
        # Track the enclosing struct from ALL lines (context, added, removed)
        sm = struct_re.match(content)
        if sm:
            current_struct = sm.group(1)
 
        # Record field changes only from added/removed lines
        fm = field_re.match(content)
        if fm:
            qualified = f"{current_struct}.{fm.group(1)}"
            if line.startswith("+"):
                additions.append(qualified)
            elif line.startswith("-"):
                removals.append(qualified)
 
    # Deduplicate: cancel out only when the same StructName.FieldName appears
    # on both sides (e.g. a field moved/reordered within the file).
    seen_both = set(additions) & set(removals)
    additions = [x for x in dict.fromkeys(additions) if x not in seen_both]
    removals  = [x for x in dict.fromkeys(removals)  if x not in seen_both]
 
    result.additions = [f"`{x}`" for x in additions]
    result.removals  = [f"`{x}`" for x in removals]
    return result
 
 
# ── Checker 2 — api4/ ─────────────────────────────────────────────────────────
 
# Matches the common single-line pattern:
#   .Handle("/path", api.SomeWrapper(handlerFunc)).Methods(http.MethodGet)
# Group 1: path   Group 2: handler func   Group 3: raw Methods(...) content
_HANDLE_RE = re.compile(
    r'\.Handle\("([^"]*)"'          # path
    r',\s*\w+\.\w+\((\w+)\)\)'     # wrapper(handlerFunc))
    r'\.Methods\(([^)]+)\)',        # .Methods(one or more methods)
)
 
# Strips the "http.Method" prefix from a method token, e.g. "http.MethodGet" → "GET"
_METHOD_PREFIX = re.compile(r'(?:http\.Method)?(\w+)')
 
 
def _parse_methods(raw: str) -> list[str]:
    """Return a list of HTTP method strings from the raw .Methods(...) content."""
    return [
        m.group(1).upper()
        for token in raw.split(",")
        if (m := _METHOD_PREFIX.search(token.strip()))
    ]
 
 
def _format_endpoint(path: str, handler: str, method: str) -> str:
    return f"`{method.upper()} {path or '/'}` (`{handler}`)"
 
 
def _sign_runs(patch: str, sign: str) -> list[str]:
    """
    Return a list of joined strings, where each string is a run of consecutive
    lines starting with `sign`.  Joining handles multi-line Handle() calls so
    the regex can match even when the call is split across several diff lines.
    """
    runs: list[str] = []
    current: list[str] = []
    for line in patch.splitlines():
        if line.startswith(sign) and not line.startswith(sign * 3):
            current.append(line[1:].strip())
        else:
            if current:
                runs.append(" ".join(current))
                current = []
    if current:
        runs.append(" ".join(current))
    return runs
 
 
def _extract_endpoints(patch: str, sign: str) -> list[str]:
    """Extract all Handle() endpoint registrations from diff lines of `sign`."""
    endpoints: list[str] = []
    for run in _sign_runs(patch, sign):
        for m in _HANDLE_RE.finditer(run):
            path, handler, methods_raw = m.group(1), m.group(2), m.group(3)
            for method in _parse_methods(methods_raw):
                endpoints.append(_format_endpoint(path, handler, method))
    return endpoints
 
 
def check_api(patches: dict[str, str]) -> CheckResult:
    """Detect API endpoint additions/removals in the api4/ directory."""
    result = CheckResult(label="API Changes (`api4`)")
 
    api4_patches = {
        fname: patch
        for fname, patch in patches.items()
        if fname.startswith("server/channels/api4/") and fname.endswith(".go")
    }
    if not api4_patches:
        return result
 
    added_eps:   list[str] = []
    removed_eps: list[str] = []
 
    for fname, patch in api4_patches.items():
        added_eps.extend(_extract_endpoints(patch, "+"))
        removed_eps.extend(_extract_endpoints(patch, "-"))
 
    # New files in api4/ suggest a new route group was added
    new_files = [
        fname for fname, patch in api4_patches.items()
        if "new file mode" in patch
    ]
    deleted_files = [
        fname for fname, patch in api4_patches.items()
        if "deleted file mode" in patch
    ]
    for fname in new_files:
        short = fname.split("/")[-1]
        result.changes.append(f"🆕 New API file: `{short}`")
    for fname in deleted_files:
        short = fname.split("/")[-1]
        result.changes.append(f"🗑️  Removed API file: `{short}`")
 
    result.additions = list(dict.fromkeys(added_eps))
    result.removals  = list(dict.fromkeys(removed_eps))
    return result
 
 
# ── Checker 3 — audit_events.go ───────────────────────────────────────────────
 
def check_audit_events(patches: dict[str, str]) -> CheckResult:
    """Detect AuditEvent* constant additions/removals."""
    result = CheckResult(label="Audit Log Event Changes")
    patch = patches.get("server/public/model/audit_events.go", "")
    if not patch:
        return result
 
    # Matches:  AuditEventSomeThing = "someThing"
    const_re = re.compile(r"^\t(AuditEvent\w+)\s*=")
    added, removed = lines_by_sign(patch)
 
    result.additions = [
        f"`{m.group(1)}`" for line in added
        if (m := const_re.match(line))
    ]
    result.removals = [
        f"`{m.group(1)}`" for line in removed
        if (m := const_re.match(line))
    ]
    seen_both = set(result.additions) & set(result.removals)
    result.additions = [x for x in dict.fromkeys(result.additions) if x not in seen_both]
    result.removals  = [x for x in dict.fromkeys(result.removals)  if x not in seen_both]
    return result
 
 
# ── Checker 4 — Dockerfile.buildenv (Go version) ──────────────────────────────
 
# The Go version lives in the base image tag, e.g.:
#   FROM mattermost/golang-bullseye:1.25.8@sha256:...
_IMAGE_VER_RE = re.compile(r"^FROM \S+:([0-9]+\.[0-9]+(?:\.[0-9]+)?)")
 
 
def check_go_version(patches: dict[str, str]) -> CheckResult:
    """Detect Go runtime version changes via the base image tag."""
    result = CheckResult(label="Go Runtime Version")
    patch = patches.get("server/build/Dockerfile.buildenv", "")
    if not patch:
        return result
 
    added, removed = lines_by_sign(patch)
    old_ver = next(
        (m.group(1) for line in removed if (m := _IMAGE_VER_RE.match(line.strip()))),
        None,
    )
    new_ver = next(
        (m.group(1) for line in added if (m := _IMAGE_VER_RE.match(line.strip()))),
        None,
    )
 
    if old_ver and new_ver and old_ver != new_ver:
        result.changes.append(
            f"Go updated: `{old_ver}` → `{new_ver}`"
        )
    elif new_ver and not old_ver:
        result.additions.append(f"`{new_ver}`")
    return result
 
 
# ── PR description helpers ─────────────────────────────────────────────────────
 
# Matches lines that were auto-generated by this script so they can be stripped
# before re-injecting a fresh set on subsequent commits.
_AUTO_LINE_RE = re.compile(
    r"^(Added|Removed) `[^`]+`.*(configuration setting|API endpoint|audit log event)\."
    r"|^Go runtime updated from \S+ to \S+\."
    r"|^🆕 New API file:"
    r"|^🗑️  Removed API file:"
)
 
 
def _format_lines(result: CheckResult) -> list[str]:
    """Produce natural-language lines for one checker result."""
    lines = []
 
    if "`config.json`" in result.label:
        for item in result.additions:
            lines.append(f"Added {item} configuration setting.")
        for item in result.removals:
            lines.append(f"Removed {item} configuration setting.")
 
    elif "API Changes" in result.label:
        for item in result.additions:
            lines.append(f"Added {item} API endpoint.")
        for item in result.removals:
            lines.append(f"Removed {item} API endpoint.")
        lines.extend(result.changes)  # new/deleted file entries
 
    elif "Audit" in result.label:
        for item in result.additions:
            lines.append(f"Added {item} audit log event.")
        for item in result.removals:
            lines.append(f"Removed {item} audit log event.")
 
    elif "Go Runtime" in result.label:
        for c in result.changes:
            # c arrives as "Go updated: `1.21` → `1.22`" — rewrite it
            m = re.search(r"`([^`]+)`\s*→\s*`([^`]+)`", c)
            if m:
                lines.append(f"Go runtime updated from {m.group(1)} to {m.group(2)}.")
            else:
                lines.append(c)
 
    return lines
 
 
def build_pr_note(results: list[CheckResult]) -> str:
    """Assemble all findings into a clean plain-text block."""
    lines = []
    for r in results:
        if r.has_findings():
            lines.extend(_format_lines(r))
    return "\n".join(lines)
 
 
def strip_old_note(body: str) -> str:
    """
    Remove previously auto-generated lines from inside the ```release-note block.
    Lines are identified by pattern rather than markers, so no visible annotations
    need to appear in the PR description.
    """
    def _clean_fence(m: re.Match) -> str:
        open_tag, content, close_tag = m.group(1), m.group(2), m.group(3)
        cleaned_lines = [
            line for line in content.split("\n")
            if not _AUTO_LINE_RE.match(line.strip())
        ]
        return open_tag + "\n".join(cleaned_lines) + close_tag
 
    return re.sub(
        r"(```release-note)(.*?)(```)",
        _clean_fence,
        body or "",
        flags=re.DOTALL | re.IGNORECASE,
    ).rstrip()
 
 
def inject_note(body: str, note: str) -> str:
    """
    Insert `note` using this priority order:
 
    1. INSIDE the ```release-note block, before its closing ```
       (Mattermost convention — keeps everything in one place for reviewers)
    2. After a recognised release-notes section header (## Release Notes, etc.)
    3. Fallback: append a new ## Release Notes section at the end
    """
    body = strip_old_note(body)
    if not note:
        return body
 
    # 1. Mattermost-style ```release-note ... ``` block — inject INSIDE the fence
    release_note_block = re.search(
        r"(```release-note)(.*?)(```)",
        body,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if release_note_block:
        closing_start = release_note_block.start(3)
        return body[:closing_start] + note + "\n" + body[closing_start:]
 
    # 2. Markdown section headers
    for header in ["## Release Notes", "## Changelog", "## What Changed", "## What's Changed"]:
        if header.lower() in body.lower():
            idx = body.lower().index(header.lower()) + len(header)
            return body[:idx] + "\n\n" + note + body[idx:]
 
    # 3. Fallback — append
    return body + "\n\n## Release Notes\n\n" + note
 
 
# ── GitHub API ─────────────────────────────────────────────────────────────────
 
def get_pr_body() -> str:
    r = requests.get(f"{BASE_URL}/repos/{REPO}/pulls/{PR_NUMBER}", headers=HEADERS)
    r.raise_for_status()
    return r.json().get("body") or ""
 
 
def update_pr_body(new_body: str) -> None:
    r = requests.patch(
        f"{BASE_URL}/repos/{REPO}/pulls/{PR_NUMBER}",
        headers=HEADERS,
        json={"body": new_body},
    )
    r.raise_for_status()
 
 
# ── Main ───────────────────────────────────────────────────────────────────────
 
def main():
    print(f"📋 PR #{PR_NUMBER} | base {BASE_SHA[:8]} → head {HEAD_SHA[:8]}")
    print("🔍 Collecting diffs …")
 
    full_patch = get_full_patch()
    if not full_patch.strip():
        print("ℹ️  No changes in watched paths. Nothing to do.")
        return
 
    patches = split_patch_by_file(full_patch)
    print(f"   {len(patches)} file(s) changed in watched paths.\n")
 
    # Run all checkers
    checkers = [
        check_config,
        check_api,
        check_audit_events,
        check_go_version,
    ]
    results: list[CheckResult] = [fn(patches) for fn in checkers]
 
    for r in results:
        if r.has_findings():
            print(f"  ✅ {r.label}")
            if r.additions:
                print(f"     Added:   {', '.join(r.additions)}")
            if r.removals:
                print(f"     Removed: {', '.join(r.removals)}")
            for c in r.changes:
                print(f"     {c}")
        else:
            print(f"  –  {r.label}: no changes")
 
    note = build_pr_note(results)
    if not note:
        print("\nℹ️  No notable changes found across all checkers.")
        return
 
    print("\n🔄 Fetching PR description …")
    body = get_pr_body()
    new_body = inject_note(body, note)
    update_pr_body(new_body)
    print(f"✅ PR #{PR_NUMBER} description updated.")
 
 
if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"❌ git diff failed:\n{e.stderr}", file=sys.stderr)
        sys.exit(1)
    except requests.HTTPError as e:
        # Avoid dumping the full response body (can be large / noisy).
        # status + reason gives enough context for debugging (e.g. "403 Forbidden").
        reason = e.response.reason or "unknown"
        print(f"❌ GitHub API error: {e.response.status_code} {reason}", file=sys.stderr)
        sys.exit(1)
