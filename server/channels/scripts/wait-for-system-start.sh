#!/bin/bash

total=0
max_wait_seconds=60

echo "waiting $max_wait_seconds seconds for the server to start"

while [[ "$total" -le "$max_wait_seconds" ]]; do
    if bin/mmctl system status --local 2> /dev/null; then
        exit 0
    else
        ((total=total+1))
        printf "."
        sleep 1
    fi
done

printf "\nserver didn't start in $max_wait_seconds seconds\n"

exit 1