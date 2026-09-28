// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !windows

package config

import (
	"path/filepath"

	"github.com/google/renameio/v2"
)

// replaceFile writes data to a temp file next to path and renames it over path, keeping the
// permissions of the existing file.
func replaceFile(path string, data []byte) error {
	// Keep the temp file next to the target, rather than in the shared system temp directory,
	// since the config holds secrets such as the database password.
	return renameio.WriteFile(path, data, 0600, renameio.WithTempDir(filepath.Dir(path)))
}
