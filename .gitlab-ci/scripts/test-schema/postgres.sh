#!/bin/bash
set -xe

echo $DOCKER_HOST
docker ps
DOCKER_NETWORK="${COMPOSE_PROJECT_NAME}"
DOCKER_COMPOSE_FILE="gitlab-dc.schemapostgres.yml"
CONTAINER_SERVER="${COMPOSE_PROJECT_NAME}_server_1"
docker network create ${DOCKER_NETWORK}
ulimit -n 8096
cd ${CI_PROJECT_DIR}/build
docker-compose -f $DOCKER_COMPOSE_FILE run -d --rm start_dependencies
timeout 90s bash -c "until docker exec ${COMPOSE_PROJECT_NAME}_postgres_1 pg_isready ; do sleep 5 ; done"

echo "Creating databases"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "CREATE DATABASE migrated; CREATE DATABASE latest;" | exec psql -U mmuser mattermost_test'
echo "Importing postgres dump from version 5.0"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres psql -U mmuser -d migrated < ${CI_PROJECT_DIR}/scripts/mattermost-postgresql-5.0.sql
docker run -d -it --rm --name "${CONTAINER_SERVER}" --net ${DOCKER_NETWORK} \
  --env-file="dotenv/test-schema-validation.env" \
  --env MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@postgres:5432/migrated?sslmode=disable&connect_timeout=10" \
  --env MM_SQLSETTINGS_DRIVERNAME=postgres \
  -v $CI_PROJECT_DIR:/mattermost-server \
  -w /mattermost-server \
  $IMAGE_BUILD_SERVER \
  bash -c "ulimit -n 8096; make ARGS='version' run-cli && make MM_SQLSETTINGS_DATASOURCE='postgres://mmuser:mostest@postgres:5432/latest?sslmode=disable&connect_timeout=10' ARGS='version' run-cli"
docker logs -f "${CONTAINER_SERVER}"

echo "Ignoring known mismatch: ChannelMembers.MentionCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;" | exec psql -U mmuser -d migrated'
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;" | exec psql -U mmuser -d latest'
echo "Ignoring known mismatch: ChannelMembers.MsgCountRoot and Channels.TotalMsgCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;" | exec psql -U mmuser -d migrated'
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;" | exec psql -U mmuser -d latest'
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;" | exec psql -U mmuser -d migrated'
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;" | exec psql -U mmuser -d latest'

echo "Generating dump"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres pg_dump --schema-only -d migrated -U mmuser > migrated.sql
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres pg_dump --schema-only -d latest -U mmuser > latest.sql
echo "Removing databases created for db comparison"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T postgres sh -c 'exec echo "DROP DATABASE migrated; DROP DATABASE latest;" | exec psql -U mmuser mattermost_test'
echo "Generating diff"
diff migrated.sql latest.sql > diff.txt && echo "Both schemas are same" || (echo "Schema mismatch" && cat diff.txt && exit 1)

docker-compose -f $DOCKER_COMPOSE_FILE down
docker network remove ${DOCKER_NETWORK}
