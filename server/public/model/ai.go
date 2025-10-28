// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	// AI Plugin ID
	AIPluginID = "mattermost-ai"

	// AI Plugin Endpoints
	AIEndpointCompletion = "/inter-plugin/v1/completion"
)

// AIRequest represents a request to call the AI plugin
type AIRequest struct {
	Data           map[string]any `json:"data"`
	ResponseSchema []byte         `json:"response_schema,omitempty"`
}
