// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
<<<<<<< HEAD
	"encoding/json"
	"fmt"
	"strings"
	"time"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/client"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
=======
	"errors"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
>>>>>>> plugin-bridge-poc
)

// getAIClient returns an AI client for making requests to the AI plugin
func (a *App) getAIClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

<<<<<<< HEAD
// RewriteMessage rewrites a message using AI based on the specified action
func (a *App) RewriteMessage(rctx request.CTX, userID string, message string, action model.AIRewriteAction) (*model.AIRewriteResponse, *model.AppError) {
	// Validate inputs
	if message == "" {
		return nil, model.NewAppError("RewriteMessage", "app.ai.rewrite.invalid_message", nil, "message cannot be empty", 400)
	}

	// Validate action
	validActions := map[model.AIRewriteAction]bool{
		model.AIRewriteActionSuccinct:     true,
		model.AIRewriteActionProfessional: true,
		model.AIRewriteActionMarkdown:     true,
		model.AIRewriteActionLonger:       true,
	}
	if !validActions[action] {
		return nil, model.NewAppError("RewriteMessage", "app.ai.rewrite.invalid_action", nil, fmt.Sprintf("invalid action: %s", action), 400)
	}

	// Get prompts for the action
	userPrompt, systemPrompt := getRewritePromptForAction(action, message)

	// Create AI client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getAIClient(sessionUserID)

	// Prepare completion request in the format expected by the client
	completionRequest := agentclient.CompletionRequest{
		Posts: []agentclient.Post{
			{
				Role:    "system",
				Message: systemPrompt,
			},
			{
				Role:    "user",
				Message: userPrompt,
			},
		},
	}

	// Call the AI plugin using the client
	rctx.Logger().Debug("Calling AI agent for message rewrite",
		mlog.String("action", string(action)),
		mlog.String("user_id", userID),
		mlog.Int("message_length", len(message)),
	)

	completion, err := client.AgentCompletion("", completionRequest)
	if err != nil {
		rctx.Logger().Error("AI agent call failed",
			mlog.Err(err),
			mlog.String("action", string(action)),
		)
		return nil, model.NewAppError("RewriteMessage", "app.ai.rewrite.agent_call_failed", nil, err.Error(), 500)
	}

	// Parse the JSON response from the completion
	// The prompts instruct the AI to return JSON with "rewritten_text" field
	var aiResponse struct {
		RewrittenText string   `json:"rewritten_text"`
		ChangesMade   []string `json:"changes_made"`
	}

	if err := json.Unmarshal([]byte(completion), &aiResponse); err != nil {
		rctx.Logger().Error("Failed to parse AI response",
			mlog.Err(err),
			mlog.String("response", completion),
		)
		return nil, model.NewAppError("RewriteMessage", "app.ai.rewrite.parse_response_failed", nil, err.Error(), 500)
	}

	if aiResponse.RewrittenText == "" {
		return nil, model.NewAppError("RewriteMessage", "app.ai.rewrite.empty_response", nil, "", 500)
	}

	// Log success
	rctx.Logger().Debug("AI rewrite successful",
		mlog.String("action", string(action)),
		mlog.Int("original_length", len(message)),
		mlog.Int("rewritten_length", len(aiResponse.RewrittenText)),
		mlog.String("user_id", userID),
	)

	// Prepare response
	response := &model.AIRewriteResponse{
		RewrittenMessage: aiResponse.RewrittenText,
		OriginalMessage:  message,
		Action:           action,
	}

	return response, nil
}

// getRewritePromptForAction returns the appropriate prompt and system prompt for the given rewrite action
func getRewritePromptForAction(action model.AIRewriteAction, message string) (string, string) {
	switch action {
	case model.AIRewriteActionSuccinct:
		return fmt.Sprintf("Rewrite the following message to be more concise and succinct while preserving the core meaning and intent. Return your response as JSON with a 'rewritten_text' field containing the rewritten message:\n\n%s", message),
			"You are an expert at concise communication. Your task is to rewrite messages to be shorter and more direct while maintaining the essential meaning. Remove redundant words, simplify complex phrases, and get straight to the point. Keep the tone and formality level similar to the original. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks."

	case model.AIRewriteActionProfessional:
		return fmt.Sprintf("Rewrite the following message to be more professional and polished while maintaining the original intent. Return your response as JSON with a 'rewritten_text' field containing the rewritten message:\n\n%s", message),
			"You are a professional communication expert. Your task is to rewrite messages to be more professional, polished, and appropriate for business communication. Use professional language, proper grammar, and maintain a respectful tone. Avoid casual language, slang, or overly informal expressions. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks."

	case model.AIRewriteActionMarkdown:
		return fmt.Sprintf("Format the following message using Markdown to improve its readability and structure. Use appropriate Markdown features like headers, lists, bold, italic, code blocks, etc. Return your response as JSON with a 'rewritten_text' field containing the formatted message:\n\n%s", message),
			"You are a Markdown formatting expert. Your task is to take plain text messages and format them nicely using Markdown syntax, including headers (##), bullet points, numbered lists, bold, italic, inline code, and code blocks. Make the message well-structured and easy to read. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks."

	case model.AIRewriteActionLonger:
		return fmt.Sprintf("Expand and elaborate on the following message to make it more detailed and comprehensive. Add relevant context, examples, and explanations. Return your response as JSON with a 'rewritten_text' field containing the expanded message:\n\n%s", message),
			"You are an expert at elaborative communication. Your task is to expand brief messages into more detailed, comprehensive versions by adding relevant context, examples, and thorough explanations. Maintain the original intent while increasing informativeness and completeness. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks."

	default:
		return message, "You are a helpful assistant. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks."
	}
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
=======
// Placeholder - NewClientFromApp needs to be called to initialize the AI client in order to ensure everything lines up from a build perspective, and getAIClient can't be uncalled because of linter
// TODO: Remove once a proper feature actually uses the AI Client
func (a *App) AIClient() error {
	aiClient := a.getAIClient("")
	if aiClient == nil {
		return errors.New("failed to get AI client")
	}
	return nil
>>>>>>> plugin-bridge-poc
}
