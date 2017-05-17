#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr dump -o string,type '[2001:db8::8]:22'
