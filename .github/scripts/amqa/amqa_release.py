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


def merged_prs(token: str, repo: str, base_ref: str, head_sha: str) -> list[int]:
    r = requests.get(
        f"https://api.github.com/repos/{repo}/compare/{base_ref}...{head_sha}",
        headers=_headers(token),
        timeout=(5, 60),
    )
    r.raise_for_status()
    pr_numbers: set[int] = set()
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
    return sorted(pr_numbers)


def load_artifact_results(artifact_dir: Path) -> dict[int, dict]:
    results: dict[int, dict] = {}
    if not artifact_dir.is_dir():
        return results
    for path in artifact_dir.glob("qa-result-pr-*.json"):
        data = json.loads(path.read_text())
        results[int(data["pr_number"])] = data
    return results


def has_migrations(token: str, repo: str, base_ref: str, head_sha: str) -> bool:
    r = requests.get(
        f"https://api.github.com/repos/{repo}/compare/{base_ref}...{head_sha}",
        headers=_headers(token),
        timeout=(5, 60),
    )
    if not r.ok:
        return False
    for f in r.json().get("files", []):
        if f.get("filename", "").endswith(".up.sql"):
            return True
    return False


def confidence_score(entries: list[dict]) -> float:
    if not entries:
        return 100.0
    high = [e for e in entries if e.get("impact") in ("high", "critical")]
    if not high:
        return 90.0
    verified = sum(1 for e in high if e.get("pre_verified"))
    return round(40 * (verified / len(high)) + 50, 1)


def recommendation(score: float, open_defects: int) -> str:
    if open_defects > 0:
        return "hold"
    if score >= 85:
        return "proceed"
    if score >= 70:
        return "review"
    return "hold"


def post_webhook(url: str, text: str) -> None:
    if not url:
        return
    requests.post(url, json={"text": text}, timeout=30)


def main() -> int:
    token = env_token()
    repo = os.environ.get("REPO", "mattermost/mattermost")
    base_ref = os.environ["BASE_REF"]
    head_sha = os.environ["HEAD_SHA"]
    rc_tag = os.environ.get("RC_TAG", head_sha[:12])
    image_tag = os.environ.get("SERVER_IMAGE_TAG", rc_tag)
    artifact_dir = Path(os.environ.get("AMQA_ARTIFACT_DIR", "/tmp/amqa/release-artifacts"))

    entries: list[dict] = []
    stored = load_artifact_results(artifact_dir)
    migration_in_release = has_migrations(token, repo, base_ref, head_sha) if token else False

    if token:
        for n in merged_prs(token, repo, base_ref, head_sha):
            result = stored.get(n, {})
            cr = result.get("coderabbit", {})
            impact = cr.get("change_impact", "unknown")
            pre_verified = result.get("verified_at_pr") is True or result.get("overall") == "pass"
            entries.append({
                "pr_number": n,
                "impact": impact,
                "pre_verified": pre_verified,
                "needs_rc_gap_fill": impact in ("high", "critical") and not pre_verified,
            })

    score = confidence_score(entries)
    open_defects = 0
    rec = recommendation(score, open_defects)

    report = {
        "schema_version": "1.0",
        "rc_tag": rc_tag,
        "server_image_tag": image_tag,
        "head_sha": head_sha,
        "base_ref": base_ref,
        "confidence_score": score,
        "recommendation": rec,
        "merged_prs": entries,
        "migration_in_release": migration_in_release,
        "sev1_smoke_specs": SEV1_SMOKE_SPECS,
        "e2e_status": os.environ.get("E2E_STATUS", "parallel"),
        "open_defects": open_defects,
        "waivers": [],
        "go_no_go": rec != "hold",
    }

    out = Path(os.environ.get("AMQA_OUTPUT_DIR", "/tmp/amqa"))
    out.mkdir(parents=True, exist_ok=True)
    (out / "release-confidence-report.json").write_text(json.dumps(report, indent=2) + "\n")

    summary = [
        "# Release Confidence Report",
        "",
        f"- **RC image:** `{image_tag}`",
        f"- **SHA:** `{head_sha[:12]}`",
        f"- **Confidence score:** {score}/100",
        f"- **Recommendation:** **{rec.upper()}**",
        f"- **Migration in release:** {migration_in_release}",
        "",
        "## Merged PR rollup",
        "",
        "| PR | Impact | Pre-verified | RC gap-fill |",
        "|----|--------|--------------|-------------|",
    ]
    for e in entries:
        summary.append(
            f"| #{e['pr_number']} | {e['impact']} | {'yes' if e['pre_verified'] else 'no'} | {'yes' if e['needs_rc_gap_fill'] else 'no'} |"
        )
    summary.extend([
        "",
        "## Sev-1 smoke (RC gap-fill if not pre-verified)",
        "",
    ])
    for spec in SEV1_SMOKE_SPECS:
        summary.append(f"- `{spec}`")

    (out / "release-confidence-summary.md").write_text("\n".join(summary) + "\n")

    webhook = os.environ.get("WEBHOOK_URL", "")
    post_webhook(webhook, f"#agentic-qa Release `{rc_tag}` confidence {score}/100 — **{rec}**")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.write(f"confidence_score={score}\n")
            fh.write(f"recommendation={rec}\n")

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
