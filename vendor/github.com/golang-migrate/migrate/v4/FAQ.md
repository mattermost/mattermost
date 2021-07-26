# FAQ

#### How is the code base structured?
  ```
  /          package migrate (the heart of everything)
  /cli       the CLI wrapper
  /database  database driver and sub directories have the actual driver implementations
  /source    source driver and sub directories have the actual driver implementations
  ```

#### Why is there no `source/driver.go:Last()`?
  It's not needed. And unless the source has a "native" way to read a directory in reversed order,
  it might be expensive to do a full directory scan in order to get the last element.

#### What is a NilMigration? NilVersion?
  NilMigration defines a migration without a body. NilVersion is defined as const -1.

#### What is the difference between uint(version) and int(targetVersion)?
  version refers to an existing migration version coming from a source and therefore can never be negative.
  targetVersion can either be a version OR represent a NilVersion, which equals -1.

#### What's the difference between Next/Previous and Up/Down?
  ```
  1_first_migration.up.extension           next ->  2_second_migration.up.extension      ...
  1_first_migration.down.extension  <- previous     2_second_migration.down.extension    ...
  ```

#### Why two separate files (up and down) for a migration?
  It makes all of our lives easier. No new markup/syntax to learn for users
  and existing database utility tools continue to work as expected.

#### How many migrations can migrate handle?
  Whatever the maximum positive signed integer value is for your platform.
  For 32bit it would be 2,147,483,647 migrations. Migrate only keeps references to
  the currently run and pre-fetched migrations in memory. Please note that some
  source drivers need to do build a full "directory" tree first, which puts some
  heat on the memory consumption.

#### Are the table tests in migrate_test.go bloated?
  Yes and no. There are duplicate test cases for sure but they don't hurt here. In fact
  the tests are very visual now and might help new users understand expected behaviors quickly.
  Migrate from version x to y and y is the last migration? Just check out the test for
  that particular case and know what's going on instantly.

#### What is Docker being used for?
  Only for testing. See [testing/docker.go](testing/docker.go)

#### Why not just use docker-compose?
  It doesn't give us enough runtime control for testing. We want to be able to bring up containers fast
  and whenever we want, not just once at the beginning of all tests.

#### Can I maintain my driver in my own repository?
  Yes, technically thats possible. We want to encourage you to contribute your driver to this respository though.
  The driver's functionality is dictated by migrate's interfaces. That means there should really
  just be one driver for a database/ source. We want to prevent a future where several drivers doing the exact same thing,
  just implemented a bit differently, co-exist somewhere on GitHub. If users have to do research first to find the
  "best" available driver for a database in order to get started, we would have failed as an open source community.

#### Can I mix multiple sources during a batch of migrations?
  No.

#### What does "dirty" database mean?
  Before a migration runs, each database sets a dirty flag. Execution stops if a migration fails and the dirty state persists,
  which prevents attempts to run more migrations on top of a failed migration. You need to manually fix the error
  and then "force" the expected version.

#### What happens if two programs try and update the database at the same time?
Database-specific locking features are used by *some* database drivers to prevent multiple instances of migrate from running migrations at the same time
  the same database at the same time. For example, the MySQL driver uses the `GET_LOCK` function, while the Postgres driver uses
  the `pg_advisory_lock` function.

#### Do I need to create a table for tracking migration version used?
No, it is done automatically.

#### Can I use migrate with a non-Go project?
Yes, you can use the migrate CLI in a non-Go project, but there are probably other libraries/frameworks available that offer better test and deploy integrations in that language/framework.

#### I have got an error `Dirty database version 1. Fix and force version`. What should I do?
Keep calm and refer to [the getting started docs](GETTING_STARTED.md#forcing-your-database-version).
