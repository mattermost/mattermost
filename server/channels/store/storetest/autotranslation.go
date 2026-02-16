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
	t.Run("IsUserEnabled", func(t *testing.T) { testAutoTranslationIsUserEnabled(t, rctx, ss) })
	t.Run("GetUserLanguage", func(t *testing.T) { testAutoTranslationGetUserLanguage(t, rctx, ss) })
	t.Run("GetActiveDestinationLanguages", func(t *testing.T) { testAutoTranslationGetActiveDestinationLanguages(t, rctx, ss) })
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
		enabled, err := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.NoError(t, err)
		assert.False(t, enabled)
	})

	t.Run("returns false when channel enabled but user disabled", func(t *testing.T) {
		// Enable channel autotranslation
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Disable user autotranslation (AutoTranslationDisabled = true means disabled)
		member.AutoTranslationDisabled = true
		_, nErr = ss.Channel().UpdateMember(rctx, member)
		require.NoError(t, nErr)

		enabled, getUserEnabledErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.NoError(t, getUserEnabledErr)
		assert.False(t, enabled)
	})

	t.Run("returns true when both channel and user enabled", func(t *testing.T) {
		// Enable channel autotranslation
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Enable user autotranslation
		member.AutoTranslationDisabled = false
		_, nErr = ss.Channel().UpdateMember(rctx, member)
		require.NoError(t, nErr)

		// Verify both are enabled
		enabled, getUserEnabledErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.NoError(t, getUserEnabledErr)
		assert.True(t, enabled)
	})

	t.Run("returns false after disabling user", func(t *testing.T) {
		// Ensure channel is enabled
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Disable user autotranslation
		member.AutoTranslationDisabled = true
		_, nErr = ss.Channel().UpdateMember(rctx, member)
		require.NoError(t, nErr)

		// Verify user is disabled
		enabled, nErr := ss.AutoTranslation().IsUserEnabled(user.Id, channel.Id)
		require.NoError(t, nErr)
		assert.False(t, enabled)
	})

	t.Run("returns false for non-existent user or channel", func(t *testing.T) {
		enabled, nErr := ss.AutoTranslation().IsUserEnabled("nonexistent", channel.Id)
		require.NoError(t, nErr)
		assert.False(t, enabled)
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

	members := make(map[string]*model.ChannelMember)
	// Add users to channel
	for _, user := range []*model.User{userEN, userES} {
		member := &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}
		_, nErr = ss.Channel().SaveMember(rctx, member)
		require.NoError(t, nErr)
		members[user.Id] = member
	}

	t.Run("returns empty when channel disabled", func(t *testing.T) {
		locale, appErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.NoError(t, appErr)
		assert.Empty(t, locale)
	})

	t.Run("returns empty when channel enabled but user disabled", func(t *testing.T) {
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Disable user autotranslation (AutoTranslationDisabled = true means disabled)
		members[userEN.Id].AutoTranslationDisabled = true
		_, nErr = ss.Channel().UpdateMember(rctx, members[userEN.Id])
		require.NoError(t, nErr)

		locale, getLocaleErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.NoError(t, getLocaleErr)
		assert.Empty(t, locale)
	})

	t.Run("returns user locale when both enabled", func(t *testing.T) {
		// Enable channel
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Enable user (set AutoTranslationDisabled = false)
		members[userEN.Id].AutoTranslationDisabled = false
		_, nErr = ss.Channel().UpdateMember(rctx, members[userEN.Id])
		require.NoError(t, nErr)

		// Get language
		locale, getLocaleErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.NoError(t, getLocaleErr)
		assert.Equal(t, "en", locale)
	})

	t.Run("returns correct locale for different users", func(t *testing.T) {
		// Enable channel
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Enable both users (set AutoTranslationDisabled = false)
		members[userEN.Id].AutoTranslationDisabled = false
		_, nErr = ss.Channel().UpdateMember(rctx, members[userEN.Id])
		require.NoError(t, nErr)
		members[userES.Id].AutoTranslationDisabled = false
		_, nErr = ss.Channel().UpdateMember(rctx, members[userES.Id])
		require.NoError(t, nErr)

		// Verify English user
		locale, nErr := ss.AutoTranslation().GetUserLanguage(userEN.Id, channel.Id)
		require.NoError(t, nErr)
		assert.Equal(t, "en", locale)

		// Verify Spanish user
		locale, nErr = ss.AutoTranslation().GetUserLanguage(userES.Id, channel.Id)
		require.NoError(t, nErr)
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
		if i >= 4 { // Disable autotranslation for 5th user only
			member.AutoTranslationDisabled = true
		}
		_, nErr = ss.Channel().SaveMember(rctx, member)
		require.NoError(t, nErr)
	}

	t.Run("returns empty when channel disabled", func(t *testing.T) {
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, "", nil)
		require.NoError(t, appErr)
		assert.Empty(t, languages)
	})

	t.Run("returns all enabled user languages", func(t *testing.T) {
		// Enable channel
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, "", nil)
		require.NoError(t, appErr)

		// Should return en, es, fr, de (4 unique languages, 5th user is disabled)
		assert.Len(t, languages, 4)
		assert.Contains(t, languages, "en")
		assert.Contains(t, languages, "es")
		assert.Contains(t, languages, "fr")
		assert.Contains(t, languages, "de")
	})

	t.Run("excludes specified user", func(t *testing.T) {
		// Enable channel
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Exclude Spanish user
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, users[1].Id, nil)
		require.NoError(t, appErr)

		// Should return en, fr, de (excluded es)
		assert.Len(t, languages, 3)
		assert.Contains(t, languages, "en")
		assert.NotContains(t, languages, "es")
		assert.Contains(t, languages, "fr")
		assert.Contains(t, languages, "de")
	})

	t.Run("filters to specific users", func(t *testing.T) {
		// Enable channel
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Filter to only first two users (en, es)
		filterIDs := []string{users[0].Id, users[1].Id}
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, "", filterIDs)
		require.NoError(t, appErr)

		// Should return only en, es
		assert.Len(t, languages, 2)
		assert.Contains(t, languages, "en")
		assert.Contains(t, languages, "es")
	})

	t.Run("filters and excludes user", func(t *testing.T) {
		// Enable channel
		channel.AutoTranslation = true
		channel, nErr = ss.Channel().Update(rctx, channel)
		require.NoError(t, nErr)

		// Filter to first two users but exclude the first one
		filterIDs := []string{users[0].Id, users[1].Id}
		languages, appErr := ss.AutoTranslation().GetActiveDestinationLanguages(channel.Id, users[0].Id, filterIDs)
		require.NoError(t, appErr)

		// Should return only es
		assert.Len(t, languages, 1)
		assert.Contains(t, languages, "es")
	})
}
