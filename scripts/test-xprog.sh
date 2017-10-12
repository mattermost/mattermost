#!/usr/bin/env bash
set -e
[[ $1 =~ (github.com.*)/_test ]] && \
    echo Testing ${BASH_REMATCH[1]}
"$@" -test.coverprofile=cprofile.out
if [ -f cprofile.out ]; then
    tail -n +2 cprofile.out >> cover.out;
    rm cprofile.out;
fi;
