#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr dump '2001:db8::4/64'
