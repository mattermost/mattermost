// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// CROSS-FEATURE ADVANCED ISOLATION
// ----------------------------------------------------------------------------

func TestAllFeaturesDisabledSimultaneously(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = false
		cfg.FeatureFlags.ErrorLogDashboard = false
		cfg.FeatureFlags.CustomChannelIcons = false
		cfg.FeatureFlags.CustomThreadNames = false
		boolFalse := false
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolFalse
	})

	// Every custom endpoint should return 403 or 501
	endpoints := []struct {
		name   string
		method string
		path   string
		body   any
	}{
		{"Encryption register key", "POST", "/encryption/publickey", &model.EncryptionPublicKeyRequest{PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB","pad":"12345"}`}},
		{"Error log submit", "POST", "/errors", &model.ErrorLogReport{Type: model.ErrorLogTypeJS, Message: "test"}},
		{"Error log list", "GET", "/errors", nil},
		{"Error log clear", "DELETE", "/errors", nil},
		{"Custom icons list", "GET", "/custom_channel_icons", nil},
		{"Custom icons create", "POST", "/custom_channel_icons", &model.CustomChannelIcon{Name: "test", Svg: base64.StdEncoding.EncodeToString([]byte("<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>"))}},
		{"Status logs list", "GET", "/status_logs", nil},
		{"Status logs export", "GET", "/status_logs/export", nil},
		{"Status logs clear", "DELETE", "/status_logs", nil},
		{"Notification rules list", "GET", "/status_logs/notification_rules", nil},
	}

	for _, ep := range endpoints {
		t.Run(ep.name+" returns 403 or 501 when disabled", func(t *testing.T) {
			var resp *http.Response
			var err error

			switch ep.method {
			case "GET":
				resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), ep.path, "")
			case "POST":
				resp, err = th.SystemAdminClient.DoAPIPostJSON(context.Background(), ep.path, ep.body)
			case "DELETE":
				resp, err = th.SystemAdminClient.DoAPIDelete(context.Background(), ep.path)
			}

			if err == nil {
				closeIfOpen(resp, err)
				t.Fatalf("Expected error response for disabled endpoint %s", ep.name)
			}
			assert.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotImplemented,
				"Expected 403 or 501 for %s, got %d", ep.name, resp.StatusCode)
		})
	}
}

func TestAllFeaturesEnabledSimultaneously(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
		cfg.FeatureFlags.ErrorLogDashboard = true
		cfg.FeatureFlags.CustomChannelIcons = true
		cfg.FeatureFlags.CustomThreadNames = true
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	t.Run("All read endpoints work simultaneously for admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		resp, err = th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Regular user permissions still enforced when all features enabled", func(t *testing.T) {
		// Admin-only endpoints still blocked
		resp, err := th.Client.DoAPIGet(context.Background(), "/errors", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)

		resp, err = th.Client.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)

		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)

		// User-accessible endpoints work
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		resp, err = th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestFeatureFlagToggleDuringUse(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Encryption key persists after feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register a key
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("a", 100) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Disable encryption
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = false
		})

		// Can't register new keys
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusForbidden)

		// But status still works (read-only endpoint)
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		// Re-enable and verify key still exists
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Custom icons persist after feature disabled and re-enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CustomChannelIcons = true
			*cfg.CacheSettings.CacheType = "lru"
		})

		icon := &model.CustomChannelIcon{Name: "toggle-test", Svg: base64.StdEncoding.EncodeToString([]byte("<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>"))}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CustomChannelIcons = false
		})

		resp, err = th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CustomChannelIcons = true
		})

		resp, err = th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestUnauthenticatedAccessToCustomEndpoints(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
		cfg.FeatureFlags.ErrorLogDashboard = true
		cfg.FeatureFlags.CustomChannelIcons = true
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
	})

	// All custom endpoints require authentication
	unauthPaths := []struct {
		name string
		path string
	}{
		{"Encryption status", "/encryption/status"},
		{"Encryption publickey", "/encryption/publickey"},
		{"Error logs", "/errors"},
		{"Custom channel icons", "/custom_channel_icons"},
		{"Status logs", "/status_logs"},
		{"Status log export", "/status_logs/export"},
		{"Notification rules", "/status_logs/notification_rules"},
		{"Admin encryption keys", "/encryption/admin/keys"},
	}

	for _, ep := range unauthPaths {
		t.Run(ep.name+" requires authentication", func(t *testing.T) {
			resp, err := http.Get(th.Client.APIURL + ep.path)
			if err != nil {
				t.Fatalf("HTTP request failed: %v", err)
			}
			defer resp.Body.Close()

			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
				"Expected 401 for unauthenticated request to %s, got %d", ep.path, resp.StatusCode)
		})
	}
}
