// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestAutoTranslationStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("IsChannelEnabled", func(t *testing.T) { testAutoTranslationIsChannelEnabled(t, rctx, ss) })
	t.Run("SetChannelEnabled", func(t *testing.T) { testAutoTranslationSetChannelEnabled(t, rctx, ss) })
	t.Run("IsUserEnabled", func(t *testing.T) { testAutoTranslationIsUserEnabled(t, rctx, ss) })
	t.Run("SetUserEnabled", func(t *testing.T) { testAutoTranslationSetUserEnabled(t, rctx, ss) })
	t.Run("GetUserLanguage", func(t *testing.T) { testAutoTranslationGetUserLanguage(t, rctx, ss) })
	t.Run("GetActiveDestinationLanguages", func(t *testing.T) { testAutoTranslationGetActiveDestinationLanguages(t, rctx, ss) })
}

func testAutoTranslationIsChannelEnabled(t *testing.T, rctx request.CTX, ss store.Store) {
	// Setup: Create a test team and channel
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 999)
	require.NoError(t, nErr)

	defer func() {
		_ = ss.Team().PermanentDelete(team.Id)
		_ = ss.Channel().PermanentDelete(rctx, channel.Id)
	}()

	t.Run("default value is false", func(t *testing.T) {
		enabled, appErr := ss.AutoTranslation().IsChannelEnabled(channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled, "autotranslation should be disabled by default")
	})

	t.Run("returns true after enabling", func(t *testing.T) {
		// Enable autotranslation
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Verify it's enabled
		enabled, appErr := ss.AutoTranslation().IsChannelEnabled(channel.Id)
		require.Nil(t, appErr)
		assert.True(t, enabled)
	})

	t.Run("returns false after disabling", func(t *testing.T) {
		// Disable autotranslation
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, false)
		require.Nil(t, appErr)

		// Verify it's disabled
		enabled, appErr := ss.AutoTranslation().IsChannelEnabled(channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled)
	})

	t.Run("returns error for non-existent channel", func(t *testing.T) {
		enabled, err := ss.AutoTranslation().IsChannelEnabled("nonexistent")
		assert.Error(t, err)
		assert.True(t, store.IsErrNotFound(err))
		assert.False(t, enabled)
	})
}

func testAutoTranslationSetChannelEnabled(t *testing.T, rctx request.CTX, ss store.Store) {
	// Setup: Create a test team and channel
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 999)
	require.NoError(t, nErr)

	defer func() {
		_ = ss.Team().PermanentDelete(team.Id)
		_ = ss.Channel().PermanentDelete(rctx, channel.Id)
	}()

	t.Run("successfully enables autotranslation", func(t *testing.T) {
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Verify via IsChannelEnabled
		enabled, appErr := ss.AutoTranslation().IsChannelEnabled(channel.Id)
		require.Nil(t, appErr)
		assert.True(t, enabled)
	})

	t.Run("successfully disables autotranslation", func(t *testing.T) {
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, false)
		require.Nil(t, appErr)

		// Verify via IsChannelEnabled
		enabled, appErr := ss.AutoTranslation().IsChannelEnabled(channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled)
	})

	t.Run("updates channel timestamp", func(t *testing.T) {
		// Get original update timestamp
		originalChannel, nErr := ss.Channel().Get(channel.Id, true)
		require.NoError(t, nErr)
		originalUpdateAt := originalChannel.UpdateAt

		// Enable autotranslation
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Verify timestamp was updated
		updatedChannel, nErr := ss.Channel().Get(channel.Id, true)
		require.NoError(t, nErr)
		assert.Greater(t, updatedChannel.UpdateAt, originalUpdateAt)
	})

	t.Run("returns error for non-existent channel", func(t *testing.T) {
		err := ss.AutoTranslation().SetChannelEnabled("nonexistent", true)
		assert.Error(t, err)
		assert.True(t, store.IsErrNotFound(err))
	})
}

