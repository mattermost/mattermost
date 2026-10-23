#!/usr/bin/env python3
"""
Release facts for the changelog generator, read from git rather than from release notes.

Standard library only, so the workflow's resolve job can run it without installing
anything. Three entry points:

  resolve    - Work out which release a run is for (version, milestone, release type,
               mode, and the git refs to diff) and whether it should run at all.
               Scheduled runs pass no inputs: the release is the one between its
               release-X.Y branch cut and its changelog entry being merged to master
               (the vX.Y.0 tag is pushed about five working days before that).
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


def pending_release(branches: set, tags: set, published=lambda release: False) -> tuple[int, int] | None:
    """The release the changelog is being written for, or None.

    That is the newest tagged release while its entry is not on master yet (the final
    build is tagged about five working days before the changelog is merged on release
    day), else the oldest cut branch with no vX.Y.0 tag. ``published((major, minor))``
    says whether the entry is on master. A branch older than the newest tagged release
    is ignored, so an abandoned branch left behind by a cancelled release cannot be
    picked up forever.
    """
    newest_shipped = max(tags) if tags else (0, 0)
    if newest_shipped in branches and not published(newest_shipped):
        return newest_shipped
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
        def published(release):
            version = f"v{release[0]}.{release[1]}.0"
            return has_entry(read_file(changelog_path(version)), version)

        pending = pending_release(branches, tags, published)
        if not pending:
            return {"run": "false", "reason": "No release is between its branch cut and its changelog being merged."}
        version = f"v{pending[0]}.{pending[1]}.0"
        milestone = version
        mode = (env.get("SCHEDULE_MODE") or "dry_run").strip()
    else:
        # Normalized so "v13.0" cannot produce a "## Release v13" heading that also
        # slips past the duplicate-entry check.
        version = "v{}.{}.{}".format(*parse_version(env.get("INPUT_VERSION") or ""))
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

def _git(*args: str) -> subprocess.CompletedProcess:
    # Paths are repo-relative wherever the script is run from (the workflow copies it out
    # of the checkout before switching branches).
    top = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    return subprocess.run(["git", *args], capture_output=True, text=True, cwd=top.stdout.strip() or None)


def git_show(ref: str, path: str) -> str | None:
    """The file at ``ref``, or None when ``ref`` has no such path.

    A failing git command (an unfetched ref, say) raises instead: treating it as an
    absent file would turn every plugin and WebSocket event into a false addition.
    """
    result = _git("show", f"{ref}:{path}")
    if result.returncode == 0:
        return result.stdout
    listing = _git("ls-tree", "--name-only", ref, "--", path)
    if listing.returncode == 0 and not listing.stdout.strip():
        return None
    raise RuntimeError(f"git show {ref}:{path} failed: {(result.stderr or listing.stderr).strip()}")


def git_added_files(base: str, head: str, path: str) -> list[str]:
    result = _git("diff", "--name-only", "--diff-filter=A", base, head, "--", path)
    if result.returncode != 0:
        raise RuntimeError(f"git diff {base} {head} -- {path} failed: {result.stderr.strip()}")
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


def plugin_version_link(package: str, version: str) -> str:
    return f"[{version}](https://github.com/mattermost/{package}/releases/tag/{version})"


def plugin_notes(old: dict, new: dict) -> list[dict]:
    notes = []
    for package in sorted(new):
        version = new[package]
        if old.get(package) == version:
            continue
        text = f"Pre-packaged {plugin_display_name(package)} plugin version {plugin_version_link(package, version)}."
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


BENCHMARK_REPORT_URL = "https://raw.githubusercontent.com/mattermost/performance-reports/main/performance-comparisons/{version}/README.md"
BENCHMARK_PAGE_URL = "https://github.com/mattermost/performance-reports/tree/main/performance-comparisons/{version}"
# The range the performance team treats as usual run-to-run variance.
BENCHMARK_VARIANCE = 5.0


def fetch_url(url: str) -> str | None:
    """The body at ``url``, or None for a 404 (the report is not published yet)."""
    import urllib.error
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return None
        raise


def benchmark_delta(report: str) -> float | None:
    """The supported-user delta from a performance comparison README, in percent.

    Read from the "Supported users in unbounded test" table: ``| 16533 | 15820 | \\-4.31% |``.
    """
    section = re.search(r"(?ims)^#+\s*Supported users in unbounded test\s*$(.*?)(?=^#|\Z)", report or "")
    if not section:
        return None
    for row in section.group(1).splitlines():
        cells = [cell.strip().replace("\\", "") for cell in row.strip().strip("|").split("|")]
        if len(cells) >= 3 and re.fullmatch(r"\d+", cells[0]) and re.fullmatch(r"\d+", cells[1]):
            delta = re.fullmatch(r"([+-]?\d+(?:\.\d+)?)%", cells[2])
            if delta:
                return float(delta.group(1))
            return round((int(cells[1]) - int(cells[0])) / int(cells[0]) * 100, 2)
    return None


def benchmark_text(version: str, delta: float) -> str:
    """The Performance bullet every recent changelog uses, for a supported-user delta."""
    change = "no change" if delta == 0 else f"a {abs(delta):.2f}% {'increase' if delta > 0 else 'decrease'}"
    link = f"[Performance Reports repository]({BENCHMARK_PAGE_URL.format(version=short_version(version))})"
    if abs(delta) <= BENCHMARK_VARIANCE:
        return (
            f"Benchmarking test results showed no significant difference: {change} in the number of "
            "supported users for the new release, which lies within the ``[-5%, +5%]`` prediction "
            f"interval. View the full raw data and methodology in our {link}."
        )
    return (
        f"Benchmarking test results showed {change} in the number of supported users for the new "
        "release, outside the ``[-5%, +5%]`` prediction interval. View the full raw data and "
        f"methodology in our {link}."
    )


def benchmark_notes(version: str, fetch=fetch_url) -> list[dict]:
    """The benchmarking bullet, once the release's performance comparison is published.

    An unpublished report is picked up by the first run after it lands. The source key
    is per release, so a later correction to the report is left to the reviewer.
    """
    url = BENCHMARK_REPORT_URL.format(version=short_version(version))
    try:
        report = fetch(url)
    except Exception as err:  # noqa: BLE001 - a network failure must not block the changelog
        print(f"⚠️  Could not read the performance comparison at {url}: {err}")
        return []
    delta = benchmark_delta(report) if report else None
    if delta is None:
        print(f"ℹ️  No performance comparison with a supported-user delta at {url} yet")
        return []
    text = benchmark_text(version, delta)
    return [{"source": f"benchmark:{short_version(version)}", "text": text, "fallback": text, "derived": True}]


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
    for path in added(base_ref, head_ref, MIGRATIONS_DIR):
        if path.endswith(".up.sql"):
            name = os.path.basename(path).removesuffix(".up.sql")
            notes.append(migration_note(name, show(head_ref, path)))
    for note in notes:
        note["derived"] = True
    return notes


# ── Documentation links ─────────────────────────────────────────────────────────────
#
# A feature's docs page is found by following the PR, not by matching its wording: the
# docs files the feature PR changed itself (most docs land with the code), or else those
# changed by a docs PR in the same milestone that names the same Jira key or links the
# feature PR. The file path then maps to its page the way the Docusaurus site serves it.

DOCS_SITE = "https://docs.mattermost.com"
# docs/<root>/ -> the site path it is served under (docs/site/docusaurus.config.ts).
DOCS_ROOTS = (("docs/main/", ""), ("docs/develop/", "/developers"))
# Release notes and per-release upgrade lists change in every release; no feature lives there.
NOT_A_FEATURE_PAGE = re.compile(
    r"(?:^|/)(?:[^/]*changelog[^/]*|important-upgrade-notes|open-source-components|deprecated-configuration-settings)\.mdx?$"
)
# Pages listing every setting, audit event or command: used only when nothing else matched.
REFERENCE_PAGE = re.compile(r"(?:configuration-settings|audit-log-schema|command-line-tools?)\.mdx?$")
JIRA_KEY_RE = re.compile(r"\bMM-\d+\b", re.IGNORECASE)


def docs_page_url(path: str, content: str | None = None) -> str | None:
    """``docs/main/a/b.mdx`` -> ``https://docs.mattermost.com/a/b``, or None for a non-page.

    A frontmatter ``slug`` replaces the path; an ``index`` or ``README`` file, or one
    named after its folder, is served at the folder.
    """
    for root, base in DOCS_ROOTS:
        if path.startswith(root):
            rel = path[len(root):]
            break
    else:
        return None
    if not re.search(r"\.mdx?$", rel):
        return None
    rel = re.sub(r"\.mdx?$", "", rel)
    folder, name = os.path.split(rel)
    front = re.match(r"---\n(.*?)\n---", (content or "").replace("\r\n", "\n"), re.DOTALL)
    slug = re.search(r"(?m)^slug:\s*['\"]?([^'\"\n]+?)['\"]?\s*$", front.group(1)) if front else None
    if slug:
        page = slug.group(1) if slug.group(1).startswith("/") else f"/{folder}/{slug.group(1)}"
    elif name.lower() in ("index", "readme") or name == os.path.basename(folder):
        page = f"/{folder}"
    else:
        page = f"/{rel}"
    return DOCS_SITE + base + (re.sub(r"/+", "/", page).rstrip("/") or "/")


def _plain_heading(heading: str) -> str:
    text = re.sub(r"\s*\\?\{#[^}]+\}\s*$", "", heading)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return re.sub(r"<[^>]+>|[*_`]", "", text).strip()


def page_title(path: str, content: str | None) -> str:
    """A page's title: its frontmatter ``title``, else its first ``#`` heading, else its file name."""
    content = (content or "").replace("\r\n", "\n")
    front = re.match(r"---\n(.*?)\n---", content, re.DOTALL)
    title = re.search(r"(?m)^title:\s*['\"]?(.+?)['\"]?\s*$", front.group(1)) if front else None
    if title:
        return title.group(1).strip()
    heading = re.search(r"(?m)^#\s+(.+)$", content)
    if heading:
        return _plain_heading(heading.group(1))
    return re.sub(r"\.mdx?$", "", os.path.basename(path)).replace("-", " ").capitalize()


