#!/bin/bash

# Run test coverage on each subdirectory and merge the coverage profile.
echo "mode: count" > target/report/profile.cov

# Standard go tooling behavior is to ignore dirs with leading underscors
for dir in $(find . -maxdepth 10 -not -path './.git*' -not -path '*/_*' -type d); do
    if ls $dir/*.go &> /dev/null; then
        go test -covermode=count -coverprofile=$dir/profile.tmp $dir
        if [ -f $dir/profile.tmp ]; then
            cat $dir/profile.tmp | tail -n +2 >> target/report/profile.cov
            rm $dir/profile.tmp
        fi
    fi
done
go tool cover -html target/report/profile.cov -o target/report/coverage.html

