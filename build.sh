#!/bin/bash

CDIR=$(cd `dirname $0` && pwd)
cd $CDIR

ORG_PATH="github.com/mattermost"
REPO_PATH="${ORG_PATH}/platform"

eval $(go env)
export GOPATH=${PWD}/gopath

if [ ! -h gopath/src/${REPO_PATH} ]; then
  mkdir -p gopath/src/${ORG_PATH}
  ln -s ../../../.. gopath/src/${REPO_PATH} || exit 255
fi

cd gopath/src/${REPO_PATH} && make package
