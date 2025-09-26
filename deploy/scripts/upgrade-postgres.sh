#!/usr/bin/env bash

set -o errexit

##
## Instructions
##
# Dockerfile stolen from contributions in this issue: https://github.com/mattermost/mattermost-docker/issues/489#issuecomment-790277661

# 1. Edit the variables below to match your environment. This uses default variables and assumes you're on 5.31.0.
#    If you're wanting to use another version of Postgres/Mattermost , update the variables as desired.

# 2. run 'sudo bash upgrade-postgres.sh' replace upgrade.sh with what you've named the file.
#    This may take some time to complete as it's migrating the database to Postgres 13.6 from 9.4


if [[ $PATH_TO_MATTERMOST_DOCKER == "" ]]; then
  # shellcheck disable=SC2016
  echo 'Please export environment variable PATH_TO_MATTERMOST_DOCKER with "$ export PATH_TO_MATTERMOST_DOCKER=/path/to/mattermost-docker", i.e. $PWD before running this script. '
  exit 1
fi

##
## Environment Variables
##
# Below are default values in the mattermost-docker container.
# The script is trying to fetch those variables first. Should fetching fail, please export the variables before running the script.
if [[ $POSTGRES_USER == "" ]]; then
  echo "trying to fetch POSTGRES_USER from $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
  POSTGRES_USER=$(grep "^.*-.*POSTGRES_USER=.*$" "$PATH_TO_MATTERMOST_DOCKER"/docker-compose.yml | sed s~^.*-.*POSTGRES_USER=~~g)
  if [[ $POSTGRES_USER == "" ]]; then
    echo "could not find POSTGRES_USER set in $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
    echo "please run 'export POSTGRES_USER=yourPostgresUser' before running this script"
    exit 1
  fi
  echo "found POSTGRES_USER=redacted"
fi

if [[ $POSTGRES_PASSWORD == "" ]]; then
  echo "trying to fetch POSTGRES_PASSWORD from $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
  POSTGRES_PASSWORD=$(grep "^.*-.*POSTGRES_PASSWORD=.*$" "$PATH_TO_MATTERMOST_DOCKER"/docker-compose.yml | sed s~^.*-.*POSTGRES_PASSWORD=~~g)
  if [[ $POSTGRES_PASSWORD == "" ]]; then
    echo "could not find POSTGRES_PASSWORD set in $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
    echo "please run 'export POSTGRES_PASSWORD=yourPostgresPassword' before running this script"
    exit 1
  fi
  echo "found POSTGRES_PASSWORD=redacted"
fi

if [[ $POSTGRES_DB == "" ]]; then
  echo "trying to fetch POSTGRES_DB from $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
  POSTGRES_DB=$(grep "^.*-.*POSTGRES_DB=.*$" "$PATH_TO_MATTERMOST_DOCKER"/docker-compose.yml | sed s~^.*-.*POSTGRES_DB=~~g)
  if [[ $POSTGRES_DB == "" ]]; then
    echo "could not find POSTGRES_DB set in $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
    echo "please run 'export POSTGRES_DB=yourPostgresDatabase' before running this script"
    exit 1
  fi
  echo "found POSTGRES_DB=$POSTGRES_DB"
fi

printf "\n"
if [[ $POSTGRES_OLD_VERSION == "" ]]; then
  echo "trying to fetch POSTGRES_OLD_VERSION by connecting to database container and echoing the environment variable PG_VERSION"
  POSTGRES_OLD_VERSION=$(docker exec mattermost-docker_db_1 bash -c 'echo $PG_VERSION') # i.e. 9.4
  if [[ $POSTGRES_OLD_VERSION == "" ]]; then
    echo "could not connect to database container to get PG_VERSION"
    echo "please run 'export POSTGRES_OLD_VERSION=i.e. 9.4' before running this script"
    echo "check by i.e. running 'sudo cat $PATH_TO_MATTERMOST_DOCKER/volumes/db/var/lib/postgresql/data/PG_VERSION'"
    exit 1
  fi
  echo "found POSTGRES_OLD_VERSION=$POSTGRES_OLD_VERSION"
