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
	path = filepath.Clean(path)

	if strings.HasPrefix(path, "..") {
		return "", errors.New("unexpected relative path")
	}

	return path, nil
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
		default:
			return fmt.Errorf("unsupported type %v in %v", header.Typeflag, headerName)
		}
	}

	return nil
}
