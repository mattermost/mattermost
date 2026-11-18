// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestDeveloperModeOn(t *testing.T) {
	t.Parallel()

	developerMode := func(enabled *bool) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.ServiceSettings.EnableDeveloper = enabled
		}
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config section absent", &healthcheck.Snapshot{}, configUnknown},
		{"defaults", configSnapshot(nil), resolved},
		{"developer mode on", configSnapshot(developerMode(new(true))), firing("health.rule.developer_mode_on.message", nil)},
		{"developer mode flag unreadable", configSnapshot(developerMode(nil)), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, developerModeOn.Eval(tc.snapshot))
		})
	}
}

func TestTestingModeOn(t *testing.T) {
	t.Parallel()

	testingMode := func(enabled *bool) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.ServiceSettings.EnableTesting = enabled
		}
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config section absent", &healthcheck.Snapshot{}, configUnknown},
		{"defaults", configSnapshot(nil), resolved},
		{"testing mode on", configSnapshot(testingMode(new(true))), firing("health.rule.testing_mode_on.message", nil)},
		{"testing mode flag unreadable", configSnapshot(testingMode(nil)), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, testingModeOn.Eval(tc.snapshot))
		})
	}
}
