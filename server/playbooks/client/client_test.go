// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client_test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/stretchr/testify/require"
)

// setup sets up a test HTTP server and matching Client.
//
// Tests should register handlers on mux providing mock responses for the API method being tested.
func setup(t *testing.T) (c *client.Client, mux *http.ServeMux, serverURL string) {
	baseURLPath := ""

	// mux is the HTTP request multiplexer used with the test server.
	mux = http.NewServeMux()

	apiHandler := http.NewServeMux()
	apiHandler.Handle(baseURLPath+"/", http.StripPrefix(baseURLPath, mux))

	// server is a test HTTP server used to provide mock API responses.
	server := httptest.NewServer(apiHandler)
	t.Cleanup(server.Close)
	serverURL = server.URL

	// client is the workflows client being tested and is
	// configured to use test server.
	c, _ = client.NewClient("", &http.Client{})
	parsedURL, _ := url.Parse(server.URL + baseURLPath + "/")
	c.BaseURL = parsedURL

	return c, mux, serverURL
}

func testMethod(t *testing.T, r *http.Request, want string) {
	t.Helper()
	got := r.Method
	require.Equal(t, want, got, "request method: %v, want %v", got, want)
}

type values map[string]string

func testFormValues(t *testing.T, r *http.Request, values values) {
	t.Helper()
	want := url.Values{}
	for k, v := range values {
		want.Set(k, v)
	}

	require.NoError(t, r.ParseForm())
	got := r.Form
	require.Equal(t, want, got, "request parameters: %v, want %v", got, want)
}
