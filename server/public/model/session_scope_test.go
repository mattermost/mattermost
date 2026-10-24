// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScopeReadPermissionsAreReadPermissions(t *testing.T) {
	assert.ElementsMatch(t, []string{
		PermissionReadChannel.Id,
		PermissionReadChannelContent.Id,
		PermissionReadPublicChannel.Id,
		PermissionListTeamChannels.Id,
		PermissionViewTeam.Id,
	}, ScopeReadPermissions)
}

func TestSessionScopeIsValid(t *testing.T) {
	valid := func() *SessionScope {
		return &SessionScope{
			Permissions:       []string{PermissionReadChannelContent.Id},
			Resources:         SessionScopeResources{ChannelIDs: []string{NewId()}, OpenTeamPublicChannels: true},
			OnBehalfOfUserID:  NewId(),
			CreatedByPluginID: "com.example.plugin",
		}
	}

	require.Nil(t, valid().IsValid())

	t.Run("all read permissions", func(t *testing.T) {
		s := valid()
		s.Permissions = ScopeReadPermissions
		assert.Nil(t, s.IsValid())
	})

	t.Run("no permissions", func(t *testing.T) {
		s := valid()
		s.Permissions = nil
		assert.NotNil(t, s.IsValid())
	})

	for _, permission := range []string{PermissionCreatePost.Id, PermissionManageSystem.Id, PermissionJoinPublicChannels.Id, PermissionReadOtherUsersTeams.Id, "unknown"} {
		t.Run("rejects "+permission, func(t *testing.T) {
			s := valid()
			s.Permissions = append(s.Permissions, permission)
			assert.NotNil(t, s.IsValid())
		})
	}

	t.Run("invalid channel ID", func(t *testing.T) {
		s := valid()
		s.Resources.ChannelIDs = []string{"not-an-id"}
		assert.NotNil(t, s.IsValid())
	})

	t.Run("too many channels", func(t *testing.T) {
		s := valid()
		s.Resources.ChannelIDs = make([]string, SessionScopeMaxChannelIDs+1)
		for i := range s.Resources.ChannelIDs {
			s.Resources.ChannelIDs[i] = NewId()
		}
		assert.NotNil(t, s.IsValid())
	})

	t.Run("invalid on-behalf-of user", func(t *testing.T) {
		s := valid()
		s.OnBehalfOfUserID = "bad"
		assert.NotNil(t, s.IsValid())
	})

	t.Run("missing plugin", func(t *testing.T) {
		s := valid()
		s.CreatedByPluginID = ""
		assert.NotNil(t, s.IsValid())
	})
}

func TestSessionScopeParsing(t *testing.T) {
	t.Run("unscoped", func(t *testing.T) {
		s := &Session{Props: StringMap{}}
		scope, scoped := s.Scope()
		assert.False(t, scoped)
		assert.Nil(t, scope)
		assert.False(t, s.IsScoped())
	})

	t.Run("round trip", func(t *testing.T) {
		in := SessionScope{
			Permissions:       []string{PermissionReadChannel.Id},
			Resources:         SessionScopeResources{ChannelIDs: []string{NewId()}, OpenTeamPublicChannels: true},
			OnBehalfOfUserID:  NewId(),
			CreatedByPluginID: "plugin",
		}
		b, err := json.Marshal(in)
		require.NoError(t, err)
		s := &Session{Props: StringMap{SessionPropScope: string(b)}}
		scope, scoped := s.Scope()
		require.True(t, scoped)
		assert.Equal(t, in, *scope)
		assert.True(t, s.IsScoped())
	})

	t.Run("malformed scope denies everything", func(t *testing.T) {
		s := &Session{Props: StringMap{SessionPropScope: "{not json"}}
		scope, scoped := s.Scope()
		require.True(t, scoped)
		require.NotNil(t, scope)
		assert.Empty(t, scope.Permissions)
		assert.False(t, scope.Resources.OpenTeamPublicChannels)
		assert.False(t, SessionScopeAllowsChannel(scope, &Channel{Id: NewId(), Type: ChannelTypeOpen}, nil, false))
	})

	t.Run("empty scope prop is still scoped", func(t *testing.T) {
		s := &Session{Props: StringMap{SessionPropScope: ""}}
		_, scoped := s.Scope()
		assert.True(t, scoped)
	})

	t.Run("scoped session is never unrestricted", func(t *testing.T) {
		s := &Session{Local: true, Props: StringMap{SessionPropScope: "{}"}}
		assert.False(t, s.IsUnrestricted())
		s.Props = StringMap{}
		assert.True(t, s.IsUnrestricted())
	})
}

