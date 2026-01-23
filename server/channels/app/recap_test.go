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

	th := Setup(t).InitBasic(t)

	t.Run("process empty channel", func(t *testing.T) {
		// Ensure channel has no posts (it shouldn't in init)
		channel := th.CreateChannel(t, th.BasicTeam)
		// No posts added

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, 0, result.MessageCount)
	})

	t.Run("process channel with posts", func(t *testing.T) {
		// This test expects failure at SummarizePosts because we can't mock AI easily in integration test
		channel := th.CreateChannel(t, th.BasicTeam)
		th.CreatePost(t, channel)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		// It will fail at SummarizePosts agent call
		require.NotNil(t, err)
		assert.Equal(t, "app.ai.summarize.agent_call_failed", err.Id)
		assert.False(t, result.Success)
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

func TestTruncatePostsProportionally(t *testing.T) {
	// Helper to create posts with IDs
	makePosts := func(count int, prefix string) []*model.Post {
		posts := make([]*model.Post, count)
		for i := 0; i < count; i++ {
			posts[i] = &model.Post{Id: prefix + string(rune('a'+i)), Message: "test message"}
		}
		return posts
	}

	t.Run("no truncation needed when under limit", func(t *testing.T) {
		postsByChannel := map[string][]*model.Post{
			"ch1": makePosts(5, "ch1"),
			"ch2": makePosts(5, "ch2"),
		}

		result, wasTruncated := truncatePostsProportionally(postsByChannel, 100)
		assert.False(t, wasTruncated)
		assert.Len(t, result["ch1"], 5)
		assert.Len(t, result["ch2"], 5)
	})

	t.Run("proportional distribution 60/40 split", func(t *testing.T) {
		// 60 posts in ch1, 40 posts in ch2, limit 50
		// Expected: ch1 gets ~30, ch2 gets ~20
		postsByChannel := map[string][]*model.Post{
			"ch1": makePosts(60, "ch1"),
			"ch2": makePosts(40, "ch2"),
		}

		result, wasTruncated := truncatePostsProportionally(postsByChannel, 50)
		assert.True(t, wasTruncated)
		// Proportional: ch1 = 60/100 * 50 = 30, ch2 = 40/100 * 50 = 20
		assert.Equal(t, 30, len(result["ch1"]))
		assert.Equal(t, 20, len(result["ch2"]))
	})

	t.Run("minimum 1 post per channel", func(t *testing.T) {
		// 3 channels: 1, 2, 100 posts, limit 10
		// Without minimum: ch1 = 0.1, ch2 = 0.2, ch3 = 9.7
		// With minimum: ch1 = 1, ch2 = 1, ch3 = 8
		postsByChannel := map[string][]*model.Post{
			"ch1": makePosts(1, "ch1"),
			"ch2": makePosts(2, "ch2"),
			"ch3": makePosts(100, "ch3"),
		}

		result, wasTruncated := truncatePostsProportionally(postsByChannel, 10)
		assert.True(t, wasTruncated)
		assert.Equal(t, 1, len(result["ch1"]), "ch1 should have minimum 1 post")
		assert.Equal(t, 1, len(result["ch2"]), "ch2 should have minimum 1 post (rounded from ~0.2)")
		assert.Equal(t, 9, len(result["ch3"]), "ch3 should get the bulk of posts")
	})

	t.Run("handles empty channels", func(t *testing.T) {
		postsByChannel := map[string][]*model.Post{
			"ch1":   makePosts(50, "ch1"),
			"empty": {},
		}

		result, wasTruncated := truncatePostsProportionally(postsByChannel, 25)
		assert.True(t, wasTruncated)
		assert.Len(t, result["ch1"], 25)
		assert.Len(t, result["empty"], 0)
	})

	t.Run("takes newest posts (beginning of slice)", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "newest", Message: "newest"},
			{Id: "middle", Message: "middle"},
			{Id: "oldest", Message: "oldest"},
		}
		postsByChannel := map[string][]*model.Post{
			"ch1": posts,
		}

		result, wasTruncated := truncatePostsProportionally(postsByChannel, 2)
		assert.True(t, wasTruncated)
		assert.Len(t, result["ch1"], 2)
		assert.Equal(t, "newest", result["ch1"][0].Id)
		assert.Equal(t, "middle", result["ch1"][1].Id)
	})
}

