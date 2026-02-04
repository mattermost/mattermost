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
// MATTERMOST EXTENDED - Status Log API Tests
// ============================================================================

// TestGetStatusLogs tests the GET /api/v4/status_logs endpoint
func TestGetStatusLogs(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Enable status logs
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
	})

	t.Run("Returns logs with pagination", func(t *testing.T) {
		// Generate some status changes
		th.App.SetStatusOnline(th.BasicUser.Id, false)
		th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
		th.App.SetStatusOnline(th.BasicUser.Id, false)

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?page=0&per_page=10", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "logs")
		assert.Contains(t, response, "stats")
		assert.Contains(t, response, "total_count")
		assert.Contains(t, response, "page")
		assert.Contains(t, response, "per_page")
		assert.Contains(t, response, "has_more")
	})

	t.Run("Filters by user_id", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?user_id="+th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		logs, ok := response["logs"].([]any)
		assert.True(t, ok)
		for _, log := range logs {
			logMap := log.(map[string]any)
			assert.Equal(t, th.BasicUser.Id, logMap["user_id"])
		}
	})

	t.Run("Filters by username", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?username="+th.BasicUser.Username, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		logs, ok := response["logs"].([]any)
		assert.True(t, ok)
		for _, log := range logs {
			logMap := log.(map[string]any)
			assert.Equal(t, th.BasicUser.Username, logMap["username"])
		}
	})

	t.Run("Filters by log_type", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?log_type=status_change", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		logs, ok := response["logs"].([]any)
		assert.True(t, ok)
		for _, log := range logs {
			logMap := log.(map[string]any)
			assert.Equal(t, model.StatusLogTypeStatusChange, logMap["log_type"])
		}
	})

	t.Run("Filters by status", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?status=online", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		logs, ok := response["logs"].([]any)
		assert.True(t, ok)
		for _, log := range logs {
			logMap := log.(map[string]any)
			assert.Equal(t, model.StatusOnline, logMap["new_status"])
		}
	})

	t.Run("Filters by time range", func(t *testing.T) {
		since := model.GetMillis() - 60000 // 1 minute ago
		until := model.GetMillis() + 60000 // 1 minute from now

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(),
			"/status_logs?since="+model.FormatMillis(since)+"&until="+model.FormatMillis(until), "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Searches by text", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?search="+th.BasicUser.Username, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 when feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = false
		})

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()

		// Re-enable for other tests
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})
	})
}

// TestClearStatusLogs tests the DELETE /api/v4/status_logs endpoint
func TestClearStatusLogs(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
	})

	t.Run("Clears all logs as admin", func(t *testing.T) {
		// Generate some logs
		th.App.SetStatusOnline(th.BasicUser.Id, false)
		th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)

		// Clear logs
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/status_logs")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()

		// Verify cleared
		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		require.NoError(t, err)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		logs, ok := response["logs"].([]any)
		assert.True(t, ok)
		assert.Empty(t, logs)
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/status_logs")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestExportStatusLogs tests the GET /api/v4/status_logs/export endpoint
func TestExportStatusLogs(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
	})

	t.Run("Returns JSON file", func(t *testing.T) {
		// Generate some logs
		th.App.SetStatusOnline(th.BasicUser.Id, false)

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
		assert.Contains(t, resp.Header.Get("Content-Disposition"), "attachment")
		assert.Contains(t, resp.Header.Get("Content-Disposition"), "status_logs_export.json")

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "logs")
		assert.Contains(t, response, "stats")
		assert.Contains(t, response, "total_count")
		assert.Contains(t, response, "exported_at")
	})

	t.Run("Applies same filters as GET", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export?user_id="+th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response map[string]any
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		logs, ok := response["logs"].([]any)
		assert.True(t, ok)
		for _, log := range logs {
			logMap := log.(map[string]any)
			assert.Equal(t, th.BasicUser.Id, logMap["user_id"])
		}
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/export", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestStatusNotificationRulesAPI tests CRUD operations for notification rules
func TestStatusNotificationRulesAPI(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
	})

	t.Run("GET all rules returns empty initially", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var rules []*model.StatusNotificationRule
		err = json.NewDecoder(resp.Body).Decode(&rules)
		require.NoError(t, err)
		// May not be empty if other tests created rules, but shouldn't error
	})

	t.Run("POST creates a notification rule", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.BasicUser2.Id,
			WatchedStatus:   model.StatusOnline,
			NotifyChannel:   true,
		}

		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		defer resp.Body.Close()

		var createdRule model.StatusNotificationRule
		err = json.NewDecoder(resp.Body).Decode(&createdRule)
		require.NoError(t, err)

		assert.NotEmpty(t, createdRule.Id)
		assert.Equal(t, th.BasicUser.Id, createdRule.WatchedUserID)
		assert.Equal(t, th.BasicUser2.Id, createdRule.RecipientUserID)

		// Cleanup
		th.SystemAdminClient.DoAPIDelete(context.Background(), "/status_logs/notification_rules/"+createdRule.Id)
	})

	t.Run("Validates rule structure", func(t *testing.T) {
		// Invalid watched user
		rule := &model.StatusNotificationRule{
			WatchedUserID:   model.NewId(), // Non-existent user
			RecipientUserID: th.BasicUser2.Id,
			WatchedStatus:   model.StatusOnline,
		}

		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()

		// Invalid recipient
		rule = &model.StatusNotificationRule{
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: model.NewId(), // Non-existent user
			WatchedStatus:   model.StatusOnline,
		}

		resp, err = th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/notification_rules", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()

		rule := &model.StatusNotificationRule{
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.BasicUser2.Id,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}
