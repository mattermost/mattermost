// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ============================================================================
// MATTERMOST EXTENDED - Preference Override Tests
// ============================================================================

// TestGetPreferenceWithOverride tests that admin overrides are applied to preferences
func TestGetPreferenceWithOverride(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns overridden value when set", func(t *testing.T) {
		// Set a user preference
		prefs := model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "display_settings",
				Name:     "colorize_usernames",
				Value:    "true",
			},
		}
		_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, prefs)
		require.NoError(t, err)

		// Verify user's preference
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "colorize_usernames")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)

		// Set admin override
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["display_settings:colorize_usernames"] = "false"
		})

		// Verify override is applied
		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "colorize_usernames")
		require.NoError(t, err)
		assert.Equal(t, "false", pref.Value) // Override applied

		// Clean up
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.MattermostExtendedSettings.Preferences.Overrides, "display_settings:colorize_usernames")
		})
	})

	t.Run("Returns user value when no override", func(t *testing.T) {
		// Set a user preference
		prefs := model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "display_settings",
				Name:     "use_military_time",
				Value:    "true",
			},
		}
		_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, prefs)
		require.NoError(t, err)

		// Clear any overrides
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
		})

		// Verify user's preference is returned
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "use_military_time")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)
	})
}

// TestPreferenceOverrideApplied tests that overrides are enforced and cannot be changed
func TestPreferenceOverrideApplied(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("User cannot change overridden preference", func(t *testing.T) {
		// Set admin override
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["display_settings:name_format"] = "username"
		})

		// User tries to change the preference
		prefs := model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "display_settings",
				Name:     "name_format",
				Value:    "full_name",
			},
		}
		resp, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, prefs)
		require.Error(t, err) // Should fail
		CheckForbiddenStatus(t, resp)

		// Verify override is still in effect
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "name_format")
		require.NoError(t, err)
		assert.Equal(t, "username", pref.Value)

		// Clean up
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.MattermostExtendedSettings.Preferences.Overrides, "display_settings:name_format")
		})
	})

	t.Run("User cannot delete overridden preference", func(t *testing.T) {
		// Set admin override
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["display_settings:render_emoticons"] = "true"
		})

		// User tries to delete the preference
		pref := model.Preference{
			UserId:   th.BasicUser.Id,
			Category: "display_settings",
			Name:     "render_emoticons",
		}
		resp, err := th.Client.DeletePreferences(context.Background(), th.BasicUser.Id, model.Preferences{pref})
		require.Error(t, err) // Should fail
		CheckForbiddenStatus(t, resp)

		// Verify override is still in effect
		fetchedPref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "render_emoticons")
		require.NoError(t, err)
		assert.Equal(t, "true", fetchedPref.Value)

		// Clean up
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.MattermostExtendedSettings.Preferences.Overrides, "display_settings:render_emoticons")
		})
	})

	t.Run("Override persists across sessions", func(t *testing.T) {
		// Set admin override
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["notifications:desktop"] = "none"
		})

		// Check override value
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "notifications", "desktop")
		require.NoError(t, err)
		assert.Equal(t, "none", pref.Value)

		// Login as different user session (simulate new session)
		th.LoginBasic2(t)

		// Set override for user2 as well
		pref2, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser2.Id, "notifications", "desktop")
		require.NoError(t, err)
		assert.Equal(t, "none", pref2.Value) // Same override applies to all users

		// Clean up
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.MattermostExtendedSettings.Preferences.Overrides, "notifications:desktop")
		})
	})

	t.Run("Override applies to all users", func(t *testing.T) {
		// Set admin override
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["display_settings:collapse_previews"] = "true"
		})

		// Check override for user1
		th.LoginBasic(t)
		pref1, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "collapse_previews")
		require.NoError(t, err)
		assert.Equal(t, "true", pref1.Value)

		// Check override for user2
		th.LoginBasic2(t)
		pref2, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser2.Id, "display_settings", "collapse_previews")
		require.NoError(t, err)
		assert.Equal(t, "true", pref2.Value)

		// Clean up
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.MattermostExtendedSettings.Preferences.Overrides, "display_settings:collapse_previews")
		})
	})
}

// TestPreferenceOverrideInGetAll tests that overrides are included in GetAll
func TestPreferenceOverrideInGetAll(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Override is injected in GetAll even if no preference exists", func(t *testing.T) {
		// Set admin override for a preference the user has never set
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["test_category:test_pref"] = "enforced_value"
		})

		// Get all preferences
		prefs, _, err := th.Client.GetPreferences(context.Background(), th.BasicUser.Id)
		require.NoError(t, err)

		// Find the injected preference
		found := false
		for _, pref := range prefs {
			if pref.Category == "test_category" && pref.Name == "test_pref" {
				assert.Equal(t, "enforced_value", pref.Value)
				found = true
				break
			}
		}
		assert.True(t, found, "Override should be injected into GetAll results")

		// Clean up
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.MattermostExtendedSettings.Preferences.Overrides, "test_category:test_pref")
		})
	})
}
