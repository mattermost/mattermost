#!/bin/sh --

set -e
exec 2>&1
../sockaddr eval 'GetPrivateInterfaces | include "flags" "up|multicast" | attr "flags"'
