// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
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

func TestAccessDecisionError(t *testing.T) {
	d := NewErrorAccessDecision(errors.New("lookup failed"))
	require.False(t, d.Decision)
	require.True(t, d.IsError())
	require.False(t, d.IsNoPolicy())
	require.Equal(t, AccessDecisionReasonError, d.Reason())
	require.Equal(t, "lookup failed", d.Context[AccessDecisionContextKeyError])

	require.True(t, NewErrorAccessDecision(nil).IsError())
	require.False(t, AccessDecision{Decision: false}.IsError())
	require.False(t, AccessDecision{Decision: true, Context: map[string]any{AccessDecisionContextKeyReason: string(AccessDecisionReasonError)}}.IsError(),
		"an allow is never an error decision, however it is labelled")
}

func TestAccessDecisionIsMember(t *testing.T) {
	_, ok := AccessDecision{Decision: true}.IsMember()
	require.False(t, ok)

	_, ok = AccessDecision{Decision: true, Context: map[string]any{AccessDecisionContextKeyIsMember: "true"}}.IsMember()
	require.False(t, ok, "a non-bool value is not a membership")

	isMember, ok := AccessDecision{Decision: true, Context: map[string]any{AccessDecisionContextKeyIsMember: true}}.IsMember()
	require.True(t, ok)
	require.True(t, isMember)

	isMember, ok = AccessDecision{Decision: false, Context: map[string]any{AccessDecisionContextKeyIsMember: false}}.IsMember()
	require.True(t, ok)
	require.False(t, isMember)
}

func TestSubjectWithResourceScope(t *testing.T) {
	caller := Subject{
		ID:          "caller",
		Type:        "user",
		Role:        SystemUserRoleId,
		ScopedRoles: []ScopedRole{{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId}},
		Attributes:  map[string]any{"department": "Compliance"},
		Session:     map[string]any{"mdm_enrolled": "true"},
		Email:       "caller@example.com",
	}
	handler := Subject{
		ID:   "someone-else",
		Role: SystemAdminRoleId,
		ScopedRoles: []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemAdminRoleId},
			{Scope: AccessControlSubjectScopeChannel, Role: ChannelAdminRoleId},
		},
		Attributes: map[string]any{"department": "Engineering"},
		Session:    map[string]any{"mdm_enrolled": "false"},
		Email:      "other@example.com",
	}

	merged := caller.WithResourceScope(handler)

	require.Equal(t, "caller", merged.ID)
	require.Equal(t, SystemUserRoleId, merged.Role)
	require.Equal(t, SystemUserRoleId, merged.RoleForScope(AccessControlSubjectScopeSystem))
	require.Equal(t, ChannelAdminRoleId, merged.RoleForScope(AccessControlSubjectScopeChannel))
	require.Equal(t, "Compliance", merged.Attributes["department"])
	require.Equal(t, "true", merged.Session["mdm_enrolled"])
	require.Equal(t, "caller@example.com", merged.Email)

	require.Len(t, caller.ScopedRoles, 1, "the caller's subject must not be modified")
	require.Empty(t, caller.RoleForScope(AccessControlSubjectScopeChannel))

	require.Equal(t, caller, caller.WithResourceScope(Subject{}))
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
