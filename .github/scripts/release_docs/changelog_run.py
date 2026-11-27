"""The changelog workflow's own account of a release, and the changelog bullet each PR got.

generate-changelog.yml uploads ``sections.json`` with every run: each bullet it wrote, with
its section, subsection and source PRs (or a derived source such as ``migration:000240_x``).
A run in update mode lists only the bullets it added, so every successful run for the
release is read. The bullet text a person sees is the one in the changelog entry now, which
reviewers may have edited: a report's bullet is matched to the entry's by its wording.
"""

import difflib
import json
import os
import re
import subprocess
import tempfile

WORKFLOW = "generate-changelog.yml"
ARTIFACT = "changelog-output"
SIMILAR = 0.6  # an entry bullet this close to the generated one is that bullet, edited
_BULLET = re.compile(r"^( *)- +(\S.*)$")
_HEADING = re.compile(r"^(#{3,4}) +(.*?)\s*$")


def fetch_reports(version: str, token: str, repo: str = "mattermost/mattermost", limit: int = 40,
                  run=subprocess.run) -> tuple[list[dict], str | None]:
    """(sections.json of every successful changelog run for ``version``, newest first; a problem).

    A run in update mode lists only the bullets it added, so the reports are complete only when
    the run that created the entry (any mode but ``update``) is among them. Without it the problem
    says why: a report that couldn't be downloaded or read, or the ``limit`` newest runs not
    reaching back that far. The reports found are still returned.

    Read with the gh CLI and a token that can read Actions (``actions: read``)."""
    if not token:
        return [], "no token that can read Actions (ACTIONS_TOKEN)"
    env = {**os.environ, "GH_TOKEN": token}

    def gh(*args):
        return run(["gh", *args], capture_output=True, text=True, env=env)

    listing = gh("run", "list", "--repo", repo, "--workflow", WORKFLOW, "--status", "success",
                 "--limit", str(limit), "--json", "databaseId")
    if listing.returncode != 0:
        return [], "the changelog workflow's runs could not be listed (it needs actions: read)"
    reports, unread = [], 0
    runs = json.loads(listing.stdout or "[]")
    with tempfile.TemporaryDirectory() as directory:
        for found in runs:
            target = os.path.join(directory, str(found["databaseId"]))
            if gh("run", "download", str(found["databaseId"]), "--repo", repo, "-n", ARTIFACT, "-D", target).returncode:
                unread += 1
                continue
            try:
                with open(os.path.join(target, "sections.json"), encoding="utf-8") as f:
                    report = json.load(f)
            except (OSError, ValueError):
                unread += 1
                continue
            if report.get("version") == version:
                reports.append(report)
    if any(report.get("mode") != "update" for report in reports):
        return reports, None
    why = []
    if unread:
        why.append("1 changelog run's report could not be read" if unread == 1
                   else f"{unread} changelog runs' reports could not be read")
    if len(runs) >= limit:
        why.append(f"only the newest {limit} changelog runs were checked")
    reason = f" ({'; '.join(why)})" if why else ""
    if not reports:
        return reports, f"no changelog run for {version} was found{reason}"
    return reports, f"the changelog run that created the {version} entry was not found{reason}, so its bullets may be incomplete"


def items(reports: list[dict]) -> list[dict]:
    """Every bullet the changelog runs wrote, newest run first, each text once:
    ``{"section", "subsection", "text", "sources"}``. A text written by several runs keeps the
    newest run's place and every run's sources."""
    found, by_text = [], {}
    for report in reports:
        for group in report.get("sections", []):
            for item in group.get("items", []):
                text = " ".join((item.get("text") or "").split())
                if not text:
                    continue
                sources = list(item.get("sources") or [])
                if text in by_text:
                    by_text[text]["sources"] = list(dict.fromkeys(by_text[text]["sources"] + sources))
                    continue
                by_text[text] = {"section": group.get("section"), "subsection": group.get("subsection"),
                                 "text": text, "sources": list(dict.fromkeys(sources))}
                found.append(by_text[text])
    return found


def entry_bullets(entry: str | None) -> list[dict]:
    """The bullets of a changelog entry as ``{"section", "subsection", "text"}``, nested ones included."""
    bullets, section, subsection = [], None, None
    for line in (entry or "").splitlines():
        heading = _HEADING.match(line)
        if heading:
            if heading.group(1) == "###":
                section, subsection = heading.group(2), None
            else:
                subsection = heading.group(2)
            continue
        bullet = _BULLET.match(line)
        if bullet:
            bullets.append({"section": section, "subsection": subsection, "text": bullet.group(2).strip()})
        elif bullets and line.startswith("   ") and line.strip():
            bullets[-1]["text"] += " " + line.strip()
    return bullets


def _similar(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, " ".join(a.lower().split()), " ".join(b.lower().split())).ratio()


_CODE = re.compile(r"``(.+?)``|`([^`]+)`")


def _identifiers(text: str) -> set[str]:
    return {a or b for a, b in _CODE.findall(text)}


# What a bullet does to its subject. An "Added X" bullet and a "Removed X" one name the same
# thing in nearly the same words, so they never match each other.
_ACTIONS = {"added": "added", "introduced": "added", "removed": "removed", "dropped": "removed",
            "deleted": "removed", "deprecated": "deprecated", "changed": "changed", "updated": "changed",
            "renamed": "changed", "replaced": "changed", "moved": "changed", "modified": "changed"}
_LEADING = re.compile(r"^\W*(\w+)")
_PASSIVE = re.compile(r"\b(?:is|are|was|were|has been|have been|will be) (" + "|".join(_ACTIONS) + r")\b", re.IGNORECASE)


def _action(text: str) -> str | None:
    leading = _LEADING.match(text)
    if leading and leading.group(1).lower() in _ACTIONS:
        return _ACTIONS[leading.group(1).lower()]
    passive = _PASSIVE.search(text)
    return _ACTIONS[passive.group(1).lower()] if passive else None


def _compatible(a: str, b: str) -> bool:
    first, second = _action(a), _action(b)
    return first is None or second is None or first == second


def bullets_for(source: str, all_items: list[dict], entry: str | None) -> list[dict]:
    """The changelog bullets of ``source``, with the wording the entry has now when the bullet is
    still there (edited or not); a bullet no longer in the entry is left out. Changelog bullets
    share their phrasing ("Removed ``X`` API endpoint."), so a bullet naming identifiers only
    matches an entry bullet that names one of them, and never one doing something else to it
    ("Added ``X``" is not "Removed ``X``"). The same text in the entry is a match; otherwise
    several close entry bullets are ambiguous, and the bullet is left out (unresolved)."""
    current = entry_bullets(entry)
    found = []
    for item in all_items:
        if source not in item["sources"]:
            continue
        names = _identifiers(item["text"])
        options = [b for b in current if (not names or names & _identifiers(b["text"])) and
                   _compatible(b["text"], item["text"])]
        same = [b for b in options if " ".join(b["text"].split()) == item["text"]]
        close = same[:1] or [b for b in options if _similar(b["text"], item["text"]) >= SIMILAR]
        if len(close) == 1:
            best = close[0]
            found.append({**item, "text": best["text"], "section": best["section"] or item["section"],
                          "subsection": best["subsection"]})
        elif entry is None:
            found.append(item)  # no entry to compare with: the generated text stands
    return found
