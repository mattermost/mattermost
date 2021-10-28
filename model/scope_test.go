// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsPluginScope(t *testing.T) {
	for _, s := range getPredefinedScopes() {
		assert.False(t, s.IsPluginScope(), "Scope %v should not be a plugin scope", s)
	}

	assert.True(t, NewPluginScope("pluginID").IsPluginScope(), "NewPluginScope should create valid plugin scopes")

	assert.False(t, NewPluginSpecificScope("pluginID", "scope").IsPluginScope(), "NewPluginSpecificScope should not create valid plugin scopes")
}

func TestIsPluginSpecificScope(t *testing.T) {
	for _, s := range getPredefinedScopes() {
		assert.False(t, s.IsPluginSpecificScope(), "Scope %v should not be a plugin specific scope", s)
	}

	assert.False(t, NewPluginScope("pluginID").IsPluginSpecificScope(), "NewPluginScope should not create valid plugin specific scopes")

	assert.True(t, NewPluginSpecificScope("pluginID", "scope").IsPluginSpecificScope(), "NewPluginSpecificScope should create valid plugin specific scopes")
}

func TestIsPredefinedScope(t *testing.T) {
	for _, s := range getPredefinedScopes() {
		assert.True(t, s.IsPredefinedScope(), "Scope %v should be a predefined scope", s)
	}

	assert.False(t, NewPluginScope("pluginID").IsPredefinedScope(), "NewPluginScope should not create valid plugin predefined scopes")

	assert.False(t, NewPluginSpecificScope("pluginID", "scope").IsPredefinedScope(), "NewPluginSpecificScope should not create valid plugin predefined scopes")
}

func TestIsScopeForPlugin(t *testing.T) {
	plugin1ID := "pluginID"
	plugin2ID := "foo"

	plugin1Scope := NewPluginScope(plugin1ID)
	assert.True(t, plugin1Scope.IsScopeForPlugin(plugin1ID), "NewPluginScope should create a valid plugin scope for the provided ID")
	assert.False(t, plugin1Scope.IsScopeForPlugin(plugin2ID), "IsScopeForPlugin should not recognize a different plugin")

	otherScopes := append(getPredefinedScopes(), NewPluginSpecificScope("pluginID", "scope"))
	for _, s := range otherScopes {
		assert.False(t, s.IsScopeForPlugin(""), "Scope %v should not be a scope for a plugin", s)
	}
}

func TestIsInScope(t *testing.T) {
	allScopes := append(getPredefinedScopes(), NewPluginScope("pluginID"), NewPluginSpecificScope("pluginID", "scope"))
	others := Scopes{}
	for _, s := range allScopes {
		assert.False(t, s.isInScope(ScopeDeny()), "Scope %v should not be in Deny scope", s)
		assert.True(t, s.isInScope(ScopeAny(s)), "Scope %v should be in scope created with ScopeAny(%v)", s, s)
		assert.True(t, s.isInScope(allScopes), "Scope %v should be among all the scopes", s)
		assert.False(t, s.isInScope(others), "Scope %v should not be in previous scopes", s)
		others = append(others, s)
		assert.True(t, s.isInScope(others), "Scope %v should be in a scope where it has been added", s)
	}
}

