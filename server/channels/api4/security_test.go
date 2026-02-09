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

// ============================================================================
// MATTERMOST EXTENDED - Comprehensive Security Tests
//
// Tests authorization, permission boundaries, input validation, feature flag
// enforcement, and cross-feature isolation for all custom API endpoints.
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
		// For error status codes, client returns non-nil error
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

// ----------------------------------------------------------------------------
// 1. ENCRYPTION API SECURITY
// ----------------------------------------------------------------------------

func TestEncryptionSecurityFeatureFlagDisabled(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = false
	})

	t.Run("RegisterPublicKey returns 403 when encryption disabled", func(t *testing.T) {
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"test-key","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GetEncryptionStatus returns OK with disabled flag when encryption off", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var status model.EncryptionStatus
		decErr := json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, decErr)
		assert.False(t, status.Enabled)
		assert.False(t, status.CanEncrypt)
	})

	t.Run("GetMyPublicKey returns OK with empty key when encryption off", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.Empty(t, key.PublicKey)
	})
}

func TestEncryptionSecurityAdminEndpoints(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("GET admin/keys returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys/orphaned returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/orphaned")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys/session/{id} returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/session/"+model.NewId())
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys/{user_id} returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/"+th.BasicUser.Id)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can access GET admin/keys", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can access DELETE admin/keys", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can access DELETE admin/keys/orphaned", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/orphaned")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestEncryptionSecurityChannelPermissions(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Non-member of private channel gets 403 for channel keys", func(t *testing.T) {
		// Create private channel that only BasicUser is a member of
		privateChannel := th.CreatePrivateChannel(t)

		// Login as BasicUser2 who is NOT a member of the private channel
		th.LoginBasic2(t)
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+privateChannel.Id+"/keys", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Channel member can access channel keys", func(t *testing.T) {
		th.LoginBasic(t)
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+th.BasicChannel.Id+"/keys", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestEncryptionSecurityInputValidation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Bulk public keys with empty user_ids returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Bulk public keys with invalid user_id format returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{"invalid-id-format"},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Bulk public keys with >200 user_ids returns 400", func(t *testing.T) {
		ids := make([]string, 201)
		for i := range ids {
			ids[i] = model.NewId()
		}
		req := &model.EncryptionPublicKeysRequest{
			UserIds: ids,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Register public key with empty key returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: "",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Register public key with non-JSON format returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: "not-json-key",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Register public key with short invalid JSON returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: "{a}",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

func TestEncryptionSecuritySessionIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("User can only see own key via GET publickey", func(t *testing.T) {
		// Register key for BasicUser
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"user1-key-data","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Login as BasicUser2 and check they see their own (empty) key
		th.LoginBasic2(t)
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.Empty(t, key.PublicKey)
		assert.Equal(t, th.BasicUser2.Id, key.UserId)
	})

	t.Run("User2 can fetch User1 key only via bulk endpoint", func(t *testing.T) {
		th.LoginBasic2(t)
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{th.BasicUser.Id},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var keys []*model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, decErr)
		assert.NotEmpty(t, keys)
	})
}

// ----------------------------------------------------------------------------
// 2. ERROR LOG SECURITY
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
		// Clear first
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

		// Verify admin can retrieve errors
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

// ----------------------------------------------------------------------------
// 3. STATUS LOG SECURITY
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

// ----------------------------------------------------------------------------
// 4. CUSTOM CHANNEL ICONS SECURITY
// ----------------------------------------------------------------------------

func TestCustomChannelIconSecurityFeatureFlag(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = false
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("GET list returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("POST create returns 403 when feature disabled", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "test", Svg: "<svg>test</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET single returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons/"+model.NewId(), "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("PUT update returns 403 when feature disabled", func(t *testing.T) {
		newName := "updated"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err := th.SystemAdminClient.DoAPIPutJSON(context.Background(), "/custom_channel_icons/"+model.NewId(), patch)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/"+model.NewId())
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestCustomChannelIconSecurityPermissions(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("Regular user can GET list", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Regular user cannot POST create", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "user-created", Svg: "<svg>hack</svg>"}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Regular user cannot PUT update", func(t *testing.T) {
		// Create icon as admin first
		icon := &model.CustomChannelIcon{Name: "admin-icon", Svg: "<svg>admin</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		var created model.CustomChannelIcon
		json.NewDecoder(resp.Body).Decode(&created)
		closeIfOpen(resp, err)

		// Regular user tries to update
		newName := "hacked"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err = th.Client.DoAPIPutJSON(context.Background(), "/custom_channel_icons/"+created.Id, patch)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Regular user cannot DELETE", func(t *testing.T) {
		// Create icon as admin
		icon := &model.CustomChannelIcon{Name: "to-delete", Svg: "<svg>del</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		var created model.CustomChannelIcon
		json.NewDecoder(resp.Body).Decode(&created)
		closeIfOpen(resp, err)

		// Regular user tries to delete
		resp, err = th.Client.DoAPIDelete(context.Background(), "/custom_channel_icons/"+created.Id)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestCustomChannelIconSecurityValidation(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("Create with missing name returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Svg: "<svg>test</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create with missing SVG returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "test"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create with SVG exceeding 50KB returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: "large-icon",
			Svg:  strings.Repeat("a", model.CustomChannelIconSvgMaxSize+1),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create with name exceeding 64 chars returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: strings.Repeat("a", model.CustomChannelIconNameMaxLength+1),
			Svg:  "<svg>test</svg>",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Update non-existent icon returns 404", func(t *testing.T) {
		newName := "ghost"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err := th.SystemAdminClient.DoAPIPutJSON(context.Background(), "/custom_channel_icons/nonexistent", patch)
		checkStatusCode(t, resp, err, http.StatusNotFound)
	})

	t.Run("Delete non-existent icon returns 404", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/nonexistent")
		checkStatusCode(t, resp, err, http.StatusNotFound)
	})

	t.Run("SVG with script tags accepted as base64 content", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: "xss-test-icon",
			Svg:  `PHN2Zz48c2NyaXB0PmFsZXJ0KCd4c3MnKTwvc2NyaXB0Pjwvc3ZnPg==`,
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})
}

// ----------------------------------------------------------------------------
// 5. PREFERENCE PUSH SECURITY
// ----------------------------------------------------------------------------

func TestPreferencePushSecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns 403 for regular user", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "display_settings",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/users/"+th.BasicUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can push preferences", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "display_settings",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var pushResp model.PushPreferenceResponse
		decErr := json.NewDecoder(resp.Body).Decode(&pushResp)
		require.NoError(t, decErr)
		assert.GreaterOrEqual(t, pushResp.AffectedUsers, int64(0))
	})

	t.Run("Empty category returns 400", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Category exceeding 32 chars returns 400", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: strings.Repeat("a", 33),
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Name exceeding 32 chars returns 400", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     strings.Repeat("a", 33),
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

// ----------------------------------------------------------------------------
// 6. PREFERENCE DISCOVERY SECURITY
// ----------------------------------------------------------------------------

func TestPreferenceDiscoverySecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/users/"+th.BasicUser.Id+"/preferences/discover", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can discover preferences", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/discover", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var keys []model.PreferenceKey
		decErr := json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, decErr)
		assert.NotNil(t, keys)
	})
}

// ----------------------------------------------------------------------------
// 7. CROSS-FEATURE SECURITY
// ----------------------------------------------------------------------------

func TestCrossFeatureIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Status log disabled even when encryption enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
			boolFalse := false
			cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolFalse
		})

		// Status logs should be forbidden
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)

		// But encryption should work
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Encryption disabled even when status logs enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = false
			boolTrue := true
			cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
		})

		// Encryption register should be forbidden
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"test-key","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusForbidden)

		// But status logs should work for admin
		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Error log disabled even when other features enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
			cfg.FeatureFlags.CustomChannelIcons = true
			cfg.FeatureFlags.ErrorLogDashboard = false
		})

		report := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "test error",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/errors", report)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Custom channel icons disabled even when other features enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
			cfg.FeatureFlags.ErrorLogDashboard = true
			cfg.FeatureFlags.CustomChannelIcons = false
		})

		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

