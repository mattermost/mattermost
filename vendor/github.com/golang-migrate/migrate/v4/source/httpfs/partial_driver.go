package httpfs

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"

	"github.com/golang-migrate/migrate/v4/source"
)

// PartialDriver is a helper service for creating new source drivers working with
// http.FileSystem instances. It implements all source.Driver interface methods
// except for Open(). New driver could embed this struct and add missing Open()
// method.
//
// To prepare PartialDriver for use Init() function.
type PartialDriver struct {
	migrations *source.Migrations
	fs         http.FileSystem
	path       string
}

// Init prepares not initialized PartialDriver instance to read migrations from a
// http.FileSystem instance and a relative path.
func (p *PartialDriver) Init(fs http.FileSystem, path string) error {
	root, err := fs.Open(path)
	if err != nil {
		return err
	}

	files, err := root.Readdir(0)
	if err != nil {
		_ = root.Close()
		return err
	}
	if err = root.Close(); err != nil {
		return err
	}

	ms := source.NewMigrations()
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		m, err := source.DefaultParse(file.Name())
		if err != nil {
			continue // ignore files that we can't parse
		}

		if !ms.Append(m) {
			return source.ErrDuplicateMigration{
				Migration: *m,
				FileInfo:  file,
			}
		}
	}

	p.fs = fs
	p.path = path
	p.migrations = ms
	return nil
}

// Close is part of source.Driver interface implementation. This is a no-op.
func (p *PartialDriver) Close() error {
	return nil
}

// First is part of source.Driver interface implementation.
func (p *PartialDriver) First() (version uint, err error) {
	if version, ok := p.migrations.First(); ok {
		return version, nil
	}
	return 0, &os.PathError{
		Op:   "first",
		Path: p.path,
		Err:  os.ErrNotExist,
	}
}

// Prev is part of source.Driver interface implementation.
func (p *PartialDriver) Prev(version uint) (prevVersion uint, err error) {
	if version, ok := p.migrations.Prev(version); ok {
		return version, nil
	}
	return 0, &os.PathError{
		Op:   "prev for version " + strconv.FormatUint(uint64(version), 10),
		Path: p.path,
		Err:  os.ErrNotExist,
	}
}

// Next is part of source.Driver interface implementation.
func (p *PartialDriver) Next(version uint) (nextVersion uint, err error) {
	if version, ok := p.migrations.Next(version); ok {
		return version, nil
	}
	return 0, &os.PathError{
		Op:   "next for version " + strconv.FormatUint(uint64(version), 10),
		Path: p.path,
		Err:  os.ErrNotExist,
	}
}

// ReadUp is part of source.Driver interface implementation.
func (p *PartialDriver) ReadUp(version uint) (r io.ReadCloser, identifier string, err error) {
	if m, ok := p.migrations.Up(version); ok {
		body, err := p.open(path.Join(p.path, m.Raw))
		if err != nil {
			return nil, "", err
		}
		return body, m.Identifier, nil
	}
	return nil, "", &os.PathError{
		Op:   "read up for version " + strconv.FormatUint(uint64(version), 10),
		Path: p.path,
		Err:  os.ErrNotExist,
	}
}

// ReadDown is part of source.Driver interface implementation.
func (p *PartialDriver) ReadDown(version uint) (r io.ReadCloser, identifier string, err error) {
	if m, ok := p.migrations.Down(version); ok {
		body, err := p.open(path.Join(p.path, m.Raw))
		if err != nil {
			return nil, "", err
		}
		return body, m.Identifier, nil
	}
	return nil, "", &os.PathError{
		Op:   "read down for version " + strconv.FormatUint(uint64(version), 10),
		Path: p.path,
		Err:  os.ErrNotExist,
	}
}

func (p *PartialDriver) open(path string) (http.File, error) {
	f, err := p.fs.Open(path)
	if err == nil {
		return f, nil
	}
	// Some non-standard file systems may return errors that don't include the path, that
	// makes debugging harder.
	if !errors.As(err, new(*os.PathError)) {
		err = &os.PathError{
			Op:   "open",
			Path: path,
			Err:  err,
		}
	}
	return nil, err
}
