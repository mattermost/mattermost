#!/usr/bin/env python3
"""
Generate a changelog from merged PR release notes for a given milestone.

Expects these environment variables:
  GITHUB_TOKEN      - GitHub personal access token or Actions token
  REPOS             - Comma-separated list of repositories in "owner/repo" format
                      (e.g. "mattermost/mattermost,mattermost/enterprise")
  MILESTONE         - Milestone title (e.g. "v11.7.0")
  VERSION           - Version label for the changelog entry (e.g. "v11.7.0")
  RELEASE_TYPE      - (optional) "feature" (default), "major" (a vX.0 release), or
                      "esr" (Extended Support Release). Selects the heading label and
                      the anchor slug other docs pages deep-link to.
  RELEASE_DATE      - (optional) Release day date (e.g. "2026-05-15"). Defaults to today,
                      or to "TBD" on a scheduled run (EVENT_NAME=schedule), which is
                      reported in the preflight checks.
  GO_VERSION        - (optional) Go version used in this release (e.g. "go1.22.5").
                      If not provided, it is read from RELEASE_HEAD_REF's
                      server/build/Dockerfile.buildenv, then from the previous entry.
  RELEASE_HEAD_REF  - (optional) Git ref of this release, e.g. "origin/release-12.1".
  RELEASE_BASE_REF  - (optional) Git ref of the previous release, e.g. "v12.0.0". With
                      both set, plugin version changes, WebSocket events and schema
                      migrations between them are added as notes (see changelog_release.py).
  SOURCES_SEED_BEFORE - (update mode, optional) When the changelog PR body has no
                      changelog-sources list (a PR opened before it existed), propose the
                      PRs merged before this ISO time — when the PR branch was last
                      updated — in the run summary for a reviewer to confirm and add to
                      the body, instead of failing. Nothing is changed on such a run.
  DRY_RUN           - (optional) "true" allows create mode to run for a version whose
                      entry already exists in the changelog file, for previews.
  BLOG_POST_URL     - (optional) Blog post URL for the Improvements section.
                      Auto-constructed from VERSION if not provided.
  ANTHROPIC_API_KEY - (optional) If set, release notes are polished by Claude
                      before being written to the changelog.
  CHANGELOG_PATH    - (optional) Path to the changelog file to update. Defaults to the
                      file for VERSION's major release, e.g. "v11.9.0" ->
                      "docs/main/product-overview/mattermost-v11-changelog.mdx".
  MODE              - (optional) "create" (default) writes a complete new entry.
                      "update" adds only the notes from PRs not yet in the existing
                      entry, leaving everything already there — including reviewers'
                      edits — untouched. Requires PR_BODY_FILE.
  PR_BODY_FILE      - (update mode) Path to a file holding the open changelog PR's body,
                      whose changelog-sources comment lists the PRs already included.
  OUTPUT_DIR        - (optional) Directory for machine-readable output: entry.mdx (the
                      text written), sections.json (each section's bullets and the PRs
                      they came from) and pr_body.md (the body the changelog PR should
                      have), summary.md and, when the model was asked, model_output.md (its
                      raw answers). Nothing is written there if unset.

The target changelog is an MDX file: it opens with YAML frontmatter, imports MDX
components, and uses JSX elements such as <Note> and <Important>. Generated content
must therefore be MDX-safe (see the "MDX safety" rule in SYSTEM_PROMPT).
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import requests
from datetime import date, datetime, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import changelog_release  # noqa: E402
import check_config_changes_ci as config_checker  # noqa: E402  (its router parser)

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
REPOS = [r.strip() for r in os.environ["REPOS"].split(",") if r.strip()]
MILESTONE_TITLE = os.environ["MILESTONE"]
VERSION = os.environ["VERSION"]
RELEASE_DATE_PLACEHOLDER = "TBD"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}

# Shared timeout for all GitHub API requests (seconds).
# Prevents the workflow from hanging indefinitely if the API stalls.
API_TIMEOUT = 30

# Standard requests retry strategy using urllib3 — handles transient failures
# (rate limits, server errors) with exponential back-off and respects Retry-After.
GITHUB_RETRY = Retry(
    total=5,
    connect=5,
    read=5,
    backoff_factor=1,
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=frozenset(["GET"]),
    respect_retry_after_header=True,
)
GITHUB_ADAPTER = HTTPAdapter(max_retries=GITHUB_RETRY)
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
SESSION.mount("https://", GITHUB_ADAPTER)

SYSTEM_PROMPT = """You are an expert technical writer and copyeditor for Mattermost software release notes. Your task is to transform raw, unstructured release notes from pull requests into a clean, categorized, and grammatically correct changelog entry that matches Mattermost's established changelog format exactly.

Here are your instructions:

1.  **Section structure:** Use `###` for top-level sections and `####` for subsections. Only include sections that have relevant content — do not output empty sections. NEVER output a horizontal rule (`---`) between sections or anywhere else. Do NOT add a blank line between a section/subsection heading and its first bullet point.

    Top-level sections and their subsections, in this order:

    - `### Upgrade Impact` — for changes that affect upgrading, with subsections as applicable:
        - `#### Database Schema Changes` — schema migrations such as new tables, new columns, changed columns, or new indexes. Lead with a single summary bullet, then nest each individual change beneath it. Use this exact shape:

           - The following schema changes are included in the VERSION release. No database downtime is expected for this upgrade.
             - Added a new ``Watermarks`` table.
             - Added a new column ``DeleteAt`` to the ``ChannelMembers`` table.

          (Write the real version number in place of VERSION. The summary bullet uses one space; each change uses three.)
        - `#### config.json` — new or changed configuration settings. Use this exact block format for each plan grouping (no blank line between the `#### config.json` heading and the description paragraph, and no blank line between the description paragraph and the first bullet):
          New setting options were added to ``config.json``. Below is a list of the additions and their default values on install. The settings can be modified in ``config.json``, or the System Console when available.
           - **Changes to Enterprise Advanced plan:**
             - Under ``ExperimentalSettings`` in ``config.json``, added ``EnableWatermark`` configuration setting to add watermarking toggle in the server.
           - Removed ``LdapSettings.LoginButtonColor`` configuration setting from the database.

          Write every new setting under a single " - **Changes to All Plans:**" bullet, in the "Under ``Section`` in ``config.json``, added ``Setting`` configuration setting ..." form: the plan groupings are worked out afterwards from the code, so never guess a plan. Plan bullets use one space; the settings beneath them use three. Removed settings are listed as top-level one-space bullets, not under a plan grouping.
        - `#### Important Upgrade Notes` — changes an administrator must act on or know about when upgrading: minimum version requirement changes for browsers, OS, or clients, defaults that change, settings or inputs that are now rejected. Example: "Updated minimum Edge and Chrome versions to 146+."
    - `### Improvements` — for new features and enhancements only. Do NOT place items beginning with "Fixed..." here — those belong in Bug Fixes. The line immediately after the `### Improvements` heading — with NO blank line between them — must be `See BLOG_POST_LINK on the highlights in our latest release.` (use the exact placeholder `BLOG_POST_LINK`; it is replaced automatically with a Markdown link). Then a blank line, then the first `####` subsection heading. It must look exactly like this:

      ### Improvements
      See BLOG_POST_LINK on the highlights in our latest release.

      #### User Interface
       - First item.

      Subsections, as applicable:
        - `#### User Interface` — user interface and UX changes and new visual features. Pre-packaged plugin version updates go at the TOP of this subsection, before other items. Always write "user interface" in full — never abbreviate as "UI".
        - `#### Plugins/Integrations` — plugin and integration improvements (use as a separate subsection when there are enough items to warrant it)
        - `#### Administration` — System Console features, logging, support packet changes
        - `#### mmctl` — every bullet mainly about mmctl commands or flags (it adds or changes an ``mmctl`` command or flag), even when there is only one. Never put such a bullet under `#### Administration`; a bullet mainly about a System Console feature that also mentions an mmctl command stays under Administration.
        - `#### Performance` — performance improvements
    - `### Bug Fixes` — corrections to defects. All items starting with "Fixed an issue..." go here, even if the raw note appeared in an Improvements context.
    - `### API Changes` — API additions, changes, or deprecations
    - `### WebSocket Event Changes` — new or changed WebSocket events, if applicable
    - `### Audit Log Event Changes` — new or changed audit log events
    - `### Go Version` — Always include this section. The Go version content will be injected automatically — output only this heading with no content beneath it.
    - `### Open Source Components` — open source component additions or removals. Format each item as: "Added ``<package>`` to <repo_url>." or "Removed ``<package>`` from <repo_url>." Example: "Added ``x/text`` to https://github.com/mattermost/mattermost/." Only include if there are relevant notes.
    - `### Security` — security-related fixes not already covered under Bug Fixes

2.  **Sentence patterns:** Follow these conventions consistently:
    - New features and additions: "Added [feature]..." or "Added support for [feature]..."
    - Bug fixes: "Fixed an issue where..." or "Fixed an issue with..." — never use "Fixed a bug"; always use "Fixed an issue".
    - Improvements to existing things: "Improved [thing]..." or "Updated [thing]..."
    - Removals: "Removed [thing]..."

3.  **Terminology:** Always write "user interface" in full — never use the abbreviation "UI". Always spell out messaging abbreviations: "DM" → "Direct Message", "GM" → "Group Message", "DM/GM" → "Direct/Group Message".

    **Never shorten an identifier.** API endpoint paths, configuration setting names, command names, table and column names, and feature flags must be reproduced from the raw note exactly, in full. Do not abbreviate a path to its last segment (``/api/v4/ephemeral_mode/cleanup`` must never become ``/cleanup``), and do not drop a setting's group prefix. Copy the identifier character for character; if the raw note does not give a full path, use whatever it does give rather than inventing a shorter one.

4.  **Code formatting:** Use double backticks for all of the following:
    - Configuration settings (e.g., ``ServiceSettings.EnableDynamicClientRegistration``)
    - API endpoints (e.g., ``/api/v4/posts``)
    - Command names (e.g., ``mmctl license get``)
    - Environment variables (e.g., ``MM_LOG_PATH``)
    - Database table and column names (e.g., ``channelmembers.autotranslation``)
    - File names (e.g., ``config.json``)
    - Feature flags (e.g., ``MM_FEATUREFLAGS_CJKSEARCH``)
    - Package names in Open Source Components (e.g., ``x/text``)

    Never put plain words, product terms or acronyms in code formatting: write AI, SAML, SSO or "AI-generated", never ``AI`` or ``AI``-generated. Double backticks are for identifiers only.

5.  **Markdown formatting — indentation is exact:**
    - Top-level bullets are indented with exactly ONE space: ` - item`
    - Nested bullets are indented with exactly THREE spaces: `   - nested item`
    - Never use two or four spaces. This applies to every section without exception.
    - NEVER output a horizontal rule (`---`) or any other separator line anywhere in the output. Sections are separated by their headings alone. A `---` line will corrupt the document.
    - Do not add a blank line between a section/subsection heading and the first line beneath it, whether that line is a bullet or a paragraph.
    - Do add a single blank line before each new heading.

6.  **MDX safety:** The changelog is an `.mdx` file, so raw `{`, `}`, and `<` characters are parsed as JSX and will break the docs build. Therefore:
    - Never output a bare `{` or `}` in prose. If a release note needs braces, wrap the text in double backticks (e.g. ``{"key": "value"}``) so it becomes inline code.
    - Never output a bare `<` followed by a letter (e.g. `<Note>`, `<div>`, `<T>`). Wrap such text in double backticks, or rewrite it (e.g. "less than 5" instead of "<5").
    - Do not emit JSX/HTML components yourself. Components like `<Note>` and `<Important>` already exist in the file and are added manually — never generate, duplicate, or close them.
    - Use standard Markdown links (`[text](url)`) and plain Markdown bullets only.

7.  **License requirements:** When a feature requires a specific Mattermost license, note it inline at the end of the bullet point (e.g., "Requires Enterprise Advanced license" or "Requires Enterprise license").

8.  **One section per release note:** Each raw release note must appear in exactly one section — whichever section best fits its primary purpose. Do not split a single release note across multiple sections or subsections, even if it touches more than one area (e.g. an admin feature that also introduces an API endpoint belongs entirely in Administration, not partially in Administration and partially in API Changes).

9.  **Proofreading:** Correct any typos, grammatical errors, awkward phrasing, or inconsistencies. Replace any instance of "Fixed a bug" with "Fixed an issue". Aim for clear, concise, and professional language.

10.  **Tone:** Maintain a neutral, informative, and professional tone consistent with technical documentation.

11.  **Focus:** Output only the section content (headings and bullet points). Do not include the release version header line or any introductory or concluding remarks from yourself.

12.  **Source markers:** Each raw release note begins with an ID in square brackets, such as `[N12]`. Every note you are given must appear in your output: end every bullet you write with the ID of the note it came from in double square brackets, separated from the text by one space: ` - Fixed an issue where the channel header was hidden. [[N12]]`. A note with no marker on any bullet is treated as left out of the changelog, so check before you answer that every ID you were given appears at least once. If a bullet combines several related notes, it must carry the ID of every note it combines, either in one marker or in several: `[[N3,N7]]` or `[[N3]][[N7]]`. Never merge a note into another bullet without adding its ID to that bullet. Do not put a marker on headings, on the `See BLOG_POST_LINK` line, on the config.json description paragraph, on plan-label bullets such as ` - **Changes to All plans:**`, or on the Database Schema Changes summary bullet; put it on the bullets nested beneath them instead. Never write a marker anywhere else. Markers are removed automatically before publishing.

13.  **Notes read from the release diff:** Some notes were not written by a developer but read from the code: pre-packaged plugin version changes, added or removed WebSocket events, and database schema migrations (given as SQL). The benchmarking result is added automatically; never write a benchmarking bullet. Place each in its section: plugin versions at the top of `#### User Interface` (keep the plugin bullet text and link exactly as given), WebSocket events under `### WebSocket Event Changes`, and migrations under `#### Database Schema Changes`. When a developer's note already describes the same change, write one bullet that combines them and carries both IDs, rather than two bullets saying the same thing. A developer's note about a schema change listed under `#### Database Schema Changes` (its PR added that migration, or the note names it) goes into that migration's bullet, carrying both IDs: never write a second bullet for it in another section. Never write a migration number (such as ``000238``) or migration file name anywhere outside `#### Database Schema Changes`.

14.  **Documentation links:** A note may end with a `Docs page:` line, found by following its PR to the documentation that PR changed. Link that note's bullet to that URL, exactly as given, wherever the bullet goes (under `### Improvements`, `#### config.json`, `#### Important Upgrade Notes` or any other section), by linking the feature's name the way existing entries do: ` - Added [channel attributes](https://docs.mattermost.com/administration-guide/manage/admin/channel-attributes) on Enterprise Advanced.` Link each page once. Never add a docs.mattermost.com link that was not given in a note.

15.  **Verbs:** Start a bullet with "Added" only when the note is about something new being added. A note that is already a sentence with its own verb (such as "``GET /api/v4/posts/{post_id}/thread`` with ``updatesOnly=true`` now includes deleted replies") is kept as that sentence, or rewritten with a fitting verb ("Updated ... so that ..."); never put "Added" in front of it.

16.  **Dependency changes that change behaviour:** A note that replaces or upgrades a library and also says what now behaves differently for administrators or users (what is now rejected, required or checked) goes under `#### Important Upgrade Notes` in `### Upgrade Impact`, not under `### Open Source Components` or `### Improvements`. When another note under `#### Important Upgrade Notes` describes the same change, write one bullet that combines them and carries both IDs. Notes that name the same ticket (their `Ticket:` lines match), or the same library, describe one change: never write two Important Upgrade Notes bullets for them."""


def get_milestone_number(repo: str, title: str) -> int | None:
    """Look up the numeric ID for a milestone by its title in the given repo."""
    url = f"https://api.github.com/repos/{repo}/milestones"
    page = 1
    recent_titles = []
    while True:
        params = {
            "state": "all",
            "per_page": 100,
            "page": page,
            "sort": "due_on",       # sort by due date
            "direction": "desc",    # most recently due first, so active milestones are found quickly
        }
        resp = SESSION.get(url, params=params, timeout=API_TIMEOUT)
        resp.raise_for_status()
        milestones = resp.json()
        if not milestones:
            break
        for m in milestones:
            if m["title"] == title:
                return m["number"]
        if page == 1:
            recent_titles = [m["title"] for m in milestones[:10]]
        page += 1
    print(f"  ⚠️  Milestone '{title}' not found in {repo} — skipping")
    if recent_titles:
        print(f"     Most recently due milestones: {', '.join(recent_titles)}")
    return None


def docs_site(ref: str) -> "changelog_release.DocsSite":
    """The docs site at ``ref``, for mapping and checking doc links."""
    return changelog_release.DocsSite.at(ref)


def is_rate_limited(response) -> bool:
    """A 403 that is GitHub's rate limit, which says nothing about the token's access."""
    headers = response.headers if response is not None else {}
    return headers.get("X-RateLimit-Remaining") == "0" or "Retry-After" in headers


def repo_is_private(repo: str) -> bool:
    """Whether ``repo`` is private, so its PR links are marked for readers who can't open them."""
    resp = SESSION.get(f"https://api.github.com/repos/{repo}", timeout=API_TIMEOUT)
    resp.raise_for_status()
    return bool(resp.json().get("private"))


def get_merged_prs(repo: str, milestone_number: int) -> list:
    """Fetch all merged PRs belonging to the given milestone in the given repo."""
    prs = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/{repo}/issues"
        params = {
            "milestone": milestone_number,
            "state": "closed",
            "per_page": 100,
            "page": page,
        }
        resp = SESSION.get(url, params=params, timeout=API_TIMEOUT)
        resp.raise_for_status()
        items = resp.json()
        if not items:
            break
        for item in items:
            if "pull_request" not in item:
                continue  # plain issue, not a PR
            if item["pull_request"].get("merged_at"):
                prs.append(item)
            else:
                # merged_at can be null for very recently merged PRs due to an API
                # propagation delay. Verify directly against the Pulls API.
                pr_url = f"https://api.github.com/repos/{repo}/pulls/{item['number']}"
                pr_resp = SESSION.get(pr_url, timeout=API_TIMEOUT)
                pr_resp.raise_for_status()
                pr_data = pr_resp.json()
                if pr_data.get("merged"):
                    item["pull_request"]["merged_at"] = pr_data.get("merged_at")
                    prs.append(item)
        page += 1
    return prs


# What a release-note block holds when its author decided the PR needs no note.
NO_NOTE_CONTENT = {"NONE", "N/A", "NA", "---", ""}


def release_note_blocks(body: str) -> list[str]:
    """The trimmed contents of every ```release-note fence in ``body``.

    Comments are stripped first: the unfilled PR template holds two example fences, one
    of them NONE. The tag is required, at any heading level or with no heading at all,
    because untagged fences in PR bodies hold spinwick commands and attachment dumps.
    """
    text = re.sub(r"<!--.*?-->", "", (body or "").replace("\r\n", "\n").replace("\r", "\n"), flags=re.DOTALL)
    return [block.strip() for block in re.findall(r"```release-note[ \t]*\n(.*?)\n?```", text, re.DOTALL)]


# Docs live in this repo; a docs PR for an enterprise feature is opened here too.
DOCS_REPO = "mattermost/mattermost"
DETAIL_WORKERS = 8


def get_pr_details(repo: str, number: int) -> dict:
    """A PR's branch name and, for DOCS_REPO, the docs files it changed with their patches and
    the schema migrations it added."""
    resp = SESSION.get(f"https://api.github.com/repos/{repo}/pulls/{number}", timeout=API_TIMEOUT)
    resp.raise_for_status()
    details = {"head_ref": resp.json().get("head", {}).get("ref", ""), "files": []}
    page = 1
    while repo == DOCS_REPO:
        resp = SESSION.get(
            f"https://api.github.com/repos/{repo}/pulls/{number}/files",
            params={"per_page": 100, "page": page}, timeout=API_TIMEOUT,
        )
        resp.raise_for_status()
        batch = resp.json()
        details["files"] += [
            {"filename": f["filename"], "status": f.get("status"), "patch": f.get("patch")}
            for f in batch if f["filename"].startswith("docs/")
        ]
        details["migrations"] = details.get("migrations", []) + [
            os.path.basename(f["filename"]).removesuffix(".up.sql") for f in batch
            if f["filename"].startswith(changelog_release.MIGRATIONS_DIR + "/") and f["filename"].endswith(".up.sql")
            and f.get("status") == "added"
        ]
        if len(batch) < 100:
            break
        page += 1
    return details


