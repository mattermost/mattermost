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
COVERMODE=$8

PACKAGES_COMMA=$(echo $PACKAGES | tr ' ' ',')
export MM_SERVER_PATH=$PWD
export MM_FEATUREFLAGS_BoardsProduct=false

echo "Packages to test: $PACKAGES"
echo "GOFLAGS: $GOFLAGS"

if [[ $GOFLAGS == "-race " && $IS_CI == "true" ]] ;
then
	export GOMAXPROCS=4
fi

find . -name 'cprofile*.out' -exec sh -c 'rm "{}"' \;
find . -type d -name data -not -path './data' | xargs rm -rf

$GO test $GOFLAGS -run=$TESTS $TESTFLAGS -v -timeout=$TIMEOUT -covermode=$COVERMODE -coverpkg=$PACKAGES_COMMA -exec $DIR/test-xprog.sh $PACKAGES 2>&1 > >( tee output )
EXIT_STATUS=$?

cat output | $GOBIN/go-junit-report > report.xml
rm output
find . -name 'cprofile*.out' -exec sh -c 'tail -n +2 "{}" >> cover.out ; rm "{}"' \;
rm -f channels/config/*.crt
rm -f channels/config/*.key

exit $EXIT_STATUS
