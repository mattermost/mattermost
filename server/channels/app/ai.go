// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// getAIClient returns an AI client for making requests to the AI plugin
func (a *App) getAIClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// SummarizePosts generates an AI summary of posts with highlights and action items
func (a *App) SummarizePosts(rctx request.CTX, userID string, posts []*model.Post, channelName, teamName string) (*model.AISummaryResponse, *model.AppError) {
	if len(posts) == 0 {
		return &model.AISummaryResponse{Highlights: []string{}, ActionItems: []string{}}, nil
	}

	// Get site URL for permalink generation
	siteURL := a.GetSiteURL()

	// Build conversation context from posts and collect post IDs
	conversationText, postIDs := buildConversationTextWithIDs(posts)

	systemPrompt := "You are an expert at analyzing team conversations and extracting key information. Your task is to summarize a conversation from a Mattermost channel, identifying the most important highlights and any actionable items. Return ONLY valid JSON with 'highlights' and 'action_items' keys, each containing an array of strings. If there are no highlights or action items, return empty arrays. Do not make up information - only include items explicitly mentioned in the conversation."

	userPrompt := fmt.Sprintf(`Analyze the following conversation from the "%s" channel and provide a summary.

Site URL: %s
Team Name: %s

Conversation:
%s

Available Post IDs: %s

Return a JSON object with:
- "highlights": array of key discussion points, decisions, or important information
- "action_items": array of tasks, todos, or action items mentioned

IMPORTANT INSTRUCTIONS:
1. When your summary includes a user's username, prepend an @ symbol to the username. For example if you return a highlight with text '<username> sent an update about project xyz', where <username> is 'john.smith', you should phrase is as '@john.smith sent an update about project xyz'.

2. For EACH highlight and action item, you MUST append a permalink to cite the source. The permalink should reference the most relevant post from the conversation. Format the permalink at the END of each item as: [PERMALINK:%s/%s/pl/<POST_ID>] where <POST_ID> is one of the available post IDs provided above. Choose the post ID that is most relevant to that specific highlight or action item.

Example format: "Team decided to migrate to microservices architecture [PERMALINK:%s/%s/pl/abc123xyz]"

Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks.`, channelName, siteURL, teamName, conversationText, strings.Join(postIDs, ", "), siteURL, teamName, siteURL, teamName)

	// Create AI client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getAIClient(sessionUserID)

	completionRequest := agentclient.CompletionRequest{
		Posts: []agentclient.Post{
			{Role: "system", Message: systemPrompt},
			{Role: "user", Message: userPrompt},
		},
	}

	rctx.Logger().Debug("Calling AI agent for post summarization",
		mlog.String("channel_name", channelName),
		mlog.String("user_id", userID),
		mlog.Int("post_count", len(posts)),
	)

	completion, err := client.AgentCompletion("", completionRequest)
	if err != nil {
		rctx.Logger().Error("AI agent call failed for summarization",
			mlog.Err(err),
			mlog.String("channel_name", channelName),
		)
		return nil, model.NewAppError("SummarizePosts", "app.ai.summarize.agent_call_failed", nil, err.Error(), 500)
	}

	var summary model.AISummaryResponse
	if err := json.Unmarshal([]byte(completion), &summary); err != nil {
		rctx.Logger().Error("Failed to parse AI summarization response",
			mlog.Err(err),
			mlog.String("response", completion),
		)
		return nil, model.NewAppError("SummarizePosts", "app.ai.summarize.parse_failed", nil, err.Error(), 500)
	}

	// Ensure arrays are never nil
	if summary.Highlights == nil {
		summary.Highlights = []string{}
	}
	if summary.ActionItems == nil {
		summary.ActionItems = []string{}
	}

	rctx.Logger().Debug("AI summarization successful",
		mlog.String("channel_name", channelName),
		mlog.Int("highlights_count", len(summary.Highlights)),
		mlog.Int("action_items_count", len(summary.ActionItems)),
	)

	return &summary, nil
}

func buildConversationText(posts []*model.Post) string {
	text, _ := buildConversationTextWithIDs(posts)
	return text
}

func buildConversationTextWithIDs(posts []*model.Post) (string, []string) {
	var sb strings.Builder
	postIDs := make([]string, 0, len(posts))

	for _, post := range posts {
		// Collect post ID
		postIDs = append(postIDs, post.Id)

		// Posts should have Username populated by the caller
		// For posts without username, use UserId as fallback
		username := ""
		if usernameProp := post.GetProp("username"); usernameProp != nil {
			if usernameStr, ok := usernameProp.(string); ok {
				username = usernameStr
			}
		}
		if username == "" {
			username = post.UserId
		}
		sb.WriteString(fmt.Sprintf("[%s] %s (Post ID: %s): %s\n",
			time.UnixMilli(post.CreateAt).Format("15:04"),
			username,
			post.Id,
			post.Message))
	}
	return sb.String(), postIDs
}

// GenerateRecapTitle generates a short title for the recap
func (a *App) GenerateRecapTitle(rctx request.CTX, userID string, channelNames []string) (string, *model.AppError) {
	systemPrompt := "You are an expert at creating concise, descriptive titles. Create a title that is at most 5 words and captures the essence of the channels being summarized. Return ONLY the title text with no quotes, formatting, or additional text."

	userPrompt := fmt.Sprintf("Create a short title (max 5 words) for a recap that summarizes these channels: %s", strings.Join(channelNames, ", "))

	// Create AI client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getAIClient(sessionUserID)

	completionRequest := agentclient.CompletionRequest{
		Posts: []agentclient.Post{
			{Role: "system", Message: systemPrompt},
			{Role: "user", Message: userPrompt},
		},
	}

	completion, err := client.AgentCompletion("", completionRequest)
	if err != nil {
		return "", model.NewAppError("GenerateRecapTitle", "app.ai.title.agent_call_failed", nil, err.Error(), 500)
	}

	title := strings.TrimSpace(completion)
	if title == "" {
		title = "Channel Recap"
	}

	return title, nil
}
