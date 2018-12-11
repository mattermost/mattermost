#!/bin/bash

export DCNAME=localdev
export BUILD_NUMBER=null
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
  COMPOSE_PROJECT_NAME=$DCNAME-$BUILD_NUMBER docker-compose run --rm start_dependencies
  COMPOSE_PROJECT_NAME=$DCNAME-$BUILD_NUMBER docker-compose up -d mysql postgres minio inbucket openldap elasticsearch redis

  docker exec -t openldap-$DCNAME-$BUILD_NUMBER bash -c 'echo -e "dn: ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: organizationalunit" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
  docker exec -t openldap-$DCNAME-$BUILD_NUMBER bash -c 'echo -e "dn: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: iNetOrgPerson\nsn: User\ncn: Test1\nmail: success+testone@simulator.amazonses.com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
  docker exec -t openldap-$DCNAME-$BUILD_NUMBER bash -c 'ldappasswd -s Password1 -D "cn=admin,dc=mm,dc=test,dc=com" -x "uid=test.one,ou=testusers,dc=mm,dc=test,dc=com" -w mostest'
  docker exec -t openldap-$DCNAME-$BUILD_NUMBER bash -c 'echo -e "dn: uid=test.two,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: iNetOrgPerson\nsn: User\ncn: Test2\nmail: success+testtwo@simulator.amazonses.com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'
  docker exec -t openldap-$DCNAME-$BUILD_NUMBER bash -c 'ldappasswd -s Password1 -D "cn=admin,dc=mm,dc=test,dc=com" -x "uid=test.two,ou=testusers,dc=mm,dc=test,dc=com" -w mostest'
  docker exec -t openldap-$DCNAME-$BUILD_NUMBER bash -c 'echo -e "dn: cn=tgroup,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: groupOfUniqueNames\nuniqueMember: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest'

  echo "Changing the config.json"
  sed -i'.bak' 's|mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8|mmuser:mostest@tcp(mysql:3306)/mattermost_test?charset=utf8mb4,utf8|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
  sed -i'.bak' 's|"SMTPServer": "dockerhost",|"SMTPServer": "inbucket",|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
  sed -i'.bak' 's|"SMTPPort": "2500",|"SMTPPort": "10025",|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
  sed -i'.bak' 's|"ConnectionUrl": "http://dockerhost:9200",|"ConnectionUrl": "http://elasticsearch:9200",|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json

  docker run -it -u root \
   --privileged \
   -v $GOPATH:/go \
   -w /go/src/github.com/mattermost/mattermost-server/ \
   --net $DCNAME-$BUILD_NUMBER\_mm-test \
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
   mattermost/mattermost-build-server:dec-7-2018 /bin/bash
}

down()
{
  COMPOSE_PROJECT_NAME=$DCNAME-$BUILD_NUMBER docker-compose down

  echo "Reverting the changes in the config.json"
  sed -i'.bak' 's|mmuser:mostest@tcp(mysql:3306)/mattermost_test?charset=utf8mb4,utf8|mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
  sed -i'.bak' 's|"SMTPServer": "inbucket",|"SMTPServer": "dockerhost",|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
  sed -i'.bak' 's|"SMTPPort": "10025",|"SMTPPort": "2500",|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
  sed -i'.bak' 's|"ConnectionUrl": "http://elasticsearch:9200",|"ConnectionUrl": "http://dockerhost:9200",|g' $GOPATH/src/github.com/mattermost/mattermost-server/config/config.json
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
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
done

if [[ "$1" == "" ]]; then
    usage
fi
