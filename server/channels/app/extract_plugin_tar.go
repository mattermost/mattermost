// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

// extractTarGz takes in an io.Reader containing the bytes for a .tar.gz file and
// a destination string to extract to.
func extractTarGz(gzipStream io.Reader, dst string) error {
	if dst == "" {
		return errors.New("no destination path provided")
	}

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

		// Preemptively check type flag to avoid reporting a misleading error in
		// trying to sanitize the header name.
		switch header.Typeflag {
		case tar.TypeDir:
		case tar.TypeReg:
		default:
			mlog.Warn("skipping unsupported header type on extracting tar file", mlog.String("header_type", string(header.Typeflag)), mlog.String("header_name", header.Name))
			continue
		}

		// filepath.HasPrefix is deprecated, so we just use strings.HasPrefix to ensure
		// the target path remains rooted at dst and has no `../` escaping outside.
		path := filepath.Join(dst, header.Name)
		if !strings.HasPrefix(path, dst) {
			return errors.Errorf("failed to sanitize path %s", header.Name)
		}

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

			copyFile := func() error {
				outFile, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode))
				if err != nil {
					return err
				}
				defer outFile.Close()
				if _, err := io.Copy(outFile, tarReader); err != nil {
					return err
				}

				return nil
			}

			if err := copyFile(); err != nil {
				return err
			}
		}
	}

	return nil
}
