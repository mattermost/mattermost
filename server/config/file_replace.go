// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !windows

package config

import (
	"os"
	"path/filepath"

	"github.com/google/renameio/v2"
)

// replaceFile writes data to a temp file next to path and renames it over path, keeping the
// permissions of the existing file.
func replaceFile(path string, data []byte) error {
	dir := filepath.Dir(path)

	// Keep the temp file next to the target, rather than in the shared system temp directory,
	// since the config holds secrets such as the database password.
	if err := renameio.WriteFile(path, data, 0600, renameio.WithTempDir(dir)); err != nil {
		return err
	}

	// renameio doesn't sync the directory, and without that the rename can be lost if the
	// machine goes down right after. This is best effort: the new config is already in place,
	// so a failed sync (some filesystems don't support it) shouldn't be reported as a failed write.
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		d.Close()
	}

	return nil
}
