#!/usr/bin/env bash
set -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

GO=$1
GOFLAGS=$2
PACKAGES=$3
TESTS=$4
TESTFLAGS=$5
ALL_PACKAGES=$6

ALL_PACKAGES_COMMA=$(echo $ALL_PACKAGES | tr ' ' ',')

echo "Packages to test: $PACKAGES"
find . -name 'cprofile*.out' -exec sh -c 'rm "{}"' \;

$GO test $GOFLAGS -run=$TESTS $TESTFLAGS -p 1 -v -timeout=2000s -covermode=count -coverpkg=$ALL_PACKAGES_COMMA -exec $DIR/test-xprog.sh $PACKAGES 2>&1 | tee output
EXIT_STATUS=$?

cat output | $GOPATH/bin/go-junit-report > report.xml
rm output
find . -name 'cprofile*.out' -exec sh -c 'tail -n +2 {} >> cover.out ; rm "{}"' \;
rm -f config/*.crt
rm -f config/*.key

exit $EXIT_STATUS
