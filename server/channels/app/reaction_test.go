// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestSaveReactionForPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()

	post := th.CreatePost(th.BasicChannel)
	reaction1, err := th.App.SaveReactionForPost(th.Context, &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    post.Id,
		EmojiName: "cry",
	})
	require.NotNil(t, reaction1)
	require.Nil(t, err)
	reaction2, err := th.App.SaveReactionForPost(th.Context, &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    post.Id,
		EmojiName: "smile",
	})
	require.NotNil(t, reaction2)
	require.Nil(t, err)
	reaction3, err := th.App.SaveReactionForPost(th.Context, &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    post.Id,
		EmojiName: "rofl",
	})
	require.NotNil(t, reaction3)
	require.Nil(t, err)

	t.Run("should not add reaction if it does not exist on the system", func(t *testing.T) {
		reaction := &model.Reaction{
			UserId:    th.BasicUser.Id,
			PostId:    th.BasicPost.Id,
			EmojiName: "definitely-not-a-real-emoji",
		}

		result, err := th.App.SaveReactionForPost(th.Context, reaction)
		require.NotNil(t, err)
		require.Nil(t, result)
	})

	t.Run("should not add reaction if we are over the limit", func(t *testing.T) {
		var originalLimit *int
		th.UpdateConfig(func(cfg *model.Config) {
			originalLimit = cfg.ServiceSettings.UniqueEmojiReactionLimitPerPost
			*cfg.ServiceSettings.UniqueEmojiReactionLimitPerPost = 3
		})
		defer th.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.UniqueEmojiReactionLimitPerPost = originalLimit
		})

		reaction := &model.Reaction{
			UserId:    th.BasicUser.Id,
			PostId:    post.Id,
			EmojiName: "joy",
		}

		result, err := th.App.SaveReactionForPost(th.Context, reaction)
		require.NotNil(t, err)
		require.Nil(t, result)
	})

	t.Run("should always add reaction if we are over the limit but the reaction is not unique", func(t *testing.T) {
		user := th.CreateUser()

		var originalLimit *int
		th.UpdateConfig(func(cfg *model.Config) {
			originalLimit = cfg.ServiceSettings.UniqueEmojiReactionLimitPerPost
			*cfg.ServiceSettings.UniqueEmojiReactionLimitPerPost = 3
		})
		defer th.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.UniqueEmojiReactionLimitPerPost = originalLimit
		})

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "cry",
		}

		result, err := th.App.SaveReactionForPost(th.Context, reaction)
		require.Nil(t, err)
		require.NotNil(t, result)
	})

	t.Run("cannot save reaction in restricted DM", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageTeam
		})

		// Create a DM channel between two users who don't share a team
		dmChannel := th.CreateDmChannel(th.BasicUser2)

		// Ensure the two users do not share a team
		teams, err := th.App.GetTeamsForUser(th.BasicUser.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}
		teams, err = th.App.GetTeamsForUser(th.BasicUser2.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser2.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}

		// Create separate teams for each user
		team1 := th.CreateTeam()
		team2 := th.CreateTeam()
		th.LinkUserToTeam(th.BasicUser, team1)
		th.LinkUserToTeam(th.BasicUser2, team2)

		// Create a post in the DM channel
		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: dmChannel.Id,
			Message:   "test post",
		}
		post, err = th.App.CreatePost(th.Context, post, dmChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		reaction := &model.Reaction{
			UserId:    th.BasicUser.Id,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		_, appErr := th.App.SaveReactionForPost(th.Context, reaction)
		require.NotNil(t, appErr)
		require.Equal(t, "api.reaction.save.restricted_dm.error", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		// Reset config
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageAny
		})
	})
}

func TestDeleteReactionForPostWithRestrictedDM(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("cannot delete reaction in restricted DM", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageTeam
		})

		// Create a DM channel between two users who don't share a team
		dmChannel := th.CreateDmChannel(th.BasicUser2)

		// Ensure the two users do not share a team
		teams, err := th.App.GetTeamsForUser(th.BasicUser.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}
		teams, err = th.App.GetTeamsForUser(th.BasicUser2.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser2.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}

		// Create separate teams for each user
		team1 := th.CreateTeam()
		team2 := th.CreateTeam()
		th.LinkUserToTeam(th.BasicUser, team1)
		th.LinkUserToTeam(th.BasicUser2, team2)

		// Create a post in the DM channel
		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: dmChannel.Id,
			Message:   "test post",
		}
		post, err = th.App.CreatePost(th.Context, post, dmChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		reaction := &model.Reaction{
			UserId:    th.BasicUser.Id,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		appErr := th.App.DeleteReactionForPost(th.Context, reaction)
		require.NotNil(t, appErr)
		require.Equal(t, "api.reaction.delete.restricted_dm.error", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		// Reset config
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageAny
		})
	})
}

func TestSharedChannelSyncForReactionActions(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("adding a reaction in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()

		sharedChannelService := NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err, "Creating a post should not error")

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "+1",
		}

		_, err = th.App.SaveReactionForPost(th.Context, reaction)
		require.Nil(t, err, "Adding a reaction should not error")

		th.TearDown() // We need to enforce teardown because reaction instrumentation happens in a goroutine

		assert.Len(t, sharedChannelService.channelNotifications, 2)
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[0])
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[1])
	})

	t.Run("removing a reaction in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := setupSharedChannels(t).InitBasic()

		sharedChannelService := NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err, "Creating a post should not error")

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "+1",
		}

		err = th.App.DeleteReactionForPost(th.Context, reaction)
		require.Nil(t, err, "Adding a reaction should not error")

		th.TearDown() // We need to enforce teardown because reaction instrumentation happens in a goroutine

		assert.Len(t, sharedChannelService.channelNotifications, 2)
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[0])
		assert.Equal(t, channel.Id, sharedChannelService.channelNotifications[1])
	})
}

func (th *TestHelper) UpdateConfig(f func(*model.Config)) {
	if th.ConfigStore.IsReadOnly() {
		return
	}
	old := th.ConfigStore.Get()
	updated := old.Clone()
	f(updated)
	if _, _, err := th.ConfigStore.Set(updated); err != nil {
		panic(err)
	}
}
