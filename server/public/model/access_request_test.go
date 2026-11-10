// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAccessDecisionJSON(t *testing.T) {
	t.Run("bare decision omits the context", func(t *testing.T) {
		data, err := json.Marshal(AccessDecision{Decision: true})
		require.NoError(t, err)
		require.JSONEq(t, `{"decision":true}`, string(data))
	})

	t.Run("no-policy decision round-trips", func(t *testing.T) {
		in := NewNoPolicyAccessDecision()
		data, err := json.Marshal(in)
		require.NoError(t, err)
		require.JSONEq(t, `{"decision":true,"context":{"reason":"no_policy"}}`, string(data))

		var out AccessDecision
		require.NoError(t, json.Unmarshal(data, &out))
		require.Equal(t, in, out)
		require.True(t, out.IsNoPolicy())
	})
}

func TestAccessDecisionIsNoPolicy(t *testing.T) {
	tests := []struct {
		name     string
		decision AccessDecision
		want     bool
	}{
		{"no context", AccessDecision{Decision: true}, false},
		{"no reason key", AccessDecision{Decision: true, Context: map[string]any{"other": "x"}}, false},
		{"non-string reason", AccessDecision{Decision: true, Context: map[string]any{AccessDecisionContextKeyReason: 1}}, false},
		{"unrelated reason", AccessDecision{Decision: true, Context: map[string]any{AccessDecisionContextKeyReason: "whatever"}}, false},
		{"no_policy reason", NewNoPolicyAccessDecision(), true},
		// A deny must never be classified as an unregulated request, however
		// the context labels it.
		{
			"deny contradicting the no_policy reason",
			AccessDecision{Decision: false, Context: map[string]any{AccessDecisionContextKeyReason: string(AccessDecisionReasonNoPolicy)}},
			false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, tc.decision.IsNoPolicy())
		})
	}
}
