// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net"
	"net/url"
	"strings"

	"golang.org/x/net/idna"
)

// PasskeyRPID returns the WebAuthn relying-party ID for a Site URL and whether passkeys can work with it.
func PasskeyRPID(siteURL string) (string, bool) {
	u, err := url.Parse(siteURL)
	if err != nil {
		return "", false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" || net.ParseIP(host) != nil {
		return "", false
	}
	// Browsers only allow WebAuthn on secure origins, with localhost as the development exception.
	if u.Scheme != "https" && host != "localhost" {
		return "", false
	}
	// Browsers and authenticators use the punycode form of the host, and the WebAuthn library
	// refuses a non-ASCII RP ID. Lookup is non-transitional, matching browsers (faß stays faß).
	host, err = idna.Lookup.ToASCII(host)
	if err != nil {
		return "", false
	}
	// The WebAuthn library also refuses a single-label RP ID (other than localhost) and a trailing dot.
	if strings.HasSuffix(host, ".") || (host != "localhost" && !strings.Contains(host, ".")) {
		return "", false
	}
	return host, true
}

// PasskeysAvailable reports whether passkeys may be used: the Passkeys feature flag is on, the
// license is Professional or higher, and the Site URL yields a relying-party ID. It deliberately
// ignores the enrollment and login settings so endpoints can gate on it independently of them.
func PasskeysAvailable(c *Config, license *License) bool {
	if !c.FeatureFlags.Passkeys || !MinimumProfessionalLicense(license) {
		return false
	}
	_, ok := PasskeyRPID(*c.ServiceSettings.SiteURL)
	return ok
}
