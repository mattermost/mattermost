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
  RELEASE_DATE      - (optional) Release day date (e.g. "2026-05-15"). Defaults to today.
  GO_VERSION        - (optional) Go version used in this release (e.g. "go1.22.5").
                      If not provided, changelog notes it is unchanged from previous release.
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
                      have). Nothing is written there if unset.

The target changelog is an MDX file: it opens with YAML frontmatter, imports MDX
components, and uses JSX elements such as <Note> and <Important>. Generated content
must therefore be MDX-safe (see the "MDX safety" rule in SYSTEM_PROMPT).
"""

import json
import os
import re
import requests
from datetime import date, datetime, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
REPOS = [r.strip() for r in os.environ["REPOS"].split(",") if r.strip()]
MILESTONE_TITLE = os.environ["MILESTONE"]
VERSION = os.environ["VERSION"]

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

          Adapt the plan name (e.g. "Changes to All plans:", "Changes to Enterprise plans:", "Changes to Enterprise Advanced plan:") and nest each setting change beneath the appropriate plan bullet. Plan bullets use one space; the settings beneath them use three. Removed settings are listed as top-level one-space bullets, not under a plan grouping.
        - `#### Compatibility` — minimum version requirement changes for browsers, OS, or clients. Example: "Updated minimum Edge and Chrome versions to 146+."
    - `### Improvements` — for new features and enhancements only. Do NOT place items beginning with "Fixed..." here — those belong in Bug Fixes. The line immediately after the `### Improvements` heading — with NO blank line between them — must be `See BLOG_POST_LINK on the highlights in our latest release.` (use the exact placeholder `BLOG_POST_LINK`; it is replaced automatically with a Markdown link). Then a blank line, then the first `####` subsection heading. It must look exactly like this:

      ### Improvements
      See BLOG_POST_LINK on the highlights in our latest release.

      #### User Interface
       - First item.

      Subsections, as applicable:
        - `#### User Interface` — user interface and UX changes and new visual features. Pre-packaged plugin version updates go at the TOP of this subsection, before other items. Always write "user interface" in full — never abbreviate as "UI".
        - `#### Plugins/Integrations` — plugin and integration improvements (use as a separate subsection when there are enough items to warrant it)
        - `#### Administration` — System Console features, logging, support packet changes
        - `#### mmctl` — mmctl command additions or changes (use as a separate subsection when there are enough items to warrant it)
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

12.  **Source markers:** Each raw release note begins with an ID in square brackets, such as `[N12]`. End every bullet you write with the ID of the note it came from in double square brackets, separated from the text by one space: ` - Fixed an issue where the channel header was hidden. [[N12]]`. If a bullet combines several notes, list every ID: `[[N3,N7]]`. Do not put a marker on headings, on the `See BLOG_POST_LINK` line, on the config.json description paragraph, on plan-label bullets such as ` - **Changes to All plans:**`, or on the Database Schema Changes summary bullet; put it on the bullets nested beneath them instead. Never write a marker anywhere else. Markers are removed automatically before publishing."""


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
                if pr_resp.json().get("merged"):
                    prs.append(item)
        page += 1
    return prs


