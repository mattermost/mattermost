#!/bin/bash
set -xe

if [[ "$GITLAB_CI" == "" ]]; then
  export CI_PROJECT_DIR=$PWD
  export CI_REGISTRY=registry.internal.mattermost.com
  export COMPOSE_PROJECT_NAME="1postgres"
  export IMAGE_BUILD_SERVER=$CI_REGISTRY/mattermost/ci/images/mattermost-build-server:20210810_golang-1.16.7
  # You need to log in to internal registry to run this script locally
fi

echo "$DOCKER_HOST"
docker ps
DOCKER_NETWORK=$COMPOSE_PROJECT_NAME
DOCKER_COMPOSE_FILE="gitlab-dc.postgres.yml"
CONTAINER_SERVER="${COMPOSE_PROJECT_NAME}_server_1"
docker network create $DOCKER_NETWORK
ulimit -n 8096
cd "$CI_PROJECT_DIR"/build
docker-compose -f $DOCKER_COMPOSE_FILE run -d --rm start_dependencies
sleep 5
cat ../tests/test-data.ldif | docker-compose exec -d -T openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';
docker-compose exec -d -T minio sh -c 'mkdir -p /data/mattermost-test';
timeout 90s bash -c "until docker exec ${COMPOSE_PROJECT_NAME}_postgres_1 pg_isready ; do sleep 5 ; done"
docker run --name "${COMPOSE_PROJECT_NAME}_curl_elasticsearch" --net $DOCKER_NETWORK $CI_REGISTRY/mattermost/ci/images/curl:7.59.0-1 sh -c "until curl --max-time 5 --output - http://elasticsearch:9200; do echo waiting for elasticsearch; sleep 5; done;"
docker run -d -it --rm --name "${CONTAINER_SERVER}" --net $DOCKER_NETWORK \
  --env-file="dotenv/test.env" \
  --env MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@postgres:5432/mattermost_test?sslmode=disable&connect_timeout=10" \
  --env MM_SQLSETTINGS_DRIVERNAME=postgres \
  -v "$CI_PROJECT_DIR":/mattermost-server \
  -w /mattermost-server \
  $IMAGE_BUILD_SERVER \
  bash -c "ulimit -n 8096; make test-server$RACE_MODE BUILD_NUMBER=$CI_COMMIT_REF_NAME-$CI_COMMIT_SHA TESTFLAGS= TESTFLAGSEE=" \
  bash -c scripts/diff-email-templates.sh
mkdir -p logs
docker-compose logs --tail="all" -t --no-color > logs/docker-compose_logs_$COMPOSE_PROJECT_NAME
docker ps -a --no-trunc > logs/docker_ps_$COMPOSE_PROJECT_NAME
docker stats -a --no-stream > logs/docker_stats_$COMPOSE_PROJECT_NAME
docker logs -f $CONTAINER_SERVER
tar -czvf logs/docker_logs_$COMPOSE_PROJECT_NAME.tar.gz logs/docker-compose_logs_$COMPOSE_PROJECT_NAME logs/docker_ps_$COMPOSE_PROJECT_NAME logs/docker_stats_$COMPOSE_PROJECT_NAME

docker-compose -f $DOCKER_COMPOSE_FILE down
docker network remove $DOCKER_NETWORK
