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
  --json number,headRefOid,baseRefOid,headRefName > "$prs_json"

# TODO: remove this filter once the check has been validated end-to-end.
branch_filter="${BRANCH_PREFIX_FILTER:-}"

echo "Re-evaluating $(jq length "$prs_json") open PRs${branch_filter:+ matching prefix '${branch_filter}'}."

jq -c '.[]' "$prs_json" | while read -r pr; do
  number=$(jq -r '.number' <<<"$pr")
  head_sha=$(jq -r '.headRefOid' <<<"$pr")
  base_sha=$(jq -r '.baseRefOid' <<<"$pr")
  head_ref=$(jq -r '.headRefName' <<<"$pr")

  if [ -n "$branch_filter" ] && [[ "$head_ref" != "${branch_filter}"* ]]; then
    continue
  fi

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

  existing_id=$(gh api "repos/${REPO}/check-runs" \
      --method GET \
      --field name='branch-freshness' \
      --field head_sha="$head_sha" \
      --jq '.check_runs[0].id // empty' 2>/dev/null || true)

  if [ -n "$existing_id" ]; then
    method=PATCH
    endpoint="repos/${REPO}/check-runs/${existing_id}"
  else
    method=POST
    endpoint="repos/${REPO}/check-runs"
  fi

  extra_fields=()
  if [ "$method" = POST ]; then
    extra_fields=(--field name='branch-freshness' --field head_sha="$head_sha")
  fi

  if ! gh api "$endpoint" \
      --method "$method" \
      "${extra_fields[@]}" \
      --field status='completed' \
      --field conclusion="$conclusion" \
      --field "output[title]=$title" \
      --field "output[summary]=$summary" >/dev/null; then
    printf "PR #%s: failed to update check run, continuing.\n" "$number" >&2
    continue
  fi
done
