#!/bin/bash

# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

set -euo pipefail

usage() {
    echo "Usage: scripts/update-versions.sh monorepo_version"
    exit 1
}

if [ $# -ne 1 ]; then
    usage
fi

version="$1"
if ! echo "$version" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+)?$'; then
    # The version provided appears to be invalid
    usage
fi

# These workspaces and packages within the monorepo all synchronize their versions with the web app and server
workspaces=(
    channels
    platform/client
    platform/mattermost-redux
    platform/types
)
packages=(
    @mattermost/client
    @mattermost/types
)

# Update any explicit dependencies between packages so that, for example, mattermost-redux@12.13.14 will depend on
# @mattermost/client@12.13.14
for workspace in "${workspaces[@]}"; do
    for package in "${packages[@]}"; do
        escaped_name="${package//\//\\/}"
        sed -i "" "s/\"${escaped_name}\": \"[0-9]*\.[0-9]*\.[0-9]*\",/\"${escaped_name}\": \"${version}\",/g" "${workspace}/package.json"
    done
done

# Update the versions of the packages in their package.jsons and apply the dependency updates made above to the
# package-lock.json
workspace_args=""
for workspace in "${workspaces[@]}"; do
    workspace_args="${workspace_args} -w ${workspace}"
done
npm version "${version}" --no-git-tag-version ${workspace_args}
