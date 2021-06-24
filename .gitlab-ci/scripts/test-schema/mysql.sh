#!/bin/bash
set -xe

echo $DOCKER_HOST
docker ps
DOCKER_NETWORK="${COMPOSE_PROJECT_NAME}"
DOCKER_COMPOSE_FILE="gitlab-dc.schemamysql.yml"
CONTAINER_SERVER="${COMPOSE_PROJECT_NAME}_server_1"
docker network create ${DOCKER_NETWORK}
ulimit -n 8096
cd ${CI_PROJECT_DIR}/build
docker-compose -f $DOCKER_COMPOSE_FILE run -d --rm start_dependencies
sleep 5
docker run --net ${DOCKER_NETWORK} ${CI_REGISTRY}/mattermost/ci/images/curl:7.59.0-1 sh -c "until curl --max-time 5 --output - http://mysql:3306; do echo waiting for mysql; sleep 5; done;"

echo "Creating databases"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -uroot -pmostest -e "CREATE DATABASE migrated; CREATE DATABASE latest; GRANT ALL PRIVILEGES ON migrated.* TO mmuser; GRANT ALL PRIVILEGES ON latest.* TO mmuser"
echo "Importing mysql dump from version 5.0"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D migrated -uroot -pmostest < ${CI_PROJECT_DIR}/scripts/mattermost-mysql-5.0.sql
docker run -d -it --rm --name "${CONTAINER_SERVER}" --net ${DOCKER_NETWORK} \
  --env-file="dotenv/test-schema-validation.env" \
  --env MM_SQLSETTINGS_DATASOURCE="mmuser:mostest@tcp(mysql:3306)/migrated?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s" \
  --env MM_SQLSETTINGS_DRIVERNAME=mysql \
  -v $CI_PROJECT_DIR:/mattermost-server \
  -w /mattermost-server \
  $IMAGE_BUILD_SERVER \
  bash -c "ulimit -n 8096; make ARGS='version' run-cli && make MM_SQLSETTINGS_DATASOURCE='mmuser:mostest@tcp(mysql:3306)/latest?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s' ARGS='version' run-cli"
docker logs -f "${CONTAINER_SERVER}"

echo "Ignoring known MySQL mismatch: ChannelMembers.SchemeGuest"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN SchemeGuest;"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN SchemeGuest;"
echo "Ignoring known MySQL mismatch: ChannelMembers.MentionCountRoot and MsgCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;"
echo "Ignoring known MySQL mismatch: Channels.TotalMsgCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;"

echo "Generating dump"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysqldump --skip-opt --no-data --compact -u root -pmostest migrated > migrated.sql
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysqldump --skip-opt --no-data --compact -u root -pmostest latest > latest.sql
echo "Removing databases created for db comparison"
docker-compose -f $DOCKER_COMPOSE_FILE exec -d -T mysql mysql -uroot -pmostest -e 'DROP DATABASE migrated; DROP DATABASE latest'

echo "Generating diff"
diff migrated.sql latest.sql > diff.txt && echo "Both schemas are same" || (echo "Schema mismatch" && cat diff.txt && exit 1)

docker-compose -f $DOCKER_COMPOSE_FILE down
docker network remove ${DOCKER_NETWORK}
