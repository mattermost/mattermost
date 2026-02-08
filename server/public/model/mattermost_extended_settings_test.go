// mattermost-extended-test
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMattermostExtendedSettingsSetDefaults(t *testing.T) {
	t.Run("should set all defaults on empty struct", func(t *testing.T) {
		settings := MattermostExtendedSettings{}
		settings.SetDefaults()

		// Posts defaults
		require.NotNil(t, settings.Posts.HideDeletedMessagePlaceholder)
		assert.False(t, *settings.Posts.HideDeletedMessagePlaceholder)

		// Channels defaults
		require.NotNil(t, settings.Channels.SidebarChannelSettings)
		assert.False(t, *settings.Channels.SidebarChannelSettings)

		// Media defaults
		require.NotNil(t, settings.Media.MaxImageHeight)
		assert.Equal(t, 400, *settings.Media.MaxImageHeight)
		require.NotNil(t, settings.Media.MaxImageWidth)
		assert.Equal(t, 500, *settings.Media.MaxImageWidth)
		require.NotNil(t, settings.Media.CaptionFontSize)
		assert.Equal(t, 12, *settings.Media.CaptionFontSize)
		require.NotNil(t, settings.Media.MaxVideoHeight)
		assert.Equal(t, 350, *settings.Media.MaxVideoHeight)
		require.NotNil(t, settings.Media.MaxVideoWidth)
		assert.Equal(t, 480, *settings.Media.MaxVideoWidth)
		require.NotNil(t, settings.Media.MatchRemoteUserHourIconSize)
		assert.True(t, *settings.Media.MatchRemoteUserHourIconSize)

		// Statuses defaults
		require.NotNil(t, settings.Statuses.InactivityTimeoutMinutes)
		assert.Equal(t, 5, *settings.Statuses.InactivityTimeoutMinutes)
		require.NotNil(t, settings.Statuses.HeartbeatIntervalSeconds)
		assert.Equal(t, 30, *settings.Statuses.HeartbeatIntervalSeconds)
		require.NotNil(t, settings.Statuses.EnableStatusLogs)
		assert.False(t, *settings.Statuses.EnableStatusLogs)
		require.NotNil(t, settings.Statuses.MaxStatusLogs)
		assert.Equal(t, 500, *settings.Statuses.MaxStatusLogs)
		require.NotNil(t, settings.Statuses.DNDInactivityTimeoutMinutes)
		assert.Equal(t, 30, *settings.Statuses.DNDInactivityTimeoutMinutes)
		require.NotNil(t, settings.Statuses.StatusLogRetentionDays)
		assert.Equal(t, 7, *settings.Statuses.StatusLogRetentionDays)

		// Preferences defaults
		require.NotNil(t, settings.Preferences.Overrides)
		assert.Empty(t, settings.Preferences.Overrides)
	})

	t.Run("should not override existing values", func(t *testing.T) {
		settings := MattermostExtendedSettings{
			Posts: MattermostExtendedPostsSettings{
				HideDeletedMessagePlaceholder: NewPointer(true),
			},
			Channels: MattermostExtendedChannelsSettings{
				SidebarChannelSettings: NewPointer(true),
			},
			Media: MattermostExtendedMediaSettings{
				MaxImageHeight: NewPointer(800),
				MaxImageWidth:  NewPointer(1000),
			},
			Statuses: MattermostExtendedStatusesSettings{
				InactivityTimeoutMinutes:    NewPointer(10),
				HeartbeatIntervalSeconds:    NewPointer(60),
				DNDInactivityTimeoutMinutes: NewPointer(0), // Disabled
			},
			Preferences: MattermostExtendedPreferencesSettings{
				Overrides: map[string]string{"test:key": "value"},
			},
		}
		settings.SetDefaults()

		// Posts - should keep existing value
		assert.True(t, *settings.Posts.HideDeletedMessagePlaceholder)

		// Channels - should keep existing value
		assert.True(t, *settings.Channels.SidebarChannelSettings)

		// Media - should keep existing values
		assert.Equal(t, 800, *settings.Media.MaxImageHeight)
		assert.Equal(t, 1000, *settings.Media.MaxImageWidth)
		// Other media values should get defaults
		assert.Equal(t, 12, *settings.Media.CaptionFontSize)

		// Statuses - should keep existing values
		assert.Equal(t, 10, *settings.Statuses.InactivityTimeoutMinutes)
		assert.Equal(t, 60, *settings.Statuses.HeartbeatIntervalSeconds)
		assert.Equal(t, 0, *settings.Statuses.DNDInactivityTimeoutMinutes) // Keep disabled

		// Preferences - should keep existing values
		assert.Equal(t, "value", settings.Preferences.Overrides["test:key"])
	})
}