def heading_anchor(heading: str) -> str:
    """The id Docusaurus gives a heading: its explicit ``{#id}``, else the github-slugger slug."""
    explicit = re.search(r"\\?\{#([^}]+)\}\s*$", heading)
    if explicit:
        return explicit.group(1)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading)
    text = re.sub(r"<[^>]+>", "", text).strip().lower()
    return re.sub(r"\s", "-", re.sub(r"[^\w\- ]", "", text))


def added_headings(patch: str | None) -> list[str]:
    return [m.group(1).strip() for m in re.finditer(r"(?m)^\+#{2,6}\s+(.+)$", patch or "")]


def jira_keys(title: str, head_ref: str, body: str) -> set[str]:
    """The Jira keys a PR names in its title, branch or Ticket Link section."""
    ticket = re.search(r"(?ims)^#+\s*Ticket Link\s*$(.*?)(?=^#|\Z)", re.sub(r"<!--.*?-->", "", body or "", flags=re.DOTALL))
    text = " ".join([title or "", head_ref or "", ticket.group(1) if ticket else ""])
    return {key.upper() for key in JIRA_KEY_RE.findall(text)}


def pr_references(body: str, repo: str) -> set[str]:
    """The PRs a body links to, as ``owner/repo#N``; a bare ``#N`` is in ``repo``."""
    body = re.sub(r"<!--.*?-->", "", body or "", flags=re.DOTALL)
    refs = {f"{owner}/{name}#{n}" for owner, name, n in re.findall(r"github\.com/([\w.-]+)/([\w.-]+)/pull/(\d+)", body)}
    refs |= {f"{repo}#{n}" for n in re.findall(r"(?<![\w/&])#(\d+)\b", body)}
    return refs


