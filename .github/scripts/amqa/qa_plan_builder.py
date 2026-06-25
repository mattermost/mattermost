#!/usr/bin/env python3
"""Build structured qa-plan.v1.json from CodeRabbit signals, CIS, and TPA status."""

from __future__ import annotations

import re
from typing import Any

from cis_scorer import infer_blast_radius, risk_tier, score_paths
from parse_coderabbit import ChangeImpactLevel, CodeRabbitSignals


def _impact_to_tier(signals: CodeRabbitSignals, cis: int) -> str:
    if signals.change_impact == ChangeImpactLevel.HIGH:
        return "high"
    if signals.change_impact == ChangeImpactLevel.MEDIUM:
        return "medium"
    if signals.change_impact == ChangeImpactLevel.LOW:
        return "low"
    return risk_tier(cis)


def _negative_case(title: str, regression_risk: str) -> str:
    lower = (title + " " + regression_risk).lower()
    if "block" in lower or "denied" in lower or "allowed" in lower:
        return "Verify opposite path is rejected or allowed correctly"
    if "admin" in lower:
        return "Non-admin user cannot perform this action"
    if "login" in lower or "auth" in lower:
        return "Unauthenticated request is rejected"
    return "Verify failure/edge path returns expected error"


def _edition_for_files(changed_files: list[str]) -> list[str]:
    joined = "\n".join(changed_files).lower()
    editions = ["enterprise"]
    if "fips" in joined:
        editions.append("fips")
    return editions


def build_scenarios(
    pr_number: int,
    signals: CodeRabbitSignals,
    changed_files: list[str],
    mapped_specs: list[str],
    tpa_status: str,
) -> list[dict[str, Any]]:
    scenarios: list[dict[str, Any]] = []
    editions = _edition_for_files(changed_files)

    for i, item in enumerate(signals.parsed_scenarios, 1):
        sid = f"QA-{pr_number}-{i:02d}"
        scenarios.append({
            "id": sid,
            "title": item["title"],
            "type": "manual",
            "priority": "P1" if signals.change_impact == ChangeImpactLevel.HIGH else "P2",
            "preconditions": ["Mattermost running", "sysadmin logged in"],
            "steps": [item["title"]],
            "expected": ["Behavior matches QA Recommendation"],
            "negative_case": _negative_case(item["title"], signals.regression_risk),
            "mapped_specs": mapped_specs[:3],
            "edition": editions,
            "source": item.get("source", "coderabbit_qa_recommendation"),
        })

    if tpa_status == "failure" and not any(s.get("title", "").startswith("automation gap") for s in scenarios):
        scenarios.append({
            "id": f"QA-{pr_number}-gap",
            "title": "Automation gap — PR Test Analysis flagged missing/insufficient tests",
            "type": "e2e",
            "priority": "P1",
            "preconditions": ["Review Tests/analysis comment"],
            "steps": ["Run mapped specs locally", "Propose Playwright coverage if missing"],
            "expected": ["SDET reviews automation gap"],
            "negative_case": "",
            "mapped_specs": mapped_specs,
            "edition": editions,
            "source": "tpa_fail",
        })

    if signals.change_impact in (ChangeImpactLevel.MEDIUM, ChangeImpactLevel.HIGH) and scenarios:
        has_negative = any(s.get("negative_case") for s in scenarios)
        if not has_negative:
            scenarios[0]["negative_case"] = _negative_case(scenarios[0]["title"], signals.regression_risk)

    return scenarios[:12]


def build_qa_plan(
    pr_number: int,
    head_sha: str,
    signals: CodeRabbitSignals,
    changed_files: list[str],
    mapped_specs: list[str],
    tpa_status: str,
    coderabbit_dict: dict,
) -> dict[str, Any]:
    fallback_cis = score_paths(changed_files)
    cis = signals.cis_score() if signals.change_impact != ChangeImpactLevel.UNKNOWN else fallback_cis
    if signals.change_impact != ChangeImpactLevel.UNKNOWN:
        cis = max(cis, signals.cis_score())
        risk_source = "coderabbit"
    elif fallback_cis > 0:
        risk_source = "cis_fallback"
    else:
        risk_source = "blended"

    if tpa_status == "failure" and cis < 70:
        cis = min(100, cis + 15)
        risk_source = "blended"

    scenarios = build_scenarios(pr_number, signals, changed_files, mapped_specs, tpa_status)

    return {
        "schema_version": "1.0",
        "plan_id": f"QA-{pr_number}",
        "pr_number": pr_number,
        "head_sha": head_sha,
        "cis_score": cis,
        "risk_tier": _impact_to_tier(signals, cis),
        "risk_source": risk_source,
        "blast_radius": infer_blast_radius(changed_files),
        "coderabbit": coderabbit_dict,
        "tpa_status": tpa_status,
        "automation_gap": tpa_status == "failure",
        "scenarios": scenarios,
    }


def format_plan_comment(plan: dict, mapped_specs: list[str], pr_summary_has_qa: bool) -> str:
    lines = [
        "## Agentic QA Plan",
        "",
        f"**CIS:** {plan['cis_score']} ({plan['risk_tier']}) — source: `{plan['risk_source']}`",
        "",
    ]
    if plan.get("blast_radius"):
        lines.append(f"**Blast radius:** {', '.join(plan['blast_radius'])}")
        lines.append("")

    if plan["scenarios"]:
        lines.append("### Scenarios")
        for s in plan["scenarios"]:
            lines.append(f"- **{s['id']}** ({s['priority']}): {s['title']}")
            if s.get("negative_case"):
                lines.append(f"  - Negative: {s['negative_case']}")
        lines.append("")

    if mapped_specs:
        lines.append("### Run locally")
        for spec in mapped_specs[:5]:
            lines.append(f"`cd e2e-tests/playwright && npm run test -- {spec}`")
        lines.append("")

    if not pr_summary_has_qa and plan["scenarios"]:
        lines.append("### Suggested QA steps (paste into PR Summary)")
        for s in plan["scenarios"][:5]:
            if s.get("source") != "tpa_fail":
                lines.append(f"- {s['title']}")
        lines.append("")

    if plan.get("automation_gap"):
        lines.append("> **SDET review:** Tests/analysis reported insufficient coverage.")
        lines.append("")

    lines.append("<details><summary>qa-plan.json</summary>")
    lines.append("")
    lines.append("```json")
    import json
    lines.append(json.dumps(plan, indent=2))
    lines.append("```")
    lines.append("</details>")
    return "\n".join(lines)


def pr_summary_has_qa_steps(body: str) -> bool:
    if not body:
        return False
    summary = body.lower()
    if "qa step" in summary or "test plan" in summary or "manual qa" in summary:
        return True
    if re.search(r"####\s*summary[\s\S]{0,800}(verify|test|qa)", summary, re.I):
        return True
    return False
