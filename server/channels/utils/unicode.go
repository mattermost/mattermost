// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import "golang.org/x/text/unicode/norm"

// NormalizeFilename normalizes a filename to NFC (composed) form.
// This ensures consistent string comparison between filesystems that use
// different Unicode normalization forms (macOS uses NFD, Linux/Windows use NFC).
// This is particularly important for Japanese dakuten/handakuten characters
// (e.g., "ガ" can be represented as U+30AC (NFC) or U+30AB + U+3099 (NFD)).
func NormalizeFilename(name string) string {
	return norm.NFC.String(name)
}
