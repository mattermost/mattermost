[![](https://godoc.org/github.com/jackc/pgconn?status.svg)](https://godoc.org/github.com/jackc/pgconn)
[![Build Status](https://travis-ci.org/jackc/pgconn.svg)](https://travis-ci.org/jackc/pgconn)

# pgconn

Package pgconn is a low-level PostgreSQL database driver. It operates at nearly the same level as the C library libpq.
It is primarily intended to serve as the foundation for higher level libraries such as https://github.com/jackc/pgx.
Applications should handle normal queries with a higher level library and only use pgconn directly when required for
low-level access to PostgreSQL functionality.

## Example Usage

```go
pgConn, err := pgconn.Connect(context.Background(), os.Getenv("DATABASE_URL"))
if err != nil {
	log.Fatalln("pgconn failed to connect:", err)
}
defer pgConn.Close()

result := pgConn.ExecParams(context.Background(), "SELECT email FROM users WHERE id=$1", [][]byte{[]byte("123")}, nil, nil, nil)
for result.NextRow() {
	fmt.Println("User 123 has email:", string(result.Values()[0]))
}
_, err := result.Close()
if err != nil {
	log.Fatalln("failed reading result:", err)
})
```

## Testing

The pgconn tests require a PostgreSQL database. It will connect to the database specified in the `PGX_TEST_CONN_STRING`
environment variable. The `PGX_TEST_CONN_STRING` environment variable can be a URL or DSN. In addition, the standard `PG*`
environment variables will be respected. Consider using [direnv](https://github.com/direnv/direnv) to simplify
environment variable handling.

### Example Test Environment

Connect to your PostgreSQL server and run:

```
create database pgx_test;
```

Now you can run the tests:

```bash
PGX_TEST_CONN_STRING="host=/var/run/postgresql dbname=pgx_test" go test ./...
```

### Connection and Authentication Tests

Pgconn supports multiple connection types and means of authentication. These tests are optional. They
will only run if the appropriate environment variable is set. Run `go test -v | grep SKIP` to see if any tests are being
skipped. Most developers will not need to enable these tests. See `travis.yml` for an example set up if you need change
authentication code.
