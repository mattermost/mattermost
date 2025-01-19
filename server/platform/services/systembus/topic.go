// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import (
	"encoding/json"
	"fmt"

	"github.com/xeipuuv/gojsonschema"
)

// TopicDefinition contains metadata about a topic
type TopicDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Schema      json.RawMessage `json:"schema"`
}

// ValidatePayload checks if the given payload matches the topic's schema
func (t *TopicDefinition) ValidatePayload(payload []byte) error {
	if len(t.Schema) == 0 {
		return nil // No schema defined means validation passes
	}

	schemaLoader := gojsonschema.NewStringLoader(string(t.Schema))
	documentLoader := gojsonschema.NewStringLoader(string(payload))

	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		return err
	}

	if !result.Valid() {
		// Return the first validation error if any exist
		if len(result.Errors()) > 0 {
			return fmt.Errorf("%v", result.Errors()[0])
		}
	}

	return nil
}
