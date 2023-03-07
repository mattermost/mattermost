// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/channels/testlib"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestSharedChannelSyncForReactionActions(t *testing.T) {
	t.Run("adding a reaction in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()

		sharedChannelService := NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
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
		th := Setup(t).InitBasic()

		sharedChannelService := NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(sharedChannelService)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		user := th.BasicUser

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
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

func TestGetTopReactionsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id

	post1 := th.CreatePost(th.BasicChannel)
	post2 := th.CreatePost(th.BasicChannel)
	post3 := th.CreatePost(th.BasicChannel)
	post4 := th.CreatePost(th.BasicChannel)
	post5 := th.CreatePost(th.BasicChannel)

	userReactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "happy",
		},
		{
			UserId:    user2Id,
			PostId:    post1.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "sad",
		},
		{
			UserId:    user2Id,
			PostId:    post1.Id,
			EmojiName: "sad",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "joy",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "100",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "sad",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "joy",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "100",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "smile",
		},
		{
			UserId:    user2Id,
			PostId:    post3.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "joy",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "100",
		},
		{
			UserId:    userId,
			PostId:    post4.Id,
			EmojiName: "joy",
		},
		{
			UserId:    user2Id,
			PostId:    post4.Id,
			EmojiName: "joy",
		},
		{
			UserId:    userId,
			PostId:    post4.Id,
			EmojiName: "100",
		},
		{
			UserId:    userId,
			PostId:    post5.Id,
			EmojiName: "100",
		},
		{
			UserId:    user2Id,
			PostId:    post5.Id,
			EmojiName: "100",
		},
		{
			UserId:    user2Id,
			PostId:    post5.Id,
			EmojiName: "+1",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "100",
			CreateAt:  model.GetMillisForTime(time.Now().Add(time.Hour * time.Duration(-25))),
		},
	}

	for _, userReaction := range userReactions {
		_, err := th.App.Srv().Store().Reaction().Save(userReaction)
		require.NoError(t, err)
	}

	teamId := th.BasicChannel.TeamId

	var expectedTopReactions [5]*model.TopReaction
	expectedTopReactions[0] = &model.TopReaction{EmojiName: "100", Count: int64(6)}
	expectedTopReactions[1] = &model.TopReaction{EmojiName: "joy", Count: int64(5)}
	expectedTopReactions[2] = &model.TopReaction{EmojiName: "smile", Count: int64(4)}
	expectedTopReactions[3] = &model.TopReaction{EmojiName: "sad", Count: int64(3)}
	expectedTopReactions[4] = &model.TopReaction{EmojiName: "happy", Count: int64(2)}

	timeRange, _ := model.GetStartOfDayForTimeRange(model.TimeRangeToday, time.Now().Location())

	t.Run("get-top-reactions-for-team-since", func(t *testing.T) {
		topReactions, err := th.App.GetTopReactionsForTeamSince(teamId, userId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		require.Nil(t, err)
		reactions := topReactions.Items

		for i, reaction := range reactions {
			assert.Equal(t, expectedTopReactions[i].EmojiName, reaction.EmojiName)
			assert.Equal(t, expectedTopReactions[i].Count, reaction.Count)
		}
		topReactions, err = th.App.GetTopReactionsForTeamSince(teamId, userId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 1, PerPage: 5})
		require.Nil(t, err)
		reactions = topReactions.Items

		assert.Equal(t, "+1", reactions[0].EmojiName)
		assert.Equal(t, int64(1), reactions[0].Count)
	})

	t.Run("get-top-reactions-for-team-since feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
		_, err := th.App.GetTopReactionsForTeamSince(userId, teamId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		assert.NotNil(t, err)
	})
}

func TestGetTopReactionsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	userId := th.BasicUser.Id

	post1 := th.CreatePost(th.BasicChannel)
	post2 := th.CreatePost(th.BasicChannel)
	post3 := th.CreatePost(th.BasicChannel)
	post4 := th.CreatePost(th.BasicChannel)
	post5 := th.CreatePost(th.BasicChannel)
	post6 := th.CreatePost(th.BasicChannel)

	userReactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post4.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post5.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post6.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post4.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post5.Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "+1",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "+1",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "+1",
		},
		{
			UserId:    userId,
			PostId:    post4.Id,
			EmojiName: "+1",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "heart",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "heart",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: "heart",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "blush",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "blush",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "100",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "100",
			CreateAt:  model.GetMillisForTime(time.Now().Add(time.Hour * time.Duration(-25))),
		},
	}

	for _, userReaction := range userReactions {
		_, err := th.App.Srv().Store().Reaction().Save(userReaction)
		require.NoError(t, err)
	}

	teamId := th.BasicChannel.TeamId

	var expectedTopReactions [5]*model.TopReaction
	expectedTopReactions[0] = &model.TopReaction{EmojiName: "happy", Count: int64(6)}
	expectedTopReactions[1] = &model.TopReaction{EmojiName: "smile", Count: int64(5)}
	expectedTopReactions[2] = &model.TopReaction{EmojiName: "+1", Count: int64(4)}
	expectedTopReactions[3] = &model.TopReaction{EmojiName: "heart", Count: int64(3)}
	expectedTopReactions[4] = &model.TopReaction{EmojiName: "blush", Count: int64(2)}

	timeRange, _ := model.GetStartOfDayForTimeRange(model.TimeRangeToday, time.Now().Location())

	t.Run("get-top-reactions-for-user-since", func(t *testing.T) {
		topReactions, err := th.App.GetTopReactionsForUserSince(userId, teamId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		require.Nil(t, err)
		reactions := topReactions.Items

		for i, reaction := range reactions {
			assert.Equal(t, expectedTopReactions[i].EmojiName, reaction.EmojiName)
			assert.Equal(t, expectedTopReactions[i].Count, reaction.Count)
		}

		topReactions, err = th.App.GetTopReactionsForUserSince(userId, teamId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 1, PerPage: 5})
		require.Nil(t, err)
		reactions = topReactions.Items
		assert.Equal(t, "100", reactions[0].EmojiName)
		assert.Equal(t, int64(1), reactions[0].Count)
	})

	t.Run("get-top-reactions-for-user-since feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
		_, err := th.App.GetTopReactionsForUserSince(userId, teamId, &model.InsightsOpts{StartUnixMilli: timeRange.UnixMilli(), Page: 0, PerPage: 5})
		assert.NotNil(t, err)
	})
}
