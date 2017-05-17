#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr eval 'GetAllInterfaces | include "name" "lo0" | printf "%v"' 'GetAllInterfaces | include "name" "lo0" | printf "%v"'
