// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package versions

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMajor(t *testing.T) {
	for version, want := range map[string]int{
		"8.15.0":               8,
		"15.4 (Debian 15.4-1)": 15,
		" 16":                  16,
		"2":                    2,
		"9-SNAPSHOT":           9,
	} {
		major, ok := Major(version)
		assert.True(t, ok, version)
		assert.Equal(t, want, major, version)
	}

	for _, version := range []string{"", "v8.1", "unknown"} {
		_, ok := Major(version)
		assert.False(t, ok, version)
	}
}
