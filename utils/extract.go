// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// ExtractTarGz takes in an io.Reader containing the bytes for a .tar.gz file and
// a destination string to extract to.
func ExtractTarGz(gzipStream io.Reader, dst string) error {
	uncompressedStream, err := gzip.NewReader(gzipStream)
	if err != nil {
		return fmt.Errorf("ExtractTarGz: NewReader failed: %s", err.Error())
	}
	defer uncompressedStream.Close()

	tarReader := tar.NewReader(uncompressedStream)

	for {
		header, err := tarReader.Next()

		if err == io.EOF {
			break
		}

		if err != nil {
			return fmt.Errorf("ExtractTarGz: Next() failed: %s", err.Error())
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if PathTraversesUpward(header.Name) {
				return fmt.Errorf("ExtractTarGz: path attempts to traverse upwards")
			}

			path := filepath.Join(dst, header.Name)
			if err := os.Mkdir(path, 0744); err != nil && !os.IsExist(err) {
				return fmt.Errorf("ExtractTarGz: Mkdir() failed: %s", err.Error())
			}
		case tar.TypeReg:
			if PathTraversesUpward(header.Name) {
				return fmt.Errorf("ExtractTarGz: path attempts to traverse upwards")
			}

			path := filepath.Join(dst, header.Name)
			dir := filepath.Dir(path)

			if err := os.MkdirAll(dir, 0744); err != nil {
				return fmt.Errorf("ExtractTarGz: MkdirAll() failed: %s", err.Error())
			}

			outFile, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return fmt.Errorf("ExtractTarGz: Create() failed: %s", err.Error())
			}
			defer outFile.Close()
			if _, err := io.Copy(outFile, tarReader); err != nil {
				return fmt.Errorf("ExtractTarGz: Copy() failed: %s", err.Error())
			}
		default:
			return fmt.Errorf(
				"ExtractTarGz: unknown type: %v in %v",
				header.Typeflag,
				header.Name)
		}
	}

	return nil
}
