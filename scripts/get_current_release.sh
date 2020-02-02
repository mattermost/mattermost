#!/usr/bin/env bash
# Time: 2020-01-29 14:49:24
# Author: https://gist.github.com/lukechilds/a83e1d7127b78fef38c2914c4ececc3c
get_latest_release() {
  curl --silent "https://api.github.com/repos/$1/releases/latest" | # Get latest release from GitHub api
    grep '"tag_name":' |                                            # Get tag line
    sed -E 's/.*"([^"]+)".*/\1/'                                    # Pluck JSON value
}

# Usage
# $ get_latest_release "creationix/nvm"
# v0.31.4
# Assume we are in a git dir
BRANCH=$(git rev-parse --abbrev-ref HEAD) # | sed '/d/release-'
echo $BRANCH
#get_latest_release $1
