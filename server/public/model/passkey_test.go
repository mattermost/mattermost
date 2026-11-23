// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPasskeyRPID(t *testing.T) {
	for name, tc := range map[string]struct {
		siteURL string
		rpID    string
		ok      bool
	}{
		"empty":                       {"", "", false},
		"no host":                     {"https://", "", false},
		"unparseable":                 {"https://exa mple.com", "", false},
		"https domain":                {"https://chat.example.com", "chat.example.com", true},
		"port and subpath ignored":    {"https://chat.example.com:8443/mm", "chat.example.com", true},
		"host lowercased":             {"https://Chat.Example.com:8443/mm", "chat.example.com", true},
		"http domain":                 {"http://chat.example.com", "", false},
		"http localhost":              {"http://localhost:8065", "localhost", true},
		"http uppercase localhost":    {"http://LocalHost:8065", "localhost", true},
		"https localhost":             {"https://localhost", "localhost", true},
		"http subdomain of localhost": {"http://a.localhost", "", false},
		"https ipv4":                  {"https://10.0.0.5", "", false},
		"http loopback ipv4":          {"http://127.0.0.1:8065", "", false},
		"https ipv6":                  {"https://[2001:db8::1]:8443", "", false},
		"http loopback ipv6":          {"http://[::1]:8065", "", false},
		"unicode host":                {"https://bücher.example", "xn--bcher-kva.example", true},
		"uppercase unicode host":      {"https://BÜCHER.example/mm", "xn--bcher-kva.example", true},
		"sharp s not transitional":    {"https://faß.example", "xn--fa-hia.example", true},
		"already punycode":            {"https://xn--bcher-kva.example", "xn--bcher-kva.example", true},
		"invalid punycode label":      {"https://xn--a.example", "", false},
		"disallowed code point":       {"https://a\u2028b.example", "", false},
		"single label host":           {"https://mattermost", "", false},
		"trailing dot":                {"https://chat.example.com.", "", false},
	} {
		t.Run(name, func(t *testing.T) {
			rpID, ok := PasskeyRPID(tc.siteURL)
			assert.Equal(t, tc.rpID, rpID)
			assert.Equal(t, tc.ok, ok)
		})
	}
}

func TestPasskeysAvailable(t *testing.T) {
	cfg := func(flag bool, siteURL string) *Config {
		c := &Config{}
		c.SetDefaults()
		c.FeatureFlags.Passkeys = flag
		c.ServiceSettings.SiteURL = NewPointer(siteURL)
		return c
	}
	const site = "https://chat.example.com"

	for name, tc := range map[string]struct {
		c        *Config
		license  *License
		expected bool
	}{
		"professional, flag on, https domain": {cfg(true, site), NewTestLicenseSKU(LicenseShortSkuProfessional), true},
		"enterprise":                          {cfg(true, site), NewTestLicenseSKU(LicenseShortSkuEnterprise), true},
		"enterprise advanced":                 {cfg(true, site), NewTestLicenseSKU(LicenseShortSkuEnterpriseAdvanced), true},
		"entry":                               {cfg(true, site), NewTestLicenseSKU(LicenseShortSkuMattermostEntry), true},
		"flag off":                            {cfg(false, site), NewTestLicenseSKU(LicenseShortSkuProfessional), false},
		"nil license":                         {cfg(true, site), nil, false},
		"legacy E20":                          {cfg(true, site), NewTestLicenseSKU(LicenseShortSkuE20), false},
		"legacy E10":                          {cfg(true, site), NewTestLicenseSKU(LicenseShortSkuE10), false},
		"unusable site url":                   {cfg(true, "http://chat.example.com"), NewTestLicenseSKU(LicenseShortSkuProfessional), false},
		"empty site url":                      {cfg(true, ""), NewTestLicenseSKU(LicenseShortSkuProfessional), false},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.expected, PasskeysAvailable(tc.c, tc.license))
		})
	}
}
