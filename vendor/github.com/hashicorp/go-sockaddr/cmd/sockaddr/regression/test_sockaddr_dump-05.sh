#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr dump /tmp/example
