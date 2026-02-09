// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// MATTERMOST EXTENDED - Security Test Helpers
//
// NOTE: When Mattermost client methods (DoAPIGet, DoAPIPostJSON, etc.) receive
// a 4xx/5xx response, they return (resp, err) where err is non-nil and the body
// is already closed. For 2xx responses, err is nil and the caller must close the
// body. We use checkStatusCode() to handle both cases uniformly.
// ============================================================================

// checkStatusCode asserts that the response has the expected status code.
// Handles both success (err=nil) and error (err!=nil) cases from Mattermost client.
func checkStatusCode(t *testing.T, resp *http.Response, err error, expectedStatus int) {
	t.Helper()
	if expectedStatus >= 300 {
		require.Error(t, err, "Expected error for status %d but got nil", expectedStatus)
	} else {
		require.NoError(t, err, "Expected no error for status %d", expectedStatus)
	}
	require.NotNil(t, resp, "Response should not be nil")
	assert.Equal(t, expectedStatus, resp.StatusCode)
}

// closeIfOpen closes the response body if it was a success response (2xx).
// For error responses (4xx/5xx), the client already closed the body.
func closeIfOpen(resp *http.Response, err error) {
	if err == nil && resp != nil && resp.Body != nil {
		resp.Body.Close()
	}
}
