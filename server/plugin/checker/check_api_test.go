// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCheckAPIVersionComments(t *testing.T) {
	testCases := []struct {
		name, pkgPath, err string
		expected           result
	}{
		{
			name:    "valid comments",
			pkgPath: "github.com/mattermost/mattermost-server/server/v8/plugin/checker/internal/test/valid",
			err:     "",
		},
		{
			name:    "invalid comments",
			pkgPath: "github.com/mattermost/mattermost-server/server/v8/plugin/checker/internal/test/invalid",
			expected: result{
				Errors: []string{"internal/test/invalid/invalid.go:15:2: missing a minimum server version comment on method InvalidMethod"},
			},
		},
		{
			name:    "missing API interface",
			pkgPath: "github.com/mattermost/mattermost-server/server/v8/plugin/checker/internal/test/missing",
			err:     "could not find API interface",
		},
		{
			name:    "non-existent package path",
			pkgPath: "github.com/mattermost/mattermost-server/server/v8/plugin/checker/internal/test/does_not_exist",
			err:     "could not find API interface",
		},
	}

	// Enable debug flag to have packagesdriver/sizes.go print stderr of `go list` command.
	// We want to surface any error text that may exist in stderr of this command.
	prevEnvValue := os.Getenv("GOPACKAGESPRINTGOLISTERRORS")
	os.Setenv("GOPACKAGESPRINTGOLISTERRORS", "true")

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := checkAPIVersionComments(tc.pkgPath)
			assert.Equal(t, res, tc.expected)

			if tc.err != "" {
				assert.EqualError(t, err, tc.err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
	os.Setenv("GOPACKAGESPRINTGOLISTERRORS", prevEnvValue)
}
