// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CallAIPlugin is a convenience wrapper for calling the Agents plugin via RESTful HTTP endpoints
// It handles plugin availability checks and provides a cleaner API
func (a *App) CallAIPlugin(rctx request.CTX, endpoint string, req model.AIRequest) ([]byte, *model.AppError) {
	// Check if AI plugin is available
	pluginEnv := a.GetPluginsEnvironment()
	if pluginEnv == nil {
		return nil, model.NewAppError("CallAIPlugin", "app.ai.plugins_not_initialized", nil, "", 500)
	}

	// Marshal request data
	requestJSON, err := json.Marshal(req.Data)
	if err != nil {
		return nil, model.NewAppError("CallAIPlugin", "app.ai.marshal_request_failed", nil, err.Error(), 500)
	}

	// Call the plugin via bridge
	rctx.Logger().Debug("Calling AI plugin",
		mlog.String("endpoint", endpoint),
		mlog.Int("request_size", len(requestJSON)),
		mlog.Bool("has_schema", req.ResponseSchema != nil),
	)

	responseJSON, err := a.CallPluginFromCore(rctx, model.AIPluginID, endpoint, requestJSON, req.ResponseSchema)
	if err != nil {
		rctx.Logger().Error("AI plugin call failed",
			mlog.Err(err),
			mlog.String("endpoint", endpoint),
		)
		// Check if it's already an AppError
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("CallAIPlugin", "app.ai.plugin_call_failed", nil, err.Error(), 500)
	}

	rctx.Logger().Debug("AI plugin call succeeded",
		mlog.String("endpoint", endpoint),
		mlog.Int("response_size", len(responseJSON)),
	)

	return responseJSON, nil
}

// RewriteMessage rewrites a message using AI based on the specified action
func (a *App) RewriteMessage(
	rctx request.CTX,
	userID string,
	message string,
	action model.AIRewriteAction,
	customPrompt string,
) (string, *model.AppError) {
	// Validate inputs
	if message == "" {
		return "", model.NewAppError("RewriteMessage", "app.ai.rewrite.invalid_message", nil, "message cannot be empty", 400)
	}

	// Validate action
	validActions := map[model.AIRewriteAction]bool{
		model.AIRewriteActionShorten:        true,
		model.AIRewriteActionElaborate:      true,
		model.AIRewriteActionImproveWriting: true,
		model.AIRewriteActionFixSpelling:    true,
		model.AIRewriteActionSimplify:       true,
		model.AIRewriteActionSummarize:      true,
	}
	if !validActions[action] {
		return "", model.NewAppError("RewriteMessage", "app.ai.rewrite.invalid_action", nil, fmt.Sprintf("invalid action: %s", action), 400)
	}

	// Get prompts for the action
	prompt, systemPrompt := getRewritePromptForAction(action, message, customPrompt)

	// Prepare AI request
	aiRequest := map[string]any{
		"prompt": prompt,
		"context": map[string]any{
			"system_prompt": systemPrompt,
			"user_id":       userID,
			"action":        action,
		},
		"max_tokens": 2000,
	}

	// Define expected response schema for structured output
	responseSchema := []byte(`{
		"type": "object",
		"properties": {
			"rewritten_text": {
				"type": "string",
				"description": "The rewritten message text"
			},
			"changes_made": {
				"type": "array",
				"items": {"type": "string"},
				"description": "Brief list of key changes made",
				"maxItems": 5
			}
		},
		"required": ["rewritten_text"]
	}`)

	// Call the AI plugin
	responseJSON, appErr := a.CallAIPlugin(rctx, model.AIEndpointCompletion, model.AIRequest{
		Data:           aiRequest,
		ResponseSchema: responseSchema,
	})
	if appErr != nil {
		return "", appErr
	}

	// Parse the AI response
	var aiResponse struct {
		RewrittenText string   `json:"rewritten_text"`
		ChangesMade   []string `json:"changes_made"`
	}

	if err := json.Unmarshal(responseJSON, &aiResponse); err != nil {
		rctx.Logger().Error("Failed to parse AI response",
			mlog.Err(err),
			mlog.String("response", string(responseJSON)),
		)
		return "", model.NewAppError("RewriteMessage", "app.ai.rewrite.parse_response_failed", nil, err.Error(), 500)
	}

	if aiResponse.RewrittenText == "" {
		return "", model.NewAppError("RewriteMessage", "app.ai.rewrite.empty_response", nil, "", 500)
	}

	// Log success
	rctx.Logger().Debug("AI rewrite successful",
		mlog.String("action", string(action)),
		mlog.Int("original_length", len(message)),
		mlog.Int("rewritten_length", len(aiResponse.RewrittenText)),
		mlog.String("user_id", userID),
	)
	return aiResponse.RewrittenText, nil
}