func TestAreAllowed(t *testing.T) {
	var legacyScopes Scopes = nil
	allScopes := append(getPredefinedScopes(), NewPluginScope("pluginID"), NewPluginSpecificScope("pluginID", "scope"))
	emptyScopes := Scopes{}

	assert.True(t, legacyScopes.AreAllowed(ScopeDeny()), "Legacy scopes should be always allowed")
	assert.True(t, legacyScopes.AreAllowed(ScopeAllow()), "Legacy scopes should be always allowed")
	assert.True(t, legacyScopes.AreAllowed(allScopes), "Legacy scopes should be always allowed")

	assert.False(t, allScopes.AreAllowed(ScopeDeny()), "ScopeDeny should deny any scope (but legacy)")
	assert.False(t, emptyScopes.AreAllowed(ScopeDeny()), "ScopeDeny should deny any scope (but legacy)")
	assert.False(t, Scopes{allScopes[0]}.AreAllowed(ScopeDeny()), "ScopeDeny should deny any scope (but legacy)")

	assert.True(t, allScopes.AreAllowed(ScopeAllow()), "ScopeAllow should always allow")
	assert.True(t, emptyScopes.AreAllowed(ScopeAllow()), "ScopeAllow should always allow")
	assert.True(t, Scopes{allScopes[0]}.AreAllowed(ScopeAllow()), "ScopeAllow should always allow")

	assert.True(t, allScopes.AreAllowed(allScopes), "Scopes should be allowed when at least one belong to the allowed group")
	assert.True(t, Scopes{allScopes[0]}.AreAllowed(allScopes), "Scopes should be allowed when at least one belong to the allowed group")

	assert.False(t, allScopes.AreAllowed(ScopeAny(NewPluginScope("pluginID2"))), "Scopes should not be allowed when there is no element equal to the allowed group")
	assert.False(t, emptyScopes.AreAllowed(allScopes), "Scopes should not be allowed when there is no element equal to the allowed group")
}

func TestIsPluginInScope(t *testing.T) {
	plugin1ID := "plugin1ID"
	plugin2ID := "plugin2ID"

	scope := ScopeAny(NewPluginScope(plugin1ID))

	assert.True(t, scope.IsPluginInScope(plugin1ID))
	assert.False(t, scope.IsPluginInScope(plugin2ID))

	var legacyScope Scopes = nil
	assert.True(t, legacyScope.IsPluginInScope(plugin1ID), "legacy scopes allow access to all plugins")

	emptyScope := Scopes{}
	assert.False(t, emptyScope.IsPluginInScope(plugin1ID), "empty scopes should not allow plugins")
}

func TestIntersection(t *testing.T) {
	type TC struct {
		in1 Scopes
		in2 Scopes
		out Scopes
		msg string
	}

	tcs := []TC{
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: Scopes{ScopeChannelJoin, ScopeFilesRead},
			msg: "Equal scopes return equal intersection",
		},
		{
			in1: Scopes{ScopeChannelJoin},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: Scopes{ScopeChannelJoin},
			msg: "Intersection only has common values",
		},
		{
			in1: Scopes{ScopeChannelJoin},
			in2: Scopes{ScopeFilesRead},
			out: ScopeDeny(),
			msg: "No common values return empty list",
		},
		{
			in1: nil,
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: ScopeDeny(),
			msg: "If one of the inputs is nil, the output is nil",
		},
	}

	for _, tc := range tcs {
		assert.True(t, tc.in1.intersection(tc.in2).Equals(tc.out), tc.msg)
		assert.True(t, tc.in2.intersection(tc.in1).Equals(tc.out), "intersection must be commutative")
	}
}

func TestEquals(t *testing.T) {
	type TC struct {
		in1 Scopes
		in2 Scopes
		out bool
		msg string
	}

	tcs := []TC{
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: true,
			msg: "Equal scopes return true",
		},
		{
			in1: Scopes{ScopeChannelJoin},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: false,
			msg: "Different size scopes return false",
		},
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesWrite},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: false,
			msg: "Same size scopes but different scopes return false",
		},
		{
			in1: nil,
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: false,
			msg: "Nil scopes are not equal to other scopes",
		},
		{
			in1: nil,
			in2: nil,
			out: true,
			msg: "Nil scopes are equal among themselves",
		},
		{
			in1: Scopes{},
			in2: Scopes{},
			out: true,
			msg: "Empty scopes are equals",
		},
		{
			in1: nil,
			in2: Scopes{},
			out: false,
			msg: "Empty scopes and nil scopes are different",
		},
	}

	for _, tc := range tcs {
		assert.Equal(t, tc.out, tc.in1.Equals(tc.in2), tc.msg)
		assert.Equal(t, tc.out, tc.in2.Equals(tc.in1), "equality must be commutative")
	}
}

