// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScopeParse(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		for e, ops := range validScopes {
			for _, op := range ops {
				parsedRes, parsedOp, err := parseScope(Scope(e) + Scope(ScopeSeparator) + Scope(op))
				require.NoError(t, err, "e=%s op=%s", e, op)
				require.Equal(t, e, parsedRes, "e=%s op=%s", e, op)
				require.Equal(t, op, parsedOp, "e=%s op=%s", e, op)
			}
		}
	})

	t.Run("valid wildcards", func(t *testing.T) {
		for _, tc := range []struct {
			scope       Scope
			expectedRes ScopeResource
			expectedOp  ScopeOperation
		}{
			{"", ScopeAnyResource, ScopeAnyOperation},
			{"*:*", ScopeAnyResource, ScopeAnyOperation},
			{"users:*", ScopeUsers, ScopeAnyOperation},
		} {
			parsedRes, parsedOp, err := parseScope(tc.scope)
			require.NoError(t, err, "scope %q", tc.scope)
			require.Equal(t, tc.expectedRes, parsedRes, "scope %q", tc.scope)
			require.Equal(t, tc.expectedOp, parsedOp, "scope %q", tc.scope)
		}
	})

	t.Run("invalid", func(t *testing.T) {
		for _, tc := range []struct {
			scope    Scope
			expected string
		}{
			{":*", `invalid scope ":*": missing resource type, e.g. "posts"`},
			{"*", `invalid scope "*": invalid resource type "*"`},
			{"*:read", `invalid scope "*:read": invalid resource type "*"`},
			{"foo", `invalid scope "foo": invalid resource type "foo"`},
			{"foo:", `invalid scope "foo:": invalid resource type "foo"`},
			{"foo:*", `invalid scope "foo:*": invalid resource type "foo"`},
			{"foo:bar", `invalid scope "foo:bar": invalid resource type "foo"`},
			{"users", `invalid scope "users": invalid operation ""`},
			{"users:", `invalid scope "users:": invalid operation ""`},
			{"users:bar", `invalid scope "users:bar": invalid operation "bar"`},
		} {
			_, _, err := parseScope(tc.scope)
			require.Error(t, err, "scope=%s", tc.scope)
			require.Equal(t, tc.expected, err.Error(), "scope=%s", tc.scope)
		}
	})
}

func TestScopeAssumes(t *testing.T) {
	for _, tc := range []struct {
		have, need Scope
		expected   bool
	}{
		{"*:*", "x:y", true},
		{"x:*", "x:y", true},
		{"x:y", "x:y", true},

		{"x:a", "x:y", false},
		{"a:y", "x:y", false},
		{"x:y", "x:*", false},
		{"x:y", "*:y", false},
		{"x:y", "*:*", false},
	} {
		require.Equal(t, tc.expected, tc.have.Satisfies(tc.need), "have=%q, need=%q", tc.have, tc.need)
	}
}

func TestScopesNormalize(t *testing.T) {
	for _, tc := range []struct {
		name         string
		in, expected []Scope
	}{
		{
			name:     "simple sort",
			in:       []Scope{"users:write", "users:read", "channels:join"},
			expected: []Scope{"channels:join", "users:read", "users:write"},
		},
		{
			name:     "global wildcard",
			in:       []Scope{"users:read", "*:*", "users:write", "users:*", "users:read", "users:write", "channels:join"},
			expected: []Scope{"*:*"},
		},
		{
			name:     "operation wildcard",
			in:       []Scope{"users:read", "users:write", "users:*", "users:read", "users:write", "channels:join"},
			expected: []Scope{"channels:join", "users:*"},
		},
		{
			name:     "no wildcards",
			in:       []Scope{"users:read", "users:write", "users:read", "users:write", "channels:join"},
			expected: []Scope{"channels:join", "users:read", "users:write"},
		},
		{
			name:     "simple with plugins",
			in:       []Scope{"users:write", "users:read", "plugins:com.example.plugin/path"},
			expected: []Scope{"plugins:com.example.plugin/path", "users:read", "users:write"},
		},
		{
			name:     "simple with apps",
			in:       []Scope{"users:write", "users:read", "apps:com.example.app/callpath"},
			expected: []Scope{"apps:com.example.app/callpath", "users:read", "users:write"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, NormalizeScopes(tc.in), "in=%q", tc.in)
		})
	}
}

