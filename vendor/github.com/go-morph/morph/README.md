![](https://avatars.githubusercontent.com/u/80110794?s=200&v=4)


[![GitHub Workflow Status (branch)](https://img.shields.io/github/workflow/status/go-morph/morph/CI)](https://github.com/go-morph/morph/actions/workflows/ci.yml?query=branch%3Amaster)
[![GoDoc](https://pkg.go.dev/badge/github.com/go-morph/migrate)](https://pkg.go.dev/github.com/go-morph/morph)

# Morph

Morph is a database migration tool that helps you to apply your migrations. It is written with Go so you can use it from your Go application as well.

## Usage

It can be used as a library or a CLI tool.

### Library

```Go
import (
    "github.com/go-morph/morph"
    "github.com/go-morph/morph/drivers/mysql"
    bindata "github.com/go-morph/morph/sources/go_bindata"
)

src, err := bindata.WithInstance(&bindata.AssetSource{
    Names: []string{}, // add migration file names
    AssetFunc: func(name string) ([]byte, error) {
        return []byte{}, nil // should return the file contents
    },
})
if err != nil {
    return err
}
defer src.Close()

driver, err := mysql.WithInstance(db, &mysql.Config{})
if err != nil {
    return err
}

engine, err := morph.New(driver, src)
if err != nil {
    return err
}
defer engine.Close()

engine.ApplyAll()

```

### CLI

To install `morph` you can use:

```bash
go install github.com/go-morph/morph/cmd/morph@latest
```

Then you can apply your migrations like below:

```bash
morph apply up --driver postgres --dsn "postgres://user:pass@localhost:5432/mydb?sslmode=disable" --path ./db/migrations/postgres --number 1
```

## Migration Files

The migrations files should have an `up` and `down` versions. The program requires each migration to be reversible, and the naming of the migration should be in the following form:
```
0000000001_create_user.up.sql
0000000001_create_user.down.sql
```

The first part will be used to determine the order in which the migrations should be applied and the next part until the `up|down.sql` suffix will be the migration name.

The program requires this naming convention to be followed as it saves the order and names of the migrations. Also, it can rollback migrations with the `down` files.

## LICENSE

[MIT](LICENSE)
