#!/bin/bash
set -xe

echo $DOCKER_HOST
docker ps
DOCKER_NETWORK="${COMPOSE_PROJECT_NAME}"
DOCKER_COMPOSE_FILE="gitlab-dc.mysql.yml"
CONTAINER_SERVER="${COMPOSE_PROJECT_NAME}_server_1"
docker network create ${DOCKER_NETWORK}
ulimit -n 8096
cd ${CI_PROJECT_DIR}/build
docker-compose -f $DOCKER_COMPOSE_FILE run -d --rm start_dependencies
sleep 5
cat ../tests/test-data.ldif | docker-compose exec -d -T openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';
docker-compose exec -d -T minio sh -c 'mkdir -p /data/mattermost-test';
docker run -d --name "${COMPOSE_PROJECT_NAME}_curl_mysql" --net ${CI_REGISTRY}/mattermost/ci/images/curl:7.59.0-1 sh -c "until curl --max-time 5 --output - http://mysql:3306; do echo waiting for mysql; sleep 5; done;"
docker run -d --name "${COMPOSE_PROJECT_NAME}_curl_elasticsearch" --net ${DOCKER_NETWORK} ${CI_REGISTRY}/mattermost/ci/images/curl:7.59.0-1 sh -c "until curl --max-time 5 --output - http://elasticsearch:9200; do echo waiting for elasticsearch; sleep 5; done;"

docker run -d -it --rm --name "${CONTAINER_SERVER}" --net ${DOCKER_NETWORK} \
  --env-file="dotenv/test.env" \
  --env MM_SQLSETTINGS_DATASOURCE="mmuser:mostest@tcp(mysql:3306)/mattermost_test?charset=utf8mb4,utf8&multiStatements=true" \
  --env MM_SQLSETTINGS_DRIVERNAME=mysql \
  -v ${CI_PROJECT_DIR}:/mattermost-server \
  -w /mattermost-server \
  $IMAGE_BUILD_SERVER \
  bash -c "ulimit -n 8096; make test-server$RACE_MODE BUILD_NUMBER=$CI_COMMIT_REF_NAME-$CI_COMMIT_SHA TESTFLAGS= TESTFLAGSEE=" \
  bash -c scripts/diff-email-templates.sh
mkdir -p logs
docker-compose logs --tail="all" -t --no-color > logs/docker-compose_logs
docker ps -a --no-trunc > logs/docker_ps
docker stats -a --no-stream > logs/docker_stats
docker logs -f "${CONTAINER_SERVER}"
tar -czvf logs/docker_logs.tar.gz logs/docker-compose_logs logs/docker_ps logs/docker_stats

docker-compose -f $DOCKER_COMPOSE_FILE down
docker network remove ${DOCKER_NETWORK}
