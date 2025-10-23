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
func (a *App) RewriteMessage(
	rctx request.CTX,
	userID string,
	message string,
	action model.AIRewriteAction,
	customPrompt string,
) (*model.AIRewriteResponse, *model.AppError) {
	// Validate action
	validActions := map[model.AIRewriteAction]bool{
		model.AIRewriteActionShorten:        true,
		model.AIRewriteActionElaborate:      true,
		model.AIRewriteActionImproveWriting: true,
		model.AIRewriteActionFixSpelling:    true,
		model.AIRewriteActionSimplify:       true,
		model.AIRewriteActionSummarize:      true,
		model.AIRewriteActionCustom:         true,
		model.AIRewriteActionMatchStyle:     true,
	}
	if !validActions[action] {
		return nil, model.NewAppError("RewriteMessage", "app.ai.rewrite.invalid_action", nil, fmt.Sprintf("invalid action: %s", action), 400)
	}

	var prompt, systemPrompt string

	// Handle style-based rewriting specially
	if action == model.AIRewriteActionMatchStyle {
		var appErr *model.AppError
		prompt, systemPrompt, appErr = a.getStyleBasedRewritePrompt(rctx, userID, message, customPrompt)
		if appErr != nil {
			return nil, appErr
		}
	} else {
		// Get prompts for other actions
		prompt, systemPrompt = getRewritePromptForAction(action, message, customPrompt)
	}

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
				Message: prompt,
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
	var aiResponse model.AIRewriteResponse

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
	return &aiResponse, nil
}

// getRewritePromptForAction returns the appropriate prompt and system prompt for the given rewrite action
func getRewritePromptForAction(action model.AIRewriteAction, message string, customPrompt string) (string, string) {
	systemPrompt := `You are a JSON API that rewrites text. Your response must be valid JSON only. Return this exact format: {"rewritten_text":"content"}. Do not use markdown, code blocks, or any formatting. Start with { and end with }.`

	if message == "" {
		return fmt.Sprintf(`Write according to these instructions: %s`, customPrompt), systemPrompt
	}

	var userPrompt string

	switch action {
	case model.AIRewriteActionCustom:
		userPrompt = fmt.Sprintf(`%s

%s`, customPrompt, message)

	case model.AIRewriteActionShorten:
		userPrompt = fmt.Sprintf(`Make this up to 2 to 3 times shorter: %s`, message)

	case model.AIRewriteActionElaborate:
		userPrompt = fmt.Sprintf(`Make this up to 2 to 3 times longer, using Markdown if necessary: %s`, message)

	case model.AIRewriteActionImproveWriting:
		userPrompt = fmt.Sprintf(`Improve this writing, using Markdown if necessary: %s`, message)

	case model.AIRewriteActionFixSpelling:
		userPrompt = fmt.Sprintf(`Fix spelling and grammar: %s`, message)

	case model.AIRewriteActionSimplify:
		userPrompt = fmt.Sprintf(`Simplify this: %s`, message)

	case model.AIRewriteActionSummarize:
		userPrompt = fmt.Sprintf(`Summarize this, using Markdown if necessary: %s`, message)

	default:
		userPrompt = message
	}

	return userPrompt, systemPrompt
}

// getStyleBasedRewritePrompt fetches user's profile and creates prompts for style-based rewriting
func (a *App) getStyleBasedRewritePrompt(c request.CTX, userID string, message string, customPrompt string) (string, string, *model.AppError) {
	// Fetch user
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return "", "", appErr
	}

	// Get profile from user props
	profileJSON, ok := user.Props[model.UserPropsKeyAIGeneratedProfile]
	if !ok || profileJSON == "" {
		return "", "", model.NewAppError("getStyleBasedRewritePrompt", "app.ai.rewrite.no_profile", nil, "User has not generated an AI profile", 404)
	}

	// Parse profile
	profile, err := model.AIGeneratedProfileFromJSON(profileJSON)
	if err != nil {
		return "", "", model.NewAppError("getStyleBasedRewritePrompt", "app.ai.rewrite.invalid_profile", nil, err.Error(), 500)
	}

	if profile.WritingStyleReport == "" {
		return "", "", model.NewAppError("getStyleBasedRewritePrompt", "app.ai.rewrite.empty_style_report", nil, "Profile has no writing style report", 500)
	}

	// System prompt
	systemPrompt := `You are a JSON API that rewrites or generates text. Your response must be valid JSON only. Return this exact format: {"rewritten_text":"content"}. Do not use markdown, code blocks, or any formatting. Start with { and end with }.`

	var userPrompt string

	if message == "" {
		// Generation mode (no existing text)
		if customPrompt == "" {
			userPrompt = fmt.Sprintf(`Generate a message in this writing style: %s`, profile.WritingStyleReport)
		} else {
			userPrompt = fmt.Sprintf(`Generate a message about: %s

Write in this style: %s`, customPrompt, profile.WritingStyleReport)
		}
	} else {
		// Rewrite mode (existing text)
		userPrompt = fmt.Sprintf(`Rewrite this text to match this writing style exactly. Preserve the meaning but adjust tone, vocabulary, sentence structure, and phrasing to match the style.

Writing Style: %s

Text to rewrite: %s`, profile.WritingStyleReport, message)
	}

	return userPrompt, systemPrompt, nil
}