func TestScopesSatisfiesPluginRequest(t *testing.T) {
	for _, tc := range []struct {
		name          string
		have          []Scope
		pluginID      string
		expectedError string
	}{
		{
			name:     "legacy app has access to all but internal",
			have:     nil,
			pluginID: "com.example.plugin",
		},
		{
			name:     "empty have is same as legacy",
			have:     []Scope{},
			pluginID: "com.example.plugin",
		},
		{
			name:     "exact match",
			have:     []Scope{"channels:join", "plugins:com.example.plugin/somepath"},
			pluginID: "com.example.plugin",
		},
		{
			name:     "wildcard plugin id",
			have:     []Scope{"channels:join", "plugins:*"},
			pluginID: "com.example.plugin",
		},
		{
			name:     "subpath",
			have:     []Scope{"channels:join", "plugins:com.example.plugin/some"},
			pluginID: "com.example.plugin",
		},
		{
			name:     "no path prefix",
			have:     []Scope{"channels:join", "plugins:com.example.plugin"},
			pluginID: "com.example.plugin",
		},
		{
			name:          "plugin ID mismatch",
			have:          []Scope{"channels:join", "plugins:com.example.OTHER"},
			pluginID:      "com.example.plugin",
			expectedError: "insufficient scope, need plugins:com.example.plugin/somepath",
		},
		{
			name:          "path mismatch",
			have:          []Scope{"channels:join", "plugins:com.example.plugin/otherpath"},
			pluginID:      "com.example.plugin",
			expectedError: "insufficient scope, need plugins:com.example.plugin/somepath",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			have := AppScopes(NormalizeScopes(tc.have))
			err := have.SatisfiesPluginRequest(tc.pluginID, "/somepath")
			if tc.expectedError != "" {
				require.EqualError(t, err, tc.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
func TestScopesSatisfies(t *testing.T) {
	for _, tc := range []struct {
		name       string
		have, need []Scope
		expected   bool
	}{
		{
			name:     "legacy app has access to all but internal",
			have:     nil,
			need:     []Scope{"channels:join", "users:read"},
			expected: true,
		},
		{
			name:     "empty have is same as legacy",
			have:     []Scope{},
			need:     []Scope{"channels:join", "users:read"},
			expected: true,
		},
		{
			name:     "exact match",
			have:     []Scope{"channels:join", "users:read"},
			need:     []Scope{"channels:join", "users:read"},
			expected: true,
		},
		{
			name:     "superset",
			have:     []Scope{"posts:read", "channels:join", "users:read"},
			need:     []Scope{"channels:join", "users:read"},
			expected: true,
		},
		{
			name:     "have has a global wildcard",
			have:     []Scope{"*:*", "channels:join", "users:read"},
			need:     []Scope{"channels:join", "users:read"},
			expected: true,
		},
		{
			name:     "need has a global wildcard",
			have:     []Scope{"channels:join", "users:read"},
			need:     []Scope{"*:*", "channels:join", "users:read"},
			expected: true,
		},
		{
			name:     "have has an operation wildcard",
			have:     []Scope{"channels:*", "users:read"},
			need:     []Scope{"channels:join", "users:read"},
			expected: true,
		},

		{
			name:     "fail insufficient",
			have:     []Scope{"users:read"},
			need:     []Scope{"channels:join", "users:read"},
			expected: false,
		},
		{
			name:     "fail internal",
			have:     []Scope{"users:read"},
			need:     nil,
			expected: false,
		},
		{
			name:     "fail internal unrestricted or legacy",
			have:     nil,
			need:     nil,
			expected: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			need := APIScopes(NormalizeScopes(tc.need))
			have := AppScopes(NormalizeScopes(tc.have))
			require.Equal(t, tc.expected, have.Satisfies(need))
		})
	}
}

func TestScopesCompare(t *testing.T) {
	for _, tc := range []struct {
		name  string
		A, B  AppScopes
		super bool
		equal bool
	}{
		{
			name:  "nil vs nil",
			equal: true,
		},
		{
			name:  "nil vs empty",
			B:     AppScopes{},
			equal: true,
		},
		{
			name:  "nil vs ANY",
			B:     ScopeUnrestrictedApp,
			equal: true,
		},
		{
			name:  "nil vs XYZ",
			B:     AppScopes{"x:a", "y:b", "z:c"},
			super: true,
		},
		{
			name:  "empty vs empty",
			A:     AppScopes{},
			B:     AppScopes{},
			equal: true,
		},
		{
			name:  "empty vs ANY",
			A:     AppScopes{},
			B:     ScopeUnrestrictedApp,
			equal: true,
		},
		{
			name:  "empty vs XYZ",
			A:     AppScopes{},
			B:     AppScopes{"x:a", "y:b", "z:c"},
			super: true,
		},
		{
			name:  "ANY vs ANY",
			A:     ScopeUnrestrictedApp,
			B:     ScopeUnrestrictedApp,
			equal: true,
		},
		{
			name:  "ANY vs XYZ",
			A:     ScopeUnrestrictedApp,
			B:     AppScopes{"x:a", "y:b", "z:c"},
			super: true,
		},
		{
			name:  "XYZ vs XYZ",
			A:     AppScopes{"x:a", "y:b", "z:c"},
			B:     AppScopes{"x:a", "y:b", "z:c"},
			equal: true,
		},
		{
			name: "AB vs XY",
			A:    AppScopes{"a:aa", "b:bb"},
			B:    AppScopes{"x:xx", "y:yy"},
		},
		{
			name: "AX vs AY",
			A:    AppScopes{"a", "x"},
			B:    AppScopes{"a", "y"},
		},
		{
			name: "AX vs BX",
			A:    AppScopes{"a", "x"},
			B:    AppScopes{"b", "x"},
		},
		{
			name:  "ABCDE vs BD mixed",
			A:     AppScopes{"a", "b", "c", "d", "e"},
			B:     AppScopes{"b", "d"},
			super: true,
		},
		{
			name:  "ABCDE vs AB prefix",
			A:     AppScopes{"a", "b", "c", "d", "e"},
			B:     AppScopes{"a", "b"},
			super: true,
		},
		{
			name:  "ABCDE vs DE suffix",
			A:     AppScopes{"a", "b", "c", "d", "e"},
			B:     AppScopes{"d", "e"},
			super: true,
		},
		{
			name:  "b:* vs b:read",
			A:     AppScopes{"a:read", "b:*", "c:*", "d:update"},
			B:     AppScopes{"a:read", "b:read"},
			super: true,
		},
		{
			name:  "b* is a superset of b:read b:update",
			A:     AppScopes{"a:update", "a:read", "b:*", "c:*", "d:update"},
			B:     AppScopes{"b:read", "b:update", "c:*"},
			super: true,
		},
		{
			name:  "x:read x:update is a superset of x:read",
			A:     AppScopes{"x:read", "x:update", "y"},
			B:     AppScopes{"x:read", "y"},
			super: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			super, equal := tc.A.Compare(tc.B)
			require.Equal(t, tc.super, super)
			require.Equal(t, tc.equal, equal)

			sub, equal := tc.B.Compare(tc.A)
			require.Equal(t, false, sub)
			require.Equal(t, tc.equal, equal)
		})
	}
}

func TestScopesValueScan(t *testing.T) {
	type TC struct {
		in  AppScopes
		msg string
	}

	allScopes := AppScopes{"plugins:com.example.plugin", "plugins:com.example.plugin2/somepath"}
	for r := range validScopes {
		for _, op := range validScopes[r] {
			allScopes = append(allScopes, r.NewScope(op))
		}
	}

	tcs := []TC{
		{
			in:  AppScopes{ScopeChannelsJoin},
			msg: "Scopes with one element return the same scope",
		},
		{
			in:  AppScopes{},
			msg: "Empty scope return empty scopes",
		},
		{
			in:  nil,
			msg: "Nil scope return nil scope",
		},
		{
			in:  allScopes,
			msg: "All scopes are returned correctly",
		},
	}

	for _, tc := range tcs {
		v, err := tc.in.Value()
		assert.NoError(t, err, "should not have errors getting the value")
		scope := &AppScopes{}
		err = scope.Scan(v)
		assert.NoError(t, err, "should not have errors when scanning the value")

		_, equals := tc.in.Compare(*scope)
		assert.True(t, equals, tc.msg)
	}

}
