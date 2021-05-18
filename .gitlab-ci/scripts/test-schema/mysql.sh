#!/bin/bash
set -xe

echo $DOCKER_HOST
docker ps
export COMPOSE_PROJECT_NAME="${CI_PIPELINE_IID}-${CI_JOB_NAME}"
DOCKER_NETWORK="${CI_PIPELINE_IID}-${CI_JOB_NAME}"_schemamysql
DOCKER_COMPOSE_FILE="gitlab-dc.mysql.yml"
docker network create ${DOCKER_NETWORK}
ulimit -n 8096
cd build
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi run --rm start_dependencies
cat ../tests/test-data.ldif | docker-compose --no-ansi exec -T openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T minio sh -c 'mkdir -p /data/mattermost-test'
sleep 5
docker run --net ${DOCKER_NETWORK} appropriate/curl:latest sh -c "until curl --max-time 5 --output - http://mysql:3306; do echo waiting for mysql; sleep 5; done;"
docker run --net ${DOCKER_NETWORK} appropriate/curl:latest sh -c "until curl --max-time 5 --output - http://elasticsearch:9200; do echo waiting for elasticsearch; sleep 5; done;"

echo "Creating databases"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -uroot -pmostest -e "CREATE DATABASE migrated; CREATE DATABASE latest; GRANT ALL PRIVILEGES ON migrated.* TO mmuser; GRANT ALL PRIVILEGES ON latest.* TO mmuser"
echo "Importing mysql dump from version 5.0"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D migrated -uroot -pmostest < ../scripts/mattermost-mysql-5.0.sql
docker run -d -it --name server-mysql --net ${DOCKER_NETWORK} \
  --env-file="dotenv/test-schema-validation.env" \
  --env MM_SQLSETTINGS_DATASOURCE="mmuser:mostest@tcp(mysql:3306)/migrated?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s" \
  --env MM_SQLSETTINGS_DRIVERNAME=mysql \
  -v $CI_PROJECT_DIR:/mattermost-server \
  -w /mattermost-server \
  mattermost/mattermost-build-server:20201119_golang-1.15.5 \
  bash -c "ulimit -n 8096; make ARGS='version' run-cli && make MM_SQLSETTINGS_DATASOURCE='mmuser:mostest@tcp(mysql:3306)/latest?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s' ARGS='version' run-cli"
docker logs -f server-mysql

echo "Ignoring known MySQL mismatch: ChannelMembers.SchemeGuest"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN SchemeGuest;"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN SchemeGuest;"
echo "Ignoring known MySQL mismatch: ChannelMembers.MentionCountRoot and MsgCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;"
echo "Ignoring known MySQL mismatch: Channels.TotalMsgCountRoot"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;"

echo "Generating dump"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysqldump --skip-opt --no-data --compact -u root -pmostest migrated > migrated.sql
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysqldump --skip-opt --no-data --compact -u root -pmostest latest > latest.sql
echo "Removing databases created for db comparison"
docker-compose -f $DOCKER_COMPOSE_FILE --no-ansi exec -T mysql mysql -uroot -pmostest -e 'DROP DATABASE migrated; DROP DATABASE latest'

echo "Generating diff"
diff migrated.sql latest.sql > diff.txt && echo "Both schemas are same" || (echo "Schema mismatch" && cat diff.txt && exit 1)
