// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ============================================================================
// MATTERMOST EXTENDED - Error Log Dashboard API Tests
// ============================================================================

// TestReportError tests the POST /api/v4/errors endpoint
func TestReportError(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Accepts error report from authenticated user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "Test error message",
			Stack:   "Error: Test\n    at test.js:1:1",
			Url:     "https://example.com/test",
		}

		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Accepts API error report", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeAPI,
			Message: "API request failed",
			Url:     "/api/v4/users/me",
			Extra:   `{"method":"GET","status_code":500}`,
		}

		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Validates error structure", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		// Missing type
		report := &model.ErrorLogReport{
			Message: "Test error",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()

		// Invalid type
		report = &model.ErrorLogReport{
			Type:    "invalid",
			Message: "Test error",
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()

		// Missing message
		report = &model.ErrorLogReport{
			Type: model.ErrorLogTypeJS,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 when feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = false
		})

		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "Test error",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestGetErrors tests the GET /api/v4/errors endpoint
func TestGetErrors(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns all errors for admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		// First clear any existing errors
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		require.NoError(t, err)
		resp.Body.Close()

		// Report an error
		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "Test error for listing",
			Stack:   "Error: Test\n    at test.js:1:1",
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		require.NoError(t, err)
		resp.Body.Close()

		// Get errors as admin
		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "errors")
		assert.Contains(t, response, "stats")

		errors, ok := response["errors"].([]any)
		assert.True(t, ok)
		assert.GreaterOrEqual(t, len(errors), 1)

		stats, ok := response["stats"].(map[string]any)
		assert.True(t, ok)
		assert.Contains(t, stats, "total")
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		resp, err := th.Client.DoAPIGet(context.Background(), "/errors", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 when feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = false
		})

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestClearErrors tests the DELETE /api/v4/errors endpoint
func TestClearErrors(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Clears all errors for admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		// Report some errors
		for i := 0; i < 3; i++ {
			report := &model.ErrorLogReport{
				Type:    model.ErrorLogTypeJS,
				Message: "Test error to clear",
			}
			resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
			require.NoError(t, err)
			resp.Body.Close()
		}

		// Clear errors
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()

		// Verify cleared
		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		require.NoError(t, err)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		errors, ok := response["errors"].([]any)
		assert.True(t, ok)
		assert.Empty(t, errors)
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		resp, err := th.Client.DoAPIDelete(context.Background(), "/errors")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 when feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ErrorLogDashboard = false
		})

		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestErrorLogIntegration tests the full workflow
func TestErrorLogIntegration(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("Full error reporting workflow", func(t *testing.T) {
		// Clear existing
		resp, _ := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		resp.Body.Close()

		// Report JS error
		jsReport := &model.ErrorLogReport{
			Type:           model.ErrorLogTypeJS,
			Message:        "Uncaught TypeError: Cannot read property 'foo' of undefined",
			Stack:          "TypeError: Cannot read property 'foo' of undefined\n    at main.js:100:15",
			Url:            "https://chat.example.com/channels/town-square",
			ComponentStack: "    in PostList\n    in ChannelView",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", jsReport)
		require.NoError(t, err)
		resp.Body.Close()

		// Report API error
		apiReport := &model.ErrorLogReport{
			Type:           model.ErrorLogTypeAPI,
			Message:        "Request failed with status 500",
			Url:            "/api/v4/posts",
			Extra:          `{"method":"POST","status_code":500}`,
			RequestPayload: `{"channel_id":"abc123","message":"test"}`,
			ResponseBody:   `{"id":"server_error","message":"Internal Server Error"}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", apiReport)
		require.NoError(t, err)
		resp.Body.Close()

		// Verify errors are logged
		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		require.NoError(t, err)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		errors := response["errors"].([]any)
		assert.Len(t, errors, 2)

		stats := response["stats"].(map[string]any)
		assert.Equal(t, float64(2), stats["total"])
		assert.Equal(t, float64(1), stats["js"])
		assert.Equal(t, float64(1), stats["api"])

		// Clear and verify
		resp2, _ := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		resp2.Body.Close()

		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		require.NoError(t, err)

		var response2 map[string]any
		json.NewDecoder(resp.Body).Decode(&response2)
		resp.Body.Close()

		errors = response2["errors"].([]any)
		assert.Empty(t, errors)
	})
}
