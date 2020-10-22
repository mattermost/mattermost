# MySQL

`mysql://user:password@tcp(host:port)/dbname?query`

| URL Query  | WithInstance Config | Description |
|------------|---------------------|-------------|
| `x-migrations-table` | `MigrationsTable` | Name of the migrations table |
| `x-no-lock` | `NoLock` | Set to `true` to skip `GET_LOCK`/`RELEASE_LOCK` statements. Useful for [multi-master MySQL flavors](https://www.percona.com/doc/percona-xtradb-cluster/LATEST/features/pxc-strict-mode.html#explicit-table-locking). Only run migrations from one host when this is enabled. |
| `dbname` | `DatabaseName` | The name of the database to connect to |
| `user` | | The user to sign in as |
| `password` | | The user's password | 
| `host` | | The host to connect to. |
| `port` | | The port to bind to. |
| `tls`  | | TLS / SSL encrypted connection parameter; see [go-sql-driver](https://github.com/go-sql-driver/mysql#tls). Use any name (e.g. `migrate`) if you want to use a custom TLS config (`x-tls-` queries). |
| `x-tls-ca` | | The location of the CA (certificate authority) file. |
| `x-tls-cert` | | The location of the client certicicate file. Must be used with `x-tls-key`. |
| `x-tls-key` | | The location of the private key file. Must be used with `x-tls-cert`. |
| `x-tls-insecure-skip-verify` | | Whether or not to use SSL (true\|false) | 

## Use with existing client

If you use the MySQL driver with existing database client, you must create the client with parameter `multiStatements=true`:

```go
package main

import (
    "database/sql"
    
    _ "github.com/go-sql-driver/mysql"
    "github.com/golang-migrate/migrate"
    "github.com/golang-migrate/migrate/database/mysql"
    _ "github.com/golang-migrate/migrate/source/file"
)

func main() {
    db, _ := sql.Open("mysql", "user:password@tcp(host:port)/dbname?multiStatements=true")
    driver, _ := mysql.WithInstance(db, &mysql.Config{})
    m, _ := migrate.NewWithDatabaseInstance(
        "file:///migrations",
        "mysql", 
        driver,
    )
    
    m.Steps(2)
}
```

## Upgrading from v1

1. Write down the current migration version from schema_migrations
1. `DROP TABLE schema_migrations`
2. Wrap your existing migrations in transactions ([BEGIN/COMMIT](https://dev.mysql.com/doc/refman/5.7/en/commit.html)) if you use multiple statements within one migration.
3. Download and install the latest migrate version.
4. Force the current migration version with `migrate force <current_version>`.
