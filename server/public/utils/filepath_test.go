// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSafeJoin(t *testing.T) {
	tests := []struct {
		name     string
		base     string
		elem     []string
		expected string
	}{
		{
			name:     "empty base path",
			base:     "",
			elem:     []string{"folder", "file.txt"},
			expected: "/folder/file.txt",
		},
		{
			name:     "no elements",
			base:     "/home/user",
			elem:     []string{},
			expected: "/home/user",
		},
		{
			name:     "single file",
			base:     "/tmp",
			elem:     []string{"file.txt"},
			expected: "/tmp/file.txt",
		},
		{
			name:     "nested file",
			base:     "/var/www",
			elem:     []string{"html", "index.html"},
			expected: "/var/www/html/index.html",
		},
		{
			name:     "path traversal into parent directory",
			base:     "/var/www",
			elem:     []string{"../etc/passwd"},
			expected: "/var/www/etc/passwd",
		},
		{
			name:     "path traversal into ancestor directory",
			base:     "/var/www",
			elem:     []string{"../../etc/passwd"},
			expected: "/var/www/etc/passwd",
		},
		{
			name:     "path traversal into parent directory, multiple elements",
			base:     "/app/data",
			elem:     []string{"../", "etc", "passwd"},
			expected: "/app/data/etc/passwd",
		},
		{
			name:     "path traversal into ancestor directory, multiple elements",
			base:     "/app/data",
			elem:     []string{"../", "../", "etc", "passwd"},
			expected: "/app/data/etc/passwd",
		},
		{
			name:     "path traversal within base directory",
			base:     "/uploads",
			elem:     []string{"user123", "../admin", "config.json"},
			expected: "/uploads/admin/config.json",
		},
		{
			name:     "absolute path treated as relative",
			base:     "/safe/dir",
			elem:     []string{"/etc/passwd"},
			expected: "/safe/dir/etc/passwd",
		},
		{
			name:     "current directory references",
			base:     "/project",
			elem:     []string{".", "src", "main.go"},
			expected: "/project/src/main.go",
		},
		{
			name:     "empty base path",
			base:     "",
			elem:     []string{"folder", "file.txt"},
			expected: "/folder/file.txt",
		},
		{
			name:     "null byte should not break security",
			base:     "/tmp",
			elem:     []string{"file.txt\x00../../../etc/passwd"},
			expected: "/tmp/etc/passwd",
		},
		{
			name:     "windows style path separators",
			base:     "/base",
			elem:     []string{"..\\..\\windows\\system32"},
			expected: "/base/..\\..\\windows\\system32",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SafeJoin(tt.base, tt.elem...)
			assert.Equal(t, tt.expected, result)
		})
	}
}
