// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type AIBridgeTestHelperStatus struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}

type AIBridgeTestHelperCompletion struct {
	Completion string `json:"completion,omitempty"`
	Error      string `json:"error,omitempty"`
	StatusCode int    `json:"status_code,omitempty"`
}

type AIBridgeTestHelperMessage struct {
	Role    string   `json:"role"`
	Message string   `json:"message"`
	FileIDs []string `json:"file_ids,omitempty"`
}

type AIBridgeTestHelperFeatureFlags struct {
	EnableAIPluginBridge *bool `json:"enable_ai_plugin_bridge,omitempty"`
	EnableAIRecaps       *bool `json:"enable_ai_recaps,omitempty"`
}

type AIBridgeTestHelperConfig struct {
	Status           *AIBridgeTestHelperStatus                 `json:"status,omitempty"`
	Agents           []BridgeAgentInfo                         `json:"agents,omitempty"`
	Services         []BridgeServiceInfo                       `json:"services,omitempty"`
	AgentCompletions map[string][]AIBridgeTestHelperCompletion `json:"agent_completions,omitempty"`
	FeatureFlags     *AIBridgeTestHelperFeatureFlags           `json:"feature_flags,omitempty"`
	RecordRequests   *bool                                     `json:"record_requests,omitempty"`
}

type AIBridgeTestHelperRecordedRequest struct {
	Operation        string                      `json:"operation"`
	ClientOperation  string                      `json:"client_operation,omitempty"`
	OperationSubType string                      `json:"operation_sub_type,omitempty"`
	SessionUserID    string                      `json:"session_user_id,omitempty"`
	UserID           string                      `json:"user_id,omitempty"`
	ChannelID        string                      `json:"channel_id,omitempty"`
	AgentID          string                      `json:"agent_id,omitempty"`
	ServiceID        string                      `json:"service_id,omitempty"`
	Messages         []AIBridgeTestHelperMessage `json:"messages"`
	JSONOutputFormat map[string]any              `json:"json_output_format,omitempty"`
}

type AIBridgeTestHelperState struct {
	Status           *AIBridgeTestHelperStatus                 `json:"status,omitempty"`
	Agents           []BridgeAgentInfo                         `json:"agents,omitempty"`
	Services         []BridgeServiceInfo                       `json:"services,omitempty"`
	AgentCompletions map[string][]AIBridgeTestHelperCompletion `json:"agent_completions,omitempty"`
	FeatureFlags     *AIBridgeTestHelperFeatureFlags           `json:"feature_flags,omitempty"`
	RecordRequests   bool                                      `json:"record_requests"`
	RecordedRequests []AIBridgeTestHelperRecordedRequest       `json:"recorded_requests"`
}
