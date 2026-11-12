#!/usr/bin/env bash
# Builds the test plugin into the layout the testhelper expects, <out>/plugin.json
# and <out>/dist/<id>.tar.gz. Run the integration tests with MM_TEST_PLUGIN_DIR set to
# the absolute path of <out>.
set -euo pipefail

out=${1:?usage: build.sh <out>}
src=$(cd "$(dirname "$0")" && pwd)
id=$(jq -r .id "$src/plugin.json")
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

# A stale bundle left in dist/ would make the testhelper find more than one.
rm -rf "$out/dist"
mkdir -p "$stage/$id/server/dist" "$out/dist"
cp "$src/plugin.json" "$stage/$id/"
cp "$src/plugin.json" "$out/"
for arch in amd64 arm64; do
	(cd "$src" && CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -o "$stage/$id/server/dist/plugin-linux-$arch" .)
done
# COPYFILE_DISABLE keeps macOS tar from adding ._* entries next to the plugin directory.
COPYFILE_DISABLE=1 tar -C "$stage" -czf "$out/dist/$id.tar.gz" "$id"