func TestEstimateTokens(t *testing.T) {
	t.Run("empty string", func(t *testing.T) {
		tokens := estimateTokens("")
		assert.Equal(t, 0, tokens)
	})

	t.Run("short text", func(t *testing.T) {
		// 4 chars = 1 token (ceiling)
		tokens := estimateTokens("test")
		assert.Equal(t, 1, tokens)
	})

	t.Run("longer text", func(t *testing.T) {
		// 20 chars -> (20+3)/4 = 5 tokens (ceiling division)
		tokens := estimateTokens("12345678901234567890")
		assert.Equal(t, 5, tokens)
	})

	t.Run("conservative ceiling division", func(t *testing.T) {
		// 5 chars -> (5+3)/4 = 2 tokens
		tokens := estimateTokens("hello")
		assert.Equal(t, 2, tokens)
	})
}

func TestEstimatePostTokens(t *testing.T) {
	t.Run("estimates tokens from post message", func(t *testing.T) {
		post := &model.Post{Message: "Hello world from Mattermost"} // 27 chars
		tokens := estimatePostTokens(post)
		// (27+3)/4 = 7 tokens
		assert.Equal(t, 7, tokens)
	})
}

func TestTruncateToTokenLimit(t *testing.T) {
	t.Run("no truncation when under limit", func(t *testing.T) {
		postsByChannel := map[string][]*model.Post{
			"ch1": {{Id: "1", Message: "short"}}, // ~2 tokens
			"ch2": {{Id: "2", Message: "short"}}, // ~2 tokens
		}

		result, wasTruncated := truncateToTokenLimit(postsByChannel, 1000)
		assert.False(t, wasTruncated)
		assert.Len(t, result["ch1"], 1)
		assert.Len(t, result["ch2"], 1)
	})

	t.Run("truncates to token limit", func(t *testing.T) {
		// Create posts with known token counts
		// 400 chars = ~100 tokens each
		longMessage := ""
		for i := 0; i < 400; i++ {
			longMessage += "x"
		}

		postsByChannel := map[string][]*model.Post{
			"ch1": {
				{Id: "1", Message: longMessage}, // ~100 tokens
				{Id: "2", Message: longMessage}, // ~100 tokens
			},
			"ch2": {
				{Id: "3", Message: longMessage}, // ~100 tokens
				{Id: "4", Message: longMessage}, // ~100 tokens
			},
		}
		// Total: ~400 tokens, limit: 200 tokens

		result, wasTruncated := truncateToTokenLimit(postsByChannel, 200)
		assert.True(t, wasTruncated)

		// Should have roughly half the posts
		totalPosts := len(result["ch1"]) + len(result["ch2"])
		assert.LessOrEqual(t, totalPosts, 2, "Should have at most 2 posts to stay under 200 tokens")
	})

	t.Run("removes from largest channel first", func(t *testing.T) {
		// 80 chars = ~20 tokens
		msg80 := ""
		for i := 0; i < 80; i++ {
			msg80 += "x"
		}

		postsByChannel := map[string][]*model.Post{
			"small": {
				{Id: "s1", Message: msg80}, // ~20 tokens
			},
			"large": {
				{Id: "l1", Message: msg80}, // ~20 tokens
				{Id: "l2", Message: msg80}, // ~20 tokens
				{Id: "l3", Message: msg80}, // ~20 tokens
			},
		}
		// Total: ~80 tokens, limit: 60 tokens
		// Should remove 1 post from "large" channel

		result, wasTruncated := truncateToTokenLimit(postsByChannel, 60)
		assert.True(t, wasTruncated)
		assert.Len(t, result["small"], 1, "Small channel should keep all posts")
		assert.Len(t, result["large"], 2, "Large channel should lose 1 post")
	})

	t.Run("handles empty channels", func(t *testing.T) {
		msg := "test message here"
		postsByChannel := map[string][]*model.Post{
			"ch1":   {{Id: "1", Message: msg}},
			"empty": {},
		}

		result, wasTruncated := truncateToTokenLimit(postsByChannel, 1000)
		assert.False(t, wasTruncated)
		assert.Len(t, result["ch1"], 1)
		assert.Len(t, result["empty"], 0)
	})

	t.Run("removes oldest posts (end of slice)", func(t *testing.T) {
		msg := "test message" // ~3 tokens
		postsByChannel := map[string][]*model.Post{
			"ch1": {
				{Id: "newest", Message: msg},
				{Id: "middle", Message: msg},
				{Id: "oldest", Message: msg},
			},
		}
		// ~9 tokens total, limit 6 tokens -> remove 1 post (oldest)

		result, wasTruncated := truncateToTokenLimit(postsByChannel, 6)
		assert.True(t, wasTruncated)
		assert.Len(t, result["ch1"], 2)
		assert.Equal(t, "newest", result["ch1"][0].Id)
		assert.Equal(t, "middle", result["ch1"][1].Id)
	})
}
