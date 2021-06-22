# postgres

`postgres://user:password@host:port/dbname?query` (`postgresql://` works, too)

| URL Query  | WithInstance Config | Description |
|------------|---------------------|-------------|
| `x-migrations-table` | `MigrationsTable` | Name of the migrations table |
| `x-statement-timeout` | `StatementTimeout` | Abort any statement that takes more than the specified number of milliseconds |
| `dbname` | `DatabaseName` | The name of the database to connect to |
| `search_path` | | This variable specifies the order in which schemas are searched when an object is referenced by a simple name with no schema specified. |
| `user` | | The user to sign in as |
| `password` | | The user's password | 
| `host` | | The host to connect to. Values that start with / are for unix domain sockets. (default is localhost) |
| `port` | | The port to bind to. (default is 5432) |
| `fallback_application_name` | | An application_name to fall back to if one isn't provided. |
| `connect_timeout` | | Maximum wait for connection, in seconds. Zero or not specified means wait indefinitely. |
| `sslcert` | | Cert file location. The file must contain PEM encoded data. |
| `sslkey` | | Key file location. The file must contain PEM encoded data. |
| `sslrootcert` | | The location of the root certificate file. The file must contain PEM encoded data. | 
| `sslmode` | | Whether or not to use SSL (disable\|require\|verify-ca\|verify-full) |


## Upgrading from v1

1. Write down the current migration version from schema_migrations
1. `DROP TABLE schema_migrations`
2. Wrap your existing migrations in transactions ([BEGIN/COMMIT](https://www.postgresql.org/docs/current/static/transaction-iso.html)) if you use multiple statements within one migration.
3. Download and install the latest migrate version.
4. Force the current migration version with `migrate force <current_version>`.
