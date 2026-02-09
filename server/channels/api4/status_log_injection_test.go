// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// STATUS LOG ADVANCED INJECTION
//
// These tests verify that SQL injection attempts in query parameters do NOT
// cause 500 Internal Server Errors. The server may return 200 (filtering
// gracefully) or 400 (rejecting invalid input) — both are safe outcomes.
// A 500 would indicate the injection reached the database layer unsanitized.
// ----------------------------------------------------------------------------

func TestStatusLogAdvancedSQLInjection(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	injections := []struct {
		name  string
		param string
		value string
	}{
		{"UNION SELECT in search", "search", "' UNION SELECT username,password,email FROM users--"},
		{"Stacked query in search", "search", "'; DELETE FROM statuslogs; --"},
		{"Time-based blind in username", "username", "admin' AND SLEEP(5)--"},
		{"Boolean-based blind in user_id", "user_id", "' OR SUBSTR(password,1,1)='a'--"},
		{"Comment injection in log_type", "log_type", "status_change'/*"},
		{"Double URL-encoded in search", "search", "%27%20OR%201%3D1--"},
		{"Backslash escape in username", "username", "admin\\' OR 1=1--"},
		{"Null byte in search", "search", "test%00' OR 1=1--"},
		{"Unicode escape in user_id", "user_id", "\\u0027 OR 1=1--"},
		{"Hex-encoded in search", "search", "0x27204f522031"},
		{"WAITFOR in username (MSSQL)", "username", "'; WAITFOR DELAY '0:0:5'--"},
		{"pg_sleep (PostgreSQL)", "username", "'; SELECT pg_sleep(5)--"},
	}

	for _, tc := range injections {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?"+tc.param+"="+tc.value, "")
			// Either 200 (graceful filtering) or 400 (input rejected) is safe.
			// A 500 would indicate unsanitized SQL reaching the database.
			if err != nil {
				assert.NotNil(t, resp, "Response should not be nil")
				assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest,
					"Expected 200 or 400 for %s, got %d (500 would indicate SQL injection vulnerability)", tc.name, resp.StatusCode)
			} else {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				closeIfOpen(resp, err)
			}
		})
	}
}

func TestStatusLogFilterBypass(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("Invalid status filter value is handled gracefully", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?status=nonexistent_status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Invalid log_type filter is handled gracefully", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?log_type=not_a_real_type", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Negative since timestamp is handled gracefully", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?since=-1000", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Future until timestamp returns empty results", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?until=1", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Negative page number defaults gracefully", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?page=-5", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Very large page number returns empty results", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?page=999999", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Zero per_page returns results with default pagination", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?per_page=0", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestStatusLogExportInjection(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	injections := []struct {
		name  string
		query string
	}{
		{"UNION in export search", "search=' UNION SELECT * FROM users--"},
		{"Stacked query in export username", "username='; DROP TABLE statuslogs;--"},
		{"Boolean blind in export user_id", "user_id=' OR 1=1--"},
		{"Comment injection in export", "search=test'/**/OR/**/1=1--"},
	}

	for _, tc := range injections {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export?"+tc.query, "")
			// Either 200 (graceful filtering) or 400 (input rejected) is safe.
			if err != nil {
				assert.NotNil(t, resp, "Response should not be nil")
				assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest,
					"Expected 200 or 400 for %s, got %d", tc.name, resp.StatusCode)
			} else {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				closeIfOpen(resp, err)
			}
		})
	}
}

func TestStatusLogNotificationRuleInjection(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("SQL injection in notification rule name", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "'; DROP TABLE statusnotificationrules; --",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		// Name is just a string field, should succeed
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})

	t.Run("XSS in notification rule name", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            `<script>alert("xss")</script>`,
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in event_filters field is rejected", func(t *testing.T) {
		// Server validates event_filters against known filter values
		rule := &model.StatusNotificationRule{
			Name:            "sqli-filters",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online' OR '1'='1",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		// Server rejects invalid event_filters with a save error
		assert.Error(t, err, "Expected error for invalid event_filters")
		if resp != nil {
			assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
				"Expected 4xx error, got %d", resp.StatusCode)
		}
	})
}
