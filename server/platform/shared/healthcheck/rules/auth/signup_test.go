// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestOpenSignupUnverified(t *testing.T) {
	t.Parallel()

	// openSignup starts from a server where anyone can sign up without verifying their email.
	openSignup := func(edit func(cfg *model.Config)) *healthcheck.Snapshot {
		return configSnapshot(func(cfg *model.Config) {
			cfg.TeamSettings.EnableUserCreation = new(true)
			cfg.TeamSettings.EnableOpenServer = new(true)
			cfg.EmailSettings.EnableSignUpWithEmail = new(true)
			cfg.EmailSettings.RequireEmailVerification = new(false)
			cfg.TeamSettings.RestrictCreationToDomains = new("")
			if edit != nil {
				edit(cfg)
			}
		})
	}
	unrestricted := firing("health.rule.open_signup_unverified.message", nil)
	restricted := firing("health.rule.open_signup_unverified.message.restricted", nil)

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"open signup without verification", openSignup(nil), unrestricted},
		{"domain restriction does not suppress", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.RestrictCreationToDomains = new("example.com, example.org")
		}), restricted},
		{"domain restriction absent", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.RestrictCreationToDomains = nil
		}), unrestricted},
		{"verification required", openSignup(func(cfg *model.Config) {
			cfg.EmailSettings.RequireEmailVerification = new(true)
		}), resolved},
		{"server not open", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableOpenServer = new(false)
		}), resolved},
		{"user creation disabled", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableUserCreation = new(false)
		}), resolved},
		{"email signup disabled", openSignup(func(cfg *model.Config) {
			cfg.EmailSettings.EnableSignUpWithEmail = new(false)
		}), resolved},
		{"defaults keep the server closed", configSnapshot(nil), resolved},
		{"verification absent", openSignup(func(cfg *model.Config) {
			cfg.EmailSettings.RequireEmailVerification = nil
		}), configUnavailable},
		{"user creation absent", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableUserCreation = nil
		}), configUnavailable},
		{"open server absent", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableOpenServer = nil
		}), configUnavailable},
		{"email signup absent", openSignup(func(cfg *model.Config) {
			cfg.EmailSettings.EnableSignUpWithEmail = nil
		}), configUnavailable},
		{"a known closed setting outweighs an absent one", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableOpenServer = nil
			cfg.EmailSettings.EnableSignUpWithEmail = new(false)
		}), resolved},
		{"a closed server outweighs absent verification", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableOpenServer = new(false)
			cfg.EmailSettings.RequireEmailVerification = nil
		}), resolved},
		{"required verification outweighs an absent setting", openSignup(func(cfg *model.Config) {
			cfg.TeamSettings.EnableUserCreation = nil
			cfg.EmailSettings.RequireEmailVerification = new(true)
		}), resolved},
		{"config section absent", &healthcheck.Snapshot{}, configUnavailable},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, map[string]want{"OPEN_SIGNUP_UNVERIFIED": tc.want})
		})
	}
}
