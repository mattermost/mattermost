// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestTLSVerifyOutgoingOff(t *testing.T) {
	t.Parallel()

	insecureOutgoing := func(enabled *bool) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.ServiceSettings.EnableInsecureOutgoingConnections = enabled
		}
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config section absent", &healthcheck.Snapshot{}, configUnknown},
		{"defaults", configSnapshot(nil), resolved},
		{"verification on", configSnapshot(insecureOutgoing(new(false))), resolved},
		{"verification off", configSnapshot(insecureOutgoing(new(true))), firing("health.rule.tls_verify_outgoing_off.message", nil)},
		{"setting unreadable", configSnapshot(insecureOutgoing(nil)), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, tlsVerifyOutgoingOff.Eval(tc.snapshot))
		})
	}
}
