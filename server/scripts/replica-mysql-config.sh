#!/bin/bash

until docker exec mattermost-mysql sh -c 'mysql -u root -pmostest -e ";"'
do
    echo "Waiting for mattermost-mysql database connection..."
    sleep 4
done

priv_stmt='GRANT REPLICATION SLAVE ON *.* TO "mmuser"@"%" IDENTIFIED BY "mostest"; FLUSH PRIVILEGES;'
docker exec mattermost-mysql sh -c "mysql -u root -pmostest -e '$priv_stmt'"

until docker-compose -f docker-compose.makefile.yml exec mysql-read-replica sh -c 'mysql -u root -pmostest -e ";"'
do
    echo "Waiting for mysql-read-replica database connection..."
    sleep 4
done

docker-ip() {
    docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$@"
}

MS_STATUS=`docker exec mattermost-mysql sh -c 'mysql -u root -pmostest -e "SHOW MASTER STATUS"'`
CURRENT_LOG=`echo $MS_STATUS | awk '{print $6}'`
CURRENT_POS=`echo $MS_STATUS | awk '{print $7}'`

start_slave_stmt="CHANGE MASTER TO MASTER_HOST='$(docker-ip mattermost-mysql)',MASTER_USER='mmuser',MASTER_PASSWORD='mostest',MASTER_LOG_FILE='$CURRENT_LOG',MASTER_LOG_POS=$CURRENT_POS; START SLAVE;"
start_slave_cmd='mysql -u root -pmostest -e "'
start_slave_cmd+="$start_slave_stmt"
start_slave_cmd+='"'
docker exec mattermost-mysql-read-replica sh -c "$start_slave_cmd"

docker exec mattermost-mysql-read-replica sh -c "mysql -u root -pmostest -e 'SHOW SLAVE STATUS \G'"