fi

if [[ $POSTGRES_NEW_VERSION == "" ]]; then
  echo "no exported POSTGRES_NEW_VERSION environment variable found"
  echo "setting POSTGRES_NEW_VERSION environment variable to default 13"
  POSTGRES_NEW_VERSION=13 # i.e. 13
  echo "set POSTGRES_NEW_VERSION=$POSTGRES_NEW_VERSION"
fi


if [[ $POSTGRES_DOCKER_TAG == "" ]]; then
  echo "no exported POSTGRES_DOCKER_TAG environment variable found"
  echo "setting POSTGRES_DOCKER_TAG environment variable to default 13.2-alpine"
  echo "tag needs to be an alpine release to include python3-dev found here - https://hub.docker.com/_/postgres"
  POSTGRES_DOCKER_TAG=13.2-alpine # i.e. '13.2-alpine'
  echo "set POSTGRES_DOCKER_TAG=$POSTGRES_DOCKER_TAG"
fi

if [[ $POSTGRES_OLD_DOCKER_FROM == "" ]]; then
  echo "no exported POSTGRES_OLD_DOCKER_FROM environment variable found"
  echo "setting POSTGRES_OLD_DOCKER_FROM to default '$(grep 'FROM postgres' "$PATH_TO_MATTERMOST_DOCKER"/db/Dockerfile)'"
  POSTGRES_OLD_DOCKER_FROM=$(grep 'FROM postgres' "$PATH_TO_MATTERMOST_DOCKER/db/Dockerfile")
  echo "set POSTGRES_OLD_DOCKER_FROM=$POSTGRES_OLD_DOCKER_FROM"
fi

if [[ $POSTGRES_NEW_DOCKER_FROM == "" ]]; then
  echo "no exported POSTGRES_NEW_DOCKER_FROM environment variable found"
  echo "setting POSTGRES_NEW_DOCKER_FROM to default 'FROM postgres:$POSTGRES_DOCKER_TAG'"
  POSTGRES_NEW_DOCKER_FROM="FROM postgres:$POSTGRES_DOCKER_TAG"
  echo "set POSTGRES_NEW_DOCKER_FROM=$POSTGRES_NEW_DOCKER_FROM"
fi

if [[ $POSTGRES_UPGRADE_LINE == "" ]]; then
  echo "no exported POSTGRES_UPGRADE_LINE environment variable found"
  echo "setting POSTGRES_UPGRADE_LINE to default $POSTGRES_OLD_VERSION-to-$POSTGRES_NEW_VERSION"
  echo "the POSTGRES_UPGRADE_LINE needs to match a folder found here - https://github.com/tianon/docker-postgres-upgrade"
  echo "it should read 'old-to-new'"
  POSTGRES_UPGRADE_LINE=$POSTGRES_OLD_VERSION-to-$POSTGRES_NEW_VERSION # i.e. '9.4-to-13'
  echo "set POSTGRES_UPGRADE_LINE=$POSTGRES_UPGRADE_LINE"
fi

printf "\n"
if [[ $MM_OLD_VERSION == "" ]]; then
  echo "trying to fetch MM_OLD_VERSION from $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
  MM_OLD_VERSION=$(grep ".*-.*MM_VERSION=.*" "$PATH_TO_MATTERMOST_DOCKER"/docker-compose.yml | sed s~.*-.*MM_VERSION=~~g)
  if [[ $MM_OLD_VERSION == "" ]]; then
    echo "could not find MM_OLD_VERSION set in $PATH_TO_MATTERMOST_DOCKER/docker-compose.yml"
    echo "please run 'export MM_OLD_VERSION=yourMMVersion' before running this script"
    exit 1
  fi
  echo "found MM_OLD_VERSION=$MM_OLD_VERSION"
fi

