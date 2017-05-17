#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr dump -H '[2001:db8::7]:22'
