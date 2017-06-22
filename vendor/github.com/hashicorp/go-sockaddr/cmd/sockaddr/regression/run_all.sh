#!/bin/sh --

FIND=`/usr/bin/which 2> /dev/null gfind find | /usr/bin/grep -v ^no | /usr/bin/head -n 1`
XARGS=`/usr/bin/which 2> /dev/null gxargs xargs | /usr/bin/grep -v ^no | /usr/bin/head -n 1`
set -e
set -u

num_cpus=$(getconf NPROCESSORS_ONLN)
set +e
${FIND} . -maxdepth 1 -name 'test_*.sh' -print0 | ${XARGS} -0 -n1 -P${num_cpus} ./run_one.sh
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