MAX_MERGED_PAGES = 30  # 3,000 PRs: well past a month of merges


def merged_prs_since(repo: str, since: str) -> dict:
    """The PRs merged into ``repo`` since ``since`` (ISO 8601), as ``{owner/repo#N: {title, body}}``.

    Closed PRs are listed most recently updated first, so the listing stops at the first page
    that reaches PRs last updated before ``since``: a PR merged since then was updated since then.
    """
    found = {}
    for page in range(1, MAX_MERGED_PAGES + 1):
        resp = SESSION.get(f"https://api.github.com/repos/{repo}/pulls", params={
            "state": "closed", "sort": "updated", "direction": "desc", "per_page": 100, "page": page,
        }, timeout=API_TIMEOUT)
        resp.raise_for_status()
        batch = resp.json()
        for pr in batch:
            if pr.get("merged_at") and parse_github_time(pr["merged_at"]) >= parse_github_time(since):
                found[f"{repo}#{pr['number']}"] = {"title": pr.get("title") or "", "body": pr.get("body") or ""}
        if len(batch) < 100 or parse_github_time(batch[-1]["updated_at"]) < parse_github_time(since):
            return found
    print(f"::warning title=Docs PRs not all read::more than {MAX_MERGED_PAGES * 100} PRs were closed in {repo} "
          f"since {since}; older ones were not checked for links to this release's PRs")
    return found


def release_branch_cut(base_ref: str, repo: str = DOCS_REPO, default_branch: str = "master") -> str | None:
    """When the previous release's branch was cut: the date of its merge base with master.

    ``base_ref`` is the previous release's tag or branch (``v12.1.0``, ``origin/release-12.1``).
    Read from GitHub's compare API, since the workflow's shallow clone has no merge base.
    """
    match = re.search(r"(\d+)\.(\d+)", base_ref or "")
    if not match:
        return None
    branch = f"release-{match.group(1)}.{match.group(2)}"
    try:
        resp = SESSION.get(f"https://api.github.com/repos/{repo}/compare/{default_branch}...{branch}",
                           params={"per_page": 1}, timeout=API_TIMEOUT)
        resp.raise_for_status()
        return resp.json()["merge_base_commit"]["commit"]["committer"]["date"]
    except (requests.RequestException, KeyError, TypeError, ValueError) as err:
        print(f"::warning title=Release branch cut not found::{branch}: {type(err).__name__}; docs PRs outside the "
              "milestone were not checked")
        return None


def outside_docs_prs(prs: dict, sources: set, since: str | None, merged_since=None) -> dict:
    """Docs PR candidates outside the milestone: PRs in DOCS_REPO merged since the previous release's
    branch was cut (``since``) that aren't milestone PRs and link one of ``sources``. Marked ``"outside"``."""
    if not since:
        return {}
    found = {}
    for other, info in (merged_since or merged_prs_since)(DOCS_REPO, since).items():
        if other not in prs and changelog_release.pr_references(info["body"], DOCS_REPO) & sources:
            found[other] = {**info, "outside": True}
    return found


def find_docs_links(prs: dict, sources: set, read_file, details_out: dict | None = None,
                    outside: dict | None = None) -> dict:
    """``changelog_release.docs_link`` for each source PR, fetching PR details in parallel.

    ``outside`` holds docs PRs from outside the milestone (see ``outside_docs_prs``); they are
    matched only by linking a PR. The details fetched are also put in ``details_out``, when
    given, so the migrations each PR added can be read without fetching them again.
    """
    from concurrent.futures import ThreadPoolExecutor

    every = {**(outside or {}), **prs}
    keys = sorted(every)
    with ThreadPoolExecutor(DETAIL_WORKERS) as pool:
        details = dict(zip(keys, pool.map(lambda s: get_pr_details(*_split_source(s)), keys)))
    if details_out is not None:
        details_out.update({source: details[source] for source in prs})
    info = {source: {**every[source], "head_ref": details[source]["head_ref"]} for source in keys}
    return {
        source: changelog_release.docs_link(source, info, lambda s: details[s]["files"], read_file)
        for source in sorted(sources, key=_source_sort_key)
    }


def _split_source(source: str) -> tuple[str, int]:
    """``(repo, number)`` from a ``owner/repo#123`` source key."""
    repo, _, number = source.partition("#")
    return repo, int(number)


_DOCS_LINE_RE = re.compile(r"(?im)^[ \t]*Docs:[ \t]*(.*?)[ \t]*$\n?")


def split_docs_line(note: str) -> tuple[str, str | None]:
    """A release note without its ``Docs: <url>`` line, and the docs URL that line names.

    The author knows which page documents the change, so it outranks the docs page
    found by following the PR. A path is taken as relative to docs.mattermost.com.
    """
    url = None
    for value in _DOCS_LINE_RE.findall(note):
        value = re.sub(r"^\[[^\]]*\]\((.*)\)$|^<(.*)>$", lambda m: m.group(1) or m.group(2), value.strip())
        if value.startswith("/"):
            value = changelog_release.DOCS_SITE + value
        if url is None and changelog_release.DOCS_URL_RE.fullmatch(value):
            url = value
    return _DOCS_LINE_RE.sub("", note).strip(), url


def extract_release_notes(body: str) -> list[str] | None:
    """The release notes in a PR body, or None when it has none (missing, NONE, N/A, empty)."""
    notes = [block for block in release_note_blocks(body) if block.upper() not in NO_NOTE_CONTENT]
    return notes or None


# Labels that record a deliberate "no release note" decision.
NO_NOTE_LABELS = {"release-note-none", "release-note/none", "release-note/na", "Changelog/Not Needed"}


def release_note_status(body: str) -> str:
    """"notes" if the PR has a release note, "none" if its author wrote NONE, else "missing"."""
    if extract_release_notes(body):
        return "notes"
    text = re.sub(r"<!--.*?-->", "", (body or "").replace("\r\n", "\n"), flags=re.DOTALL)
    section = re.search(r"#+\s+Release\s+Notes?\s*\n(.*?)(?=\n#|\Z)", text, re.DOTALL | re.IGNORECASE)
    written = [block for block in release_note_blocks(body) if block]
    if section and re.fullmatch(r"\s*(NONE|N/?A)\.?\s*", section.group(1), re.IGNORECASE):
        written.append("NONE")
    return "none" if written else "missing"


def flag_reason(status: str, labels: set) -> str | None:
    """Why a merged PR needs a human look before its notes are silently left out, or None.

    An opt-out label settles it even next to the release-note label, which some PRs
    carry together with Changelog/Not Needed.
    """
    if labels & NO_NOTE_LABELS:
        return None
    if "release-note" in labels and status != "notes":
        return "labelled release-note, but no release note was found in the PR body"
    if status == "missing" and not labels & NO_NOTE_LABELS:
        return "no release note and no release-note-none label"
    return None


def cherry_picked_from(title: str) -> int | None:
    """The PR a cherry-pick was made from: "Automated cherry pick of #39121", "Fix x (#39291)"."""
    match = re.search(r"cherry[- ]?pick(?:ed)? (?:of )?#(\d+)|\(#(\d+)\)\s*$", title or "", re.IGNORECASE)
    return int(match.group(1) or match.group(2)) if match else None


MIN_NOTE_WORDS = 6
# "Added `DELETE /` (`handler`) API endpoint." comes from the config-change checker when it
# loses the route's prefix, so the line names no endpoint.
_PATHLESS_API_RE = re.compile(
    r"(?im)^(?:Added|Removed)[ \t]+`{1,2}[ \t]*(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)[ \t]*)?/?[ \t]*`{1,2}[^\n]*API endpoint\.?[ \t]*$"
)
_TICKET_RE = re.compile(r"(?i)^(?:fix(?:es|ed)?\s+)?(?:MM-\d+|#\d+|https?://\S+)[.\s]*$")
# Plugin bumps and dependency or setting lines are short by house style.
_TERSE_BY_STYLE_RE = re.compile(r"(?i)\bplugin\b|\bversion\s+v?\d|`|\]\(")


def note_quality_issue(text: str) -> str | None:
    """Why a release note that passes the gate will still need rewriting, or None.

    Only the cases that can be told from the text: generated content (the API-docs bot
    writes "🆕 New API file: x_test.go" lines into the fence), a bare ticket reference,
    an API endpoint line with no path, or a note too short to say what changed.
    """
    text = text.strip()
    if any(line.strip()[:1] and unicodedata.category(line.strip()[0]) == "So" for line in text.splitlines()):
        return "machine-generated content"
    if _PATHLESS_API_RE.search(text):
        return "an API endpoint with no path"
    if _TICKET_RE.match(text):
        return "a bare ticket reference"
    if len(text.split()) < MIN_NOTE_WORDS and not _TERSE_BY_STYLE_RE.search(text):
        return f"under {MIN_NOTE_WORDS} words"
    return None


# "Removed `GET /posts` (`getPostsUsage`) API endpoint.", as config-change-checker writes it.
# Older runs of the checker dropped the subrouter's prefix, so the path is often partial.
_ENDPOINT_LINE_RE = re.compile(
    r"^[ \t]*(?P<verb>Added|Removed)[ \t]+`{1,2}[ \t]*(?P<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)[ \t]*"
    r"(?P<path>/[^`]*?)?[ \t]*`{1,2}[ \t]*\(`{1,2}(?P<handler>\w+)`{1,2}\)[ \t]*API endpoint\.?[ \t]*$"
)
API4_DIR = "server/channels/api4/"
UNRESOLVED_ENDPOINT = "an API endpoint whose full path isn't in the router"
_ENDPOINTS_AT: dict = {}


def endpoints_at(ref: str, show=changelog_release.git_show, ls=changelog_release.git_ls) -> set:
    """Every api4 endpoint registered at ``ref``, with its full path, as (path, handler, method)."""
    if ref not in _ENDPOINTS_AT:
        files = [path for path in ls(ref, API4_DIR) if path.endswith(".go") and not path.endswith("_test.go")]
        sources = [show(ref, path) or "" for path in files]
        _ENDPOINTS_AT[ref] = config_checker.router_endpoints(sources, show(ref, config_checker._API_ROUTES_PATH) or "")
    return _ENDPOINTS_AT[ref]


def endpoint_lookup(base_ref: str, head_ref: str, at=None):
    """The routers to search for a line's endpoint: a removed one was last registered at the
    previous release, an added one at this release's branch. Either falls back to the other."""
    def lookup(verb: str):
        for ref in ([base_ref, head_ref] if verb == "Removed" else [head_ref, base_ref]):
            if not ref:
                continue
            try:
                yield (at or endpoints_at)(ref)
            except RuntimeError as err:
                print(f"::warning title=Router not read::{ref}: {err}")
    return lookup


def resolve_endpoint_lines(text: str, lookup) -> tuple[str, list[str]]:
    """Give each config-change-checker endpoint line its full path, read from the router.

    "Removed `GET /posts` (`getPostsUsage`) API endpoint." becomes "Removed ``GET
    /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.": the route with that handler and
    method whose full path ends with the one given. A line whose endpoint can't be found, or
    matches several routes, is taken out of the note, so no partial path is printed, and is
    returned to be flagged in the report.
    """
    out, unresolved = [], []
    for line in text.split("\n"):
        match = _ENDPOINT_LINE_RE.match(line)
        if not match:
            out.append(line)
            continue
        verb, method, handler = match.group("verb"), match.group("method"), match.group("handler")
        path = config_checker._shorten_path_vars((match.group("path") or "").strip()) or "/"
        if path.startswith("/api/"):
            out.append(f"{verb} ``{method} {path}`` (``{handler}``) API endpoint.")
            continue
        found = set()
        for endpoints in lookup(verb):
            found = {full for full, name, how in endpoints
                     if name == handler and how == method and (path == "/" or full.endswith(path))}
            if found:
                break
        if len(found) == 1:
            out.append(f"{verb} ``{method} {found.pop()}`` (``{handler}``) API endpoint.")
        else:
            unresolved.append(f"{verb} {method} {path} ({handler})")
    return "\n".join(out).strip(), unresolved


def pr_owner(pr: dict) -> str | None:
    """Who to ask about a PR: its author, or for a bot-authored PR its first assignee."""
    user = pr.get("user") or {}
    login = user.get("login") or ""
    if login and user.get("type") != "Bot" and not login.endswith("[bot]"):
        return login
    assignees = pr.get("assignees") or []
    return assignees[0]["login"] if assignees else None


def parse_github_time(value: str) -> datetime:
    """A timezone-aware datetime from a GitHub API timestamp."""
    return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))


def seed_sources(notes: list[dict], cutoff: str) -> set:
    """The sources a changelog PR opened before source tracking probably covers.

    Such a PR has no changelog-sources list. ``cutoff`` is when its branch was last
    updated: it was generated from the PRs merged before it was opened, and reviewers
    keep it current by hand from then on. Derived notes are included because such a PR
    predates them, so any plugin or schema bullets in it were written by hand.

    This is a guess, so it is only ever proposed for review, never recorded.
    """
    limit = parse_github_time(cutoff)
    return {
        note["source"] for note in notes
        if note.get("derived") or (note.get("merged_at") and parse_github_time(note["merged_at"]) <= limit)
    }


# Output cap for the polish request. A full feature release is comfortably larger than
# the previous 4096: the v12.0 entry is ~32k characters, roughly 8k tokens.
MAX_OUTPUT_TOKENS = 16384


def _raw_bullets(notes: list[dict]) -> str:
    """The unpolished fallback: each note verbatim as a bullet, tagged with its ID.

    The marker sits on the first line. Later lines of a multi-line note are indented
    so they stay part of that bullet and ``extract_source_markers`` still attributes it.
    """
    blocks = []
    for note in notes:
        text = note.get("fallback") or note["text"]
        lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        blocks.append(f"- {lines[0]} [[{note['id']}]]")
        for line in lines[1:]:
            blocks.append(f"  {line.strip()}" if line.strip() else "")
    return "\n".join(blocks)


def polish_with_ai(notes: list[dict]) -> tuple[str, bool]:
    """
    Send raw release notes to Claude for categorization, formatting, and proofreading.
    Falls back to a simple bullet list if ANTHROPIC_API_KEY is not set.

    Each note is a dict with an ``id`` ("N1", "N2", ...) and its ``text``. The ID is
    sent with the note and every bullet comes back tagged with the IDs it was written
    from, which is what lets ``extract_source_markers`` attribute bullets to PRs.

    Returns the text and whether it was actually polished. The caller needs to know:
    the truncation check only makes sense on polished prose, because raw notes are
    written by PR authors and routinely arrive without a closing full stop.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ℹ️  ANTHROPIC_API_KEY not set — skipping AI polish, using raw notes")
        return _raw_bullets(notes), False

    try:
        import anthropic
    except ImportError:
        print("⚠️  anthropic package not installed — skipping AI polish")
        return _raw_bullets(notes), False

    print("✨ Sending notes to Claude for categorization and proofreading...")
    user_message = f"Here are the raw release notes to process:\n\n{_notes_text(notes)}"
    return _ask_claude(anthropic, api_key, user_message), True


def _notes_text(notes: list[dict]) -> str:
    """The notes as the model reads them: each with its ID, and its docs page when one was found."""
    return "\n\n---\n\n".join(
        f"[{note['id']}] {note['text']}" + (f"\nDocs page: {note['docs_url']}" if note.get("docs_url") else "")
        + (f"\nTicket: {', '.join(note['tickets'])}" if note.get("tickets") else "")
        + (f"\n{note['context']}" if note.get("context") else "")
        for note in notes
    )


def place_missing_with_ai(notes: list[dict]) -> tuple[str, bool]:
    """Ask the model again for only the ``notes`` it left out of its first answer.

    The first answer drops one or two notes now and then, a different few each run, so
    one more request with just those notes is enough in practice. Each must be placed
    in its ``###`` section (and ``####`` subsection) like any other note. Returns the
    text and whether the model was asked at all, like ``polish_with_ai``.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "", False
    try:
        import anthropic
    except ImportError:
        return "", False

    print(f"🔁 Asking Claude to place {len(notes)} note(s) it left out: {', '.join(n['id'] for n in notes)}")
    user_message = (
        "Your first answer left out the release notes below: none of their IDs appeared on any bullet. "
        "Write the bullets for these notes only, each under its own `###` section heading (and `####` "
        "subsection heading where the rules call for one), and end every bullet with the ID of the note it "
        "came from, such as [[N12]]. Every note below must appear. Do not repeat any other note.\n\n"
        f"{_notes_text(notes)}"
    )
    return _ask_claude(anthropic, api_key, user_message), True


def _ask_claude(anthropic, api_key: str, user_message: str) -> str:
    """Send one request with the changelog system prompt and return the text of the answer."""
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        # A full feature release runs well past 4096 output tokens — the v12.0 entry is
        # ~32k characters — and the overflow was silently cut mid-word.
        max_tokens=MAX_OUTPUT_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # The response is truncated, not short, when the output cap is reached. Left
    # unchecked this commits a half-written sentence to customer-facing docs.
    if response.stop_reason == "max_tokens":
        raise RuntimeError(
            f"Claude hit the {MAX_OUTPUT_TOKENS}-token output cap and its response was "
            f"truncated mid-output. Raise MAX_OUTPUT_TOKENS, or split this release's "
            f"notes across more than one request."
        )

    return response.content[0].text.strip()


def normalize_formatting(text: str) -> str:
    """Deterministically correct formatting details the AI commonly gets wrong.

    The system prompt specifies all of these, but model compliance is not guaranteed,
    and each of these mistakes produces a visibly wrong diff. Fixing them here is
    cheap and reliable.

      1. Strip horizontal rules (``---``), which must never appear in a changelog entry.
      2. Normalize bullet indentation to the changelog convention of one space for
         top-level bullets and two more per nesting level (1/3/5). Models variously
         emit 0/2, 1/3 or 2/4, so levels are ranked from the distinct indents within
         each list block rather than measured against a fixed threshold or against a
         single minimum taken across the whole fragment.
      3. Remove a blank line between the ``### Improvements`` heading and the blog
         post line that must immediately follow it.
      4. Drop headings with nothing under them, other than ``### Go Version``.

    MDX safety: rule 1 would otherwise strip the ``---`` delimiters of a YAML
    frontmatter block, which MDX requires at the very start of the file. This is
    normally called only on the AI-generated fragment (which has no frontmatter),
    but a leading frontmatter block is detected and preserved verbatim so the
    function is also safe if it is ever applied to whole file contents.
    """
    # Split off and protect a leading YAML frontmatter block.
    frontmatter = ""
    fm_match = re.match(r"\A---\n.*?\n---\n", text, re.DOTALL)
    if fm_match:
        frontmatter = fm_match.group(0)
        text = text[fm_match.end():]

    # 1. Remove standalone horizontal rules.
    text = re.sub(r"(?m)^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$\n?", "", text)

    # 2. Normalize bullet indentation to the changelog convention: one space for
    #    top-level bullets and two more per nesting level (1/3/5). Models variously
    #    emit 0/2, 1/3 or 2/4, so a level is derived from the distinct indents present
    #    rather than from a fixed threshold: two spaces means top-level in a 2/4
    #    fragment but nested in a 0/2 one.
    #
    #    Indents are ranked, not just compared against the shallowest, so a three-level
    #    list stays three levels instead of collapsing its two deepest into one.
    #
    #    Ranking is per list block rather than across the whole fragment. Sections are
    #    generated independently and can disagree on base indent; a fragment-wide
    #    minimum would demote an already-correct top-level bullet to nested just
    #    because some other section happened to start one space shallower.
    # ``*`` and ``+`` are rewritten to ``-``. Update mode only inserts ``-`` bullets, so a
    # star bullet would otherwise be dropped on a rerun even though create mode kept it.
    bullet_re = re.compile(r"^( *)([-*+]) ")

    def _starts_new_block(line: str) -> bool:
        """True for a non-blank line that is neither a bullet nor a bullet continuation."""
        return bool(line.strip()) and not bullet_re.match(line) and not line.startswith(" ")

    lines = text.split("\n")
    block_start = 0
    for index in range(len(lines) + 1):
        if index < len(lines) and not _starts_new_block(lines[index]):
            continue
        block = lines[block_start:index]
        indents = sorted({len(m.group(1)) for m in map(bullet_re.match, block) if m})
        if indents:
            level_of = {indent: level for level, indent in enumerate(indents)}
            for offset, line in enumerate(block):
                match = bullet_re.match(line)
                if match:
                    level = level_of[len(match.group(1))]
                    block[offset] = " " * (1 + 2 * level) + "- " + line[match.end():].lstrip()
            lines[block_start:index] = block
        block_start = index + 1
    text = "\n".join(lines)

    # 3. Close the gap between ### Improvements and its blog post line.
    text = re.sub(r"(?m)^(### Improvements)[ \t]*\n\s*\n(?=See )", r"\1\n", text)

    # 4. Drop headings with nothing under them (the model sometimes keeps
    #    "#### Database Schema Changes" for a release with no migrations), subsections
    #    first so a section left with only empty subsections goes too. ### Go Version is
    #    empty by design here; its line is filled in later.
    for level in ("####", "###"):
        text = re.sub(
            rf"(?m)^{level} (?!Go Version\b)[^\n]*(?:\n|\Z)(?:[ \t]*\n)*(?=#{{1,{len(level)}}} |\Z)", "", text)

    # 5. Collapse runs of blank lines (removing a rule can leave a doubled gap).
    #    At least one blank line is always kept, which MDX needs around JSX blocks.
    text = re.sub(r"\n{3,}", "\n\n", text)

    return frontmatter + text


