#!/usr/bin/env python3
"""Parse JUnit XML artifacts and publish a GitHub Check Run with the results."""

import glob
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET


def parse_results(pattern="**/*.xml"):
    total = failed = skipped = 0
    annotations = []

    for f in glob.glob(pattern, recursive=True):
        try:
            root = ET.parse(f).getroot()
            for tc in root.iter("testcase"):
                total += 1
                if tc.find("skipped") is not None:
                    skipped += 1
                elif tc.find("failure") is not None or tc.find("error") is not None:
                    el = tc.find("failure") if tc.find("failure") is not None else tc.find("error")
                    failed += 1
                    name = f"{tc.get('classname', '')}.{tc.get('name', '')}".strip(".")
                    message = (el.get("message") or el.text or "").strip()[:500]
                    annotations.append({"name": name, "message": message})
        except Exception as e:
            print(f"Warning: could not parse {f}: {e}", file=sys.stderr)

    passed = total - failed - skipped
    return total, passed, failed, skipped, annotations


def build_summary(total, passed, failed, skipped, annotations):
    icon = "✅" if failed == 0 else "❌"
    lines = [
        "| Tests | Passed | Failed | Skipped |",
        "|-------|--------|--------|---------|",
        f"| {total} | {passed} | {failed} | {skipped} |",
    ]
    if annotations:
        lines += [
            "",
            "<details><summary>Failed tests</summary>",
            "",
        ]
        for a in annotations[:50]:
            first_line = next(iter(a.get("message", "").splitlines()), "")[:120]
            lines.append(f"- **{a['name']}**: {first_line}")
        lines.append("</details>")
        if len(annotations) > 50:
            lines.append(f"_...and {len(annotations) - 50} more_")
    return "\n".join(lines)


def create_check_run(owner, repo, sha, title, summary, conclusion):
    payload = {
        "name": "JUnit Test Report",
        "head_sha": sha,
        "status": "completed",
        "conclusion": conclusion,
        "output": {
            "title": title,
            "summary": summary,
        },
    }
    try:
        result = subprocess.run(
            ["gh", "api", f"repos/{owner}/{repo}/check-runs",
             "--method", "POST",
             "--input", "-"],
            input=json.dumps(payload).encode(),
            capture_output=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        print("Error: timed out waiting for GitHub API", file=sys.stderr)
        sys.exit(1)
    if result.returncode != 0:
        print(f"Error creating check run: {result.stderr.decode()}", file=sys.stderr)
        sys.exit(1)


def main():
    owner = os.environ["GITHUB_REPOSITORY_OWNER"]
    repo = os.environ["GITHUB_REPOSITORY"].split("/")[1]
    sha = os.environ["GITHUB_SHA"]

    total, passed, failed, skipped, annotations = parse_results()

    title = f"{total} tests run, {passed} passed, {skipped} skipped, {failed} failed."
    summary = build_summary(total, passed, failed, skipped, annotations)
    conclusion = "success" if failed == 0 else "failure"

    print(title)
    create_check_run(owner, repo, sha, title, summary, conclusion)


if __name__ == "__main__":
    main()
