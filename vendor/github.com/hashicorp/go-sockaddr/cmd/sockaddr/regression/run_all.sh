#!/bin/sh --

set -e
set -u

num_cpus=$(getconf NPROCESSORS_ONLN)
set +e
find . -name 'test_*.sh' -depth 1 | xargs -n1 -P${num_cpus} ./run_one.sh
set -e

# rune_one.sh generates the .diff files
diffs=$(find . -name '*.diff')
if [ -z "${diffs}" ]; then
    exit 0
fi

printf "The following tests failed (check the respective .diff file for details):\n\n"
for d in ${diffs}; do
    printf "\t%s\n" "$(basename ${d} .diff)"
done
exit 1