# Regions of Markdown whose contents must never be escaped. Fenced blocks are listed
# first so they are consumed whole: an inline-code alternative would otherwise match
# across a fence that contains backticks and protect the wrong spans.
_MDX_PROTECTED_RE = re.compile(
    r"```[\s\S]*?```"     # fenced code block (backticks)
    r"|~~~[\s\S]*?~~~"    # fenced code block (tildes)
    r"|``[^`]*``"         # inline code span (double backtick)
    r"|`[^`]*`"           # inline code span (single backtick)
    r"|\]\([^)]*\)"       # Markdown link destination
)


def escape_mdx_unsafe(text: str) -> str:
    """Backslash-escape characters that MDX would parse as JSX.

    In MDX an unescaped ``{`` opens a JSX expression and ``<`` followed by a letter,
    ``/`` or ``!`` opens a JSX element, so release-note prose containing text such as
    ``<plugin ID>`` or ``{"status": "ok"}`` fails the docs build. The system prompt
    instructs the model to wrap such text in backticks, but compliance is not
    guaranteed and the failure mode is a broken build, so escape defensively.

    Only applied to the AI-generated fragment — never to whole file contents, which
    legitimately contain JSX components such as <Note> and <Important>.

    ``}`` is deliberately left alone: escaping ``{`` alone is sufficient to prevent a
    JSX expression, and a bare ``}`` is harmless. This also keeps the generated
    heading anchor ``\\{#release-v11-9-feature-release}`` intact.
    """
    def _escape(segment: str) -> str:
        segment = re.sub(r"(?<!\\)\{", r"\\{", segment)
        segment = re.sub(r"(?<!\\)<(?=[A-Za-z/!])", r"\\<", segment)
        return segment

    parts = []
    last = 0
    for match in _MDX_PROTECTED_RE.finditer(text):
        parts.append(_escape(text[last:match.start()]))
        parts.append(match.group(0))   # protected region, copied verbatim
        last = match.end()
    parts.append(_escape(text[last:]))
    return "".join(parts)


# A bullet that ends in none of these is very likely a sentence that was cut off.
_BULLET_TERMINATORS = (".", "!", "?", ":")

_BULLET_RE = re.compile(r"^ *- +(\S.*)$")


def check_for_truncation(text: str) -> None:
    """Raise if any bullet looks like a sentence that was cut off mid-way.

    A truncated response is the worst failure mode this script has: it is not an
    error, just a shorter changelog, so it lands in customer-facing docs as a
    half-written sentence. ``polish_with_ai`` already rejects a response that hit the
    output cap; this is the backstop for a truncation that arrives any other way.

    Call this on AI-polished prose only. The no-API-key fallback emits PR authors' raw
    notes verbatim, and those routinely end without a full stop — measured against the
    v12.0.0 milestone, 4 of 71 do — so they are not truncation and must not fail a run.

    Bullets that legitimately end without sentence punctuation are not flagged:

      - a bare inline-code span, e.g. a list of removed ``config.json`` setting names
      - a fully bold label, e.g. ``- **Changes to All plans:**``
      - a Markdown link or parenthetical, e.g. a contributor list
      - a bare URL
      - a bullet whose text continues on the following line

    Calibrated against the v10, v11 and v12 changelogs: zero false positives across
    all 2,702 existing bullets.
    """
    lines = text.split("\n")
    suspicious = []
    for index, line in enumerate(lines):
        match = _BULLET_RE.match(line)
        if not match:
            continue
        content = match.group(1).rstrip()

        # A bullet continued on the next line is not truncated.
        following = lines[index + 1] if index + 1 < len(lines) else ""
        if following.strip() and not _BULLET_RE.match(following) and not following.startswith("#"):
            continue
        if re.match(r"^\*\*.*\*\*$", content):
            continue
        if re.split(r"\s+", content)[-1].startswith(("http://", "https://")):
            continue

        stripped = re.sub(r"[*_]+$", "", content).rstrip()
        if not stripped or stripped.endswith(_BULLET_TERMINATORS):
            continue
        if stripped.endswith(("`", ")")):
            continue
        suspicious.append(line.strip())

    if suspicious:
        listed = "\n".join(f"   {item}" for item in suspicious)
        raise RuntimeError(
            f"{len(suspicious)} changelog bullet(s) end without terminal punctuation "
            f"and look truncated. Refusing to write a half-written sentence to the "
            f"changelog:\n{listed}"
        )


def normalize_go_version(go_version: str) -> str:
    """Normalize a Go version string to v-prefixed form.

    Accepts both "go1.22.5" (Go toolchain convention) and "v1.22.5"
    (Mattermost changelog convention) and always returns the latter.
    """
    v = go_version.strip()
    if v.startswith("go"):
        v = v[2:]   # strip the "go" prefix
    if not v.startswith("v"):
        v = "v" + v
    return v


def extract_previous_go_version(changelog_path: str) -> str | None:
    """Scan the changelog file for the most recently documented Go version.

    Used when GO_VERSION is not supplied (i.e. unchanged from the previous
    release) so the generated entry still shows a concrete version number
    rather than a generic "unchanged" message.
    """
    if not os.path.exists(changelog_path):
        return None
    with open(changelog_path, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"is built with Go\s+``(v?[\d.]+)``", content)
    if match:
        return normalize_go_version(match.group(1))
    return None


# Header block for a brand-new major-version changelog file, mirroring the existing
# v11 file exactly. Used to scaffold e.g. mattermost-v12-changelog.mdx on the first
# run for a new major, so the entry is never written without MDX frontmatter.
CHANGELOG_HEADER_TEMPLATE = """---
title: "v{major} Changelog"
---
import Inc0_common_esr_support_upgrade from './common-esr-support-upgrade.mdx';

<Important>

<Inc0_common_esr_support_upgrade />

</Important>
<Note>

Platform and OS scope reflects reported and tested environments and may not represent all affected configurations.

</Note>
"""


# Directory holding the per-major changelog files in mattermost/mattermost.
DOCS_DIR = "docs/main/product-overview"


# Heading label for each RELEASE_TYPE. The anchor slug is derived from the label
# (lowercased, spaces to dashes), matching the established convention:
#   "Major Release"            -> #release-v12-0-major-release
#   "Feature Release"          -> #release-v11-9-feature-release
#   "Extended Support Release" -> #release-v11-7-extended-support-release
RELEASE_LABELS = {
    "feature": "Feature Release",
    "major": "Major Release",
    "esr": "Extended Support Release",
}


def major_version(version: str) -> str:
    """Return the major version number from a version label: "v12.0.0" -> "12"."""
    match = re.match(r"v?(\d+)\.", version)
    if not match:
        raise RuntimeError(
            f"Cannot parse a major version from {version!r}; expected a form like v12.0.0"
        )
    return match.group(1)


def changelog_path_for_version(version: str, docs_dir: str = DOCS_DIR) -> str:
    """Derive the changelog file path from the release version.

    "v12.0.0" -> "docs/main/product-overview/mattermost-v12-changelog.mdx"

    The workflow passes CHANGELOG_PATH explicitly, but a fixed fallback would make a
    direct invocation of this script write a v12 entry into whatever file that default
    named — the v11 changelog, or the repository-root CHANGELOG.md — with nothing to
    warn about it. Deriving the default removes that failure mode entirely.
    """
    return os.path.join(docs_dir, f"mattermost-v{major_version(version)}-changelog.mdx")


def previous_major_changelog_path(changelog_path: str) -> str | None:
    """Given .../mattermost-v12-changelog.mdx, return .../mattermost-v11-changelog.mdx.

    Used to carry the Go version forward on the first run against a new major-version
    changelog file, which has no previous entry of its own to read.
    """
    match = re.search(r"(.*?)(\d+)(-changelog\.mdx?)$", changelog_path)
    if not match:
        return None
    prefix, major, suffix = match.groups()
    if int(major) <= 1:
        return None
    return f"{prefix}{int(major) - 1}{suffix}"


# The header block ends with the platform scope note, which closes a <Note> component.
HEADER_END_MARKER = "may not represent all affected configurations.\n\n</Note>"


