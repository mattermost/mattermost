#!/usr/bin/env python3
"""Tests for CIS scorer and QA plan builder."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cis_scorer import infer_blast_radius, risk_tier, score_paths
from parse_coderabbit import ChangeImpactLevel, merge_signals
from qa_plan_builder import build_qa_plan


def test_cis_webapp_paths():
    score = score_paths(["webapp/channels/src/components/post/foo.tsx"])
    assert score >= 30


def test_cis_test_only_lower():
    score = score_paths(["server/channels/app/server_test.go"])
    assert score <= 30


def test_blast_radius_abac():
    radius = infer_blast_radius(["server/channels/api4/access_control.go"])
    assert "permissions" in radius


def test_build_plan_from_coderabbit():
    fixture = """
## Change Impact: 🔴 High
**Regression Risk:** ABAC join enforcement risk.
**QA Recommendation:** Run targeted manual smoke tests for: joining private ABAC teams (allowed vs blocked).
"""
    signals = merge_signals(fixture)
    plan = build_qa_plan(99, "abc", signals, ["server/channels/api4/team.go"], [], "success", {})
    assert plan["cis_score"] >= 70
    assert plan["scenarios"]
    assert plan["scenarios"][0]["id"] == "QA-99-01"
    assert plan["scenarios"][0].get("negative_case")


def test_tpa_fail_adds_gap():
    signals = merge_signals("## Change Impact: 🟢 Low\n**QA Recommendation:** No manual QA required.")
    plan = build_qa_plan(1, "abc", signals, ["webapp/foo.ts"], [], "failure", {})
    assert plan.get("automation_gap") is True
    assert any(s.get("source") == "tpa_fail" for s in plan["scenarios"])


def test_spec_map_from_ci_working_dir():
    from spec_mapper import DEFAULT_SPEC_MAP, map_changed_files, smoke_specs

    assert DEFAULT_SPEC_MAP.is_file(), f"missing spec map at {DEFAULT_SPEC_MAP}"
    mapped = map_changed_files(["webapp/channels/src/components/post/foo.tsx"])
    assert mapped, "expected post component prefix to map specs"
    assert smoke_specs(), "expected sev1 smoke specs"


if __name__ == "__main__":
    test_cis_webapp_paths()
    test_cis_test_only_lower()
    test_blast_radius_abac()
    test_build_plan_from_coderabbit()
    test_tpa_fail_adds_gap()
    test_spec_map_from_ci_working_dir()
    print("All qa plan tests passed")
