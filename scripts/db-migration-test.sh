TMPDIR=`mktemp -d 2>/dev/null || mktemp -d -t 'tmpConfigDir'`

cp config/config.json $TMPDIR

echo "Creating databases"
docker run -v $(pwd)/tests:/sql -it --network host --rm mysql:5.7 sh -c 'exec mysql -h 127.0.0.1 -P 3306 -uroot -pmostest -e "CREATE DATABASE migrated; CREATE DATABASE latest; GRANT ALL PRIVILEGES ON migrated.* TO mmuser; GRANT ALL PRIVILEGES ON latest.* TO mmuser"'

echo "Importing mysql dump from version 5.0"
docker run -v $(pwd)/tests:/sql -it --network host --rm mysql:5.7 sh -c 'exec mysql -h 127.0.0.1 -P 3306 -D migrated -uroot -pmostest < /sql/mm5.0-dump.sql'

echo "Setting up config for db migration"
make ARGS="config set SqlSettings.DataSource 'mmuser:mostest@tcp(dockerhost:3306)/migrated?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s' --config $TMPDIR/config.json" run-cli

echo "Running the migration"
make ARGS="version --config $TMPDIR/config.json" run-cli

echo "Setting up config for fresh db setup"
make ARGS="config set SqlSettings.DataSource 'mmuser:mostest@tcp(dockerhost:3306)/latest?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s' --config $TMPDIR/config.json" run-cli

echo "Setting up fresh db"
make ARGS="version --config $TMPDIR/config.json" run-cli

echo "Generating diff"
docker run --network host -it sandeepsukhani/mysql-utilities mysqldiff --difftype=sql --server1=root:mostest@127.0.0.1:3306 migrated:latest --force

echo "Removing databases creating for db comparison"
docker run -v $(pwd)/tests:/sql -it --network host --rm mysql:5.7 sh -c 'exec mysql -h 127.0.0.1 -P 3306 -uroot -pmostest -e "DROP DATABASE migrated; DROP DATABASE latest"'
