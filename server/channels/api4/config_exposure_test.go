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
// CONFIGURATION EXPOSURE SECURITY
// ----------------------------------------------------------------------------

func TestConfigExposureUnauthenticated(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Use a bare HTTP client (no auth headers)
	t.Run("Unauthenticated user receives limited config", func(t *testing.T) {
		resp, err := http.Get(th.Client.APIURL + "/config/client?format=old")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		// Should have basic fields
		assert.NotEmpty(t, config["Version"])
		assert.NotEmpty(t, config["BuildNumber"])
	})

	t.Run("Feature flags are exposed to unauthenticated users", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
			cfg.FeatureFlags.ErrorLogDashboard = true
		})

		resp, err := http.Get(th.Client.APIURL + "/config/client?format=old")
		require.NoError(t, err)
		defer resp.Body.Close()

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		// All feature flags are exposed to unauthenticated users
		assert.Equal(t, "true", config["FeatureFlagEncryption"])
		assert.Equal(t, "true", config["FeatureFlagErrorLogDashboard"])
	})

	t.Run("Mattermost Extended settings NOT exposed to unauthenticated users", func(t *testing.T) {
		resp, err := http.Get(th.Client.APIURL + "/config/client?format=old")
		require.NoError(t, err)
		defer resp.Body.Close()

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		// Extended settings should not be in unauthenticated config
		assert.Empty(t, config["MattermostExtendedHideDeletedMessagePlaceholder"])
		assert.Empty(t, config["MattermostExtendedStatusesInactivityTimeoutMinutes"])
		assert.Empty(t, config["MattermostExtendedStatusesStatusPauseAllowedUsers"])
		assert.Empty(t, config["MattermostExtendedStatusesInvisibilityAllowedUsers"])
	})
}

func TestConfigExposureAuthenticated(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		boolTrue := true
		cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = &boolTrue
		pauseUsers := "admin,specialuser"
		cfg.MattermostExtendedSettings.Statuses.StatusPauseAllowedUsers = &pauseUsers
		invisUsers := "admin,vipuser"
		cfg.MattermostExtendedSettings.Statuses.InvisibilityAllowedUsers = &invisUsers
	})

	t.Run("Authenticated user receives Extended settings", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/config/client?format=old", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		assert.Equal(t, "true", config["MattermostExtendedStatusesEnableStatusLogs"])
	})

	t.Run("Status pause allowed users leaked to all authenticated users", func(t *testing.T) {
		// Even a regular user can see the allowlist of privileged users
		resp, err := th.Client.DoAPIGet(context.Background(), "/config/client?format=old", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		// This reveals which users have special status privileges
		assert.Equal(t, "admin,specialuser", config["MattermostExtendedStatusesStatusPauseAllowedUsers"])
	})

	t.Run("Invisibility allowed users leaked to all authenticated users", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/config/client?format=old", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		assert.Equal(t, "admin,vipuser", config["MattermostExtendedStatusesInvisibilityAllowedUsers"])
	})

	t.Run("Preference override keys exposed to all authenticated users", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.MattermostExtendedSettings.Preferences.Overrides = map[string]string{
				"display_settings:theme": "dark",
				"sidebar_settings:limit": "50",
			}
		})

		resp, err := th.Client.DoAPIGet(context.Background(), "/config/client?format=old", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var config map[string]string
		decErr := json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, decErr)

		overrideKeys := config["MattermostExtendedPreferenceOverrideKeys"]
		assert.NotEmpty(t, overrideKeys)
		// All override keys are visible to every user
		assert.Contains(t, overrideKeys, "display_settings:theme")
	})
}
