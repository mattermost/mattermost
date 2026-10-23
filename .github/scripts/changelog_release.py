#!/usr/bin/env python3
"""
Release facts for the changelog generator, read from git rather than from release notes.

Standard library only, so the workflow's resolve job can run it without installing
anything. Three entry points:

  resolve    - Work out which release a run is for (version, milestone, release type,
               mode, and the git refs to diff) and whether it should run at all.
               Scheduled runs pass no inputs: the release is the oldest X.Y whose
               release-X.Y branch has been cut but whose vX.Y.0 tag has not been
               pushed, i.e. the window between branch cut and release day.
  reviewers  - Print the reviewers to request for the sections a run touched.

and, imported by generate_changelog.py, ``derived_notes()``: the changes a release
makes that developers rarely write release notes for — pre-packaged plugin versions,
WebSocket events, database migrations — and ``go_version_from_buildenv()``.
"""

import fnmatch
import json
import os
import re
import subprocess
import sys

DOCS_DIR = "docs/main/product-overview"
BUILDENV_DOCKERFILE = "server/build/Dockerfile.buildenv"
PLUGIN_MAKEFILE = "server/Makefile"
WEBSOCKET_EVENTS_FILE = "server/public/model/websocket_message.go"
MIGRATIONS_DIR = "server/channels/db/migrations/postgres"

# Long enough for any real migration; a larger one is cut rather than flooding the prompt.
MAX_MIGRATION_SQL_CHARS = 2000

RELEASE_TYPES = ("feature", "major", "esr")
MODES = ("auto", "regenerate", "dry_run")


# ── Versions and refs ───────────────────────────────────────────────────────────────

def parse_version(version: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)(?:\.(\d+))?", (version or "").strip())
    if not match:
        raise ValueError(f"Cannot parse version {version!r}; expected a form like v12.1.0")
    major, minor, patch = match.groups()
    return int(major), int(minor), int(patch or 0)


def short_version(version: str) -> str:
    major, minor, _ = parse_version(version)
    return f"v{major}.{minor}"


def parse_ls_remote(output: str) -> tuple[set, set]:
    """Return (release branch versions, final release tag versions) as (major, minor) pairs.

    Only vX.Y.0 tags count as a release having shipped; release candidates do not.
    """
    branches, tags = set(), set()
    for line in output.splitlines():
        ref = line.split("\t")[-1].strip()
        branch = re.fullmatch(r"refs/heads/release-(\d+)\.(\d+)", ref)
        if branch:
            branches.add((int(branch.group(1)), int(branch.group(2))))
        tag = re.fullmatch(r"refs/tags/v(\d+)\.(\d+)\.0", ref)
        if tag:
            tags.add((int(tag.group(1)), int(tag.group(2))))
    return branches, tags


def pending_release(branches: set, tags: set) -> tuple[int, int] | None:
    """The next release: cut (branch exists) but not shipped (no vX.Y.0 tag).

    A branch older than the newest shipped release is ignored, so an abandoned branch
    left behind by a cancelled release cannot be picked up forever.
    """
    newest_shipped = max(tags) if tags else (0, 0)
    candidates = sorted(b for b in branches if b not in tags and b > newest_shipped)
    return candidates[0] if candidates else None


def previous_release_tag(major: int, minor: int, tags: set) -> str | None:
    """The vX.Y.0 tag of the release before this one, the baseline for derived notes.

    The .0 tag rather than the previous release branch's head: a dot release can ship a
    plugin bump that the feature release then announces again, so the branch head
    would hide it.
    """
    earlier = sorted(t for t in tags if t < (major, minor))
    if not earlier:
        return None
    prev_major, prev_minor = earlier[-1]
    return f"v{prev_major}.{prev_minor}.0"


def release_type_for(version: str, requested: str, esr_versions: str) -> str:
    """``requested`` unless it is empty or "auto": then major for X.0, esr if listed, else feature."""
    requested = (requested or "").strip().lower()
    if requested and requested != "auto":
        if requested not in RELEASE_TYPES:
            raise ValueError(f"release_type must be one of {', '.join(RELEASE_TYPES)} or auto, not {requested!r}")
        return requested
    major, minor, _ = parse_version(version)
    listed = {short_version(v) for v in re.split(r"[\s,]+", esr_versions or "") if v.strip()}
    if short_version(version) in listed:
        return "esr"
    return "major" if minor == 0 else "feature"


def changelog_path(version: str) -> str:
    return f"{DOCS_DIR}/mattermost-v{parse_version(version)[0]}-changelog.mdx"


def has_entry(content: str, version: str) -> bool:
    return re.search(rf"(?m)^## Release {re.escape(short_version(version))} - ", content or "") is not None


