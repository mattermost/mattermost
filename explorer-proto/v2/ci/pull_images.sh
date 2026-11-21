#!/usr/bin/env bash
# Pulls the server image and PostgreSQL by digest and fails closed unless each pulled image carries exactly the digest
# it was asked for. The infra scripts never pull, so this is the only place an image is downloaded.
#   pull_images.sh [--dry-run]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
source "$INFRA_SCRIPTS/lib.sh"
parse_dry_run "$@"

if [ "$PG_IMAGE" != "$EXPECTED_PG_IMAGE" ]; then
    fail "the PostgreSQL pin in infra/scripts/lib.sh differs from the one this workflow expects"
fi

image_ref="$(fact image.ref)"
image_digest="$(fact image.digest)"

pull_and_verify() {
    local ref=$1 digest=$2
    act docker pull --platform linux/amd64 "$ref"
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi
    if ! docker image inspect --format '{{json .RepoDigests}}' "$ref" | grep -qF "@${digest}\""; then
        fail "a pulled image does not carry the digest it was pinned to"
    fi
    if [ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$ref")" != linux/amd64 ]; then
        fail "a pulled image is not linux/amd64"
    fi
}

pull_and_verify "$image_ref" "$image_digest"
pull_and_verify "$PG_IMAGE" "${PG_IMAGE##*@}"
if [ "$DRY_RUN" = true ]; then
    echo "images: dry run, nothing pulled (server ${image_digest}, postgres ${PG_IMAGE##*@})"
else
    echo "images: pulled and verified by digest (server ${image_digest}, postgres ${PG_IMAGE##*@})"
fi
