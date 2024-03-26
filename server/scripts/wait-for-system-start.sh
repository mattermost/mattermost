#!/bin/bash

total=0
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:=60}"

echo "waiting $MAX_WAIT_SECONDS seconds for the server to start"

while [[ "$total" -le "$MAX_WAIT_SECONDS" ]]; do
    if bin/mmctl system status --local 2> /dev/null; then
        exit 0
    else
        ((total=total+1))
        printf "."
        sleep 1
    fi
done

printf "\nserver didn't start in $MAX_WAIT_SECONDS seconds\n"

exit 1