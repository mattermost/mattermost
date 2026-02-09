// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// STATUS LOG SECURITY
// ----------------------------------------------------------------------------

func TestStatusLogSecurityFeatureDisabled(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolFalse := false
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolFalse
	})

	t.Run("GET status_logs returns 403 when disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE status_logs returns 403 when disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/status_logs")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET status_logs/export returns 403 when disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET notification_rules returns 403 when disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("POST notification_rules returns 403 when disabled", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "test-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET notification_rules/{id} returns 403 when disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules/"+model.NewId(), "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("PUT notification_rules/{id} returns 403 when disabled", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "updated-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
		}
		resp, err := th.SystemAdminClient.DoAPIPutJSON(context.Background(), "/status_logs/notification_rules/"+model.NewId(), rule)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE notification_rules/{id} returns 403 when disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/status_logs/notification_rules/"+model.NewId())
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestStatusLogSecurityPermissions(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("GET status_logs returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE status_logs returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/status_logs")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET status_logs/export returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/export", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET notification_rules returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/notification_rules", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("POST notification_rules returns 403 for regular user", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "test-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET notification_rules/{id} returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/notification_rules/"+model.NewId(), "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("PUT notification_rules/{id} returns 403 for regular user", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "updated-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
		}
		resp, err := th.Client.DoAPIPutJSON(context.Background(), "/status_logs/notification_rules/"+model.NewId(), rule)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE notification_rules/{id} returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/status_logs/notification_rules/"+model.NewId())
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can GET status_logs", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can DELETE status_logs", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/status_logs")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can GET status_logs/export", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can GET notification_rules", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestStatusLogSecurityPagination(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("per_page exceeding max is capped to 1000", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?per_page=5000", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var response map[string]any
		decErr := json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, decErr)
		perPage := int(response["per_page"].(float64))
		assert.Equal(t, 1000, perPage)
	})

	t.Run("Negative per_page defaults to 100", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?per_page=-1", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var response map[string]any
		decErr := json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, decErr)
		perPage := int(response["per_page"].(float64))
		assert.Equal(t, 100, perPage)
	})
}

func TestStatusLogSecurityNotificationRuleCRUD(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("Create notification rule returns 201", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "test-security-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online,status_offline",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		checkStatusCode(t, resp, err, http.StatusCreated)
		defer closeIfOpen(resp, err)

		var created model.StatusNotificationRule
		decErr := json.NewDecoder(resp.Body).Decode(&created)
		require.NoError(t, decErr)
		assert.NotEmpty(t, created.Id)
		assert.Equal(t, "test-security-rule", created.Name)
		assert.Equal(t, th.SystemAdminUser.Id, created.CreatedBy)
	})

	t.Run("Create rule with non-existent watched user returns 400", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "test-rule",
			WatchedUserID:   model.NewId(),
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_online",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create rule with non-existent recipient returns 400", func(t *testing.T) {
		rule := &model.StatusNotificationRule{
			Name:            "test-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: model.NewId(),
			EventFilters:    "status_online",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Get non-existent rule returns 404", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules/"+model.NewId(), "")
		checkStatusCode(t, resp, err, http.StatusNotFound)
	})
}

func TestStatusLogSecuritySQLInjection(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("SQL injection in search parameter does not cause server error", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?search='+OR+1=1--", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in username filter does not cause server error", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?username=admin'+OR+'1'='1", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in user_id filter does not cause server error", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?user_id='+DROP+TABLE+statuslogs--", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in log_type filter does not cause server error", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs?log_type=status_change'+UNION+SELECT+*+FROM+users--", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in export endpoint does not cause server error", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export?search='+OR+1=1--", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestStatusLogExportSecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("Export returns correct content-type header", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		contentType := resp.Header.Get("Content-Type")
		assert.Contains(t, contentType, "application/json")

		contentDisp := resp.Header.Get("Content-Disposition")
		assert.Contains(t, contentDisp, "attachment")
		assert.Contains(t, contentDisp, "status_logs_export.json")
	})

	t.Run("Export with SQL injection in filters returns 200 safely", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/export?username=admin'+OR+'1'='1", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Regular user cannot export", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/export", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestNotificationRuleLifecycleSecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	// Create a rule as admin
	rule := &model.StatusNotificationRule{
		Name:            "lifecycle-test-rule",
		WatchedUserID:   th.BasicUser.Id,
		RecipientUserID: th.SystemAdminUser.Id,
		EventFilters:    "status_online,status_offline",
	}
	resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/status_logs/notification_rules", rule)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var createdRule model.StatusNotificationRule
	decErr := json.NewDecoder(resp.Body).Decode(&createdRule)
	require.NoError(t, decErr)
	closeIfOpen(resp, err)

	t.Run("Regular user cannot read the created rule", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/status_logs/notification_rules/"+createdRule.Id, "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can read the created rule", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules/"+createdRule.Id, "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var fetchedRule model.StatusNotificationRule
		decErr := json.NewDecoder(resp.Body).Decode(&fetchedRule)
		require.NoError(t, decErr)
		assert.Equal(t, createdRule.Id, fetchedRule.Id)
		assert.Equal(t, "lifecycle-test-rule", fetchedRule.Name)
	})

	t.Run("Regular user cannot update the rule", func(t *testing.T) {
		updatedRule := &model.StatusNotificationRule{
			Name:            "hacked-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.BasicUser2.Id,
			EventFilters:    "all",
		}
		resp, err := th.Client.DoAPIPutJSON(context.Background(), "/status_logs/notification_rules/"+createdRule.Id, updatedRule)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can update the rule", func(t *testing.T) {
		updatedRule := &model.StatusNotificationRule{
			Name:            "updated-lifecycle-rule",
			WatchedUserID:   th.BasicUser.Id,
			RecipientUserID: th.SystemAdminUser.Id,
			EventFilters:    "status_any",
		}
		resp, err := th.SystemAdminClient.DoAPIPutJSON(context.Background(), "/status_logs/notification_rules/"+createdRule.Id, updatedRule)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var result model.StatusNotificationRule
		decErr := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, decErr)
		assert.Equal(t, "updated-lifecycle-rule", result.Name)
	})

	t.Run("Regular user cannot delete the rule", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/status_logs/notification_rules/"+createdRule.Id)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can delete the rule", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/status_logs/notification_rules/"+createdRule.Id)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Deleted rule returns 404 on subsequent get", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs/notification_rules/"+createdRule.Id, "")
		checkStatusCode(t, resp, err, http.StatusNotFound)
	})
}
