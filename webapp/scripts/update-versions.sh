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
    platform/shared
    platform/types
)
packages=(
    @mattermost/client
    @mattermost/shared
    @mattermost/types
)

packages_json=$(printf '%s\n' "${packages[@]}" | jq -R . | jq -s .)
workspaces_json=$(printf '%s\n' "${workspaces[@]}" | jq -R . | jq -s .)

# In each package's package.json, update the version of that package and any of the other workspace packages to match
for workspace in "${workspaces[@]}"; do
    pkg_json="${workspace}/package.json"
    jq --arg version "$version" --argjson packages "$packages_json" '
        .version = $version |
        reduce $packages[] as $pkg (.;

            reduce ["dependencies", "devDependencies", "peerDependencies"][] as $section (.;
                if .[$section][$pkg] then .[$section][$pkg] = $version else . end
            )
        )
    ' "$pkg_json" > "${pkg_json}.tmp" && mv "${pkg_json}.tmp" "$pkg_json"
done

# Then go through the package-lock.json and make those same changes
jq --arg version "$version" --argjson packages "$packages_json" --argjson workspaces "$workspaces_json" '
    reduce $workspaces[] as $ws (.;
        .packages[$ws].version = $version |
        reduce $packages[] as $pkg (.;
            reduce ["dependencies", "devDependencies", "peerDependencies"][] as $section (.;
                if .packages[$ws][$section][$pkg] then .packages[$ws][$section][$pkg] = $version else . end
            )
        )
    )
' package-lock.json > package-lock.json.tmp && mv package-lock.json.tmp package-lock.json
