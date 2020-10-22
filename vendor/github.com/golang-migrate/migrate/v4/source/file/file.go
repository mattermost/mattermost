package file

import (
	"net/http"
	nurl "net/url"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/httpfs"
)

func init() {
	source.Register("file", &File{})
}

type File struct {
	httpfs.PartialDriver
	url  string
	path string
}

func (f *File) Open(url string) (source.Driver, error) {
	u, err := nurl.Parse(url)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		p = wd

	} else if p[0:1] == "." || p[0:1] != "/" {
		// make path absolute if relative
		abs, err := filepath.Abs(p)
		if err != nil {
			return nil, err
		}
		p = abs
	}

	nf := &File{
		url:  url,
		path: p,
	}
	if err := nf.Init(http.Dir(p), ""); err != nil {
		return nil, err
	}
	return nf, nil
}
