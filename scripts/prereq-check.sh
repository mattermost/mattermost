#!/bin/bash
check_version()
{
    local version=$1 check=$2
    local winner=$(echo -e "$version\n$check" | sed '/^$/d' | sort -t. -s -k 1,1nr -k 2,2nr -k 3,3nr -k 4,4nr | head -1)
    [[ "$winner" = "$version" ]] && return 0
    return 1
}

check_prereq()
{
    if [ ! $# == 3 ]; then
        echo "Unable to determine '$1' version! Ensure that '$1' is in your path and try again." && exit 1
    fi

    local dependency=$1 required_version=$2 installed_version=$3

    type $dependency >/dev/null 2>&1 || { echo >&2 "Mattermost requires '$dependency' but it doesn't appear to be installed.  Aborting."; exit 1; }

    if check_version $installed_version $required_version; then
        echo "$dependency minimum requirement met. Required: $required_version, Found: $installed_version"
    else
        echo "WARNING! Mattermost did not find the minimum supported version of '$dependency' installed. Required: $required_version, Found: $installed_version"
        echo "We highly recommend stopping installation and updating dependencies before continuing"
        read -p "Enter Y to continue anyway (not recommended)." -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]
        then
            exit 1
        fi
    fi
}

echo "Checking prerequisites"

REQUIREDNODEVERSION=16.0.0
REQUIREDNPMVERSION=7.10.0
REQUIREDGOVERSION=1.18.0
REQUIREDDOCKERVERSION=17.0

NODEVERSION=$(sed 's/v//' <<< $(node -v))
NPMVERSION=$(npm -v)
GOVERSION=$(sed -ne 's/[^0-9]*\(\([0-9]\.\)\{0,4\}[0-9][^.]\).*/\1/p' <<< $(go version))
DOCKERVERSION=$(docker version --format '{{.Server.Version}}' | sed 's/[a-z-]//g')

check_prereq 'node' $REQUIREDNODEVERSION $NODEVERSION
check_prereq 'npm' $REQUIREDNPMVERSION $NPMVERSION
check_prereq 'go' $REQUIREDGOVERSION $GOVERSION
check_prereq 'docker' $REQUIREDDOCKERVERSION $DOCKERVERSION
