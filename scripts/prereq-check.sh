#!/bin/bash
check_version()
{
    if [ ! $# == 2 ]; then
        echo "Unable to determine $CHECKING version! Ensure that $CHECKING is in your path and try again." && exit 1
    fi

    local version=$1 check=$2
    local winner=$(echo -e "$version\n$check" | sed '/^$/d' | sort -nr | head -1)
    [[ "$winner" = "$version" ]] && return 0
    return 1
}

echo "Checking prerequisites"

REQNODEVER=8.9.0
REQNPMVER=5.6.0
REQGOVER=1.9.2
REQDOCKERVER=17.0

CHECKING='Node'
NODEVER=$(sed 's/v//' <<< $(node -v))

##check to see if node is installed
type node >/dev/null 2>&1 || { echo >&2 "Mattermost requires NodeJS but it doesn't appear to be installed.  Aborting."; exit 1; }
##check to see if it is at least the supported version
if check_version $NODEVER $REQNODEVER; then
    echo "Node minimum requirement met. Required: $REQNODEVER, Found: $NODEVER"
else 
    echo "WARNING! Mattermost did not find the minimum supported version of Node installed. Required: $REQNODEVER, Found: $NODEVER"
    echo "We highly recommend stopping installation and updating dependencies before continuing"
    read -p "Continue? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        exit 1
    fi
fi

CHECKING='NPM'
NPMVER=$(npm -v)

##check to see if NPM is installed
type npm >/dev/null 2>&1 || { echo >&2 "Mattermost requires NPM but it doesn't appear to be installed.  Aborting."; exit 1; }
##check to see if it is at least the supported version
if check_version $NPMVER $REQNPMVER; then
   echo "NPM minimum requirement met. Required: $REQNPMVER, Found: $NPMVER"
else 
    echo "WARNING! Mattermost did not find the minimum supported version of NPM installed. Required: $REQNPMVER, Found: $NPMVER"
    echo "We highly recommend stopping installation and updating dependencies before continuing"
    read -p "Continue? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        exit 1
    fi
fi

CHECKING='Go'
GOVER=$(sed -ne 's/[^0-9]*\(\([0-9]\.\)\{0,4\}[0-9][^.]\).*/\1/p' <<< $(go version))

##check to see if Go is installed
type go >/dev/null 2>&1 || { echo >&2 "Mattermost requires Go but it doesn't appear to be installed.  Aborting."; exit 1; }
##check to see if it is at least the supported version
if check_version $GOVER $REQGOVER; then
   echo "Golang minimum requirement met. Required: $REQGOVER, Found: $GOVER"
else 
    echo "WARNING! Mattermost did not find the minimum supported version of Go installed. Required: $REQGOVER, Found: $GOVER"
    echo "We highly recommend stopping installation and updating dependencies before continuing"
    read -p "Continue? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        exit 1
    fi
fi

CHECKING='Docker'
DOCKERVER=$(docker version --format '{{.Server.Version}}' | sed 's/[a-z-]//g')

##check to see if Docker is installed
type docker >/dev/null 2>&1 || { echo >&2 "Mattermost requires Docker but it doesn't appear to be installed.  Aborting."; exit 1; }
##check to see if it is at least the supported version
if check_version $DOCKERVER $REQDOCKERVER; then
   echo "Docker minimum requirement met. Required: $REQDOCKERVER, Found: $DOCKERVER"
else 
    echo "WARNING! Mattermost did not find the minimum supported version of Docker installed. Required: $REQDOCKERVER, Found: $DOCKERVER"
    echo "We highly recommend stopping installation and updating dependencies before continuing"
    read -p "Continue? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        exit 1
    fi
fi