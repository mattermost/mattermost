// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRunCheck(t *testing.T) {
	testCases := []struct {
		name, pkgPath, err string
	}{
		{
			name:    "valid comments",
			pkgPath: "github.com/mattermost/mattermost-server/plugin/checker/test/valid",
			err:     "",
		},
		{
			name:    "invalid comments",
			pkgPath: "github.com/mattermost/mattermost-server/plugin/checker/test/invalid",
			err:     "test/invalid/invalid.go:15:2: missing a minimum server version comment\n",
		},
		{
			name:    "missing API interface",
			pkgPath: "github.com/mattermost/mattermost-server/plugin/checker/test/missing",
			err:     "could not find API interface in package github.com/mattermost/mattermost-server/plugin/checker/test/missing",
		},
		{
			name:    "non-existent package path",
			pkgPath: "github.com/mattermost/mattermost-server/plugin/checker/test/does_not_exist",
			err:     "could not find API interface in package github.com/mattermost/mattermost-server/plugin/checker/test/does_not_exist",
		},
	}

	// Enable debug flag to have packagesdriver/sizes.go print stderr of `go list` command.
	// We want to surface any error text that may exist in stderr of this command.
	prevEnvValue := os.Getenv("GOPACKAGESPRINTGOLISTERRORS")
	os.Setenv("GOPACKAGESPRINTGOLISTERRORS", "true")

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := runCheck(tc.pkgPath)

			if tc.err != "" {
				assert.EqualError(t, err, tc.err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
	os.Setenv("GOPACKAGESPRINTGOLISTERRORS", prevEnvValue)
}
