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
  GITHUB_TOKEN     — built-in Actions token  (pull-requests: write scope)
  PR_NUMBER        — pull request number
  BASE_SHA         — base commit SHA
  HEAD_SHA         — head commit SHA
  REPO             — owner/repo  (e.g. mattermost/mattermost)
  DEFAULT_BRANCH   — repository default branch (e.g. master); used to ignore
                     commits the PR head inherited from trunk when the GitHub
                     base was retargeted onto an older line of history
"""
 
import os
import re
import sys
import subprocess
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional

try:
    import requests
except ImportError:  # pragma: no cover - GitHub API helpers unused in unit tests
    requests = None
 
# ── Environment ────────────────────────────────────────────────────────────────
 
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
PR_NUMBER    = int(os.environ["PR_NUMBER"]) if "PR_NUMBER" in os.environ else 0
BASE_SHA     = os.environ.get("BASE_SHA", "")
BASE_REF     = os.environ.get("BASE_REF", "")  # the PR's own base branch, e.g. master or release-12.0
HEAD_SHA     = os.environ.get("HEAD_SHA", "")
REPO         = os.environ.get("REPO", "mattermost/mattermost")
DEFAULT_BRANCH = os.environ.get("DEFAULT_BRANCH", "master")
 
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

def _git(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        check=check,
    )


def default_branch_sha() -> str:
    """Tip of the repository default branch, if present in this clone."""
    for ref in (f"origin/{DEFAULT_BRANCH}", DEFAULT_BRANCH):
        result = _git(["rev-parse", "--verify", ref], check=False)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    return ""


@lru_cache(maxsize=1)
def unique_commits() -> tuple[str, ...]:
    """Commits on HEAD that are not on the PR base and not on the default branch.

    `git diff BASE...HEAD` (and GitHub's PR file list) follow the GitHub base
    ref. If that base is retargeted onto an older branch, every default-branch
    commit the head already contains shows up as a change of this PR — including
    watched API/config files this PR never touched.

    Subtracting the default branch leaves only commits this PR actually added.
    Cherry-picks onto a release branch keep a distinct SHA, so they still appear.
    """
    cmd = ["rev-list", "--no-merges", f"{BASE_SHA}..{HEAD_SHA}"]
    default = default_branch_sha()
    if default:
        cmd += ["--not", default]
    return tuple(c for c in _git(cmd).stdout.split() if c)


@lru_cache(maxsize=None)
def _commit_files(sha: str) -> frozenset[str]:
    result = _git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha])
    return frozenset(line for line in result.stdout.splitlines() if line)


def _is_watched(path: str) -> bool:
    for watched in WATCHED_PATHS:
        if watched.endswith("/"):
            if path.startswith(watched):
                return True
        elif path == watched:
            return True
    return False


def files_changed_in_unique_commits() -> list[str]:
    files: set[str] = set()
    for sha in unique_commits():
        files.update(_commit_files(sha))
    return sorted(path for path in files if _is_watched(path))


@lru_cache(maxsize=1)
def default_merge_base() -> str:
    """Merge base of HEAD and the current default branch, or "" if there is none.

    This is the state of the repository the PR started from, as far as master is
    concerned. It is newer than the parent of the PR's oldest commit when the head
    carries older work that master has since taken in some other way, such as the
    first commits of a stacked PR that were later merged separately.
    """
    default = default_branch_sha()
    if not default:
        return ""
    result = _git(["merge-base", default, HEAD_SHA], check=False)
    return result.stdout.strip() if result.returncode == 0 else ""


@lru_cache(maxsize=1)
def base_tip_ref() -> str:
    """Current tip of the PR's own base branch (BASE_REF), or BASE_SHA when it is not in this clone.

    For a cherry-pick to release-12.0 that is the release branch, not master, so a
    change master already has still counts as added there. "" if neither is known.
    """
    if BASE_REF:
        for ref in (f"origin/{BASE_REF}", BASE_REF):
            result = _git(["rev-parse", "--verify", ref], check=False)
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
    return BASE_SHA


def file_at_base_tip(path: str) -> Optional[str]:
    """Contents of `path` on the base branch's tip, or None when the tip is unknown."""
    tip = base_tip_ref()
    return file_at(tip, path) if tip else None


def net_changes(before: set, head: set, tip: Optional[set]) -> tuple[set, set]:
    """What this PR adds and removes, given the sets at its merge base, its head and the base branch's tip.

    Added: in the head, not in the merge base, and not on the base branch's tip (already
    there by another route, such as the first PR of a stack that was squash-merged).
    Removed: in the merge base, not in the head, and still on the tip (otherwise the base
    branch removed it already). With no tip (``None``) the head and merge base decide alone.
    """
    added = head - before
    removed = before - head
    if tip is not None:
        added -= tip
        removed &= tip
    return added, removed


@lru_cache(maxsize=1)
def release_merge_base() -> str:
    """Merge base of HEAD and the base branch's tip when the PR targets a release branch
    (``release-X.Y``), or "".

    A release line has files and routes master never had at the cut (later cherry-picks),
    so the merge base with master is too old for it: a route the line added and this PR
    removes would not count as removed, and a file the line added would look new.
    """
    if not re.fullmatch(r"release-\d+\.\d+", BASE_REF or ""):
        return ""
    tip = base_tip_ref()
    if not tip:
        return ""
    result = _git(["merge-base", tip, HEAD_SHA], check=False)
    return result.stdout.strip() if result.returncode == 0 else ""


def before_ref_for(path: str) -> str:
    """The state of `path` before this PR: the merge base with its release branch when it
    targets one, otherwise with the current default branch.

    The default branch works when GitHub's base ref is not an ancestor of the work
    (retarget), where MERGE_BASE would be too old, and it does not count work master
    already has as this PR's. Without either in the clone, falls back to the parent of
    the oldest unique commit that touches `path`.
    """
    merge_base = release_merge_base() or default_merge_base()
    if merge_base:
        return merge_base
    oldest = None
    for sha in unique_commits():  # newest first; last match is oldest
        if path in _commit_files(sha):
            oldest = sha
    if oldest:
        return _git(["rev-parse", f"{oldest}^"]).stdout.strip()
    return _compute_merge_base()


def get_full_patch() -> str:
    """Unified diff of watched paths this PR's own commits actually changed."""
    files = files_changed_in_unique_commits()
    if not files:
        return ""
    patches: list[str] = []
    for path in files:
        result = _git(["diff", before_ref_for(path), HEAD_SHA, "--", path])
        patches.append(result.stdout)
    return "".join(patches)
 
 
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
    result = _git(["show", f"{ref}:{path}"], check=False)
    return result.stdout if result.returncode == 0 else ""


def file_before(path: str) -> str:
    """File contents before this PR: at the merge base with the default branch (see ``before_ref_for``)."""
    return file_at(before_ref_for(path), path)


def _compute_merge_base() -> str:
    """Resolve the merge-base of BASE_SHA and HEAD_SHA.

    Fallback when a path has no unique-commit parent. BASE_SHA is the tip of
    the GitHub target branch at PR-event time; merge-base is the last shared
    commit with HEAD.
    """
    return _git(["merge-base", BASE_SHA, HEAD_SHA]).stdout.strip()


def reset_git_caches() -> None:
    """Clear cached git walks. Tests call this after pointing at a new repo."""
    unique_commits.cache_clear()
    _commit_files.cache_clear()
    default_merge_base.cache_clear()
    release_merge_base.cache_clear()
    base_tip_ref.cache_clear()
 
 
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
 
    Compares full-file snapshots before this PR's unique commits and at
    HEAD_SHA so that fields are always attributed to the correct struct
    regardless of which diff hunks are present.
    """
    result = CheckResult(label="`config.json` Field Changes")
    if _CONFIG_PATH not in patches:
        return result
 
    base_fields = _scan_struct_fields(file_before(_CONFIG_PATH))
    head_fields = _scan_struct_fields(file_at(HEAD_SHA, _CONFIG_PATH))
    tip_src = file_at_base_tip(_CONFIG_PATH)

    added, removed = net_changes(
        base_fields, head_fields, None if tip_src is None else _scan_struct_fields(tip_src))
 
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
    r'([\w.]*)\.Handle\("([^"]*)"'   # receiver and path
    r',\s*[^)]*\((\w+)\)\)'        # wrapper(...handlerFunc))
    r'\.Methods\(([^)]+)\)',        # .Methods(one or more methods)
)

# api.BaseRoutes.PropertyField = api.BaseRoutes.PropertyFields.PathPrefix("/{id}").Subrouter()
_SUBROUTER_RE = re.compile(
    r'BaseRoutes\.(\w+)\s*=\s*(?:api\.)?BaseRoutes\.(\w+)\.PathPrefix\("([^"]*)"\)\.Subrouter\(\)'
)
_API_ROUTES_PATH = "server/channels/api4/api.go"

_METHOD_RE    = re.compile(r'(?:http\.Method)?(\w+)')
_HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}


def _route_prefixes(api_src: str) -> dict[str, str]:
    """Each api4 subrouter's path prefix, from the PathPrefix(...).Subrouter() lines of api.go.

    A subrouter hangs off another one, so its prefix is the parent's plus its own. The
    roots (APIRoot and the like) are not defined by such a line and count as empty.
    """
    parents = {name: (parent, path) for name, parent, path in _SUBROUTER_RE.findall(api_src)}
    prefixes: dict[str, str] = {}

    def prefix(name: str, seen: tuple = ()) -> str:
        if name not in parents or name in seen:
            return ""
        if name not in prefixes:
            parent, path = parents[name]
            prefixes[name] = prefix(parent, seen + (name,)) + path
        return prefixes[name]

    for name in parents:
        prefix(name)
    return prefixes


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


def _shorten_path_vars(path: str) -> str:
    """``{name:regexp}`` path variables as ``{name}``. The pattern may hold braces of its own,
    as in ``/{fingerprint:[a-f0-9]{32}}/mute``, so the variable ends at its matching brace."""
    out, i = [], 0
    while i < len(path):
        if path[i] != "{":
            out.append(path[i])
            i += 1
            continue
        depth, j = 0, i
        while j < len(path):
            depth += {"{": 1, "}": -1}.get(path[j], 0)
            if depth == 0:
                break
            j += 1
        name = path[i + 1:j].split(":", 1)[0]
        out.append(f"{{{name}}}")
        i = j + 1
    return "".join(out)


def _parse_endpoints(src: str, prefixes: Optional[dict] = None) -> set[tuple[str, str, str]]:
    """
    Parse Handle() registrations from a Go source file.
 
    Whitespace-collapses the entire file first so multi-line declarations
    (e.g. the 18 in group.go) are matched as a single token sequence.
    A registration on a subrouter, such as ``api.BaseRoutes.PropertyFieldOptions.Handle("", ...)``,
    gets that subrouter's prefix from ``prefixes`` (see ``_route_prefixes``), and a
    ``{name:regexp}`` path variable is shortened to ``{name}``.
    Returns {(path, handler, method)} tuples.
    """
    blob = " ".join(src.split())
    endpoints: set[tuple[str, str, str]] = set()
    for m in _HANDLE_RE.finditer(blob):
        receiver, path, handler, methods_raw = m.group(1), m.group(2), m.group(3), m.group(4)
        full = (prefixes or {}).get(receiver.rsplit(".", 1)[-1], "") + path
        full = _shorten_path_vars(full)
        for method in _parse_methods(methods_raw):
            endpoints.add((full or "/", handler, method))
    return endpoints


def check_api(patches: dict[str, str]) -> CheckResult:
    """
    Detect API endpoint additions/removals in the api4/ directory.
 
    Compares full-file snapshots before this PR's unique commits and at
    HEAD_SHA via set arithmetic, so multi-line and multi-method
    registrations are handled correctly.
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
        base_eps = _parse_endpoints(file_before(fname), _route_prefixes(file_before(_API_ROUTES_PATH)))
        head_eps = _parse_endpoints(file_at(HEAD_SHA, fname), _route_prefixes(file_at(HEAD_SHA, _API_ROUTES_PATH)))
        tip_src = file_at_base_tip(fname)
        tip_eps = None if tip_src is None else _parse_endpoints(
            tip_src, _route_prefixes(file_at_base_tip(_API_ROUTES_PATH) or ""))
        added, removed = net_changes(base_eps, head_eps, tip_eps)
        added_eps   |= added
        removed_eps |= removed
 
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
 
    Uses full-file snapshots before this PR's unique commits and at HEAD_SHA
    so reorderings and cross-constant name collisions don't produce false
    results.
    """
    result = CheckResult(label="Audit Log Event Changes")
    if _AUDIT_EVENT_PATH not in patches:
        return result

    base_events = _parse_audit_events(file_before(_AUDIT_EVENT_PATH))
    head_events = _parse_audit_events(file_at(HEAD_SHA, _AUDIT_EVENT_PATH))
 
    tip_src = file_at_base_tip(_AUDIT_EVENT_PATH)
    added, removed = net_changes(
        base_events, head_events, None if tip_src is None else _parse_audit_events(tip_src))

    result.additions = sorted(f"``{e}``" for e in added)
    result.removals  = sorted(f"``{e}``" for e in removed)
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
 
    old_ver = _parse_go_version(file_before(_DOCKERFILE_PATH))
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
 
def load_env() -> None:
    """Read workflow env vars. Called from main so tests can import the module."""
    global GITHUB_TOKEN, PR_NUMBER, BASE_SHA, HEAD_SHA, REPO, DEFAULT_BRANCH
    GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
    PR_NUMBER = int(os.environ["PR_NUMBER"])
    BASE_SHA = os.environ["BASE_SHA"]
    HEAD_SHA = os.environ["HEAD_SHA"]
    REPO = os.environ.get("REPO", "mattermost/mattermost")
    DEFAULT_BRANCH = os.environ.get("DEFAULT_BRANCH", "master")
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"
    reset_git_caches()


def main():
    load_env()
    print(f"📋 PR #{PR_NUMBER} | base {BASE_SHA[:8]} → head {HEAD_SHA[:8]}")
    unique = unique_commits()
    print(f"   {len(unique)} unique commit(s) vs {DEFAULT_BRANCH} (excluding the GitHub base)")
    print("🔍 Collecting diffs …")

    full_patch = get_full_patch()
    if not full_patch.strip():
        print("ℹ️  No changes in watched paths from this PR's own commits. Nothing to do.")
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
    except Exception as e:
        if requests is not None and isinstance(e, requests.HTTPError):
            reason = e.response.reason or "unknown"
            print(f"❌ GitHub API error: {e.response.status_code} {reason}", file=sys.stderr)
            sys.exit(1)
        raise
