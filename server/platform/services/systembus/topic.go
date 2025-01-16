// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import "encoding/json"

// TopicDefinition contains metadata about a topic
type TopicDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Schema      json.RawMessage `json:"schema"`
}

// ValidatePayload checks if the given payload matches the topic's schema
func (t *TopicDefinition) ValidatePayload(payload []byte) error {
	// TODO: Implement JSON schema validation
	return nil
}
