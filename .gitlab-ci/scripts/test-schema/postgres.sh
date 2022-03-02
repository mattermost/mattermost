#!/bin/bash
set -xe

if [[ "$GITLAB_CI" == "" ]]; then
  export CI_PROJECT_DIR=$PWD
  export CI_REGISTRY=registry.internal.mattermost.com
  export COMPOSE_PROJECT_NAME="1schemapostgres"
  export IMAGE_BUILD_SERVER=$CI_REGISTRY/mattermost/ci/images/mattermost-build-server:20210810_golang-1.16.7
  # You need to log in to internal registry to run this script locally
fi

echo $DOCKER_HOST
docker ps
DOCKER_NETWORK=$COMPOSE_PROJECT_NAME
DOCKER_COMPOSE_FILE="gitlab-dc.schemapostgres.yml"
CONTAINER_SERVER="${COMPOSE_PROJECT_NAME}_server_1"
CONTAINER_DB="${COMPOSE_PROJECT_NAME}_postgres_1"
docker network create $DOCKER_NETWORK
ulimit -n 8096
cd "$CI_PROJECT_DIR"/build
docker-compose -f $DOCKER_COMPOSE_FILE run -d --rm start_dependencies
timeout 90s bash -c "until docker exec ${COMPOSE_PROJECT_NAME}_postgres_1 pg_isready ; do sleep 5 ; done"

echo "Creating databases"
docker exec $CONTAINER_DB sh -c 'exec echo "CREATE DATABASE migrated; CREATE DATABASE latest;" | exec psql -U mmuser mattermost_test;'
echo "Importing postgres dump from version 6.0.0"
docker exec -i $CONTAINER_DB psql -U mmuser -d migrated < "$CI_PROJECT_DIR"/scripts/mattermost-postgresql-6.0.0.sql
docker exec -i $CONTAINER_DB psql -U mmuser -d migrated -c "INSERT INTO Systems (Name, Value) VALUES ('Version', '6.0.0')"
docker run -d -it --rm --name $CONTAINER_SERVER --net $DOCKER_NETWORK \
  --env-file="dotenv/test-schema-validation.env" \
  --env MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@postgres:5432/migrated?sslmode=disable&connect_timeout=10" \
  --env MM_SQLSETTINGS_DRIVERNAME=postgres \
  -v "$CI_PROJECT_DIR":/mattermost-server \
  -w /mattermost-server \
  $IMAGE_BUILD_SERVER \
  bash -c "ulimit -n 8096; make ARGS='db migrate' run-cli && make MM_SQLSETTINGS_DATASOURCE='postgres://mmuser:mostest@postgres:5432/latest?sslmode=disable&connect_timeout=10' ARGS='db migrate' run-cli"
mkdir -p logs
docker-compose logs --tail="all" -t --no-color > logs/docker-compose_logs_$COMPOSE_PROJECT_NAME
docker logs -f $CONTAINER_SERVER
tar -czvf logs/docker_logs$COMPOSE_PROJECT_NAME.tar.gz logs/docker-compose_logs_$COMPOSE_PROJECT_NAME

echo "Generating dump"
docker exec $CONTAINER_DB pg_dump --schema-only -d migrated -U mmuser > migrated.sql
docker exec $CONTAINER_DB pg_dump --schema-only -d latest -U mmuser > latest.sql
echo "Removing databases created for db comparison"
docker exec $CONTAINER_DB sh -c 'exec echo "DROP DATABASE migrated; DROP DATABASE latest;" | exec psql -U mmuser mattermost_test'
echo "Generating diff"
diff migrated.sql latest.sql > diff.txt && echo "Both schemas are same" || (echo "Schema mismatch" && cat diff.txt && exit 1)

docker-compose -f $DOCKER_COMPOSE_FILE down
docker network remove $DOCKER_NETWORK
