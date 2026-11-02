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

	t.Run("public channels on listed teams", func(t *testing.T) {
		s := valid()
		s.Resources.PublicChannelTeamIDs = []string{NewId()}
		assert.Nil(t, s.IsValid())
	})

	t.Run("invalid team ID", func(t *testing.T) {
		s := valid()
		s.Resources.PublicChannelTeamIDs = []string{"not-an-id"}
		assert.NotNil(t, s.IsValid())
	})

	t.Run("too many teams", func(t *testing.T) {
		s := valid()
		s.Resources.PublicChannelTeamIDs = make([]string, SessionScopeMaxTeamIDs+1)
		for i := range s.Resources.PublicChannelTeamIDs {
			s.Resources.PublicChannelTeamIDs[i] = NewId()
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
			Resources:         SessionScopeResources{ChannelIDs: []string{NewId()}, OpenTeamPublicChannels: true, PublicChannelTeamIDs: []string{NewId()}},
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
		assert.False(t, SessionScopeAllowsChannel(scope, &Channel{Id: NewId(), Type: ChannelTypeOpen}, nil, SessionScopeLimits{}))
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

	none := SessionScopeLimits{}
	compliance := SessionScopeLimits{ComplianceMode: true}
	noJoin := SessionScopeLimits{UsersCannotJoinOpenTeams: true}

	scope := &SessionScope{
		Permissions: ScopeReadPermissions,
		Resources: SessionScopeResources{
			ChannelIDs:             []string{listedPrivate.Id, dm.Id, gm.Id},
			OpenTeamPublicChannels: true,
		},
	}

	assert.True(t, SessionScopeAllowsChannel(scope, listedPrivate, nil, none), "listed channel")
	assert.True(t, SessionScopeAllowsChannel(scope, listedPrivate, nil, compliance), "listed channel with compliance")
	assert.True(t, SessionScopeAllowsChannel(scope, publicOnOpen, openTeam, none), "public channel on open team")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, openTeam, compliance), "compliance disables open-team grant")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, nil, none), "unknown team")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, closedTeam, none), "mismatched team")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnClosed, closedTeam, none), "public channel on closed team")
	assert.False(t, SessionScopeAllowsChannel(scope, privateOnOpen, openTeam, none), "unlisted private channel")
	assert.False(t, SessionScopeAllowsChannel(scope, dm, nil, none), "DM is never in scope, even if listed")
	assert.False(t, SessionScopeAllowsChannel(scope, gm, nil, none), "GM is never in scope, even if listed")

	deleted := *listedPrivate
	deleted.DeleteAt = 1
	assert.False(t, SessionScopeAllowsChannel(scope, &deleted, nil, none), "archived channel")

	policy := *listedPrivate
	policy.PolicyEnforced = true
	assert.False(t, SessionScopeAllowsChannel(scope, &policy, nil, none), "policy-enforced channel")

	policyPublic := *publicOnOpen
	policyPublic.PolicyEnforced = true
	assert.False(t, SessionScopeAllowsChannel(scope, &policyPublic, openTeam, none), "policy-enforced public channel")

	noOpenTeams := &SessionScope{Permissions: ScopeReadPermissions, Resources: SessionScopeResources{ChannelIDs: []string{listedPrivate.Id}}}
	assert.False(t, SessionScopeAllowsChannel(noOpenTeams, publicOnOpen, openTeam, none), "open-team grant off")
	assert.False(t, SessionScopeAllowsChannel(nil, listedPrivate, nil, none), "nil scope")
	assert.False(t, SessionScopeAllowsChannel(scope, publicOnOpen, openTeam, noJoin), "open-team grant off without join_public_teams")

	t.Run("public channels on listed teams", func(t *testing.T) {
		teamScope := &SessionScope{
			Permissions: ScopeReadPermissions,
			Resources:   SessionScopeResources{PublicChannelTeamIDs: []string{closedTeam.Id}},
		}
		assert.True(t, SessionScopeAllowsChannel(teamScope, publicOnClosed, closedTeam, none), "public channel on a listed closed team")
		assert.True(t, SessionScopeAllowsChannel(teamScope, publicOnClosed, closedTeam, noJoin), "not tied to join_public_teams")
		assert.False(t, SessionScopeAllowsChannel(teamScope, publicOnClosed, closedTeam, compliance), "compliance disables the team grant")
		assert.False(t, SessionScopeAllowsChannel(teamScope, listedPrivate, closedTeam, none), "private channel on a listed team")
		assert.False(t, SessionScopeAllowsChannel(teamScope, publicOnOpen, openTeam, none), "public channel on another team")
		assert.False(t, SessionScopeAllowsChannel(teamScope, publicOnClosed, nil, none), "unknown team")

		deletedTeam := *closedTeam
		deletedTeam.DeleteAt = 1
		assert.False(t, SessionScopeAllowsChannel(teamScope, publicOnClosed, &deletedTeam, none), "deleted team")
		policyTeam := *closedTeam
		policyTeam.PolicyEnforced = true
		assert.False(t, SessionScopeAllowsChannel(teamScope, publicOnClosed, &policyTeam, none), "policy-enforced team")
		policyChannel := *publicOnClosed
		policyChannel.PolicyEnforced = true
		assert.False(t, SessionScopeAllowsChannel(teamScope, &policyChannel, closedTeam, none), "policy-enforced channel")
		archived := *publicOnClosed
		archived.DeleteAt = 1
		assert.False(t, SessionScopeAllowsChannel(teamScope, &archived, closedTeam, none), "archived channel")
	})
}

