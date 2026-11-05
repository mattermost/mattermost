"""Replays of dot release days that were documented by hand, for the dot release docs task.

``record_dot_release.py`` reads each day from GitHub and git once; the tests replay it with no
network. The docs files are trimmed to the minors that changed, the same way before and after.
"""

import json
import os
import re

from release_docs import dot_release
from release_docs.versions import Version

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "dot-release")

# Each day: the merge commit of the hand-made PR, the versions in it, and the inputs a person
# would confirm (severity and release date) as they were published.
DAYS = {
    "2026-10-22": {
        "merge": "246a047c6831aa694aa21b68e44c10474cf57ef8",  # #39357
        "pr": 39357,
        "versions": ["v12.0.1", "v11.11.3", "v11.10.4", "v11.7.14", "v10.11.25"],
        "severity": "v12.0.1=Medium, v11.11.3=Medium, v11.10.4=Medium, v11.7.14=Low to Medium, v10.11.25=none",
    },
    "2026-10-19": {
        "merge": "c77a59ea33",  # #39004
        "pr": 39004,
        "versions": ["v11.11.2", "v11.10.3", "v11.7.13"],
        "severity": "Medium",
    },
}


def day_versions(day: str) -> list[Version]:
    return [Version.parse(v) for v in DAYS[day]["versions"]]


def docs_paths(versions: list[Version]) -> list[str]:
    changelogs = sorted({dot_release.changelog_path(v) for v in versions}, reverse=True)
    return [*dot_release.DEPLOY_PAGES, dot_release.SERVER_RELEASES, *changelogs, dot_release.ARCHIVE]


def trim(path: str, text: str, versions: list[Version]) -> str:
    if path == dot_release.ARCHIVE:
        return trim_archive(text, {v.line for v in versions})
    if path.startswith(f"{dot_release.DOCS_DIR}/mattermost-v"):
        return trim_changelog(text, [v for v in versions if dot_release.changelog_path(v) == path])
    return text


def trim_archive(text: str, minors: set) -> str:
    """The tabs' scaffolding and the entries for ``minors``."""
    lines = text.split("\n")
    out, keep = [], True
    for line in lines:
        header = dot_release.ARCHIVE_HEADER.match(line)
        if header:
            keep = (int(header.group(1)), int(header.group(2))) in minors
        elif line.startswith(("<TabItem", "</TabItem>", "<Tabs>", "</Tabs>")):
            keep = True
        if keep:
            out.append(line)
    return "\n".join(out)


def trim_changelog(text: str, versions: list[Version]) -> str:
    """The page header, then each minor's section from its heading through the previous
    release's bullet (or the Release day line before the first dot release)."""
    lines = text.split("\n")
    first = next(i for i, line in enumerate(lines) if line.startswith("## Release "))
    out = lines[:first]
    for v in versions:
        start, end = dot_release._section(lines, v)
        previous = Version(v.major, v.minor, v.patch - 1)
        bullet = next((i for i in range(start, end) if lines[i].startswith(f"- **{previous.plain}, released ")), None)
        if bullet is not None:
            stop = next((i for i in range(bullet + 1, end) if not lines[i].startswith(" ")), end)
            callout = dot_release._callout_after(lines, stop - 1, end) if previous.patch == 0 else None
            if callout:
                stop = callout[1] + 1
        else:
            stop = next(i for i in range(start, end) if dot_release.RELEASE_DAY.match(lines[i])) + 1
        out += lines[start:stop] + [""]
    # The task names a plugin the way the changelog does most often, so keep those mentions.
    mentions = [line for line in lines if line.lstrip().startswith("- Pre-packaged ") and line not in out]
    out += [PLUGIN_NAMES_HEADING, "", *mentions, ""]
    return "\n".join(out)


PLUGIN_NAMES_HEADING = "## Plugin names (replay fixture only)"


def load(day: str) -> dict:
    with open(os.path.join(FIXTURES, day, "github.json"), encoding="utf-8") as f:
        return json.load(f)


def read_docs(day: str, side: str, versions: list[Version]) -> dict:
    files = {}
    for path in docs_paths(versions):
        with open(os.path.join(FIXTURES, day, side, path.removeprefix("docs/main/")), encoding="utf-8") as f:
            files[path] = f.read()
    return files