def extract_release_notes(body: str) -> list[str] | None:
    """
    Extract release note text from a PR body.

    Looks for a '#### Release Note' section, then pulls the content of any
    fenced code blocks within it (plain ``` or ```release-note).
    Returns None if the section is missing or all entries are NONE.
    """
    if not body:
        return None

    # Normalize line endings (GitHub API may return \r\n on some PR bodies)
    body = body.replace("\r\n", "\n").replace("\r", "\n")

    notes = []

    # Primary path: look for a '#### Release Note(s)' section heading
    section_match = re.search(
        r"####\s+Release\s+Notes?\s*\n(.*?)(?=\n####|\Z)",
        body,
        re.DOTALL | re.IGNORECASE,
    )
    if section_match:
        section = section_match.group(1)
        # Strip HTML comments (the instructional block in the template)
        section = re.sub(r"<!--.*?-->", "", section, flags=re.DOTALL)
        # Extract fenced code blocks (supports both ``` and ```release-note)
        code_blocks = re.findall(r"```(?:release-note)?\s*\n(.*?)\n?```", section, re.DOTALL)
        for block in code_blocks:
            content = block.strip()
            if content and content.upper() != "NONE":
                notes.append(content)
        # Fallback to plain text only when there are no code blocks at all in the section
        if not notes and "```" not in section:
            plain = section.strip()
            if plain and plain.upper() != "NONE":
                notes.append(plain)

    # Secondary path: scan the entire body for ```release-note blocks.
    # Catches PRs that use the block format without a #### Release Note heading.
    if not notes:
        body_no_comments = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
        raw_blocks = re.findall(r"```release-note\s*\n(.*?)\n?```", body_no_comments, re.DOTALL)
        for block in raw_blocks:
            content = block.strip()
            if content and content.upper() != "NONE":
                notes.append(content)

    return notes if notes else None


# Output cap for the polish request. A full feature release is comfortably larger than
# the previous 4096: the v12.0 entry is ~32k characters, roughly 8k tokens.
MAX_OUTPUT_TOKENS = 16384