func TestMattermostExtendedPostsSettingsSetDefaults(t *testing.T) {
	t.Run("should set default for HideDeletedMessagePlaceholder", func(t *testing.T) {
		settings := MattermostExtendedPostsSettings{}
		settings.SetDefaults()

		require.NotNil(t, settings.HideDeletedMessagePlaceholder)
		assert.False(t, *settings.HideDeletedMessagePlaceholder)
	})
}

func TestMattermostExtendedChannelsSettingsSetDefaults(t *testing.T) {
	t.Run("should set default for SidebarChannelSettings", func(t *testing.T) {
		settings := MattermostExtendedChannelsSettings{}
		settings.SetDefaults()

		require.NotNil(t, settings.SidebarChannelSettings)
		assert.False(t, *settings.SidebarChannelSettings)
	})
}

func TestMattermostExtendedMediaSettingsSetDefaults(t *testing.T) {
	t.Run("should set all media defaults", func(t *testing.T) {
		settings := MattermostExtendedMediaSettings{}
		settings.SetDefaults()

		require.NotNil(t, settings.MaxImageHeight)
		assert.Equal(t, 400, *settings.MaxImageHeight)

		require.NotNil(t, settings.MaxImageWidth)
		assert.Equal(t, 500, *settings.MaxImageWidth)

		require.NotNil(t, settings.CaptionFontSize)
		assert.Equal(t, 12, *settings.CaptionFontSize)

		require.NotNil(t, settings.MaxVideoHeight)
		assert.Equal(t, 350, *settings.MaxVideoHeight)

		require.NotNil(t, settings.MaxVideoWidth)
		assert.Equal(t, 480, *settings.MaxVideoWidth)

		require.NotNil(t, settings.MatchRemoteUserHourIconSize)
		assert.True(t, *settings.MatchRemoteUserHourIconSize)
	})
}

func TestMattermostExtendedStatusesSettingsSetDefaults(t *testing.T) {
	t.Run("should set all status defaults", func(t *testing.T) {
		settings := MattermostExtendedStatusesSettings{}
		settings.SetDefaults()

		require.NotNil(t, settings.InactivityTimeoutMinutes)
		assert.Equal(t, 5, *settings.InactivityTimeoutMinutes)

		require.NotNil(t, settings.HeartbeatIntervalSeconds)
		assert.Equal(t, 30, *settings.HeartbeatIntervalSeconds)

		require.NotNil(t, settings.EnableStatusLogs)
		assert.False(t, *settings.EnableStatusLogs)

		require.NotNil(t, settings.MaxStatusLogs)
		assert.Equal(t, 500, *settings.MaxStatusLogs)

		require.NotNil(t, settings.DNDInactivityTimeoutMinutes)
		assert.Equal(t, 30, *settings.DNDInactivityTimeoutMinutes)

		require.NotNil(t, settings.StatusLogRetentionDays)
		assert.Equal(t, 7, *settings.StatusLogRetentionDays)
	})
}

func TestMattermostExtendedPreferencesSettingsSetDefaults(t *testing.T) {
	t.Run("should initialize empty Overrides map", func(t *testing.T) {
		settings := MattermostExtendedPreferencesSettings{}
		settings.SetDefaults()

		require.NotNil(t, settings.Overrides)
		assert.Empty(t, settings.Overrides)
	})

	t.Run("should not overwrite existing Overrides", func(t *testing.T) {
		settings := MattermostExtendedPreferencesSettings{
			Overrides: map[string]string{
				"category:name": "value",
			},
		}
		settings.SetDefaults()

		require.NotNil(t, settings.Overrides)
		assert.Equal(t, "value", settings.Overrides["category:name"])
	})
}
