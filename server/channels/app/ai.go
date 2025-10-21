// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/client"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// getAIClient returns an AI client for making requests to the AI plugin
func (a *App) getAIClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

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
			"You are an expert at concise communication. Your task is to rewrite messages to be shorter and more direct while maintaining the essential meaning. Remove redundant words, simplify complex phrases, and get straight to the point. Keep the tone and formality level similar to the original. You MUST respond with valid JSON only, no additional text."

	case model.AIRewriteActionProfessional:
		return fmt.Sprintf("Rewrite the following message to be more professional and polished while maintaining the original intent. Return your response as JSON with a 'rewritten_text' field containing the rewritten message:\n\n%s", message),
			"You are a professional communication expert. Your task is to rewrite messages to be more professional, polished, and appropriate for business communication. Use professional language, proper grammar, and maintain a respectful tone. Avoid casual language, slang, or overly informal expressions. You MUST respond with valid JSON only, no additional text."

	case model.AIRewriteActionMarkdown:
		return fmt.Sprintf("Format the following message using Markdown to improve its readability and structure. Use appropriate Markdown features like headers, lists, bold, italic, code blocks, etc. Return your response as JSON with a 'rewritten_text' field containing the formatted message:\n\n%s", message),
			"You are a Markdown formatting expert. Your task is to take plain text messages and format them nicely using Markdown syntax. Use headers (##) for sections, bullet points or numbered lists for items, **bold** for emphasis, *italic* for subtle emphasis, `code` for technical terms, and ```code blocks``` for longer code snippets. Make the message well-structured and easy to read. You MUST respond with valid JSON only, no additional text."

	case model.AIRewriteActionLonger:
		return fmt.Sprintf("Expand and elaborate on the following message to make it more detailed and comprehensive. Add relevant context, examples, and explanations. Return your response as JSON with a 'rewritten_text' field containing the expanded message:\n\n%s", message),
			"You are an expert at elaborative communication. Your task is to expand brief messages into more detailed, comprehensive versions. Add relevant context, provide examples where appropriate, and explain concepts more thoroughly. Maintain the original intent while making the message more informative and complete. You MUST respond with valid JSON only, no additional text."

	default:
		return message, "You are a helpful assistant. You MUST respond with valid JSON only, no additional text."
	}
}
