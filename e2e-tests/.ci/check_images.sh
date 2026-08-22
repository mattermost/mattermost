#!/bin/bash
# Checks that each image argument is pullable (via `docker manifest inspect`),
# retrying with backoff on transient errors. Checks every image before
# failing, and prints a per-image pass/fail summary so it's obvious at a
# glance which image(s) are the actual problem.
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

RETRIES="${CHECK_IMAGES_RETRIES:-30}"
INTERVAL="${CHECK_IMAGES_INTERVAL:-30}"

classify_error() {
  local OUTPUT="$1"
  if grep -qiE 'toomanyrequests|429' <<<"$OUTPUT"; then
    echo "rate-limited by registry (429/toomanyrequests)"
  elif grep -qiE 'manifest unknown|no such manifest|not found' <<<"$OUTPUT"; then
    echo "image/tag not published yet (manifest unknown)"
  elif grep -qiE 'timeout|connection reset|i/o timeout|no such host|EOF|TLS handshake' <<<"$OUTPUT"; then
    echo "transient network/connection error"
  else
    echo "unrecognized error"
  fi
}

# Sets LAST_REASON on failure, for the final summary table.
check_image_available() {
  local IMAGE="$1" ATTEMPT=0 OUTPUT
  echo "::group::Checking image: $IMAGE"
  until OUTPUT=$(docker manifest inspect "$IMAGE" 2>&1); do
    ATTEMPT=$((ATTEMPT + 1))
    LAST_REASON=$(classify_error "$OUTPUT")
    if [ "$ATTEMPT" -ge "$RETRIES" ]; then
      mme2e_log "[$IMAGE] FAILED after $ATTEMPT attempts: $LAST_REASON"
      echo "$OUTPUT"
      echo "::endgroup::"
      return 1
    fi
    mme2e_log "[$IMAGE] not available yet ($LAST_REASON); retry $ATTEMPT/$RETRIES in ${INTERVAL}s"
    sleep "$INTERVAL"
  done
  mme2e_log "[$IMAGE] OK"
  echo "::endgroup::"
}

if [ "$#" -eq 0 ]; then
  mme2e_log "No images given to check" >&2
  exit 2
fi

mme2e_log "Checking availability of ${#} image(s): $*"

declare -a RESULT_LINES=()
FAILED_COUNT=0
for IMAGE in "$@"; do
  LAST_REASON=""
  if check_image_available "$IMAGE"; then
    RESULT_LINES+=("  PASS  $IMAGE")
  else
    RESULT_LINES+=("  FAIL  $IMAGE  (${LAST_REASON})")
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "::error::Image not available: $IMAGE (${LAST_REASON})"
  fi
done

mme2e_log "Image availability summary:"
printf '%s\n' "${RESULT_LINES[@]}"

if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "::error::${FAILED_COUNT}/$# image(s) never became available"
  exit 1
fi
