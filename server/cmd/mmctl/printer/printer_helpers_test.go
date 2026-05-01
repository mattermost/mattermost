// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package printer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeForTerminal(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "plain text unchanged",
			input:    "Hello, World!",
			expected: "Hello, World!",
		},
		{
			name:     "preserves newlines and tabs",
			input:    "Line 1\nLine 2\tTabbed",
			expected: "Line 1\nLine 2\tTabbed",
		},
		{
			name:     "removes ANSI color codes",
			input:    "\x1b[31mRed Text\x1b[0m",
			expected: "Red Text",
		},
		{
			name:     "removes cursor movement sequences",
			input:    "\x1b[2J\x1b[H\x1b[1;1HMalicious content",
			expected: "Malicious content",
		},
		{
			name:     "removes OSC clipboard hijacking (BEL terminated)",
			input:    "Normal text\x1b]52;c;SGVsbG8gV29ybGQ=\x07more text",
			expected: "Normal textmore text",
		},
		{
			name:     "removes OSC clipboard hijacking (ST terminated)",
			input:    "Normal text\x1b]52;c;SGVsbG8gV29ybGQ=\x1b\\more text",
			expected: "Normal textmore text",
		},
		{
			name:     "removes OSC window title manipulation",
			input:    "\x1b]0;Fake Terminal Title\x07Real content",
			expected: "Real content",
		},
		{
			name:     "removes screen clearing sequences",
			input:    "\x1b[2J\x1b[3JCleared screen",
			expected: "Cleared screen",
		},
		{
			name:     "removes bold/underline formatting",
			input:    "\x1b[1mBold\x1b[0m \x1b[4mUnderline\x1b[0m",
			expected: "Bold Underline",
		},
		{
			name:     "removes multiple escape sequences",
			input:    "\x1b[31m\x1b[1m\x1b[4mStyled\x1b[0m",
			expected: "Styled",
		},
		{
			name:     "removes control characters (NUL, BEL, etc)",
			input:    "Hello\x00World\x07Test\x08Back",
			expected: "HelloWorldTestBack",
		},
		{
			name:     "removes DEL character",
			input:    "Hello\x7fWorld",
			expected: "HelloWorld",
		},
		{
			name:     "handles complex attack payload",
			input:    "\x1b[2J\x1b[H\x1b]0;HACKED\x07\x1b[31mFake error!\x1b[0m\nEnter password: ",
			expected: "Fake error!\nEnter password: ",
		},
		{
			name:     "removes DCS sequences",
			input:    "Before\x1bPsome DCS content\x1b\\After",
			expected: "BeforeAfter",
		},
		{
			name:     "handles empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "handles unicode text with escape sequences",
			input:    "\x1b[31m你好世界\x1b[0m emoji: 🎉",
			expected: "你好世界 emoji: 🎉",
		},
		{
			name:     "removes CSI with parameters",
			input:    "\x1b[38;5;196mExtended color\x1b[0m",
			expected: "Extended color",
		},
		{
			name:     "removes CSI with question mark",
			input:    "\x1b[?25lHide cursor\x1b[?25h",
			expected: "Hide cursor",
		},
		{
			name:     "preserves carriage return",
			input:    "Line with\rcarriage return",
			expected: "Line with\rcarriage return",
		},
		{
			name:     "removes APC sequences",
			input:    "Before\x1b_APC content\x1b\\After",
			expected: "BeforeAfter",
		},
		{
			name:     "removes nested escape attempts",
			input:    "\x1b[31m\x1b]0;title\x07nested\x1b[0m",
			expected: "nested",
		},
		{
			name:     "handles realistic malicious message",
			input:    "Please run: \x1b[2J\x1b[Hsudo rm -rf /\x1b]52;c;cm0gLXJmIC8=\x07",
			expected: "Please run: sudo rm -rf /",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeForTerminal(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
