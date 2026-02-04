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

	t.Run("User cannot change overridden preference when its the only one", func(t *testing.T) {
		// Set admin override
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			if cfg.MattermostExtendedSettings.Preferences.Overrides == nil {
				cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
			}
			cfg.MattermostExtendedSettings.Preferences.Overrides["display_settings:name_format"] = "username"
		})

		// User tries to change ONLY the enforced preference (should fail since nothing else to save)
		prefs := model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "display_settings",
				Name:     "name_format",
				Value:    "full_name",
			},
		}
		resp, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, prefs)
		require.Error(t, err) // Should fail - all preferences in batch are enforced
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

// TestPreferenceOverrideBatchUpdate tests that batch updates filter out enforced preferences
// and save the rest (fix for the "Teammate Time Display" save error)
func TestPreferenceOverrideBatchUpdate(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Helper to set up overrides
	setupOverrides := func(overrides map[string]string) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PreferencesRevamp = true
			cfg.FeatureFlags.PreferenceOverridesDashboard = true
			cfg.MattermostExtendedSettings.Preferences.Overrides = overrides
		})
	}

	// Helper to clear overrides
	clearOverrides := func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.MattermostExtendedSettings.Preferences.Overrides = make(map[string]string)
		})
	}

	t.Run("Batch with one enforced preference saves the rest", func(t *testing.T) {
		clearOverrides()

		// Set initial values for preferences
		initialPrefs := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapse_previews", Value: "false"},
		}
		_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, initialPrefs)
		require.NoError(t, err)

		// Set admin override for ONE preference (use_military_time)
		setupOverrides(map[string]string{
			"display_settings:use_military_time": "true",
		})

		// User tries to update ALL three preferences (simulating settings panel save)
		batchUpdate := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},    // ENFORCED - should be filtered
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "true"},    // Should save
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapse_previews", Value: "true"},     // Should save
		}
		_, err = th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, batchUpdate)
		require.NoError(t, err, "Batch update should succeed even with one enforced preference")

		// Verify the non-enforced preferences were saved
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "colorize_usernames")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value, "colorize_usernames should be updated")

		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "collapse_previews")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value, "collapse_previews should be updated")

		// Verify the enforced preference still returns the override value
		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "use_military_time")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value, "use_military_time should return enforced value")

		clearOverrides()
	})

	t.Run("Batch with multiple enforced preferences saves only non-enforced", func(t *testing.T) {
		clearOverrides()

		// Set initial values
		initialPrefs := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapse_previews", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "name_format", Value: "username"},
		}
		_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, initialPrefs)
		require.NoError(t, err)

		// Set admin overrides for TWO preferences
		setupOverrides(map[string]string{
			"display_settings:use_military_time":  "true",
			"display_settings:colorize_usernames": "false",
		})

		// User tries to update ALL four preferences
		batchUpdate := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},    // ENFORCED
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "true"},    // ENFORCED
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapse_previews", Value: "true"},     // Should save
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "name_format", Value: "full_name"},      // Should save
		}
		_, err = th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, batchUpdate)
		require.NoError(t, err, "Batch update should succeed with multiple enforced preferences")

		// Verify non-enforced preferences were saved
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "collapse_previews")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)

		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "name_format")
		require.NoError(t, err)
		assert.Equal(t, "full_name", pref.Value)

		// Verify enforced preferences return override values
		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "use_military_time")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)

		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "colorize_usernames")
		require.NoError(t, err)
		assert.Equal(t, "false", pref.Value)

		clearOverrides()
	})

	t.Run("Batch where ALL preferences are enforced fails with 403", func(t *testing.T) {
		clearOverrides()

		// Set admin overrides for ALL preferences in the batch
		setupOverrides(map[string]string{
			"display_settings:use_military_time":  "true",
			"display_settings:colorize_usernames": "false",
		})

		// User tries to update only enforced preferences - should fail since nothing left to save
		batchUpdate := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "true"},
		}
		resp, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, batchUpdate)
		require.Error(t, err, "Batch with all enforced preferences should fail")
		CheckForbiddenStatus(t, resp)

		// Verify enforced values are still returned
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "use_military_time")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)

		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "colorize_usernames")
		require.NoError(t, err)
		assert.Equal(t, "false", pref.Value)

		clearOverrides()
	})

	t.Run("Enforced preference database value is not modified", func(t *testing.T) {
		clearOverrides()

		// Set initial database value
		initialPrefs := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},
		}
		_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, initialPrefs)
		require.NoError(t, err)

		// Set admin override
		setupOverrides(map[string]string{
			"display_settings:use_military_time": "true",
		})

		// Try to update the enforced preference along with another
		batchUpdate := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "true"},     // ENFORCED - user trying to set same as override
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapse_previews", Value: "true"},
		}
		_, err = th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, batchUpdate)
		require.NoError(t, err)

		// Remove the override to check what's actually in the database
		clearOverrides()

		// The database should still have the original value "false", not "true"
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "use_military_time")
		require.NoError(t, err)
		assert.Equal(t, "false", pref.Value, "Database value should not be modified by filtered preference")
	})

	t.Run("Real-world display settings batch scenario", func(t *testing.T) {
		clearOverrides()

		// This simulates the exact payload from the "Teammate Time Display" settings panel
		// Set admin override for use_military_time only
		setupOverrides(map[string]string{
			"display_settings:use_military_time": "true",
		})

		// Simulate the full payload that the client sends when saving display settings
		fullPayload := model.Preferences{
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "use_military_time", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "channel_display_mode", Value: "full"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "message_display", Value: "clean"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "on"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "click_to_reply", Value: "true"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "collapse_previews", Value: "false"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "link_previews", Value: "true"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "always_show_remote_user_hour", Value: "true"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "name_format", Value: "nickname_full_name"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "availability_status_on_posts", Value: "true"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "one_click_reactions_enabled", Value: "true"},
			{UserId: th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "true"},
		}

		_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, fullPayload)
		require.NoError(t, err, "Full display settings batch should succeed")

		// Verify a few non-enforced preferences were saved
		pref, _, err := th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "channel_display_mode")
		require.NoError(t, err)
		assert.Equal(t, "full", pref.Value)

		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "colorize_usernames")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)

		// Verify the enforced preference returns override
		pref, _, err = th.Client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser.Id, "display_settings", "use_military_time")
		require.NoError(t, err)
		assert.Equal(t, "true", pref.Value)

		clearOverrides()
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
