// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizePath(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"../test/path", "test/path"},
		{"../../test/path", "test/path"},
		{"../../test/../path", "test/path"},
		{"test/../../path", "test/path"},
		{"test/path/../../", "test/path"},
		{"/test/path", "test/path"},
		{"~/test/path", "test/path"},
		{"test", "test"},
		{"test/path", "test/path"},
		{"test/path/", "test/path"},
		{"test/path/file.ext", "test/path/file.ext"},
	}

	for _, c := range cases {
		assert.Equal(t, c.expected, SanitizePath(c.input))
	}
}
