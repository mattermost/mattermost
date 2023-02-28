// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func sanitizePath(p string) string {
	dir := strings.ReplaceAll(filepath.Dir(filepath.Clean(p)), "..", "")
	base := filepath.Base(p)
	if strings.Count(base, ".") == len(base) {
		return ""
	}
	return filepath.Join(dir, base)
}

// UnzipToPath extracts a given zip archive into a given path.
// It returns a list of extracted paths.
func UnzipToPath(zipFile io.ReaderAt, size int64, outPath string) ([]string, error) {
	rd, err := zip.NewReader(zipFile, size)
	if err != nil {
		return nil, fmt.Errorf("failed to create reader: %w", err)
	}

	paths := make([]string, len(rd.File))
	for i, f := range rd.File {
		filePath := sanitizePath(f.Name)
		if filePath == "" {
			return nil, fmt.Errorf("invalid filepath `%s`", f.Name)
		}
		path := filepath.Join(outPath, filePath)
		paths[i] = path
		if f.FileInfo().IsDir() {
			if err := os.Mkdir(path, 0700); err != nil {
				return nil, fmt.Errorf("failed to create directory: %w", err)
			}
			continue
		}
		if _, err := os.Stat(filepath.Dir(path)); os.IsNotExist(err) {
			if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
				return nil, fmt.Errorf("failed to create directory: %w", err)
			}
		}
		outFile, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0600)
		if err != nil {
			return nil, fmt.Errorf("failed to create file: %w", err)
		}
		defer outFile.Close()

		file, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open file: %w", err)
		}
		defer file.Close()

		if _, err := io.Copy(outFile, file); err != nil {
			return nil, fmt.Errorf("failed to write to file: %w", err)
		}
	}

	return paths, nil
}
