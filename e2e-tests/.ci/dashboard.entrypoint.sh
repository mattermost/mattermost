#!/bin/bash
set -e -u -o pipefail

npm install

# Run migrations. This is also a way to wait for the database to be up
MIGRATION_ATTEMPTS_LEFT=10
MIGRATION_ATTEMPTS_INTERVAL=10
until npm run migrate:latest; do
	MIGRATION_ATTEMPTS_LEFT=$((MIGRATION_ATTEMPTS_LEFT - 1))
	[ "$MIGRATION_ATTEMPTS_LEFT" -gt 0 ] || break
	echo "Migration script failed, sleeping $MIGRATION_ATTEMPTS_INTERVAL"
	sleep $MIGRATION_ATTEMPTS_INTERVAL
done
[ "$MIGRATION_ATTEMPTS_LEFT" -gt 0 ] || {
	echo "Migration script failed, exhausted attempts. Giving up."
	exit 1
}

# Launch the dashboard
exec npm run dev