def resolve(env: dict, ls_remote: str, read_file) -> dict:
    """Decide what a run does. ``read_file(path)`` returns file text or None.

    Returns the workflow outputs: ``run`` ("true"/"false") and ``reason``, then version,
    milestone, release_type, mode, changelog, head_ref/head_fetch and base_ref/base_fetch.
    """
    branches, tags = parse_ls_remote(ls_remote)
    scheduled = env.get("EVENT_NAME") == "schedule"

    if scheduled:
        pending = pending_release(branches, tags)
        if not pending:
            return {"run": "false", "reason": "No release branch is waiting for its vX.Y.0 tag."}
        version = f"v{pending[0]}.{pending[1]}.0"
        milestone = version
        mode = (env.get("SCHEDULE_MODE") or "dry_run").strip()
    else:
        version = (env.get("INPUT_VERSION") or "").strip()
        milestone = (env.get("INPUT_MILESTONE") or "").strip() or version
        mode = (env.get("INPUT_MODE") or "auto").strip()

    if mode not in MODES:
        raise ValueError(f"mode must be one of {', '.join(MODES)}, not {mode!r}")
    major, minor, _ = parse_version(version)
    if parse_version(milestone)[0] != major:
        raise ValueError(f"version {version!r} and milestone {milestone!r} disagree on major version")

    path = changelog_path(version)
    if mode != "dry_run" and has_entry(read_file(path), version):
        reason = f"{path} on master already has the {short_version(version)} entry; the changelog has been published."
        if scheduled:
            return {"run": "false", "reason": reason}
        raise ValueError(reason + " Use mode dry_run to preview it again.")

    head_branch = f"release-{major}.{minor}" if (major, minor) in branches else "master"
    base_tag = previous_release_tag(major, minor, tags)
    return {
        "run": "true",
        "reason": "scheduled" if scheduled else "dispatched",
        "version": version,
        "milestone": milestone,
        "release_type": release_type_for(version, env.get("INPUT_RELEASE_TYPE", ""), env.get("ESR_VERSIONS", "")),
        "mode": mode,
        "changelog": path,
        "head_ref": f"origin/{head_branch}",
        "head_fetch": f"+refs/heads/{head_branch}:refs/remotes/origin/{head_branch}",
        "base_ref": base_tag or "",
        "base_fetch": f"+refs/tags/{base_tag}:refs/tags/{base_tag}" if base_tag else "",
    }


# ── Facts read from the release diff ────────────────────────────────────────────────

def git_show(ref: str, path: str) -> str | None:
    result = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def git_added_files(base: str, head: str, path: str) -> list[str] | None:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=A", base, head, "--", path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    return sorted(line for line in result.stdout.splitlines() if line.strip())


def go_version_from_buildenv(dockerfile: str) -> str | None:
    """``FROM golang:1.26.10-bookworm@sha256:...`` -> ``go1.26.10``."""
    match = re.search(r"(?m)^FROM\s+golang:(\d+\.\d+(?:\.\d+)?)", dockerfile or "")
    return f"go{match.group(1)}" if match else None


# Names as the changelog has always written them; anything else is title-cased.
PLUGIN_DISPLAY_NAMES = {
    "github": "GitHub",
    "gitlab": "GitLab",
    "mscalendar": "MS Calendar",
    "msteams-meetings": "MS Teams Meetings",
    "msteams": "MS Teams",
    "servicenow": "ServiceNow",
    "user-survey": "User Survey",
    "channel-export": "Channel Export",
    "legal-hold": "Legal Hold",
}


def plugin_display_name(package: str) -> str:
    slug = package.removeprefix("mattermost-plugin-")
    return PLUGIN_DISPLAY_NAMES.get(slug) or " ".join(part.capitalize() for part in slug.split("-"))


def plugin_packages(makefile: str) -> dict[str, str]:
    """The default (non-FIPS) pre-packaged plugins: ``{"mattermost-plugin-calls": "v1.12.6"}``.

    Only unindented ``PLUGIN_PACKAGES +=`` lines count; the FIPS overrides are indented
    inside an ``ifeq`` block and carry build suffixes.
    """
    packages = {}
    for match in re.finditer(r"(?m)^PLUGIN_PACKAGES \+= (mattermost-plugin-[a-z0-9-]+?)-(v\d+\.\d+\.\d+\S*)\s*$", makefile or ""):
        packages[match.group(1)] = match.group(2)
    return packages


def plugin_notes(old: dict, new: dict) -> list[dict]:
    notes = []
    for package in sorted(new):
        version = new[package]
        if old.get(package) == version:
            continue
        url = f"https://github.com/mattermost/{package}/releases/tag/{version}"
        text = f"Pre-packaged {plugin_display_name(package)} plugin version [{version}]({url})."
        notes.append({"source": f"plugin:{package}@{version}", "text": text, "fallback": text})
    for package in sorted(set(old) - set(new)):
        text = f"Removed the pre-packaged {plugin_display_name(package)} plugin; it is no longer included with the server."
        notes.append({"source": f"plugin:{package}@removed", "text": text, "fallback": text})
    return notes


