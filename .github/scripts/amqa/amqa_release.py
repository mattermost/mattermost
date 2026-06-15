#!/usr/bin/env python3
"""Generate Release Confidence Report from merged PR qa-result artifacts."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

from github_api import _headers, env_token

SEV1_SMOKE_SPECS = [
    "e2e-tests/playwright/specs/functional/channels/search/find_channels.spec.ts",
    "e2e-tests/playwright/specs/functional/system_console/permissions/team_access.spec.ts",
]


def merged_prs(token: str, repo: str, base_ref: str, head_sha: str) -> list[dict]:
    r = requests.get(
        f"https://api.github.com/repos/{repo}/compare/{base_ref}...{head_sha}",
        headers=_headers(token),
        timeout=(5, 60),
    )
    r.raise_for_status()
    pr_numbers = set()
    for commit in r.json().get("commits", []):
        sha = commit["sha"]
        cr = requests.get(
            f"https://api.github.com/repos/{repo}/commits/{sha}/pulls",
            headers={**_headers(token), "Accept": "application/vnd.github.cloak-preview+json"},
            timeout=(5, 60),
        )
        if cr.ok:
            for pr in cr.json():
                pr_numbers.add(pr["number"])
    return [{"number": n} for n in sorted(pr_numbers)]


def load_artifact_results(artifact_dir: Path) -> dict[int, dict]:
    results: dict[int, dict] = {}
    if not artifact_dir.is_dir():
        return results
    for path in artifact_dir.glob("qa-result-pr-*.json"):
        data = json.loads(path.read_text())
        results[int(data["pr_number"])] = data
    return results


def confidence_score(entries: list[dict]) -> float:
    if not entries:
        return 100.0
    high = [e for e in entries if e.get("impact") == "high"]
    if not high:
        return 90.0
    verified = sum(1 for e in high if e.get("pre_verified"))
    return round(40 * (verified / len(high)) + 50, 1)


def main() -> int:
    token = env_token()
    repo = os.environ.get("REPO", "mattermost/mattermost")
    base_ref = os.environ["BASE_REF"]
    head_sha = os.environ["HEAD_SHA"]
    rc_tag = os.environ.get("RC_TAG", head_sha[:12])
    artifact_dir = Path(os.environ.get("AMQA_ARTIFACT_DIR", "/tmp/amqa/release-artifacts"))

    entries: list[dict] = []
    stored = load_artifact_results(artifact_dir)

    if token:
        for pr in merged_prs(token, repo, base_ref, head_sha):
            n = pr["number"]
            result = stored.get(n, {})
            impact = result.get("coderabbit", {}).get("change_impact", "unknown")
            pre_verified = result.get("verified_at_pr") is True or result.get("overall") == "pass"
            entries.append({
                "pr_number": n,
                "impact": impact,
                "pre_verified": pre_verified,
                "needs_rc_gap_fill": impact == "high" and not pre_verified,
            })

    score = confidence_score(entries)
    recommendation = "proceed" if score >= 85 else "review" if score >= 70 else "hold"

    report = {
        "schema_version": "1.0",
        "rc_tag": rc_tag,
        "head_sha": head_sha,
        "base_ref": base_ref,
        "confidence_score": score,
        "recommendation": recommendation,
        "merged_prs": entries,
        "sev1_smoke_specs": SEV1_SMOKE_SPECS,
        "e2e_status": os.environ.get("E2E_STATUS", "parallel — see e2e-tests-on-release"),
    }

    out = Path(os.environ.get("AMQA_OUTPUT_DIR", "/tmp/amqa"))
    out.mkdir(parents=True, exist_ok=True)
    report_path = out / "release-confidence-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")

    summary = [
        "# Release Confidence Report",
        "",
        f"- **RC:** `{rc_tag}` @ `{head_sha[:12]}`",
        f"- **Confidence score:** {score}/100",
        f"- **Recommendation:** **{recommendation.upper()}**",
        "",
        "## Merged PR rollup",
        "",
        "| PR | Impact | Pre-verified at merge | RC gap-fill |",
        "|----|--------|----------------------|-------------|",
    ]
    for e in entries:
        summary.append(
            f"| #{e['pr_number']} | {e['impact']} | {'yes' if e['pre_verified'] else 'no'} | {'yes' if e['needs_rc_gap_fill'] else 'no'} |"
        )
    summary_path = out / "release-confidence-summary.md"
    summary_path.write_text("\n".join(summary) + "\n")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.write(f"confidence_score={score}\n")
            fh.write(f"recommendation={recommendation}\n")

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
