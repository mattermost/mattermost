#!/usr/bin/env bash
set -e
[[ $1 =~ (github.com.*)/_test ]] && \
    echo Testing ${BASH_REMATCH[1]}
coverprofile=`pwd`/cprofile.out
if [[ $1 == *"/enterprise/"* ]]; then
    cd "$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
fi
"$@" -test.coverprofile "$coverprofile"
