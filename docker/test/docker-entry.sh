#!/bin/bash
# Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
# See License.txt for license information.

echo "${MYSQL_HOST} dockerhost" >> /etc/hosts
/etc/init.d/networking restart

set -e

echo starting go web server
cd /zbox/bin/; ./platform -config=config.json