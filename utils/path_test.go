// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPathTraversesUpward(t *testing.T) {
	cases := []struct {
		input    string
		expected bool
	}{
		{"../test/path", true},
		{"../../test/path", true},
		{"../../test/../path", true},
		{"test/../../path", true},
		{"test/path/../../", false},
		{"test", false},
		{"test/path", false},
		{"test/path/", false},
		{"test/path/file.ext", false},
	}

	for _, c := range cases {
		assert.Equal(t, c.expected, PathTraversesUpward(c.input), c.input)
	}
}
