// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestSessionExtendOff(t *testing.T) {
	t.Parallel()

	extend := func(value *bool) *healthcheck.Snapshot {
		return configSnapshot(func(cfg *model.Config) { cfg.ServiceSettings.ExtendSessionLengthWithActivity = value })
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"off", extend(new(false)), firing("health.rule.session_extend_off.message", nil)},
		{"on", extend(new(true)), resolved},
		{"absent", extend(nil), configUnavailable},
		{"config section absent", &healthcheck.Snapshot{}, configUnavailable},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, map[string]want{"SESSION_EXTEND_OFF": tc.want})
		})
	}
}