// getRewritePromptForAction returns the appropriate prompt and system prompt for the given rewrite action
func getRewritePromptForAction(action model.AIRewriteAction, message string, customPrompt string) (string, string) {
	switch action {
	case model.AIRewriteActionCustom:
		return fmt.Sprintf("Rewrite the following message according to the custom instructions: %s\n\nMessage to rewrite:\n%s", customPrompt, message),
			"You are a helpful assistant that follows custom instructions precisely. Your task is to rewrite the given message according to the specific custom instructions provided. Maintain the original intent while applying the requested changes. You MUST response with just the rewritten message, no additional text."

	case model.AIRewriteActionShorten:
		return fmt.Sprintf("Rewrite the following message to be more concise and succinct while preserving the core meaning and intent. Return your response as JSON with a 'rewritten_text' field containing the rewritten message:\n\n%s", message),
			"You are an expert at concise communication. Your task is to rewrite messages to be shorter and more direct while maintaining the essential meaning. Remove redundant words, simplify complex phrases, and get straight to the point. Keep the tone and formality level similar to the original. You MUST response with just the rewritten message, no additional text."

	case model.AIRewriteActionElaborate:
		return fmt.Sprintf("Expand and elaborate on the following message to make it more detailed and comprehensive. Add relevant context, examples, and explanations. Return your response as JSON with a 'rewritten_text' field containing the expanded message:\n\n%s", message),
			"You are an expert at elaborative communication. Your task is to expand brief messages into more detailed, comprehensive versions. Add relevant context, provide examples where appropriate, and explain concepts more thoroughly. Maintain the original intent while making the message more informative and complete. You MUST response with just the rewritten message, no additional text."

	case model.AIRewriteActionImproveWriting:
		return fmt.Sprintf("Rewrite the following message to improve its writing quality, clarity, and professionalism while maintaining the original intent. Return your response as JSON with a 'rewritten_text' field containing the improved message:\n\n%s", message),
			"You are a professional writing expert. Your task is to improve the writing quality, clarity, and professionalism of messages. Fix grammar issues, improve sentence structure, enhance clarity, and make the writing more engaging and professional. Maintain the original tone and intent. You MUST response with just the rewritten message, no additional text."

	case model.AIRewriteActionFixSpelling:
		return fmt.Sprintf("Fix spelling and grammar errors in the following message while preserving the original meaning and tone. Return your response as JSON with a 'rewritten_text' field containing the corrected message:\n\n%s", message),
			"You are a spelling and grammar expert. Your task is to identify and correct spelling mistakes, grammatical errors, and typos in the given message. Preserve the original meaning, tone, and style while ensuring the text is error-free. You MUST response with just the rewritten message, no additional text."

	case model.AIRewriteActionSimplify:
		return fmt.Sprintf("Simplify the following message to make it easier to understand while preserving the core meaning. Use simpler words and clearer sentence structure. Return your response as JSON with a 'rewritten_text' field containing the simplified message:\n\n%s", message),
			"You are an expert at simplifying complex communication. Your task is to rewrite messages using simpler language, clearer sentence structure, and more accessible vocabulary. Make the content easier to understand for a broader audience while maintaining the original meaning and intent. You MUST response with just the rewritten message, no additional text."

	case model.AIRewriteActionSummarize:
		return fmt.Sprintf("Create a concise summary of the following message, capturing the key points and main ideas. Return your response as JSON with a 'rewritten_text' field containing the summary:\n\n%s", message),
			"You are an expert at creating concise summaries. Your task is to extract the key points, main ideas, and essential information from the given message and present them in a clear, concise summary. Focus on the most important content while maintaining accuracy. You MUST response with just the rewritten message, no additional text."

	default:
		return message, "You are a helpful assistant. You MUST response with just the rewritten message, no additional text."
	}
}
