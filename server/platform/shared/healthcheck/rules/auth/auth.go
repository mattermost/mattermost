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

// ldapRule checks the LDAP license feature before the config gate: the server ignores LDAP settings without it.
func ldapRule(gate func(*healthcheck.Snapshot) (bool, bool), check func(*healthcheck.Snapshot) healthcheck.Result) func(*healthcheck.Snapshot) []healthcheck.Result {
	return healthcheck.Licensed(func(f *model.Features) *bool { return f.LDAP }, healthcheck.Gate(gate, healthcheck.ReasonConfigUnavailable, check))
}

// samlRule checks the SAML license feature before SamlSettings.Enable: the server ignores SAML settings without it.
func samlRule(check func(*healthcheck.Snapshot) healthcheck.Result) func(*healthcheck.Snapshot) []healthcheck.Result {
	return healthcheck.Licensed(func(f *model.Features) *bool { return f.SAML }, healthcheck.Gate(samlEnabled, healthcheck.ReasonConfigUnavailable, check))
}

// ldapEnabled matches the server's own test before probing LDAP: sync-only installs count.
func ldapEnabled(s *healthcheck.Snapshot) (bool, bool) {
	enable, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LdapSettings.Enable })
	if !ok {
		return false, false
	}
	if enable {
		return true, true
	}

	return ldapSyncEnabled(s)
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
