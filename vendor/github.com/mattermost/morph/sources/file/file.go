package file

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	"github.com/mattermost/morph/models"
)

type File struct {
	url        string
	path       string
	migrations []*models.Migration
}

func Open(sourceURL string) (*File, error) {
	uri, err := url.Parse(sourceURL)
	if err != nil {
		return nil, err
	}

	// host might be "." for relative URLs like file://./migrations
	p := uri.Opaque
	if len(p) == 0 {
		p = uri.Host + uri.Path
	}

	// if no path provided, default to current directory
	if len(p) == 0 {
		wd, err := os.Getwd()
		if err != nil {
			return nil, err
		}
		p = wd
	} else if p[0:1] != "/" {
		// make path absolute if required
		abs, err := filepath.Abs(p)
		if err != nil {
			return nil, err
		}
		p = abs
	}

	nf := &File{
		url:  sourceURL,
		path: p,
	}

	if err := nf.readMigrations(); err != nil {
		return nil, fmt.Errorf("cannot read migrations in path %q: %w", p, err)
	}

	return nf, nil
}

func (f *File) readMigrations() error {
	info, err := os.Stat(f.path)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("file %q is not a directory", info.Name())
	}

	migrations := []*models.Migration{}
	walkerr := filepath.Walk(f.path, func(path string, info os.FileInfo, _ error) error {
		if info.IsDir() {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}

		m, err := models.NewMigration(file, filepath.Base(path))
		if err != nil {
			return fmt.Errorf("could not create migration: %w", err)
		}

		migrations = append(migrations, m)
		return nil
	})
	if walkerr != nil {
		return walkerr
	}

	f.migrations = migrations
	return nil
}

func (f *File) Migrations() []*models.Migration {
	return f.migrations
}
