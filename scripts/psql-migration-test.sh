TMPDIR=`mktemp -d 2>/dev/null || mktemp -d -t 'tmpConfigDir'`
DUMPDIR=`mktemp -d 2>/dev/null || mktemp -d -t 'dumpDir'`

cp config/config.json $TMPDIR

echo "Creating databases"
docker exec mattermost-postgres sh -c 'exec echo "CREATE DATABASE migrated; CREATE DATABASE latest;" | exec psql -U mmuser mattermost_test'

echo "Importing mysql dump from version 5.0"
docker exec -i mattermost-postgres psql -U mmuser -d migrated < $(pwd)/tests/mm5.0-dump.psql

echo "Setting up config for db migration"
make ARGS="config set SqlSettings.DataSource 'postgres://mmuser:mostest@dockerhost:5432/migrated?sslmode=disable&connect_timeout=10' --config $TMPDIR/config.json" run-cli
make ARGS="config set SqlSettings.DriverName 'postgres' --config $TMPDIR/config.json" run-cli

echo "Running the migration"
make ARGS="version --config $TMPDIR/config.json" run-cli

echo "Setting up config for fresh db setup"
make ARGS="config set SqlSettings.DataSource 'postgres://mmuser:mostest@dockerhost:5432/latest?sslmode=disable&connect_timeout=10' --config $TMPDIR/config.json" run-cli

echo "Setting up fresh db"
make ARGS="version --config $TMPDIR/config.json" run-cli

echo "Generating dump"
docker exec mattermost-postgres pg_dump --schema-only -d migrated -U mmuser > $DUMPDIR/migrated.psql
docker exec mattermost-postgres pg_dump --schema-only -d latest -U mmuser > $DUMPDIR/latest.psql

echo "Generating diff"
diff $DUMPDIR/migrated.psql $DUMPDIR/latest.psql > $DUMPDIR/diff.txt

echo "Removing databases created for db comparison"
docker exec mattermost-postgres sh -c 'exec echo "DROP DATABASE migrated; DROP DATABASE latest;" | exec psql -U mmuser mattermost_test'

if [ ! -s $DUMPDIR/diff.txt ]; then echo "Both schemas are same";else echo "Schema differs, here is the diff:" && cat $DUMPDIR/diff.txt ;fi
rm -rf $TMPDIR $DUMPDIR
