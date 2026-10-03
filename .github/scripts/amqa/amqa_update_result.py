#!/usr/bin/env python3
"""Update qa-result after automation or agent execution."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from github_api import env_token, get_pr, set_commit_status, upsert_pr_comment

RESULT_MARKER = "<!-- agentic-qa-result -->"


def main() -> int:
    token = env_token()
    repo = os.environ.get("REPO", "mattermost/mattermost")
    pr_number = int(os.environ["PR_NUMBER"])
    head_sha = os.environ.get("HEAD_SHA", "")
    context = os.environ["STATUS_CONTEXT"]
    state = os.environ.get("STATUS_STATE", "success")
    description = os.environ.get("STATUS_DESCRIPTION", "")
    overall = os.environ.get("OVERALL", state)
    stage = os.environ.get("STAGE", "automation")

    result_path = Path(os.environ.get("AMQA_RESULT_PATH", "/tmp/amqa/qa-result.json"))
    if not result_path.is_file():
        print(f"Missing {result_path}", file=sys.stderr)
        return 1

    qa_result = json.loads(result_path.read_text())
    qa_result["overall"] = overall
    if stage == "automation":
        qa_result["automation"] = {
            "state": state,
            "description": description,
            "specs_run": os.environ.get("SPECS_RUN", "").split(",") if os.environ.get("SPECS_RUN") else [],
        }
    elif stage == "execution":
        qa_result["execution"] = {
            "state": state,
            "description": description,
            "evidence_urls": [u for u in os.environ.get("EVIDENCE_URLS", "").split(",") if u],
        }
        qa_result["verified_at_pr"] = state == "success"
    result_path.write_text(json.dumps(qa_result, indent=2) + "\n")

    if not token:
        return 0

    pr = get_pr(token, repo, pr_number)
    if not head_sha:
        head_sha = pr["head"]["sha"]

    set_commit_status(token, repo, head_sha, context, state, description)

    if stage == "execution" and state in ("failure", "error"):
        body = (
            "## Agentic QA — verification failed\n\n"
            f"{description}\n\n"
            f"Evidence: {os.environ.get('EVIDENCE_URLS', 'none')}\n\n"
            f"<details><summary>qa-result.json</summary>\n\n```json\n{json.dumps(qa_result, indent=2)}\n```\n</details>"
        )
        upsert_pr_comment(token, repo, pr_number, RESULT_MARKER, body)
    elif stage == "execution" and state == "success":
        body = (
            "## Agentic QA — verified\n\n"
            "CodeRabbit QA Recommendation scenarios executed.\n\n"
            f"Evidence: {os.environ.get('EVIDENCE_URLS', 'see workflow logs')}\n\n"
            f"<details><summary>qa-result.json</summary>\n\n```json\n{json.dumps(qa_result, indent=2)}\n```\n</details>"
        )
        upsert_pr_comment(token, repo, pr_number, RESULT_MARKER, body)

    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
