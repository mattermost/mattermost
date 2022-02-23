# go-bindata source

This source reads migrations from a
[go-bindata](github.com/go-bindata/go-bindata) embedded binary file.

## Usage

To read the embedded data, create a migration source through the
`WithInstance` method and then instantiate `morph`:

```go
import (
    "github.com/mattermost/morph"
    "github.com/mattermost/morph/sources/go_bindata"
    "github.com/mattermost/morph/sources/go_bindata/testdata"
)

func main() {
    res := bindata.Resource(testdata.AssetNames(), func(name string) ([]byte, error) {
        return testdata.Asset(name)
    })

    src, err := bindata.WithInstance(res)
    if err != nil {
        panic(err)
    }

    // create the morph instance from the source and driver
    m := morph.NewFromConnURL("postgres://...", src, opts)
}
```
