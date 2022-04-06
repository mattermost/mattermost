package embedded

import (
	"bytes"
	"fmt"
	"io/ioutil"

	"github.com/mattermost/morph/models"
	"github.com/mattermost/morph/sources"
)

type AssetFunc func(name string) ([]byte, error)

func Resource(names []string, fn AssetFunc) *AssetSource {
	return &AssetSource{
		Names:     names,
		AssetFunc: fn,
	}
}

type AssetSource struct {
	Names     []string
	AssetFunc AssetFunc
}

type Embedded struct {
	assetSource *AssetSource
	migrations  []*models.Migration
}

func WithInstance(assetSource *AssetSource) (sources.Source, error) {
	b := &Embedded{
		assetSource: assetSource,
		migrations:  []*models.Migration{},
	}

	for _, filename := range assetSource.Names {
		migrationBytes, err := b.assetSource.AssetFunc(filename)
		if err != nil {
			return nil, fmt.Errorf("cannot read migration %q: %w", filename, err)
		}

		m, err := models.NewMigration(ioutil.NopCloser(bytes.NewReader(migrationBytes)), filename)
		if err != nil {
			return nil, fmt.Errorf("could not create migration: %w", err)
		}

		b.migrations = append(b.migrations, m)
	}

	return b, nil
}

func (b *Embedded) Migrations() []*models.Migration {
	return b.migrations
}