if [[ $MM_NEW_VERSION == "" ]]; then
  echo "no exported MM_NEW_VERSION environment variable found"
  echo "setting MM_NEW_VERSION to default 5.32.1"
  MM_NEW_VERSION=5.32.1
  echo "found MM_NEW_VERSION=$MM_NEW_VERSION"
fi

printf "\n"
echo "Path to mattermost-docker: $PATH_TO_MATTERMOST_DOCKER"
echo "Postgres user: redacted"
echo "Postgres password: redacted"
echo "Postgres database name: $POSTGRES_DB"
echo "Postgres old version: $POSTGRES_OLD_VERSION"
echo "Postgres new version: $POSTGRES_NEW_VERSION"
echo "Postgres alpine docker tag including python3-dev: $POSTGRES_DOCKER_TAG"
echo "Postgres old Dockerfile: $POSTGRES_OLD_DOCKER_FROM"
echo "Postgres new Dockerfile: $POSTGRES_NEW_DOCKER_FROM"
echo "Postgres upgrade-line matches a folder here - https://github.com/tianon/docker-postgres-upgrade: $POSTGRES_UPGRADE_LINE"
echo "Mattermost old version: $MM_OLD_VERSION"
echo "Mattermost new version: $MM_NEW_VERSION"
printf "\n"
df -h
read -rp "Please make sure you have enough disk space left on your devices. Try to backup and upgrade now? (y/n)" choice
if [[ "$choice" != "y" && "$choice" != "Y" && "$choice" != "yes" ]]; then
  exit 0;
fi

##
## Script Start
##
cd "$PATH_TO_MATTERMOST_DOCKER"
docker-compose stop

# Creating a backup folder and backing up the mattermost / database.
mkdir "$PATH_TO_MATTERMOST_DOCKER"/backups
DATE=$(date +'%F-%H-%M')
cp -ra "$PATH_TO_MATTERMOST_DOCKER"/volumes/app/mattermost/ "$PATH_TO_MATTERMOST_DOCKER"/backups/mattermost-backup-"$DATE"/
cp -ra "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/ "$PATH_TO_MATTERMOST_DOCKER"/backups/database-backup-"$DATE"/

mkdir "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/"$POSTGRES_OLD_VERSION"
mv "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/var/lib/postgresql/data/ "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/"$POSTGRES_OLD_VERSION"
rm -rf "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/var
mkdir -p "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/"$POSTGRES_NEW_VERSION"/data


sed -i "s/$POSTGRES_OLD_DOCKER_FROM/$POSTGRES_NEW_DOCKER_FROM/" "$PATH_TO_MATTERMOST_DOCKER"/db/Dockerfile
sed -i "s/python-dev/python3-dev/" "$PATH_TO_MATTERMOST_DOCKER"/db/Dockerfile
sed -i "s/$MM_OLD_VERSION/$MM_NEW_VERSION/" "$PATH_TO_MATTERMOST_DOCKER"/app/Dockerfile


# replacing the old postgres path with a new path
sed -i "s#./volumes/db/var/lib/postgresql/data:/var/lib/postgresql/data#./volumes/db/$POSTGRES_NEW_VERSION/data:/var/lib/postgresql/data#" "$PATH_TO_MATTERMOST_DOCKER"/docker-compose.yml

# migrate the database to the new postgres version
docker run --rm \
    -e PGUSER="$POSTGRES_USER" \
    -e POSTGRES_INITDB_ARGS=" -U $POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -v "$PATH_TO_MATTERMOST_DOCKER"/volumes/db:/var/lib/postgresql \
    tianon/postgres-upgrade:"$POSTGRES_UPGRADE_LINE" \
    --link

cp -p "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/"$POSTGRES_OLD_VERSION"/data/pg_hba.conf "$PATH_TO_MATTERMOST_DOCKER"/volumes/db/"$POSTGRES_NEW_VERSION"/data/

# rebuild the containers
docker-compose build
docker-compose up -d

# reindex the database
echo "REINDEX SCHEMA CONCURRENTLY public;" | docker exec mattermost-docker_db_1 psql -U "$POSTGRES_USER" "$POSTGRES_DB"
cd -
