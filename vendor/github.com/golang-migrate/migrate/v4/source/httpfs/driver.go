package httpfs

import (
	"errors"
	"net/http"

	"github.com/golang-migrate/migrate/v4/source"
)

// driver is a migration source driver for reading migrations from
// http.FileSystem instances. It implements source.Driver interface and can be
// used as a migration source for the main migrate library.
type driver struct {
	PartialDriver
}

// New creates a new migrate source driver from a http.FileSystem instance and a
// relative path to migration files within the virtual FS.
func New(fs http.FileSystem, path string) (source.Driver, error) {
	var d driver
	if err := d.Init(fs, path); err != nil {
		return nil, err
	}
	return &d, nil
}

// Open completes the implementetion of source.Driver interface. Other methods
// are implemented by the embedded PartialDriver struct.
func (d *driver) Open(url string) (source.Driver, error) {
	return nil, errors.New("Open() cannot be called on the httpfs passthrough driver")
}
