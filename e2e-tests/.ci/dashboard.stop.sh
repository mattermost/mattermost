#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

docker-compose -p dashboard -f dashboard/docker/docker-compose.yml -f dashboard.override.yml down
