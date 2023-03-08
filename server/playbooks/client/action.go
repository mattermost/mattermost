// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

type GenericChannelActionWithoutPayload struct {
	ID          string `json:"id"`
	ChannelID   string `json:"channel_id"`
	Enabled     bool   `json:"enabled"`
	DeleteAt    int64  `json:"delete_at"`
	ActionType  string `json:"action_type"`
	TriggerType string `json:"trigger_type"`
}

type GenericChannelAction struct {
	GenericChannelActionWithoutPayload
	Payload interface{} `json:"payload"`
}

type WelcomeMessagePayload struct {
	Message string `json:"message" mapstructure:"message"`
}

type PromptRunPlaybookFromKeywordsPayload struct {
	Keywords   []string `json:"keywords" mapstructure:"keywords"`
	PlaybookID string   `json:"playbook_id" mapstructure:"playbook_id"`
}

type CategorizeChannelPayload struct {
	CategoryName string `json:"category_name" mapstructure:"category_name"`
}

type WelcomeMessageAction struct {
	GenericChannelActionWithoutPayload
	Payload WelcomeMessagePayload `json:"payload"`
}

const (
	// Action types
	ActionTypeWelcomeMessage    = "send_welcome_message"
	ActionTypePromptRunPlaybook = "prompt_run_playbook"
	ActionTypeCategorizeChannel = "categorize_channel"

	// Trigger types
	TriggerTypeNewMemberJoins = "new_member_joins"
	TriggerTypeKeywordsPosted = "keywords"
)

// ChannelActionListOptions specifies the optional parameters to the
// ActionsService.List method.
type ChannelActionListOptions struct {
	TriggerType string `url:"trigger_type,omitempty"`
	ActionType  string `url:"action_type,omitempty"`
}

// ChannelActionCreateOptions specifies the parameters for ActionsService.Create method.
type ChannelActionCreateOptions struct {
	ChannelID   string      `json:"channel_id"`
	Enabled     bool        `json:"enabled"`
	ActionType  string      `json:"action_type"`
	TriggerType string      `json:"trigger_type"`
	Payload     interface{} `json:"payload"`
}
