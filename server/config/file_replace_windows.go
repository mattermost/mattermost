// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

// replaceFile writes data in place on Windows, which renameio doesn't support. The in-place
// write still never truncates the file before the new contents are written.
func replaceFile(path string, data []byte) error {
	return writeFileInPlace(path, data, 0600)
}
