// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"encoding/json"
	"testing"

	graphql "github.com/graph-gophers/graphql-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testResolver struct{}

func (r *testResolver) TestJSON(args struct{ Input *JSONResolver }) *JSONResolver {
	if args.Input == nil {
		return NewJSONResolver(json.RawMessage(`null`))
	}
	return args.Input
}

func TestJSONScalarIntegration(t *testing.T) {
	// Create a minimal schema with our JSON scalar
	schemaString := `
		scalar JSON
		
		type Query {
			testJSON(input: JSON): JSON
		}
	`

	// Parse the schema with a resolver that echoes back the JSON input
	resolver := &testResolver{}
	schema, err := graphql.ParseSchema(schemaString, resolver)
	require.NoError(t, err)

	t.Run("string input", func(t *testing.T) {
		query := `{ testJSON(input: "hello world") }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON string `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Equal(t, "hello world", response.TestJSON)
	})

	t.Run("number input", func(t *testing.T) {
		query := `{ testJSON(input: 42) }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON int `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Equal(t, 42, response.TestJSON)
	})

	t.Run("object input", func(t *testing.T) {
		query := `{ testJSON(input: {key: "value", num: 123}) }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON map[string]interface{} `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Equal(t, "value", response.TestJSON["key"])
		assert.Equal(t, float64(123), response.TestJSON["num"])
	})

	t.Run("array input", func(t *testing.T) {
		query := `{ testJSON(input: ["item1", "item2", 42]) }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON []interface{} `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Equal(t, []interface{}{"item1", "item2", float64(42)}, response.TestJSON)
	})

	t.Run("string array input", func(t *testing.T) {
		query := `{ testJSON(input: ["option1", "option2", "option3"]) }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON []string `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Equal(t, []string{"option1", "option2", "option3"}, response.TestJSON)
	})

	t.Run("null input", func(t *testing.T) {
		query := `{ testJSON(input: null) }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON *string `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Nil(t, response.TestJSON)
	})

	t.Run("no input", func(t *testing.T) {
		query := `{ testJSON }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.Empty(t, result.Errors)

		var response struct {
			TestJSON *string `json:"testJSON"`
		}
		err := json.Unmarshal(result.Data, &response)
		require.NoError(t, err)

		assert.Nil(t, response.TestJSON)
	})

	t.Run("invalid json input", func(t *testing.T) {
		query := `{ testJSON(input: {key: "value", invalid: }) }`
		result := schema.Exec(context.Background(), query, "", nil)
		require.NotEmpty(t, result.Errors)
		assert.Contains(t, result.Errors[0].Error(), "syntax error")
	})
}
