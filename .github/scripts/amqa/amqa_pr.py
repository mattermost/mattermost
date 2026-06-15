#!/usr/bin/env python3
"""AMQA PR orchestrator: parse CodeRabbit, decide skip/automation/execute, post statuses."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from parse_coderabbit import ChangeImpactLevel, merge_signals, to_dict
from spec_mapper import map_changed_files
from github_api import (
    env_token,
    get_coderabbit_walkthrough,
    get_commit_status,
    get_pr,
    get_pr_files,
    set_commit_status,
    upsert_pr_comment,
)

RESULT_MARKER = "<!-- agentic-qa-result -->"
DRY_RUN = os.environ.get("AMQA_DRY_RUN", "").lower() in ("1", "true", "yes")
STATUS_SKIPPED = "QA/skipped"
STATUS_AUTOMATION = "QA/automation"
STATUS_EXECUTION = "QA/execution"


def decide_action(signals, tpa_status: str) -> str:
    if signals.should_skip(tpa_status):
        return "skip"
    if signals.change_impact == ChangeImpactLevel.HIGH:
        return "execute"
    if signals.change_impact == ChangeImpactLevel.MEDIUM:
        return "automation"
    if signals.parsed_scenarios:
        return "automation"
    return "skip"


def build_qa_result(
    pr_number: int,
    head_sha: str,
    signals,
    action: str,
    mapped_specs: list[str],
    tpa_status: str,
) -> dict:
    return {
        "schema_version": "1.0",
        "pr_number": pr_number,
        "head_sha": head_sha,
        "coderabbit": to_dict(signals, pr_number),
        "action": action,
        "mapped_specs": mapped_specs,
        "tpa_status": tpa_status,
        "scenario_results": [],
        "overall": "pending" if action == "execute" else "skipped" if action == "skip" else "automation_only",
        "human_review_required": signals.change_impact == ChangeImpactLevel.HIGH,
    }


def format_result_comment(signals, action: str, mapped_specs: list[str], qa_result: dict) -> str:
    impact = signals.change_impact.value
    lines = [
        "## Agentic QA",
        "",
        f"**Change Impact:** {impact} (via CodeRabbit)",
        f"**Action:** `{action}`",
        "",
    ]
    if action == "skip":
        lines.append("No manual QA required per CodeRabbit + test analysis. Zero human touch.")
        return "\n".join(lines)
    if mapped_specs:
        lines.append("**Scoped specs:**")
        for spec in mapped_specs:
            lines.append(f"- `{spec}`")
        lines.append("")
    if signals.parsed_scenarios:
        lines.append("**Scenarios (from CodeRabbit QA Recommendation):**")
        for i, scenario in enumerate(signals.parsed_scenarios, 1):
            lines.append(f"{i}. {scenario['title']}")
        lines.append("")
    if action == "execute":
        lines.append("Agent execution queued for 🔴 High impact. Evidence will be attached here.")
    lines.append(f"<details><summary>qa-result.json</summary>\n\n```json\n{json.dumps(qa_result, indent=2)}\n```\n</details>")
    return "\n".join(lines)


def main() -> int:
    token = env_token()
    repo = os.environ.get("REPO", "mattermost/mattermost")
    pr_number = int(os.environ["PR_NUMBER"])
    head_sha = os.environ.get("HEAD_SHA", "")

    if not token:
        print("Missing GITHUB_TOKEN", file=sys.stderr)
        return 1

    pr = get_pr(token, repo, pr_number)
    if not head_sha:
        head_sha = pr["head"]["sha"]

    walkthrough = get_coderabbit_walkthrough(token, repo, pr_number)
    signals = merge_signals(pr.get("body", ""), walkthrough)
    tpa_status = get_commit_status(token, repo, head_sha, "Tests/analysis")
    changed_files = get_pr_files(token, repo, pr_number)
    mapped_specs = map_changed_files(changed_files)
    action = decide_action(signals, tpa_status)
    qa_result = build_qa_result(pr_number, head_sha, signals, action, mapped_specs, tpa_status)

    out_dir = Path(os.environ.get("AMQA_OUTPUT_DIR", "/tmp/amqa"))
    out_dir.mkdir(parents=True, exist_ok=True)
    result_path = out_dir / "qa-result.json"
    signals_path = out_dir / "coderabbit-signals.json"
    result_path.write_text(json.dumps(qa_result, indent=2) + "\n")
    signals_path.write_text(json.dumps(to_dict(signals, pr_number), indent=2) + "\n")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.write(f"action={action}\n")
            fh.write(f"change_impact={signals.change_impact.value}\n")
            fh.write(f"should_skip={'true' if action == 'skip' else 'false'}\n")
            fh.write(f"needs_execution={'true' if action == 'execute' else 'false'}\n")
            fh.write(f"mapped_specs={','.join(mapped_specs)}\n")

    if DRY_RUN:
        print(json.dumps({"dry_run": True, "action": action, "qa_result": qa_result}, indent=2))
        return 0

    run_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com") + f"/{repo}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"

    if action == "skip":
        set_commit_status(token, repo, head_sha, STATUS_SKIPPED, "success", "Low risk — no manual QA needed")
        set_commit_status(token, repo, head_sha, STATUS_AUTOMATION, "success", "Skipped — low impact")
        set_commit_status(token, repo, head_sha, STATUS_EXECUTION, "success", "Skipped — low impact")
    elif action == "automation":
        set_commit_status(token, repo, head_sha, STATUS_SKIPPED, "success", "Not skipped — scoped checks apply")
        set_commit_status(token, repo, head_sha, STATUS_AUTOMATION, "pending", "Scoped automation pending")
        set_commit_status(token, repo, head_sha, STATUS_EXECUTION, "success", "Not required for this impact level")
        upsert_pr_comment(token, repo, pr_number, RESULT_MARKER, format_result_comment(signals, action, mapped_specs, qa_result))
    else:
        set_commit_status(token, repo, head_sha, STATUS_SKIPPED, "success", "High impact — verification required")
        set_commit_status(token, repo, head_sha, STATUS_AUTOMATION, "pending", "Scoped automation pending")
        set_commit_status(token, repo, head_sha, STATUS_EXECUTION, "pending", "Agent execution pending", run_url)
        upsert_pr_comment(token, repo, pr_number, RESULT_MARKER, format_result_comment(signals, action, mapped_specs, qa_result))

    print(json.dumps({"action": action, "change_impact": signals.change_impact.value}, indent=2))
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
