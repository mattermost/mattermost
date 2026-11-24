// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"

	"golang.org/x/net/idna"
)

const (
	PasskeyMaxPerUser     = 10
	PasskeyNameMaxRunes   = 64
	PasskeyUserHandleSize = 64
	// A WebAuthn credential id is at most 1023 bytes.
	PasskeyCredentialIdMaxSize = 1023
	// How recently a user must have signed in (ms) to add a passkey.
	PasskeyRecentLoginWindow = 10 * 60 * 1000
)

// Passkey is one WebAuthn credential registered to a user. Credential material is tagged
// json:"-" so it never reaches clients.
type Passkey struct {
	Id         string `json:"id"`
	UserId     string `json:"user_id"`
	Name       string `json:"name"`
	CreateAt   int64  `json:"create_at"`
	LastUsedAt int64  `json:"last_used_at"` // 0 = never used

	UserHandle     []byte `json:"-"`
	CredentialId   []byte `json:"-"`
	PublicKey      []byte `json:"-"`
	AAGUID         []byte `json:"-"`
	Transports     string `json:"-"` // comma-separated, e.g. "internal,hybrid"
	SignCount      int64  `json:"-"`
	BackupEligible bool   `json:"-"`
	BackupState    bool   `json:"-"`
}

func (p *Passkey) PreSave() {
	if p.Id == "" {
		p.Id = NewId()
	}
	if p.CreateAt == 0 {
		p.CreateAt = GetMillis()
	}
}

func (p *Passkey) IsValid() *AppError {
	switch {
	case !IsValidId(p.Id):
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	case !IsValidId(p.UserId):
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	case len(p.UserHandle) == 0 || len(p.UserHandle) > PasskeyUserHandleSize:
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.user_handle.app_error", nil, "", http.StatusBadRequest)
	case len(p.CredentialId) == 0 || len(p.CredentialId) > PasskeyCredentialIdMaxSize:
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.credential_id.app_error", nil, "", http.StatusBadRequest)
	case len(p.PublicKey) == 0:
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.public_key.app_error", nil, "", http.StatusBadRequest)
	case p.Name == "" || utf8.RuneCountInString(p.Name) > PasskeyNameMaxRunes:
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.name.app_error", nil, "", http.StatusBadRequest)
	case p.CreateAt == 0:
		return NewAppError("Passkey.IsValid", "model.passkey.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// PasskeyRegistrationOptions is what the client needs to run a registration ceremony. Options is
// the WebAuthn library's creation options, kept opaque here so this package does not import it.
type PasskeyRegistrationOptions struct {
	CeremonyId string          `json:"ceremony_id"`
	Options    json.RawMessage `json:"options"`
}

// PasskeyEnrollmentTicket is a single-use, short-lived credential that lets the system browser
// enroll a passkey for the session that requested it. It is also the body that presents the ticket.
type PasskeyEnrollmentTicket struct {
	Ticket   string `json:"ticket"`
	ExpireAt int64  `json:"expire_at"`
}

// PasskeyRegistrationFinish is the body that completes a registration ceremony. Credential is the
// browser's registration response, kept opaque so this package does not import the WebAuthn library.
type PasskeyRegistrationFinish struct {
	CeremonyId string          `json:"ceremony_id"`
	Name       string          `json:"name"`
	Credential json.RawMessage `json:"credential"`
}

// PasskeyLoginOptions is what the client needs to run a sign-in ceremony. Options is the WebAuthn
// library's assertion options, kept opaque here so this package does not import it.
type PasskeyLoginOptions struct {
	CeremonyId string          `json:"ceremony_id"`
	Options    json.RawMessage `json:"options"`
}

// PasskeyLoginFinish is the body that completes a sign-in ceremony. Credential is the browser's
// assertion response, kept opaque so this package does not import the WebAuthn library.
type PasskeyLoginFinish struct {
	CeremonyId string          `json:"ceremony_id"`
	Credential json.RawMessage `json:"credential"`
}

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
