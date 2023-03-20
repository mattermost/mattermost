/* The script does not update the Systems row that tracks the version, so it is manually updated
   here so that it does not show in the diff. */
UPDATE Systems SET Value = '6.3.0' WHERE Name = 'Version';

/* The script does not update the schema_migrations table, which is automatically used by the
   migrate library to track the version, so we drop it altogether to avoid spurious errors in
   the diff */
DROP TABLE IF EXISTS schema_migrations;

