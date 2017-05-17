#!/bin/sh --

exec 2>&1
# This should succeed because it is a mapped address
../sockaddr dump -4 '0:0:0:0:0:ffff::/97'

# This should fail even though it is an IPv4 compatible address
../sockaddr dump -4 '0:0:0:0:0:0::/97'

# These should succeed as an IPv6 addresses
../sockaddr dump -6 '0:0:0:0:0:0::/97'
../sockaddr dump -i '0:0:0:0:0:0::/97'
