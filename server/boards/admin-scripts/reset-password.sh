#!/bin/bash

if [[ $# < 2 ]] ; then
    echo 'reset-password.sh <username> <new password>'
    exit 1
fi

curl --unix-socket /var/tmp/focalboard_local.socket http://localhost/api/v2/admin/users/$1/password -X POST -H 'Content-Type: application/json' -d '{ "password": "'$2'" }'
