#!/usr/bin/env bash
set -xe

if [[ "$(basename "$PWD")" != "mattermost-server" ]]; then
  echo "please run this script from the root project folder of mattermost-server with ./scripts/mmctl-dev.sh"
  exit 1
fi

if [ ! -d "../mmctl" ]; then
  echo "please clone mmctl as a companion repository on the same level next to mattermost-server (git@github.com:mattermost/mmctl.git)"
  exit 1
fi

cd ../mmctl
make build
cd -

cp ../mmctl/mmctl bin/mmctl

./bin/mmctl version
