// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin_api_tests

import (
	"path/filepath"
	"runtime"
)

// GetPackagePath returns the filepath to this package for use in tests that need to read data here.
func GetPackagePath() string {
	// Find the path to this file
	_, filename, _, _ := runtime.Caller(0)

	// Return the containing directory
	return filepath.Dir(filename)
}
