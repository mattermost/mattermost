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
) (string, *model.AppError) {
	// Validate action
	validActions := map[model.AIRewriteAction]bool{
		model.AIRewriteActionShorten:        true,
		model.AIRewriteActionElaborate:      true,
		model.AIRewriteActionImproveWriting: true,
		model.AIRewriteActionFixSpelling:    true,
		model.AIRewriteActionSimplify:       true,
		model.AIRewriteActionSummarize:      true,
		model.AIRewriteActionCustom:         true,
	}
	if !validActions[action] {
		return "", model.NewAppError("RewriteMessage", "app.ai.rewrite.invalid_action", nil, fmt.Sprintf("invalid action: %s", action), 400)
	}

	// Get prompts for the action
	prompt, systemPrompt := getRewritePromptForAction(action, message, customPrompt)

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
		return "", model.NewAppError("RewriteMessage", "app.ai.rewrite.agent_call_failed", nil, err.Error(), 500)
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

	if message == "" {
		return fmt.Sprintf("Create a new message according to the custom instructions: %s", customPrompt),
			"You are a helpful assistant that follows custom instructions precisely. Your task is to rewrite the given message according to the specific custom instructions provided. Maintain the original intent while applying the requested changes. You MUST response with just the rewritten message, no additional text. Return your response as JSON with a 'rewritten_text' field containing the message. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."
	}

	switch action {
	case model.AIRewriteActionCustom:
		return fmt.Sprintf("Rewrite the following message according to the custom instructions: %s\n\nMessage to rewrite:\n%s", customPrompt, message),
			"You are a helpful assistant that follows custom instructions precisely. Your task is to rewrite the given message according to the specific custom instructions provided. Maintain the original intent while applying the requested changes. You MUST response with just the rewritten message, no additional text. Return your response as JSON with a 'rewritten_text' field containing the rewritten message. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	case model.AIRewriteActionShorten:
		return fmt.Sprintf("Rewrite the following message to be more concise and succinct while preserving the core meaning and intent. Return your response as JSON with a 'rewritten_text' field containing the rewritten message:\n\n%s", message),
			"You are an expert at concise communication. Your task is to rewrite messages to be shorter and more direct while maintaining the essential meaning. Remove redundant words, simplify complex phrases, and get straight to the point. Keep the tone and formality level similar to the original. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	case model.AIRewriteActionElaborate:
		return fmt.Sprintf("Expand and elaborate on the following message to make it more detailed and comprehensive. Add relevant context, examples, and explanations. Do not extend the message to be more than 2 to 3 times longer than the original message. If necessary, use appropriate Markdown features like headers, lists, bold, italic, code blocks, etc. to improve readability and structure. Return your response as JSON with a 'rewritten_text' field containing the expanded message:\n\n%s", message),
			"You are an expert at elaborative communication. Your task is to expand brief messages into more detailed, comprehensive versions by adding relevant context, examples, and thorough explanations. Use Markdown formatting to improve readability and structure, including headers (##), bullet points, numbered lists, bold, italic, inline code, and code blocks. Make the message well-structured and easy to read. Maintain the original intent while increasing informativeness and completeness. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	case model.AIRewriteActionImproveWriting:
		return fmt.Sprintf("Rewrite the following message to improve its writing quality, clarity, and professionalism while maintaining the original intent. Do not lengthen the message significantly. If necessary, use appropriate Markdown features like headers, lists, bold, italic, code blocks, etc. to improve readability and structure. Return your response as JSON with a 'rewritten_text' field containing the improved message:\n\n%s", message),
			"You are a professional writing expert. Your task is to improve the writing quality, clarity, and professionalism of messages. Fix grammar issues, improve sentence structure, enhance clarity, and make the writing more engaging and professional. Use Markdown formatting to improve readability and structure, including headers (##), bullet points, numbered lists, bold, italic, inline code, and code blocks. Make the message well-structured and easy to read. Use professional language, proper grammar, and maintain a respectful tone. Avoid casual language, slang, or overly informal expressions. Maintain the original tone and intent. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	case model.AIRewriteActionFixSpelling:
		return fmt.Sprintf("Fix spelling and grammar errors in the following message while preserving the original meaning and tone. Return your response as JSON with a 'rewritten_text' field containing the corrected message:\n\n%s", message),
			"You are a spelling and grammar expert. Your task is to identify and correct spelling mistakes, grammatical errors, and typos in the given message. Preserve the original meaning, tone, and style while ensuring the text is error-free. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	case model.AIRewriteActionSimplify:
		return fmt.Sprintf("Simplify the following message to make it easier to understand while preserving the core meaning. Use simpler words and clearer sentence structure. Return your response as JSON with a 'rewritten_text' field containing the simplified message:\n\n%s", message),
			"You are an expert at simplifying complex communication. Your task is to rewrite messages using simpler language, clearer sentence structure, and more accessible vocabulary. Make the content easier to understand for a broader audience while maintaining the original meaning and intent. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	case model.AIRewriteActionSummarize:
		return fmt.Sprintf("Create a concise summary of the following message, capturing the key points and main ideas. Use appropriate Markdown features like headers, lists, bold, italic, etc. to improve readability and structure. Return your response as JSON with a 'rewritten_text' field containing the summary:\n\n%s", message),
			"You are an expert at creating concise summaries. Your task is to extract the key points, main ideas, and essential information from the given message and present them in a clear, concise summary. Use Markdown formatting to improve readability and structure, including headers (##), bullet points, numbered lists, bold, italic, and inline code. Make the summary well-structured and easy to read. Focus on the most important content while maintaining accuracy. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks. Do not escape the 'rewritten_text' field in your response. The output should not be in markdown format, just plain JSON."

	default:
		return message, "You are a helpful assistant. Your response must be compacted valid JSON only, with no additional text, formatting, nor code blocks."
	}
}