def insert_changelog_entry(
    entry: str, changelog_path: str = "CHANGELOG.md", header: str = ""
) -> None:
    """Insert a new version entry into the changelog after the static file header block.

    The v11 changelog is an MDX file whose header consists of YAML frontmatter, MDX
    component imports, and two JSX blocks (<Important> and <Note>). New entries are
    inserted immediately after that header so it is preserved intact.
    """
    existing = ""
    if os.path.exists(changelog_path):
        with open(changelog_path, "r", encoding="utf-8") as f:
            existing = f.read()

    if not existing.strip():
        # New or empty file (e.g. the first release of a new major version). Write the
        # standard header first — an MDX file without frontmatter fails the docs build.
        new_content = (header + "\n\n" + entry) if header else entry
    elif HEADER_END_MARKER in existing:
        idx = existing.index(HEADER_END_MARKER) + len(HEADER_END_MARKER)
        new_content = existing[:idx].rstrip("\n") + "\n\n" + entry.strip("\n") + "\n\n" + existing[idx:].lstrip("\n")
    else:
        # Fallback: insert immediately before the first "## Release" heading, which keeps
        # frontmatter, imports, and any header components above the newest entry.
        first_release = re.search(r"(?m)^## Release\b", existing)
        if not first_release:
            # Never prepend above the file header: MDX requires frontmatter to be the very
            # first thing in the file, so blindly prepending would corrupt the document and
            # break the docs build. Fail loudly instead — the header format has changed and
            # HEADER_END_MARKER needs updating.
            raise RuntimeError(
                f"Could not find an insertion point in {changelog_path}: neither the header "
                f"marker ({HEADER_END_MARKER!r}) nor a '## Release' heading was found. "
                "The changelog header format has likely changed — update HEADER_END_MARKER "
                "in this script to match."
            )
        new_content = (
            existing[: first_release.start()].rstrip()
            + "\n\n"
            + entry.strip("\n")
            + "\n\n"
            + existing[first_release.start():]
        )

    # The first release of a new major version writes a file that does not exist yet,
    # so its directory may not either when the script runs outside the repo root.
    parent = os.path.dirname(changelog_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    with open(changelog_path, "w", encoding="utf-8") as f:
        f.write(new_content)


# ── Source tracking ─────────────────────────────────────────────────────────────────
#
# Every bullet is attributed to the PR(s) its release note came from. The model tags
# each bullet with the note IDs it used (rule 12 of SYSTEM_PROMPT); the markers are
# stripped here before anything is written, and the attribution goes to sections.json
# and to the changelog PR body instead.

_SOURCE_MARKER_RE = re.compile(r"[ \t]*\[\[\s*(N\d+(?:\s*,\s*N\d+)*)\s*\]\]")

# The PRs an open changelog PR already includes are recorded in its body, so a later
# run can tell a newly merged PR from one that is already in the entry — even after a
# reviewer has rewritten that PR's bullet beyond recognition.
_SOURCES_COMMENT_RE = re.compile(r"<!--\s*changelog-sources:(.*?)-->", re.DOTALL)


def extract_source_markers(text: str, sources_by_id: dict) -> tuple[str, list[dict], set]:
    """Strip the ``[[N1,N2]]`` markers from generated text and record what they said.

    Returns the cleaned text, one item per bullet (its section, subsection, text and
    source PRs, in document order), and the set of note IDs that were referenced.
    A marker on a bullet's continuation line counts towards that bullet. Unknown IDs
    are dropped rather than trusted.
    """
    items = []
    referenced = set()
    section = subsection = None
    current = None
    out = []
    for line in text.split("\n"):
        heading = re.match(r"^(#{3,4}) +(.*?)\s*$", line)
        if heading:
            if heading.group(1) == "###":
                section, subsection = heading.group(2), None
            else:
                subsection = heading.group(2)
            current = None
        elif _BULLET_RE.match(line):
            current = {"section": section, "subsection": subsection, "text": "", "sources": [], "ids": []}
            items.append(current)
        elif not line.strip() or not line.startswith(" "):
            current = None

        ids = []
        for match in _SOURCE_MARKER_RE.finditer(line):
            ids.extend(part.strip() for part in match.group(1).split(","))
        if ids:
            line = _SOURCE_MARKER_RE.sub("", line).rstrip()
        if current is not None:
            stripped = _BULLET_RE.match(line)
            fragment = stripped.group(1) if stripped else line.strip()
            current["text"] = f"{current['text']} {fragment}".strip()
            for note_id in ids:
                source = sources_by_id.get(note_id)
                if source:
                    referenced.add(note_id)
                    if note_id not in current["ids"]:
                        current["ids"].append(note_id)
                    if source not in current["sources"]:
                        current["sources"].append(source)
        out.append(line)
    return "\n".join(out), items, referenced


def group_items_by_section(items: list[dict]) -> list[dict]:
    """Group bullet items into sections, keeping first-seen order."""
    groups = []
    index = {}
    for item in items:
        key = (item["section"], item["subsection"])
        if key not in index:
            index[key] = len(groups)
            groups.append({"section": key[0], "subsection": key[1], "items": []})
        groups[index[key]]["items"].append({"text": item["text"], "sources": item["sources"]})
    return groups


def _source_sort_key(source: str):
    """Sort PR source keys by repo, then number; a derived key (no ``#``) sorts by its text."""
    repo, _, number = source.partition("#")
    return (repo, int(number) if number.isdigit() else 0)


def parse_sources_comment(body: str) -> set | None:
    """Return the PRs listed in a changelog PR body, or None if it has no list."""
    match = _SOURCES_COMMENT_RE.search(body or "")
    if not match:
        return None
    return set(match.group(1).split())


def render_pr_body(body: str, sources: set) -> str:
    """Write the included-PR list into a PR body, replacing any list already there."""
    comment = "<!-- changelog-sources: " + " ".join(sorted(sources, key=_source_sort_key)) + " -->"
    if _SOURCES_COMMENT_RE.search(body):
        return _SOURCES_COMMENT_RE.sub(lambda _: comment, body, count=1)
    return body.rstrip() + "\n\n" + comment + "\n"


def unattributed_sources(sources_by_id: dict, referenced: set) -> list[str]:
    """PRs whose note ID never appeared on a bullet."""
    missing = {sources_by_id[note_id] for note_id in sources_by_id if note_id not in referenced}
    return sorted(missing, key=_source_sort_key)


def _sources_of(sources_by_id: dict, referenced: set) -> set:
    """The PRs (or derived keys) that at least one marker named."""
    return {sources_by_id[note_id] for note_id in referenced if note_id in sources_by_id}


_MIGRATION_FILLER = {"added", "removed", "the", "a", "new", "database", "schema", "migration", "migrations", "file", "sql", "to", "for"}


def migration_restated(text: str, migrations: list[str]) -> str | None:
    """The listed migration a developer's note only restates, or None.

    A note names a migration ("Added migration 000238.") and otherwise says no more than the
    migration's name does ("Added the number property field type (migration 000238)." for
    ``000238_add_number_to_property_field_type``): the Database Schema Changes bullet written
    for that migration already says it. A note that also says something the name doesn't,
    such as what the change is for, is kept.
    """
    for name in migrations:
        number = name.split("_", 1)[0]
        pattern = r"(?<![\w])" + re.escape(name) + r"(?![\w])"
        if number.isdigit():
            pattern += r"|(?<!\d)" + re.escape(number) + r"(?!\d)"
        if not re.search(pattern, text):
            continue
        allowed = _MIGRATION_FILLER | set(name.lower().split("_")[1:])
        rest = re.findall(r"[a-z]+", re.sub(pattern, " ", text).lower())
        if all(word in allowed or word.rstrip("s") in allowed for word in rest):
            return name
    return None


def split_restated_notes(notes: list[dict], derived: list[dict]) -> tuple[list[dict], list[dict]]:
    """Split ``notes`` into those to write and those that only restate a migration already listed."""
    migrations = [note["source"][len("migration:"):] for note in derived if note["source"].startswith("migration:")]
    kept, restated = [], []
    for note in notes:
        name = None if note.get("derived") or note["source"].startswith(_DIFF_DERIVED) else migration_restated(note["text"], migrations)
        if name:
            restated.append({**note, "migration": name})
        else:
            kept.append(note)
    return kept, restated


def dropped_notes(notes: list[dict], referenced: set) -> list[dict]:
    """The notes the model gave no bullet: their ID never appeared on a marker."""
    return [note for note in notes if note["id"] not in referenced]


def require_recorded_sources_placed(recorded: set, items: list[dict]) -> None:
    """Fail before writing when a PR about to be recorded as a source has no bullet in the text.

    A dropped note is not an error: its PR is simply left out of ``recorded`` so the next
    run tries it again. What must never happen is the opposite, a PR recorded in the
    changelog-sources comment although none of the bullets written is attributed to it,
    because the next run would then skip it for good. Raising leaves the file and the
    open PR untouched.
    """
    placed = {source for item in items for source in item["sources"]}
    unplaced = sorted(set(recorded) - placed, key=_source_sort_key)
    if unplaced:
        raise RuntimeError(
            "Refusing to write the changelog: "
            f"{len(unplaced)} PR(s) would be recorded as included with no note in the text "
            f"({', '.join(unplaced)}). The next run would skip their release notes. Nothing was written."
        )


_NOT_PLACED_RE = re.compile(r"\n*<!-- changelog-not-placed -->.*?<!-- /changelog-not-placed -->\n*", re.DOTALL)


_NOT_PLACED_ITEM_RE = re.compile(r"^- (?:\[( |x|X)\] )?`([^`]+)`: (.*)$")


def carried_not_placed(body: str, recorded: set | frozenset, sent: set | frozenset) -> list[tuple[str, str]]:
    """The unticked (source, excerpt) items on a body's not-placed list that stay on it: their
    PR is recorded, so no run sends the note again, and it wasn't sent this run."""
    block = _NOT_PLACED_RE.search(body)
    carried = []
    for line in (block.group(0).splitlines() if block else []):
        match = _NOT_PLACED_ITEM_RE.match(line.strip())
        if match and match.group(1) in (None, " ") and match.group(2) in recorded and match.group(2) not in sent:
            carried.append((match.group(2), match.group(3)))
    return carried


def render_not_placed(body: str, dropped: list[dict], recorded: set | frozenset = frozenset(),
                      sent: set | frozenset = frozenset()) -> str:
    """Write the notes the model left out into a PR body for a reviewer, as a task list.

    A note whose PR has no other note in the text is listed until a run places it: its PR
    isn't recorded in changelog-sources, so the next run sends it again. A note whose PR
    is recorded (another of its notes was placed) is never sent again, so it stays on the
    list, carried over from the last body, until a reviewer adds it by hand and ticks it.
    A PR whose notes were sent this run (``sent``) is never carried: its notes were either
    placed, and so are off the list, or dropped again, and so are in ``dropped``.
    """
    carried = carried_not_placed(body, recorded, sent)
    body = _NOT_PLACED_RE.sub("\n\n", body).rstrip() + "\n"
    entries = [(note["source"], " ".join(note["text"].split())[:160].replace("`", "'")) for note in dropped]
    entries += [entry for entry in carried if entry not in entries]
    if not entries:
        return body
    lines = [
        "<!-- changelog-not-placed -->",
        "### Release notes the model did not place",
        "",
        "These notes were left out of the changelog text, even after asking again. A PR with no note in the text "
        "is not in the changelog-sources list, so the next run tries it again. A PR whose other note was placed "
        "is recorded and isn't tried again: add its note by hand, then tick it here. Unticked, it stays on this "
        "list on every run.",
        "",
    ]
    lines += [f"- [ ] `{source}`: {excerpt}" for source, excerpt in entries]
    lines += ["<!-- /changelog-not-placed -->", ""]
    return body + "\n" + "\n".join(lines)


# ── Update mode: add new bullets to an existing entry ───────────────────────────────
#
# Reviewers edit the changelog PR directly, so a rerun must never regenerate what is
# already there. Instead the new notes are generated as a fragment and each of its
# bullets is appended to the matching section of the existing entry. Existing lines are
# never changed or removed; the only edits are insertions.

# Canonical section order, used only to place a heading the entry does not have yet.
H3_ORDER = [
    "Upgrade Impact", "Improvements", "Bug Fixes", "API Changes",
    "WebSocket Event Changes", "Audit Log Event Changes", "Go Version",
    "Open Source Components", "Security",
]
UPGRADE_NOTES = "Important Upgrade Notes"
# The subsection was "Compatibility" until v12.2: an open PR or a report written before then
# still has that name, and is read as this one.
UPGRADE_NOTES_NAMES = (UPGRADE_NOTES, "Compatibility")
H4_ALIASES = {UPGRADE_NOTES: ("Compatibility",)}
H4_ORDER = {
    "Upgrade Impact": ["Database Schema Changes", "config.json", "Important Upgrade Notes"],
    "Improvements": ["User Interface", "Plugins/Integrations", "Administration", "mmctl", "Performance"],
}


def parse_fragment(fragment: str) -> list[dict]:
    """Split generated text into ``###`` sections, each with its own lines and ``####`` subsections."""
    sections = []
    for line in fragment.split("\n"):
        h3 = re.match(r"^### +(.*?)\s*$", line)
        h4 = re.match(r"^#### +(.*?)\s*$", line)
        if h3:
            sections.append({"title": h3.group(1), "lines": [], "subsections": []})
        elif h4 and sections:
            sections[-1]["subsections"].append({"title": h4.group(1), "lines": []})
        elif sections:
            target = sections[-1]["subsections"][-1] if sections[-1]["subsections"] else sections[-1]
            target["lines"].append(line)
    return sections


# A bullet marker at any indent. Existing entries use one space (v11.11) or two (v11.9, v11.10).
_BULLET_INDENT_RE = re.compile(r"^( *)([-*+]) ")

# MDX admonitions that sit after a section's list and before the next heading.
# New bullets belong in the list, not after ``</Important>``.
_JSX_BOUNDARY_RE = re.compile(r"^[ \t]*</?[A-Z][A-Za-z0-9]*\b")


def _bullet_indent(line: str) -> int | None:
    """The indent of a bullet line, or None if it is not a bullet."""
    match = _BULLET_INDENT_RE.match(line)
    if not match:
        return None
    return len(match.group(1))


def _is_jsx_boundary(line: str) -> bool:
    """Whether ``line`` opens or closes a JSX block such as ``<Note>``."""
    return bool(_JSX_BOUNDARY_RE.match(line))


def _before_jsx_block(lines: list[str], start: int, end: int) -> int:
    """Exclusive end of ``lines[start:end]``, stopping at the first MDX admonition."""
    for index in range(start + 1, end):
        if _is_jsx_boundary(lines[index]):
            return index
    return end


def _minimum_bullet_indent(lines: list[str], start: int, end: int) -> int | None:
    """Shallowest bullet indent in the region. That indent is the top-level list."""
    indents = []
    for index in range(start, end):
        if _is_jsx_boundary(lines[index]):
            break
        indent = _bullet_indent(lines[index])
        if indent is not None:
            indents.append(indent)
    return min(indents) if indents else None


def _is_top_level(line: str, top_indent: int | None) -> bool:
    """Whether ``line`` is a bullet at the section's top level."""
    indent = _bullet_indent(line)
    if indent is None:
        return False
    if top_indent is None:
        return True
    return indent == top_indent


def _at_indent(line: str, indent: int) -> str:
    """Rewrite a bullet line so its marker sits at ``indent`` spaces."""
    if _bullet_indent(line) is None:
        return line
    return " " * indent + line.lstrip()


def _align_to_indent(block: list[str], top_indent: int | None) -> list[str]:
    """Shift a new bullet block so its top-level marker matches the existing list."""
    if top_indent is None:
        return block
    indents = [i for i in (_bullet_indent(line) for line in block) if i is not None]
    if not indents:
        return block
    delta = top_indent - min(indents)
    if delta == 0:
        return block
    aligned = []
    for line in block:
        if not line.strip():
            aligned.append(line)
        elif delta > 0:
            aligned.append(" " * delta + line)
        else:
            cut = -delta
            aligned.append(line[cut:] if line.startswith(" " * cut) else line)
    return aligned


def _shift_under(children: list[str], parent_line: str) -> list[str]:
    """Nest ``children`` one level under ``parent_line``, keeping relative depth."""
    parent_indent = _bullet_indent(parent_line)
    if parent_indent is None:
        return children
    child_indents = [i for i in (_bullet_indent(line) for line in children) if i is not None]
    if not child_indents:
        return children
    delta = (parent_indent + 2) - min(child_indents)
    if delta == 0:
        return children
    shifted = []
    for line in children:
        if not line.strip():
            shifted.append(line)
        elif delta > 0:
            shifted.append(" " * delta + line)
        else:
            cut = -delta
            shifted.append(line[cut:] if line.startswith(" " * cut) else line.lstrip())
    return shifted


def _top_level_blocks(lines: list[str]) -> list[list[str]]:
    """Group bullet lines into blocks of one top-level bullet plus everything nested under it.

    Lines before the first bullet (a description paragraph, the blog post line) and
    blank lines are dropped: they either already exist in the entry or are not wanted.
    ``*`` and ``+`` markers count, so a bullet normalize_formatting has not rewritten yet
    is still inserted.
    """
    blocks = []
    for line in lines:
        if re.match(r"^ ?[-*+] ", line):
            blocks.append([line])
        elif blocks and line.strip() and line.startswith((" ", "\t")):
            blocks[-1].append(line)
    return blocks


def _region_end(lines: list[str], start: int, stop_pattern: str) -> int:
    """Index of the first line after ``start`` matching ``stop_pattern``, or len(lines)."""
    for index in range(start + 1, len(lines)):
        if re.match(stop_pattern, lines[index]):
            return index
    return len(lines)


def _last_content_line(lines: list[str], start: int, end: int) -> int:
    """Index of the last non-blank line in ``lines[start:end]`` (``start`` if none)."""
    for index in range(end - 1, start - 1, -1):
        if lines[index].strip():
            return index
    return start


def _merge_bullets(lines: list[str], start: int, end: int, new_lines: list[str], title: str) -> int:
    """Append the bullets in ``new_lines`` to the list in ``lines[start:end]``.

    A new block whose top-level line already exists in the region — a plan label such as
    ``- **Changes to All plans:**`` — has its nested bullets added under the existing one
    instead of repeating the label. Top-level is the shallowest bullet indent already in
    the region, so a two-space label matches a one-space label from the new fragment.

    The list stops at an MDX admonition (``<Important>``, ``<Note>``, ``<Attention>``).
    Those blocks sit between ``#### config.json`` and the next heading; appending after
    the last content line would place new settings under the admonition.

    Database Schema Changes is written either as one summary bullet with the changes
    nested beneath it, or as a flat list of changes. A new summary bullet is never
    added to an entry that already has the section: its nested changes go under the
    existing summary, or are flattened into the existing list.

    Returns how many lines were inserted.
    """
    end = _before_jsx_block(lines, start, end)
    top_indent = _minimum_bullet_indent(lines, start, end)
    inserted = 0
    for block in _top_level_blocks(new_lines):
        head, children = block[0], block[1:]
        target = None
        for index in range(start, end + inserted):
            if _is_top_level(lines[index], top_indent) and lines[index].strip() == head.strip():
                target = index
                break
        if target is None and title == "Database Schema Changes" and children:
            heads = [i for i in range(start, end + inserted) if _is_top_level(lines[i], top_indent)]
            nested = [
                i for i in heads
                if i + 1 < len(lines)
                and _bullet_indent(lines[i + 1]) is not None
                and _bullet_indent(lines[i + 1]) > (_bullet_indent(lines[i]) or 0)
            ]
            if len(heads) == 1 and nested:
                target = heads[0]
            elif heads and not nested and top_indent is not None:
                block = [_at_indent(line, top_indent) if _bullet_indent(line) is not None else line for line in children]
        if target is not None and children:
            children = _shift_under(children, lines[target])
            block_end = target + 1
            while (
                block_end < end + inserted
                and lines[block_end].strip()
                and not _is_top_level(lines[block_end], top_indent)
                and not _is_jsx_boundary(lines[block_end])
            ):
                block_end += 1
            lines[block_end:block_end] = children
            inserted += len(children)
        else:
            block = _align_to_indent(block, top_indent)
            at = _last_content_line(lines, start, end + inserted) + 1
            lines[at:at] = block
            inserted += len(block)
    return inserted


def _insert_heading_block(lines, start, end, level, title, order, block_lines) -> None:
    """Insert a new heading and its lines inside ``lines[start:end]`` at its canonical position.

    A new subsection stays above a trailing admonition. A new top-level section does not:
    that admonition belongs to the previous section and the new section follows it.
    """
    marker = "#" * level + " "
    rank = order.index(title) if title in order else len(order)
    at = None
    for index in range(start, end):
        heading = re.match("^" + re.escape(marker) + r"(.*?)\s*$", lines[index])
        if heading:
            other = heading.group(1)
            if (order.index(other) if other in order else len(order)) > rank:
                at = index
                break
    body = [marker + title] + list(block_lines)
    while body and not body[-1].strip():
        body.pop()
    if at is None:
        append_end = _before_jsx_block(lines, start, end) if level >= 4 else end
        at = _last_content_line(lines, start, append_end) + 1
        lines[at:at] = [""] + body
    else:
        lines[at:at] = body + [""]


def _entry_start(lines: list[str], version_short: str) -> int | None:
    """The index of the ``## Release vX.Y`` heading line, or None."""
    heading_re = re.compile(r"^## Release " + re.escape(version_short) + r"\b(?!\.)")
    return next((i for i, line in enumerate(lines) if heading_re.match(line)), None)


def _section_of(lines: list[str], start: int, index: int) -> tuple[str | None, str | None]:
    """The ``###`` section and ``####`` subsection line ``index`` sits under."""
    subsection = None
    for i in range(index, start, -1):
        if lines[i].startswith("#### ") and subsection is None:
            subsection = lines[i][5:].strip()
        elif lines[i].startswith("### "):
            return lines[i][4:].strip(), subsection
    return None, subsection


def _bullet_text(line: str) -> str:
    """A bullet line's text without its marker and indent."""
    match = _BULLET_RE.match(line)
    return match.group(1) if match else line.strip()


_GO_LINE_RE = re.compile(r"(is built with Go\s+``)(v?[\d.]+)(``)")


# The benchmarking line until the release's performance comparison is in: visible in the PR
# and on a docs preview, read by the readiness report, and refused by the Release Day gate
# (changelog_automation.py) like "Release day: TBD".
BENCHMARK_PENDING = "Benchmarking test results: TBD"
BENCHMARK_PENDING_RE = re.compile(r"Benchmarking test results:\s*TBD\b", re.IGNORECASE)
_BENCHMARK_BULLET_RE = re.compile(r"^ *- +Benchmarking test results\b")


def benchmark_pending_line(version_short: str, gap: dict) -> str:
    if gap.get("status") == "needs_review":
        return (f" - {BENCHMARK_PENDING}. The {version_short} performance comparison needs a person: "
                "replace this line with the Performance bullet.")
    return (f" - {BENCHMARK_PENDING}. Added by the changelog workflow once the {version_short} "
            "performance comparison is published.")


def apply_benchmark(content: str, version_short: str, benchmark: dict, blog_line: str = "") -> tuple[str, str]:
    """Keep the entry's benchmarking line in step with the performance comparison, like the Go
    version: (content, what happened).

    The comparison's sentence replaces the pending marker, or is added as the first bullet of
    ``#### Performance`` when the entry has no benchmarking line; a sentence already there (a
    reviewer may have edited it) is kept. Until there is a sentence, the entry carries the
    pending marker. "added" (the sentence), "marked" (the marker added), "pending" (the marker
    was there), "kept" (a sentence was there) or "" (no entry).
    """
    lines = content.split("\n")
    start = _entry_start(lines, version_short)
    if start is None:
        return content, ""
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## Release ")), len(lines))
    note = (benchmark.get("notes") or [None])[0]
    marker = next((i for i in range(start, end) if BENCHMARK_PENDING_RE.search(lines[i])), None)
    sentence = next((i for i in range(start, end) if _BENCHMARK_BULLET_RE.match(lines[i])
                     and not BENCHMARK_PENDING_RE.search(lines[i])), None)
    if sentence is not None:
        if marker is not None and note:
            del lines[marker]  # the sentence is in; the marker is stale
            return "\n".join(lines), "added"
        return content, "kept"
    if note:
        new_line = f" - {note['text']}"
    elif marker is not None:
        return content, "pending"
    else:
        new_line = benchmark_pending_line(version_short, benchmark.get("gap") or {})
    if marker is not None:
        lines[marker] = new_line
        return "\n".join(lines), "added"  # only reached with a note: a marker without one returned above
    improvements = next((i for i in range(start, end) if re.match(r"^### Improvements\s*$", lines[i])), None)
    if improvements is None:
        following = next((i for i in range(start + 1, end) if re.match(r"^### (?!Upgrade Impact\b)", lines[i])), end)
        block = ["### Improvements"] + ([blog_line] if blog_line else []) + ["", "#### Performance", new_line, ""]
        lines[following:following] = block
    else:
        section_end = next((i for i in range(improvements + 1, end) if lines[i].startswith("### ")), end)
        performance = next((i for i in range(improvements + 1, section_end) if re.match(r"^#### Performance\s*$", lines[i])), None)
        if performance is not None:
            lines.insert(performance + 1, new_line)
        else:
            last = section_end
            while last > improvements + 1 and not lines[last - 1].strip():
                last -= 1
            lines[last:last] = ["", "#### Performance", new_line]
    return "\n".join(lines), "added" if note else "marked"


def normalize_entry_spacing(content: str, version_short: str) -> str:
    """Exactly one blank line before the entry's heading and before the next release's, and no
    run of blank lines inside the entry."""
    lines = content.split("\n")
    start = _entry_start(lines, version_short)
    if start is None:
        return content
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## Release ")), len(lines))
    before = lines[:start]
    while before and not before[-1].strip():
        before.pop()
    body = []
    for line in lines[start:end]:
        if not line.strip() and body and not body[-1].strip():
            continue
        body.append(line)
    while body and not body[-1].strip():
        body.pop()
    after = lines[end:]
    return "\n".join((before + [""] if before else []) + body + ([""] + after if after else [""]))


def replace_entry_go_version(content: str, version_short: str, go_version: str) -> tuple[str, str | None, str | None]:
    """Set the Go version in the entry's ``### Go Version`` line.

    Returns (content, the version the entry had or None when it has no such line, the
    line as written). Only the version is replaced, so a reviewer's wording is kept.
    """
    lines = content.split("\n")
    start = _entry_start(lines, version_short)
    if start is None:
        return content, None, None
    end = _region_end(lines, start, r"^## ")
    go = next((i for i in range(start, end) if re.match(r"^### +Go Version\s*$", lines[i])), None)
    if go is None:
        return content, None, None
    for i in range(go + 1, _region_end(lines, go, r"^#{2,3} ")):
        match = _GO_LINE_RE.search(lines[i])
        if match:
            lines[i] = lines[i][:match.start(2)] + go_version + lines[i][match.end(2):]
            return "\n".join(lines), normalize_go_version(match.group(2)), _bullet_text(lines[i])
    return content, None, None


_DIFF_DERIVED = ("plugin:", "websocket:", "migration:")


def reconcile_derived(content: str, version_short: str, included: set, derived: list[dict]) -> tuple[str, set, set, list[dict]]:
    """Bring bullets read from an earlier release diff in line with the current one.

    A plugin bumped again since the last run (calls@v1.12.6, now v1.12.7) gets a new
    source key, so on its own it would be added as a second bullet claiming both
    versions ship. When the old version's release link appears exactly once in the
    entry, it is replaced in place and the key swapped. Otherwise, or when an included
    change is no longer in the diff at all, the bullet is left for a reviewer and the
    newer note is withheld until the sources list says it is handled.

    Returns (content, included, sources to withhold, one result per reconciled source).
    """
    lines = content.split("\n")
    start = _entry_start(lines, version_short)
    if start is None:
        return content, included, set(), []
    end = _region_end(lines, start, r"^## ")
    current = {note["source"] for note in derived}
    plugins = {}
    for source in current:
        if source.startswith("plugin:"):
            package, _, version = source[len("plugin:"):].rpartition("@")
            plugins[package] = version

    included = set(included)
    withheld, results = set(), []
    for source in sorted(s for s in included if s.startswith(_DIFF_DERIVED) and s not in current):
        result = {"source": source, "status": "needs_review", "replaced_by": None, "section": None, "subsection": None}
        package, _, old = source[len("plugin:"):].rpartition("@") if source.startswith("plugin:") else ("", "", "")
        new = plugins.get(package) if package else None
        if new is None:
            result["detail"] = "no longer in the release diff; the bullet may describe a change that was reverted"
            result["remedy"] = f"Remove or correct the bullet, then drop `{source}` from the changelog-sources comment."
            results.append(result)
            continue

        newer = f"plugin:{package}@{new}"
        result["replaced_by"] = newer
        withheld.add(newer)
        old_link = changelog_release.plugin_version_link(package, old)
        hits = [i for i in range(start, end) if old_link in lines[i]]
        if old != "removed" and new != "removed" and len(hits) == 1 and lines[hits[0]].count(old_link) == 1:
            lines[hits[0]] = lines[hits[0]].replace(old_link, changelog_release.plugin_version_link(package, new))
            included.discard(source)
            included.add(newer)
            result.update(status="replaced", text=_bullet_text(lines[hits[0]]),
                          detail=f"{old} replaced by {new}, the version the release branch now ships")
            result["section"], result["subsection"] = _section_of(lines, start, hits[0])
        else:
            result["detail"] = f"the entry says {old}, the release branch now ships {new}"
            result["remedy"] = (f"Correct the bullet, then replace `{source}` with `{newer}` in the "
                                "changelog-sources comment.")
        results.append(result)
    return "\n".join(lines), included, withheld, results


def merge_into_entry(content: str, version_short: str, fragment: str) -> str:
    """Add the bullets of ``fragment`` to the ``version_short`` entry in ``content``.

    Only insertions are made: every line already in the file, including reviewers'
    edits, is kept as it is. A section or subsection the entry lacks is created at its
    canonical position; one it already has receives the new bullets at its end.
    """
    lines = content.split("\n")
    entry_start = _entry_start(lines, version_short)
    if entry_start is None:
        raise RuntimeError(
            f"Could not find the '## Release {version_short}' entry to update. It may "
            "have been renamed in the changelog PR; re-run in regenerate mode to rebuild it."
        )

    for section in parse_fragment(fragment):
        entry_end = _region_end(lines, entry_start, r"^## ")
        h3_line = next(
            (i for i in range(entry_start, entry_end) if re.match(r"^### +" + re.escape(section["title"]) + r"\s*$", lines[i])),
            None,
        )
        if h3_line is None:
            block = list(section["lines"])
            for sub in section["subsections"]:
                block += ["", "#### " + sub["title"]] + sub["lines"]
            _insert_heading_block(lines, entry_start + 1, entry_end, 3, section["title"], H3_ORDER, block)
            continue

        h3_end = _region_end(lines, h3_line, r"^#{2,3} ")
        first_h4 = _region_end(lines, h3_line, r"^#{2,4} ")
        _merge_bullets(lines, h3_line, first_h4, section["lines"], section["title"])

        for sub in section["subsections"]:
            h3_end = _region_end(lines, h3_line, r"^#{2,3} ")
            h4_line = next(
                (i for title in (sub["title"], *H4_ALIASES.get(sub["title"], ())) for i in range(h3_line, h3_end)
                 if re.match(r"^#### +" + re.escape(title) + r"\s*$", lines[i])),
                None,
            )
            if h4_line is None:
                order = H4_ORDER.get(section["title"], [])
                _insert_heading_block(lines, h3_line + 1, h3_end, 4, sub["title"], order, sub["lines"])
            else:
                h4_end = _region_end(lines, h4_line, r"^#{2,4} ")
                _merge_bullets(lines, h4_line, h4_end, sub["lines"], sub["title"])

    return "\n".join(lines)


def require_fragment_merged(fragment: str, merged: str) -> None:
    """Fail when a bullet of the fragment did not land in the merged entry.

    Its source would still be recorded as included, so the note would never be added.
    A bullet outside any ``###`` section (the no-API-key fallback) has nowhere to go.
    """
    present = {line.strip() for line in merged.split("\n")}
    lines = fragment.split("\n")

    # A parent such as the Database Schema Changes summary is not inserted when the
    # entry already has one; its children carry the content.
    def is_parent(i: int) -> bool:
        following = next((line for line in lines[i + 1:] if line.strip()), "")
        child_indent = _bullet_indent(following)
        return child_indent is not None and child_indent > (_bullet_indent(lines[i]) or 0)

    lost = [
        line.strip() for i, line in enumerate(lines)
        if _BULLET_RE.match(line) and not is_parent(i) and line.strip() not in present
    ]
    if lost:
        raise RuntimeError(
            f"Refusing to write the changelog: {len(lost)} new bullet(s) have no section to be "
            f"merged into (first: {lost[0]!r}). Update mode needs AI-categorized notes; set "
            "ANTHROPIC_API_KEY. Nothing was written."
        )


def remove_section(fragment: str, title: str) -> str:
    """Drop a ``###`` section, heading and body, from generated text."""
    return re.sub(r"(?ms)^### " + re.escape(title) + r"\b.*?(?=^### \S|\Z)", "", fragment).strip() + "\n"


# ── Readiness ───────────────────────────────────────────────────────────────────────
#
# What the changelog-status skill reports before anyone reviews the entry: whether the
# generator can run, which merged PRs it cannot take a note from, which notes will need
# rewriting, and which sections the release diff filled.

def _check(check: str, status: str, detail: str, remedy: str = "", blocking: bool = False) -> dict:
    """One preflight check result."""
    return {"check": check, "status": status, "detail": detail, "remedy": remedy, "blocking": blocking}


def preflight_checks(changelog_path: str, mode: str, milestones: dict, go_source: str | None,
                     release_date: str = "") -> list[dict]:
    """Each check is pass, fail or unknown. A failing blocking check stops the run.

    ``milestones`` maps each repo to its milestone number, None when it has no such
    milestone, or a string saying why it could not be read.
    """
    checks = []
    name = os.path.basename(changelog_path)
    if not os.path.exists(changelog_path):
        if mode == "update":
            checks.append(_check(name, "fail", "missing from the changelog PR's branch",
                                 "Check the PR branch, or re-run in regenerate mode.", blocking=True))
        else:
            checks.append(_check(name, "pass", "not on master yet; it will be created from the header template"))
    else:
        with open(changelog_path, "r", encoding="utf-8") as f:
            content = f.read()
        if not content.strip() or HEADER_END_MARKER in content:
            checks.append(_check(name, "pass", "header marker present" if content.strip() else "empty; the header will be written"))
        elif re.search(r"(?m)^## Release\b", content):
            checks.append(_check(name, "fail", "header marker missing; entries go above the first ## Release heading",
                                 "Restore the header's closing `may not represent all affected configurations.` / `</Note>`."))
        else:
            checks.append(_check(name, "fail", "neither the header marker nor a ## Release heading is present",
                                 "Restore the file header; the entry has nowhere to go.", blocking=True))

    found = [repo for repo, number in milestones.items() if isinstance(number, int)]
    for repo, number in milestones.items():
        if isinstance(number, int):
            checks.append(_check(f"milestone in {repo}", "pass", f"{MILESTONE_TITLE} found"))
        elif number is None:
            checks.append(_check(f"milestone in {repo}", "fail", f"no {MILESTONE_TITLE} milestone",
                                 "Create it, or check the milestone input (it is the full three-part version, e.g. v12.1.0).",
                                 blocking=not found))
        else:
            checks.append(_check(f"milestone in {repo}", "unknown", number,
                                 "Give the workflow token read access to this repo; its PRs were not audited."))

    if go_source:
        checks.append(_check("Go version", "pass", f"from {go_source}"))
    else:
        checks.append(_check("Go version", "fail", "not read from the release branch; the entry reuses the previous one",
                             "Pass go_version on dispatch, or fetch the release branch."))

    if mode == "create" and release_date == RELEASE_DATE_PLACEHOLDER:
        checks.append(_check("Release day", "unknown", f"written as `{RELEASE_DATE_PLACEHOLDER}`; a scheduled run is not given one",
                             "Set the Release day line on the changelog PR before it merges."))
    return checks


def gap_status(derived: list[dict], refs_read: bool, go_version: str, go_source: str | None,
               previous_go: str | None, entry_go: dict | None = None, benchmark_gap: dict | None = None) -> list[dict]:
    """The sections no developer note fills: ready, no_changes_this_release, not_yet_checked
    or needs_review.

    A section is never ready just because nothing was found; with no refs to diff it
    was not checked at all. ``entry_go`` is given in update mode: ``{"had": version}``,
    the Go version the entry said before this run, None when it has no Go line.
    ``benchmark_gap`` is ``changelog_release.benchmark()``'s account of the performance
    comparison: pending until it is published, flagged for a person when its Delta is
    outside the prediction interval or can't be read.
    """
    def of(prefix):
        return [note["source"] for note in derived if note["source"].startswith(prefix)]

    def diffed(section, sources, detail):
        if sources:
            return {"section": section, "status": "ready", "detail": detail}
        if refs_read:
            return {"section": section, "status": "no_changes_this_release", "detail": "none in the release diff"}
        return {"section": section, "status": "not_yet_checked", "detail": "release refs were not available to diff"}

    events = of("websocket:")
    added = sum(source.endswith("@added") for source in events)
    migrations = of("migration:")
    plugins = of("plugin:")
    gaps = [
        diffed("WebSocket events", events, f"{added} added, {len(events) - added} removed"),
        diffed("Database schema changes", migrations,
               f"{len(migrations)} new migration(s): {', '.join(s.split(':', 1)[1] for s in migrations)}"),
        diffed("Pre-packaged plugins", plugins, f"{len(plugins)} plugin(s) bumped or removed"),
    ]
    if go_source and entry_go is not None and entry_go["had"] is None:
        gaps.append({"section": "Go version", "status": "needs_review",
                     "detail": f"{normalize_go_version(go_version)} from {go_source}, but the entry has no "
                               "`is built with Go ``vX.Y.Z``` line under ### Go Version to update; add it"})
    elif go_source:
        formatted = normalize_go_version(go_version)
        if entry_go is not None and entry_go["had"] != formatted:
            note = f" (the entry said {entry_go['had']}; updated)"
        elif entry_go is not None:
            note = " (matches the entry)"
        else:
            note = " (unchanged from the previous entry)" if previous_go == formatted else ""
        gaps.append({"section": "Go version", "status": "ready", "detail": f"{formatted} from {go_source}{note}"})
    else:
        gaps.append({"section": "Go version", "status": "not_yet_checked", "detail": "not read from the release branch"})
    if benchmark_gap is not None:
        gaps.append(benchmark_gap)
    elif of("benchmark:"):
        gaps.append({"section": "Benchmarking", "status": "ready", "detail": "read from the performance comparison"})
    else:
        gaps.append({"section": "Benchmarking", "status": "not_yet_checked", "blocks_publish": True,
                     "detail": "no performance comparison published for this release yet"})
    return gaps


def missing_by_owner(flagged: list[dict]) -> list[dict]:
    """Flagged PRs grouped by who to ask, most first."""
    groups: dict[str, list[str]] = {}
    for pr in flagged:
        groups.setdefault(pr.get("owner") or "", []).append(pr["source"])
    return [{"owner": owner or None, "sources": sources}
            for owner, sources in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0] == "", item[0]))]


