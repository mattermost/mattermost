#!/usr/bin/env bash
# Sends open PRs labeled $BABYSIT_LABEL that conflict with $BASE_REF to the
# Cursor automation webhook. Used by .github/workflows/conflicts-babysit.yml.
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${WEBHOOK_URL:?}" "${WEBHOOK_TOKEN:?}"
LABEL="${BABYSIT_LABEL:-AI/ConflictsBabysit}"
BASE_REF="${BASE_REF:-master}"
BASE_SHA="${BASE_SHA:-}"
RUN_URL="${RUN_URL:-}"
INITIAL_DELAY_SECONDS="${INITIAL_DELAY_SECONDS:-15}"
UNKNOWN_MAX_ATTEMPTS="${UNKNOWN_MAX_ATTEMPTS:-5}"
UNKNOWN_BACKOFF_SECONDS="${UNKNOWN_BACKOFF_SECONDS:-5}"
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/null}"
OWNER="${GITHUB_REPOSITORY%%/*}"
REPO="${GITHUB_REPOSITORY#*/}"

search_prs() {
  # shellcheck disable=SC2016
  gh api graphql --paginate \
    -f searchQuery="repo:${GITHUB_REPOSITORY} is:pr is:open base:${BASE_REF} label:\"${LABEL}\"" \
    -f query='
      query($searchQuery: String!, $endCursor: String) {
        search(query: $searchQuery, type: ISSUE, first: 50, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            ... on PullRequest {
              number url mergeable headRefName headRefOid isCrossRepository
            }
          }
        }
      }' \
    --jq '.data.search.nodes[] | [.number, .url, .headRefName, .headRefOid, .mergeable, .isCrossRepository] | @tsv'
}

fetch_mergeable() {
  # shellcheck disable=SC2016
  gh api graphql \
    -f owner="$OWNER" -f name="$REPO" -F number="$1" \
    -f query='
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) { mergeable }
        }
      }' \
    --jq '.data.repository.pullRequest.mergeable' || echo UNKNOWN
}

dispatch() {
  local number="$1" payload
  payload=$(jq -n \
    --arg repository "$GITHUB_REPOSITORY" \
    --argjson pr_number "$number" \
    --arg pr_url "${url[$number]}" \
    --arg head_ref "${head_ref[$number]}" \
    --arg head_sha "${head_sha[$number]}" \
    --arg base_ref "$BASE_REF" \
    --arg base_sha "$BASE_SHA" \
    --arg label "$LABEL" \
    --arg run_url "$RUN_URL" \
    '$ARGS.named')
  curl -fsS --retry 3 --retry-all-errors --max-time 30 -o /dev/null \
    -X POST \
    -H "Authorization: Bearer ${WEBHOOK_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$payload" \
    "$WEBHOOK_URL"
}

declare -A url head_ref head_sha state action
numbers=()
unknown=()

sleep "$INITIAL_DELAY_SECONDS"

if ! candidates=$(search_prs); then
  echo "::warning::Searching for PRs labeled ${LABEL} failed; will retry on the next ${BASE_REF} merge."
  exit 0
fi
while IFS=$'\t' read -r number pr_url ref sha mergeable cross_repo; do
  [ -n "$number" ] || continue
  numbers+=("$number")
  url[$number]="$pr_url"
  head_ref[$number]="$ref"
  head_sha[$number]="$sha"
  state[$number]="$mergeable"
  if [ "$cross_repo" = "true" ]; then
    action[$number]="skipped (fork)"
  elif [ "$mergeable" = "UNKNOWN" ]; then
    unknown+=("$number")
  fi
done <<< "$candidates"

for ((attempt = 1; attempt < UNKNOWN_MAX_ATTEMPTS && ${#unknown[@]} > 0; attempt++)); do
  sleep $((attempt * UNKNOWN_BACKOFF_SECONDS))
  still_unknown=()
  for number in "${unknown[@]}"; do
    state[$number]=$(fetch_mergeable "$number")
    if [ "${state[$number]}" = "UNKNOWN" ]; then
      still_unknown+=("$number")
    fi
  done
  unknown=("${still_unknown[@]}")
done

failures=0
for number in "${numbers[@]}"; do
  [ -z "${action[$number]:-}" ] || continue
  case "${state[$number]}" in
    CONFLICTING)
      if dispatch "$number"; then
        action[$number]="dispatched"
      else
        action[$number]="failed"
        failures=$((failures + 1))
        echo "::warning::Webhook call failed for #${number}; will retry on the next ${BASE_REF} merge."
      fi
      ;;
    UNKNOWN)
      action[$number]="unknown"
      echo "::warning::Mergeable state for #${number} still UNKNOWN after ${UNKNOWN_MAX_ATTEMPTS} attempts; will retry on the next ${BASE_REF} merge."
      ;;
    *)
      action[$number]="skipped"
      ;;
  esac
done

{
  echo "## Conflicts babysit"
  echo ""
  if [ "${#numbers[@]}" -eq 0 ]; then
    echo "No open PRs labeled \`${LABEL}\` targeting \`${BASE_REF}\`."
  else
    echo "| PR | Mergeable | Action |"
    echo "| --- | --- | --- |"
    for number in "${numbers[@]}"; do
      echo "| [#${number}](${url[$number]}) | ${state[$number]} | ${action[$number]} |"
    done
  fi
} | tee -a "$SUMMARY_FILE"

if [ "$failures" -gt 0 ]; then
  echo "::warning::${failures} webhook call(s) failed."
fi
