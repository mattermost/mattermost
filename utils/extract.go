// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/errors"
)

func sanitize(path string) (string, error) {
	// Start by trimming redundant trailing slashes.
	normalizedPath := strings.TrimRight(path, "/")

	// Then anchor at '/' to allow us to leverage filepath.Clean's behaviour of stripping all
	// instances of '../' for rooted paths. Note that we intentionally avoid filepath.Join
	// here since it would call Clean prematurely.
	if !strings.HasPrefix(normalizedPath, "/") {
		normalizedPath = "/" + normalizedPath
	}

	// Finally call filepath.Clean to resolve all instances of ../, collapsing any at the
	// start of the path altogether.
	cleanPath := filepath.Clean(normalizedPath)

	// Compare the (partially) normalized path with the clean path: if there are differences,
	// then filepath.Clean made changes, and we reject the path altogether.
	if normalizedPath != cleanPath {
		return "", errors.Errorf("unexpected relative path %s (%s, %s)", path, normalizedPath, cleanPath)
	}

	return cleanPath, nil
}

// ExtractTarGz takes in an io.Reader containing the bytes for a .tar.gz file and
// a destination string to extract to.
func ExtractTarGz(gzipStream io.Reader, dst string) error {
	uncompressedStream, err := gzip.NewReader(gzipStream)
	if err != nil {
		return errors.Wrap(err, "failed to initialize gzip reader")
	}
	defer uncompressedStream.Close()

	tarReader := tar.NewReader(uncompressedStream)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		} else if err != nil {
			return errors.Wrap(err, "failed to read next file from archive")
		}

		// Pre-emptively check type flag to avoid reporting a misleading error in
		// trying to sanitize the header name.
		switch header.Typeflag {
		case tar.TypeDir:
		case tar.TypeReg:
		default:
			return fmt.Errorf("unsupported type %v in %v", header.Typeflag, header.Name)
		}

		headerName, err := sanitize(header.Name)
		if err != nil {
			return errors.Wrapf(err, "failed to sanitize path %s", header.Name)
		}

		path := filepath.Join(dst, headerName)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.Mkdir(path, 0744); err != nil && !os.IsExist(err) {
				return err
			}
		case tar.TypeReg:
			dir := filepath.Dir(path)

			if err := os.MkdirAll(dir, 0744); err != nil {
				return err
			}

			outFile, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}
			defer outFile.Close()
			if _, err := io.Copy(outFile, tarReader); err != nil {
				return err
			}
		}
	}

	return nil
}
