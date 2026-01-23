// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetVersionComponents(t *testing.T) {
	testCases := []struct {
		Name          string
		Version       string
		ExpectedMajor int
		ExpectedMinor int
		ExpectedPatch int
		ExpectedError bool
	}{
		{
			Name:          "Should error if version format is invalid",
			Version:       "invalid",
			ExpectedMajor: 0,
			ExpectedMinor: 0,
			ExpectedPatch: 0,
			ExpectedError: true,
		},
		{
			Name:          "Should work correctly if version has three valid components",
			Version:       "7.2.3",
			ExpectedMajor: 7,
			ExpectedMinor: 2,
			ExpectedPatch: 3,
			ExpectedError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			major, minor, patch, err := GetVersionComponents(tc.Version)
			if tc.ExpectedError {
				require.Error(t, err)
			}
			assert.Equal(t, tc.ExpectedMajor, major)
			assert.Equal(t, tc.ExpectedMinor, minor)
			assert.Equal(t, tc.ExpectedPatch, patch)
		})
	}
}
