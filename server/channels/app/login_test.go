// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCheckForClientSideCert(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	var tests = []struct {
		pem           string
		subject       string
		expectedEmail string
	}{
		{"blah", "blah", ""},
		{"blah", "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=test@test.com", "test@test.com"},
		{"blah", "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/EmailAddress=test@test.com", ""},
		{"blah", "CN=www.freesoft.org/EmailAddress=test@test.com, C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft", ""},
	}

	for _, tt := range tests {
		r := &http.Request{Header: http.Header{}}
		r.Header.Add("X-SSL-Client-Cert", tt.pem)
		r.Header.Add("X-SSL-Client-Cert-Subject-DN", tt.subject)

		_, _, actualEmail := th.App.CheckForClientSideCert(r)

		require.Equal(t, actualEmail, tt.expectedEmail, "CheckForClientSideCert(%v): expected %v, actual %v", tt.subject, tt.expectedEmail, actualEmail)
	}
}

func TestLoginEvents(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Subscribe to login events
	ctx := th.Context.Context()
	successMessages, err := th.App.Srv().SystemBus().Subscribe(ctx, TopicUserLoggedIn)
	require.NoError(t, err)
	failureMessages, err := th.App.Srv().SystemBus().Subscribe(ctx, TopicUserLoginFailed)
	require.NoError(t, err)

	// Prepare test request with headers
	r := &http.Request{
		Header: http.Header{
			"User-Agent":      []string{"test-agent"},
			"X-Forwarded-For": []string{"192.168.1.1"},
		},
		RemoteAddr: "192.168.1.1",
	}

	// Create new context with the test values
	th.Context = request.NewContext(
		th.Context.Context(),
		"",            // requestId
		"192.168.1.1", // ipAddress
		"",            // xForwardedFor
		"",            // path
		"test-agent",  // userAgent
		"",            // acceptedLanguage
		nil,           // t func
	)
	w := httptest.NewRecorder()

	// Perform login
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, "", false, false, false)
	require.Nil(t, err)
	require.NotNil(t, session)

	t.Run("successful login", func(t *testing.T) {
		// Wait for and verify the success event
		select {
		case msg := <-successMessages:
			var event UserLoggedInEvent
			err := json.Unmarshal(msg.Payload, &event)
			require.NoError(t, err)
			require.Equal(t, th.BasicUser.Id, event.UserID)
			require.Equal(t, "test-agent", event.UserAgent)
			require.Equal(t, "192.168.1.1", event.IPAddress)
		case <-time.After(5 * time.Second):
			t.Fatal("Timed out waiting for login success event")
		}
	})

	t.Run("failed login", func(t *testing.T) {
		// Attempt login with empty password in a goroutine
		_, err := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", "", false)
		require.Error(t, err)

		// Now wait for and verify the failure event
		select {
		case msg := <-failureMessages:
			var event UserLoginFailedEvent
			err := json.Unmarshal(msg.Payload, &event)
			require.NoError(t, err)
			require.Equal(t, th.BasicUser.Username, event.LoginID)
			require.Equal(t, "test-agent", event.UserAgent)
			require.Equal(t, "192.168.1.1", event.IPAddress)
			require.NotEmpty(t, event.Reason)
		case <-time.After(5 * time.Second):
			t.Fatal("Timed out waiting for login failure event")
		}
	})
}

func TestCWSLogin(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	license := model.NewTestLicense()
	license.Features.Cloud = model.NewPointer(true)
	th.App.Srv().SetLicense(license)

	t.Run("Should authenticate user when CWS login is enabled and tokens are equal", func(t *testing.T) {
		token := model.NewToken(TokenTypeCWSAccess, "")
		defer func() {
			appErr := th.App.DeleteToken(token)
			require.Nil(t, appErr)
		}()

		os.Setenv("CWS_CLOUD_TOKEN", token.Token)
		user, appErr := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", token.Token, false)
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
		_, err := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.NoError(t, err)
		appErr = th.App.DeleteToken(token)
		require.Nil(t, appErr)
	})

	t.Run("Should not authenticate the user when CWS token was used", func(t *testing.T) {
		token := model.NewToken(TokenTypeCWSAccess, "")
		os.Setenv("CWS_CLOUD_TOKEN", token.Token)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer func() {
			appErr := th.App.DeleteToken(token)
			require.Nil(t, appErr)
		}()

		user, err := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", token.Token, false)
		require.NotNil(t, err)
		require.Nil(t, user)
	})
}
