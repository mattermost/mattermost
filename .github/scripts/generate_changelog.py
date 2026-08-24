#!/usr/bin/env python3
"""
Generate a changelog from merged PR release notes for a given milestone.

Expects these environment variables:
  GITHUB_TOKEN      - GitHub personal access token or Actions token
  REPOS             - Comma-separated list of repositories in "owner/repo" format
                      (e.g. "mattermost/mattermost,mattermost/enterprise")
  MILESTONE         - Milestone title (e.g. "v11.7.0")
  VERSION           - Version label for the changelog entry (e.g. "v11.7.0")
  RELEASE_TYPE      - (optional) "feature" (default) or "esr" (Extended Support Release).
  RELEASE_DATE      - (optional) Release day date (e.g. "2026-05-15"). Defaults to today.
  GO_VERSION        - (optional) Go version used in this release (e.g. "go1.22.5").
                      If not provided, changelog notes it is unchanged from previous release.
  BLOG_POST_URL     - (optional) Blog post URL for the Improvements section.
                      Auto-constructed from VERSION if not provided.
  ANTHROPIC_API_KEY - (optional) If set, release notes are polished by Claude
                      before being written to the changelog.
  CHANGELOG_PATH    - (optional) Path to the changelog file to update. Defaults to
                      "CHANGELOG.md". In mattermost/mattermost this should be
                      "docs/main/product-overview/mattermost-v11-changelog.mdx".

The target changelog is an MDX file: it opens with YAML frontmatter, imports MDX
components, and uses JSX elements such as <Note> and <Important>. Generated content
must therefore be MDX-safe (see the "MDX safety" rule in SYSTEM_PROMPT).
"""

import os
import re
import requests
from datetime import date
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

1.  **Section structure:** Use `###` for top-level sections and `####` for subsections. Only include sections that have relevant content — do not output empty sections. Do NOT add horizontal rules or line separators between sections. Do NOT add a blank line between a section/subsection heading and its first bullet point.

    Top-level sections and their subsections, in this order:

    - `### Upgrade Impact` — for changes that affect upgrading, with subsections as applicable:
        - `#### Database Schema Changes` — schema migrations such as new tables, new columns, changed columns, or new indexes. Example items: "Added a new ``Watermarks`` table.", "Added a new column ``DeleteAt`` to the ``ChannelMembers`` table."
        - `#### config.json` — new or changed configuration settings. Use this exact block format for each plan grouping (no blank line between the `#### config.json` heading and the description paragraph, and no blank line between the description paragraph and the first bullet):
          New setting options were added to ``config.json``. Below is a list of the additions and their default values on install. The settings can be modified in ``config.json``, or the System Console when available.
          - **Changes to Enterprise Advanced plan:**
            - Under ``ExperimentalSettings`` in ``config.json``, added ``EnableWatermark`` configuration setting to add watermarking toggle in the server.

          Adapt the plan name (e.g. "Changes to All plans:", "Changes to Enterprise plan:", "Changes to Enterprise Advanced plan:") and list each setting change as a bullet under the appropriate plan heading.
        - `#### Compatibility` — minimum version requirement changes for browsers, OS, or clients. Example: "Updated minimum Edge and Chrome versions to 146+."
    - `### Improvements` — for new features and enhancements only. Do NOT place items beginning with "Fixed..." here — those belong in Bug Fixes. Begin this section with the line `See BLOG_POST_LINK on the highlights in our latest release.` (use the exact placeholder `BLOG_POST_LINK` — it will be replaced automatically with a Markdown link), followed by a blank line before the first `####` subsection heading. Then add subsections as applicable:
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
    - `### Contributors` — contributor acknowledgements. Only include if the raw notes contain contributor information; otherwise omit this section entirely (it is usually added manually after generation).

