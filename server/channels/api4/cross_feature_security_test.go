// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// CROSS-FEATURE SECURITY
// ----------------------------------------------------------------------------

func TestCrossFeatureIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Status log disabled even when encryption enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
			boolFalse := false
			cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolFalse
		})

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/status_logs", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)

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

		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusForbidden)

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
