#!/usr/bin/env bash
# Builds a server image that adds this checkout's webapp and/or server to a prebuilt one, so a
# product fix is tested against the same build that failed and nothing else differs.
#
# usage: e2e-autofix-image.sh <from image> <new tag> webapp|server [webapp|server]
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "usage: $0 <from image> <new tag> webapp|server [webapp|server]" >&2
  exit 2
fi
from=$1
tag=$2
shift 2
root=$(git rev-parse --show-toplevel)
ctx=$(mktemp -d)
trap 'rm -rf "$ctx"' EXIT
echo "FROM $from" > "$ctx/Dockerfile"

for part in "$@"; do
  case $part in
    webapp)
      (cd "$root/webapp" && make dist)
      cp -RL "$root/webapp/channels/dist" "$ctx/client"
      echo 'COPY --chown=2000:2000 client/ /mattermost/client/' >> "$ctx/Dockerfile"
      ;;
    server)
      # The binary links enterprise: it must be the commit the image was built with (<mm>_<enterprise> tag).
      enterprise=$(sed -n 's/^BUILD_ENTERPRISE_DIR *:= *//p' "$root/server/config.override.mk" 2>/dev/null || true)
      enterprise=${enterprise:-$root/../enterprise}
      want=${from##*_}
      have=$(git -C "$enterprise" rev-parse HEAD 2>/dev/null) || { echo "no enterprise checkout at $enterprise" >&2; exit 1; }
      if [[ $have != "$want"* ]]; then
        echo "enterprise is at ${have:0:7} but $from was built with $want: check out $want in $enterprise" >&2
        exit 1
      fi
      (cd "$root/server" && make build-linux-amd64)
      bin=$root/server/bin/mattermost
      [ -x "$bin" ] || bin=$root/server/bin/linux_amd64/mattermost
      cp "$bin" "$ctx/mattermost"
      echo 'COPY --chown=2000:2000 mattermost /mattermost/bin/mattermost' >> "$ctx/Dockerfile"
      ;;
    *)
      echo "unknown part '$part': use webapp or server" >&2
      exit 2
      ;;
  esac
done

docker build -t "$tag" "$ctx"
