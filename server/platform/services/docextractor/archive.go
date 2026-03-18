// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/mholt/archives"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

type archiveExtractor struct {
	SubExtractor Extractor
}

func (ae *archiveExtractor) Name() string {
	return "archiveExtractor"
}

func (ae *archiveExtractor) Match(filename string) bool {
	_, _, err := archives.Identify(context.Background(), filename, nil)
	return err == nil
}

// getExtAlsoTarGz returns the extension of the given file name, special casing .tar.gz.
func getExtAlsoTarGz(name string) string {
	if strings.HasSuffix(name, ".tar.gz") {
		return ".tar.gz"
	}

	return filepath.Ext(name)
}

func (ae *archiveExtractor) Extract(name string, r io.ReadSeeker, maxFileSize int64) (string, error) {
	ext := getExtAlsoTarGz(name)

	// Create a temporary file, using `*` control the random component while preserving the extension.
	f, err := os.CreateTemp("", "archiver-*"+ext)
	if err != nil {
		return "", fmt.Errorf("error creating temporary file: %v", err)
	}
	defer os.Remove(f.Name())

	_, err = io.Copy(f, r)
	f.Close()
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}

	var text strings.Builder
	fsys, err := archives.FileSystem(context.Background(), f.Name(), nil)
	if err != nil {
		return "", fmt.Errorf("error creating file system: %w", err)
	}

	err = fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		text.WriteString(path + " ")
		if ae.SubExtractor != nil {
			filename := filepath.Base(path)
			filename = strings.ReplaceAll(filename, "-", " ")
			filename = strings.ReplaceAll(filename, ".", " ")
			filename = strings.ReplaceAll(filename, ",", " ")

			file, err := fsys.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()

			// Limit the size of decompressed archive entries to prevent
			// memory exhaustion from zip bombs or other malicious archives.
			var reader io.Reader = file
			if maxFileSize > 0 {
				reader = utils.NewLimitedReaderWithError(file, maxFileSize)
			}

			data, err := io.ReadAll(reader)
			if err != nil {
				return fmt.Errorf("error reading archive entry %s: %w", path, err)
			}

			subtext, extractErr := ae.SubExtractor.Extract(filename, bytes.NewReader(data), maxFileSize)
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
