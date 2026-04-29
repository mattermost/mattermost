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


def file_at(ref: str, path: str) -> str:
    """
    Return the contents of `path` at git ref `ref`, or "" if the file does
    not exist at that ref. Used to compare full file states rather than
    pattern-matching against the diff text directly — this avoids losing
    information about context lines and multi-line statements.
    """
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return ""
    return result.stdout


# ── Checker 1 — config.go ──────────────────────────────────────────────────────

_CONFIG_PATH    = "server/public/model/config.go"
_TYPE_STRUCT_RE = re.compile(r"^type\s+(\w+)\s+struct\s*\{")
_FIELD_RE       = re.compile(r"^\t([A-Z][A-Za-z0-9_]*)\s+\S")


def _scan_struct_fields(text: str) -> set[tuple[str, str]]:
    """
    Return {(struct_name, field_name), ...} for every top-level exported
    field in `text`. Uses a brace-depth stack so identically-named fields
    in different structs are kept distinct (avoids the "moved field"
    dedup collapsing unrelated changes).
    """
    fields: set[tuple[str, str]] = set()
    stack: list[tuple[str, int]] = []  # (struct_name, depth_at_declaration)
    depth = 0

    for line in text.splitlines():
        line_start_depth = depth

        m = _TYPE_STRUCT_RE.match(line)
        if m:
            stack.append((m.group(1), line_start_depth))
        elif stack and (fm := _FIELD_RE.match(line)):
            fields.add((stack[-1][0], fm.group(1)))

        depth += line.count("{") - line.count("}")
        while stack and depth <= stack[-1][1]:
            stack.pop()

    return fields


def check_config(patches: dict[str, str]) -> CheckResult:
    """Detect exported Go struct field additions/removals in config.go."""
    result = CheckResult(label="`config.json` Field Changes")
    if _CONFIG_PATH not in patches:
        return result

    before = _scan_struct_fields(file_at(BASE_SHA, _CONFIG_PATH))
    after  = _scan_struct_fields(file_at(HEAD_SHA, _CONFIG_PATH))

    result.additions = [f"`{s}.{n}`" for s, n in sorted(after  - before)]
    result.removals  = [f"`{s}.{n}`" for s, n in sorted(before - after)]
    return result


# ── Checker 2 — api4/ ─────────────────────────────────────────────────────────

# Matches a full route registration, tolerant of whitespace so it works on
# multi-line declarations once the source has been newline-collapsed.
# Groups: (path, handler_name, methods_substring)
_HANDLE_RE = re.compile(
    r'\.Handle\(\s*"([^"]*)"\s*,'                              # path
    r'\s*\w+\.\w+\(\s*(\w+)[^)]*\)\s*\)'                       # wrapper(handler, …))
    r'\s*\.Methods\(\s*((?:(?:http\.Method)?\w+\s*,?\s*)+)\)'  # .Methods(GET[, …])
)

_HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"}


def _format_endpoint(path: str, handler: str, method: str) -> str:
    method = method.upper()
    path   = path or "/"
    return f"`{method} {path}` (`{handler}`)"


def _scan_endpoints(text: str) -> set[str]:
    """Extract every endpoint declared in `text`, regardless of formatting."""
    # Collapse all whitespace so multi-line .Handle(...).Methods(...) chains
    # become single-line strings the regex can match.
    flat = re.sub(r"\s+", " ", text)

    endpoints: set[str] = set()
    for m in _HANDLE_RE.finditer(flat):
        path, handler, methods_str = m.groups()
        for raw in re.findall(r"\w+", methods_str):
            method = raw.removeprefix("Method")
            if method.upper() in _HTTP_METHODS:
                endpoints.add(_format_endpoint(path, handler, method))
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

    added_eps: set[str] = set()
    removed_eps: set[str] = set()

    for fname in api4_patches:
        before = _scan_endpoints(file_at(BASE_SHA, fname))
        after  = _scan_endpoints(file_at(HEAD_SHA, fname))
        added_eps   |= (after  - before)
        removed_eps |= (before - after)

    # New / deleted files in api4/ — anchor checks to the file-mode header
    # lines so stray "new file mode" text inside source can't trigger.
    new_file_re     = re.compile(r"^new file mode \d+",     re.MULTILINE)
    deleted_file_re = re.compile(r"^deleted file mode \d+", re.MULTILINE)
    for fname, patch in api4_patches.items():
        short = fname.split("/")[-1]
        if new_file_re.search(patch):
            result.changes.append(f"🆕 New API file: `{short}`")
        if deleted_file_re.search(patch):
            result.changes.append(f"🗑️  Removed API file: `{short}`")

    result.additions = sorted(added_eps)
    result.removals  = sorted(removed_eps)
    return result


