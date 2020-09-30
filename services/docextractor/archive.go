package docextractor

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/mholt/archiver/v3"
)

type archiveExtractor struct {
	SubExtractor Extractor
}

func (ae *archiveExtractor) Match(filename string) bool {
	_, err := archiver.ByExtension(filename)
	if err == nil {
		return true
	}
	return false
}

func (ae *archiveExtractor) Extract(name string, r io.Reader) (string, error) {
	dir, err := ioutil.TempDir(os.TempDir(), "archiver")
	if err != nil {
		return "", fmt.Errorf("error creating temporary file: %v", err)
	}
	defer os.RemoveAll(dir)

	f, err := os.Create(filepath.Join(dir, name))
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}
	_, err = io.Copy(f, r)
	f.Close()
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}

	text := ""
	err = archiver.Walk(f.Name(), func(file archiver.File) error {
		text += file.Name()
		text += " "
		if ae.SubExtractor != nil {
			filename := filepath.Base(file.Name())
			subtext, err := ae.SubExtractor.Extract(filename, file)
			if err == nil {
				text += subtext
				text += " "
			}
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	return text, nil
}
