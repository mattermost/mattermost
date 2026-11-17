// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
)

func TestDeveloperModeOn(t *testing.T) {
	t.Parallel()

	const (
		developerSubject = "ServiceSettings.EnableDeveloper"
		testingSubject   = "ServiceSettings.EnableTesting"
	)
	developerFiring := healthcheck.FiringSubject(developerSubject, "health.rule.developer_mode_on.message.enable_developer")
	testingFiring := healthcheck.FiringSubject(testingSubject, "health.rule.developer_mode_on.message.enable_testing")

	modes := func(developerMode, testingMode *bool) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.ServiceSettings.EnableDeveloper = developerMode
			cfg.ServiceSettings.EnableTesting = testingMode
		}
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     []healthcheck.Result
	}{
		{
			name:     "config section absent",
			snapshot: &healthcheck.Snapshot{},
			want: []healthcheck.Result{
				healthcheck.UnknownSubject(developerSubject, healthcheck.ReasonConfigUnavailable),
				healthcheck.UnknownSubject(testingSubject, healthcheck.ReasonConfigUnavailable),
			},
		},
		{
			name:     "defaults",
			snapshot: configSnapshot(nil),
			want:     []healthcheck.Result{healthcheck.ResolvedSubject(developerSubject), healthcheck.ResolvedSubject(testingSubject)},
		},
		{
			name:     "developer mode on",
			snapshot: configSnapshot(modes(new(true), new(false))),
			want:     []healthcheck.Result{developerFiring, healthcheck.ResolvedSubject(testingSubject)},
		},
		{
			name:     "testing mode on",
			snapshot: configSnapshot(modes(new(false), new(true))),
			want:     []healthcheck.Result{healthcheck.ResolvedSubject(developerSubject), testingFiring},
		},
		{
			name:     "both on",
			snapshot: configSnapshot(modes(new(true), new(true))),
			want:     []healthcheck.Result{developerFiring, testingFiring},
		},
		{
			name:     "developer flag unreadable",
			snapshot: configSnapshot(modes(nil, new(true))),
			want:     []healthcheck.Result{healthcheck.UnknownSubject(developerSubject, healthcheck.ReasonConfigUnavailable), testingFiring},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, developerModeOn.Eval(tc.snapshot))
		})
	}
}
