#!/bin/bash
set -x

DOCKER_NETWORK="${CI_PIPELINE_IID}-schema-postgres"
DOCKER_COMPOSE_FILE="gitlab-dc.postgres.yml"
docker network create ${DOCKER_NETWORK}
ulimit -n 8096
cd build
docker-compose -f $DOCKER_DOCKER_COMPOSE_FILE --no-ansi run --rm start_dependencies
cat ../tests/test-data.ldif | docker-compose --no-ansi exec -T openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
docker-compose -f $DOCKER_DOCKER_COMPOSE_FILE --no-ansi exec -T minio sh -c 'mkdir -p /data/mattermost-test'
sleep 5
docker run --net ${DOCKER_NETWORK} appropriate/curl:latest sh -c "until curl --max-time 5 --output - http://elasticsearch:9200; do echo waiting for elasticsearch; sleep 5; done;"

echo "Creating databases"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "CREATE DATABASE migrated; CREATE DATABASE latest;" | exec psql -U mmuser mattermost_test'
echo "Importing postgres dump from version 5.0"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres psql -U mmuser -d migrated < ../scripts/mattermost-postgresql-5.0.sql
docker run -d -it --name server-postgres --net $DOCKER_NETWORK \
  --env-file="dotenv/test-schema-validation.env" \
  --env MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@postgres:5432/migrated?sslmode=disable&connect_timeout=10" \
  --env MM_SQLSETTINGS_DRIVERNAME=postgres \
  -v $CI_PROJECT_DIR:/mattermost-server \
  -w /mattermost-server \
  mattermost/mattermost-build-server:20201119_golang-1.15.5 \
  bash -c "ulimit -n 8096; make ARGS='version' run-cli && make MM_SQLSETTINGS_DATASOURCE='postgres://mmuser:mostest@postgres:5432/latest?sslmode=disable&connect_timeout=10' ARGS='version' run-cli"
docker logs -f server-postgres

echo "Ignoring known mismatch: ChannelMembers.MentionCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;" | exec psql -U mmuser -d migrated'
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;" | exec psql -U mmuser -d latest'
echo "Ignoring known mismatch: ChannelMembers.MsgCountRoot and Channels.TotalMsgCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;" | exec psql -U mmuser -d migrated'
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;" | exec psql -U mmuser -d latest'
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;" | exec psql -U mmuser -d migrated'
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;" | exec psql -U mmuser -d latest'

echo "Generating dump"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres pg_dump --schema-only -d migrated -U mmuser > migrated.sql
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres pg_dump --schema-only -d latest -U mmuser > latest.sql
echo "Removing databases created for db comparison"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T postgres sh -c 'exec echo "DROP DATABASE migrated; DROP DATABASE latest;" | exec psql -U mmuser mattermost_test'
echo "Generating diff"
diff migrated.sql latest.sql > diff.txt && echo "Both schemas are same" || (echo "Schema mismatch" && cat diff.txt && exit 1)
