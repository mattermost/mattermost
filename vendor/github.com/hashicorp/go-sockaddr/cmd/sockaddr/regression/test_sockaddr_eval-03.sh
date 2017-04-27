#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr eval '. | include "name" "lo0" | include "type" "IPv6" | sort "address" | join "address" " "'