# Every icon is followed by its meaning in words, so the status is not carried by the
# emoji alone (screen readers announce emoji by their Unicode name, e.g. "hourglass").
_STATUS = {
    "pass": ("✅", "pass"), "fail": ("❌", "fail"), "unknown": ("❔", "unknown"),
    "ready": ("✅", "ready"), "no_changes_this_release": ("➖", "no changes this release"),
    "not_yet_checked": ("⏳", "not yet checked"), "needs_review": ("⚠️", "needs a reviewer"),
    "replaced": ("🔁", "updated"),
}


def _status_item(status: str, name: str, detail: str) -> str:
    """A report line whose status icon is followed by its meaning in words."""
    icon, label = _STATUS[status]
    return f"- {icon} **{name}** ({label}): {detail}"


def render_status(readiness: dict) -> list[str]:
    """The changelog-status digest: preflight, release-note coverage, gaps, note quality."""
    private = readiness.get("repos_private", [])

    def pr(source):
        return _pr_link(source, private)

    lines = ["### Preflight", ""]
    for check in readiness["preflight"]:
        line = _status_item(check["status"], check["check"], check["detail"])
        if check["status"] != "pass" and check["remedy"]:
            line += f". {check['remedy']}"
        lines.append(line)
    lines.append("")

    notes = readiness["notes"]
    merged = notes["prs_merged"]
    share = f" ({round(100 * notes['with_notes'] / merged)}%)" if merged else ""
    lines += [f"### Release notes: {notes['with_notes']} of {merged} merged PRs have one{share}", ""]
    for repo in readiness["repos_unaudited"]:
        lines.append(f"- ❔ Not audited: `{repo['repo']}` ({repo['reason']}), so its PRs are unknown, not missing.")
    if notes["missing"]:
        lines.append(f"- ⏳ Missing: {notes['missing']}, by owner. Add a release note, or the `release-note-none` label, then re-run:")
        for group in readiness["missing_by_owner"]:
            owner = f"@{group['owner']}" if group["owner"] else "bot-authored, no assignee"
            lines.append(f"  - {owner} ({len(group['sources'])}): {', '.join(pr(s) for s in group['sources'])}")
    else:
        lines.append("- ✅ None missing.")
    lines += [f"- {notes['intentional']} PR(s) intentionally have no note.", ""]

    plans = readiness.get("config_plans") or []
    unconfirmed = [p for p in plans if not p["confirmed"]]
    if plans:
        lines += ["### config.json settings by plan", ""]
        lines.append(f"- {len(plans) - len(unconfirmed)} of {len(plans)} new setting(s) grouped by a plan read from the "
                     "System Console or the configuration docs.")
        for item in unconfirmed:
            lines.append(_status_item("needs_review", f"`{item['setting']}`",
                                      f"plan not confirmed: {item['basis']}. Listed under {item['plan']} Plans; "
                                      "move it if it belongs to another plan"))
        lines.append("")
    lines += ["### Sections no developer note fills", ""]
    for gap in readiness["gaps"]:
        blocks = " (blocks publish)" if gap.get("blocks_publish") else ""
        lines.append(_status_item(gap["status"], gap["section"], gap["detail"] + blocks))
    lines.append("")

    reconciled = readiness.get("reconciled", [])
    if reconciled:
        lines += ["### Bullets from an earlier release diff that no longer match it", ""]
        for item in reconciled:
            remedy = f". {item['remedy']}" if item["status"] == "needs_review" else "."
            lines.append(_status_item(item["status"], f"`{item['source']}`", item["detail"]) + remedy)
        lines.append("")

    if readiness["note_quality"]:
        lines += [f"### Note quality: {len(readiness['note_quality'])} note(s) will need rewriting", ""]
        for note in readiness["note_quality"]:
            excerpt = note["excerpt"].replace("`", "'")
            lines.append(f"- {pr(note['source'])} {note['reason']}: \"{excerpt}\"")
        lines.append("")

    links, unclear = readiness.get("doc_links", []), readiness.get("doc_links_unclear", [])
    named_broken = readiness.get("doc_links_named_broken", [])
    if links or unclear or named_broken:
        lines += [f"### Doc links: {len(links)} named on a Docs: line or found by following the PR to the docs it changed", ""]
        for link in named_broken:
            lines.append(_status_item("fail", f"Docs: line of {pr(link['source'])}", f"{link['url']}: {link['problem']}. "
                                      "Fix the line in the PR's release note, then re-run."))
        for link in links:
            where = ""
            if "used_in" in link:
                if link["used_in"]:
                    where = f" (linked in {', '.join(link['used_in'])})"
                elif link.get("linked_elsewhere"):
                    where = f" (linked from the bullet for {', '.join(pr(s) for s in link['linked_elsewhere'])} instead)"
                else:
                    where = " (no bullet links it)"
            lines.append(f"- {pr(link['source'])} is documented in {_docs_link(link['url'], link.get('title'))}{where}. "
                         f"Basis: {link['basis']}.")
        if unclear:
            lines.append(f"- {len(unclear)} PR(s) changed docs, but no page clearly documents the change, so no link was proposed:")
            for link in unclear:
                titles = link.get("titles", {})
                pages = ", ".join(_docs_link(url, titles.get(url)) for url in link["candidates"])
                lines.append(f"  - {pr(link['source'])}: {pages}")
        lines.append("")

    checked, broken = readiness.get("links_checked", 0), readiness.get("broken_links", [])
    if checked:
        lines += ["### Docs links in the generated text", ""]
        if broken is None:
            lines.append(_status_item("unknown", f"{checked} link(s)", "not checked; the docs pages could not be read"))
        elif not broken:
            lines.append(_status_item("pass", f"{checked} link(s)", "every page and heading exists"))
        for problem in broken or []:
            lines.append(_status_item("fail", problem["url"], problem["problem"]))
        lines.append("")

    not_placed = readiness.get("not_placed", [])
    if not_placed:
        lines += [f"### Not placed by the model: {len(not_placed)} note(s)", "",
                  "The model left these out of the changelog text, even after being asked again. "
                  "The model may have folded one into a bullet without its ID, so search the text before adding it. "
                  "A PR with none of its notes placed is left out of the changelog-sources list, "
                  "so the next run tries it again.", ""]
        for note in not_placed:
            kept = "" if not note["recorded"] else " (another note of this PR was placed, so the PR is recorded; add this one by hand)"
            lines.append(f"- {pr(note['source'])}{kept}: \"{note['excerpt'].replace('`', chr(39))}\"")
        lines.append("")

    restated = readiness.get("restated", [])
    if restated:
        lines += [f"### Notes that only restate a migration: {len(restated)}", "",
                  "No bullet was written for these, since the migration is listed under Database Schema Changes.", ""]
        lines += [f"- {pr(note['source'])}: migration `{note['migration']}`" for note in restated]
        lines.append("")

    blocking = [check for check in readiness["preflight"] if check["status"] == "fail" and check["blocking"]]
    lines += [f"**Generator status: {'NOT READY (preflight failing)' if blocking else 'ready to run'}**", ""]
    return lines


def _docs_link(url: str, title: str | None) -> str:
    """A Markdown link to a docs page, labelled with its title (or path when untitled)."""
    return f"[{title or url.removeprefix(changelog_release.DOCS_SITE) or '/'}]({url})"


def write_outputs(output_dir: str, entry: str, payload: dict, pr_body: str, model_output: str = "") -> None:
    """Write entry.mdx, sections.json, pr_body.md, summary.md and, when the model was asked, model_output.md."""
    if not output_dir:
        return
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "entry.mdx"), "w", encoding="utf-8") as f:
        f.write(entry)
    with open(os.path.join(output_dir, "sections.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    with open(os.path.join(output_dir, "pr_body.md"), "w", encoding="utf-8") as f:
        f.write(pr_body)
    with open(os.path.join(output_dir, "summary.md"), "w", encoding="utf-8") as f:
        f.write(render_summary(payload, entry))
    if model_output:
        with open(os.path.join(output_dir, "model_output.md"), "w", encoding="utf-8") as f:
            f.write(model_output)


def _pr_link(source: str, private=()) -> str:
    """A link to a PR, saying when only people with access to its private repo can open it."""
    repo, _, number = source.partition("#")
    if not number:
        return f"`{source}`"
    return f"[{source}](https://github.com/{repo}/pull/{number})" + (" (private repo)" if repo in private else "")


def render_summary(payload: dict, entry: str) -> str:
    """The run summary: what was generated, the run's metrics, and the PRs that need a look."""
    metrics = payload["metrics"]
    private = payload["readiness"].get("repos_private", [])
    lines = [f"## {payload['version']} changelog ({payload['mode']})", ""]
    if payload.get("proposed_before"):
        proposed = payload["proposed_sources"]
        lines += [
            "### Action needed: confirm the changelog sources",
            f"The changelog PR has no changelog-sources list, so nothing was changed. These "
            f"{len(proposed)} source(s) were merged before its branch was last updated "
            f"({payload['proposed_before']}), or were read from the release diff. Check that the "
            "entry covers each one, drop any it does not, and add the comment below to the PR "
            "body. The next run then adds only what is missing.",
            "",
            "<details><summary>Proposed sources</summary>",
            "",
        ]
        lines += [f"- {_pr_link(source, private)}" for source in proposed]
        lines += [
            "",
            "</details>",
            "",
            "```",
            render_pr_body("", set(proposed)).strip(),
            "```",
            "",
        ]
    elif payload["mode"] == "update" and not payload["changed"]:
        lines += ["No new release notes since the last run.", ""]

    lines += render_status(payload["readiness"])

    lines += ["| Metric | Value |", "|:---|---:|"]
    lines += [f"| {key.replace('_', ' ')} | {value} |" for key, value in metrics.items()]
    lines.append("")

    if entry.strip():
        lines += ["Added to the open changelog PR:" if payload["mode"] == "update" else "Generated entry:", ""]
        lines += ["````mdx", entry.rstrip(), "````", ""]
    lines.append(
        "Each section's bullets and their sources are in `sections.json` in the "
        "`changelog-output` artifact, next to the model's raw answers in `model_output.md`."
    )
    return "\n".join(lines) + "\n"


def set_github_output(name: str, value) -> None:
    """Append ``name=value`` to ``$GITHUB_OUTPUT`` when it is set."""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{name}={value}\n")


# The template's Release Note section, which the changelog PR itself needs: without a
# release-note block (and the release-note-none label the workflow adds) the PR is labelled
# do-not-merge/release-note-label-needed.
RELEASE_NOTE_SECTION = "#### Release Note\n```release-note\nNONE\n```"
_RELEASE_NOTE_BLOCK_RE = re.compile(r"```release-note\b", re.IGNORECASE)


def with_release_note_section(body: str) -> str:
    """``body`` with the template's Release Note section (``NONE``), added when it has none.
    It goes above the changelog-sources list, which stays last."""
    if _RELEASE_NOTE_BLOCK_RE.search(body or ""):
        return body
    sources = _SOURCES_COMMENT_RE.search(body or "")
    if sources:
        return body[:sources.start()].rstrip() + "\n\n" + RELEASE_NOTE_SECTION + "\n\n" + body[sources.start():]
    return (body or "").rstrip() + "\n\n" + RELEASE_NOTE_SECTION + "\n"


def default_pr_body() -> str:
    """The body of a new changelog PR, explaining how reruns treat it."""
    return with_release_note_section(
        f"Auto-generated changelog for milestone `{MILESTONE_TITLE}` from `{', '.join(REPOS)}`.\n\n"
        "Re-running the **Generate Changelog** workflow in `auto` mode adds release notes "
        "from newly merged PRs to this PR and leaves every existing line, including edits "
        "made here, untouched, except that the Go version, the pre-packaged plugin version "
        "links and the benchmarking line are kept in step with the release branch and the "
        "performance report. `regenerate` mode rebuilds the entry from scratch and discards "
        "those edits.\n"
    )


# What the model answered in this run, in order, kept for the run artifact. Without it a
# note that went missing cannot be traced: the logs do not carry the answer.
MODEL_ANSWERS: list[dict] = []


def render_model_output(sources_by_id: dict) -> str:
    """The model's raw answers, with the note ID each source was sent as, for ``model_output.md``.

    Everything in it ends up in the published changelog text or is a note's own text, so it
    exposes nothing the changelog does not. Empty when the model was not asked.
    """
    if not MODEL_ANSWERS:
        return ""
    lines = ["# Model output", "", "Raw answers before any cleanup, in the order they were received.", "",
             "| Note ID | Source |", "|:---|:---|"]
    lines += [f"| {note_id} | {source} |" for note_id, source in sources_by_id.items()]
    for number, answer in enumerate(MODEL_ANSWERS, start=1):
        lines += ["", f"## Answer {number}: {answer['kind']} ({', '.join(answer['ids'])})", "", "````markdown",
                  answer["text"], "````"]
    return "\n".join(lines) + "\n"


def render_fragment(notes: list[dict], sources_by_id: dict) -> tuple[str, list[dict], set, bool]:
    """Polish ``notes`` into MDX-safe changelog text and attribute each bullet to its PRs.

    Returns the text (``BLOG_POST_LINK`` still a placeholder, Go Version heading still
    empty), the bullet items, the note IDs the bullets referenced, and whether the text
    was AI-polished.
    """
    raw_polished, ai_polished = polish_with_ai(notes)
    if ai_polished:
        MODEL_ANSWERS.append({"kind": "first answer", "ids": [note["id"] for note in notes], "text": raw_polished})
    # normalize_formatting fixes layout; escape_mdx_unsafe makes the prose MDX-safe.
    # Both are applied to the generated fragment only, never to file contents. The
    # [[N1]] markers pass through both untouched and are stripped afterwards.
    polished = escape_mdx_unsafe(normalize_formatting(raw_polished))
    url_sources = {}
    for note in notes:
        if note.get("docs_url"):
            url_sources.setdefault(note["docs_url"], set()).add(note["source"])
    polished = drop_repeated_notes(drop_misplaced_doc_links(polished, url_sources, sources_by_id))
    polished = tidy_generated(polished, notes)
    polished, items, referenced = extract_source_markers(polished, sources_by_id)

    items, referenced = _drop_go_version(items, referenced)

    missing = dropped_notes(notes, referenced) if ai_polished else []
    if missing:
        print(f"⚠️  The model left out {len(missing)} note(s): {', '.join(note['id'] for note in missing)}")
        polished, items, referenced = _place_missing(polished, items, referenced, missing, sources_by_id, url_sources)
    return polished, items, referenced, ai_polished


_RETRY_WRAPPER = "## Release v0.0"

_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)\s]+)\)")


