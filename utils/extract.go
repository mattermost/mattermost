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
// a destination string to extract to. A list of the file and directory names that
// were extracted is returned.
func ExtractTarGz(gzipStream io.Reader, dst string) ([]string, error) {
	uncompressedStream, err := gzip.NewReader(gzipStream)
	if err != nil {
		return nil, fmt.Errorf("ExtractTarGz: NewReader failed: %s", err.Error())
	}

	tarReader := tar.NewReader(uncompressedStream)

	filenames := []string{}

	for true {
		header, err := tarReader.Next()

		if err == io.EOF {
			break
		}

		if err != nil {
			return nil, fmt.Errorf("ExtractTarGz: Next() failed: %s", err.Error())
		}

		switch header.Typeflag {
		case tar.TypeDir:
			path := filepath.Join(dst, header.Name)
			if err := os.Mkdir(path, 0744); err != nil && !os.IsExist(err) {
				return nil, fmt.Errorf("ExtractTarGz: Mkdir() failed: %s", err.Error())
			}

			filenames = append(filenames, header.Name)
		case tar.TypeReg:
			path := filepath.Join(dst, header.Name)
			dir := filepath.Dir(path)

			if err := os.MkdirAll(dir, 0744); err != nil {
				return nil, fmt.Errorf("ExtractTarGz: MkdirAll() failed: %s", err.Error())
			}

			outFile, err := os.Create(path)
			if err != nil {
				return nil, fmt.Errorf("ExtractTarGz: Create() failed: %s", err.Error())
			}
			defer outFile.Close()
			if _, err := io.Copy(outFile, tarReader); err != nil {
				return nil, fmt.Errorf("ExtractTarGz: Copy() failed: %s", err.Error())
			}

			filenames = append(filenames, header.Name)
		default:
			return nil, fmt.Errorf(
				"ExtractTarGz: unknown type: %s in %s",
				header.Typeflag,
				header.Name)
		}
	}

	return filenames, nil
}