func testAutoTranslationIsUserEnabled(t *testing.T, rctx request.CTX, ss store.Store) {
	// Setup: Create team, channel, and user
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 999)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    "test@example.com",
		Username: "testuser" + model.NewId(),
		Locale:   "en",
	}
	user, nErr = ss.User().Save(rctx, user)
	require.NoError(t, nErr)

	defer func() {
		_ = ss.Team().PermanentDelete(team.Id)
		_ = ss.Channel().PermanentDelete(rctx, channel.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	// Add user to channel
	member := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, nErr = ss.Channel().SaveMember(rctx, member)
	require.NoError(t, nErr)

	t.Run("returns false when channel is disabled", func(t *testing.T) {
		// Channel autotranslation is disabled by default
		enabled, appErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled)
	})

	t.Run("returns false when channel enabled but user disabled", func(t *testing.T) {
		// Enable channel autotranslation
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// User autotranslation is disabled by default
		enabled, appErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled)
	})

	t.Run("returns true when both channel and user enabled", func(t *testing.T) {
		// Enable channel autotranslation
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Enable user autotranslation
		appErr = ss.AutoTranslation().SetUserEnabled(user.Id, channel.Id, true)
		require.Nil(t, appErr)

		// Verify both are enabled
		enabled, appErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.Nil(t, appErr)
		assert.True(t, enabled)
	})

	t.Run("returns false after disabling user", func(t *testing.T) {
		// Ensure channel is enabled
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Disable user autotranslation
		appErr = ss.AutoTranslation().SetUserEnabled(user.Id, channel.Id, false)
		require.Nil(t, appErr)

		// Verify user is disabled
		enabled, appErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled)
	})

	t.Run("returns false for non-existent user or channel", func(t *testing.T) {
		enabled, appErr := ss.AutoTranslation().IsUserEnabled("nonexistent", channel.Id)
		require.Nil(t, appErr)
		assert.False(t, enabled)
	})
}

func testAutoTranslationSetUserEnabled(t *testing.T, rctx request.CTX, ss store.Store) {
	// Setup: Create team, channel, and user
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 999)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    "test@example.com",
		Username: "testuser" + model.NewId(),
		Locale:   "en",
	}
	user, nErr = ss.User().Save(rctx, user)
	require.NoError(t, nErr)

	defer func() {
		_ = ss.Team().PermanentDelete(team.Id)
		_ = ss.Channel().PermanentDelete(rctx, channel.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	// Add user to channel
	member := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, nErr = ss.Channel().SaveMember(rctx, member)
	require.NoError(t, nErr)

	t.Run("successfully enables user autotranslation", func(t *testing.T) {
		appErr := ss.AutoTranslation().SetUserEnabled(user.Id, channel.Id, true)
		require.Nil(t, appErr)
	})

	t.Run("successfully disables user autotranslation", func(t *testing.T) {
		appErr := ss.AutoTranslation().SetUserEnabled(user.Id, channel.Id, false)
		require.Nil(t, appErr)
	})

	t.Run("returns error for non-existent user or channel", func(t *testing.T) {
		err := ss.AutoTranslation().SetUserEnabled("nonexistent", channel.Id, true)
		assert.Error(t, err)
		assert.True(t, store.IsErrNotFound(err))
	})
}

func testAutoTranslationGetUserLanguage(t *testing.T, rctx request.CTX, ss store.Store) {
	// Setup: Create team, channel, and users with different locales
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 999)
	require.NoError(t, nErr)

	userEN := &model.User{
		Email:    "test-en@example.com",
		Username: "testuser-en-" + model.NewId(),
		Locale:   "en",
	}
	userEN, nErr = ss.User().Save(rctx, userEN)
	require.NoError(t, nErr)

	userES := &model.User{
		Email:    "test-es@example.com",
		Username: "testuser-es-" + model.NewId(),
		Locale:   "es",
	}
	userES, nErr = ss.User().Save(rctx, userES)
	require.NoError(t, nErr)

	defer func() {
		_ = ss.Team().PermanentDelete(team.Id)
		_ = ss.Channel().PermanentDelete(rctx, channel.Id)
		_ = ss.User().PermanentDelete(rctx, userEN.Id)
		_ = ss.User().PermanentDelete(rctx, userES.Id)
	}()

	// Add users to channel
	for _, user := range []*model.User{userEN, userES} {
		member := &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}
		_, nErr = ss.Channel().SaveMember(rctx, member)
		require.NoError(t, nErr)
	}

	t.Run("returns empty when channel disabled", func(t *testing.T) {
		locale, appErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.Nil(t, appErr)
		assert.Empty(t, locale)
	})

	t.Run("returns empty when channel enabled but user disabled", func(t *testing.T) {
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		locale, appErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.Nil(t, appErr)
		assert.Empty(t, locale)
	})

	t.Run("returns user locale when both enabled", func(t *testing.T) {
		// Enable channel
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Enable user
		appErr = ss.AutoTranslation().SetUserEnabled(userEN.Id, channel.Id, true)
		require.Nil(t, appErr)

		// Get language
		locale, appErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, "en", locale)
	})

	t.Run("returns correct locale for different users", func(t *testing.T) {
		// Enable channel
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Enable both users
		appErr = ss.AutoTranslation().SetUserEnabled(userEN.Id, channel.Id, true)
		require.Nil(t, appErr)
		appErr = ss.AutoTranslation().SetUserEnabled(userES.Id, channel.Id, true)
		require.Nil(t, appErr)

		// Verify English user
		locale, appErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, "en", locale)

		// Verify Spanish user
		locale, appErr = ss.AutoTranslation().GetUserLanguage(userES.Id, channel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, "es", locale)
	})
}