2.  **Sentence patterns:** Follow these conventions consistently:
    - New features and additions: "Added [feature]..." or "Added support for [feature]..."
    - Bug fixes: "Fixed an issue where..." or "Fixed an issue with..." — never use "Fixed a bug"; always use "Fixed an issue".
    - Improvements to existing things: "Improved [thing]..." or "Updated [thing]..."
    - Removals: "Removed [thing]..."

3.  **Terminology:** Always write "user interface" in full — never use the abbreviation "UI". Always spell out messaging abbreviations: "DM" → "Direct Message", "GM" → "Group Message", "DM/GM" → "Direct/Group Message".

4.  **Code formatting:** Use double backticks for all of the following:
    - Configuration settings (e.g., ``ServiceSettings.EnableDynamicClientRegistration``)
    - API endpoints (e.g., ``/api/v4/posts``)
    - Command names (e.g., ``mmctl license get``)
    - Environment variables (e.g., ``MM_LOG_PATH``)
    - Database table and column names (e.g., ``channelmembers.autotranslation``)
    - File names (e.g., ``config.json``)
    - Feature flags (e.g., ``MM_FEATUREFLAGS_CJKSEARCH``)
    - Package names in Open Source Components (e.g., ``x/text``)

5.  **Markdown formatting:** Indent each bullet point with two spaces (e.g., `  - item`). Ensure correct and clean Markdown syntax throughout. Do not insert horizontal rules (`---`) or any other separators between sections. Do not add a blank line between a section/subsection heading and its first bullet point.

6.  **MDX safety:** The changelog is an `.mdx` file, so raw `{`, `}`, and `<` characters are parsed as JSX and will break the docs build. Therefore:
    - Never output a bare `{` or `}` in prose. If a release note needs braces, wrap the text in double backticks (e.g. ``{"key": "value"}``) so it becomes inline code.
    - Never output a bare `<` followed by a letter (e.g. `<Note>`, `<div>`, `<T>`). Wrap such text in double backticks, or rewrite it (e.g. "less than 5" instead of "``<5``").
    - Do not emit JSX/HTML components yourself. Components like `<Note>` and `<Important>` already exist in the file and are added manually — never generate, duplicate, or close them.
    - Use standard Markdown links (`[text](url)`) and plain Markdown bullets only.

7.  **License requirements:** When a feature requires a specific Mattermost license, note it inline at the end of the bullet point (e.g., "Requires Enterprise Advanced license" or "Requires Enterprise license").

8.  **One section per release note:** Each raw release note must appear in exactly one section — whichever section best fits its primary purpose. Do not split a single release note across multiple sections or subsections, even if it touches more than one area (e.g. an admin feature that also introduces an API endpoint belongs entirely in Administration, not partially in Administration and partially in API Changes).

9.  **Proofreading:** Correct any typos, grammatical errors, awkward phrasing, or inconsistencies. Replace any instance of "Fixed a bug" with "Fixed an issue". Aim for clear, concise, and professional language.

10.  **Tone:** Maintain a neutral, informative, and professional tone consistent with technical documentation.

11.  **Focus:** Output only the section content (headings and bullet points). Do not include the release version header line or any introductory or concluding remarks from yourself."""


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


def polish_with_ai(raw_notes: list[str]) -> str:
    """
    Send raw release notes to Claude for categorization, formatting, and proofreading.
    Falls back to a simple bullet list if ANTHROPIC_API_KEY is not set.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ℹ️  ANTHROPIC_API_KEY not set — skipping AI polish, using raw notes")
        return "\n".join(f"- {note}" for note in raw_notes)

    try:
        import anthropic
    except ImportError:
        print("⚠️  anthropic package not installed — skipping AI polish")
        return "\n".join(f"- {note}" for note in raw_notes)

    print("✨ Sending notes to Claude for categorization and proofreading...")
    client = anthropic.Anthropic(api_key=api_key)

    raw_text = "\n\n---\n\n".join(raw_notes)
    user_message = f"Here are the raw release notes to process:\n\n{raw_text}"

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    return response.content[0].text.strip()


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
    match = re.search(r"is built with Go\s+`*(v?[\d.]+)`*", content)
    if match:
        return normalize_go_version(match.group(1))
    return None