def _docs_candidates(files: list[dict], via: str, read_file) -> list[dict]:
    candidates = []
    for f in files or []:
        path = f["filename"]
        if f.get("status") == "removed" or NOT_A_FEATURE_PAGE.search(path) or not docs_page_url(path):
            continue
        content = read_file(path)
        url = docs_page_url(path, content) if content is not None else None
        if url:
            patch = f.get("patch") or ""
            present = [h for h in added_headings(patch) if re.search(rf"(?m)^#{{2,6}}\s+{re.escape(h)}\s*$", content)]
            candidates.append({
                "path": path, "url": url, "title": page_title(path, content),
                "added": f.get("status") == "added", "headings": present, "via": via,
                "lines_added": len(re.findall(r"(?m)^\+(?!\+\+)\s*\S", patch)),
                "lines_removed": len(re.findall(r"(?m)^-(?!--)\s*\S", patch)),
            })
    return candidates


# A page the PR only trimmed, or touched in a line or two, is where something was
# mentioned in passing, not where the feature is documented.
MIN_DOCS_LINES_ADDED = 3


def _pick(candidates: list[dict]) -> dict | None:
    """The one page a feature is documented on, or None when the PR does not make it clear.

    A page counts if the PR created it, or added at least MIN_DOCS_LINES_ADDED lines and
    more than it removed. Feature pages beat reference pages; a new page beats an edited
    one; otherwise the page with the most added lines wins, if by at least double.
    """
    eligible = [c for c in candidates
                if c["added"] or (c["lines_added"] >= MIN_DOCS_LINES_ADDED and c["lines_added"] > c["lines_removed"])]
    pool = [c for c in eligible if not REFERENCE_PAGE.search(c["path"])] or eligible
    new = {c["url"] for c in pool if c["added"]}
    chosen = None
    if len(new) == 1:
        chosen = next(c for c in pool if c["added"])
    elif not new and pool:
        by_page: dict[str, int] = {}
        for c in pool:
            by_page[c["url"]] = by_page.get(c["url"], 0) + c["lines_added"]
        ranked = sorted(by_page.items(), key=lambda item: -item[1])
        if len(ranked) == 1 or ranked[0][1] >= 2 * ranked[1][1]:
            chosen = max((c for c in pool if c["url"] == ranked[0][0]), key=lambda c: c["lines_added"])
    if not chosen:
        return None
    url, title = chosen["url"], chosen["title"]
    if not chosen["added"] and len(chosen["headings"]) == 1:
        url += "#" + heading_anchor(chosen["headings"][0])
        title += ": " + _plain_heading(chosen["headings"][0])
    return {**chosen, "url": url, "title": title}


