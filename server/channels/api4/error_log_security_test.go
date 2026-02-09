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
// ERROR LOG SECURITY
// ----------------------------------------------------------------------------

func TestErrorLogSecurityFeatureFlag(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = false
	})

	t.Run("POST errors returns 403 when feature disabled", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "test error",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET errors returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE errors returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestErrorLogSecurityPermissions(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("GET errors returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE errors returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/errors")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("POST errors allowed for regular authenticated user", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "client-side error",
			Stack:   "Error: test\n    at test.js:1:1",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can GET errors", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can DELETE errors", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestErrorLogSecurityInputValidation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("Missing type returns 400", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Message: "test error",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Invalid type returns 400", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:    "invalid_type",
			Message: "test error",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Empty message returns 400", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type: model.ErrorLogTypeJS,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Large payload is accepted", func(t *testing.T) {
		largeMessage := strings.Repeat("A", 100*1024)
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: largeMessage,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("XSS in error message is stored without causing server error", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		closeIfOpen(resp, err)

		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: `<script>alert("xss")</script>`,
			Stack:   `<img src=x onerror=alert(1)>`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var response map[string]any
		decErr := json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, decErr)
		errors := response["errors"].([]any)
		assert.GreaterOrEqual(t, len(errors), 1)
	})

	t.Run("API error with request payload and response body accepted", func(t *testing.T) {
		report := &model.ErrorLogReport{
			Type:           model.ErrorLogTypeAPI,
			Message:        "API 500 error",
			Url:            "/api/v4/posts",
			Extra:          `{"method":"POST","status_code":500}`,
			RequestPayload: `{"channel_id":"abc","message":"test","password":"secret123"}`,
			ResponseBody:   `{"id":"server_error","message":"Internal Server Error"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestErrorLogUserIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("Error reports from different users both visible to admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		closeIfOpen(resp, err)

		th.LoginBasic(t)
		report1 := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "User1 error",
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report1)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		th.LoginBasic2(t)
		report2 := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeAPI,
			Message: "User2 error",
			Extra:   `{"method":"GET","status_code":404}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report2)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var response map[string]any
		decErr := json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, decErr)
		errors := response["errors"].([]any)
		assert.GreaterOrEqual(t, len(errors), 2)
	})
}
