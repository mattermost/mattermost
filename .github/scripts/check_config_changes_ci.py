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
 
# Timeout for all GitHub API requests: (connect seconds, read seconds).
# Prevents the workflow from hanging indefinitely on a slow/unresponsive API.
_TIMEOUT = (5, 30)
 
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
 
 
def file_at(ref: str, path: str) -> str:
    """Return the full contents of `path` at git ref `ref`, or '' if absent."""
    try:
        return subprocess.run(
            ["git", "show", f"{ref}:{path}"],
            capture_output=True, text=True, check=True,
        ).stdout
    except subprocess.CalledProcessError:
        return ""
 
 
def _compute_merge_base() -> str:
    """Resolve the merge-base of BASE_SHA and HEAD_SHA.
 
    Per-checker comparisons must use this rather than BASE_SHA. BASE_SHA is the
    tip of the target branch at PR-event time; if that branch advances on a
    watched file after the PR diverges, comparing branch-tip vs target-tip
    would attribute those upstream edits to this PR (false add/remove).
    `git diff A...B` already does this implicitly; the per-file snapshots must
    match.
    """
    return subprocess.run(
        ["git", "merge-base", BASE_SHA, HEAD_SHA],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
 
 
MERGE_BASE = _compute_merge_base()
 
 
# ── Checker 1 — config.go ──────────────────────────────────────────────────────
 
_CONFIG_PATH     = "server/public/model/config.go"
_STRUCT_DECL_RE  = re.compile(r"^type\s+(\w+)\s+struct\s*\{")
_FIELD_LINE_RE   = re.compile(r"^\t([A-Z][A-Za-z0-9_]*)\s+\S")
 
 
def _scan_struct_fields(src: str) -> set[tuple[str, str]]:
    """
    Walk Go source and return {(StructName, FieldName)} for every exported
    field in every struct.
 
    Uses a brace-depth stack so nested anonymous structs, interface bodies,
    and function literals don't corrupt the enclosing struct context.
    Named type declarations cannot be nested in Go, so the struct_stack
    never grows beyond one entry for named structs.
    """
    fields: set[tuple[str, str]] = set()
    # Each entry: (struct_name, brace_depth_when_opened)
    struct_stack: list[tuple[str, int]] = []
    depth = 0
 
    for line in src.splitlines():
        sm = _STRUCT_DECL_RE.match(line)
        if sm:
            # Record depth *before* counting this line's braces
            struct_stack.append((sm.group(1), depth))
 
        depth += line.count("{") - line.count("}")
 
        # Pop any structs whose closing brace has been passed
        while struct_stack and depth <= struct_stack[-1][1]:
            struct_stack.pop()
 
        # Record fields only when we're directly inside the named struct body.
        # The depth check (depth == struct_stack[0][1] + 1) ensures that fields
        # inside nested anonymous struct { ... } blocks are not incorrectly
        # attributed to the outer named struct.
        if len(struct_stack) == 1 and depth == struct_stack[0][1] + 1:
            fm = _FIELD_LINE_RE.match(line)
            if fm:
                fields.add((struct_stack[0][0], fm.group(1)))
 
    return fields
 
 
def check_config(patches: dict[str, str]) -> CheckResult:
    """
    Detect exported Go struct field additions/removals in config.go.
 
    Compares full-file snapshots at MERGE_BASE and HEAD_SHA so that fields
    are always attributed to the correct struct regardless of which diff
    hunks are present.
    """
    result = CheckResult(label="`config.json` Field Changes")
    if _CONFIG_PATH not in patches:
        return result
 
    base_fields = _scan_struct_fields(file_at(MERGE_BASE, _CONFIG_PATH))
    head_fields = _scan_struct_fields(file_at(HEAD_SHA, _CONFIG_PATH))
 
    added   = head_fields - base_fields
    removed = base_fields - head_fields
 
    result.additions = sorted(f"``{s}.{f}``" for s, f in added)
    result.removals  = sorted(f"``{s}.{f}``" for s, f in removed)
    return result
 
 
# ── Checker 2 — api4/ ─────────────────────────────────────────────────────────
 
# Matches Handle() route registrations after whitespace-collapsing the source.
# Whitespace collapse makes multi-line declarations single-searchable.
# Group 1: path   Group 2: handler func   Group 3: raw Methods(...) content
#
# The wrapper pattern uses [^)]* so it tolerates any middleware arguments
# (e.g. r.APIHandler(...), r.ApiSessionRequired(..., isLocal=true), etc.)
# without having to enumerate every possible wrapper signature.
_HANDLE_RE = re.compile(
    r'\.Handle\("([^"]*)"'          # path
    r',\s*[^)]*\((\w+)\)\)'        # wrapper(...handlerFunc))
    r'\.Methods\(([^)]+)\)',        # .Methods(one or more methods)
)
 
_METHOD_RE    = re.compile(r'(?:http\.Method)?(\w+)')
_HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
 
 
def _parse_methods(raw: str) -> list[str]:
    """Split raw Methods(...) content into individual uppercase HTTP verbs.
 
    Filters against the set of known HTTP methods so that incidental
    identifiers (handler names, constants, etc.) that happen to appear
    inside Methods(...) don't produce spurious results.
    """
    return [
        verb
        for token in raw.split(",")
        if (m := _METHOD_RE.search(token.strip()))
        and (verb := m.group(1).upper()) in _HTTP_METHODS
    ]
 
 
def _format_endpoint(path: str, handler: str, method: str) -> str:
    return f"`{method.upper()} {path or '/'}` (`{handler}`)"
 
 
def _parse_endpoints(src: str) -> set[tuple[str, str, str]]:
    """
    Parse Handle() registrations from a Go source file.
 
    Whitespace-collapses the entire file first so multi-line declarations
    (e.g. the 18 in group.go) are matched as a single token sequence.
    Returns {(path, handler, method)} tuples.
    """
    blob = " ".join(src.split())
    endpoints: set[tuple[str, str, str]] = set()
    for m in _HANDLE_RE.finditer(blob):
        path, handler, methods_raw = m.group(1), m.group(2), m.group(3)
        for method in _parse_methods(methods_raw):
            endpoints.add((path or "/", handler, method))
    return endpoints
 
 
def check_api(patches: dict[str, str]) -> CheckResult:
    """
    Detect API endpoint additions/removals in the api4/ directory.
 
    Compares full-file snapshots at MERGE_BASE and HEAD_SHA via set arithmetic,
    so multi-line and multi-method registrations are handled correctly.
    """
    result = CheckResult(label="API Changes (`api4`)")
 
    api4_patches = {
        fname: patch
        for fname, patch in patches.items()
        if fname.startswith("server/channels/api4/") and fname.endswith(".go")
    }
    if not api4_patches:
        return result
 
    added_eps:   set[tuple[str, str, str]] = set()
    removed_eps: set[tuple[str, str, str]] = set()
 
    for fname, patch in api4_patches.items():
        base_eps = _parse_endpoints(file_at(MERGE_BASE, fname))
        head_eps = _parse_endpoints(file_at(HEAD_SHA, fname))
        added_eps   |= head_eps - base_eps
        removed_eps |= base_eps - head_eps
 
        # Anchor the check to avoid false positives from unrelated source text
        if re.search(r"^new file mode \d+", patch, re.MULTILINE):
            result.changes.append(f"🆕 New API file: `{fname.split('/')[-1]}`")
        if re.search(r"^deleted file mode \d+", patch, re.MULTILINE):
            result.changes.append(f"🗑️  Removed API file: `{fname.split('/')[-1]}`")
 
    result.additions = sorted(_format_endpoint(p, h, m) for p, h, m in added_eps)
    result.removals  = sorted(_format_endpoint(p, h, m) for p, h, m in removed_eps)
    return result
 
 
# ── Checker 3 — audit_events.go ───────────────────────────────────────────────
 
_AUDIT_EVENT_PATH = "server/public/model/audit_events.go"
_AUDIT_CONST_RE   = re.compile(r"^\t(AuditEvent\w+)\s*=")
 
 
def _parse_audit_events(src: str) -> set[str]:
    return {m.group(1) for line in src.splitlines() if (m := _AUDIT_CONST_RE.match(line))}
 
 
def check_audit_events(patches: dict[str, str]) -> CheckResult:
    """
    Detect AuditEvent* constant additions/removals.
 
    Uses full-file snapshots at MERGE_BASE/HEAD_SHA so reorderings and
    cross-constant name collisions don't produce false results.
    """
    result = CheckResult(label="Audit Log Event Changes")
    if _AUDIT_EVENT_PATH not in patches:
        return result
 
    base_events = _parse_audit_events(file_at(MERGE_BASE, _AUDIT_EVENT_PATH))
    head_events = _parse_audit_events(file_at(HEAD_SHA, _AUDIT_EVENT_PATH))
 
    result.additions = sorted(f"``{e}``" for e in head_events - base_events)
    result.removals  = sorted(f"``{e}``" for e in base_events - head_events)
    return result
 
 
# ── Checker 4 — Dockerfile.buildenv (Go version) ──────────────────────────────
 
# The Go version lives in the base image tag, e.g.:
#   FROM mattermost/golang-bullseye:1.25.8@sha256:...
_DOCKERFILE_PATH = "server/build/Dockerfile.buildenv"
_IMAGE_VER_RE    = re.compile(r"^FROM \S+:([0-9]+\.[0-9]+(?:\.[0-9]+)?)")
 
 
def _parse_go_version(src: str) -> Optional[str]:
    for line in src.splitlines():
        m = _IMAGE_VER_RE.match(line.strip())
        if m:
            return m.group(1)
    return None
 
 
def check_go_version(patches: dict[str, str]) -> CheckResult:
    """
    Detect Go runtime version changes via the base image tag.
 
    Uses full-file snapshots so the version is read from the actual file
    state at each ref rather than reconstructed from patch lines.
    """
    result = CheckResult(label="Go Runtime Version")
    if _DOCKERFILE_PATH not in patches:
        return result
 
    old_ver = _parse_go_version(file_at(MERGE_BASE, _DOCKERFILE_PATH))
    new_ver = _parse_go_version(file_at(HEAD_SHA, _DOCKERFILE_PATH))
 
    if old_ver and new_ver and old_ver != new_ver:
        result.changes.append(f"Go updated: ``{old_ver}`` → ``{new_ver}``")
    elif new_ver and not old_ver:
        result.additions.append(f"``{new_ver}``")
    return result
 
 
# ── PR description helpers ─────────────────────────────────────────────────────
 
# Matches lines that were auto-generated by this script so they can be stripped
# before re-injecting a fresh set on subsequent commits.
# Handles both single-backtick (older runs) and double-backtick (current) format.
_AUTO_LINE_RE = re.compile(
    r"^(Added|Removed) `{1,2}[^`]+`{1,2}.*(configuration setting|API endpoint|audit log event)\."
    r"|^Go runtime updated from \S+ to \S+\."
    r"|^Go runtime set to `{1,2}[^`]+`{1,2}\."
    r"|^🆕 New API file:"
    r"|^🗑️  Removed API file:"
)
 
# Matches placeholder content inside a release-note fence that means "nothing
# to report yet" (e.g. NONE, N/A, ---).  When detected, we replace the
# placeholder rather than appending alongside it.
_PLACEHOLDER_RE = re.compile(r"^\s*(?:NONE|N/?A|-+)\s*$", re.IGNORECASE)
 
 
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
        for item in result.additions:
            # item is e.g. "``1.22``"
            lines.append(f"Go runtime set to {item}.")
        for c in result.changes:
            # c arrives as "Go updated: ``1.21`` → ``1.22``" — rewrite it
            m = re.search(r"``([^`]+)``\s*→\s*``([^`]+)``", c)
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
    Remove previously auto-generated lines from the PR description.
 
    Primary path  — lines inside the ```release-note ... ``` fence.
    Fallback path — auto-generated lines that were appended outside any fence
                    (e.g. via the ## Release Notes section on earlier runs).
 
    Lines are identified by pattern rather than visible markers, so the PR
    description stays clean for human readers.
    """
    def _clean_fence(m: re.Match) -> str:
        open_tag, content, close_tag = m.group(1), m.group(2), m.group(3)
        cleaned_lines = [
            line for line in content.split("\n")
            if not _AUTO_LINE_RE.match(line.strip())
        ]
        return open_tag + "\n".join(cleaned_lines) + close_tag
 
    cleaned = re.sub(
        r"(```release-note)(.*?)(```)",
        _clean_fence,
        body or "",
        flags=re.DOTALL | re.IGNORECASE,
    )
 
    # Fallback: strip any auto-generated lines that appear outside a fence
    # (written by an older version of this script or via the header-inject path).
    cleaned_lines = [
        line for line in cleaned.splitlines()
        if not _AUTO_LINE_RE.match(line.strip())
    ]
    return "\n".join(cleaned_lines).rstrip()
 
 
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
 
    # 1. Mattermost-style ```release-note ... ``` block — inject INSIDE the fence.
    #    If the fence currently contains only a placeholder (NONE / N/A / ---),
    #    replace the placeholder rather than appending alongside it.
    release_note_block = re.search(
        r"(```release-note)(.*?)(```)",
        body,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if release_note_block:
        open_tag   = release_note_block.group(1)
        content    = release_note_block.group(2)   # everything between the fences
        close_tag  = release_note_block.group(3)
        block_start = release_note_block.start()
        block_end   = release_note_block.end()
 
        # Strip leading/trailing newlines inside the fence for comparison
        inner = content.strip()
        if _PLACEHOLDER_RE.match(inner):
            # Replace the entire fence with a fresh one
            new_block = f"{open_tag}\n{note}\n{close_tag}"
        else:
            # Append before the closing fence
            new_block = open_tag + content + note + "\n" + close_tag
 
        return body[:block_start] + new_block + body[block_end:]
 
    # 2. Markdown section headers
    for header in ["## Release Notes", "## Changelog", "## What Changed", "## What's Changed"]:
        if header.lower() in body.lower():
            idx = body.lower().index(header.lower()) + len(header)
            return body[:idx] + "\n\n" + note + body[idx:]
 
    # 3. Fallback — append
    return body + "\n\n## Release Notes\n\n" + note
 
 
# ── GitHub API ─────────────────────────────────────────────────────────────────
 
def get_pr_body() -> str:
    r = requests.get(
        f"{BASE_URL}/repos/{REPO}/pulls/{PR_NUMBER}",
        headers=HEADERS,
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    return r.json().get("body") or ""
 
 
def update_pr_body(new_body: str) -> None:
    r = requests.patch(
        f"{BASE_URL}/repos/{REPO}/pulls/{PR_NUMBER}",
        headers=HEADERS,
        json={"body": new_body},
        timeout=_TIMEOUT,
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
 
    if new_body == body:
        print("ℹ️  PR description already up to date — no changes needed.")
        return
 
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
