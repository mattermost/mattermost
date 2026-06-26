#!/usr/bin/env python3
"""File GitHub defect when agent verification fails (Sev-1/2)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

from github_api import _headers

TIMEOUT = (5, 60)


def find_existing_issue(token: str, repo: str, title: str) -> int | None:
    r = requests.get(
        "https://api.github.com/search/issues",
        headers=_headers(token),
        params={"q": f'repo:{repo} is:issue is:open label:agentic-qa "{title}" in:title'},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    items = r.json().get("items", [])
    return int(items[0]["number"]) if items else None


def file_defect(
    token: str,
    repo: str,
    title: str,
    body: str,
    labels: list[str] | None = None,
) -> int:
    existing = find_existing_issue(token, repo, title)
    if existing:
        r = requests.patch(
            f"https://api.github.com/repos/{repo}/issues/{existing}",
            headers=_headers(token),
            json={"body": body},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        return existing

    payload = {
        "title": title,
        "body": body,
        "labels": labels or ["agentic-qa"],
    }
    r = requests.post(
        f"https://api.github.com/repos/{repo}/issues",
        headers=_headers(token),
        json=payload,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()["number"]


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    repo = os.environ.get("REPO", "mattermost/mattermost")
    pr_number = int(os.environ["PR_NUMBER"])
    head_sha = os.environ.get("HEAD_SHA", "")
    severity = os.environ.get("SEVERITY", "2")
    description = os.environ.get("FAILURE_DESCRIPTION", "Agent verification failed")

    result_path = Path(os.environ.get("AMQA_RESULT_PATH", "/tmp/amqa/qa-result.json"))
    evidence = ""
    if result_path.is_file():
        data = json.loads(result_path.read_text())
        evidence = json.dumps(data.get("execution", {}), indent=2)

    title = f"[AMQA] PR #{pr_number} verification failure"
    body = f"""## Agentic QA failure

**PR:** #{pr_number}
**SHA:** `{head_sha}`
**Severity:** Sev-{severity}

### Description
{description}

### Evidence
```json
{evidence}
```

### Repro
See PR comment `<!-- agentic-qa-result -->` and workflow run logs.
"""
    if int(severity) <= 2 and token:
        issue = file_defect(token, repo, title, body)
        print(f"Updated or created issue #{issue}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
