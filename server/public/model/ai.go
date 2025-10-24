// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	// AI Plugin ID
	AIPluginID = "mattermost-ai"

	// AI Plugin Endpoints
	AIEndpointCompletion = "/inter-plugin/v1/completion"
)

// AIRewriteAction represents the type of rewrite operation to perform
type AIRewriteAction string

const (
	AIRewriteActionCustom         AIRewriteAction = "custom"
	AIRewriteActionShorten        AIRewriteAction = "shorten"
	AIRewriteActionElaborate      AIRewriteAction = "elaborate"
	AIRewriteActionImproveWriting AIRewriteAction = "improve_writing"
	AIRewriteActionFixSpelling    AIRewriteAction = "fix_spelling"
	AIRewriteActionSimplify       AIRewriteAction = "simplify"
	AIRewriteActionSummarize      AIRewriteAction = "summarize"
	AIRewriteActionMatchStyle     AIRewriteAction = "match_style"
)

// AIRewriteRequest represents a request to rewrite a message
type AIRewriteRequest struct {
	Message      string          `json:"message"`
	Action       AIRewriteAction `json:"action"`
	CustomPrompt string          `json:"custom_prompt,omitempty"`
}

// AIRewriteResponse represents a response from the AI plugin
type AIRewriteResponse struct {
	RewrittenText string   `json:"rewritten_text"`
	ChangesMade   []string `json:"changes_made"`
}

// AIRequest represents a request to call the AI plugin
type AIRequest struct {
	Data           map[string]any `json:"data"`
	ResponseSchema []byte         `json:"response_schema,omitempty"`
}

// AIThemeResponse represents a response containing an AI-generated theme
type AIThemeResponse struct {
	Theme       map[string]string `json:"theme"`
	Explanation string            `json:"explanation"`
	GeneratedAt int64             `json:"generated_at"`
}
