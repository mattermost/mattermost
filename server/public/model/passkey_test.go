// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"maps"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func validPasskey() *Passkey {
	return &Passkey{
		Id:           NewId(),
		UserId:       NewId(),
		Name:         "My laptop",
		CreateAt:     GetMillis(),
		UserHandle:   make([]byte, PasskeyUserHandleSize),
		CredentialId: []byte("credential"),
		PublicKey:    []byte("key"),
	}
}

func TestPasskeyPreSave(t *testing.T) {
	t.Run("fills id and create time", func(t *testing.T) {
		p := &Passkey{}
		p.PreSave()
		assert.True(t, IsValidId(p.Id))
		assert.NotZero(t, p.CreateAt)
	})

	t.Run("keeps existing values", func(t *testing.T) {
		p := &Passkey{Id: "existing", CreateAt: 42}
		p.PreSave()
		assert.Equal(t, "existing", p.Id)
		assert.Equal(t, int64(42), p.CreateAt)
	})
}

func TestPasskeyIsValid(t *testing.T) {
	assert.Nil(t, validPasskey().IsValid())

	for name, tc := range map[string]struct {
		mutate func(p *Passkey)
		id     string
	}{
		"bad id":              {func(p *Passkey) { p.Id = "x" }, "model.passkey.is_valid.id.app_error"},
		"bad user id":         {func(p *Passkey) { p.UserId = "x" }, "model.passkey.is_valid.user_id.app_error"},
		"empty user handle":   {func(p *Passkey) { p.UserHandle = nil }, "model.passkey.is_valid.user_handle.app_error"},
		"long user handle":    {func(p *Passkey) { p.UserHandle = make([]byte, PasskeyUserHandleSize+1) }, "model.passkey.is_valid.user_handle.app_error"},
		"empty credential id": {func(p *Passkey) { p.CredentialId = nil }, "model.passkey.is_valid.credential_id.app_error"},
		"long credential id":  {func(p *Passkey) { p.CredentialId = make([]byte, 1024) }, "model.passkey.is_valid.credential_id.app_error"},
		"empty public key":    {func(p *Passkey) { p.PublicKey = nil }, "model.passkey.is_valid.public_key.app_error"},
		"empty name":          {func(p *Passkey) { p.Name = "" }, "model.passkey.is_valid.name.app_error"},
		"name over 64 runes":  {func(p *Passkey) { p.Name = strings.Repeat("a", PasskeyNameMaxRunes+1) }, "model.passkey.is_valid.name.app_error"},
		"zero create time":    {func(p *Passkey) { p.CreateAt = 0 }, "model.passkey.is_valid.create_at.app_error"},
	} {
		t.Run(name, func(t *testing.T) {
			p := validPasskey()
			tc.mutate(p)
			appErr := p.IsValid()
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}

	t.Run("name length counts runes, not bytes", func(t *testing.T) {
		p := validPasskey()
		p.Name = strings.Repeat("é", PasskeyNameMaxRunes)
		assert.Nil(t, p.IsValid())
		p.Name += "é"
		assert.NotNil(t, p.IsValid())
	})

	t.Run("credential id at the 1023-byte limit", func(t *testing.T) {
		p := validPasskey()
		p.CredentialId = make([]byte, 1023)
		assert.Nil(t, p.IsValid())
	})
}

func TestPasskeyJSONCarriesCredentialIdsOnly(t *testing.T) {
	p := validPasskey()
	p.Transports = "internal"
	p.AAGUID = []byte("aaguid")
	// Standard base64 of these bytes is "+/8=": it needs the "+" and "/" alphabet and padding.
	p.CredentialId = []byte{0xfb, 0xff}
	p.UserHandle = []byte{0xff, 0xfe, 0xfd}
	b, err := json.Marshal(p)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(b, &m))
	assert.ElementsMatch(t, []string{"id", "user_id", "name", "create_at", "last_used_at", "credential_id", "user_handle"}, slices.Collect(maps.Keys(m)))
	assert.Equal(t, "-_8", m["credential_id"])
	assert.Equal(t, "__79", m["user_handle"])

	t.Run("a slice of pointers uses the same shape", func(t *testing.T) {
		listBody, err := json.Marshal([]*Passkey{p})
		require.NoError(t, err)
		var list []map[string]any
		require.NoError(t, json.Unmarshal(listBody, &list))
		require.Len(t, list, 1)
		assert.Equal(t, "-_8", list[0]["credential_id"])
	})

	t.Run("round trip restores the ids and plain fields", func(t *testing.T) {
		var got Passkey
		require.NoError(t, json.Unmarshal(b, &got))
		assert.Equal(t, p.Id, got.Id)
		assert.Equal(t, p.UserId, got.UserId)
		assert.Equal(t, p.Name, got.Name)
		assert.Equal(t, p.CreateAt, got.CreateAt)
		assert.Equal(t, p.LastUsedAt, got.LastUsedAt)
		assert.Equal(t, p.CredentialId, got.CredentialId)
		assert.Equal(t, p.UserHandle, got.UserHandle)
		assert.Nil(t, got.PublicKey)
	})

	for name, body := range map[string]string{
		"invalid credential_id": `{"credential_id":"+/8="}`,
		"invalid user_handle":   `{"user_handle":"not base64!"}`,
	} {
		t.Run(name, func(t *testing.T) {
			var got Passkey
			assert.Error(t, json.Unmarshal([]byte(body), &got))
		})
	}
}

func TestPasskeyRegistrationTokenExpiry(t *testing.T) {
	tok := NewToken(TokenTypePasskeyRegistration, "")
	assert.False(t, tok.IsExpired())

	// Past the 5-minute ceremony window, well short of the 48h default.
	tok.CreateAt = GetMillis() - PasskeyCeremonyExpiryTime - 1000
	assert.True(t, tok.IsExpired())
}
