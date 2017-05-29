#!/bin/sh --

set -e
exec 2>&1
# Verified via: cat sockaddr_dump-12.out | sort | uniq -c
../sockaddr dump '192.168.0.1/16'
../sockaddr dump '::ffff:192.168.0.1/112'
../sockaddr dump '0:0:0:0:0:ffff:192.168.0.1/112'