def _raw_bullets(notes: list[dict]) -> str:
    """The unpolished fallback: each note verbatim as a bullet, tagged with its ID."""
    return "\n".join(f"- {note['text']} [[{note['id']}]]" for note in notes)


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
    client = anthropic.Anthropic(api_key=api_key)

    raw_text = "\n\n---\n\n".join(f"[{note['id']}] {note['text']}" for note in notes)
    user_message = f"Here are the raw release notes to process:\n\n{raw_text}"

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

    return response.content[0].text.strip(), True


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
    bullet_re = re.compile(r"^( *)- ")

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
                    block[offset] = " " * (1 + 2 * level) + line[match.end(1):]
            lines[block_start:index] = block
        block_start = index + 1
    text = "\n".join(lines)

    # 3. Close the gap between ### Improvements and its blog post line.
    text = re.sub(r"(?m)^(### Improvements)[ \t]*\n\s*\n(?=See )", r"\1\n", text)

    # 4. Collapse runs of blank lines (removing a rule can leave a doubled gap).
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

    # The header block ends with the platform scope note, which closes a <Note> component.
    HEADER_END_MARKER = "may not represent all affected configurations.\n\n</Note>"

    if not existing.strip():
        # New or empty file (e.g. the first release of a new major version). Write the
        # standard header first — an MDX file without frontmatter fails the docs build.
        new_content = (header + "\n\n" + entry) if header else entry
    elif HEADER_END_MARKER in existing:
        idx = existing.index(HEADER_END_MARKER) + len(HEADER_END_MARKER)
        new_content = existing[:idx] + "\n\n\n" + entry + existing[idx:]
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
            + "\n\n\n"
            + entry.rstrip()
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
            current = {"section": section, "subsection": subsection, "text": "", "sources": []}
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
H4_ORDER = {
    "Upgrade Impact": ["Database Schema Changes", "config.json", "Compatibility"],
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


def _top_level_blocks(lines: list[str]) -> list[list[str]]:
    """Group bullet lines into blocks of one top-level bullet plus everything nested under it.

    Lines before the first bullet (a description paragraph, the blog post line) and
    blank lines are dropped: they either already exist in the entry or are not wanted.
    """
    blocks = []
    for line in lines:
        if re.match(r"^ ?- ", line):
            blocks.append([line])
        elif blocks and line.strip() and line.startswith(" "):
            blocks[-1].append(line)
    return blocks


def _is_top_level(line: str) -> bool:
    return bool(re.match(r"^ ?- ", line))


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
    instead of repeating the label.

    Database Schema Changes is written either as one summary bullet with the changes
    nested beneath it, or as a flat list of changes. A new summary bullet is never
    added to an entry that already has the section: its nested changes go under the
    existing summary, or are flattened into the existing list.

    Returns how many lines were inserted.
    """
    inserted = 0
    for block in _top_level_blocks(new_lines):
        head, children = block[0], block[1:]
        target = None
        for index in range(start, end + inserted):
            if _is_top_level(lines[index]) and lines[index].strip() == head.strip():
                target = index
                break
        if target is None and title == "Database Schema Changes" and children:
            heads = [i for i in range(start, end + inserted) if _is_top_level(lines[i])]
            nested = [i for i in heads if i + 1 < len(lines) and lines[i + 1].startswith("   ")]
            if len(heads) == 1 and nested:
                target = heads[0]
            elif heads and not nested:
                block = [line[2:] if line.startswith("   ") else line for line in children]
        if target is not None and children:
            block_end = target + 1
            while block_end < end + inserted and lines[block_end].strip() and not _is_top_level(lines[block_end]):
                block_end += 1
            lines[block_end:block_end] = children
            inserted += len(children)
        else:
            at = _last_content_line(lines, start, end + inserted) + 1
            lines[at:at] = block
            inserted += len(block)
    return inserted


def _insert_heading_block(lines, start, end, level, title, order, block_lines) -> None:
    """Insert a new heading and its lines inside ``lines[start:end]`` at its canonical position."""
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
        at = _last_content_line(lines, start, end) + 1
        lines[at:at] = [""] + body
    else:
        lines[at:at] = body + [""]


def merge_into_entry(content: str, version_short: str, fragment: str) -> str:
    """Add the bullets of ``fragment`` to the ``version_short`` entry in ``content``.

    Only insertions are made: every line already in the file, including reviewers'
    edits, is kept as it is. A section or subsection the entry lacks is created at its
    canonical position; one it already has receives the new bullets at its end.
    """
    lines = content.split("\n")
    heading_re = re.compile(r"^## Release " + re.escape(version_short) + r"\b(?!\.)")
    entry_start = next((i for i, line in enumerate(lines) if heading_re.match(line)), None)
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
                (i for i in range(h3_line, h3_end) if re.match(r"^#### +" + re.escape(sub["title"]) + r"\s*$", lines[i])),
                None,
            )
            if h4_line is None:
                order = H4_ORDER.get(section["title"], [])
                _insert_heading_block(lines, h3_line + 1, h3_end, 4, sub["title"], order, sub["lines"])
            else:
                h4_end = _region_end(lines, h4_line, r"^#{2,4} ")
                _merge_bullets(lines, h4_line, h4_end, sub["lines"], sub["title"])

    return "\n".join(lines)


def remove_section(fragment: str, title: str) -> str:
    """Drop a ``###`` section, heading and body, from generated text."""
    return re.sub(r"(?ms)^### " + re.escape(title) + r"\b.*?(?=^### \S|\Z)", "", fragment).strip() + "\n"


def write_outputs(output_dir: str, entry: str, payload: dict, pr_body: str) -> None:
    """Write entry.mdx, sections.json and pr_body.md for the workflow to publish."""
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


def set_github_output(name: str, value) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{name}={value}\n")


def default_pr_body() -> str:
    return (
        f"Auto-generated changelog for milestone `{MILESTONE_TITLE}` from `{', '.join(REPOS)}`.\n\n"
        "Re-running the **Generate Changelog** workflow in `auto` mode adds release notes "
        "from newly merged PRs to this PR and leaves every existing line, including edits "
        "made here, untouched. `regenerate` mode rebuilds the entry from scratch and "
        "discards those edits.\n"
    )


def render_fragment(notes: list[dict], sources_by_id: dict) -> tuple[str, list[dict], set, bool]:
    """Polish ``notes`` into MDX-safe changelog text and attribute each bullet to its PRs.

    Returns the text (``BLOG_POST_LINK`` still a placeholder, Go Version heading still
    empty), the bullet items, the note IDs the bullets referenced, and whether the text
    was AI-polished.
    """
    raw_polished, ai_polished = polish_with_ai(notes)
    # normalize_formatting fixes layout; escape_mdx_unsafe makes the prose MDX-safe.
    # Both are applied to the generated fragment only, never to file contents. The
    # [[N1]] markers pass through both untouched and are stripped afterwards.
    polished = escape_mdx_unsafe(normalize_formatting(raw_polished))
    polished, items, referenced = extract_source_markers(polished, sources_by_id)
    return polished, items, referenced, ai_polished


def blog_post_link() -> str:
    blog_url = os.environ.get("BLOG_POST_URL", "").strip()
    if not blog_url:
        # Auto-construct short URL (no patch suffix): v11.6.0 → mattermost-v11-6-is-now-available
        version_slug = re.sub(r"-\d+$", "", VERSION.lstrip("v").replace(".", "-"))
        blog_url = f"https://mattermost.com/blog/mattermost-v{version_slug}-is-now-available/"
        print(f"ℹ️  No blog post URL provided — using auto-constructed URL: {blog_url}")
    # Format as a Markdown link matching existing changelog style: [this blog post](url)
    return f"[this blog post]({blog_url})"


def main():
    mode = os.environ.get("MODE", "create").strip().lower() or "create"
    if mode not in ("create", "update"):
        raise RuntimeError(f"MODE must be 'create' or 'update', not {mode!r}")
    output_dir = os.environ.get("OUTPUT_DIR", "").strip()

    print(f"🔍 Milestone: {MILESTONE_TITLE} | Repos: {', '.join(REPOS)} | Mode: {mode}\n")

    # Each note keeps the PR it came from, so every bullet written can be traced back.
    all_notes = []
    total_prs = 0
    no_notes_prs = []

    for repo in REPOS:
        print(f"── {repo}")
        milestone_number = get_milestone_number(repo, MILESTONE_TITLE)
        if milestone_number is None:
            continue

        prs = get_merged_prs(repo, milestone_number)
        print(f"   📋 Found {len(prs)} merged PR(s)")
        total_prs += len(prs)

        for pr in sorted(prs, key=lambda p: p["number"]):
            notes = extract_release_notes(pr.get("body") or "")
            if notes:
                for note in notes:
                    all_notes.append({"source": f"{repo}#{pr['number']}", "text": note})
                print(f"   ✅ #{pr['number']}: {pr['title']}")
            else:
                no_notes_prs.append((repo, pr))
                print(f"   ⏭️  #{pr['number']}: {pr['title']} (NONE / no notes)")
        print()

    # In update mode only the PRs the open changelog PR does not already include are
    # generated. Which PRs those are is read from the PR body, not from the entry text,
    # so a bullet a reviewer has rewritten is still recognised as present.
    #
    # A body is also passed when an open PR is being regenerated; its text is kept and
    # only its included-PR list is replaced.
    pr_body = default_pr_body()
    included = set()
    body_file = os.environ.get("PR_BODY_FILE", "").strip()
    if body_file and os.path.exists(body_file):
        with open(body_file, "r", encoding="utf-8") as f:
            pr_body = f.read() or pr_body
    if mode == "update":
        if not body_file or not os.path.exists(body_file):
            raise RuntimeError("MODE=update needs PR_BODY_FILE pointing at the changelog PR's body")
        listed = parse_sources_comment(pr_body)
        if listed is None:
            raise RuntimeError(
                "The changelog PR body has no changelog-sources comment, so there is no way "
                "to tell which PRs it already includes. Re-run in regenerate mode, which "
                "rebuilds the entry and records the list."
            )
        included = listed
        all_notes = [note for note in all_notes if note["source"] not in included]
        print(f"ℹ️  {len(included)} PR(s) already in the changelog PR; {len(all_notes)} new note(s) to add")

    for number, note in enumerate(all_notes, start=1):
        note["id"] = f"N{number}"
    sources_by_id = {note["id"]: note["source"] for note in all_notes}

    # Derive short version for heading/anchor: "v11.7.0" → "v11.7", "11.7.0" → "v11.7"
    version_short = "v" + re.sub(r"\.0$", "", VERSION.lstrip("v"))

    release_type = os.environ.get("RELEASE_TYPE", "feature").strip().lower()
    release_date = os.environ.get("RELEASE_DATE", "").strip() or date.today().strftime("%Y-%m-%d")
    go_version = os.environ.get("GO_VERSION", "").strip()
    # Derived from VERSION by default so a new major version needs no edit here, and
    # cannot land in the previous major's file. CHANGELOG_PATH overrides it.
    changelog_path = os.environ.get("CHANGELOG_PATH") or changelog_path_for_version(VERSION)
    print(f"📄 Changelog file: {changelog_path}")

    items = []
    referenced = set()
    ai_polished = False
    changed = bool(all_notes)

    if mode == "update":
        entry = ""
        if all_notes:
            fragment, items, referenced, ai_polished = render_fragment(all_notes, sources_by_id)
            # The entry already has its Go Version section; a new ### Improvements
            # section, if the fragment creates one, still needs its blog post link.
            fragment = remove_section(fragment, "Go Version")
            fragment = fragment.replace("BLOG_POST_LINK", blog_post_link())
            if ai_polished:
                check_for_truncation(fragment)
            with open(changelog_path, "r", encoding="utf-8") as f:
                content = f.read()
            with open(changelog_path, "w", encoding="utf-8") as f:
                f.write(merge_into_entry(content, version_short, fragment))
            entry = fragment
            print(f"✅ Added {len(items)} bullet(s) from {len(sources_by_id)} note(s) to the {version_short} entry")
        else:
            print("✅ No new release notes since the last run — changelog left unchanged")
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

        # Last gate before the entry is written: fail the run rather than commit a
        # half-written sentence to customer-facing docs.
        #
        # Only meaningful on AI-polished prose. The no-API-key fallback passes PR authors'
        # raw notes straight through, and those routinely end without a full stop, so
        # running the check there would block the run over notes that are not truncated
        # at all.
        if ai_polished:
            check_for_truncation(entry)

        header = CHANGELOG_HEADER_TEMPLATE.format(major=major_version(VERSION))
        insert_changelog_entry(entry, changelog_path, header=header)
        changed = True

        prs_with_notes = total_prs - len(no_notes_prs)
        print(f"✅ Changelog updated with notes from {prs_with_notes} PR(s) across {len(REPOS)} repo(s)")

    # A note whose bullet carries no marker cannot be attributed, but its content is
    # almost certainly in the text (or was merged into another bullet). It is still
    # recorded as included: treating it as missing would make every later run add it
    # again, and a duplicated bullet is worse than one unattributed bullet.
    unattributed = sorted({sources_by_id[i] for i in sources_by_id if i not in referenced}, key=_source_sort_key)
    if all_notes and not referenced:
        print("⚠️  No bullet carries a source marker — the model ignored rule 12. Attribution is unavailable for this run.")
    elif unattributed:
        print(f"⚠️  {len(unattributed)} PR(s) could not be matched to a bullet: {', '.join(unattributed)}")

    included |= set(sources_by_id.values())
    pr_body = render_pr_body(pr_body, included)

    payload = {
        "schema_version": 1,
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
        "sources_added": sorted(set(sources_by_id.values()), key=_source_sort_key),
        "sources_unattributed": unattributed,
        "prs_without_notes": [
            {"source": f"{repo}#{pr['number']}", "title": pr["title"]} for repo, pr in no_notes_prs
        ],
    }
    write_outputs(output_dir, entry, payload, pr_body)
    set_github_output("changed", "true" if changed else "false")
    set_github_output("added_prs", len(set(sources_by_id.values())))

    if no_notes_prs:
        print(f"\n⚠️  {len(no_notes_prs)} PR(s) had no release notes (marked NONE or section missing):")
        for repo, pr in no_notes_prs:
            print(f"   [{repo}] #{pr['number']}: {pr['title']}")


if __name__ == "__main__":
    main()