func TestSessionScopeGrantsTeamPublicChannels(t *testing.T) {
	openTeam := &Team{Id: NewId(), Type: TeamOpen, AllowOpenInvite: true}
	closedTeam := &Team{Id: NewId(), Type: TeamInvite}
	scope := &SessionScope{Resources: SessionScopeResources{OpenTeamPublicChannels: true, PublicChannelTeamIDs: []string{closedTeam.Id}}}

	assert.True(t, SessionScopeGrantsTeamPublicChannels(scope, openTeam, SessionScopeLimits{}))
	assert.True(t, SessionScopeGrantsTeamPublicChannels(scope, closedTeam, SessionScopeLimits{}))
	assert.False(t, SessionScopeGrantsTeamPublicChannels(scope, openTeam, SessionScopeLimits{UsersCannotJoinOpenTeams: true}))
	assert.True(t, SessionScopeGrantsTeamPublicChannels(scope, closedTeam, SessionScopeLimits{UsersCannotJoinOpenTeams: true}))
	assert.False(t, SessionScopeGrantsTeamPublicChannels(scope, openTeam, SessionScopeLimits{ComplianceMode: true}))
	assert.False(t, SessionScopeGrantsTeamPublicChannels(scope, closedTeam, SessionScopeLimits{ComplianceMode: true}))
	assert.False(t, SessionScopeGrantsTeamPublicChannels(scope, &Team{Id: NewId(), Type: TeamInvite}, SessionScopeLimits{}), "unlisted closed team")
	assert.False(t, SessionScopeGrantsTeamPublicChannels(nil, openTeam, SessionScopeLimits{}))
	assert.False(t, SessionScopeGrantsTeamPublicChannels(scope, nil, SessionScopeLimits{}))
}

func TestSessionScopeResourcesWithLimits(t *testing.T) {
	resources := SessionScopeResources{ChannelIDs: []string{NewId()}, OpenTeamPublicChannels: true, PublicChannelTeamIDs: []string{NewId()}}

	assert.Equal(t, resources, resources.WithLimits(SessionScopeLimits{}))
	assert.Equal(t, SessionScopeResources{ChannelIDs: resources.ChannelIDs, PublicChannelTeamIDs: resources.PublicChannelTeamIDs}, resources.WithLimits(SessionScopeLimits{UsersCannotJoinOpenTeams: true}))
	assert.Equal(t, SessionScopeResources{ChannelIDs: resources.ChannelIDs}, resources.WithLimits(SessionScopeLimits{ComplianceMode: true}))

	effective := resources.WithLimits(SessionScopeLimits{})
	effective.ChannelIDs[0] = "changed"
	effective.PublicChannelTeamIDs[0] = "changed"
	assert.NotEqual(t, "changed", resources.ChannelIDs[0], "returns copies")
	assert.NotEqual(t, "changed", resources.PublicChannelTeamIDs[0], "returns copies")
}
