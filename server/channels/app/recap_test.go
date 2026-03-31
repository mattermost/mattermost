// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateRecap(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	t.Run("create recap with valid channels", func(t *testing.T) {
		channel2 := th.CreateChannel(t, th.BasicTeam)
		channelIds := []string{th.BasicChannel.Id, channel2.Id}

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "My Test Recap", channelIds, "test-agent-id")
		require.Nil(t, err)
		require.NotNil(t, recap)
		assert.Equal(t, th.BasicUser.Id, recap.UserId)
		assert.Equal(t, model.RecapStatusPending, recap.Status)
		assert.Equal(t, "My Test Recap", recap.Title)
	})

	t.Run("create recap with channel user is not member of", func(t *testing.T) {
		// Create a private channel and add only BasicUser2
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		// Remove BasicUser if they were added automatically
		_ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		// Ensure BasicUser2 is a member instead
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		// Try to create recap as BasicUser who is not a member
		channelIds := []string{privateChannel.Id}
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "Test Recap", channelIds, "test-agent-id")
		require.NotNil(t, err)
		assert.Nil(t, recap)
		assert.Equal(t, "app.recap.permission_denied", err.Id)
	})
}

func TestGetRecap(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	t.Run("get recap by owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Create recap channel
		recapChannel := &model.RecapChannel{
			Id:            model.NewId(),
			RecapId:       recap.Id,
			ChannelId:     th.BasicChannel.Id,
			ChannelName:   th.BasicChannel.DisplayName,
			Highlights:    []string{"Test highlight"},
			ActionItems:   []string{"Test action"},
			SourcePostIds: []string{model.NewId()},
			CreateAt:      model.GetMillis(),
		}

		err = th.App.Srv().Store().Recap().SaveRecapChannel(recapChannel)
		require.NoError(t, err)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		retrievedRecap, appErr := th.App.GetRecap(ctx, recap.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedRecap)
		assert.Equal(t, recap.Id, retrievedRecap.Id)
		assert.Len(t, retrievedRecap.Channels, 1)
		assert.Equal(t, recapChannel.ChannelName, retrievedRecap.Channels[0].ChannelName)
	})

	t.Run("get recap by non-owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Try to get as a different user - create context with BasicUser2's session
		ctx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser2.Id})
		retrievedRecap, appErr := th.App.GetRecap(ctx, recap.Id)
		// Permissions are now checked in API layer, so App layer should return the recap
		require.Nil(t, appErr)
		require.NotNil(t, retrievedRecap)
		assert.Equal(t, recap.Id, retrievedRecap.Id)
	})
}

func TestGetRecapsForUser(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	t.Run("get recaps for user", func(t *testing.T) {
		// Create multiple recaps for the user
		for range 5 {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            th.BasicUser.Id,
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusCompleted,
			}

			_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
			require.NoError(t, err)
		}

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recaps, err := th.App.GetRecapsForUser(ctx, 0, 10)
		require.Nil(t, err)
		assert.Len(t, recaps, 5)
	})

	t.Run("pagination works correctly", func(t *testing.T) {
		userId := model.NewId()

		// Create context with the test user's session
		ctx := request.TestContext(t).WithSession(&model.Session{UserId: userId})

		// Create 15 recaps
		for range 15 {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            userId,
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusCompleted,
			}

			_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
			require.NoError(t, err)
		}

		// Get first page
		recapsPage1, err := th.App.GetRecapsForUser(ctx, 0, 10)
		require.Nil(t, err)
		assert.Len(t, recapsPage1, 10)

		// Get second page
		recapsPage2, err := th.App.GetRecapsForUser(ctx, 1, 10)
		require.Nil(t, err)
		assert.Len(t, recapsPage2, 5)
	})
}

func TestMarkRecapAsRead(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	t.Run("mark recap as read by owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		savedRecap, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Mark as read
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		updatedRecap, appErr := th.App.MarkRecapAsRead(ctx, savedRecap)
		require.Nil(t, appErr)
		require.NotNil(t, updatedRecap)
		assert.Greater(t, updatedRecap.ReadAt, int64(0))
	})

	t.Run("mark recap as read by non-owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		savedRecap, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Try to mark as read as a different user - create context with BasicUser2's session
		ctx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser2.Id})
		updatedRecap, appErr := th.App.MarkRecapAsRead(ctx, savedRecap)
		// Permissions are now checked in API layer, so App layer should allow it
		require.Nil(t, appErr)
		require.NotNil(t, updatedRecap)
		assert.Greater(t, updatedRecap.ReadAt, int64(0))
	})
}

func TestProcessRecapChannel(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	t.Run("process empty channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Ensure channel has no posts (it shouldn't in init)
		channel := th.CreateChannel(t, th.BasicTeam)
		// No posts added

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Empty recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, 0, result.MessageCount)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Equal(t, channel.Id, recapChannels[0].ChannelId)
		assert.Empty(t, recapChannels[0].Highlights)
		assert.Empty(t, recapChannels[0].ActionItems)
	})

	t.Run("process channel with posts persists recap channel", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["A deterministic highlight"],"action_items":["A deterministic action item"]}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		channel := th.CreateChannel(t, th.BasicTeam)
		post := th.CreatePost(t, channel)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Test recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, 1, result.MessageCount)
		require.Len(t, bridge.completeCalls, 1)
		assert.Equal(t, BridgeOperationRecapSummary, bridge.completeCalls[0].request.Operation)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Equal(t, channel.Id, recapChannels[0].ChannelId)
		assert.Equal(t, []string{"A deterministic highlight"}, recapChannels[0].Highlights)
		assert.Equal(t, []string{"A deterministic action item"}, recapChannels[0].ActionItems)
		assert.Equal(t, []string{post.Id}, recapChannels[0].SourcePostIds)
	})

	t.Run("malformed completion surfaces parse failure", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return "{invalid json", nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		channel := th.CreateChannel(t, th.BasicTeam)
		th.CreatePost(t, channel)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Malformed recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.NotNil(t, err)
		assert.Equal(t, "app.ai.summarize.parse_failed", err.Id)
		assert.False(t, result.Success)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Equal(t, channel.Id, recapChannels[0].ChannelId)
		assert.Empty(t, recapChannels[0].Highlights)
		assert.Empty(t, recapChannels[0].ActionItems)
		assert.Len(t, recapChannels[0].SourcePostIds, 1)
	})
}

func TestExtractPostIDs(t *testing.T) {
	t.Run("extract post IDs from posts", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", Message: "test1"},
			{Id: "post2", Message: "test2"},
			{Id: "post3", Message: "test3"},
		}

		ids := extractPostIDs(posts)
		assert.Len(t, ids, 3)
		assert.Equal(t, "post1", ids[0])
		assert.Equal(t, "post2", ids[1])
		assert.Equal(t, "post3", ids[2])
	})

	t.Run("extract from empty posts", func(t *testing.T) {
		posts := []*model.Post{}
		ids := extractPostIDs(posts)
		assert.Len(t, ids, 0)
	})
}
