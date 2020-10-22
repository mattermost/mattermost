# Getting started
Before you start, you should understand the concept of forward/up and reverse/down database migrations.

Configure a database for your application. Make sure that your database driver is supported [here](README.md#databases)

## Create migrations
Create some migrations using migrate CLI. Here is an example:
```
migrate create -ext sql -dir db/migrations -seq create_users_table
```
Once you create your files, you should fill them.

**IMPORTANT:** In a project developed by more than one person there is a chance of migrations inconsistency - e.g. two developers can create conflicting migrations, and the developer that created his migration later gets it merged to the repository first.
Developers and Teams should keep an eye on such cases (especially during code review).
[Here](https://github.com/golang-migrate/migrate/issues/179#issuecomment-475821264) is the issue summary if you would like to read more.

Consider making your migrations idempotent - we can run the same sql code twice in a row with the same result. This makes our migrations more robust. On the other hand, it causes slightly less control over database schema - e.g. let's say you forgot to drop the table in down migration. You run down migration - the table is still there. When you run up migration again - `CREATE TABLE` would return an error, helping you find an issue in down migration, while `CREATE TABLE IF NOT EXISTS` would not. Use those conditions wisely.

In case you would like to run several commands/queries in one migration, you should wrap them in a transaction (if your database supports it).
This way if one of commands fails, our database will remain unchanged.

## Run migrations
Run your migrations through the CLI or your app and check if they applied expected changes.
Just to give you an idea:
```
migrate -database YOUR_DATABASE_URL -path PATH_TO_YOUR_MIGRATIONS up
```

Just add the code to your app and you're ready to go!

Before commiting your migrations you should run your migrations up, down, and then up again to see if migrations are working properly both ways.
(e.g. if you created a table in a migration but reverse migration did not delete it, you will encounter an error when running the forward migration again)
It's also worth checking your migrations in a separate, containerized environment. You can find some tools in the end of this document.

**IMPORTANT:** If you would like to run multiple instances of your app on different machines be sure to use a database that supports locking when running migrations. Otherwise you may encounter issues.

## Forcing your database version
In case you run a migration that contained an error, migrate will not let you run other migrations on the same database. You will see an error like `Dirty database version 1. Fix and force version`, even when you fix the erred migration. This means your database was marked as 'dirty'.
You need to investigate the migration error - was your migration applied partially, or was it not applied at all? Once you know, you should force your database to a version reflecting it's real state. You can do so with `force` command:
```
migrate -path PATH_TO_YOUR_MIGRATIONS -database YOUR_DATABASE_URL force VERSION
```
Once you force the version and your migration was fixed, your database is 'clean' again and you can proceed with your migrations.

For details and example of usage see [this comment](https://github.com/golang-migrate/migrate/issues/282#issuecomment-530743258).

## Further reading:
- [PostgreSQL tutorial](database/postgres/TUTORIAL.md)
- [Best practices](MIGRATIONS.md)
- [FAQ](FAQ.md)
- Tools for testing your migrations in a container:
	- https://github.com/dhui/dktest
	- https://github.com/ory/dockertest