def docs_link(source: str, prs: dict, files_of, read_file) -> dict:
    """Where the docs for the PR ``source`` are, and why, following the PR to its docs.

    ``prs`` maps each milestone PR's ``owner/repo#N`` to its title, body and head_ref;
    ``files_of(source)`` lists a PR's changed files (filename, status, patch);
    ``read_file(path)`` reads a file as it is now, or None if it no longer exists.

    Returns ``{"url", "title", "basis"}`` for a clear match, ``{"candidates", "titles"}`` when several pages
    are equally likely, or ``{}`` when nothing points at a page. The rule abstains rather
    than guess: a missing link is visible to a reviewer, a wrong one is not.
    """
    own = _docs_candidates(files_of(source), "the same PR", read_file)
    chosen = _pick(own)
    candidates = own
    if not own:
        pr = prs[source]
        keys = jira_keys(pr.get("title"), pr.get("head_ref"), pr.get("body"))
        for other, info in prs.items():
            if other == source or not other.startswith("mattermost/mattermost#"):
                continue
            shared = keys & jira_keys(info.get("title"), info.get("head_ref"), info.get("body"))
            linked = source in pr_references(info.get("body"), other.split("#")[0])
            if shared or linked:
                via = f"docs PR {other}, which " + (f"names {', '.join(sorted(shared))}" if shared else "links the PR")
                candidates += _docs_candidates(files_of(other), via, read_file)
        chosen = _pick(candidates)
    if chosen:
        basis = f"{chosen['path']} changed in {chosen['via']}"
        if "#" in chosen["url"]:
            basis += f", which added the heading \"{chosen['headings'][0]}\""
        elif chosen["added"]:
            basis += ", which added the page"
        return {"url": chosen["url"], "title": chosen["title"], "basis": basis}
    if candidates:
        return {"candidates": sorted({c["url"] for c in candidates}),
                "titles": {c["url"]: c["title"] for c in candidates}}
    return {}


