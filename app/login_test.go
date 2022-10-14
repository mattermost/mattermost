// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
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

func TestCWSLogin(t *testing.T) {

	th := Setup(t).InitBasic()
	defer th.TearDown()
	license := model.NewTestLicense()
	license.Features.Cloud = model.NewBool(true)
	th.App.Srv().SetLicense(license)

	t.Run("Should authenticate user when CWS login is enabled and tokens are equal", func(t *testing.T) {
		token := model.NewToken(TokenTypeCWSAccess, "")
		defer th.App.DeleteToken(token)
		os.Setenv("CWS_CLOUD_TOKEN", token.Token)
		user, err := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", token.Token, false)
		require.Nil(t, err)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
		_, apperr := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.NoError(t, apperr)
		th.App.DeleteToken(token)
	})

	t.Run("Should not authenticate the user when CWS token was used", func(t *testing.T) {
		token := model.NewToken(TokenTypeCWSAccess, "")
		os.Setenv("CWS_CLOUD_TOKEN", token.Token)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)
		user, err := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", token.Token, false)
		require.NotNil(t, err)
		require.Nil(t, user)
	})
}
