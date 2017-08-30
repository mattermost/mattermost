// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// SanitizePath will remove any relative directory changes and return the path
// with them removed. Trailing separators are also removed.
func SanitizePath(path string) string {
	splitPath := strings.Split(path, string(os.PathSeparator))
	fmt.Println(splitPath)
	safePath := ""
	for _, p := range splitPath {
		if p != ".." && p != "~" {
			safePath = filepath.Join(safePath, p)
		}
	}
	return safePath
}
