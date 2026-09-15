#!/usr/bin/env python3
"""Emit AMQA KPI summary for GitHub Actions job summary."""

from __future__ import annotations

import json
import os
from pathlib import Path


def main() -> int:
    plan_path = Path(os.environ.get("AMQA_PLAN_PATH", "/tmp/amqa/qa-plan.json"))
    result_path = Path(os.environ.get("AMQA_RESULT_PATH", "/tmp/amqa/qa-result.json"))

    plan = json.loads(plan_path.read_text()) if plan_path.is_file() else {}
    result = json.loads(result_path.read_text()) if result_path.is_file() else {}

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    lines = [
        "## AMQA Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| CIS score | {plan.get('cis_score', 'n/a')} |",
        f"| Risk tier | {plan.get('risk_tier', 'n/a')} |",
        f"| Action | {result.get('action', 'n/a')} |",
        f"| Scenarios | {len(plan.get('scenarios', []))} |",
        f"| Mapped specs | {len(result.get('mapped_specs', []))} |",
        f"| Automation gap | {plan.get('automation_gap', False)} |",
        "",
    ]
    text = "\n".join(lines)
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fh:
            fh.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
