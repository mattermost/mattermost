#!/bin/bash

export COMPOSE_PROJECT_NAME=localdev
local_cmdname=${0##*/}

usage()
{
    cat << USAGE >&2
Usage:
    $local_cmdname up/down
USAGE
    exit 1
}

up()
{
    docker-compose run --rm start_dependencies

    docker-compose exec openldap bash -c 'echo -e "dn: ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: organizationalunit" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
    docker-compose exec openldap bash -c 'echo -e "dn: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: iNetOrgPerson\nsn: User\ncn: Test1\nmail: success+testone@simulator.amazonses.com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
    docker-compose exec openldap bash -c 'ldappasswd -s Password1 -D "cn=admin,dc=mm,dc=test,dc=com" -x "uid=test.one,ou=testusers,dc=mm,dc=test,dc=com" -w mostest'
    docker-compose exec openldap bash -c 'echo -e "dn: uid=test.two,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: iNetOrgPerson\nsn: User\ncn: Test2\nmail: success+testtwo@simulator.amazonses.com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
    docker-compose exec openldap bash -c 'ldappasswd -s Password1 -D "cn=admin,dc=mm,dc=test,dc=com" -x "uid=test.two,ou=testusers,dc=mm,dc=test,dc=com" -w mostest'
    docker-compose exec openldap bash -c 'echo -e "dn: cn=tgroup,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: groupOfUniqueNames\nuniqueMember: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'

    docker run -it -u root \
        --privileged \
        -v $GOPATH:/go \
        -w /go/src/github.com/mattermost/mattermost-server/ \
        --net ${COMPOSE_PROJECT_NAME}_mm-test \
        -e GOPATH="/go" \
        -e TEST_DATABASE_MYSQL_DSN="mmuser:mostest@tcp(mysql:3306)/mattermost_test?charset=utf8mb4,utf8\u0026readTimeout=30s\u0026writeTimeout=30s" \
        -e TEST_DATABASE_POSTGRESQL_DSN="postgres://mmuser:mostest@postgres:5432/mattermost_test?sslmode=disable&connect_timeout=10" \
        -e TEST_DATABASE_MYSQL_ROOT_PASSWD="mostest" \
        -e CI_INBUCKET_HOST="inbucket" \
        -e CI_MINIO_HOST="minio" \
        -e CI_INBUCKET_PORT="10080" \
        -e CI_MINIO_PORT="9000" \
        -e CI_INBUCKET_SMTP_PORT="10025" \
        -e CI_LDAP_HOST="openldap" \
        -e IS_CI=true \
        -e MM_SQLSETTINGS_DATASOURCE="mmuser:mostest@tcp(mysql:3306)/mattermost_test?charset=utf8mb4,utf8" \
        -e MM_EMAILSETTINGS_SMTPSERVER="inbucket" \
        -e MM_EMAILSETTINGS_SMTPPORT="10025" \
        -e MM_ELASTICSEARCHSETTINGS_CONNECTIONURL="http://elasticsearch:9200" \
        mattermost/mattermost-build-server:sep-17-2019 /bin/bash
}

down()
{
    docker-compose down
}

# process arguments
while [[ $# -gt 0 ]]
do
    case "$1" in
        up)
        echo "Starting Containers"
        up
        break
        ;;

        down)
        echo "Stopping Containers"
        down
        break
        ;;

        --help)
        usage
        ;;

        *)
        echo "Unknown argument: $1" >&2
        usage
        ;;
    esac
done

if [[ "$1" == "" ]]; then
    usage
fi
