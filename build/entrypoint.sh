#!/bin/sh

sudo update-ca-certificates --fresh >/dev/null

if [ "${1:0:1}" = '-' ]; then
    set -- mattermost "$@"
fi

exec "$@"
