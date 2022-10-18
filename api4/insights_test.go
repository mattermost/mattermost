// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Top Reactions

func TestGetTopReactionsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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

			_, err = th.App.Srv().Store().Reaction().Save(reaction)
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

	t.Run("get-top-reactions-for-team-since invalid license", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense(""))

		_, resp, err := client.GetTopReactionsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}

func TestGetTopReactionsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client
	userId := th.BasicUser.Id

	channel4 := th.CreatePublicChannel()
	channel5 := th.CreatePrivateChannel()
	channel6 := th.CreatePrivateChannel()
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel4, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel5, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel6, false)

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

	t.Run("get-top-channels-for-team-since invalid license", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense(""))

		_, resp, err := client.GetTopChannelsForTeamSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}

func TestGetTopChannelsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	userId := th.BasicUser.Id

	channel4 := th.CreatePublicChannel()
	channel5 := th.CreatePrivateChannel()
	channel6 := th.CreatePrivateChannel()
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel4, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel5, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel6, false)

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

func TestGetTopThreadsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	th.LoginBasic()
	client := th.Client

	// create a public channel, a private channel

	channelPublic := th.BasicChannel
	channelPrivate := th.BasicPrivateChannel
	th.App.AddUserToChannel(th.Context, th.BasicUser, channelPublic, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channelPrivate, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser2, channelPublic, false)
	th.App.RemoveUserFromChannel(th.Context, th.BasicUser2.Id, th.BasicUser.Id, channelPrivate)

	// create two threads: one in public channel, one in private
	// post in public channel has both users interacting, post in private only has user1 interacting

	rootPostPublicChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPublic.Id,
		Message:   "root post pub",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: channelPublic.Id,
		RootId:    rootPostPublicChannel.Id,
		Message:   "reply post 1",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	rootPostPrivateChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		Message:   "root post priv",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 1",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 2",
	}, channelPrivate, false, true)

	require.Nil(t, appErr)

	// get top threads for team, as user 1 and user 2
	// user 1, 2 should see both threads

	topTeamThreadsByUser1, _, _ := client.GetTopThreadsForTeamSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topTeamThreadsByUser1.Items, 2)
	require.Equal(t, topTeamThreadsByUser1.Items[0].Post.Id, rootPostPrivateChannel.Id)
	require.Equal(t, topTeamThreadsByUser1.Items[1].Post.Id, rootPostPublicChannel.Id)

	client.Logout()

	th.LoginBasic2()

	client = th.Client

	topTeamThreadsByUser2, _, _ := client.GetTopThreadsForTeamSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topTeamThreadsByUser2.Items, 1)
	require.Equal(t, topTeamThreadsByUser2.Items[0].Post.Id, rootPostPublicChannel.Id)

	// add user2 to private channel and it can see 2 top threads.
	th.AddUserToChannel(th.BasicUser2, channelPrivate)
	topTeamThreadsByUser2IncludingPrivate, _, _ := client.GetTopThreadsForTeamSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topTeamThreadsByUser2IncludingPrivate.Items, 2)

	t.Run("get-top-threads-for-team-since invalid license", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense(""))

		_, resp, err := client.GetTopThreadsForTeamSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}

func TestGetTopThreadsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.LoginBasic()
	client := th.Client

	// create a public channel, a private channel

	channelPublic := th.BasicChannel
	channelPrivate := th.BasicPrivateChannel
	th.App.AddUserToChannel(th.Context, th.BasicUser, channelPublic, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channelPrivate, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser2, channelPublic, false)

	// create two threads: one in public channel, one in private
	// post in public channel has both users interacting, post in private only has user1 interacting

	rootPostPublicChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPublic.Id,
		Message:   "root post pub",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: channelPublic.Id,
		RootId:    rootPostPublicChannel.Id,
		Message:   "reply post 1",
	}, channelPublic, false, true)
	require.Nil(t, appErr)

	rootPostPrivateChannel, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		Message:   "root post priv",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 1",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 2",
	}, channelPrivate, false, true)

	require.Nil(t, appErr)

	// get top threads for user, as user 1 and user 2
	// user 1 should see both threads, while user 2 should see only thread in public channel
	// (even if user2 is in the private channel it hasn't interacted with the thread there.)

	topUser1Threads, _, _ := client.GetTopThreadsForUserSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topUser1Threads.Items, 2)
	require.Equal(t, topUser1Threads.Items[0].Post.Id, rootPostPrivateChannel.Id)
	require.Equal(t, topUser1Threads.Items[0].Post.ReplyCount, int64(2))
	require.Equal(t, topUser1Threads.Items[1].Post.Id, rootPostPublicChannel.Id)
	require.Contains(t, topUser1Threads.Items[1].Participants, th.BasicUser2.Id)
	require.Equal(t, topUser1Threads.Items[1].Post.ReplyCount, int64(1))

	client.Logout()

	th.LoginBasic2()

	client = th.Client

	topUser2Threads, _, _ := client.GetTopThreadsForUserSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topUser2Threads.Items, 1)
	require.Equal(t, topUser2Threads.Items[0].Post.Id, rootPostPublicChannel.Id)
	require.Equal(t, topUser2Threads.Items[0].Post.ReplyCount, int64(1))

	// deleting the root post results in the thread not making it to top threads list
	_, appErr = th.App.DeletePost(th.Context, rootPostPublicChannel.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	client.Logout()

	th.LoginBasic()

	client = th.Client

	topUser1ThreadsAfterPost1Delete, _, _ := client.GetTopThreadsForUserSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topUser1ThreadsAfterPost1Delete.Items, 1)

	client.Logout()

	th.LoginBasic2()

	client = th.Client

	// reply with user2 in thread2. deleting that reply, shouldn't give any top thread for user2 if the user2 unsubscribes to the thread after deleting the comment
	replyPostUser2InPrivate, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: channelPrivate.Id,
		RootId:    rootPostPrivateChannel.Id,
		Message:   "reply post 3",
	}, channelPrivate, false, true)
	require.Nil(t, appErr)

	topUser2ThreadsAfterPrivateReply, _, _ := client.GetTopThreadsForUserSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topUser2ThreadsAfterPrivateReply.Items, 1)

	// deleting reply, and unfollowing thread
	_, appErr = th.App.DeletePost(th.Context, replyPostUser2InPrivate.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)
	// unfollow thread
	_, err := th.App.Srv().Store().Thread().MaintainMembership(th.BasicUser2.Id, rootPostPrivateChannel.Id, store.ThreadMembershipOpts{
		Following:       false,
		UpdateFollowing: true,
	})
	require.NoError(t, err)

	topUser2ThreadsAfterPrivateReplyDelete, _, _ := client.GetTopThreadsForUserSince(th.BasicTeam.Id, model.TimeRangeToday, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, topUser2ThreadsAfterPrivateReplyDelete.Items, 0)
}

func TestGetTopInactiveChannelsForTeamSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// delete offtopic, town-square, th.basicchannel channel - which interferes with 'least' active channel results
	offTopicChannel, appErr := th.App.GetChannelByName(th.Context, "off-topic", th.BasicTeam.Id, false)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, offTopicChannel)
	require.Nil(t, appErr)
	townSquareChannel, appErr := th.App.GetChannelByName(th.Context, "town-square", th.BasicTeam.Id, false)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, townSquareChannel)
	require.Nil(t, appErr)
	basicChannel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, basicChannel)
	require.Nil(t, appErr)
	basicChannel2, appErr := th.App.GetChannel(th.Context, th.BasicChannel2.Id)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, basicChannel2)
	require.Nil(t, appErr)
	basicPrivateChannel, appErr := th.App.GetChannel(th.Context, th.BasicPrivateChannel.Id)
	require.Nil(t, appErr, "Expected nil, didn't receive nil")
	appErr = th.App.PermanentDeleteChannel(th.Context, basicPrivateChannel)
	require.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client
	userId := th.BasicUser.Id

	channel4Req := &model.Channel{
		DisplayName: "channel4",
		Name:        GenerateTestChannelName(),
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreateAt:    1,
	}
	channel4, _, err := client.CreateChannel(channel4Req)
	require.NoError(t, err)

	channel5Req := &model.Channel{
		DisplayName: "channel4",
		Name:        GenerateTestChannelName(),
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreateAt:    1,
	}
	channel5, _, err := client.CreateChannel(channel5Req)
	require.NoError(t, err)

	channel6Req := &model.Channel{
		DisplayName: "channel4",
		Name:        GenerateTestChannelName(),
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreateAt:    1,
	}
	channel6, _, err := client.CreateChannel(channel6Req)
	require.NoError(t, err)

	th.App.AddUserToChannel(th.Context, th.BasicUser, channel4, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel5, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel6, false)

	channelIDs := [3]string{channel4.Id, channel5.Id, channel6.Id}

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
	}{{
		ID: channel6.Id, MessageCount: 1},
		{ID: channel5.Id, MessageCount: 2},
		{ID: channel4.Id, MessageCount: 3},
	}

	t.Run("get-top-inactive-channels-for-team-since", func(t *testing.T) {
		topInactiveChannels, _, err := client.GetTopInactiveChannelsForTeamSince(teamId, model.TimeRangeToday, 0, 2)
		require.NoError(t, err)

		for i, channel := range topInactiveChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
		}

		topInactiveChannels, _, err = client.GetTopInactiveChannelsForTeamSince(teamId, model.TimeRangeToday, 1, 2)
		require.NoError(t, err)
		assert.Equal(t, channel4.Id, topInactiveChannels.Items[0].ID)
	})

	t.Run("get-top-channels-for-user-since exclude channels user is not member of", func(t *testing.T) {
		excludedChannel := th.CreatePrivateChannel()

		for i := 0; i < 10; i++ {
			_, _, err := client.CreatePost(&model.Post{UserId: userId, ChannelId: excludedChannel.Id, Message: "zz" + model.NewId() + "a"})
			require.NoError(t, err)
		}

		th.RemoveUserFromChannel(th.BasicUser, excludedChannel)

		topInactiveChannels, _, err := client.GetTopInactiveChannelsForUserSince(teamId, model.TimeRangeToday, 0, 3)
		require.NoError(t, err)

		for i, channel := range topInactiveChannels.Items {
			assert.Equal(t, expectedTopChannels[i].ID, channel.ID)
		}
	})

	t.Run("get-top-inactive-channels-for-team-since invalid license", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense(""))

		_, resp, err := client.GetTopInactiveChannelsForUserSince(teamId, model.TimeRangeToday, 0, 5)
		assert.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}

func TestGetTopDMsForUserSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)
	th.App.UpdateConfig(func(c *model.Config) {
		*c.TeamSettings.EnableUserDeactivation = true
	})
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableBotAccountCreation = true })

	// basicuser1 - bu1, basicuser - bu
	// create dm channels for  bu-bu, bu1-bu1, bu-bu1, bot-bu
	basicUser := th.BasicUser
	basicUser1 := th.BasicUser2

	th.LoginBasic2()
	client := th.Client
	channelBu1Bu1, _, err := client.CreateDirectChannel(basicUser1.Id, basicUser1.Id)
	require.NoError(t, err)

	th.LoginBasic()
	client = th.Client
	channelBuBu, _, err := client.CreateDirectChannel(basicUser.Id, basicUser.Id)
	require.NoError(t, err)
	channelBuBu1, _, err := client.CreateDirectChannel(basicUser.Id, basicUser1.Id)
	require.NoError(t, err)

	// bot creation with permission
	th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId+" "+model.SystemUserRoleId, false)
	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
		UserId:      model.NewId(),
	}

	createdBot, resp, err := th.Client.CreateBot(bot)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(createdBot.UserId)
	channelBuBot, _, err := client.CreateDirectChannel(basicUser.Id, createdBot.UserId)
	require.NoError(t, err)

	// create 2 posts in channelBu, 1 in channelBu1, 3 in channelBu12
	postsGenConfig := []map[string]interface{}{
		{
			"chId":      channelBuBu.Id,
			"postCount": 2,
		},
		{
			"chId":      channelBu1Bu1.Id,
			"postCount": 1,
		},
		{
			"chId":      channelBuBu1.Id,
			"postCount": 3,
		},
		{
			"chId":      channelBuBot.Id,
			"postCount": 4,
		},
	}

	for _, postGen := range postsGenConfig {
		postCount := postGen["postCount"].(int)
		for i := 0; i < postCount; i++ {
			if postGen["chId"] == channelBu1Bu1.Id {
				th.LoginBasic2()
				client = th.Client
				userId := basicUser1.Id
				post := &model.Post{UserId: userId, ChannelId: postGen["chId"].(string), Message: "zz" + model.NewId() + "a"}
				_, _, err = client.CreatePost(post)
				require.NoError(t, err)
			} else {
				th.LoginBasic()
				client = th.Client
				userId := basicUser.Id
				post := &model.Post{UserId: userId, ChannelId: postGen["chId"].(string), Message: "zz" + model.NewId() + "a"}
				_, _, err = client.CreatePost(post)
				require.NoError(t, err)
			}
		}
	}

	// get top dms for bu
	t.Run("get top dms for basic user 1", func(t *testing.T) {
		th.LoginBasic()
		client = th.Client
		topDMs, _, topDmsErr := client.GetTopDMsForUserSince("today", 0, 100)
		require.NoError(t, topDmsErr)
		require.Len(t, topDMs.Items, 1)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(3))
		require.Equal(t, topDMs.Items[0].SecondParticipant.Id, basicUser1.Id)

		// test pagination
		topDMsPage0PerPage1, _, topDmsErr := client.GetTopDMsForUserSince("today", 0, 2)
		require.NoError(t, topDmsErr)
		require.Len(t, topDMsPage0PerPage1.Items, 1)
		require.Equal(t, topDMsPage0PerPage1.HasNext, false)
		require.Equal(t, topDMsPage0PerPage1.Items[0].SecondParticipant.Id, basicUser1.Id)
	})

	// get top dms for bu1
	t.Run("get top dms for basic user 2", func(t *testing.T) {
		th.LoginBasic2()
		client = th.Client
		topDMs, _, topDmsErr := client.GetTopDMsForUserSince("today", 0, 100)
		require.NoError(t, topDmsErr)
		require.Len(t, topDMs.Items, 1)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(3))
	})
	// deactivate basicuser1
	_, err = th.Client.DeleteUser(basicUser1.Id)
	require.NoError(t, err)
	// deactivated users DMs should show in topDMs
	t.Run("get top dms for basic user 1", func(t *testing.T) {
		th.LoginBasic()
		client = th.Client
		topDMs, _, topDmsErr := client.GetTopDMsForUserSince("today", 0, 100)
		require.NoError(t, topDmsErr)
		require.Len(t, topDMs.Items, 1)
		require.Equal(t, topDMs.Items[0].MessageCount, int64(3))
	})
}

func TestNewTeamMembersSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.LoginBasic()

	team := th.CreateTeam()

	t.Run("accepts only starter or professional license skus", func(t *testing.T) {
		_, resp, _ := th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		CheckNotImplementedStatus(t, resp)

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuE10))
		_, resp, _ = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		CheckNotImplementedStatus(t, resp)

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuE20))
		_, resp, _ = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		CheckNotImplementedStatus(t, resp)

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		_, resp, err := th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		_, resp, err = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("rejects guests", func(t *testing.T) {
		_, resp, err := th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		th.App.DemoteUserToGuest(th.Context, th.BasicUser)
		defer th.App.PromoteGuestToUser(th.Context, th.BasicUser, "")

		_, resp, _ = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 5)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("implements pagination", func(t *testing.T) {
		// check the first page of results
		list, resp, err := th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 2)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Equal(t, int(list.TotalCount), 1)
		require.Len(t, list.Items, 1)
		require.False(t, list.HasNext)

		// check the 2nd page
		list, resp, err = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 1, 2)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.GreaterOrEqual(t, len(list.Items), 0)

		// add a few new team members and re-test the pagination
		user := th.CreateUser()
		_, appErr := th.App.AddTeamMember(th.Context, team.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddTeamMember(th.Context, team.Id, user.Id)
		require.Nil(t, appErr)

		list, resp, err = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 2)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, 3, int(list.TotalCount))
		require.Len(t, list.Items, 2)
		require.True(t, list.HasNext)

		list, resp, err = th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 1, 2)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, int(list.TotalCount), 3)
		require.Len(t, list.Items, 1)
		require.False(t, list.HasNext)
	})

	t.Run("get-new-team-members-since invalid license", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense(""))

		_, resp, err := th.Client.GetNewTeamMembersSince(team.Id, model.TimeRangeToday, 0, 2)
		assert.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}
