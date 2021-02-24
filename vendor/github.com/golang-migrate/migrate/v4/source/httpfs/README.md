# httpfs

## Usage

This package could be used to create new migration source drivers that uses
`http.FileSystem` to read migration files.

Struct `httpfs.PartialDriver` partly implements the `source.Driver` interface. It has all
the methods except for `Open()`. Embedding this struct and adding `Open()` method
allows users of this package to create new migration sources. Example:

```go
struct mydriver {
        httpfs.PartialDriver
}

func (d *mydriver) Open(url string) (source.Driver, error) {
	var fs http.FileSystem
	var path string
	var ds mydriver

	// acquire fs and path from url
	// set-up ds if necessary

	if err := ds.Init(fs, path); err != nil {
		return nil, err
	}
	return &ds, nil
}
```

This package also provides a simple `source.Driver` implementation that works
with `http.FileSystem` provided by the user of this package. It is created with
`httpfs.New()` call.

Example of using `http.Dir()` to read migrations from `sql` directory:

```go
	src, err := httpfs.New(http.Dir("sql")
	if err != nil {
		// do something
	}
	m, err := migrate.NewWithSourceInstance("httpfs", src, "database://url")
	if err != nil {
		// do something
	}
        err = m.Up()
	...
```
