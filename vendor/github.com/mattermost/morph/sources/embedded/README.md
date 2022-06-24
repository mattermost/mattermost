# embedded source

This source reads migrations from embedded  files, for example using
[go-bindata](github.com/go-bindata/go-bindata) or go embed feature.

## go embed usage

To read the embedded data, create a migration source through the
`WithInstance` method and then instantiate `morph`:

```go
import (
	"embed"
	"path/filepath"

    "github.com/mattermost/morph"
    "github.com/mattermost/morph/sources/embedded"
)

//go:embed testfiles
var assets embed.FS

func main() {
	dirEntries, err := assets.ReadDir("testfiles")
    if err != nil {
        panic(err)
    }

	assetNames := make([]string, len(dirEntries))
	for i, dirEntry := range dirEntries {
		assetNames[i] = dirEntry.Name()
	}

    res := embedded.Resource(assetNames, func(name string) ([]byte, error) {
		return assets.ReadFile(filepath.Join("testfiles", name))
    })

    src, err := embedded.WithInstance(res)
    if err != nil {
        panic(err)
    }

    // create the morph instance from the source and driver
    m := morph.NewFromConnURL("postgres://...", src, opts)
}
```

## go-bindata usage

To read the embedded data, create a migration source through the
`WithInstance` method and then instantiate `morph`:

```go
import (
    "github.com/mattermost/morph"
    "github.com/mattermost/morph/sources/embedded"
    "github.com/mattermost/morph/sources/embedded/testdata"
)

func main() {
    res := embedded.Resource(testdata.AssetNames(), func(name string) ([]byte, error) {
        return testdata.Asset(name)
    })

    src, err := embedded.WithInstance(res)
    if err != nil {
        panic(err)
    }

    // create the morph instance from the source and driver
    m := morph.NewFromConnURL("postgres://...", src, opts)
}
```
