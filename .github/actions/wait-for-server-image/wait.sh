#!/usr/bin/env bash
# Waits until IMAGE (<namespace>/<name>:<tag> on Docker Hub) has a manifest.
# Fails only when the registry keeps answering "not found" until the deadline. A registry
# that cannot be reached warns and passes, so a Docker Hub outage leaves the workers' own
# pull (and its error) as it was.
set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-https://registry-1.docker.io}"
AUTH_URL="${AUTH_URL:-https://auth.docker.io}"
TIMEOUT_MINUTES="${TIMEOUT_MINUTES:-30}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"

if ! [[ "${IMAGE:-}" =~ ^([a-z0-9._-]+/[a-z0-9._-]+):([A-Za-z0-9._-]+)$ ]]; then
  echo "::error::wait-for-server-image: '${IMAGE:-}' is not <namespace>/<name>:<tag>"
  exit 1
fi
REPOSITORY="${BASH_REMATCH[1]}"
TAG="${BASH_REMATCH[2]}"
ACCEPT="application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json"

# Prints the registry's HTTP status for the manifest, or 000 when it cannot be reached.
# A HEAD request does not count against Docker Hub's pull rate limit.
probe() {
  local token code
  token=$(curl -fsS --max-time 20 "${AUTH_URL}/token?service=registry.docker.io&scope=repository:${REPOSITORY}:pull" | jq -er .token) || {
    echo 000
    return
  }
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -I \
    -H "Authorization: Bearer ${token}" -H "Accept: ${ACCEPT}" \
    "${REGISTRY_URL}/v2/${REPOSITORY}/manifests/${TAG}") || code=000
  echo "$code"
}

deadline=$(($(date +%s) + TIMEOUT_MINUTES * 60))
last_answer=""
while :; do
  code=$(probe)
  case "$code" in
    200)
      echo "${IMAGE} is published."
      exit 0
      ;;
    404)
      last_answer=missing
      echo "${IMAGE} is not published yet."
      ;;
    *)
      last_answer=""
      echo "Docker Hub answered ${code} for ${IMAGE}."
      ;;
  esac
  [ "$(date +%s)" -lt "$deadline" ] || break
  sleep "$INTERVAL_SECONDS"
done

if [ "$last_answer" = missing ]; then
  message="${IMAGE} was still not published after ${TIMEOUT_MINUTES} minutes. The image build for this commit did not push it; re-running E2E will not help until it is pushed."
  echo "::error title=Server image not published::${message}"
  echo "### Server image not published"$'\n\n'"${message}" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 1
fi
echo "::warning title=Server image not verified::Docker Hub could not be checked for ${IMAGE}; the workers will try to pull it."
