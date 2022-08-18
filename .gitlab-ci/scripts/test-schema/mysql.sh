#!/bin/bash
set -xe

if [[ "$GITLAB_CI" == "" ]]; then
  export CI_PROJECT_DIR=$PWD
  export CI_REGISTRY=registry.internal.mattermost.com
  export COMPOSE_PROJECT_NAME="1schemamysql"
  export IMAGE_BUILD_SERVER=$CI_REGISTRY/mattermost/ci/images/mattermost-build-server:20210810_golang-1.16.7
  # You need to log in to internal registry to run this script locally
fi

echo "$DOCKER_HOST"
docker ps
DOCKER_NETWORK=$COMPOSE_PROJECT_NAME
DOCKER_COMPOSE_FILE="gitlab-dc.schemamysql.yml"
CONTAINER_SERVER="${COMPOSE_PROJECT_NAME}_server_1"
CONTAINER_DB="${COMPOSE_PROJECT_NAME}_mysql_1"
docker network create $DOCKER_NETWORK
ulimit -n 8096
cd "$CI_PROJECT_DIR"/build
docker-compose -f $DOCKER_COMPOSE_FILE run -d --rm start_dependencies
sleep 5
docker run --net $DOCKER_NETWORK "$CI_REGISTRY"/mattermost/ci/images/curl:7.59.0-1 sh -c "until curl --max-time 5 --output - http://mysql:3306; do echo waiting for mysql; sleep 5; done;"

echo "Creating databases"
docker exec $CONTAINER_DB mysql -uroot -pmostest -e "CREATE DATABASE migrated; CREATE DATABASE latest; GRANT ALL PRIVILEGES ON migrated.* TO mmuser; GRANT ALL PRIVILEGES ON latest.* TO mmuser; "
echo "Importing mysql dump from version 6.0.0"
docker exec -i $CONTAINER_DB mysql -D migrated -uroot -pmostest < "$CI_PROJECT_DIR"/scripts/mattermost-mysql-6.0.0.sql
docker exec -i $CONTAINER_DB mysql -D migrated -uroot -pmostest -e "INSERT INTO Systems (Name, Value) VALUES ('Version', '6.0.0')"
docker run -d -it --rm --name "$CONTAINER_SERVER" --net $DOCKER_NETWORK \
  --env-file="dotenv/test-schema-validation.env" \
  --env MM_SQLSETTINGS_DATASOURCE="mmuser:mostest@tcp(mysql:3306)/migrated?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s" \
  --env MM_SQLSETTINGS_DRIVERNAME=mysql \
  -v "$CI_PROJECT_DIR":/mattermost-server \
  -w /mattermost-server \
  $IMAGE_BUILD_SERVER \
  bash -c "ulimit -n 8096; make ARGS='db migrate' run-cli && make MM_SQLSETTINGS_DATASOURCE='mmuser:mostest@tcp(mysql:3306)/latest?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s' ARGS='db migrate' run-cli"
mkdir -p logs
docker-compose logs --tail="all" -t --no-color > logs/docker-compose_logs_$COMPOSE_PROJECT_NAME
docker logs -f $CONTAINER_SERVER
tar -czvf logs/docker_logs$COMPOSE_PROJECT_NAME.tar.gz logs/docker-compose_logs_$COMPOSE_PROJECT_NAME

echo "Generating dump"
docker exec $CONTAINER_DB mysqldump --skip-opt --no-data --compact -u root -pmostest migrated > migrated.sql
docker exec $CONTAINER_DB mysqldump --skip-opt --no-data --compact -u root -pmostest latest > latest.sql
echo "Removing databases created for db comparison"
docker exec $CONTAINER_DB mysql -uroot -pmostest -e 'DROP DATABASE migrated; DROP DATABASE latest'

echo "Generating diff"
diff migrated.sql latest.sql > diff.txt && echo "Both schemas are same" || (echo "Schema mismatch" && cat diff.txt && exit 1)

docker-compose -f $DOCKER_COMPOSE_FILE down
docker network remove $DOCKER_NETWORK
