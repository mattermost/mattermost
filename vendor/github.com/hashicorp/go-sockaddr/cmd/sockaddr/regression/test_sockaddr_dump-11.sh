#!/bin/sh --

set -e
exec 2>&1
# Verified via: cat sockaddr_dump-11.out | sort | uniq -c
../sockaddr dump '192.168.0.1'
../sockaddr dump '::ffff:192.168.0.1'
../sockaddr dump '0:0:0:0:0:ffff:192.168.0.1'
