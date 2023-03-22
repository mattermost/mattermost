// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/mholt/archiver/v3"
)

type archiveExtractor struct {
	SubExtractor Extractor
}

func (ae *archiveExtractor) Match(filename string) bool {
	_, err := archiver.ByExtension(filename)
	return err == nil
}

func (ae *archiveExtractor) Extract(name string, r io.ReadSeeker) (string, error) {
	dir, err := os.MkdirTemp(os.TempDir(), "archiver")
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

	var text strings.Builder
	err = archiver.Walk(f.Name(), func(file archiver.File) error {
		text.WriteString(file.Name() + " ")
		if ae.SubExtractor != nil {
			filename := filepath.Base(file.Name())
			filename = strings.ReplaceAll(filename, "-", " ")
			filename = strings.ReplaceAll(filename, ".", " ")
			filename = strings.ReplaceAll(filename, ",", " ")
			data, err2 := io.ReadAll(file)
			if err2 != nil {
				return err2
			}
			subtext, extractErr := ae.SubExtractor.Extract(filename, bytes.NewReader(data))
			if extractErr == nil {
				text.WriteString(subtext + " ")
			}
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	return text.String(), nil
}
