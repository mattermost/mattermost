// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildConversationText(t *testing.T) {
	t.Run("build conversation with posts", func(t *testing.T) {
		posts := []*model.Post{
			{
				Id:       model.NewId(),
				Message:  "Hello world",
				UserId:   "user1",
				CreateAt: 1234567890000,
				Props: model.StringInterface{
					"username": "john_doe",
				},
			},
			{
				Id:       model.NewId(),
				Message:  "How are you?",
				UserId:   "user2",
				CreateAt: 1234567895000,
				Props: model.StringInterface{
					"username": "jane_smith",
				},
			},
		}

		result, _ := buildConversationTextWithIDs(posts)
		assert.Contains(t, result, "john_doe")
		assert.Contains(t, result, "jane_smith")
		assert.Contains(t, result, "Hello world")
		assert.Contains(t, result, "How are you?")
	})

	t.Run("build conversation with posts without username", func(t *testing.T) {
		posts := []*model.Post{
			{
				Id:       model.NewId(),
				Message:  "Test message",
				UserId:   "user123",
				CreateAt: 1234567890000,
				Props:    model.StringInterface{},
			},
		}

		result, _ := buildConversationTextWithIDs(posts)
		// Should fallback to user ID when no username prop
		assert.Contains(t, result, "user123")
		assert.Contains(t, result, "Test message")
	})

	t.Run("build conversation with empty posts", func(t *testing.T) {
		posts := []*model.Post{}
		result, _ := buildConversationTextWithIDs(posts)
		assert.Equal(t, "", result)
	})
}

func TestSummarizePosts(t *testing.T) {
	t.Run("successful recap completion parsing", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["Highlight 1"],"action_items":["Action 1"]}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:       model.NewId(),
			UserId:   th.BasicUser.Id,
			Message:  "Important update",
			CreateAt: model.GetMillis(),
			Props: model.StringInterface{
				"username": th.BasicUser.Username,
			},
		}}

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId())
		require.Nil(t, appErr)
		require.NotNil(t, summary)
		assert.Equal(t, []string{"Highlight 1"}, summary.Highlights)
		assert.Equal(t, []string{"Action 1"}, summary.ActionItems)
		require.Len(t, bridge.completeCalls, 1)
		assert.Equal(t, BridgeOperationRecapSummary, bridge.completeCalls[0].request.Operation)
		assert.Equal(t, th.BasicUser.Id, bridge.completeCalls[0].sessionUserID)
		assert.Equal(t, th.BasicUser.Id, bridge.completeCalls[0].request.UserID)
	})

	t.Run("null arrays normalize to empty slices", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":null,"action_items":null}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:       model.NewId(),
			UserId:   th.BasicUser.Id,
			Message:  "Need to follow up",
			CreateAt: model.GetMillis(),
			Props: model.StringInterface{
				"username": th.BasicUser.Username,
			},
		}}

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId())
		require.Nil(t, appErr)
		require.NotNil(t, summary)
		assert.Empty(t, summary.Highlights)
		assert.Empty(t, summary.ActionItems)
		assert.NotNil(t, summary.Highlights)
		assert.NotNil(t, summary.ActionItems)
	})

	t.Run("bridge error returns agent call failed", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return "", errors.New("bridge failed")
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:       model.NewId(),
			UserId:   th.BasicUser.Id,
			Message:  "Need help",
			CreateAt: model.GetMillis(),
			Props: model.StringInterface{
				"username": th.BasicUser.Username,
			},
		}}

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId())
		require.Nil(t, summary)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.ai.summarize.agent_call_failed", appErr.Id)
	})

	t.Run("invalid json returns parse failed", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return "{invalid json", nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:       model.NewId(),
			UserId:   th.BasicUser.Id,
			Message:  "Broken payload",
			CreateAt: model.GetMillis(),
			Props: model.StringInterface{
				"username": th.BasicUser.Username,
			},
		}}

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId())
		require.Nil(t, summary)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.ai.summarize.parse_failed", appErr.Id)
	})

	t.Run("empty posts short circuit without bridge call", func(t *testing.T) {
		bridge := &testAgentsBridge{}
		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, []*model.Post{}, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId())
		require.Nil(t, appErr)
		require.NotNil(t, summary)
		assert.Empty(t, summary.Highlights)
		assert.Empty(t, summary.ActionItems)
		assert.Len(t, bridge.completeCalls, 0)
	})
}
