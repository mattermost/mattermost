#!/bin/bash

export MM_SQLSETTINGS_DRIVERNAME=mysql

(go test -v github.com/mattermost/mattermost-server/v5/app -run ^TestReplyToPost$ -mysql-replica && \
go test -v github.com/mattermost/mattermost-server/v5/enterprise/ldap -run ^TestFirstLoginSync$ -mysql-replica && \
go test -v github.com/mattermost/mattermost-server/v5/api4 -run ^TestLoginReplicationLag$ -mysql-replica && \
go test -v github.com/mattermost/mattermost-server/v5/enterprise/ldap -run ^TestSyncMembershipsWithLag$ -mysql-replica) | grep -i "fail:\|pass:"