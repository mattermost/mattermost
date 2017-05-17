#!/bin/sh -e -u --

set -e
set -u

verbose=""
if [ "$1" = "-v" ]; then
	verbose="true"
	shift
fi

if [ $# -ne 1 ]; then
    printf "Usage: %s [ test script ]\n\n" "$(basename $0)"
    printf "ERROR: Need a single test script to execute\n"
    exit 1
fi

# chdir(2) to the directory where the script resides
cd "$(dirname "$0")"

exact_name="$(basename ${1} .sh)"
test_name="$(echo ${exact_name} | sed -e s@^test_@@)"
test_script="${exact_name}.sh"
test_out="${test_name}.out"
expected_out="expected/${test_name}.out"

if [ ! -r "${test_script}" ]; then
    printf "ERROR: Test script %s does not exist\n" "${test_script}"
    exit 2
fi

if [ -n "${verbose}" ]; then
    cat "${test_script}" | tail -n 1
fi

set +e
"./${test_script}" > "${test_out}" 2>&1

if [ ! -r "${expected_out}" ]; then
    printf "ERROR: Expected test output (%s) does not exist\n" "${expected_out}"
    exit 2
fi

cmp -s "${expected_out}" "${test_out}"
result=$?
set -e

if [ "${result}" -eq 0 ]; then
    if [ -n "${verbose}" ]; then
        cat "${test_out}"
    fi
    rm -f "${test_out}"
    exit 0
fi

diff_out="${test_name}.diff"
set +e
diff -u "${test_out}" "${expected_out}" > "${diff_out}"
set -e

# If run as an interactive TTY, pass along the diff to the caller
if [ -t 0 -o -n "${verbose}" ]; then
    cat "${diff_out}"
fi

exit 1
