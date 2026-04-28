#!/usr/bin/env bash
#
# Compute branch freshness for a single PR (BASE_SHA vs HEAD_SHA in the upstream
# repo) and emit the result on stdout as a single JSON object. Exits 0 if the
# branch is within thresholds, 1 if not.
#
# Required env:
#   BASE_SHA            base branch SHA (typically pull_request.base.sha).
#   HEAD_SHA            PR head SHA (typically pull_request.head.sha).
#   REPO                "owner/repo".
#   GH_TOKEN            token for `gh api` (read access is enough).
#
# Optional env (thresholds; defaults are the source of truth):
#   MAX_COMMITS_BEHIND  more commits behind master = fail (default 30).
#   MAX_AGE_DAYS        merge-base older than this = fail (default 7).

set -euo pipefail

: "${BASE_SHA:?required}"
: "${HEAD_SHA:?required}"
: "${REPO:?required}"
: "${GH_TOKEN:?required}"
: "${MAX_COMMITS_BEHIND:=30}"
: "${MAX_AGE_DAYS:=7}"

cmp=$(gh api "repos/${REPO}/compare/${BASE_SHA}...${HEAD_SHA}" \
  --jq '{behind: .behind_by, mb_date: .merge_base_commit.commit.committer.date}')

commits_behind=$(jq -r '.behind' <<<"$cmp")
mb_date=$(jq -r '.mb_date' <<<"$cmp")
mb_ts=$(date -u -d "$mb_date" +%s)
now_ts=$(date -u +%s)
age_seconds=$(( now_ts - mb_ts ))
age_days=$(( age_seconds / 86400 ))
max_age_seconds=$(( MAX_AGE_DAYS * 86400 ))

conclusion=success
title="${commits_behind} commits / ${age_days} days behind master"
if [ "$commits_behind" -gt "$MAX_COMMITS_BEHIND" ] \
    || [ "$age_seconds" -gt "$max_age_seconds" ]; then
  conclusion=failure
  title="Branch too far behind master: ${commits_behind} commits, ${age_days} days"
fi

summary="Commits behind master: ${commits_behind} (max ${MAX_COMMITS_BEHIND}). Merge-base age: ${age_days} days (max ${MAX_AGE_DAYS})."

printf "%s\n" "$title" >&2

jq -nc \
  --arg conclusion "$conclusion" \
  --arg title "$title" \
  --arg summary "$summary" \
  --argjson commits_behind "$commits_behind" \
  --argjson age_days "$age_days" \
  '{conclusion: $conclusion, title: $title, summary: $summary, commits_behind: $commits_behind, age_days: $age_days}'

if [ "$conclusion" = "failure" ]; then
  printf "::error::%s. Rebase or merge master into your branch.\n" "$title" >&2
  exit 1
fi