def _bullet_blocks(lines: list[str]) -> list[dict]:
    """Each bullet of generated text with its line range, ``###``/``####`` location and note IDs.

    A bullet's block is its first line plus the indented lines that continue it.
    """
    blocks = []
    section = subsection = None
    index = 0
    while index < len(lines):
        heading = re.match(r"^(#{3,4}) +(.*?)\s*$", lines[index])
        if heading:
            if len(heading.group(1)) == 3:
                section, subsection = heading.group(2), None
            else:
                subsection = heading.group(2)
        elif _BULLET_RE.match(lines[index]):
            end = index + 1
            while end < len(lines) and lines[end].strip() and not _BULLET_RE.match(lines[end]) and lines[end].startswith(" "):
                end += 1
            ids = [part.strip() for line in lines[index:end] for match in _SOURCE_MARKER_RE.finditer(line)
                   for part in match.group(1).split(",")]
            blocks.append({"start": index, "end": end, "section": section, "subsection": subsection, "ids": ids})
            index = end
            continue
        index += 1
    return blocks


def drop_misplaced_doc_links(text: str, url_sources: dict, sources_by_id: dict) -> str:
    """Unlink a docs page the model put on a bullet that none of the page's PRs wrote.

    ``url_sources`` maps each docs URL sent with a note to the PRs it belongs to. A link on a
    bullet whose markers name none of them is a different feature's page, so it is replaced
    by its label. Links to pages that were not sent are left to the link check.
    """
    known = {}
    for url, sources in url_sources.items():
        known.setdefault(url.split("#")[0].rstrip("/"), set()).update(sources)
    lines = text.split("\n")
    for block in _bullet_blocks(lines):
        own = {sources_by_id[note_id] for note_id in block["ids"] if note_id in sources_by_id}

        def unlink(match):
            owners = known.get(match.group(2).split("#")[0].rstrip("/"))
            return match.group(1) if owners and not owners & own else match.group(0)
        for number in range(block["start"], block["end"]):
            lines[number] = _MD_LINK_RE.sub(unlink, lines[number])
    return "\n".join(lines)


def drop_repeated_notes(text: str) -> str:
    """Keep each note in one place: drop a bullet whose notes were all placed earlier elsewhere.

    The first placement wins. A bullet that also carries a note not seen before is kept.
    ``### Go Version`` does not count, since its bullets are replaced.
    """
    lines = text.split("\n")
    placed = {}
    drop = set()
    for block in _bullet_blocks(lines):
        if block["section"] == "Go Version":
            continue
        where = (block["section"], block["subsection"])
        if block["ids"] and all(placed.get(note_id, where) != where for note_id in block["ids"]):
            drop.update(range(block["start"], block["end"]))
            continue
        for note_id in block["ids"]:
            placed.setdefault(note_id, where)
    return "\n".join(line for number, line in enumerate(lines) if number not in drop)


DB_SCHEMA = "Database Schema Changes"
# "(migration 000238)", "(migrations 000238 and 000239)", " in migration ``000238_add_x``".
_MIGRATION_REF_RES = (
    re.compile(r"[ \t]*\((?:[^()]*\s)?(?:database |schema )?migrations?\b[^()]*\b\d{6}\b[^()]*\)", re.IGNORECASE),
    re.compile(r"[ \t]*,?[ \t]*\b(?:in|with|via|using|by)?[ \t]*(?:the[ \t]+)?(?:database |schema )?migrations?[ \t]+"
               r"`{0,2}\d{6}(?:_\w+)?`{0,2}(?:[ \t]*(?:,|and)[ \t]*`{0,2}\d{6}(?:_\w+)?`{0,2})*", re.IGNORECASE),
    re.compile(r"[ \t]*\(`{0,2}\d{6}_\w+`{0,2}\)"),
)
_TRAILING_MARKERS_RE = re.compile(r"((?:[ \t]*\[\[[^\]]*\]\])+)[ \t]*$")
# "Added ``GET .../thread`` with ``updatesOnly=true`` now includes ...": the note already has its verb.
# Only when the bullet goes straight from an identifier to its "now <verb>s", with no clause
# in between ("Added TLS so the cluster now uses ..." is a sentence and keeps its "Added").
_ADDED_SENTENCE_RE = re.compile(
    r"^(?P<lead>[ \t]*- )Added (?P<rest>``[^`]+``"
    r"(?:(?!\b(?:so|which|that|it|they|this|where|when|because|while|if)\b)[^,;:.])*?\bnow\s+[a-z]+s\b.*)$"
)
# Fewer words than this left after taking a migration reference out: the reference was the subject.
MIN_STRIPPED_WORDS = 3


def fill_version(text: str, version_short: str) -> str:
    """The Database Schema Changes summary with the version in place of the prompt's placeholder."""
    return re.sub(r"\b(?:the )?VERSION release\b", f"the {version_short} release", text)


def strip_migration_numbers(text: str) -> str:
    """Take migration numbers and file names out of every bullet outside Database Schema Changes."""
    lines = text.split("\n")
    for block in _bullet_blocks(lines):
        if block["subsection"] == DB_SCHEMA:
            continue
        stripped = []
        for line in lines[block["start"]:block["end"]]:
            for pattern in _MIGRATION_REF_RES:
                line = pattern.sub("", line)
            stripped.append(re.sub(r"[ \t]+([.,;])", r"\1", line))
        words = re.findall(r"[A-Za-z]+", _SOURCE_MARKER_RE.sub("", " ".join(stripped)))
        if len(words) < MIN_STRIPPED_WORDS:
            # "Reverted migration 000238." would become "Reverted.": keep it for a reviewer.
            print(f"::warning title=Migration number left in a bullet::{lines[block['start']].strip()[:120]} "
                  "names a migration outside Database Schema Changes; move it there by hand")
            continue
        lines[block["start"]:block["end"]] = stripped
    return "\n".join(lines)


def drop_added_before_verb(text: str) -> str:
    """Drop an "Added" the model put in front of a note that is already a sentence with its own verb."""
    out = []
    for line in text.split("\n"):
        match = _ADDED_SENTENCE_RE.match(line)
        if match:
            rest = match.group("rest")
            line = match.group("lead") + (rest[:1].upper() + rest[1:] if rest[:1].isalpha() else rest)
        out.append(line)
    return "\n".join(out)


_SEE_THE_RE = re.compile(r"\bSee the\b")
_TITLE_STOPWORDS = {
    "about", "after", "before", "configure", "configuration", "developers", "docs", "documentation",
    "from", "guide", "html", "https", "integrate", "manage", "mattermost", "setting", "settings", "that",
    "this", "using", "with", "your",
}


def _page_words(url: str, title: str | None) -> set[str]:
    """Distinctive words of a docs page's title and path, to tell its bullet from another PR's."""
    text = f"{title or ''} {urllib.parse.urlparse(url).path} {urllib.parse.urlparse(url).fragment}"
    return {word for word in re.findall(r"[a-z0-9]+", text.lower().replace("_", "")) if len(word) >= 4} - _TITLE_STOPWORDS


def link_docs_pages(text: str, docs: dict, already: str = "", sources_by_id: dict | None = None) -> str:
    """Link each note's docs page from one bullet of that note's PR, once.

    ``docs`` maps a note ID to ``(url, title)``; ``sources_by_id`` maps a note ID to its PR. A
    page the model linked anywhere (in ``text`` or ``already``) is left alone. Otherwise the
    page goes on a bullet written only from that PR's notes; failing that, on a bullet that
    also carries another PR's note only when the bullet names something in the page's title
    or path, so a combined bullet (two PRs listed the same setting) doesn't get the other
    PR's page. A bullet never gets a second "See the ... documentation" sentence.
    """
    sources_by_id = sources_by_id or {}

    def page(url: str) -> str:
        return url.split("#")[0].split("?")[0].rstrip("/")

    lines = text.split("\n")
    linked = {page(match.group(2)) for match in _MD_LINK_RE.finditer(already)}
    pages = {}  # page -> (url, title, the PRs whose notes have it)
    for note_id, (url, title) in docs.items():
        if url:
            entry = pages.setdefault(page(url), (url, title, set()))
            entry[2].add(sources_by_id.get(note_id, note_id))

    def block_text(block):
        return "\n".join(lines[block["start"]:block["end"]])

    def owners(block):
        return {sources_by_id.get(note_id, note_id) for note_id in block["ids"]}

    for key, (url, title, prs) in pages.items():
        if key in linked | {page(match.group(2)) for match in _MD_LINK_RE.finditer("\n".join(lines))}:
            continue
        blocks = [block for block in _bullet_blocks(lines)
                  if owners(block) & prs and not _SEE_THE_RE.search(block_text(block))]
        words = _page_words(url, title)
        own = [block for block in blocks if owners(block) <= prs]
        shared = [block for block in blocks if not owners(block) <= prs
                  and any(word in _SOURCE_MARKER_RE.sub("", block_text(block)).lower() for word in words)]
        target = next((block for block in own
                       if any(word in _SOURCE_MARKER_RE.sub("", block_text(block)).lower() for word in words)),
                      own[0] if own else (shared[0] if shared else None))
        if target is None:
            continue
        last = target["end"] - 1
        markers = _TRAILING_MARKERS_RE.search(lines[last])
        body = lines[last][:markers.start()] if markers else lines[last]
        tail = lines[last][markers.start():] if markers else ""
        # The title is page text: escaped like the rest of the fragment, which was escaped before this.
        shown = escape_mdx_unsafe(re.sub(r"([\[\]])", r"\\\1", title)) if title else title
        label = f"[{shown}]({url}) documentation" if title else f"[documentation]({url})"
        lines[last] = f"{body.rstrip()} See the {label} for details.{tail}"
    return "\n".join(lines)


# Words the model sometimes puts in code although they are prose: an acronym or product
# term, not a setting, command or identifier.
PLAIN_WORDS = {"AI", "API", "APIs", "UI", "UX", "SSO", "SAML", "LDAP", "MFA", "OAuth", "URL", "URLs",
               "HTTP", "HTTPS", "TLS", "SQL", "CSV", "PDF", "JSON", "YAML", "HA"}
_CODE_SPAN_RE = re.compile(r"``([^`\n]+?)``|(?<!`)`([^`\n]+?)`(?!`)")


def unformat_plain_words(text: str) -> str:
    """Take code formatting off plain words: ``AI``-generated becomes AI-generated, and an
    acronym such as ``SAML`` on its own becomes SAML. Identifiers keep their formatting,
    ``post``-type included."""
    def plain(match):
        word = match.group(1) or match.group(2)
        follows = text[match.end():match.end() + 2]
        # An acronym run into a word (``AI``-generated); a lowercase identifier (``post``-type) keeps its code.
        if word in PLAIN_WORDS or (re.fullmatch(r"[A-Z]{2,5}", word) and re.match(r"-[A-Za-z]", follows)):
            return word
        return match.group(0)
    return _CODE_SPAN_RE.sub(plain, text)


_FIRST_SENTENCE_RE = re.compile(r"^(.*?[.!?])(?:\s|$)", re.DOTALL)


def is_mmctl_bullet(text: str) -> bool:
    """Whether a bullet is mainly about mmctl: its first sentence's first code span is an mmctl
    command (or a flag given to the mmctl command named next), and the sentence isn't about the
    System Console. "Added ``mmctl plugin keys`` commands" is; "Added a button to the System
    Console and an ``mmctl health run`` command" is not."""
    body = _SOURCE_MARKER_RE.sub("", text).strip().lstrip("-* ").strip()
    first = _FIRST_SENTENCE_RE.match(body)
    sentence = first.group(1) if first else body
    if "System Console" in sentence:
        return False
    spans = [a or b for a, b in _CODE_SPAN_RE.findall(sentence)]
    if not spans:
        return False
    if spans[0].startswith("mmctl"):
        return True
    return spans[0].startswith("-") and len(spans) > 1 and spans[1].startswith("mmctl")


def move_mmctl_bullets(text: str) -> str:
    """Move bullets mainly about mmctl commands or flags from ``#### Administration`` to
    ``#### mmctl`` (created after Administration if needed). The prompt asks for this; this
    makes sure of it."""
    lines = text.split("\n")
    moving = [block for block in _bullet_blocks(lines)
              if block["section"] == "Improvements" and block["subsection"] == "Administration"
              and is_mmctl_bullet("\n".join(lines[block["start"]:block["end"]]))]
    if not moving:
        return text
    taken = [line for block in moving for line in lines[block["start"]:block["end"]]]
    drop = {number for block in moving for number in range(block["start"], block["end"])}
    # Text that starts with its release heading (a whole entry) keeps it: only the sections are merged.
    first = next((i for i, line in enumerate(lines) if line.startswith("### ")), 0)
    head = lines[:first]
    rest = "\n".join(line for number, line in enumerate(lines) if number not in drop and number >= first)
    rest = drop_bulletless_sections(rest)
    merged = merge_into_entry(f"{_RETRY_WRAPPER}\n\n{rest}", "v0.0",
                              "### Improvements\n\n#### mmctl\n" + "\n".join(taken))
    body = merged.split("\n", 2)[2].rstrip("\n") + ("\n" if text.endswith("\n") else "")
    return "\n".join(head + [body]) if head else body


def merge_related_compatibility(text: str, notes: list[dict]) -> str:
    """Write one ``#### Important Upgrade Notes`` bullet for bullets whose PRs share a Jira ticket: two PRs
    for one dependency change (replacing the openpgp library, then rejecting SHA-1 signatures
    with it) are one change for an administrator. The first bullet keeps its place; the others'
    sentences are appended to it, with all their source markers."""
    tickets = {note["id"]: set(note.get("tickets") or ()) for note in notes if note.get("id")}
    lines = text.split("\n")
    blocks = [block for block in _bullet_blocks(lines)
              if block["subsection"] in UPGRADE_NOTES_NAMES and block["end"] - block["start"] == 1]
    groups = []  # [first block, [blocks merged into it], its tickets]
    for block in blocks:
        keys = set().union(*(tickets.get(note_id, set()) for note_id in block["ids"])) if block["ids"] else set()
        group = next((g for g in groups if g[2] & keys), None) if keys else None
        if group:
            group[1].append(block)
            group[2] |= keys
        else:
            groups.append([block, [], keys])
    drop = set()
    for first, others, _ in groups:
        if not others:
            continue
        texts, ids = [], []
        for block in [first, *others]:
            line = lines[block["start"]]
            texts.append(_SOURCE_MARKER_RE.sub("", line).strip().lstrip("-").strip())
            ids += [note_id for note_id in block["ids"] if note_id not in ids]
        indent = re.match(r"^( *)", lines[first["start"]]).group(1)
        lines[first["start"]] = f"{indent}- {' '.join(texts)} [[{','.join(ids)}]]"
        drop.update(block["start"] for block in others)
    return "\n".join(line for number, line in enumerate(lines) if number not in drop)


# ── config.json settings grouped by plan ─────────────────────────────────────────────

_PLAN_LABEL_RE = re.compile(r"^ *- \*\*Changes to [^*]*:\*\*\s*$")
_SETTING_RE = re.compile(r"Under ``(\w+)`` in ``config\.json``, added ``(\w+)``|added ``(\w+)\.(\w+)``")
# What each setting's plan was worked out from, for the readiness report; reset each run.
CONFIG_PLANS: list[dict] = []
_RESOLVER = None


def plan_resolver():
    """The resolver for this run: the System Console and docs as they are at DOCS_REF (the commit
    the run checked out first), not the changelog PR's older branch; the working tree without it."""
    global _RESOLVER
    if _RESOLVER is None:
        ref = os.environ.get("DOCS_REF", "").strip()
        if ref:
            folder = changelog_release.CONFIGURE_DOCS + "/"
            try:
                docs = [path for path in changelog_release.git_ls(ref, folder) if path.endswith(".mdx")]
                _RESOLVER = changelog_release.PlanResolver(read=lambda path: changelog_release.git_show(ref, path), docs=docs)
            except RuntimeError as err:
                print(f"::warning title=Plans read from the working tree::{err}")
        _RESOLVER = _RESOLVER or changelog_release.PlanResolver()
    return _RESOLVER


