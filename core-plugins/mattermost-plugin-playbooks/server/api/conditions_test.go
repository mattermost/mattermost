// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestParsePaginationParams(t *testing.T) {
	tests := []struct {
		name            string
		queryParams     map[string]string
		expectedPage    int
		expectedPerPage int
	}{
		{
			name:            "no parameters",
			queryParams:     map[string]string{},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "page negative",
			queryParams:     map[string]string{"page": "-1"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "page zero",
			queryParams:     map[string]string{"page": "0"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "page positive",
			queryParams:     map[string]string{"page": "5"},
			expectedPage:    5,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "per_page negative",
			queryParams:     map[string]string{"per_page": "-1"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "per_page zero",
			queryParams:     map[string]string{"per_page": "0"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "per_page positive",
			queryParams:     map[string]string{"per_page": "50"},
			expectedPage:    0,
			expectedPerPage: 50,
		},
		{
			name:            "per_page over max",
			queryParams:     map[string]string{"per_page": "300"},
			expectedPage:    0,
			expectedPerPage: MaxPerPage,
		},
		{
			name:            "both parameters valid",
			queryParams:     map[string]string{"page": "3", "per_page": "25"},
			expectedPage:    3,
			expectedPerPage: 25,
		},
		{
			name:            "invalid page string",
			queryParams:     map[string]string{"page": "invalid"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
		{
			name:            "invalid per_page string",
			queryParams:     map[string]string{"per_page": "invalid"},
			expectedPage:    0,
			expectedPerPage: DefaultPerPage,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := url.Values{}
			for key, value := range tt.queryParams {
				query.Set(key, value)
			}

			page, perPage := parsePaginationParams(query)

			assert.Equal(t, tt.expectedPage, page)
			assert.Equal(t, tt.expectedPerPage, perPage)
		})
	}
}

func TestConditionRequest_ToCondition(t *testing.T) {
	tests := []struct {
		name        string
		request     ConditionRequest
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid condition request with version 1",
			request: ConditionRequest{
				ID:         "test-id",
				Version:    1,
				PlaybookID: "playbook-123",
				RunID:      "run-456",
				ConditionExpr: json.RawMessage(`{
					"is": {
						"field": "field1",
						"value": "value1"
					}
				}`),
				CreateAt: 1234567890,
				UpdateAt: 1234567891,
			},
			expectError: false,
		},
		{
			name: "valid condition request with version 1",
			request: ConditionRequest{
				ID:         "test-id-2",
				Version:    1,
				PlaybookID: "playbook-123",
				ConditionExpr: json.RawMessage(`{
					"isNot": {
						"field": "field2",
						"value": "value2"
					}
				}`),
			},
			expectError: false,
		},
		{
			name: "null condition expression returns error",
			request: ConditionRequest{
				ID:            "test-id-3",
				Version:       1,
				PlaybookID:    "playbook-123",
				ConditionExpr: json.RawMessage(`null`),
			},
			expectError: true,
			errorMsg:    "condition_expr is required and cannot be null",
		},
		{
			name: "empty condition expression returns error",
			request: ConditionRequest{
				ID:            "test-id-4",
				Version:       1,
				PlaybookID:    "playbook-123",
				ConditionExpr: nil,
			},
			expectError: true,
			errorMsg:    "condition_expr is required and cannot be null",
		},
		{
			name: "invalid JSON in condition expression",
			request: ConditionRequest{
				ID:            "test-id-5",
				Version:       1,
				PlaybookID:    "playbook-123",
				ConditionExpr: json.RawMessage(`{invalid json`),
			},
			expectError: true,
			errorMsg:    "failed to unmarshal condition expression",
		},
		{
			name: "missing version returns error",
			request: ConditionRequest{
				ID:         "test-id-6",
				PlaybookID: "playbook-123",
				ConditionExpr: json.RawMessage(`{
					"is": {
						"field": "test",
						"value": "value"
					}
				}`),
			},
			expectError: true,
			errorMsg:    "version is required and cannot be 0",
		},
		{
			name: "unsupported version returns error",
			request: ConditionRequest{
				ID:         "test-id-8",
				Version:    999,
				PlaybookID: "playbook-123",
				ConditionExpr: json.RawMessage(`{
					"is": {
						"field": "test",
						"value": "value"
					}
				}`),
			},
			expectError: true,
			errorMsg:    "unsupported condition version: 999",
		},
		{
			name: "complex nested condition",
			request: ConditionRequest{
				ID:         "test-id-7",
				Version:    1,
				PlaybookID: "playbook-123",
				ConditionExpr: json.RawMessage(`{
					"and": [
						{
							"is": {
								"field": "status",
								"value": "active"
							}
						},
						{
							"or": [
								{
									"is": {
										"field": "priority",
										"value": ["high", "critical"]
									}
								},
								{
									"isNot": {
										"field": "assignee",
										"value": "none"
									}
								}
							]
						}
					]
				}`),
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition, err := tt.request.ToCondition()

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, condition)
			} else {
				require.NoError(t, err)
				require.NotNil(t, condition)

				// Verify basic fields are copied correctly
				assert.Equal(t, tt.request.ID, condition.ID)
				assert.Equal(t, tt.request.PlaybookID, condition.PlaybookID)
				assert.Equal(t, tt.request.RunID, condition.RunID)
				assert.Equal(t, tt.request.CreateAt, condition.CreateAt)
				assert.Equal(t, tt.request.UpdateAt, condition.UpdateAt)

				// Verify version handling
				assert.Equal(t, tt.request.Version, condition.Version)

				// Verify condition expression is always present (since null/empty are rejected)
				assert.NotNil(t, condition.ConditionExpr)

				// Verify the condition expression is of the correct type
				_, ok := condition.ConditionExpr.(*app.ConditionExprV1)
				assert.True(t, ok, "Expected condition expression to be ConditionExprV1")
			}
		})
	}
}