func testAutoTranslationGetActiveDestinationLanguages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Setup: Create team, channel, and users with different locales
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 999)
	require.NoError(t, nErr)

	defer func() {
		_ = ss.Team().PermanentDelete(team.Id)
		_ = ss.Channel().PermanentDelete(rctx, channel.Id)
	}()

	// Create users with different locales
	users := make([]*model.User, 0)
	locales := []string{"en", "es", "fr", "de", "en"} // Note: duplicate "en"

	for i, locale := range locales {
		user := &model.User{
			Email:    model.NewId() + "@example.com",
			Username: "testuser-" + model.NewId(),
			Locale:   locale,
		}
		user, nErr = ss.User().Save(rctx, user)
		require.NoError(t, nErr)
		defer func() {
			_ = ss.User().PermanentDelete(rctx, user.Id)
		}()
		users = append(users, user)

		// Add user to channel
		member := &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}
		_, nErr = ss.Channel().SaveMember(rctx, member)
		require.NoError(t, nErr)

		// Enable autotranslation for first 4 users only
		if i < 4 {
			appErr := ss.AutoTranslation().SetUserEnabled(user.Id, channel.Id, true)
			require.Nil(t, appErr)
		}
	}

	t.Run("returns empty when channel disabled", func(t *testing.T) {
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, "", nil)
		require.Nil(t, appErr)
		assert.Empty(t, languages)
	})

	t.Run("returns all enabled user languages", func(t *testing.T) {
		// Enable channel
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, "", nil)
		require.Nil(t, appErr)

		// Should return en, es, fr, de (4 unique languages, 5th user is disabled)
		assert.Len(t, languages, 4)
		assert.Contains(t, languages, "en")
		assert.Contains(t, languages, "es")
		assert.Contains(t, languages, "fr")
		assert.Contains(t, languages, "de")
	})

	t.Run("excludes specified user", func(t *testing.T) {
		// Enable channel
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Exclude Spanish user
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, users[1].Id, nil)
		require.Nil(t, appErr)

		// Should return en, fr, de (excluded es)
		assert.Len(t, languages, 3)
		assert.Contains(t, languages, "en")
		assert.NotContains(t, languages, "es")
		assert.Contains(t, languages, "fr")
		assert.Contains(t, languages, "de")
	})

	t.Run("filters to specific users", func(t *testing.T) {
		// Enable channel
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Filter to only first two users (en, es)
		filterIDs := []string{users[0].Id, users[1].Id}
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, "", filterIDs)
		require.Nil(t, appErr)

		// Should return only en, es
		assert.Len(t, languages, 2)
		assert.Contains(t, languages, "en")
		assert.Contains(t, languages, "es")
	})

	t.Run("filters and excludes user", func(t *testing.T) {
		// Enable channel
		appErr := ss.AutoTranslation().SetChannelEnabled(channel.Id, true)
		require.Nil(t, appErr)

		// Filter to first two users but exclude the first one
		filterIDs := []string{users[0].Id, users[1].Id}
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, users[0].Id, filterIDs)
		require.Nil(t, appErr)

		// Should return only es
		assert.Len(t, languages, 1)
		assert.Contains(t, languages, "es")
	})
}
