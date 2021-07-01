# go_bindata

## Usage



### Read bindata with NewWithSourceInstance

```shell
go get -u github.com/jteeuwen/go-bindata/...
cd examples/migrations && go-bindata -pkg migrations .
```

```go
import (
  "github.com/golang-migrate/migrate/v4"
  "github.com/golang-migrate/migrate/v4/source/go_bindata"
  "github.com/golang-migrate/migrate/v4/source/go_bindata/examples/migrations"
)

func main() {
  // wrap assets into Resource
  s := bindata.Resource(migrations.AssetNames(),
    func(name string) ([]byte, error) {
      return migrations.Asset(name)
    })
    
  d, err := bindata.WithInstance(s)
  m, err := migrate.NewWithSourceInstance("go-bindata", d, "database://foobar")
  m.Up() // run your migrations and handle the errors above of course
}
```

### Read bindata with URL (todo)

This will restore the assets in a tmp directory and then
proxy to source/file. go-bindata must be in your `$PATH`.

```
migrate -source go-bindata://examples/migrations/bindata.go
```