# ── Checker 3 — audit_events.go ───────────────────────────────────────────────

_AUDIT_PATH     = "server/public/model/audit_events.go"
_AUDIT_CONST_RE = re.compile(r"^\t(AuditEvent\w+)\s*=", re.MULTILINE)


def check_audit_events(patches: dict[str, str]) -> CheckResult:
    """Detect AuditEvent* constant additions/removals."""
    result = CheckResult(label="Audit Log Event Changes")
    if _AUDIT_PATH not in patches:
        return result

    before = set(_AUDIT_CONST_RE.findall(file_at(BASE_SHA, _AUDIT_PATH)))
    after  = set(_AUDIT_CONST_RE.findall(file_at(HEAD_SHA, _AUDIT_PATH)))

    result.additions = [f"`{n}`" for n in sorted(after  - before)]
    result.removals  = [f"`{n}`" for n in sorted(before - after)]
    return result


# ── Checker 4 — Dockerfile.buildenv (Go version) ──────────────────────────────

_BUILDENV_PATH = "server/build/Dockerfile.buildenv"

# The Go version lives in the base image tag, e.g.:
#   FROM mattermost/golang-bullseye:1.25.8@sha256:...
_IMAGE_VER_RE = re.compile(r"^FROM \S+:([0-9]+\.[0-9]+(?:\.[0-9]+)?)", re.MULTILINE)


def _extract_go_version(text: str) -> Optional[str]:
    m = _IMAGE_VER_RE.search(text)
    return m.group(1) if m else None


def check_go_version(patches: dict[str, str]) -> CheckResult:
    """Detect Go runtime version changes via the base image tag."""
    result = CheckResult(label="Go Runtime Version")
    if _BUILDENV_PATH not in patches:
        return result

    old_ver = _extract_go_version(file_at(BASE_SHA, _BUILDENV_PATH))
    new_ver = _extract_go_version(file_at(HEAD_SHA, _BUILDENV_PATH))

    if old_ver and new_ver and old_ver != new_ver:
        result.changes.append(f"Go updated: `{old_ver}` → `{new_ver}`")
    elif new_ver and not old_ver:
        result.additions.append(f"`{new_ver}`")
    return result


# ── PR description helpers ─────────────────────────────────────────────────────

MARKER_OPEN  = "<!-- config-change-checker:"
MARKER_CLOSE = "<!-- /config-change-checker -->"


def build_pr_note(results: list[CheckResult]) -> str:
    """Assemble all checker results into a single markdown block."""
    sections = [r.to_markdown() for r in results if r.has_findings()]
    if not sections:
        return ""
    body = "\n\n".join(sections)
    marker = f"{MARKER_OPEN}{HEAD_SHA[:8]}-->"
    return f"{marker}\n{body}\n{MARKER_CLOSE}"


def already_up_to_date(body: str) -> bool:
    return f"{MARKER_OPEN}{HEAD_SHA[:8]}-->" in (body or "")


def strip_old_note(body: str) -> str:
    return re.sub(
        rf"{re.escape(MARKER_OPEN)}.*?{re.escape(MARKER_CLOSE)}",
        "",
        body or "",
        flags=re.DOTALL,
    ).rstrip()


def inject_note(body: str, note: str) -> str:
    """
    Insert `note` into the PR description using this priority order:

    1. After the closing ``` of an existing ```release-note block
       (the Mattermost convention for human-written release notes)
    2. After the first recognised release-notes section header
    3. Append a new ## Release Notes section at the end
    """
    body = strip_old_note(body)

    # 1. Mattermost-style ```release-note ... ``` block
    release_note_block = re.search(
        r"(```release-note.*?```)",
        body,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if release_note_block:
        end = release_note_block.end()
        return body[:end] + "\n\n" + note + body[end:]

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

    if already_up_to_date(body):
        print("ℹ️  PR description is already up to date for this commit.")
        return

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
