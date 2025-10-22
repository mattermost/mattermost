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
	systemPrompt := `You are a text rewriting assistant. You must return ONLY a JSON object with this exact structure:
{"rewritten_text":"your rewritten content here"}

CRITICAL RULES:
- Output MUST be valid JSON
- Output MUST contain exactly one field: "rewritten_text"
- Do NOT wrap the JSON in markdown code blocks
- Do NOT add any explanatory text before or after the JSON
- Do NOT escape newlines or special characters in the rewritten_text field beyond standard JSON escaping
- The value of "rewritten_text" should contain the rewritten message only`

	if message == "" {
		return fmt.Sprintf(`Rewrite according to these instructions: %s

Return your response as a JSON object with a single "rewritten_text" field containing the newly created message.`, customPrompt), systemPrompt
	}

	var userPrompt string

	switch action {
	case model.AIRewriteActionCustom:
		userPrompt = fmt.Sprintf(`Apply these custom instructions to rewrite the message below:

<custom_instructions>
%s
</custom_instructions>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the rewritten message.`, customPrompt, message)

	case model.AIRewriteActionShorten:
		userPrompt = fmt.Sprintf(`<task>
Rewrite the message below to be concise and succinct while preserving core meaning and intent.
</task>

<guidelines>
- Remove redundant words and simplify complex phrases
- Get straight to the point
- Maintain the original tone and formality level
- Keep essential information intact
</guidelines>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the shortened message.`, message)

	case model.AIRewriteActionElaborate:
		userPrompt = fmt.Sprintf(`<task>
Expand and elaborate on the message below to make it more detailed and comprehensive.
</task>

<guidelines>
- Add relevant context, examples, and explanations
- Aim for 2-3 times the original length (do not exceed this)
- For longer pieces of text, if necessary, use Markdown formatting within the message (headers ##, lists, bold, italic, code blocks) to improve readability
- Maintain the original intent while increasing informativeness
</guidelines>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the elaborated message.`, message)

	case model.AIRewriteActionImproveWriting:
		userPrompt = fmt.Sprintf(`<task>
Improve the writing quality, clarity, and professionalism of the message below while maintaining original intent.
</task>

<guidelines>
- Fix grammar issues and improve sentence structure
- Enhance clarity and make writing more engaging
- Use professional language with proper grammar
- For longer pieces of text, if necessary, use Markdown formatting within the message (headers ##, lists, bold, italic, code blocks) to improve readability
- Do not significantly lengthen the message
- Avoid casual language, slang, or overly informal expressions
</guidelines>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the improved message.`, message)

	case model.AIRewriteActionFixSpelling:
		userPrompt = fmt.Sprintf(`<task>
Fix all spelling and grammar errors in the message below.
</task>

<guidelines>
- Correct spelling mistakes, grammatical errors, and typos
- Preserve original meaning, tone, and style
- Make no other changes beyond error correction
</guidelines>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the corrected message.`, message)

	case model.AIRewriteActionSimplify:
		userPrompt = fmt.Sprintf(`<task>
Simplify the message below to make it easier to understand.
</task>

<guidelines>
- Use simpler words and clearer sentence structure
- Use more accessible vocabulary
- Make content understandable for a broader audience
- Preserve original meaning and intent
</guidelines>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the simplified message.`, message)

	case model.AIRewriteActionSummarize:
		userPrompt = fmt.Sprintf(`<task>
Create a concise summary of the message below, capturing key points and main ideas.
</task>

<guidelines>
- Extract key points, main ideas, and essential information
- For longer pieces of text, if necessary, use Markdown formatting within the message (headers ##, bullet points, bold, italic) to improve structure
- Focus on the most important content
- Maintain accuracy
</guidelines>

<message>
%s
</message>

Return a JSON object with "rewritten_text" containing the summary.`, message)

	default:
		userPrompt = message
	}

	return userPrompt, systemPrompt
}
