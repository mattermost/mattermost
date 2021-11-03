package file

import (
	nurl "net/url"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func init() {
	source.Register("file", &File{})
}

type File struct {
	iofs.PartialDriver
	url  string
	path string
}

func (f *File) Open(url string) (source.Driver, error) {
	p, err := parseURL(url)
	if err != nil {
		return nil, err
	}
	nf := &File{
		url:  url,
		path: p,
	}
	if err := nf.Init(os.DirFS(p), "."); err != nil {
		return nil, err
	}
	return nf, nil
}

func parseURL(url string) (string, error) {
	u, err := nurl.Parse(url)
	if err != nil {
		return "", err
	}
	// concat host and path to restore full path
	// host might be `.`
	p := u.Opaque
	if len(p) == 0 {
		p = u.Host + u.Path
	}

	if len(p) == 0 {
		// default to current directory if no path
		wd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		p = wd

	} else if p[0:1] == "." || p[0:1] != "/" {
		// make path absolute if relative
		abs, err := filepath.Abs(p)
		if err != nil {
			return "", err
		}
		p = abs
	}
	return p, nil
}
