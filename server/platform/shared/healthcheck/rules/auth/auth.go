// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package auth holds the health rules for AD/LDAP, SAML and sessions.
package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	ldapConsolePath = "/admin_console/authentication/ldap"
	ldapDocsURL     = "https://mattermost.com/pl/setup-ldap"
	samlConsolePath = "/admin_console/authentication/saml"
	samlDocsURL     = "https://docs.mattermost.com/administration-guide/onboard/sso-saml.html"
)

// gated emits Unknown when the gate cannot be read and Resolved when it is closed, so a
// condition that cannot bite never fires.
func gated(gate func(*healthcheck.Snapshot) (bool, bool), check func(*healthcheck.Snapshot) healthcheck.Result) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		open, ok := gate(s)
		switch {
		case !ok:
			return []healthcheck.Result{unknownConfig()}
		case !open:
			return []healthcheck.Result{healthcheck.Resolved()}
		default:
			return []healthcheck.Result{check(s)}
		}
	}
}

// ldapEnabled matches the server's own test before probing LDAP: sync-only installs count.
func ldapEnabled(s *healthcheck.Snapshot) (bool, bool) {
	enable, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LdapSettings.Enable })
	if !ok {
		return false, false
	}

	sync, ok := ldapSyncEnabled(s)
	return enable || sync, ok
}

func ldapSyncEnabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LdapSettings.EnableSync })
}

func samlEnabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.SamlSettings.Enable })
}

func unknownConfig() healthcheck.Result {
	return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
}
