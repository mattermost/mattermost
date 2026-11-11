// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import "os"

// replaceFile writes the file directly on Windows, which renameio doesn't support.
func replaceFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0600)
}
