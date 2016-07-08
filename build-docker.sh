#!/bin/bash -e

# BUILD_NUMBER=3.1.0 ./build-docker.sh

CDIR=$(cd `dirname $0` && pwd)

docker run --rm -v "$CDIR":/opt/platform -e BUILD_NUMBER=$BUILD_NUMBER -u $(id -u):$(id -g) mattermost/build-env /bin/bash -c "cd /opt/platform && ./build.sh"