def key(method: str, *args) -> str:
    return f"{method} " + " ".join(str(a) for a in args)


class ReplayGitHub:
    """The GitHub calls the task makes, answered from a recording; the docs from the fixtures."""

    def __init__(self, recorded: dict, docs: dict):
        self.recorded = recorded
        self.docs = docs

    def _get(self, method, *args):
        name = key(method, *args)
        if name not in self.recorded:
            raise AssertionError(f"not recorded: {name}")
        return self.recorded[name]

    def default_branch(self, repo):
        return "master"

    def branch_sha(self, repo, branch):
        return "base-sha" if branch == "master" else None

    def branches_with_prefix(self, repo, prefix):
        return []

    def pulls_for_branch(self, repo, branch):
        return []

    def file(self, repo, path, ref):
        if path in self.docs:
            return self.docs[path]
        return self._get("file", path, ref)

    def tag_sha(self, repo, tag):
        return self._get("tag_sha", tag)

    def commit(self, repo, sha):
        return self._get("commit", sha)

    def commits_between(self, repo, base, head):
        return self._get("commits_between", base, head)

    def pull(self, repo, number):
        return self._get("pull", number)

    def commit_pulls(self, repo, sha):
        return self._get("commit_pulls", sha)


def replay_fetch(recorded: dict):
    def fetch(url, method="GET"):
        name = key("fetch", method, url)
        if name not in recorded:
            raise AssertionError(f"not recorded: {name}")
        status, body = recorded[name]
        return status, body
    return fetch


# Labels of the Jira tickets named by PRs of the 2026-10-19 day, read from Jira on 2026-11-05. MM-70601 and
# MM-69969 are the security fixes among the PRs that carry release-note-none and Changelog/Not Needed.
JIRA_LABELS = {"MM-70601": {"customer-bug", "security"}, "MM-69969": {"security"}}


def jira_labels(keys) -> set:
    return set().union(*(JIRA_LABELS.get(key, set()) for key in keys))


class TitleClaude:
    """Stands in for Claude: one sentence from the PR title, in the changelog's form."""

    def __init__(self):
        self.asked = []

    def ask_json(self, system, prompt, max_tokens=400):
        title = prompt.splitlines()[0].removeprefix("Title: ")
        self.asked.append(title)
        return {"bullet": f"Updated {title[0].lower()}{title[1:]}"}


# ── Comparing the changelog: exact except for the wording of fix bullets ─────────────

def entries(text: str) -> tuple[str, dict]:
    """(the text with every dot release entry's fix bullets replaced by a marker, the entries)."""
    lines = text.split("\n")
    out, found, current = [], {}, None
    for line in lines:
        match = dot_release.DOT_BULLET.match(line)
        if match:
            current = {"header": line, "fixed": [], "fixes": 0}
            found[".".join(match.groups())] = current
            out.append(line)
            continue
        if current is not None and line.startswith("  - "):
            body = line[4:]
            if body.startswith(("Mattermost v", "Go runtime", "Pre-packaged", "Removed the pre-packaged", "Original ")):
                current["fixed"].append(body)
                out.append(line)
            else:
                current["fixes"] += 1
                out.append("  - <fix bullet>")
            continue
        if current is not None and line.startswith("     - "):
            current["fixes"] += 1
            out.append("     - <fix bullet>")
            continue
        current = None
        out.append(line)
    return "\n".join(out), found


def plugin_order_free(text: str) -> str:
    """Pre-packaged plugin lines sorted within each entry: the order was never fixed by hand."""
    lines, out, block = text.split("\n"), [], []
    for line in lines + [""]:
        if line.startswith("  - Pre-packaged "):
            block.append(line)
            continue
        out += sorted(block)
        block = []
        out.append(line)
    return "\n".join(out[:-1])


def changelog_shape(text: str) -> str:
    return plugin_order_free(entries(text)[0])


def new_bullets(before: str, after: str) -> list[str]:
    """The fix bullets ``after`` adds to ``before``."""
    return [line for line in after.split("\n") if line.startswith(("  - ", "     - ")) and line not in before.split("\n")]


def closing_kind(entry_lines: list[str]) -> list[str]:
    return [line for line in entry_lines if re.match(r"Mattermost v\S+ contains (no database|the following)", line)]
