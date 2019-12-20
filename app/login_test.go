// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
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
