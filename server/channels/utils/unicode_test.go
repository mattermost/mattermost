// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "ASCII only",
			input:    "test.jpg",
			expected: "test.jpg",
		},
		{
			name:     "Japanese katakana dakuten NFC",
			input:    "\u30AC", // ガ (NFC)
			expected: "\u30AC",
		},
		{
			name:     "Japanese katakana dakuten NFD",
			input:    "\u30AB\u3099", // カ + combining dakuten → ガ
			expected: "\u30AC",
		},
		{
			name:     "Japanese katakana handakuten NFC",
			input:    "\u30D1", // パ (NFC)
			expected: "\u30D1",
		},
		{
			name:     "Japanese katakana handakuten NFD",
			input:    "\u30CF\u309A", // ハ + combining handakuten → パ
			expected: "\u30D1",
		},
		{
			name:     "Japanese hiragana dakuten NFC",
			input:    "\u3079", // べ (NFC)
			expected: "\u3079",
		},
		{
			name:     "Japanese hiragana dakuten NFD",
			input:    "\u3078\u3099", // へ + combining dakuten → べ
			expected: "\u3079",
		},
		{
			name:     "Mixed path with NFD",
			input:    "data/\u30AB\u3099test.jpg", // data/カ゛test.jpg
			expected: "data/\u30ACtest.jpg",       // data/ガtest.jpg
		},
		{
			name:     "Complex Japanese filename NFD",
			input:    "\u304B\u3099\u304D\u3099\u3050", // が + ぎ + ぐ (NFD: か゛き゛く゛)
			expected: "\u304C\u304E\u3050",             // がぎぐ (NFC)
		},
		{
			name:     "Path with multiple NFD characters",
			input:    "data/\u30D5\u309A\u30ED\u30B7\u3099\u30A7\u30AF\u30C8.png", // data/プロジェクト.png (NFD)
			expected: "data/\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8.png",             // data/プロジェクト.png (NFC)
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "Already NFC normalized",
			input:    "ファイル名.txt",
			expected: "ファイル名.txt",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NormalizeFilename(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNormalizeFilenameIdempotent(t *testing.T) {
	// NFC normalization should be idempotent
	inputs := []string{
		"test.jpg",
		"\u30AC",           // ガ (NFC)
		"\u30AB\u3099",     // カ + combining dakuten (NFD)
		"data/テスト.jpg",
		"",
	}

	for _, input := range inputs {
		first := NormalizeFilename(input)
		second := NormalizeFilename(first)
		assert.Equal(t, first, second, "NormalizeFilename should be idempotent for input: %q", input)
	}
}
