// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// FEATURE_FLAG_REMOVAL: EnableAIPluginBridge - Remove this comment; these constants are used by the plugin bridge
const (
	// AI Plugin ID
	AIPluginID = "mattermost-ai"

	// AI Plugin Endpoints
	AIEndpointCompletion = "/inter-plugin/v1/completion"
)

// FEATURE_FLAG_REMOVAL: EnableAIRewrites - Remove this comment; AIRewriteAction and related types/constants are for the AI rewrites feature
// AIRewriteAction represents the type of rewrite operation to perform
type AIRewriteAction string

const (
	AIRewriteActionSuccinct     AIRewriteAction = "more_succinct"
	AIRewriteActionProfessional AIRewriteAction = "more_professional"
	AIRewriteActionMarkdown     AIRewriteAction = "format_markdown"
	AIRewriteActionLonger       AIRewriteAction = "make_longer"
)

// AIRewriteRequest represents a request to rewrite a message
type AIRewriteRequest struct {
	Message string          `json:"message"`
	Action  AIRewriteAction `json:"action"`
}

// AIRewriteResponse represents the response from a rewrite operation
type AIRewriteResponse struct {
	RewrittenMessage string          `json:"rewritten_message"`
	OriginalMessage  string          `json:"original_message"`
	Action           AIRewriteAction `json:"action"`
}

// FEATURE_FLAG_REMOVAL: EnableAIPluginBridge - Remove this comment; AIRequest is used for generic plugin bridge calls
// AIRequest represents a request to call the AI plugin
type AIRequest struct {
	Data           map[string]any `json:"data"`
	ResponseSchema []byte         `json:"response_schema,omitempty"`
}