# ── Link check ──────────────────────────────────────────────────────────────────────
#
# Every docs.mattermost.com link must reach a page, and its #anchor a heading on it.
# The site is rebuilt from the docs sources at a ref the way docs_page_url serves them,
# plus the hand-maintained legacy redirects, so no network access is needed.

DOCS_URL_RE = re.compile(r"https?://docs\.mattermost\.com(?P<path>/[^\s)>\]\"'`#?]*)?(?:\?[^\s)>\]\"'`#]*)?(?:#(?P<anchor>[^\s)>\]\"'`]*))?")
REDIRECTS_FILE = "docs/site/sidebars/active-redirects.json"
CHANGELOG_GLOB = "docs/main/product-overview/mattermost-v*-changelog.mdx"


def _site_path(path: str) -> str:
    path = re.sub(r"\.html$", "", (path or "/").rstrip("/")) or "/"
    return "/" if path == "/index" else path


class DocsSite:
    """The pages, and their headings, docs.mattermost.com builds from ``files``.

    ``read(path)`` returns a file's text. ``slugged`` names the files with a frontmatter
    slug; None reads every page to find out.
    """

    def __init__(self, files: list[str], read, slugged: set | None = None, redirects: str | None = None):
        self.read = read
        self.pages = {}
        for path in files:
            if os.path.basename(path).startswith("_"):
                continue
            needs_content = slugged is None or path in slugged
            url = docs_page_url(path, read(path) if needs_content else None)
            if url:
                self.pages.setdefault(_site_path(url[len(DOCS_SITE):]), path)
        self.redirects = {}
        for redirect in json.loads(redirects or "{}").get("redirects", []):
            self.redirects[_site_path(redirect["from"])] = redirect["to"]
        self._anchors = {}

    @classmethod
    def at(cls, ref: str) -> "DocsSite":
        roots = [root.rstrip("/") for root, _ in DOCS_ROOTS]
        listing = _git("ls-tree", "-r", "--name-only", ref, "--", *roots)
        if listing.returncode != 0:
            raise RuntimeError(f"git ls-tree {ref} failed: {listing.stderr.strip()}")
        grep = _git("grep", "-l", "-E", "^slug:", ref, "--", *roots)
        slugged = {line.split(":", 1)[1] for line in grep.stdout.splitlines() if ":" in line}
        files = [line for line in listing.stdout.splitlines() if re.search(r"\.mdx?$", line)]
        return cls(files, lambda path: git_show(ref, path), slugged, git_show(ref, REDIRECTS_FILE))

    def anchors(self, path: str, seen: frozenset = frozenset()) -> set[str]:
        """The ids a page's headings and explicit ``id=`` attributes get, partials included."""
        if path in self._anchors:
            return self._anchors[path]
        text = re.sub(r"(?ms)^\s*(```|~~~).*?^\s*\1", "", self.read(path) or "")
        anchors, counts = set(), {}
        for heading in re.findall(r"(?m)^#{1,6}\s+(.+?)\s*$", text):
            slug = heading_anchor(heading)
            if not re.search(r"\\?\{#[^}]+\}\s*$", heading):
                count = counts.get(slug, 0)
                counts[slug] = count + 1
                slug = f"{slug}-{count}" if count else slug
            anchors.add(slug)
        anchors |= set(re.findall(r"""\b(?:id|name)=["']([^"']+)["']""", text))
        for partial in re.findall(r"""(?m)^import\s+\w+\s+from\s+['"](\.{1,2}/[^'"]+\.mdx?)['"]""", text):
            included = os.path.normpath(os.path.join(os.path.dirname(path), partial))
            if included not in seen:
                anchors |= self.anchors(included, seen | {path})
        self._anchors[path] = anchors
        return anchors

    def resolve(self, url: str) -> tuple[str | None, str | None]:
        """(the docs file ``url`` is served from, why it does not resolve).

        Both are None for a link that is not checked: another site, or the API
        reference, which is generated at build time.
        """
        match = DOCS_URL_RE.fullmatch(url)
        if not match:
            return None, None
        path, anchor = _site_path(match.group("path")), match.group("anchor") or ""
        anchor = re.sub(r"\.html$", "", anchor)
        if path == "/api" or path.startswith("/api/"):
            return None, None
        for _ in range(5):
            if path in self.pages or path not in self.redirects:
                break
            target, _, redirect_anchor = self.redirects[path].partition("#")
            path, anchor = _site_path(target), anchor or re.sub(r"\.html$", "", redirect_anchor)
        page = self.pages.get(path)
        if page is None:
            return None, f"no docs page is served at {path}"
        if anchor and anchor not in self.anchors(page):
            return page, f"{page} has no heading or id that gives #{anchor}"
        return page, None

    def check(self, url: str) -> str | None:
        """Why ``url`` does not resolve, or None when it does (or is not checked)."""
        return self.resolve(url)[1]

    def title(self, url: str) -> str | None:
        page, _ = self.resolve(url)
        return page_title(page, self.read(page)) if page else None