def insert_changelog_entry(entry: str, changelog_path: str = "CHANGELOG.md") -> None:
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

    idx = None
    if HEADER_END_MARKER in existing:
        idx = existing.index(HEADER_END_MARKER) + len(HEADER_END_MARKER)
    else:
        # Fallback: insert immediately before the first "## Release" heading, which keeps
        # frontmatter, imports, and any header components above the newest entry.
        first_release = re.search(r"(?m)^## Release\b", existing)
        if first_release:
            new_content = (
                existing[: first_release.start()].rstrip()
                + "\n\n\n"
                + entry.rstrip()
                + "\n\n"
                + existing[first_release.start():]
            )
            with open(changelog_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return

    if idx is not None:
        new_content = existing[:idx] + "\n\n\n" + entry + existing[idx:]
    else:
        new_content = entry + "\n" + existing

    with open(changelog_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def main():
    print(f"🔍 Milestone: {MILESTONE_TITLE} | Repos: {', '.join(REPOS)}\n")

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
                    all_notes.append(note)
                print(f"   ✅ #{pr['number']}: {pr['title']}")
            else:
                no_notes_prs.append((repo, pr))
                print(f"   ⏭️  #{pr['number']}: {pr['title']} (NONE / no notes)")
        print()

    # Derive short version for heading/anchor: "v11.7.0" → "v11.7", "11.7.0" → "v11.7"
    version_short = "v" + re.sub(r"\.0$", "", VERSION.lstrip("v"))

    release_type = os.environ.get("RELEASE_TYPE", "feature").strip().lower()
    release_date = os.environ.get("RELEASE_DATE", "").strip() or date.today().strftime("%Y-%m-%d")
    go_version = os.environ.get("GO_VERSION", "").strip()
    changelog_path = os.environ.get("CHANGELOG_PATH", "CHANGELOG.md")

    # Anchor slugs replace dots with dashes: "v11.9" → "v11-9"
    version_slug_anchor = version_short.replace(".", "-")

    if release_type == "esr":
        release_label = "Extended Support Release"
        anchor_slug = f"release-{version_slug_anchor}-extended-support-release"
    else:
        release_label = "Feature Release"
        anchor_slug = f"release-{version_slug_anchor}-feature-release"

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
        if prev_go:
            go_section = f"### Go Version\n - {version_short} is built with Go ``{prev_go}``."
        else:
            go_section = f"### Go Version\n - {version_short} uses the same Go version as the previous release."

    if all_notes:
        polished = polish_with_ai(all_notes)
        blog_url = os.environ.get("BLOG_POST_URL", "").strip()
        if not blog_url:
            # Auto-construct short URL (no patch suffix): v11.6.0 → mattermost-v11-6-is-now-available
            version_slug = re.sub(r"-\d+$", "", VERSION.lstrip("v").replace(".", "-"))
            blog_url = f"https://mattermost.com/blog/mattermost-v{version_slug}-is-now-available/"
            print(f"ℹ️  No blog post URL provided — using auto-constructed URL: {blog_url}")
        # Format as a Markdown link matching existing changelog style: [this blog post](url)
        blog_link = f"[this blog post]({blog_url})"
        polished = polished.replace("BLOG_POST_LINK", blog_link)
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

    insert_changelog_entry(entry, changelog_path)

    prs_with_notes = total_prs - len(no_notes_prs)
    print(f"✅ Changelog updated with notes from {prs_with_notes} PR(s) across {len(REPOS)} repo(s)")

    if no_notes_prs:
        print(f"\n⚠️  {len(no_notes_prs)} PR(s) had no release notes (marked NONE or section missing):")
        for repo, pr in no_notes_prs:
            print(f"   [{repo}] #{pr['number']}: {pr['title']}")


if __name__ == "__main__":
    main()
