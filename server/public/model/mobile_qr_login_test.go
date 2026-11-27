// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildMobileQRLoginLink(t *testing.T) {
	testCases := []struct {
		name      string
		siteURL   string
		token     string
		expected  string
		expectErr bool
	}{
		{name: "plain host", siteURL: "https://chat.example.com", token: "abc", expected: "mattermost://chat.example.com/login/mobile_qr?t=abc"},
		{name: "trailing slash", siteURL: "https://chat.example.com/", token: "abc", expected: "mattermost://chat.example.com/login/mobile_qr?t=abc"},
		{name: "subpath with trailing slash", siteURL: "https://chat.example.com/mm/", token: "abc", expected: "mattermost://chat.example.com/mm/login/mobile_qr?t=abc"},
		{name: "nested subpath", siteURL: "https://chat.example.com/a/b", token: "abc", expected: "mattermost://chat.example.com/a/b/login/mobile_qr?t=abc"},
		{name: "port is kept", siteURL: "http://localhost:8065", token: "abc", expected: "mattermost://localhost:8065/login/mobile_qr?t=abc"},
		{name: "surrounding whitespace", siteURL: " https://chat.example.com/mm/ ", token: "abc", expected: "mattermost://chat.example.com/mm/login/mobile_qr?t=abc"},
		{name: "token is query escaped", siteURL: "https://chat.example.com", token: "a b&c=d", expected: "mattermost://chat.example.com/login/mobile_qr?t=a+b%26c%3Dd"},
		{name: "empty site URL", siteURL: "", token: "abc", expectErr: true},
		{name: "site URL without host", siteURL: "/mm", token: "abc", expectErr: true},
		{name: "invalid site URL", siteURL: "https://[::1", token: "abc", expectErr: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			link, err := BuildMobileQRLoginLink(tc.siteURL, tc.token)
			if tc.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.expected, link)
		})
	}
}

func TestMobileQRLoginTokenIsExpired(t *testing.T) {
	token := NewToken(TokenTypeMobileQRLogin, "{}")
	assert.False(t, token.IsExpired())

	token.CreateAt = GetMillis() - MobileQRLoginMaxExpiryTime - 1000
	assert.True(t, token.IsExpired())
}

func TestServiceSettingsMobileQRLogin(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		s := &ServiceSettings{}
		s.SetDefaults(true)
		require.NotNil(t, s.EnableMobileQRLogin)
		assert.False(t, *s.EnableMobileQRLogin)
		require.NotNil(t, s.MobileQRLoginTokenExpirySeconds)
		assert.Equal(t, 90, *s.MobileQRLoginTokenExpirySeconds)
	})

	for _, tc := range []struct {
		seconds int
		valid   bool
	}{
		{seconds: 0, valid: false},
		{seconds: 59, valid: false},
		{seconds: 60, valid: true},
		{seconds: 90, valid: true},
		{seconds: 120, valid: true},
		{seconds: 121, valid: false},
	} {
		t.Run(fmt.Sprintf("expiry %d seconds", tc.seconds), func(t *testing.T) {
			c := &Config{}
			c.SetDefaults()
			*c.ServiceSettings.MobileQRLoginTokenExpirySeconds = tc.seconds

			appErr := c.ServiceSettings.isValid()
			if tc.valid {
				assert.Nil(t, appErr)
				return
			}
			require.NotNil(t, appErr)
			assert.Equal(t, "model.config.is_valid.service_settings.mobile_qr_login_token_expiry_seconds.app_error", appErr.Id)
		})
	}
}
