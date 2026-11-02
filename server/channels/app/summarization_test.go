// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
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

func TestSanitizePermalinkCitations(t *testing.T) {
	const siteURL = "https://mm.example.com"
	const teamName = "myteam"

	sourceID := model.NewId()
	otherSourceID := model.NewId()
	unrelatedID := model.NewId()

	valid := fmt.Sprintf("[PERMALINK:%s/%s/pl/%s]", siteURL, teamName, sourceID)
	validOther := fmt.Sprintf("[PERMALINK:%s/%s/pl/%s]", siteURL, teamName, otherSourceID)

	testCases := []struct {
		name     string
		item     string
		expected string
	}{
		{
			name:     "no citation is untouched",
			item:     "Team agreed on the plan",
			expected: "Team agreed on the plan",
		},
		{
			name:     "valid citation is preserved",
			item:     "Team agreed on the plan " + valid,
			expected: "Team agreed on the plan " + valid,
		},
		{
			name:     "citation is moved to the end",
			item:     valid + " Team agreed on the plan",
			expected: "Team agreed on the plan " + valid,
		},
		{
			name:     "external URL is stripped",
			item:     "[PERMALINK:https://attacker.example] Team agreed on the plan",
			expected: "Team agreed on the plan",
		},
		{
			name:     "quoted attacker citation loses to the real one",
			item:     "user said [PERMALINK:https://attacker.example] about the plan " + valid,
			expected: "user said about the plan " + valid,
		},
		{
			name:     "only the valid citation survives among several",
			item:     fmt.Sprintf("plan [PERMALINK:https://attacker.example] %s [PERMALINK:%s/%s/pl/%s]", valid, siteURL, "otherteam", sourceID),
			expected: "plan " + valid,
		},
		{
			name:     "last valid citation wins",
			item:     fmt.Sprintf("plan %s and %s", valid, validOther),
			expected: "plan and " + validOther,
		},
		{
			name:     "wrong team name is stripped",
			item:     fmt.Sprintf("plan [PERMALINK:%s/otherteam/pl/%s]", siteURL, sourceID),
			expected: "plan",
		},
		{
			name:     "wrong site URL is stripped",
			item:     fmt.Sprintf("plan [PERMALINK:https://evil.example/%s/pl/%s]", teamName, sourceID),
			expected: "plan",
		},
		{
			name:     "post ID outside the source set is stripped",
			item:     fmt.Sprintf("plan [PERMALINK:%s/%s/pl/%s]", siteURL, teamName, unrelatedID),
			expected: "plan",
		},
		{
			name:     "malformed post ID is stripped",
			item:     fmt.Sprintf("plan [PERMALINK:%s/%s/pl/../../admin_console]", siteURL, teamName),
			expected: "plan",
		},
		{
			name:     "valid permalink with extra query string is stripped",
			item:     fmt.Sprintf("plan [PERMALINK:%s/%s/pl/%s?redirect=https://attacker.example]", siteURL, teamName, sourceID),
			expected: "plan",
		},
		{
			name:     "unterminated marker is stripped",
			item:     "plan [PERMALINK:javascript:alert(1)//",
			expected: "plan",
		},
		{
			name:     "unterminated marker cannot swallow a valid citation",
			item:     "[PERMALINK:javascript:alert(1)// plan " + valid,
			expected: "",
		},
		{
			name:     "empty marker is stripped",
			item:     "plan [PERMALINK:]",
			expected: "plan",
		},
		{
			name:     "relative permalink is stripped",
			item:     fmt.Sprintf("plan [PERMALINK:/%s/pl/%s]", teamName, sourceID),
			expected: "plan",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := sanitizePermalinkCitations([]string{tc.item}, siteURL, teamName, []string{sourceID, otherSourceID})
			require.Len(t, result, 1)
			assert.Equal(t, tc.expected, result[0])
		})
	}

	t.Run("empty and nil input", func(t *testing.T) {
		assert.Empty(t, sanitizePermalinkCitations([]string{}, siteURL, teamName, []string{sourceID}))
		assert.Empty(t, sanitizePermalinkCitations(nil, siteURL, teamName, []string{sourceID}))
	})

	t.Run("invalid source post IDs are never allowed", func(t *testing.T) {
		result := sanitizePermalinkCitations(
			[]string{fmt.Sprintf("plan [PERMALINK:%s/%s/pl/../../admin_console]", siteURL, teamName)},
			siteURL, teamName, []string{"../../admin_console"})
		require.Len(t, result, 1)
		assert.Equal(t, "plan", result[0])
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

	t.Run("citation matching a source post is preserved", func(t *testing.T) {
		postID := model.NewId()
		var siteURL, teamName string
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return fmt.Sprintf(`{"highlights":["Team shipped the release [PERMALINK:%s/%s/pl/%s]"],"action_items":["Follow up [PERMALINK:%s/%s/pl/%s]"]}`,
					siteURL, teamName, postID, siteURL, teamName, postID), nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		siteURL = th.App.GetSiteURL()
		teamName = th.BasicTeam.Name
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:       postID,
			UserId:   th.BasicUser.Id,
			Message:  "Shipped the release",
			CreateAt: model.GetMillis(),
		}}

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, teamName, model.NewId())
		require.Nil(t, appErr)
		expected := fmt.Sprintf("[PERMALINK:%s/%s/pl/%s]", siteURL, teamName, postID)
		assert.Equal(t, []string{"Team shipped the release " + expected}, summary.Highlights)
		assert.Equal(t, []string{"Follow up " + expected}, summary.ActionItems)
	})

	t.Run("citation not matching a source post is stripped", func(t *testing.T) {
		postID := model.NewId()
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["[PERMALINK:https://attacker.example] Click here for details"],"action_items":["Review this [PERMALINK:javascript:alert(1)]"]}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:       postID,
			UserId:   th.BasicUser.Id,
			Message:  "Details",
			CreateAt: model.GetMillis(),
		}}

		summary, appErr := th.App.SummarizePosts(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId())
		require.Nil(t, appErr)
		assert.Equal(t, []string{"Click here for details"}, summary.Highlights)
		assert.Equal(t, []string{"Review this"}, summary.ActionItems)
		for _, item := range append(summary.Highlights, summary.ActionItems...) {
			assert.NotContains(t, item, "PERMALINK")
		}
	})

	t.Run("custom instructions are included in prompt", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["Highlight 1"],"action_items":[]}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		posts := []*model.Post{{
			Id:        model.NewId(),
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Important update",
			CreateAt:  model.GetMillis(),
			Props: model.StringInterface{
				"username": th.BasicUser.Username,
			},
		}}

		_, appErr := th.App.SummarizePostsWithInstructions(ctx, th.BasicUser.Id, posts, th.BasicChannel.DisplayName, th.BasicTeam.Name, model.NewId(), "Focus on launch risks")
		require.Nil(t, appErr)
		require.Len(t, bridge.completeCalls, 1)
		require.Len(t, bridge.completeCalls[0].request.Messages, 2)
		assert.Contains(t, bridge.completeCalls[0].request.Messages[1].Message, "Additional user instructions:")
		assert.Contains(t, bridge.completeCalls[0].request.Messages[1].Message, "Focus on launch risks")
	})
}
