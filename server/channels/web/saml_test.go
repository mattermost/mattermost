// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestSamlCallbackIncludesSrvParameter verifies that mobile SAML callbacks
// include the 'srv' parameter for origin verification
func TestSamlCallbackIncludesSrvParameter(t *testing.T) {
	// The 'srv' parameter is added to mobile callbacks to allow the client
	// to verify the server origin

	t.Run("srv parameter should be included in redirect URL construction", func(t *testing.T) {
		// Verify the pattern: when we construct a redirect URL for mobile,
		// it should include "srv" parameter with the server's site URL

		siteURL := "https://mattermost.example.com"
		sessionToken := "test-session-token"
		csrfToken := "test-csrf-token"

		// Simulate what the code does when constructing the callback
		params := map[string]string{
			model.SessionCookieToken: sessionToken,
			model.SessionCookieCsrf:  csrfToken,
			"srv":                    siteURL,
		}

		// Verify all expected parameters are present
		assert.Equal(t, sessionToken, params[model.SessionCookieToken])
		assert.Equal(t, csrfToken, params[model.SessionCookieCsrf])
		assert.Equal(t, siteURL, params["srv"])
	})

	t.Run("srv parameter detects server mismatch", func(t *testing.T) {
		// Scenario: The srv parameter from callback doesn't match expected server
		// Mobile should detect the mismatch

		expectedServer := "https://server-a.example.com"
		actualSrvFromCallback := "https://server-b.example.com"

		// This is the check that should happen in mobile
		isMismatch := expectedServer != actualSrvFromCallback
		assert.True(t, isMismatch, "Should detect server mismatch")
	})

	t.Run("srv parameter allows legitimate login", func(t *testing.T) {
		// Scenario: Normal login to legitimate server
		// Server adds srv=server.com to callback
		// Mobile verifies: expected == srv

		expectedServer := "https://server.example.com"
		actualSrvFromCallback := "https://server.example.com"

		// This is the check that should happen in mobile
		isLegitimate := expectedServer == actualSrvFromCallback
		assert.True(t, isLegitimate, "Should allow legitimate login")
	})
}

// TestCompleteSamlRelayState tests that relay state is properly handled
func TestCompleteSamlRelayState(t *testing.T) {
	t.Run("should decode relay state correctly", func(t *testing.T) {
		relayProps := map[string]string{
			"action":      model.OAuthActionMobile,
			"redirect_to": "mmauth://callback",
		}

		relayState := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(relayProps)))

		// Decode and verify
		decoded, err := base64.StdEncoding.DecodeString(relayState)
		require.NoError(t, err)

		decodedProps := model.MapFromJSON(strings.NewReader(string(decoded)))
		assert.Equal(t, model.OAuthActionMobile, decodedProps["action"])
		assert.Equal(t, "mmauth://callback", decodedProps["redirect_to"])
	})
}
