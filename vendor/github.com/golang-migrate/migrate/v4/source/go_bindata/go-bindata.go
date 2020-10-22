package bindata

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"

	"github.com/golang-migrate/migrate/v4/source"
)

type AssetFunc func(name string) ([]byte, error)

func Resource(names []string, afn AssetFunc) *AssetSource {
	return &AssetSource{
		Names:     names,
		AssetFunc: afn,
	}
}

type AssetSource struct {
	Names     []string
	AssetFunc AssetFunc
}

func init() {
	source.Register("go-bindata", &Bindata{})
}

type Bindata struct {
	path        string
	assetSource *AssetSource
	migrations  *source.Migrations
}

func (b *Bindata) Open(url string) (source.Driver, error) {
	return nil, fmt.Errorf("not yet implemented")
}

var (
	ErrNoAssetSource = fmt.Errorf("expects *AssetSource")
)

func WithInstance(instance interface{}) (source.Driver, error) {
	if _, ok := instance.(*AssetSource); !ok {
		return nil, ErrNoAssetSource
	}
	as := instance.(*AssetSource)

	bn := &Bindata{
		path:        "<go-bindata>",
		assetSource: as,
		migrations:  source.NewMigrations(),
	}

	for _, fi := range as.Names {
		m, err := source.DefaultParse(fi)
		if err != nil {
			continue // ignore files that we can't parse
		}

		if !bn.migrations.Append(m) {
			return nil, fmt.Errorf("unable to parse file %v", fi)
		}
	}

	return bn, nil
}

func (b *Bindata) Close() error {
	return nil
}

func (b *Bindata) First() (version uint, err error) {
	if v, ok := b.migrations.First(); !ok {
		return 0, &os.PathError{Op: "first", Path: b.path, Err: os.ErrNotExist}
	} else {
		return v, nil
	}
}

func (b *Bindata) Prev(version uint) (prevVersion uint, err error) {
	if v, ok := b.migrations.Prev(version); !ok {
		return 0, &os.PathError{Op: fmt.Sprintf("prev for version %v", version), Path: b.path, Err: os.ErrNotExist}
	} else {
		return v, nil
	}
}

func (b *Bindata) Next(version uint) (nextVersion uint, err error) {
	if v, ok := b.migrations.Next(version); !ok {
		return 0, &os.PathError{Op: fmt.Sprintf("next for version %v", version), Path: b.path, Err: os.ErrNotExist}
	} else {
		return v, nil
	}
}

func (b *Bindata) ReadUp(version uint) (r io.ReadCloser, identifier string, err error) {
	if m, ok := b.migrations.Up(version); ok {
		body, err := b.assetSource.AssetFunc(m.Raw)
		if err != nil {
			return nil, "", err
		}
		return ioutil.NopCloser(bytes.NewReader(body)), m.Identifier, nil
	}
	return nil, "", &os.PathError{Op: fmt.Sprintf("read version %v", version), Path: b.path, Err: os.ErrNotExist}
}

func (b *Bindata) ReadDown(version uint) (r io.ReadCloser, identifier string, err error) {
	if m, ok := b.migrations.Down(version); ok {
		body, err := b.assetSource.AssetFunc(m.Raw)
		if err != nil {
			return nil, "", err
		}
		return ioutil.NopCloser(bytes.NewReader(body)), m.Identifier, nil
	}
	return nil, "", &os.PathError{Op: fmt.Sprintf("read version %v", version), Path: b.path, Err: os.ErrNotExist}
}
