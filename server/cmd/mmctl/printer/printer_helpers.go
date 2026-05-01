// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package printer

import (
	"regexp"
	"strings"
)

// Precompiled regex for terminal escape sequence sanitization.
// References:
// - XTerm Control Sequences: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
var (
	// csiRegex matches ANSI CSI sequences (colors, cursor movement, etc).
	csiRegex = regexp.MustCompile(`\x1b\[[0-9;?]*[A-Za-z]`)

	// oscRegex matches OSC sequences (window title, clipboard, etc).
	oscRegex = regexp.MustCompile(`\x1b\]([^\x07\x1b]|\x1b[^\\])*(\x07|\x1b\\)`)

	// dcsRegex matches DCS sequences (device control).
	dcsRegex = regexp.MustCompile(`\x1bP([^\x1b]|\x1b[^\\])*\x1b\\`)

	// otherEscRegex matches other escape sequences (APC, PM, single-char).
	otherEscRegex = regexp.MustCompile(`\x1b[_^X]([^\x1b]|\x1b[^\\])*\x1b\\|\x1b[^\[\]P0-9]`)
)

// SanitizeForTerminal strips ANSI escape sequences and control characters from
// user-controlled content to prevent terminal injection attacks.
// It preserves tabs, newlines, and carriage returns for readability.
func SanitizeForTerminal(s string) string {
	// Remove ANSI CSI sequences
	result := csiRegex.ReplaceAllString(s, "")

	// Remove OSC sequences
	result = oscRegex.ReplaceAllString(result, "")

	// Remove DCS sequences
	result = dcsRegex.ReplaceAllString(result, "")

	// Remove other escape sequences
	result = otherEscRegex.ReplaceAllString(result, "")

	// Remove remaining control characters (0x00-0x1F, 0x7F) except tab, newline, carriage return.
	var cleaned strings.Builder
	cleaned.Grow(len(result))
	for _, r := range result {
		switch {
		case r == '\t' || r == '\n' || r == '\r':
			// Keep whitespace
			cleaned.WriteRune(r)
		case r < 0x20 || r == 0x7F:
			// Skip control characters
			continue
		default:
			cleaned.WriteRune(r)
		}
	}

	return cleaned.String()
}