func TestValidate(t *testing.T) {
	assert.True(t, ScopeDeny().Validate(), "ScopeDeny should be a valid scope")
	assert.True(t, ScopeAllow().Validate(), "ScopeAllow should be a valid scope")
	assert.True(t, ScopeAny(getPredefinedScopes()...).Validate(), "Predefined scopes should be valid")
	assert.True(t, ScopeAny(NewPluginScope("pluginID")).Validate(), "Plugin scopes should be valid")
	assert.True(t, ScopeAny(NewPluginSpecificScope("pluginID", "scope")).Validate(), "Plugin specific scopes should be valid")
	assert.False(t, ScopeAny(Scope("arbitrary:string")).Validate(), "Arbitrary strings are not valid scopes")

	allScopes := append(getPredefinedScopes(), NewPluginScope("pluginID"), NewPluginSpecificScope("pluginID", "scope"))
	assert.True(t, allScopes.Validate(), "all scopes should be valid")
	assert.False(t, append(allScopes, Scope("arbitrary:string")).Validate(), "all scopes and one invalid scope makes the whole scopes invalid")
}

func TestIsSuperset(t *testing.T) {
	type TC struct {
		in1 Scopes
		in2 Scopes
		out bool
		msg string
	}

	tcs := []TC{
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: true,
			msg: "Equal scopes are considered a superset",
		},
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead, ScopeFilesWrite},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: true,
			msg: "In2 contained in in1 considers in1 a superset",
		},
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead, ScopeFilesWrite},
			out: false,
			msg: "Cannot be a supperset of a bigger set",
		},
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: Scopes{ScopeChannelJoin, ScopeFilesWrite},
			out: false,
			msg: "If in2 contains elements not in in1, in1 is not considered a superset",
		},
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: Scopes{},
			out: true,
			msg: "Any set is considered a superset of the empty scopes",
		},
		{
			in1: Scopes{},
			in2: Scopes{},
			out: true,
			msg: "Empty set is considered a superset of itself",
		},
		{
			in1: nil,
			in2: Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: true,
			msg: "Legacy apps (nil) are always considered a superset",
		},
		{
			in1: Scopes{ScopeChannelJoin, ScopeFilesRead},
			in2: nil,
			out: false,
			msg: "Legacy apps (nil) are only supersetted by themselves",
		},
		{
			in1: nil,
			in2: nil,
			out: true,
			msg: "Legacy apps (nil) are supersets of themselves",
		},
	}

	for _, tc := range tcs {
		assert.Equal(t, tc.out, tc.in1.IsSuperset(tc.in2), tc.msg)
	}
}

func TestNormalize(t *testing.T) {
	type TC struct {
		in  Scopes
		out Scopes
		msg string
	}

	tcs := []TC{
		{
			in:  Scopes{ScopeChannelJoin, ScopeFilesRead},
			out: Scopes{ScopeChannelJoin, ScopeFilesRead},
			msg: "Scope with no repetition should return the same scope",
		},
		{
			in:  Scopes{ScopeFilesRead, ScopeChannelJoin},
			out: Scopes{ScopeChannelJoin, ScopeFilesRead},
			msg: "Scope is alphabetically ordered",
		},
		{
			in:  Scopes{},
			out: Scopes{},
			msg: "Empty scope should remain an empty scope",
		},
		{
			in:  nil,
			out: nil,
			msg: "Nil scope should remain nil scope",
		},
		{
			in:  Scopes{ScopeChannelJoin, ScopeFilesRead, ScopeChannelJoin},
			out: Scopes{ScopeChannelJoin, ScopeFilesRead},
			msg: "Repeated scopes should be removed",
		},
	}

	for _, tc := range tcs {
		assert.True(t, tc.in.Normalize().Equals(tc.out), tc.msg)
	}
}

func TestValueScan(t *testing.T) {
	type TC struct {
		in  Scopes
		msg string
	}

	allScopes := append(getPredefinedScopes(), NewPluginScope("pluginID"), NewPluginSpecificScope("pluginID", "scope"))

	tcs := []TC{
		{
			in:  Scopes{ScopeChannelJoin},
			msg: "Scopes with one element return the same scope",
		},
		{
			in:  Scopes{},
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
		scope := &Scopes{}
		err = scope.Scan(v)
		assert.NoError(t, err, "should not have errors when scanning the value")
		assert.True(t, tc.in.Equals(*scope), tc.msg)
	}

}
