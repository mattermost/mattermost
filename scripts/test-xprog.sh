#!/usr/bin/env bash
set -e
[[ $1 =~ (github.com.*)/_test ]] && \
    echo Testing ${BASH_REMATCH[1]}
if [[ $1 == *"github.com/mattermost/enterprise"* ]]; then
    cd "$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
fi
"$@" -test.coverprofile=cprofile.out
if [ -f cprofile.out ]; then
    tail -n +2 cprofile.out >> cover.out;
    rm cprofile.out;
fi;