def group_config_plans(text: str, resolver=None, report: list | None = None) -> str:
    """Regroup the settings under ``#### config.json`` by plan, from the code and docs
    (``changelog_release.PlanResolver``), never from the model: Enterprise Advanced,
    Enterprise, Professional (and up), then All Plans, each heading only when it has
    settings. A setting whose plan can't be worked out goes under All Plans and into
    ``report`` (``CONFIG_PLANS``) as "plan not confirmed". The description paragraph comes
    first and top-level bullets that aren't plan labels (removed settings) last, as they were.
    """
    resolver = resolver or plan_resolver()
    report = CONFIG_PLANS if report is None else report
    lines = text.split("\n")
    start = next((i for i, line in enumerate(lines) if re.match(r"^#### config\.json\s*$", line)), None)
    if start is None:
        return text
    end = next((i for i in range(start + 1, len(lines)) if re.match(r"^#{2,4} ", lines[i])), len(lines))
    while end > start + 1 and not lines[end - 1].strip():
        end -= 1
    intro, settings, others = [], [], []  # others: top-level bullets that aren't plan labels
    current = None  # the block the next continuation line belongs to
    for line in lines[start + 1:end]:
        indent = _bullet_indent(line)
        if not line.strip():
            current = None
        elif indent is None:
            if current is not None:
                current.append(line)  # a continuation of the bullet above
            elif not settings and not others:
                intro.append(line)  # the description paragraph
            else:
                others.append([line])
        elif indent <= 1:
            current = None if _PLAN_LABEL_RE.match(line) else [line]
            if current is not None:
                others.append(current)
        elif current is not None and settings and current is settings[-1] and indent > _bullet_indent(current[0]):
            current.append(line)  # a bullet nested under a setting
        else:
            current = [line]
            settings.append(current)
    if not settings:
        return text
    groups = {plan: [] for plan in changelog_release.PLAN_ORDER}
    for block in settings:
        found = _SETTING_RE.search(_SOURCE_MARKER_RE.sub("", block[0]))
        if found:
            section, name = (found.group(1), found.group(2)) if found.group(1) else (found.group(3), found.group(4))
            result = resolver.plan(section, name)
        else:
            result = {"setting": _SOURCE_MARKER_RE.sub("", block[0]).strip(" -")[:80], "plan": "All", "confirmed": False,
                      "basis": "the bullet doesn't name a setting the way the changelog does (Under ``Section`` ... added ``Setting``)"}
        report.append(result)
        groups[result["plan"]].append([("   " + line.lstrip()) if i == 0 else line for i, line in enumerate(block)])
    rebuilt = list(intro)
    for plan in changelog_release.PLAN_ORDER:
        if groups[plan]:
            rebuilt.append(" - " + changelog_release.PLAN_HEADINGS[plan])
            rebuilt += [line for block in groups[plan] for line in block]
    rebuilt += [line for other in others for line in other]
    lines[start + 1:end] = rebuilt
    return "\n".join(lines)


def rename_upgrade_notes(text: str) -> str:
    """Generated text uses the subsection's current name, even when the model wrote the old one."""
    return re.sub(r"(?m)^#### Compatibility[ \t]*$", f"#### {UPGRADE_NOTES}", text)


# ── The Important block at the end of Upgrade Impact ────────────────────────────────

UPGRADE_IMPORTANT_OPEN = "If you upgrade from a release earlier than"
UPGRADE_IMPORTANT = (
    "If you upgrade from a release earlier than {previous}, please read the other [Important Upgrade Notes]"
    "(https://docs.mattermost.com/administration-guide/upgrade/important-upgrade-notes.html). In case of an upgrade "
    "failure, please check the [Downgrade Guide](https://docs.mattermost.com/administration-guide/upgrade/"
    "downgrading-mattermost-server.html) and the [Recovery Guide](https://docs.mattermost.com/deployment-guide/"
    "backup-disaster-recovery.html) for rollback steps and interim mitigation strategy."
)


def previous_feature_release(version: str, base_ref: str = "") -> str | None:
    """The release before ``version``, as vX.Y: the diff base (v12.1 for v12.2, v11.11 for
    v12.0), else the previous minor of the same major. None when neither tells."""
    match = re.search(r"(\d+)\.(\d+)", (base_ref or "").split("/")[-1])
    if match:
        return f"v{match.group(1)}.{match.group(2)}"
    major, minor, _ = changelog_release.parse_version(version)
    return f"v{major}.{minor - 1}" if minor > 0 else None


def apply_upgrade_important(content: str, version_short: str, previous: str | None) -> tuple[str, str]:
    """Add the <Important> upgrade block at the end of the entry's ``### Upgrade Impact``
    (created when the entry has none), after its last bullet and before the next section, with
    a blank line before and after each tag: (content, "added" | "kept" | "" when there's no
    entry or no previous release). Once added it is never edited or added again."""
    lines = content.split("\n")
    start = _entry_start(lines, version_short)
    if start is None or not previous:
        return content, ""
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## Release ")), len(lines))
    for i in range(start, end):
        if lines[i].strip() == "<Important>" and any(
                UPGRADE_IMPORTANT_OPEN in lines[j] for j in range(i + 1, min(i + 4, end))):
            return content, "kept"
    block = ["<Important>", "", UPGRADE_IMPORTANT.format(previous=previous), "", "</Important>"]
    impact = next((i for i in range(start, end) if re.match(r"^### Upgrade Impact\s*$", lines[i])), None)
    if impact is None:
        first = next((i for i in range(start + 1, end) if lines[i].startswith("### ")), end)
        lines[first:first] = ["### Upgrade Impact", ""] + block + [""]
        return "\n".join(lines), "added"
    section_end = next((i for i in range(impact + 1, end) if re.match(r"^#{2,3} ", lines[i])), end)
    last = section_end
    while last > impact + 1 and not lines[last - 1].strip():
        last -= 1
    lines[last:section_end] = [""] + block + [""]
    return "\n".join(lines), "added"


def tidy_generated(text: str, notes: list[dict], already: str = "") -> str:
    """The deterministic fixes applied to the model's text while it still carries its markers."""
    docs = {note["id"]: (note["docs_url"], note.get("docs_title")) for note in notes if note.get("docs_url")}
    sources_by_id = {note["id"]: note["source"] for note in notes if note.get("id")}
    text = fill_version(text, changelog_release.short_version(VERSION))
    text = unformat_plain_words(drop_added_before_verb(strip_migration_numbers(text)))
    text = merge_related_compatibility(rename_upgrade_notes(text), notes)
    text = move_mmctl_bullets(text)
    text = group_config_plans(text)
    return link_docs_pages(text, docs, already, sources_by_id)


def _drop_go_version(items: list[dict], referenced: set) -> tuple[list[dict], set]:
    """Forget the bullets under ``### Go Version`` and the notes only they carried.

    That section is written from the release branch's build image: whatever the model put
    under it is replaced (create) or removed (update). A note attributed only there is not
    in the text, so it counts as dropped (and is retried), not as placed. Notes are pruned
    by ID, not by PR: another note of the same PR may be placed elsewhere.
    """
    kept = [item for item in items if item["section"] != "Go Version"]
    if len(kept) == len(items):
        return items, referenced
    kept_ids = {note_id for item in kept for note_id in item["ids"]}
    gone_ids = {note_id for item in items if item["section"] == "Go Version" for note_id in item["ids"]}
    return kept, referenced - (gone_ids - kept_ids)


def drop_bulletless_sections(text: str) -> str:
    """Rebuild ``text`` without ``###``/``####`` sections that have no bullet, and without text before the first heading.

    Filtering a retry answer can leave a heading, such as ``### Improvements`` with its blog
    post line, with nothing under it, and the merge would add that empty section.
    """
    def has_bullet(lines):
        return any(_BULLET_RE.match(line) for line in lines)

    out = []
    for section in parse_fragment(text):
        subsections = [sub for sub in section["subsections"] if has_bullet(sub["lines"])]
        if not subsections and not has_bullet(section["lines"]):
            continue
        out += [f"### {section['title']}"] + section["lines"]
        for sub in subsections:
            out += [f"#### {sub['title']}"] + sub["lines"]
    return "\n".join(out) + "\n"


def keep_requested_bullets(text: str, wanted: set) -> str:
    """Drop the bullets of ``text`` whose markers name only notes outside ``wanted``.

    ``text`` must already be normalized (``-`` bullets). A bullet with no marker is
    kept, since it may be a plan-label parent of marked bullets. A bullet's
    continuation lines go with it.
    """
    out = []
    skipping = False
    for line in text.split("\n"):
        if _BULLET_RE.match(line):
            ids = {part.strip() for match in _SOURCE_MARKER_RE.finditer(line) for part in match.group(1).split(",")}
            skipping = bool(ids) and not ids & wanted
        elif not line.strip() or not line.startswith(" "):
            skipping = False
        if not skipping:
            out.append(line)
    return "\n".join(out)


def _place_missing(polished: str, items: list[dict], referenced: set, missing: list[dict],
                   sources_by_id: dict, url_sources: dict) -> tuple[str, list[dict], set]:
    """Retry once with only the dropped notes and merge what comes back into ``polished``.

    The answer is merged the way update mode merges a fragment, into the section it names.
    A note counts as placed only if its bullet reached the text: an answer with no section
    heading has nowhere to go, so it is discarded and the notes stay dropped.
    """
    try:
        retry_raw, asked = place_missing_with_ai(missing)
    except Exception as err:  # the first answer is usable, so a failed retry must not stop the run
        print(f"::warning title=Retry request failed::{type(err).__name__}; the notes stay unplaced")
        return polished, items, referenced
    if asked:
        MODEL_ANSWERS.append({"kind": "retry for the notes it left out", "ids": [note["id"] for note in missing],
                              "text": retry_raw})
    if not asked or not retry_raw.strip():
        return polished, items, referenced
    # Only the notes that were asked for: the model may repeat one the first answer already
    # placed, and a repeated childless bullet would be inserted a second time.
    wanted = {note["id"] for note in missing}
    retry_text = drop_bulletless_sections(keep_requested_bullets(normalize_formatting(retry_raw), wanted))
    retry_text = escape_mdx_unsafe(normalize_formatting(retry_text))
    retry_text = drop_misplaced_doc_links(retry_text, url_sources, sources_by_id)
    retry_text = tidy_generated(retry_text, missing, already=polished)
    retry_text, retry_items, retry_referenced = extract_source_markers(retry_text, sources_by_id)
    retry_items, retry_referenced = _drop_go_version(retry_items, retry_referenced)
    if not retry_referenced & wanted:
        return polished, items, referenced
    merged = merge_into_entry(f"{_RETRY_WRAPPER}\n\n{polished}", "v0.0", retry_text)
    try:
        require_fragment_merged(retry_text, merged)
    except RuntimeError as err:
        print(f"::warning title=Retry answer discarded::{err}")
        return polished, items, referenced
    still_missing = sorted(wanted - retry_referenced)
    if still_missing:
        print(f"⚠️  The retry still left out {len(still_missing)} note(s): {', '.join(still_missing)}")
    return merged.split("\n", 2)[2], items + retry_items, referenced | retry_referenced


def blog_post_link() -> str:
    """The Markdown link to the release's blog post, built from the version when no URL is given."""
    blog_url = os.environ.get("BLOG_POST_URL", "").strip()
    if not blog_url:
        # Auto-construct short URL (no patch suffix): v11.6.0 → mattermost-v11-6-is-now-available
        version_slug = re.sub(r"-\d+$", "", VERSION.lstrip("v").replace(".", "-"))
        blog_url = f"https://mattermost.com/blog/mattermost-v{version_slug}-is-now-available/"
        print(f"ℹ️  No blog post URL provided — using auto-constructed URL: {blog_url}")
    # Format as a Markdown link matching existing changelog style: [this blog post](url)
    return f"[this blog post]({blog_url})"


