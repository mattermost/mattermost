// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"path/filepath"
)

// SafeJoin lexically joins a trusted base path with an untrusted
// path, ensuring the result is anchored at or below the base path.
func SafeJoin(base string, elem ...string) string {
	// The idea is to clean the untrusted path relative to '/', and
	// only then join with the trusted base path. Any ../ attempts
	// relative to `/` will efectively be ignored.
	return filepath.Join(
		base,
		filepath.Join(
			"/",
			filepath.Join(elem...),
		),
	)
}
