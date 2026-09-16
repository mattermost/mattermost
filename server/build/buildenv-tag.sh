#!/usr/bin/env bash
# Prints the tag identifying the mattermost-build-server image, e.g.
# "go1.26.7-node24.11.1". The image bakes in both toolchains, so the tag names
# both. CI resolves this once and propagates it as BUILD_SERVER_TAG.
#
# The tag comes from the Dockerfiles, since those are what actually determine
# the image, and they are checked against .go-version and .nvmrc so the pins
# cannot drift apart unnoticed.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

DOCKERFILES=(server/build/Dockerfile.buildenv server/build/Dockerfile.buildenv-fips)

fail() {
    echo "$*" >&2
    exit 1
}

# A pin may be more specific than its source of truth: the FIPS base image
# carries a fourth component, 1.26.7.1 for Go 1.26.7.
satisfies() {
    [[ "$1" == "$2" || "$1" == "$2."* ]]
}

go_version=$(cat server/.go-version)
node_spec=$(cat .nvmrc)

node_version=""
for dockerfile in "${DOCKERFILES[@]}"; do
    from=$(awk '$1 == "FROM" { print $2; exit }' "${dockerfile}")
    [[ -n "${from}" ]] || fail "${dockerfile}: no FROM"
    base_version="${from#*:}"
    base_version="${base_version%%@*}"
    base_version="${base_version%-*}"
    satisfies "${base_version}" "${go_version}" ||
        fail "${dockerfile}: base image is Go ${base_version}, but server/.go-version says ${go_version}"

    version=$(awk -F= '$1 == "ARG NODE_VERSION" { print $2; exit }' "${dockerfile}")
    [[ -n "${version}" ]] || fail "${dockerfile}: no ARG NODE_VERSION"
    satisfies "${version}" "${node_spec}" ||
        fail "${dockerfile}: ARG NODE_VERSION is ${version}, but .nvmrc says ${node_spec}"

    # A single tag covers both images, so they have to agree.
    if [[ -n "${node_version}" && "${version}" != "${node_version}" ]]; then
        fail "${DOCKERFILES[0]} has Node ${node_version} but ${dockerfile} has ${version}"
    fi
    node_version="${version}"
done

tag="go${go_version}-node${node_version}"

# CI interpolates this tag into shell commands and workflow files, so refuse
# anything that isn't a well-formed Docker tag.
[[ "${tag}" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || fail "invalid tag: ${tag}"

echo "${tag}"
