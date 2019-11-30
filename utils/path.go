// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"path/filepath"
	"strings"
)

// PathTraversesUpward will return true if the path attempts to traverse upwards by using
// ".." in the path.
func PathTraversesUpward(path string) bool {
	return strings.HasPrefix(filepath.Clean(path), "..")
}
