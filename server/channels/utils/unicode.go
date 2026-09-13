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

// NormalizePassword normalizes a password to NFC (composed) form before it
// is hashed or compared against a stored hash. Without this, a password
// containing a character that has both a precomposed and a combining-mark
// representation (e.g. "é" as U+00E9 vs "e"+U+0301) hashes differently
// depending on which Unicode form the input method produced, so the same
// password can fail to verify when typed on a different device/OS/input
// method than the one used when it was set.
func NormalizePassword(password string) string {
	return norm.NFC.String(password)
}
