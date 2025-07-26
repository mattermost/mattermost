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

func sanitizePath(outPath, p string) (string, error) {
	cleanedPath := filepath.Clean(p)
	absOutPath, err := filepath.Abs(outPath)
	if err != nil {
		return "", fmt.Errorf("failed to resolve output path: %w", err)
	}
	absPath, err := filepath.Abs(filepath.Join(absOutPath, cleanedPath))
	if err != nil {
		return "", fmt.Errorf("failed to resolve file path: %w", err)
	}
	if !strings.HasPrefix(absPath, absOutPath) {
		return "", fmt.Errorf("invalid filepath `%s`", p)
	}
	return absPath, nil
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
		filePath, err := sanitizePath(outPath, f.Name)
		if err != nil {
			return nil, fmt.Errorf("invalid filepath `%s`: %w", f.Name, err)
		}
		path := filePath
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