def websocket_events(go_source: str) -> set[str]:
    return set(re.findall(r'WebsocketEventType\s*=\s*"([a-z0-9_]+)"', go_source or ""))


def websocket_notes(old: set, new: set) -> list[dict]:
    notes = []
    for event in sorted(new - old):
        text = f"Added the ``{event}`` WebSocket event."
        notes.append({"source": f"websocket:{event}@added", "text": text, "fallback": text})
    for event in sorted(old - new):
        text = f"Removed the ``{event}`` WebSocket event."
        notes.append({"source": f"websocket:{event}@removed", "text": text, "fallback": text})
    return notes


def migration_note(name: str, sql: str) -> dict:
    sql = (sql or "").strip()
    if len(sql) > MAX_MIGRATION_SQL_CHARS:
        sql = sql[:MAX_MIGRATION_SQL_CHARS] + "\n-- (truncated)"
    text = (
        f"Database schema migration ``{name}``, read from the release diff rather than "
        "written by a developer. Describe in one Database Schema Changes bullet what it "
        "changes (the table, column, index or type it adds, changes or drops), naming "
        f"each identifier in double backticks. The PostgreSQL migration:\n\n```sql\n{sql}\n```"
    )
    return {"source": f"migration:{name}", "text": text, "fallback": f"Added database migration ``{name}``."}


def derived_notes(base_ref: str, head_ref: str, show=git_show, added=git_added_files) -> list[dict]:
    """Notes for what changed between two release refs, each with a stable source key.

    The key goes into the changelog PR's changelog-sources list like a PR reference
    does, so a later run adds only what changed since: a second plugin bump has a new
    key, an unchanged plugin does not.
    """
    if not base_ref or not head_ref:
        return []
    notes = plugin_notes(
        plugin_packages(show(base_ref, PLUGIN_MAKEFILE)),
        plugin_packages(show(head_ref, PLUGIN_MAKEFILE)),
    )
    notes += websocket_notes(
        websocket_events(show(base_ref, WEBSOCKET_EVENTS_FILE)),
        websocket_events(show(head_ref, WEBSOCKET_EVENTS_FILE)),
    )
    for path in added(base_ref, head_ref, MIGRATIONS_DIR) or []:
        if path.endswith(".up.sql"):
            name = os.path.basename(path).removesuffix(".up.sql")
            notes.append(migration_note(name, show(head_ref, path)))
    for note in notes:
        note["derived"] = True
    return notes


# ── Reviewers ───────────────────────────────────────────────────────────────────────

def reviewers_for(sections: list[dict], mapping: dict) -> list[str]:
    """Reviewers for the sections a run added bullets to.

    ``mapping`` keys are fnmatch patterns over "Section" and "Section/Subsection"
    (e.g. "Upgrade Impact/*", "API Changes"); "*" matches every run that changed
    anything. Values are GitHub logins or "org/team" slugs.
    """
    touched = set()
    for group in sections:
        if not group.get("items"):
            continue
        section = group.get("section") or ""
        touched.add(section)
        if group.get("subsection"):
            touched.add(f"{section}/{group['subsection']}")
    reviewers = []
    if not touched:
        return reviewers
    for pattern, names in mapping.items():
        if pattern == "*" or any(fnmatch.fnmatchcase(key, pattern) for key in touched):
            for name in [names] if isinstance(names, str) else names:
                if name and name not in reviewers:
                    reviewers.append(name)
    return reviewers


# ── CLI ─────────────────────────────────────────────────────────────────────────────

def _write_outputs(outputs: dict) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    for key, value in outputs.items():
        print(f"{key}={value}")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            for key, value in outputs.items():
                f.write(f"{key}={value}\n")


def _read_file(path: str) -> str | None:
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else ""
    if command == "resolve":
        ls_remote = subprocess.run(
            ["git", "ls-remote", "--heads", "--tags", "origin", "release-*", "v*.0"],
            capture_output=True, text=True, check=True,
        ).stdout
        try:
            outputs = resolve(dict(os.environ), ls_remote, _read_file)
        except ValueError as err:
            print(f"::error::{err}")
            return 1
        _write_outputs(outputs)
        return 0
    if command == "reviewers":
        with open(argv[2], encoding="utf-8") as f:
            sections = json.load(f).get("sections", [])
        mapping = json.loads(os.environ.get("SECTION_REVIEWERS") or "{}")
        print(",".join(reviewers_for(sections, mapping)))
        return 0
    print("usage: changelog_release.py resolve | reviewers SECTIONS_JSON", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
