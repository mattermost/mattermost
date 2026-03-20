// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"strings"
)

type RootResolver struct {
	RunRootResolver
	PlaybookRootResolver
	PropertyRootResolver
}

func addToSetmap[T any](setmap map[string]any, name string, value *T) {
	if value != nil {
		setmap[name] = *value
	}
}

func addConcatToSetmap(setmap map[string]any, name string, value *[]string) {
	if value != nil {
		setmap[name] = strings.Join(*value, ",")
	}
}

// JSONResolver implements the JSON scalar type for json.RawMessage
type JSONResolver struct {
	value json.RawMessage
}

// NewJSONResolver creates a new JSONResolver from json.RawMessage
func NewJSONResolver(value json.RawMessage) *JSONResolver {
	return &JSONResolver{value: value}
}

// ImplementsGraphQLType implements the GraphQL scalar interface
func (r JSONResolver) ImplementsGraphQLType(name string) bool {
	return name == "JSON"
}

// UnmarshalGraphQL unmarshals a GraphQL input value to json.RawMessage
func (r *JSONResolver) UnmarshalGraphQL(input any) error {
	bytes, err := json.Marshal(input)
	if err != nil {
		return err
	}
	r.value = bytes
	return nil
}

// MarshalJSON implements json.Marshaler
func (r JSONResolver) MarshalJSON() ([]byte, error) {
	if r.value == nil {
		return []byte(`null`), nil
	}
	return r.value, nil
}
