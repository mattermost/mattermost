// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package versions parses version strings reported by external services.
package versions

import (
	"strconv"
	"strings"
)

// Major reads the leading integer of a version string such as "8.15.0" or "15.4 (Debian 15.4-1)".
func Major(version string) (int, bool) {
	version = strings.TrimSpace(version)
	end := strings.IndexFunc(version, func(r rune) bool { return r < '0' || r > '9' })
	if end == -1 {
		end = len(version)
	}

	major, err := strconv.Atoi(version[:end])
	return major, err == nil
}