def docs_urls(text: str) -> list[str]:
    return [match.group(0).rstrip(".,;:") for match in DOCS_URL_RE.finditer(text or "")]


def added_lines(diff: str) -> list[tuple[str, int, str]]:
    """(file, line number, text) for each line a unified diff adds."""
    lines, path, number = [], None, 0
    for line in diff.splitlines():
        if line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@"):
            number = int(re.match(r"@@ -\S+ \+(\d+)", line).group(1))
        elif line.startswith("+") and path:
            lines.append((path, number, line[1:]))
            number += 1
        elif not line.startswith("-") and path:
            number += 1
    return lines


def broken_links(lines: list[tuple[str, int, str]], site: DocsSite) -> list[dict]:
    problems = []
    for path, number, text in lines:
        for url in docs_urls(text):
            problem = site.check(url)
            if problem:
                problems.append({"file": path, "line": number, "url": url, "problem": problem})
    return problems


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
    if command == "check-links" and len(argv) > 2:
        # Only the lines this change adds: older entries link pages that have since moved,
        # which is for the docs team's own link check, not a reason to block this PR.
        diff = _git("diff", "--unified=0", f"{argv[2]}...HEAD", "--", CHANGELOG_GLOB)
        if diff.returncode != 0:
            raise RuntimeError(f"git diff {argv[2]}...HEAD failed: {diff.stderr.strip()}")
        lines = added_lines(diff.stdout)
        problems = broken_links(lines, DocsSite.at("HEAD"))
        checked = sum(len(docs_urls(text)) for _, _, text in lines)
        for p in problems:
            print(f"::error file={p['file']},line={p['line']},title=Broken docs link::{p['url']}: {p['problem']}")
        print(f"{checked} docs.mattermost.com link(s) added to the changelog; {len(problems)} broken")
        return 1 if problems else 0
    print("usage: changelog_release.py resolve | reviewers SECTIONS_JSON | check-links BASE_REF", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