def main():
    CONFIG_PLANS.clear()
    """Generate or update the entry, then write the readiness report and outputs."""
    mode = os.environ.get("MODE", "create").strip().lower() or "create"
    if mode not in ("create", "update"):
        raise RuntimeError(f"MODE must be 'create' or 'update', not {mode!r}")
    output_dir = os.environ.get("OUTPUT_DIR", "").strip()
    MODEL_ANSWERS.clear()

    print(f"🔍 Milestone: {MILESTONE_TITLE} | Repos: {', '.join(REPOS)} | Mode: {mode}\n")

    started = time.monotonic()
    # Each note keeps the PR it came from, so every bullet written can be traced back.
    all_notes = []
    total_prs = 0
    no_notes_prs = []
    flagged_prs = []

    milestones = {}
    unaudited = []
    note_quality = []
    milestone_prs = {}
    private_repos = []
    named_docs = {}
    lookup_endpoint = endpoint_lookup(os.environ.get("RELEASE_BASE_REF", "").strip(),
                                      os.environ.get("RELEASE_HEAD_REF", "").strip())

    for repo in REPOS:
        print(f"── {repo}")
        try:
            milestone_number = get_milestone_number(repo, MILESTONE_TITLE)
            milestones[repo] = milestone_number
            if repo_is_private(repo):
                private_repos.append(repo)
            prs = get_merged_prs(repo, milestone_number) if milestone_number is not None else []
        except requests.HTTPError as err:
            status = err.response.status_code if err.response is not None else None
            if status not in (401, 403, 404) or is_rate_limited(err.response):
                raise
            # A repo the token cannot read is unknown, not a repo with nothing missing.
            reason = f"HTTP {status} for the workflow token"
            milestones[repo] = reason
            unaudited.append({"repo": repo, "reason": reason})
            print(f"::warning title=Repo not audited::{repo}: {reason}; its PRs are not in this changelog")
            continue
        if milestone_number is None:
            continue

        print(f"   📋 Found {len(prs)} merged PR(s)")
        total_prs += len(prs)

        for pr in sorted(prs, key=lambda p: p["number"]):
            source = f"{repo}#{pr['number']}"
            body = pr.get("body") or ""
            milestone_prs[source] = {"title": pr["title"], "body": body}
            labels = {label["name"] for label in pr.get("labels") or []}
            # An opt-out label wins over a release-note block, which some PRs carry from
            # the template next to Changelog/Not Needed.
            opted_out = bool(labels & NO_NOTE_LABELS)
            notes = None if opted_out else extract_release_notes(body)
            merged_at = (pr.get("pull_request") or {}).get("merged_at")
            if notes:
                for note in notes:
                    note, named_url = split_docs_line(note)
                    if named_url:
                        named_docs.setdefault(source, named_url)
                    note, unresolved = resolve_endpoint_lines(note, lookup_endpoint)
                    for line in unresolved:
                        print(f"::warning title=API endpoint path not resolved::{source}: {line}")
                        note_quality.append({"source": source, "title": pr["title"], "reason": UNRESOLVED_ENDPOINT,
                                             "excerpt": line})
                    if not note:
                        continue
                    all_notes.append({"source": source, "text": note, "merged_at": merged_at,
                                      "tickets": sorted(changelog_release.jira_keys(pr["title"], "", body))})
                    issue = note_quality_issue(note)
                    if issue:
                        lines = [line.strip() for line in note.splitlines() if line.strip()]
                        if issue == "machine-generated content":
                            lines = [line for line in lines if unicodedata.category(line[0]) == "So"]
                        elif issue == "an API endpoint with no path":
                            lines = [line for line in lines if _PATHLESS_API_RE.match(line)]
                        note_quality.append({"source": source, "title": pr["title"], "reason": issue,
                                             "excerpt": " / ".join(lines)[:160]})
                print(f"   ✅ #{pr['number']}: {pr['title']}")
            else:
                no_notes_prs.append((repo, pr))
                print(f"   ⏭️  #{pr['number']}: {pr['title']} ({'opt-out label' if opted_out else 'NONE / no notes'})")
            reason = flag_reason(release_note_status(body), labels)
            if reason:
                origin = cherry_picked_from(pr["title"])
                flagged_prs.append({
                    "source": source, "title": pr["title"], "reason": reason, "owner": pr_owner(pr),
                    "origin": f"{repo}#{origin}" if origin else None,
                })
        print()
    if unaudited and len(unaudited) == len(REPOS):
        raise RuntimeError(f"None of {', '.join(REPOS)} could be read with the workflow token")

    # A cherry-pick needs no note of its own when the PR it was picked from has one.
    noted = {note["source"] for note in all_notes}
    flagged_prs = [pr for pr in flagged_prs if pr.pop("origin") not in noted]
    for pr in flagged_prs:
        print(f"::warning title=Release note needed::{pr['source']} {pr['title']}: {pr['reason']}")

    # Docs pages are read as they are on master at the start of the run: in update mode
    # the checkout is the changelog PR's branch, cut before later docs changes landed.
    docs_ref = os.environ.get("DOCS_REF", "").strip() or "HEAD"
    pr_details = {}
    # Docs that landed after the code, in a later milestone or none, are found by the PRs merged
    # since the previous release's branch was cut (when this release's work began) that link a PR of this one.
    previous = os.environ.get("RELEASE_BASE_REF", "").strip()
    since = release_branch_cut(previous) if previous and noted else None
    outside = outside_docs_prs(milestone_prs, noted, since) if since else {}
    if noted:
        print(f"📚 {len(outside)} docs PR(s) outside the milestone link one of its PRs"
              + (f" (merged since the previous release branch was cut, {since})" if since
                 else " (not checked: the previous release branch's cut is unknown)"))
    docs_links = find_docs_links(
        milestone_prs, noted, lambda path: changelog_release.git_show(docs_ref, path), pr_details, outside
    ) if noted else {}
    site_cache = {}

    def site():
        if "site" not in site_cache:
            site_cache["site"] = docs_site(docs_ref)
        return site_cache["site"]

    # The Docs: line outranks the page found by following the PR, if it reaches one.
    named_broken = []
    for source, url in sorted(named_docs.items()):
        if source not in noted:
            continue
        basis = "named on the Docs: line of the PR's release note"
        try:
            problem, title = site().check(url), site().title(url)
        except RuntimeError as err:
            problem, title = None, None
            basis += f" (not checked: {err})"
        if problem:
            named_broken.append({"source": source, "url": url, "problem": problem})
            print(f"::warning title=Docs line link is broken::{source} names {url}: {problem}")
        else:
            docs_links[source] = {"url": url, "title": title, "basis": basis}
    for note in all_notes:
        note["docs_url"] = docs_links.get(note["source"], {}).get("url")
        note["docs_title"] = docs_links.get(note["source"], {}).get("title")
    linked = {source: link for source, link in docs_links.items() if link.get("url")}
    print(f"📚 Docs pages found for {len(linked)} of {len(noted)} PR(s) with release notes")
    for source, link in linked.items():
        print(f"   {source}: {link['url']} ({link['basis']})")
    print()

    # What the release changes that developers rarely write notes for: pre-packaged
    # plugin versions, WebSocket events and schema migrations, read from the git diff
    # between the previous release's tag and this release's branch.
    base_ref = os.environ.get("RELEASE_BASE_REF", "").strip()
    head_ref = os.environ.get("RELEASE_HEAD_REF", "").strip()
    # The benchmarking line is not the model's: apply_benchmark writes it, in create and update
    # mode alike, from the performance comparison (or a pending marker until it is published).
    benchmark = changelog_release.benchmark(VERSION)
    derived = changelog_release.derived_notes(base_ref, head_ref)
    if derived:
        print(f"🔧 {len(derived)} change(s) read from the {base_ref}..{head_ref} diff and the performance comparison:")
        for note in derived:
            print(f"   {note['source']}")
        print()
    all_notes += derived

    version_short = changelog_release.short_version(VERSION)
    # Derived from VERSION by default so a new major version needs no edit here, and
    # cannot land in the previous major's file. CHANGELOG_PATH overrides it.
    changelog_path = os.environ.get("CHANGELOG_PATH") or changelog_path_for_version(VERSION)
    print(f"📄 Changelog file: {changelog_path}")

    # In update mode only the PRs the open changelog PR does not already include are
    # generated. Which PRs those are is read from the PR body, not from the entry text,
    # so a bullet a reviewer has rewritten is still recognised as present.
    #
    # A body is also passed when an open PR is being regenerated; its text is kept and
    # only its included-PR list is replaced.
    pr_body = default_pr_body()
    included = set()
    proposed_before = os.environ.get("SOURCES_SEED_BEFORE", "").strip() if mode == "update" else ""
    proposed_sources = []
    original_content = content = None
    withheld, reconciled, extra_items = set(), [], []
    body_file = os.environ.get("PR_BODY_FILE", "").strip()
    if body_file and os.path.exists(body_file):
        with open(body_file, "r", encoding="utf-8") as f:
            pr_body = f.read() or pr_body
    original_body = pr_body
    if mode == "update":
        if not body_file or not os.path.exists(body_file):
            raise RuntimeError("MODE=update needs PR_BODY_FILE pointing at the changelog PR's body")
        listed = parse_sources_comment(pr_body)
        if listed is None:
            if not proposed_before:
                raise RuntimeError(
                    "The changelog PR body has no changelog-sources comment, so there is no way "
                    "to tell which PRs it already includes. Re-run in regenerate mode, which "
                    "rebuilds the entry and records the list, or set SOURCES_SEED_BEFORE to the "
                    "time the PR branch was last updated to get a list to review."
                )
            # Only a proposal: recording it unreviewed would make every later run skip a
            # note that is not actually in the entry. Nothing is generated or written.
            proposed_sources = sorted(seed_sources(all_notes, proposed_before), key=_source_sort_key)
            all_notes = []
            listed = set()
            print(
                f"::warning title=Changelog sources need review::The changelog PR has no "
                f"changelog-sources list. Proposed {len(proposed_sources)} source(s) merged before "
                f"{proposed_before}; check them against the entry and add the list from the run "
                "summary to the PR body. Nothing was changed."
            )
        else:
            proposed_before = ""
            if os.path.exists(changelog_path):
                with open(changelog_path, "r", encoding="utf-8") as f:
                    original_content = content = f.read()
        included = listed
        if content is not None and base_ref and head_ref:
            content, included, withheld, reconciled = reconcile_derived(content, version_short, included, derived)
            for item in reconciled:
                if item["status"] == "replaced":
                    print(f"🔁 {item['source']}: {item['detail']}")
                    extra_items.append({"section": item["section"], "subsection": item["subsection"],
                                        "text": item["text"], "sources": [item["replaced_by"]]})
                else:
                    print(f"::warning title=Changelog bullet needs review::{item['source']}: {item['detail']}. {item['remedy']}")
        all_notes = [note for note in all_notes if note["source"] not in included | withheld]
        print(f"ℹ️  {len(included)} source(s) already in the changelog PR; {len(all_notes)} new note(s) to add")

    all_notes, restated = split_restated_notes(all_notes, derived)
    listed = {note["source"][len("migration:"):] for note in derived if note["source"].startswith("migration:")}
    for note in all_notes:
        added = [name for name in pr_details.get(note["source"], {}).get("migrations", []) if name in listed]
        if added:
            note["context"] = (f"This PR added the migration{'s' if len(added) > 1 else ''} "
                               f"{', '.join(f'``{name}``' for name in added)}, listed under Database Schema Changes.")
    for note in restated:
        print(f"ℹ️  {note['source']} only restates migration {note['migration']}, which is listed under Database Schema Changes; no bullet written")

    for number, note in enumerate(all_notes, start=1):
        note["id"] = f"N{number}"
    sources_by_id = {note["id"]: note["source"] for note in all_notes}

    release_type = os.environ.get("RELEASE_TYPE", "feature").strip().lower()
    release_date = os.environ.get("RELEASE_DATE", "").strip()
    if not release_date:
        # A scheduled run happens weeks before release day, so its date would be wrong.
        scheduled = os.environ.get("EVENT_NAME") == "schedule"
        release_date = RELEASE_DATE_PLACEHOLDER if scheduled else date.today().strftime("%Y-%m-%d")
    go_version = os.environ.get("GO_VERSION", "").strip()
    go_source = "the go_version input" if go_version else None
    if not go_version and head_ref:
        # The release branch's build image is what the release is built with; reusing the
        # previous entry's version is wrong in every release that bumps Go.
        go_version = changelog_release.go_version_from_buildenv(
            changelog_release.git_show(head_ref, changelog_release.BUILDENV_DOCKERFILE)
        ) or ""
        if go_version:
            go_source = f"{head_ref}:{changelog_release.BUILDENV_DOCKERFILE}"
            print(f"ℹ️  Go version read from {go_source}: {go_version}")

    # The entry's Go Version section is written once, on create; a later Go bump on the
    # release branch is applied to it here.
    entry_go = None
    if content is not None and go_source:
        formatted_go = normalize_go_version(go_version)
        content, had, go_line = replace_entry_go_version(content, version_short, formatted_go)
        entry_go = {"had": had}
        if had is None:
            print(f"::warning title=Go version needs review::The {version_short} entry has no Go version line to set to {formatted_go}")
        elif had != formatted_go:
            print(f"🔁 Go version: {had} → {formatted_go}")
            extra_items.append({"section": "Go Version", "subsection": None, "text": go_line, "sources": []})

    benchmark_action = ""
    if content is not None:
        content, benchmark_action = apply_benchmark(content, version_short, benchmark)
        if benchmark_action in ("added", "marked"):
            print(f"🔁 Benchmarking line for {version_short} set from the performance comparison"
                  if benchmark["notes"] else f"⏳ Benchmarking line for {version_short} marked pending")
            extra_items.append({"section": "Improvements", "subsection": "Performance",
                                "text": benchmark["notes"][0]["text"] if benchmark["notes"] else BENCHMARK_PENDING,
                                "sources": [n["source"] for n in benchmark["notes"]]})

    previous_release = previous_feature_release(VERSION, base_ref)
    if content is not None:
        content, important_action = apply_upgrade_important(content, version_short, previous_release)
        if important_action == "added":
            print(f"➕ Added the Upgrade Impact <Important> block (upgrades from before {previous_release})")
            extra_items.append({"section": "Upgrade Impact", "subsection": None,
                                "text": UPGRADE_IMPORTANT.format(previous=previous_release), "sources": []})

    previous_go = None
    if mode == "create":
        previous_go = extract_previous_go_version(changelog_path) or extract_previous_go_version(
            previous_major_changelog_path(changelog_path) or ""
        )
    readiness = {
        "preflight": preflight_checks(changelog_path, mode, milestones, go_source, release_date),
        "repos_unaudited": unaudited,
        "repos_private": private_repos,
        "notes": {
            "prs_merged": total_prs,
            "with_notes": total_prs - len(no_notes_prs),
            "intentional": len(no_notes_prs) - len(flagged_prs),
            "missing": len(flagged_prs),
        },
        "missing_by_owner": missing_by_owner(flagged_prs),
        "note_quality": note_quality,
        "doc_links": [{"source": source, **link} for source, link in docs_links.items() if link.get("url")],
        "doc_links_unclear": [{"source": source, **link} for source, link in docs_links.items() if link.get("candidates")],
        "doc_links_named_broken": named_broken,
        "gaps": gap_status(derived, bool(base_ref and head_ref), go_version, go_source, previous_go, entry_go,
                           benchmark["gap"]),
        "reconciled": reconciled,
        # Filled while the text is tidied, later in this run: the same list object.
        "config_plans": CONFIG_PLANS,
    }
    for gap in readiness["gaps"]:
        if gap["section"] == "Benchmarking" and gap["status"] != "ready":
            gap["detail"] += f"; the entry says “{BENCHMARK_PENDING}” until the line is written"
    blocking = [check for check in readiness["preflight"] if check["status"] == "fail" and check["blocking"]]
    if blocking:
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            with open(os.path.join(output_dir, "summary.md"), "w", encoding="utf-8") as f:
                f.write("\n".join([f"## {VERSION} changelog ({mode})", ""] + render_status(readiness)) + "\n")
        raise RuntimeError("Preflight failed: " + "; ".join(f"{c['check']}: {c['detail']}" for c in blocking))

    # A second create would insert a duplicate entry above the published one. A dry run
    # is still allowed, so a shipped release can be regenerated to compare against.
    if mode == "create" and os.environ.get("DRY_RUN", "").strip().lower() != "true":
        if os.path.exists(changelog_path):
            with open(changelog_path, "r", encoding="utf-8") as f:
                if changelog_release.has_entry(f.read(), VERSION):
                    raise RuntimeError(
                        f"{changelog_path} already has a {version_short} entry. Run in update mode "
                        "against the open changelog PR, or as a dry run to preview."
                    )

    items = []
    referenced = set()
    ai_polished = False
    changed = bool(all_notes)

    if mode == "update":
        entry = ""
        updated = content
        if all_notes:
            fragment, items, referenced, ai_polished = render_fragment(all_notes, sources_by_id)
            # The entry already has its Go Version section; a new ### Improvements
            # section, if the fragment creates one, still needs its blog post link.
            fragment = remove_section(fragment, "Go Version")
            fragment = fragment.replace("BLOG_POST_LINK", blog_post_link())
            if ai_polished:
                check_for_truncation(fragment)
            require_recorded_sources_placed(_sources_of(sources_by_id, referenced), items)
            updated = merge_into_entry(updated, version_short, fragment)
            require_fragment_merged(fragment, updated)
            entry = fragment
            print(f"✅ Added {len(items)} bullet(s) from {len(sources_by_id)} note(s) to the {version_short} entry")
        elif updated == original_content:
            print("✅ No new release notes since the last run — changelog left unchanged")
        if updated is not None:
            updated = normalize_entry_spacing(updated, version_short)
        changed = updated is not None and updated != original_content
        if changed:
            with open(changelog_path, "w", encoding="utf-8") as f:
                f.write(updated)
        items += extra_items
    else:
        # Anchor slugs replace dots with dashes: "v11.9" → "v11-9"
        version_slug_anchor = version_short.replace(".", "-")

        # The heading label and the anchor slug must agree: other docs pages deep-link to
        # the anchor, so a label/slug mismatch silently breaks those links. Derive the slug
        # from the label rather than writing it out twice.
        release_label = RELEASE_LABELS.get(release_type, RELEASE_LABELS["feature"])
        anchor_slug = f"release-{version_slug_anchor}-{release_label.lower().replace(' ', '-')}"

        # A vX.0 release is a major release. Getting this wrong produces both the wrong
        # heading and the wrong anchor, so say so loudly rather than letting it through
        # to be corrected by hand afterwards.
        if re.match(r"^v\d+\.0$", version_short) and release_type != "major":
            print(
                f"⚠️  {version_short} looks like a major release, but RELEASE_TYPE is "
                f"'{release_type}' — the heading will read '{release_label}' and the anchor "
                f"will be '#{anchor_slug}'. Re-run with RELEASE_TYPE=major if that is wrong."
            )

        # MDX heading anchor. The opening brace is escaped (\{) because MDX would otherwise
        # parse it as a JSX expression.
        heading = (
            f"## Release {version_short} - "
            f"[{release_label}]"
            f"(https://docs.mattermost.com/product-overview/release-policy.html#release-types)"
            f" \\{{#{anchor_slug}}}"
        )

        entry = f"{heading}\n\n**Release day: {release_date}**\n\n"

        # Build the Go Version section content.
        # Mattermost uses a single bullet point in this section.
        # When GO_VERSION is not provided (unchanged from previous release), we look up
        # the previous version from the changelog so the line still shows a concrete number.
        # Note: this section uses a single leading space before the bullet, matching the
        # established formatting of the ### Go Version section in the changelog file.
        if go_version:
            formatted_go = normalize_go_version(go_version)
            go_section = f"### Go Version\n - {version_short} is built with Go ``{formatted_go}``."
        else:
            prev_go = extract_previous_go_version(changelog_path)
            if not prev_go:
                # First release in a new major-version file: carry the Go version forward
                # from the previous major's changelog rather than emitting vague prose.
                previous_file = previous_major_changelog_path(changelog_path)
                if previous_file:
                    prev_go = extract_previous_go_version(previous_file)
                    if prev_go:
                        print(f"ℹ️  Go version carried forward from {previous_file}: {prev_go}")
            if prev_go:
                go_section = f"### Go Version\n - {version_short} is built with Go ``{prev_go}``."
            else:
                go_section = f"### Go Version\n - {version_short} uses the same Go version as the previous release."

        if all_notes:
            polished, items, referenced, ai_polished = render_fragment(all_notes, sources_by_id)
            polished = polished.replace("BLOG_POST_LINK", blog_post_link())
            # Inject the Go Version section: replace the placeholder heading the AI outputs,
            # or insert it before ### Open Source Components / ### Security to preserve
            # section order, or append at the end if neither anchor exists.
            if re.search(r"(?m)^### Go Version\b", polished):
                polished = re.sub(
                    r"(?ms)^### Go Version\b.*?(?=^### \S|\Z)",
                    go_section + "\n\n",
                    polished,
                    count=1,
                )
            else:
                anchor = re.search(
                    r"(?m)^### (?:Open Source Components|Security|Contributors)\b", polished
                )
                if anchor:
                    idx = anchor.start()
                    polished = polished[:idx].rstrip() + "\n\n" + go_section + "\n\n" + polished[idx:]
                else:
                    polished = polished.rstrip() + "\n\n" + go_section + "\n"
            entry += polished + "\n"
        else:
            entry += go_section + "\n"
            entry += "\n_No other release notes for this version._\n"
        items.append({"section": "Go Version", "subsection": None,
                      "text": _bullet_text(go_section.split("\n", 1)[1]), "sources": []})

        # Last gate before the entry is written: fail the run rather than commit a
        # half-written sentence to customer-facing docs.
        #
        # Only meaningful on AI-polished prose. The no-API-key fallback passes PR authors'
        # raw notes straight through, and those routinely end without a full stop, so
        # running the check there would block the run over notes that are not truncated
        # at all.
        if ai_polished:
            check_for_truncation(entry)
        require_recorded_sources_placed(_sources_of(sources_by_id, referenced), items)

        entry, benchmark_action = apply_benchmark(
            entry, version_short, benchmark, f"See {blog_post_link()} on the highlights in our latest release.")
        entry, _ = apply_upgrade_important(entry, version_short, previous_feature_release(VERSION, base_ref))
        items.append({"section": "Improvements", "subsection": "Performance",
                      "text": benchmark["notes"][0]["text"] if benchmark["notes"] else BENCHMARK_PENDING,
                      "sources": [n["source"] for n in benchmark["notes"]]})

        header = CHANGELOG_HEADER_TEMPLATE.format(major=major_version(VERSION))
        insert_changelog_entry(entry, changelog_path, header=header)
        with open(changelog_path, "r", encoding="utf-8") as f:
            spaced = normalize_entry_spacing(f.read(), version_short)
        with open(changelog_path, "w", encoding="utf-8") as f:
            f.write(spaced)
        changed = True

        prs_with_notes = total_prs - len(no_notes_prs)
        print(f"✅ Changelog updated with notes from {prs_with_notes} PR(s) across {len(REPOS)} repo(s)")

    # A note the model dropped, even after the retry, does not fail the run. Only PRs
    # that a bullet actually referenced are recorded, so a PR whose notes were all dropped
    # is sent again on the next run instead of being skipped forever.
    unattributed = unattributed_sources(sources_by_id, referenced)
    recorded_now = _sources_of(sources_by_id, referenced)
    included |= recorded_now
    # Recorded as included although no bullet was written for them: the migration's own
    # bullet covers the change, and leaving them out would add them back on every run.
    if not proposed_before:
        included |= {note["source"] for note in restated}
    not_placed = [
        {"source": note["source"], "id": note["id"], "excerpt": " ".join(note["text"].split())[:160],
         "recorded": note["source"] in recorded_now}
        for note in dropped_notes(all_notes, referenced)
    ] if ai_polished else []
    # Still missing until a reviewer ticks it, though no run sends it again.
    not_placed += [
        {"source": source, "id": None, "excerpt": excerpt, "recorded": True}
        for source, excerpt in carried_not_placed(pr_body, included, set(sources_by_id.values()))
    ]
    for note in not_placed:
        print(f"::warning title=Release note not placed::{note['source']}: the model left this note out of the changelog")
    readiness["not_placed"] = not_placed
    readiness["restated"] = [{"source": n["source"], "migration": n["migration"]} for n in restated]
    # proposed_before is only left set when the run proposed a list instead of updating.
    if not proposed_before:
        pr_body = render_pr_body(pr_body, included)
        # A dry run pushes nothing; its report carries the list instead of the PR body.
        if os.environ.get("DRY_RUN", "").strip().lower() != "true":
            pr_body = render_not_placed(pr_body, dropped_notes(all_notes, referenced) if ai_polished else [], included,
                                        set(sources_by_id.values()))

    # The <Important> upgrade block is fixed text whose pages a test checks; only what this run
    # generated is checked here (changelog-link-check.yml still checks every line of the PR).
    checked_lines = [(number, line) for number, line in enumerate(entry.split("\n"), start=1)
                     if not line.startswith(UPGRADE_IMPORTANT_OPEN)]
    urls = changelog_release.docs_urls("\n".join(line for _, line in checked_lines))
    readiness["links_checked"] = len(urls)
    readiness["broken_links"] = []
    if urls:
        try:
            readiness["broken_links"] = changelog_release.broken_links(
                [("entry.mdx", number, line) for number, line in checked_lines], site())
        except RuntimeError as err:
            readiness["broken_links"] = None
            print(f"::warning title=Docs links not checked::{err}")
    for problem in readiness["broken_links"] or []:
        print(f"::warning title=Broken docs link::{problem['url']}: {problem['problem']}")

    for link in readiness["doc_links"] if ai_polished else []:
        link["used_in"] = [
            item["subsection"] or item["section"] for item in items
            if link["source"] in item["sources"] and link["url"] in item["text"]
        ]
        # The model may put the link on a related feature's bullet instead.
        link["linked_elsewhere"] = sorted({
            source for item in items
            if link["source"] not in item["sources"] and link["url"] in item["text"]
            for source in item["sources"]
        }, key=_source_sort_key)

    added_sources = set(sources_by_id.values())
    derived_sources = {note["source"] for note in derived}
    payload = {
        # 2: sources may be derived keys (plugin:…, websocket:…, migration:…) as well as
        # owner/repo#number; adds prs_flagged, derived_sources, proposed_sources, readiness
        # and metrics.
        "schema_version": 2,
        "version": VERSION,
        "milestone": MILESTONE_TITLE,
        "release_type": release_type,
        "mode": mode,
        "changelog_path": changelog_path,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ai_polished": ai_polished,
        "changed": changed,
        "sections": group_items_by_section(items),
        "sources_included": sorted(included, key=_source_sort_key),
        "sources_added": sorted(added_sources, key=_source_sort_key),
        "sources_unattributed": unattributed,
        "derived_sources": sorted(derived_sources),
        "proposed_before": proposed_before,
        "proposed_sources": proposed_sources,
        "prs_without_notes": [
            {"source": f"{repo}#{pr['number']}", "title": pr["title"]} for repo, pr in no_notes_prs
        ],
        "prs_flagged": flagged_prs,
        "readiness": readiness,
        "metrics": {
            "prs_merged": total_prs,
            "prs_with_notes": total_prs - len(no_notes_prs),
            "prs_without_notes": len(no_notes_prs),
            "prs_flagged": len(flagged_prs),
            "derived_changes": len(added_sources & derived_sources),
            "sources_added": len(added_sources),
            "bullets_written": len(items) - len(extra_items),
            "bullets_corrected": len(extra_items),
            "bullets_needing_review": sum(item["status"] == "needs_review" for item in reconciled),
            "sources_unattributed": len(unattributed),
            "notes_not_placed": len(not_placed),
            "ai_polished": ai_polished,
            "duration_seconds": round(time.monotonic() - started, 1),
        },
    }
    if not proposed_before:  # a proposal changes nothing, the body included
        pr_body = with_release_note_section(pr_body)
    write_outputs(output_dir, entry, payload, pr_body, render_model_output(sources_by_id))
    set_github_output("changed", "true" if changed else "false")
    # The PR body can change when the text does not, such as when every new note was
    # left out of the text and only the not-placed list is new.
    set_github_output("body_changed", "true" if mode == "update" and not proposed_before and pr_body != original_body else "false")
    set_github_output("added_prs", len(added_sources - derived_sources))
    set_github_output("added_derived", len(added_sources & derived_sources))
    set_github_output("flagged_prs", len(flagged_prs))
    set_github_output("corrected", len(extra_items))

    if no_notes_prs:
        print(f"\n⚠️  {len(no_notes_prs)} PR(s) had no release notes (marked NONE or section missing):")
        for repo, pr in no_notes_prs:
            print(f"   [{repo}] #{pr['number']}: {pr['title']}")


if __name__ == "__main__":
    main()
