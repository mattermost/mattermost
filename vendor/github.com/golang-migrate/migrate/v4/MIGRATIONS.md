# Migrations

## Migration Filename Format

A single logical migration is represented as two separate migration files, one
to migrate "up" to the specified version from the previous version, and a second
to migrate back "down" to the previous version.  These migrations can be provided
by any one of the supported [migration sources](./README.md#migration-sources).

The ordering and direction of the migration files is determined by the filenames
used for them.  `migrate` expects the filenames of migrations to have the format:

    {version}_{title}.up.{extension}
    {version}_{title}.down.{extension}

The `title` of each migration is unused, and is only for readability.  Similarly,
the `extension` of the migration files is not checked by the library, and should
be an appropriate format for the database in use (`.sql` for SQL variants, for
instance).

Versions of migrations may be represented as any 64 bit unsigned integer.
All migrations are applied upward in order of increasing version number, and
downward by decreasing version number.

Common versioning schemes include incrementing integers:

    1_initialize_schema.down.sql
    1_initialize_schema.up.sql
    2_add_table.down.sql
    2_add_table.up.sql
    ...

Or timestamps at an appropriate resolution:

    1500360784_initialize_schema.down.sql
    1500360784_initialize_schema.up.sql
    1500445949_add_table.down.sql
    1500445949_add_table.up.sql
    ...

But any scheme resulting in distinct, incrementing integers as versions is valid.

It is suggested that the version number of corresponding `up` and `down` migration
files be equivalent for clarity, but they are allowed to differ so long as the
relative ordering of the migrations is preserved.

The migration files are permitted to be "empty", in the event that a migration
is a no-op or is irreversible. It is recommended to still include both migration
files by making the whole migration file consist of a comment.
If your database does not support comments, then deleting the migration file will also work.
Note, an actual empty file (e.g. a 0 byte file) may cause issues with your database since migrate
will attempt to run an empty query. In this case, deleting the migration file will also work.
For the rational of this behavior see:
[#244 (comment)](https://github.com/golang-migrate/migrate/issues/244#issuecomment-510758270)

## Migration Content Format

The format of the migration files themselves varies between database systems.
Different databases have different semantics around schema changes and when and
how they are allowed to occur
(for instance, [if schema changes can occur within a transaction](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis)).

As such, the `migrate` library has little to no checking around the format of
migration sources.  The migration files are generally processed directly by the
drivers as raw operations.

## Reversibility of Migrations

Best practice for writing schema migration is that all migrations should be
reversible.  It should in theory be possible for run migrations down and back up
through any and all versions with the state being fully cleaned and recreated
by doing so.

By adhering to this recommended practice, development and deployment of new code
is cleaner and easier (cleaning database state for a new feature should be as
easy as migrating down to a prior version, and back up to the latest).

As opposed to some other migration libraries, `migrate` represents up and down
migrations as separate files.  This prevents any non-standard file syntax from
being introduced which may result in unintended behavior or errors, depending
on what database is processing the file.

While it is technically possible for an up or down migration to exist on its own
without an equivalently versioned counterpart, it is strongly recommended to
always include a down migration which cleans up the state of the corresponding
up migration.
