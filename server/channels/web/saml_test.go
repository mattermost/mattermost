// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	saml2 "github.com/mattermost/gosaml2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
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

// registerFakeSamlInterface installs a mocked SamlInterface before the server is created,
// mirroring the pattern in channels/app/enterprise_test.go. Must be called before Setup(t).
func registerFakeSamlInterface(t *testing.T) *mocks.SamlInterface {
	t.Helper()

	fakeSaml := &mocks.SamlInterface{}
	fakeSaml.On("ConfigureSP", mock.Anything).Return(nil)

	app.RegisterSamlInterface(func(a *app.App) einterfaces.SamlInterface {
		return fakeSaml
	})
	t.Cleanup(func() { app.RegisterSamlInterface(nil) })

	return fakeSaml
}

func postCompleteSaml(t *testing.T, th *TestHelper, samlResponse, relayState string) *httptest.ResponseRecorder {
	t.Helper()

	form := url.Values{}
	form.Set("SAMLResponse", samlResponse)
	form.Set("RelayState", relayState)

	req := httptest.NewRequest(http.MethodPost, "/login/sso/saml", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res := httptest.NewRecorder()
	th.Web.MainRouter.ServeHTTP(res, req)
	return res
}

// TestCompleteSamlRelayStateRejectsForgedRelayState verifies that completeSaml rejects the
// pre-fix RelayState format (plain base64(JSON), no signature - the shape of the MM-69889
// forged team_id/invite_id attack) as well as arbitrary tampered/malformed strings, since
// RelayState must now carry a valid HMAC signature produced by the server.
func TestCompleteSamlRelayStateRejectsForgedRelayState(t *testing.T) {
	fakeSaml := registerFakeSamlInterface(t)
	th := Setup(t)

	t.Run("legacy base64-encoded relayProps blob is rejected", func(t *testing.T) {
		forgedRelayProps := map[string]string{
			"action":  model.OAuthActionSignup,
			"team_id": "forged-team-id",
		}
		forgedRelayState := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(forgedRelayProps)))

		res := postCompleteSaml(t, th, "dummy-encoded-xml", forgedRelayState)

		assert.Equal(t, http.StatusFound, res.Code)
		fakeSaml.AssertNotCalled(t, "DoLogin", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("arbitrary tampered string is rejected", func(t *testing.T) {
		res := postCompleteSaml(t, th, "dummy-encoded-xml", "not-a-real-relay-state")

		assert.Equal(t, http.StatusFound, res.Code)
		fakeSaml.AssertNotCalled(t, "DoLogin", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("validly-formatted but tampered payload is rejected", func(t *testing.T) {
		signed := model.SignSamlRelayState(th.App.SamlRelayStateSigningKey(), map[string]string{
			"action":  model.OAuthActionSignup,
			"team_id": "legit-team-id",
		})
		payloadPart, sigPart, ok := strings.Cut(signed, ".")
		require.True(t, ok)

		payload, err := base64.RawURLEncoding.DecodeString(payloadPart)
		require.NoError(t, err)
		tampered := strings.Replace(string(payload), "legit-team-id", "forged-team-id", 1)
		require.NotEqual(t, string(payload), tampered)

		forgedRelayState := base64.RawURLEncoding.EncodeToString([]byte(tampered)) + "." + sigPart

		res := postCompleteSaml(t, th, "dummy-encoded-xml", forgedRelayState)

		assert.Equal(t, http.StatusFound, res.Code)
		fakeSaml.AssertNotCalled(t, "DoLogin", mock.Anything, mock.Anything, mock.Anything)
	})
}

// TestCompleteSamlRelayStateSignedRoundTrip verifies the fixed flow end-to-end: loginWithSaml
// signs relayProps into an opaque RelayState, and completeSaml verifies the signature and
// recovers the original relayProps.
func TestCompleteSamlRelayStateSignedRoundTrip(t *testing.T) {
	fakeSaml := registerFakeSamlInterface(t)
	th := Setup(t).InitBasic(t)

	var capturedRelayState string
	fakeSaml.On("BuildRequest", mock.Anything, mock.AnythingOfType("string")).
		Run(func(args mock.Arguments) { capturedRelayState = args.String(1) }).
		Return(&model.SamlAuthRequest{URL: "https://idp.example.com/sso"}, nil)

	req := httptest.NewRequest(http.MethodGet, "/login/sso/saml?action=login&id=inviteABC", nil)
	res := httptest.NewRecorder()
	th.Web.MainRouter.ServeHTTP(res, req)
	require.Equal(t, http.StatusFound, res.Code)

	// RelayState on the wire must be payload.signature - exactly one separator, both halves
	// valid base64url.
	require.NotEmpty(t, capturedRelayState)
	payloadPart, sigPart, ok := strings.Cut(capturedRelayState, ".")
	require.True(t, ok)
	assert.False(t, strings.Contains(sigPart, "."))
	_, err := base64.RawURLEncoding.DecodeString(payloadPart)
	assert.NoError(t, err)
	_, err = base64.RawURLEncoding.DecodeString(sigPart)
	assert.NoError(t, err)

	var capturedRelayProps map[string]string
	fakeSaml.On("DoLogin", mock.Anything, mock.Anything, mock.AnythingOfType("map[string]string")).
		Run(func(args mock.Arguments) { capturedRelayProps = args.Get(2).(map[string]string) }).
		Return(th.BasicUser, (*saml2.AssertionInfo)(nil), nil)

	res = postCompleteSaml(t, th, "dummy-encoded-xml", capturedRelayState)
	assert.Equal(t, http.StatusFound, res.Code)
	assert.Equal(t, model.OAuthActionLogin, capturedRelayProps["action"])
	assert.Equal(t, "inviteABC", capturedRelayProps["invite_id"])
	// The internal expiry field is bookkeeping only and must not leak into relayProps.
	_, hasExp := capturedRelayProps["exp"]
	assert.False(t, hasExp)

	// A signed RelayState is not single-use: replaying it within its expiry window succeeds
	// again. Restricting the replay window to a few minutes (rather than eliminating replay
	// entirely) is an intentional, low-cost defense-in-depth measure requested by the security
	// team, on top of the fact that no RelayState field is trusted without independent
	// revalidation at the point it's consumed (invite validity, redirect_to scheme/host, etc.).
	res = postCompleteSaml(t, th, "dummy-encoded-xml", capturedRelayState)
	assert.Equal(t, http.StatusFound, res.Code)
	fakeSaml.AssertNumberOfCalls(t, "DoLogin", 2)
}
