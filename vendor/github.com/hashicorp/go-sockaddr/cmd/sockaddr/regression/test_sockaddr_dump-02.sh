#!/bin/sh --

set -e
exec 2>&1
exec ../sockaddr dump 127.0.0.2/8
