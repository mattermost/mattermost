./scripts/jq-dep-check.sh

TMPDIR=`mktemp -d 2>/dev/null || mktemp -d -t 'tmpConfigDir'`
DUMPDIR=`mktemp -d 2>/dev/null || mktemp -d -t 'dumpDir'`
SCHEMA_VERSION=$1

echo "Creating databases"
docker exec mattermost-mysql mysql -uroot -pmostest -e "CREATE DATABASE migrated; CREATE DATABASE latest; GRANT ALL PRIVILEGES ON migrated.* TO mmuser; GRANT ALL PRIVILEGES ON latest.* TO mmuser"

echo "Importing mysql dump from version ${SCHEMA_VERSION}"
docker exec -i mattermost-mysql mysql -D migrated -uroot -pmostest < $(pwd)/scripts/mattermost-mysql-$SCHEMA_VERSION.sql

docker exec -i mattermost-mysql mysql -D migrated -uroot -pmostest -e "INSERT INTO Systems (Name, Value) VALUES ('Version', '$SCHEMA_VERSION')"

echo "Setting up config for db migration"
cat config/config.json | \
    jq '.SqlSettings.DataSource = "mmuser:mostest@tcp(localhost:3306)/migrated?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s"' | \
    jq '.SqlSettings.DriverName = "mysql"' > $TMPDIR/config.json

echo "Running the migration"
make ARGS="db migrate --config $TMPDIR/config.json" run-cli

echo "Setting up config for fresh db setup"
cat config/config.json | \
    jq '.SqlSettings.DataSource = "mmuser:mostest@tcp(localhost:3306)/latest?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s"' | \
    jq '.SqlSettings.DriverName = "mysql"' > $TMPDIR/config.json

echo "Setting up fresh db"
make ARGS="db migrate --config $TMPDIR/config.json" run-cli

if [ "$SCHEMA_VERSION" == "5.0.0" ]; then
  for i in "ChannelMembers SchemeGuest" "ChannelMembers MsgCountRoot" "ChannelMembers MentionCountRoot" "Channels TotalMsgCountRoot"; do
    a=( $i );
    echo "Ignoring known MySQL mismatch: ${a[0]}.${a[1]}"
    docker exec mattermost-mysql mysql -D migrated -uroot -pmostest -e "ALTER TABLE ${a[0]} DROP COLUMN ${a[1]};"
    docker exec mattermost-mysql mysql -D latest -uroot -pmostest -e "ALTER TABLE ${a[0]} DROP COLUMN ${a[1]};"
  done
fi

echo "Generating dump"
docker exec mattermost-mysql mysqldump --skip-opt --no-data --compact -u root -pmostest migrated > $DUMPDIR/migrated.sql
docker exec mattermost-mysql mysqldump --skip-opt --no-data --compact -u root -pmostest latest > $DUMPDIR/latest.sql

echo "Removing databases created for db comparison"
docker exec mattermost-mysql mysql -uroot -pmostest -e "DROP DATABASE migrated; DROP DATABASE latest"

echo "Generating diff"
git diff --word-diff=color $DUMPDIR/migrated.sql $DUMPDIR/latest.sql > $DUMPDIR/diff.txt
diffErrorCode=$?

if [ $diffErrorCode -eq 0 ]; then
    echo "Both schemas are same"
else
    echo "Schema mismatch"
    cat $DUMPDIR/diff.txt
fi
rm -rf $TMPDIR $DUMPDIR

exit $diffErrorCode
