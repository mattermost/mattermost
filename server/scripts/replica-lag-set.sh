#!/bin/bash

stmt="STOP SLAVE SQL_THREAD FOR CHANNEL '';CHANGE MASTER TO MASTER_DELAY = $1;START SLAVE SQL_THREAD FOR CHANNEL '';SHOW SLAVE STATUS\G;"
docker exec mattermost-mysql-read-replica sh -c "export MYSQL_PWD=mostest; mysql -u root -e \"$stmt\"" | grep SQL_Delay