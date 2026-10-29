"""Version archive entries (playbook T-3): download links, SHA-256, GPG signature and SBOM."""

import re
import time

from . import templates
from .result import Result
from .versions import Version, changelog_url, download_url, is_esr, sbom_url, tarball_name

TASK = "version-archive"
ARCHIVE_PATH = "docs/main/product-overview/version-archive.mdx"
# (edition key, name in entry headings, the TabItem it is listed under)
EDITIONS = (
    ("enterprise", "Enterprise Edition", "mattermost-enterprise"),
    ("team", "Team Edition", "mattermost-team-edition"),
)
SHA256_LINE = re.compile(r"^([0-9a-f]{64})\s+\*?(\S+)\s*$")
HEADER = re.compile(r"^Mattermost (?:Enterprise|Team) Edition v(\d+)\.(\d+)\.(\d+)\b")


def parse_sha256_file(text: str, filename: str) -> str | None:
    """The hash for ``filename`` in a ``sha256sum`` file. Never computed, never guessed."""
    for line in (text or "").splitlines():
        match = SHA256_LINE.match(line.strip())
        if match and match.group(2) == filename:
            return match.group(1)
    return None


def published_facts(version: Version, fetch) -> dict:
    """For each edition, what the release server has: the tarball, its hash, signature and SBOM.

    A value of None means the file is not there (yet).
    """
    facts = {}
    for edition, _, _ in EDITIONS:
        tarball = download_url(version, edition)
        status, text = fetch(f"{tarball}.sha256")
        facts[edition] = {
            "download": fetch(tarball, "HEAD")[0] == 200 or None,
            "sha256": parse_sha256_file(text, tarball_name(version, edition)) if status == 200 else None,
            "signature": fetch(f"{tarball}.sig", "HEAD")[0] == 200 or None,
            "sbom": fetch(sbom_url(version, edition), "HEAD")[0] == 200 or None,
        }
    return facts


def missing(facts: dict) -> list[str]:
    return [f"{edition} {key}" for edition, values in facts.items() for key, value in values.items() if value is None]


def wait_for_facts(version: Version, fetch, attempts: int, interval: float, sleep=time.sleep, log=print) -> dict:
    """Fetch until every file is published or ``attempts`` run out; the last result either way."""
    facts = published_facts(version, fetch)
    for attempt in range(1, attempts):
        gaps = missing(facts)
        if not gaps:
            break
        log(f"Not published yet ({', '.join(gaps)}); retry {attempt} of {attempts - 1} in {interval:.0f}s")
        sleep(interval)
        facts = published_facts(version, fetch)
    return facts


def render_entry(version: Version, edition: str, edition_name: str, esr_versions: str, facts: dict, result: Result) -> str:
    tarball = download_url(version, edition)
    file = tarball_name(version, edition)
    values = facts.get(edition, {})
    if not values.get("download"):
        result.todo(f"{file} is not on releases.mattermost.com")
    sha256 = values.get("sha256") or result.todo(f"no SHA-256 for {file}: {file}.sha256 is missing or does not list it")
    signature = f"{tarball}.sig"
    if not values.get("signature"):
        result.todo(f"{file}.sig (GPG signature) is not published")
    sbom = sbom_url(version, edition)
    if not values.get("sbom"):
        result.todo(f"the {edition_name} SBOM is not published at {sbom}")
    return templates.render("version-archive.md", {
        "edition_name": edition_name,
        "version": version.plain,
        "esr_suffix": " *Extended Support Release (ESR)*" if is_esr(version, esr_versions) else "",
        "changelog_url": changelog_url(version, esr_versions),
        "download_url": tarball,
        "sha256": sha256,
        "signature_url": signature,
        "sbom_url": sbom,
    })


def insert_entry(content: str, tab: str, version: Version, entry_text: str, result: Result) -> str:
    """``content`` with ``entry_text`` listed under ``tab``, newest version first.

    The archive keeps one entry per ``X.Y``: a dot release replaces its line's entry, unless
    that entry is already for a later dot release.
    """
    lines = content.splitlines(keepends=True)
    start = next((i for i, line in enumerate(lines) if f'<TabItem value="{tab}"' in line), None)
    if start is None:
        result.todo(f'{ARCHIVE_PATH} has no <TabItem value="{tab}">')
        return content
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("</TabItem>")), len(lines))
    headers = [(i, Version(*map(int, m.groups()))) for i in range(start + 1, end) if (m := HEADER.match(lines[i]))]
    block = entry_text.rstrip("\n") + "\n\n"
    for n, (index, listed) in enumerate(headers):
        if listed.line == version.line:
            if listed > version:
                result.notes.append(f"The {tab} tab already lists {listed}, later than {version}; left as is.")
                return content
            stop = headers[n + 1][0] if n + 1 < len(headers) else end
            return "".join(lines[:index]) + block + "".join(lines[stop:])
        if listed < version:
            return "".join(lines[:index]) + block + "".join(lines[index:])
    position = end
    while position > start + 1 and not lines[position - 1].strip():
        position -= 1
    return "".join(lines[:position]) + ("\n" if position > start + 1 else "") + block + "".join(lines[position:])


def build(version: Version, archive: str, esr_versions: str, facts: dict) -> Result:
    result = Result(TASK, version.tag, repo="mattermost/mattermost")
    content = archive
    for edition, name, tab in EDITIONS:
        content = insert_entry(content, tab, version, render_entry(version, edition, name, esr_versions, facts, result), result)
    if content != archive:
        result.files[ARCHIVE_PATH] = content
    result.title = f"Add {version} to the version archive"
    result.body = (
        f"Adds Mattermost {version} to the [version archive](https://docs.mattermost.com/product-overview/version-archive.html) "
        "for Enterprise and Team Edition: download link, SHA-256 checksum, GPG signature and SBOM.\n\n"
        "The SHA-256 values are copied from the `.sha256` files published next to each tarball.\n\n"
        "Playbook (T-3): Open a doc PR to add the download links, SHA-256 hash, GPG signature, and SBOM.json "
        "download links to the version archive.\n"
    )
    return result
