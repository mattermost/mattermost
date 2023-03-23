#!/bin/bash

if [ "${1:0:1}" = '-' ]; then
    set -- mattermost "$@"
fi

exec "$@"
