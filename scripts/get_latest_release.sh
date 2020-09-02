#!/usr/bin/env bash
# $1 - repo to check against
# $2 - release branch pattern to match
# This script will check if the current repo has version pattern $2 ('release-5.20') in the branch name.
# If it does it will check for a matching release version in the $1 repo and if found check for the newest dot version.
# If the branch pattern isn't found than it will default to the newest release available in $1.
REPO_TO_USE=$1
BRANCH_TO_USE=$2

LATEST_REL=$(curl --silent "https://api.github.com/repos/$REPO_TO_USE/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
DRAFT=$(curl --silent "https://api.github.com/repos/$REPO_TO_USE/releases/latest" | grep '"draft":' | sed -E 's/.*: ([^,]+).*/\1/')
PRERELEASE=$(curl --silent "https://api.github.com/repos/$REPO_TO_USE/releases" | grep '"prerelease":' | sed -E 's/.*: ([^,]+).*/\1/')

# Check if this is a release branch
THIS_BRANCH=$(git rev-parse --abbrev-ref HEAD)
#THIS_BRANCH="release-5.27"# - Used to test release logic on a non release branch

if [[ "$THIS_BRANCH" =~ $BRANCH_TO_USE || $DRAFT =~ "true" ]]; then
    VERSION_REL=${THIS_BRANCH//$BRANCH_TO_USE/v}
    REL_TO_USE=$(curl --silent "https://api.github.com/repos/$REPO_TO_USE/releases" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed -n "/$VERSION_REL/p" | sort -rV | head -n 1)
elif [[ "$THIS_BRANCH"  =~ "master" ]]; then
    # Get the latest release even if its a pre-release
    REL_TO_USE=$(curl --silent "https://api.github.com/repos/$REPO_TO_USE/releases" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sort -rV | head -n 1)
else
    REL_TO_USE=$LATEST_REL
fi

echo "$REL_TO_USE"
