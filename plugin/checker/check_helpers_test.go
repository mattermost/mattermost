// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCheckHelpersVersionComments(t *testing.T) {
	testCases := []struct {
		name, pkgPath string
		expected      result
		err           string
	}{
		{
			name:     "valid versions",
			pkgPath:  "github.com/mattermost/mattermost-server/plugin/checker/test/valid",
			expected: result{},
		},
		{
			name:    "invalid versions",
			pkgPath: "github.com/mattermost/mattermost-server/plugin/checker/test/invalid",
			expected: result{
				errors:   []string{"test/invalid/invalid.go:20:2: documented minimum version too low for method LowerVersionMethod"},
				warnings: []string{"test/invalid/invalid.go:23:2: documented minimum version too high for method HigherVersionMethod"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert := assert.New(t)

			res, err := checkHelpersVersionComments(tc.pkgPath)
			assert.Equal(tc.expected, res)

			if tc.err != "" {
				assert.EqualError(err, tc.err)
			} else {
				assert.NoError(err)
			}

		})
	}
}
