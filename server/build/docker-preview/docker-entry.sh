#!/bin/bash
# Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
# See License.txt for license information.

echo "Starting PostgreSQL"
docker-entrypoint.sh -c 'shared_buffers=256MB' -c 'max_connections=300' &

until pg_isready -hlocalhost -p 5432 -U "$POSTGRES_USER" &> /dev/null; do
	echo "postgres still not ready, sleeping"
	sleep 5
done

echo "Updating CA certificates"
update-ca-certificates --fresh >/dev/null

echo "Starting platform"
cd mattermost
exec ./bin/mattermost --config=config/config_docker.json
