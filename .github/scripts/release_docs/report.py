"""Private results: the full output goes to Hub, Actions get counts and public refs only.

drafts, release-highlights and breaking-changes read Jira and mattermost/enterprise, so
their text, notes, missing inputs and artifacts can name Jira keys, epics and enterprise
PRs. The Actions log, run summary and artifacts of this public repo are public, so all of
that is posted to the review channel in Hub instead (RELEASE_DOCS_REVIEW_CHANNEL_ID; else, in
a dry run, the test channel RELEASE_AGENT_TEST_CHANNEL_ID, and in a live run the release channel), with the artifacts attached. Actions keep the outcome, the counts,
how many inputs are missing, and mattermost/mattermost PR refs.

Outside GitHub Actions (GITHUB_ACTIONS unset), the full report and its files are also written
to OUTPUT_DIR/private/, so a local dry run can be checked without Hub.

The report is posted in dry runs too: these tasks never change anything else, their
workflows always run them as dry runs, and the report is their whole output. A rerun with
the same output posts nothing new.
"""

import hashlib
import os
import re

from . import hub as hublib
from .result import TODO_MARKER, Result
from .versions import Version

PUBLIC_PR = re.compile(r"(?<![\w.-])mattermost/mattermost#\d+")
HASH_PROP = "release_docs_hash"
PRIVATE_DIR = "private"
REPORT_FILE = "report.md"
# Hub's post limit is 16383 characters; leave room for the code fence and a part number.
CHUNK = 15000


def public_refs(result: Result) -> list[str]:
    """mattermost/mattermost PRs named anywhere in the result, in order."""
    text = "\n".join([result.text, *result.notes, *result.todos])
    return list(dict.fromkeys(PUBLIC_PR.findall(text)))


def full_report(result: Result, run_url: str) -> str:
    lines = [f"**Release docs: {result.task} for {result.version}**" + (f" ([run]({run_url}))" if run_url else ""), ""]
    if result.skipped:
        lines += [f"Not applicable: {result.skipped}.", ""]
    if result.todos:
        lines += ["**Missing inputs**", ""] + [f"- {TODO_MARKER}: {t}" for t in result.todos] + [""]
    if result.notes:
        lines += ["**Notes**", ""] + [f"- {n}" for n in result.notes] + [""]
    if result.text:
        lines += [result.text.rstrip()]
    return "\n".join(lines).rstrip() + "\n"


def chunks(text: str) -> list[str]:
    """``text`` split on line boundaries into posts that fit; a longer line is cut."""
    parts, current = [], ""
    for line in text.splitlines(keepends=True):
        while len(line) > CHUNK:
            if current:
                parts.append(current)
                current = ""
            parts.append(line[:CHUNK])
            line = line[CHUNK:]
        if len(current) + len(line) > CHUNK:
            parts.append(current)
            current = ""
        current += line
    if current:
        parts.append(current)
    return parts or [""]


def review_channel(hub, env: dict, version_text: str) -> str:
    """RELEASE_DOCS_REVIEW_CHANNEL_ID; else in a dry run the test channel, in a live run the release channel."""
    live = env.get("MODE") == "live"
    if env.get("REVIEW_CHANNEL_ID") or not live:
        return hublib.review_channel_id(env, live)
    try:
        version = Version.parse(version_text)
    except ValueError:
        return ""
    return hublib.review_channel_id(env, live, hublib.release_channel(hub, version))


def deliver(result: Result, env: dict, hub, run_url: str = "") -> tuple[bool, str]:
    """Post the full output to Hub. (posted or already there, what happened, in public words)."""
    if hub is None:
        return False, "not posted: RELEASE_AGENT_MM_TOKEN is not set"
    channel = review_channel(hub, env, result.version)
    if not channel:
        return False, "not posted: " + hublib.NO_REVIEW_CHANNEL
    report = full_report(result, run_url)
    digest = hashlib.sha256((report + "".join(f"{k}\n{v}" for k, v in sorted(result.artifacts.items()))).encode()).hexdigest()
    marker = f"release-docs:report:{result.task}:{result.version}"
    existing = hublib.find_post(hub, channel, marker)
    if existing and (existing.get("props") or {}).get(HASH_PROP) == digest:
        return True, "unchanged since the last Hub post, so nothing new was posted"
    try:
        file_ids = [hub.upload_file(channel, name, content.encode()) for name, content in sorted(result.artifacts.items())]
        parts = chunks(report)
        props = {hublib.MARKER_PROP: marker, HASH_PROP: digest}
        root = hub.create_post(channel, parts[0], props, file_ids=file_ids)
        for index, part in enumerate(parts[1:], 2):
            hub.create_post(channel, f"({index}/{len(parts)})\n{part}", {hublib.MARKER_PROP: f"{marker}:part"},
                            root_id=root["id"])
    except hublib.HubError as err:
        return False, f"not posted: {err}"
    files = f", with {len(file_ids)} file(s) attached" if file_ids else ""
    return True, f"posted to the review channel in Hub{files}"


def write_private(result: Result, out_dir: str, run_url: str = "") -> str:
    """The full report and the result's files in ``out_dir/private/``, for local runs only."""
    target = os.path.join(out_dir, PRIVATE_DIR)
    os.makedirs(target, exist_ok=True)
    with open(os.path.join(target, REPORT_FILE), "w", encoding="utf-8") as f:
        f.write(full_report(result, run_url))
    for name, content in result.artifacts.items():
        with open(os.path.join(target, name), "w", encoding="utf-8") as f:
            f.write(content)
    return target


def public_summary(result: Result, outcome: str, mode: str, delivered: str) -> str:
    lines = [f"## {result.task} for {result.version} ({mode})", "", outcome, "",
             f"Full output (it names Jira tickets and enterprise PRs, so it is not shown here): {delivered}.", ""]
    if result.skipped:
        lines += [f"Not applicable: {result.skipped}.", ""]
    counts = dict(result.counts)
    if result.todos:
        counts["missing inputs (listed in Hub; this check fails)"] = len(result.todos)
    if result.notes:
        counts["notes (in Hub)"] = len(result.notes)
    if result.artifacts:
        counts["files (attached in Hub)"] = len(result.artifacts)
    if counts:
        lines += ["### Counts", ""] + [f"- {name}: {value}" for name, value in counts.items()] + [""]
    refs = public_refs(result)
    if refs:
        lines += ["### mattermost/mattermost PRs", ""] + [f"- {ref}" for ref in refs] + [""]
    return "\n".join(lines) + "\n"


def public_record(result: Result, delivered: str) -> dict:
    """``result.json`` for a private result."""
    return {"task": result.task, "version": result.version, "counts": result.counts, "missing_inputs": len(result.todos),
            "notes": len(result.notes), "public_refs": public_refs(result), "skipped": result.skipped, "hub": delivered}
