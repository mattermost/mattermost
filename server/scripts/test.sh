#!/usr/bin/env bash
set -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

GO=$1
GOFLAGS=$2
PACKAGES=$3
TESTFLAGS=$4
GOBIN=$5
TIMEOUT=$6

export MM_SERVER_PATH=$PWD

echo "Packages to test: $PACKAGES"
echo "GOFLAGS: $GOFLAGS"

if [[ $GOFLAGS == "-race " && $IS_CI == "true" ]] ;
then
	export GOMAXPROCS=4
fi

$GO test $GOFLAGS $TESTFLAGS -v -timeout=$TIMEOUT $PACKAGES 2>&1 > >( tee output )
EXIT_STATUS=$?

cat output | $GOBIN/go-junit-report > report.xml
rm output

exit $EXIT_STATUS
