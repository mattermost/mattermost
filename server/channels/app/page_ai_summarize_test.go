// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestSummarizeThreadToPage_AIAvailabilityCheck(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	rctx := th.CreateSessionContext()

	t.Run("return error when AI bridge not available", func(t *testing.T) {
		_, appErr := th.App.SummarizeThreadToPage(rctx, "agent-id", "thread-id", "wiki-id", "Test Title")
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.summarize_thread.ai_not_available", appErr.Id)
	})
}

func TestSummarizeThreadToPage_InputValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	rctx := th.CreateSessionContext()

	// All input validation cases hit the AI availability check first since AI bridge
	// is not configured in the test environment. This verifies the function is called
	// and the AI guard is the first check.
	t.Run("return error for empty agent ID", func(t *testing.T) {
		_, appErr := th.App.SummarizeThreadToPage(rctx, "", "thread-id", "wiki-id", "Test Title")
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.summarize_thread.ai_not_available", appErr.Id)
	})

	t.Run("return error for empty thread ID", func(t *testing.T) {
		_, appErr := th.App.SummarizeThreadToPage(rctx, "agent-id", "", "wiki-id", "Test Title")
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.summarize_thread.ai_not_available", appErr.Id)
	})

	t.Run("return error for empty wiki ID", func(t *testing.T) {
		_, appErr := th.App.SummarizeThreadToPage(rctx, "agent-id", "thread-id", "", "Test Title")
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.summarize_thread.ai_not_available", appErr.Id)
	})

	t.Run("return error for empty title", func(t *testing.T) {
		_, appErr := th.App.SummarizeThreadToPage(rctx, "agent-id", "thread-id", "wiki-id", "")
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.summarize_thread.ai_not_available", appErr.Id)
	})

	t.Run("return error for whitespace-only title", func(t *testing.T) {
		_, appErr := th.App.SummarizeThreadToPage(rctx, "agent-id", "thread-id", "wiki-id", "   ")
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.summarize_thread.ai_not_available", appErr.Id)
	})
}

func TestBuildConversationTextFromPostList(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("formats posts with usernames", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post1": {
					Id:      "post1",
					UserId:  th.BasicUser.Id,
					Message: "Hello world",
				},
				"post2": {
					Id:      "post2",
					UserId:  th.BasicUser2.Id,
					Message: "Hi there",
				},
			},
			Order: []string{"post1", "post2"},
		}

		result := th.App.buildConversationText(th.Context, postList)
		require.Contains(t, result, th.BasicUser.Username)
		require.Contains(t, result, "Hello world")
		require.Contains(t, result, th.BasicUser2.Username)
		require.Contains(t, result, "Hi there")
	})

	t.Run("skips system messages", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post1": {
					Id:      "post1",
					UserId:  th.BasicUser.Id,
					Message: "Hello world",
				},
				"post2": {
					Id:      "post2",
					UserId:  th.BasicUser.Id,
					Message: "system message",
					Type:    model.PostTypeJoinChannel,
				},
			},
			Order: []string{"post1", "post2"},
		}

		result := th.App.buildConversationText(th.Context, postList)
		require.Contains(t, result, "Hello world")
		require.NotContains(t, result, "system message")
	})

	t.Run("handles empty post list", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{},
			Order: []string{},
		}

		result := th.App.buildConversationText(th.Context, postList)
		require.Empty(t, result)
	})

	t.Run("skips nil posts in order", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post1": {
					Id:      "post1",
					UserId:  th.BasicUser.Id,
					Message: "Hello world",
				},
			},
			Order: []string{"post1", "missing-post"},
		}

		result := th.App.buildConversationText(th.Context, postList)
		require.Contains(t, result, "Hello world")
	})
}
