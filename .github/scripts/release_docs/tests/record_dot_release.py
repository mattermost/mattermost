"""Record a dot release day for the replay tests: ``python3 -m release_docs.tests.record_dot_release 2026-10-22``.

Run from ``.github/scripts`` in a full clone (the hand-made PR's merge commit and its parent
must be present) with ``GITHUB_TOKEN`` set. Writes ``fixtures/dot-release/<day>/``: the docs
before and after the merge, trimmed, and the GitHub and HTTP answers the task needed, trimmed
to what it reads (the Go and plugin lines, config struct fields, release notes).
"""

import json
import os
import re
import subprocess
import sys

from check_config_changes_ci import _scan_struct_fields

from release_docs import dot_release, http
from release_docs.github import GitHub
from release_docs.tests import dot_replay

BODY_CHARS = 1500


def git_show(ref: str, path: str) -> str:
    return subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True, check=True).stdout


def slim_file(path: str, text: str | None) -> str | None:
    if text is None:
        return None
    if path == dot_release.GO_VERSION_FILE:
        return text
    if path == dot_release.BUILDENV_DOCKERFILE:
        return "\n".join(line for line in text.splitlines() if line.startswith("FROM ")) + "\n"
    if path == dot_release.PLUGIN_MAKEFILE:
        return "\n".join(line for line in text.splitlines() if line.startswith("PLUGIN_PACKAGES +=")) + "\n"
    if path == dot_release.CONFIG_GO:
        structs = {}
        for struct, name in sorted(_scan_struct_fields(text)):
            structs.setdefault(struct, []).append(name)
        return "".join(f"type {s} struct {{\n" + "".join(f"\t{n} int\n" for n in names) + "}\n\n"
                       for s, names in structs.items())
    return text


def slim_body(body: str) -> str:
    """The description without comments, cut short, plus every release-note block and checkbox."""
    text = re.sub(r"<!--.*?-->", "", (body or "").replace("\r\n", "\n"), flags=re.DOTALL)
    blocks = re.findall(r"```release-note[ \t]*\n.*?\n?```", text, re.DOTALL)
    rest = re.sub(r"```release-note[ \t]*\n.*?\n?```", "", text, flags=re.DOTALL)
    boxes = re.findall(r"(?im)^\s*-\s*\[[ xX]\]\s*Breaking change.*$", rest)
    return "\n\n".join([rest.strip()[:BODY_CHARS], *blocks, *boxes]).strip()


def slim_pull(pr: dict | None) -> dict | None:
    if pr is None:
        return None
    return {"number": pr["number"], "title": pr["title"], "body": slim_body(pr.get("body")),
            "html_url": pr["html_url"], "user": {"login": pr["user"]["login"]},
            "labels": [{"name": label["name"]} for label in pr.get("labels", [])],
            "head": {"ref": pr.get("head", {}).get("ref", "")}}


class RecordingGitHub(dot_replay.ReplayGitHub):
    def __init__(self, real: GitHub, docs: dict):
        super().__init__({}, docs)
        self.real = real

    def _keep(self, value, method, *args):
        self.recorded[dot_replay.key(method, *args)] = value
        return value

    def file(self, repo, path, ref):
        if path in self.docs:
            return self.docs[path]
        return self._keep(slim_file(path, self.real.file(repo, path, ref)), "file", path, ref)

    def tag_sha(self, repo, tag):
        return self._keep(self.real.tag_sha(repo, tag), "tag_sha", tag)

    def commit(self, repo, sha):
        return self._keep(self.real.commit(repo, sha), "commit", sha)

    def commits_between(self, repo, base, head):
        commits = [{"sha": c["sha"]} for c in self.real.commits_between(repo, base, head)]
        return self._keep(commits, "commits_between", base, head)

    def pull(self, repo, number):
        return self._keep(slim_pull(self.real.pull(repo, number)), "pull", number)

    def commit_pulls(self, repo, sha):
        return self._keep([slim_pull(p) for p in self.real.commit_pulls(repo, sha)], "commit_pulls", sha)


def main(argv: list[str]) -> int:
    day = argv[0]
    config = dot_replay.DAYS[day]
    versions = dot_replay.day_versions(day)
    merge = config["merge"]
    out = os.path.join(dot_replay.FIXTURES, day)
    docs = {}
    for side, ref in (("before", f"{merge}^"), ("after", merge)):
        for path in dot_replay.docs_paths(versions):
            text = dot_replay.trim(path, git_show(ref, path), versions)
            target = os.path.join(out, side, path.removeprefix("docs/main/"))
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                f.write(text)
            if side == "before":
                docs[path] = text
    gh = RecordingGitHub(GitHub(os.environ["GITHUB_TOKEN"]), docs)

    def fetch(url, method="GET"):
        status, body = http.fetch(url, method)
        gh.recorded[dot_replay.key("fetch", method, url)] = [status, body]
        return status, body

    env = {"SEVERITY": config["severity"], "RELEASE_DATE": day, "WAIT_ATTEMPTS": "1"}
    result, outcome, _ = dot_release.run(gh, versions, env, None, fetch, live=False)
    print(outcome)
    for todo in result.todos:
        print(f"TODO: {todo}")
    with open(os.path.join(out, "github.json"), "w", encoding="utf-8") as f:
        json.dump(gh.recorded, f, indent=1, sort_keys=True)
        f.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
