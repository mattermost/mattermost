#!/usr/bin/env bash
set -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

GO=$1
GOFLAGS=$2
PACKAGES=$3
TESTS=$4
TESTFLAGS=$5
GOBIN=$6
TIMEOUT=$7

export MM_SERVER_PATH=$PWD

echo "Packages to test: $PACKAGES"
echo "GOFLAGS: $GOFLAGS"

if [[ $GOFLAGS == "-race " && $IS_CI == "true" ]] ;
then
	export GOMAXPROCS=4
fi

find . -type d -name data -not -path './data' | xargs rm -rf

$GO test $GOFLAGS -run=$TESTS $TESTFLAGS -v -timeout=$TIMEOUT $PACKAGES 2>&1 > >( tee output )
EXIT_STATUS=$?

cat output | $GOBIN/go-junit-report > report.xml
rm output
rm -f config/*.crt
rm -f config/*.key

exit $EXIT_STATUS
