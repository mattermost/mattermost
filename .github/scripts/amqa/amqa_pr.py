#!/usr/bin/env python3
"""AMQA PR orchestrator: parse CodeRabbit, build QA plan, decide skip/automation/execute."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from parse_coderabbit import ChangeImpactLevel, merge_signals, to_dict
from spec_mapper import map_changed_files, smoke_specs
from qa_plan_builder import build_qa_plan, format_plan_comment, pr_summary_has_qa_steps
from cis_scorer import load_config
from github_api import (
    env_token,
    get_coderabbit_walkthrough,
    get_commit_status,
    get_pr,
    get_pr_files,
    set_commit_status,
    upsert_pr_comment,
)

PLAN_MARKER = "<!-- agentic-qa-plan -->"
RESULT_MARKER = "<!-- agentic-qa-result -->"
DRY_RUN = os.environ.get("AMQA_DRY_RUN", "").lower() in ("1", "true", "yes")
STATUS_PLAN = "QA/plan"
STATUS_SKIPPED = "QA/skipped"
STATUS_AUTOMATION = "QA/automation"
STATUS_EXECUTION = "QA/execution"
STATUS_QUEUED = "QA/Queued"


def decide_action(plan: dict, signals, tpa_status: str, force_execute: bool) -> str:
    if force_execute:
        return "execute"
    cis = plan["cis_score"]
    cfg = load_config()
    auto_min = cfg.get("dispatch", {}).get("auto_execute_cis_min", 70)

    if signals.should_skip(tpa_status) and cis < 30:
        return "skip"
    if cis >= auto_min or signals.change_impact == ChangeImpactLevel.HIGH:
        return "execute"
    if cis >= 30 or signals.parsed_scenarios or plan.get("scenarios"):
        return "automation"
    return "skip"


def build_qa_result(plan: dict, action: str, mapped_specs: list[str]) -> dict:
    return {
        "schema_version": "1.0",
        "plan_id": plan["plan_id"],
        "pr_number": plan["pr_number"],
        "head_sha": plan["head_sha"],
        "cis_score": plan["cis_score"],
        "coderabbit": plan.get("coderabbit", {}),
        "action": action,
        "mapped_specs": mapped_specs,
        "tpa_status": plan.get("tpa_status", ""),
        "scenario_results": [],
        "overall": "pending" if action == "execute" else "skipped" if action == "skip" else "automation_only",
        "human_review_required": plan["cis_score"] >= 90,
        "verified_at_pr": False,
    }


def post_webhook(webhook_url: str, payload: dict) -> None:
    if not webhook_url:
        return
    import requests
    requests.post(webhook_url, json=payload, timeout=30)


def main() -> int:
    token = env_token()
    repo = os.environ.get("REPO", "mattermost/mattermost")
    pr_number = int(os.environ["PR_NUMBER"])
    head_sha = os.environ.get("HEAD_SHA", "")
    force_execute = os.environ.get("AMQA_FORCE_EXECUTE", "").lower() in ("1", "true", "yes")
    force_skip = os.environ.get("AMQA_FORCE_SKIP", "").lower() in ("1", "true", "yes")

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
    mapped_specs = list(dict.fromkeys(map_changed_files(changed_files) + smoke_specs()))

    cr_dict = to_dict(signals, pr_number)
    plan = build_qa_plan(pr_number, head_sha, signals, changed_files, mapped_specs, tpa_status, cr_dict)

    if force_skip:
        action = "skip"
    else:
        action = decide_action(plan, signals, tpa_status, force_execute)

    qa_result = build_qa_result(plan, action, mapped_specs)

    out_dir = Path(os.environ.get("AMQA_OUTPUT_DIR", "/tmp/amqa"))
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "qa-plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    (out_dir / "qa-result.json").write_text(json.dumps(qa_result, indent=2) + "\n")
    (out_dir / "coderabbit-signals.json").write_text(json.dumps(cr_dict, indent=2) + "\n")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.write(f"action={action}\n")
            fh.write(f"cis_score={plan['cis_score']}\n")
            fh.write(f"change_impact={signals.change_impact.value}\n")
            fh.write(f"should_skip={'true' if action == 'skip' else 'false'}\n")
            fh.write(f"needs_execution={'true' if action == 'execute' else 'false'}\n")
            fh.write(f"mapped_specs={','.join(mapped_specs)}\n")

    if DRY_RUN:
        print(json.dumps({"dry_run": True, "action": action, "plan": plan}, indent=2))
        return 0

    run_url = (
        os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        + f"/{repo}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
    )
    plan_comment = format_plan_comment(plan, mapped_specs, pr_summary_has_qa_steps(pr.get("body", "")))

    set_commit_status(token, repo, head_sha, STATUS_PLAN, "success", f"Plan ready — CIS {plan['cis_score']}")

    cfg = load_config()
    webhook_min = cfg.get("dispatch", {}).get("webhook_notify_cis_min", 70)
    webhook_url = os.environ.get("WEBHOOK_URL", "")
    if plan["cis_score"] >= webhook_min and webhook_url:
        post_webhook(webhook_url, {
            "text": f"#agentic-qa PR #{pr_number} CIS {plan['cis_score']} ({plan['risk_tier']}) — action `{action}`",
            "pr_number": pr_number,
            "cis_score": plan["cis_score"],
            "action": action,
        })

    if action == "skip":
        set_commit_status(token, repo, head_sha, STATUS_SKIPPED, "success", "Low risk — no manual QA needed")
        set_commit_status(token, repo, head_sha, STATUS_AUTOMATION, "success", "Skipped — low impact")
        set_commit_status(token, repo, head_sha, STATUS_EXECUTION, "success", "Skipped — low impact")
    elif action == "automation":
        set_commit_status(token, repo, head_sha, STATUS_SKIPPED, "success", "Scoped checks apply")
        set_commit_status(token, repo, head_sha, STATUS_AUTOMATION, "pending", "Scoped automation pending")
        set_commit_status(token, repo, head_sha, STATUS_EXECUTION, "success", "Not required at this CIS")
        upsert_pr_comment(token, repo, pr_number, PLAN_MARKER, plan_comment)
    else:
        set_commit_status(token, repo, head_sha, STATUS_SKIPPED, "success", "Verification required")
        set_commit_status(token, repo, head_sha, STATUS_AUTOMATION, "pending", "Scoped automation pending")
        set_commit_status(token, repo, head_sha, STATUS_EXECUTION, "pending", "Agent execution pending", run_url)
        upsert_pr_comment(token, repo, pr_number, PLAN_MARKER, plan_comment)

    print(json.dumps({"action": action, "cis_score": plan["cis_score"]}, indent=2))
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