// ----------------------------------------------------------------------------
// 8. NOTIFICATION RULE FULL LIFECYCLE SECURITY
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// 9. ENCRYPTION ADMIN OPERATIONS - USER KEY ISOLATION
// ----------------------------------------------------------------------------

func TestEncryptionAdminDeleteUserKeysIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Admin deleting user1 keys does not affect user2", func(t *testing.T) {
		// Register key for BasicUser
		th.LoginBasic(t)
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"user1-key-isolation","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Register key for BasicUser2
		th.LoginBasic2(t)
		keyReq2 := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"user2-key-isolation","e":"AQAB"}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq2)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Admin deletes user1 keys
		resp, err = th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/"+th.BasicUser.Id)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		// User2 key should still exist
		th.LoginBasic2(t)
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.NotEmpty(t, key.PublicKey)
		assert.Contains(t, key.PublicKey, "user2-key-isolation")
	})
}

// ----------------------------------------------------------------------------
// 10. STATUS LOG EXPORT SECURITY
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// 11. ERROR LOG CONCURRENT USER ISOLATION
// ----------------------------------------------------------------------------

func TestErrorLogUserIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ErrorLogDashboard = true
	})

	t.Run("Error reports from different users both visible to admin", func(t *testing.T) {
		// Clear existing
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/errors")
		closeIfOpen(resp, err)

		// User 1 reports error
		th.LoginBasic(t)
		report1 := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeJS,
			Message: "User1 error",
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report1)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		// User 2 reports error
		th.LoginBasic2(t)
		report2 := &model.ErrorLogReport{
			Type:    model.ErrorLogTypeAPI,
			Message: "User2 error",
			Extra:   `{"method":"GET","status_code":404}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/errors", report2)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		// Admin sees both
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
