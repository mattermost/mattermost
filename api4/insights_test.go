// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Top Reactions

func TestGetTopReactionsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client

	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id

	post1 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post2 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post3 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post4 := &model.Post{UserId: user2Id, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post5 := &model.Post{UserId: user2Id, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}

	post1, _, _ = client.CreatePost(post1)
	post2, _, _ = client.CreatePost(post2)
	post3, _, _ = client.CreatePost(post3)
	post4, _, _ = client.CreatePost(post4)
	post5, _, _ = client.CreatePost(post5)

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
		_, err := th.App.Srv().Store.Reaction().Save(userReaction)
		require.NoError(t, err)
	}

	teamId := th.BasicChannel.TeamId

	var expectedTopReactions [5]*model.TopReaction
	expectedTopReactions[0] = &model.TopReaction{EmojiName: "100", Count: int64(6)}
	expectedTopReactions[1] = &model.TopReaction{EmojiName: "joy", Count: int64(5)}
	expectedTopReactions[2] = &model.TopReaction{EmojiName: "smile", Count: int64(4)}
	expectedTopReactions[3] = &model.TopReaction{EmojiName: "sad", Count: int64(3)}
	expectedTopReactions[4] = &model.TopReaction{EmojiName: "happy", Count: int64(2)}

	t.Run("get-top-reactions-for-team-since", func(t *testing.T) {
		topReactions, _, err := client.GetTopReactionsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)
		reactions := topReactions.Items

		for i, reaction := range reactions {
			assert.Equal(t, expectedTopReactions[i].EmojiName, reaction.EmojiName)
			assert.Equal(t, expectedTopReactions[i].Count, reaction.Count)
		}

		topReactions, _, err = client.GetTopReactionsForTeamSince(teamId, model.TimeRangeToday, 1, 5)
		require.NoError(t, err)
		reactions = topReactions.Items

		assert.Equal(t, "+1", reactions[0].EmojiName)
		assert.Equal(t, int64(1), reactions[0].Count)
	})

	t.Run("get-top-reactions-for-team-since exclude channels user is not member of", func(t *testing.T) {
		excludedChannel := th.CreatePrivateChannel()

		for i := 0; i < 10; i++ {
			post, _, err := client.CreatePost(&model.Post{UserId: userId, ChannelId: excludedChannel.Id, Message: "zz" + model.NewId() + "a"})
			require.NoError(t, err)

			reaction := &model.Reaction{
				UserId:    userId,
				PostId:    post.Id,
				EmojiName: "confused",
			}

			_, err = th.App.Srv().Store.Reaction().Save(reaction)
			require.NoError(t, err)
		}

		th.RemoveUserFromChannel(th.BasicUser, excludedChannel)

		topReactions, _, err := client.GetTopReactionsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)
		reactions := topReactions.Items

		for i, reaction := range reactions {
			assert.Equal(t, expectedTopReactions[i].EmojiName, reaction.EmojiName)
			assert.Equal(t, expectedTopReactions[i].Count, reaction.Count)
		}

		topReactions, _, err = client.GetTopReactionsForTeamSince(teamId, model.TimeRangeToday, 1, 5)
		require.NoError(t, err)
		reactions = topReactions.Items

		assert.Equal(t, "+1", reactions[0].EmojiName)
		assert.Equal(t, int64(1), reactions[0].Count)
	})

	t.Run("get-top-reactions-for-team-since invalid team id", func(t *testing.T) {
		_, resp, err := client.GetTopReactionsForTeamSince("12345", model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetTopReactionsForTeamSince(model.NewId(), model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get-top-reactions-for-team-since not a member of team", func(t *testing.T) {
		th.UnlinkUserFromTeam(th.BasicUser, th.BasicTeam)
		_, resp, err := client.GetTopReactionsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetTopReactionsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client

	userId := th.BasicUser.Id

	post1 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post2 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post3 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post4 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post5 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post6 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}

	post1, _, _ = client.CreatePost(post1)
	post2, _, _ = client.CreatePost(post2)
	post3, _, _ = client.CreatePost(post3)
	post4, _, _ = client.CreatePost(post4)
	post5, _, _ = client.CreatePost(post5)
	post6, _, _ = client.CreatePost(post6)

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
		_, err := th.App.Srv().Store.Reaction().Save(userReaction)
		require.NoError(t, err)
	}

	teamId := th.BasicChannel.TeamId

	var expectedTopReactions [5]*model.TopReaction
	expectedTopReactions[0] = &model.TopReaction{EmojiName: "happy", Count: int64(6)}
	expectedTopReactions[1] = &model.TopReaction{EmojiName: "smile", Count: int64(5)}
	expectedTopReactions[2] = &model.TopReaction{EmojiName: "+1", Count: int64(4)}
	expectedTopReactions[3] = &model.TopReaction{EmojiName: "heart", Count: int64(3)}
	expectedTopReactions[4] = &model.TopReaction{EmojiName: "blush", Count: int64(2)}

	t.Run("get-top-reactions-for-user-since", func(t *testing.T) {
		topReactions, _, err := client.GetTopReactionsForUserSince(teamId, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)
		reactions := topReactions.Items

		for i, reaction := range reactions {
			assert.Equal(t, expectedTopReactions[i].EmojiName, reaction.EmojiName)
			assert.Equal(t, expectedTopReactions[i].Count, reaction.Count)
		}

		topReactions, _, err = client.GetTopReactionsForUserSince(teamId, model.TimeRangeToday, 1, 5)
		require.NoError(t, err)
		reactions = topReactions.Items
		assert.Equal(t, "100", reactions[0].EmojiName)
		assert.Equal(t, int64(1), reactions[0].Count)
	})

	t.Run("get-top-reactions-for-user-since invalid team id", func(t *testing.T) {
		_, resp, err := client.GetTopReactionsForUserSince("invalid_team_id", model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetTopReactionsForUserSince(model.NewId(), model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get-top-reactions-for-user-since not a member of team", func(t *testing.T) {
		th.UnlinkUserFromTeam(th.BasicUser, th.BasicTeam)
		_, resp, err := client.GetTopReactionsForUserSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

// Top Channels

func TestGetTopChannelsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client
	userId := th.BasicUser.Id

	channel4 := th.CreatePublicChannel()
	channel5 := th.CreatePrivateChannel()
	channel6 := th.CreatePrivateChannel()
	th.App.AddUserToChannel(th.BasicUser, channel4, false)
	th.App.AddUserToChannel(th.BasicUser, channel5, false)
	th.App.AddUserToChannel(th.BasicUser, channel6, false)

	channelIDs := [6]string{th.BasicChannel.Id, th.BasicChannel2.Id, th.BasicPrivateChannel.Id, channel4.Id, channel5.Id, channel6.Id}

	i := len(channelIDs)
	for _, channelID := range channelIDs {
		for j := i; j > 0; j-- {
			_, _, err := client.CreatePost(&model.Post{UserId: userId, ChannelId: channelID, Message: "zz" + model.NewId() + "a"})
			require.NoError(t, err)
		}
		i--
	}

	teamId := th.BasicChannel.TeamId

	expectedTopChannels := []struct {
		ID           string
		MessageCount int64
	}{
		{ID: th.BasicChannel.Id, MessageCount: 7},
		{ID: th.BasicChannel2.Id, MessageCount: 5},
		{ID: th.BasicPrivateChannel.Id, MessageCount: 4},
		{ID: channel4.Id, MessageCount: 3},
		{ID: channel5.Id, MessageCount: 2},
	}

	t.Run("get-top-channels-for-team-since", func(t *testing.T) {
		topChannels, _, err := client.GetTopChannelsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)

		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}

		topChannels, _, err = client.GetTopChannelsForTeamSince(teamId, model.TimeRangeToday, 1, 5)
		require.NoError(t, err)
		assert.Equal(t, channel6.Id, topChannels.Items[0].ID)
		assert.Equal(t, int64(1), topChannels.Items[0].MessageCount)

		t.Run("has post count by day", func(t *testing.T) {
			require.NotNil(t, topChannels.PostCountByDuration)
		})
	})

	t.Run("get-top-channels-for-user-since exclude channels user is not member of", func(t *testing.T) {
		excludedChannel := th.CreatePrivateChannel()

		for i := 0; i < 10; i++ {
			_, _, err := client.CreatePost(&model.Post{UserId: userId, ChannelId: excludedChannel.Id, Message: "zz" + model.NewId() + "a"})
			require.NoError(t, err)
		}

		th.RemoveUserFromChannel(th.BasicUser, excludedChannel)

		topChannels, _, err := client.GetTopChannelsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)

		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}
	})

	t.Run("get-top-channels-for-team-since invalid team id", func(t *testing.T) {
		_, resp, err := client.GetTopChannelsForTeamSince("12345", model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetTopChannelsForTeamSince(model.NewId(), model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get-top-channels-for-team-since not a member of team", func(t *testing.T) {
		th.UnlinkUserFromTeam(th.BasicUser, th.BasicTeam)
		_, resp, err := client.GetTopChannelsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetTopChannelsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client
	userId := th.BasicUser.Id

	channel4 := th.CreatePublicChannel()
	channel5 := th.CreatePrivateChannel()
	channel6 := th.CreatePrivateChannel()
	th.App.AddUserToChannel(th.BasicUser, channel4, false)
	th.App.AddUserToChannel(th.BasicUser, channel5, false)
	th.App.AddUserToChannel(th.BasicUser, channel6, false)

	channelIDs := [6]string{th.BasicChannel.Id, th.BasicChannel2.Id, th.BasicPrivateChannel.Id, channel4.Id, channel5.Id, channel6.Id}

	i := len(channelIDs)
	for _, channelID := range channelIDs {
		for j := i; j > 0; j-- {
			_, _, err := client.CreatePost(&model.Post{UserId: userId, ChannelId: channelID, Message: "zz" + model.NewId() + "a"})
			require.NoError(t, err)
		}
		i--
	}

	teamId := th.BasicChannel.TeamId

	expectedTopChannels := []struct {
		ID           string
		MessageCount int64
	}{
		{ID: th.BasicChannel.Id, MessageCount: 6},
		{ID: th.BasicChannel2.Id, MessageCount: 5},
		{ID: th.BasicPrivateChannel.Id, MessageCount: 4},
		{ID: channel4.Id, MessageCount: 3},
		{ID: channel5.Id, MessageCount: 2},
	}

	t.Run("get-top-channels-for-user-since", func(t *testing.T) {
		topChannels, _, err := client.GetTopChannelsForUserSince(teamId, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)

		for i, channel := range topChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
			assert.Equal(t, expectedTopChannels[i].MessageCount, channel.MessageCount)
		}

		topChannels, _, err = client.GetTopChannelsForUserSince("", model.TimeRangeToday, 1, 5)
		require.NoError(t, err)
		assert.Equal(t, channel6.Id, topChannels.Items[0].ID)
		assert.Equal(t, int64(1), topChannels.Items[0].MessageCount)

		t.Run("has post count by day", func(t *testing.T) {
			require.NotNil(t, topChannels.PostCountByDuration)
		})
	})

	t.Run("get-top-channels-for-user-since invalid team id", func(t *testing.T) {
		_, resp, err := client.GetTopChannelsForUserSince("12345", model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetTopChannelsForUserSince(model.NewId(), model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get-top-channels-for-user-since not a member of team", func(t *testing.T) {
		th.UnlinkUserFromTeam(th.BasicUser, th.BasicTeam)
		_, resp, err := client.GetTopChannelsForUserSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
