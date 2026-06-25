#!/usr/bin/env python3
"""File GitHub defect when agent verification fails (Sev-1/2)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

TIMEOUT = (5, 60)


def file_defect(
    token: str,
    repo: str,
    pr_number: int,
    title: str,
    body: str,
    labels: list[str] | None = None,
) -> int:
    payload = {
        "title": title,
        "body": body,
        "labels": labels or ["agentic-qa"],
    }
    r = requests.post(
        f"https://api.github.com/repos/{repo}/issues",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
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
        issue = file_defect(
            token,
            repo,
            pr_number,
            f"[AMQA] PR #{pr_number} verification failure",
            body,
        )
        print(f"Created issue #{issue}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
