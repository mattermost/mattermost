#!/usr/bin/env bash
set -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

GO=$1
GOFLAGS=$2
PACKAGES=$3
GOBIN=$4
TIMEOUT=$5

export MM_SERVER_PATH=$PWD

echo "Packages to test: $PACKAGES"
echo "GOFLAGS: $GOFLAGS"

if [[ $GOFLAGS == "-race " && $IS_CI == "true" ]] ;
then
	export GOMAXPROCS=4
fi

$GOBIN/gotestsum --junitfile report.xml --jsonfile report.json --format testname --packages="$PACKAGES" -- $GOFLAGS -timeout=$TIMEOUT
