// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests pin the JSON shape of the EvaluateExpression* request/response
// types. They guard against accidental tag renames or field shape changes that
// would break API and plugin consumers.

func TestEvaluateExpressionRequestJSONRoundTrip(t *testing.T) {
	cases := []struct {
		name string
		in   EvaluateExpressionRequest
	}{
		{
			name: "empty",
			in:   EvaluateExpressionRequest{},
		},
		{
			name: "populated",
			in: EvaluateExpressionRequest{
				Expression: "user.attributes.dept == \"eng\"",
				UserIDs:    []string{NewId(), NewId()},
				Action:     "membership",
			},
		},
		{
			name: "no action (omitempty)",
			in: EvaluateExpressionRequest{
				Expression: "true",
				UserIDs:    []string{NewId()},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.in)
			require.NoError(t, err)

			// Tags are exactly "expression", "user_ids", "action" — verify by
			// checking the wire keys when fields are present.
			s := string(b)
			if tc.in.Expression != "" {
				assert.Contains(t, s, "\"expression\"")
			}
			if tc.in.UserIDs != nil {
				assert.Contains(t, s, "\"user_ids\"")
			}
			if tc.in.Action == "" {
				assert.NotContains(t, s, "\"action\"", "action must be omitted when empty")
			} else {
				assert.Contains(t, s, "\"action\"")
			}

			var out EvaluateExpressionRequest
			require.NoError(t, json.Unmarshal(b, &out))
			assert.Equal(t, tc.in, out)
		})
	}
}

func TestEvaluateExpressionResultJSONRoundTrip(t *testing.T) {
	userID := NewId()

	cases := []struct {
		name string
		in   EvaluateExpressionResult
	}{
		{
			name: "decision granted",
			in:   EvaluateExpressionResult{UserID: userID, Decision: true},
		},
		{
			name: "decision denied",
			in:   EvaluateExpressionResult{UserID: userID, Decision: false},
		},
		{
			name: "per-user error",
			in:   EvaluateExpressionResult{UserID: userID, Error: "user not found"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.in)
			require.NoError(t, err)

			s := string(b)
			assert.Contains(t, s, "\"user_id\"")
			assert.Contains(t, s, "\"decision\"")
			if tc.in.Error == "" {
				assert.NotContains(t, s, "\"error\"", "error must be omitted when empty")
			} else {
				assert.Contains(t, s, "\"error\"")
			}

			var out EvaluateExpressionResult
			require.NoError(t, json.Unmarshal(b, &out))
			assert.Equal(t, tc.in, out)
		})
	}
}

func TestEvaluateExpressionResponseJSONRoundTrip(t *testing.T) {
	userID := NewId()

	cases := []struct {
		name             string
		in               EvaluateExpressionResponse
		mustHaveResults  bool
		mustHaveErrors   bool
		mustOmitResults  bool
		mustOmitErrors   bool
		errorSubstrings  []string
		decisionContains bool
	}{
		{
			name:           "empty response (both fields omitted)",
			in:             EvaluateExpressionResponse{},
			mustOmitResults: true,
			mustOmitErrors:  true,
		},
		{
			name: "results only",
			in: EvaluateExpressionResponse{
				Results: []EvaluateExpressionResult{
					{UserID: userID, Decision: true},
				},
			},
			mustHaveResults:  true,
			mustOmitErrors:   true,
			decisionContains: true,
		},
		{
			name: "expression errors only",
			in: EvaluateExpressionResponse{
				ExpressionErrors: []CELExpressionError{
					{Line: 1, Column: 22, Message: "invalid field"},
				},
			},
			mustHaveErrors:  true,
			mustOmitResults: true,
			errorSubstrings: []string{"\"line\"", "\"column\"", "\"message\"", "invalid field"},
		},
		{
			name: "both fields populated (defensive)",
			in: EvaluateExpressionResponse{
				Results: []EvaluateExpressionResult{
					{UserID: userID, Decision: false, Error: "evaluation failed"},
				},
				ExpressionErrors: []CELExpressionError{
					{Message: "warn"},
				},
			},
			mustHaveResults: true,
			mustHaveErrors:  true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.in)
			require.NoError(t, err)
			s := string(b)

			if tc.mustOmitResults {
				assert.False(t, strings.Contains(s, "\"results\""), "results must be omitted: %s", s)
			}
			if tc.mustOmitErrors {
				assert.False(t, strings.Contains(s, "\"expression_errors\""), "expression_errors must be omitted: %s", s)
			}
			if tc.mustHaveResults {
				assert.Contains(t, s, "\"results\"")
			}
			if tc.mustHaveErrors {
				assert.Contains(t, s, "\"expression_errors\"")
			}
			for _, sub := range tc.errorSubstrings {
				assert.Contains(t, s, sub)
			}

			var out EvaluateExpressionResponse
			require.NoError(t, json.Unmarshal(b, &out))
			assert.Equal(t, tc.in, out)
		})
	}
}