func TestTeamIsOpenToAllUsers(t *testing.T) {
	open := func() *Team {
		return &Team{Id: NewId(), Type: TeamOpen, AllowOpenInvite: true}
	}
	require.True(t, open().IsOpenToAllUsers())

	for name, mutate := range map[string]func(*Team){
		"invite only":       func(t *Team) { t.AllowOpenInvite = false },
		"deleted":           func(t *Team) { t.DeleteAt = 1 },
		"group constrained": func(t *Team) { t.GroupConstrained = NewPointer(true) },
		"allowed domains":   func(t *Team) { t.AllowedDomains = "example.com" },
		"policy enforced":   func(t *Team) { t.PolicyEnforced = true },
	} {
		t.Run(name, func(t *testing.T) {
			team := open()
			mutate(team)
			assert.False(t, team.IsOpenToAllUsers())
		})
	}

	t.Run("group constrained false", func(t *testing.T) {
		team := open()
		team.GroupConstrained = NewPointer(false)
		assert.True(t, team.IsOpenToAllUsers())
	})
}

func TestSessionScopeAllowsChannel(t *testing.T) {
	openTeam := &Team{Id: NewId(), Type: TeamOpen, AllowOpenInvite: true}
	closedTeam := &Team{Id: NewId(), Type: TeamInvite}

	listedPrivate := &Channel{Id: NewId(), TeamId: closedTeam.Id, Type: ChannelTypePrivate}
	publicOnOpen := &Channel{Id: NewId(), TeamId: openTeam.Id, Type: ChannelTypeOpen}
	publicOnClosed := &Channel{Id: NewId(), TeamId: closedTeam.Id, Type: ChannelTypeOpen}
	privateOnOpen := &Channel{Id: NewId(), TeamId: openTeam.Id, Type: ChannelTypePrivate}
	dm := &Channel{Id: NewId(), Type: ChannelTypeDirect}
	gm := &Channel{Id: NewId(), Type: ChannelTypeGroup}

	scope := &SessionScope{
		Permissions: ScopeReadPermissions,
		Resources: SessionScopeResources{
			ChannelIDs:             []string{listedPrivate.Id, dm.Id, gm.Id},
			OpenTeamPublicChannels: true,
		},
	}

	assert.True(t, SessionScopeAllowsChannel(scope, listedPrivate, nil, false), "listed channel")
	assert.True(t, SessionScopeAllowsChannel(scope, listedPrivate, nil, true), "listed channel with compliance")
	assert.True(t, SessionScopeAllowsChannel(scope, publicOnOpen, openTeam, false), "public channel on open team")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, openTeam, true), "compliance disables open-team grant")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, nil, false), "unknown team")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, closedTeam, false), "mismatched team")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnClosed, closedTeam, false), "public channel on closed team")
	assert.False(t, SessionScopeAllowsChannel(scope, privateOnOpen, openTeam, false), "unlisted private channel")
	assert.False(t, SessionScopeAllowsChannel(scope, dm, nil, false), "DM is never in scope, even if listed")
	assert.False(t, SessionScopeAllowsChannel(scope, gm, nil, false), "GM is never in scope, even if listed")

	deleted := *listedPrivate
	deleted.DeleteAt = 1
	assert.False(t, SessionScopeAllowsChannel(scope, &deleted, nil, false), "archived channel")

	policy := *listedPrivate
	policy.PolicyEnforced = true
	assert.False(t, SessionScopeAllowsChannel(scope, &policy, nil, false), "policy-enforced channel")

	policyPublic := *publicOnOpen
	policyPublic.PolicyEnforced = true
	assert.False(t, SessionScopeAllowsChannel(scope, &policyPublic, openTeam, false), "policy-enforced public channel")

	noOpenTeams := &SessionScope{Permissions: ScopeReadPermissions, Resources: SessionScopeResources{ChannelIDs: []string{listedPrivate.Id}}}
	assert.False(t, SessionScopeAllowsChannel(noOpenTeams, publicOnOpen, openTeam, false), "open-team grant off")
	assert.False(t, SessionScopeAllowsChannel(nil, listedPrivate, nil, false), "nil scope")
}
