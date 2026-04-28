#!/usr/bin/env bash
#
# Re-evaluate "branch freshness" for every open PR targeting master and post a
# Check Run named "branch-freshness" to each PR's head SHA. Designed to run from
# a scheduled GitHub Actions workflow so the threshold keeps applying after the
# initial pull_request check has gone green.
#
# Required env:
#   REPO                "owner/repo".
#   GH_TOKEN            token with checks:write and pull-requests:read.
#
# Thresholds (MAX_COMMITS_BEHIND, MAX_AGE_DAYS) are owned by
# branch-freshness-check.sh; this script just passes them through if set.

set -euo pipefail

: "${REPO:?required}"
: "${GH_TOKEN:?required}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
check="${script_dir}/branch-freshness-check.sh"

prs_json=$(mktemp)
trap 'rm -f "$prs_json"' EXIT

gh pr list --repo "$REPO" --base master --state open --limit 1000 \
  --json number,headRefOid,baseRefOid > "$prs_json"

echo "Re-evaluating $(jq length "$prs_json") open PRs."

jq -c '.[]' "$prs_json" | while read -r pr; do
  number=$(jq -r '.number' <<<"$pr")
  head_sha=$(jq -r '.headRefOid' <<<"$pr")
  base_sha=$(jq -r '.baseRefOid' <<<"$pr")

  # branch-freshness-check.sh exits 1 when the branch is too far behind, but
  # still prints a JSON result to stdout. Treat empty output as a real error.
  if ! result=$(BASE_SHA="$base_sha" HEAD_SHA="$head_sha" bash "$check"); then
    if [ -z "$result" ]; then
      printf "PR #%s: check script errored, skipping.\n" "$number"
      continue
    fi
  fi

  conclusion=$(jq -r '.conclusion' <<<"$result")
  title=$(jq -r '.title' <<<"$result")
  summary=$(jq -r '.summary' <<<"$result")

  printf "PR #%s @ %s -> %s (%s)\n" "$number" "$head_sha" "$conclusion" "$title"

  gh api "repos/${REPO}/check-runs" \
    --method POST \
    --field name='branch-freshness' \
    --field head_sha="$head_sha" \
    --field status='completed' \
    --field conclusion="$conclusion" \
    --field "output[title]=$title" \
    --field "output[summary]=$summary" >/dev/null
done
