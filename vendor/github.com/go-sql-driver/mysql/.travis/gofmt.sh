#!/bin/bash
set -ev

# Only check for go1.10+ since the gofmt style changed
if [[ $(go version) =~ go1\.([0-9]+) ]] && ((${BASH_REMATCH[1]} >= 10)); then
    test -z "$(gofmt -d -s . | tee /dev/stderr)"
fi
