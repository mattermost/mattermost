package parser

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func normalizePath(path string) string {
	// use lower case, as Windows file systems will almost always be case insensitive 
	return strings.ToLower(strings.Replace(path, "\\", "/", -1))
}

func getPkgPath(fname string, isDir bool) (string, error) {
	// path.IsAbs doesn't work properly on Windows; use filepath.IsAbs instead
	if !filepath.IsAbs(fname) {
		pwd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		fname = path.Join(pwd, fname)
	}

	fname = normalizePath(fname)

	gopath := os.Getenv("GOPATH")
	if gopath == "" {
		var err error
		gopath, err = getDefaultGoPath()
		if err != nil {
			return "", fmt.Errorf("cannot determine GOPATH: %s", err)
		}
	}

	for _, p := range strings.Split(os.Getenv("GOPATH"), ";") {
		prefix := path.Join(normalizePath(p), "src") + "/"
		if rel := strings.TrimPrefix(fname, prefix); rel != fname {
			if !isDir {
				return path.Dir(rel), nil
			} else {
				return path.Clean(rel), nil
			}
		}
	}

	return "", fmt.Errorf("file '%v' is not in GOPATH", fname)
}
