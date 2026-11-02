// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"slices"
)

// SessionPropScope holds a JSON-encoded SessionScope. A session carrying this
// prop is a scoped session: it can read exactly what the scope lists and
// nothing else, regardless of the user's roles and memberships.
const SessionPropScope = "scope"

const SessionScopeMaxChannelIDs = 200

const SessionScopeMaxTeamIDs = 50

const SessionScopeMaxLifetimeMillis = 24 * 60 * 60 * 1000

// ScopeReadPermissions are the only permissions a session scope may hold.
// These are literals rather than Permission*.Id because the permission
// variables are only populated during package init.
var ScopeReadPermissions = []string{
	"read_channel",
	"read_channel_content",
	"read_public_channel",
	"list_team_channels",
	"view_team",
}

// SessionScope restricts a session to a set of read permissions over a set of
// channels. For a scoped session, read access is exactly the scope: channel and
// team memberships neither add to it nor are required for it.
type SessionScope struct {
	Permissions []string              `json:"permissions"`
	Resources   SessionScopeResources `json:"resources"`

	// OnBehalfOfUserID records the user who triggered the session, for audit only.
	// It grants nothing.
	OnBehalfOfUserID string `json:"on_behalf_of_user_id,omitempty"`

	// CreatedByPluginID is set by the server to the plugin that minted the session.
	CreatedByPluginID string `json:"created_by_plugin_id"`
}

type SessionScopeResources struct {
	ChannelIDs []string `json:"channel_ids,omitempty"`

	// OpenTeamPublicChannels adds every public channel on a team that any user
	// can join, see Team.IsOpenToAllUsers.
	OpenTeamPublicChannels bool `json:"open_team_public_channels,omitempty"`

	// PublicChannelTeamIDs adds every public channel on these teams, whether or
	// not the team is open to all users, and makes the teams visible.
	PublicChannelTeamIDs []string `json:"public_channel_team_ids,omitempty"`
}

// SessionScopeLimits are the server settings that turn a scope's public-channel
// grants off.
type SessionScopeLimits struct {
	// ComplianceMode is ComplianceSettings.Enable. It turns both public-channel
	// grants off, since compliance mode blocks reading public channels without
	// membership.
	ComplianceMode bool

	// UsersCannotJoinOpenTeams is true when the system_user role lacks
	// join_public_teams. It turns the open-team grant off, since that grant is
	// only safe because any user could join those teams.
	UsersCannotJoinOpenTeams bool
}

func (l SessionScopeLimits) openTeamGrantOff() bool {
	return l.ComplianceMode || l.UsersCannotJoinOpenTeams
}

// WithLimits returns the resources without the grants limits turns off.
func (r SessionScopeResources) WithLimits(limits SessionScopeLimits) SessionScopeResources {
	effective := SessionScopeResources{ChannelIDs: slices.Clone(r.ChannelIDs)}
	if !limits.openTeamGrantOff() {
		effective.OpenTeamPublicChannels = r.OpenTeamPublicChannels
	}
	if !limits.ComplianceMode {
		effective.PublicChannelTeamIDs = slices.Clone(r.PublicChannelTeamIDs)
	}
	return effective
}

func (s *SessionScope) IsValid() *AppError {
	if len(s.Permissions) == 0 {
		return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.permissions.app_error", nil, "no permissions", http.StatusBadRequest)
	}
	for _, permission := range s.Permissions {
		if !slices.Contains(ScopeReadPermissions, permission) {
			return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.permissions.app_error", nil, "permission="+permission, http.StatusBadRequest)
		}
	}

	if len(s.Resources.ChannelIDs) > SessionScopeMaxChannelIDs {
		return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.channel_ids.app_error", map[string]any{"Max": SessionScopeMaxChannelIDs}, "", http.StatusBadRequest)
	}
	for _, channelID := range s.Resources.ChannelIDs {
		if !IsValidId(channelID) {
			return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.channel_ids.app_error", map[string]any{"Max": SessionScopeMaxChannelIDs}, "channel_id="+channelID, http.StatusBadRequest)
		}
	}

	if len(s.Resources.PublicChannelTeamIDs) > SessionScopeMaxTeamIDs {
		return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.team_ids.app_error", map[string]any{"Max": SessionScopeMaxTeamIDs}, "", http.StatusBadRequest)
	}
	for _, teamID := range s.Resources.PublicChannelTeamIDs {
		if !IsValidId(teamID) {
			return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.team_ids.app_error", map[string]any{"Max": SessionScopeMaxTeamIDs}, "team_id="+teamID, http.StatusBadRequest)
		}
	}

	if s.OnBehalfOfUserID != "" && !IsValidId(s.OnBehalfOfUserID) {
		return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.on_behalf_of_user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if s.CreatedByPluginID == "" {
		return NewAppError("SessionScope.IsValid", "model.session_scope.is_valid.created_by_plugin_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *SessionScope) HasPermission(permissionID string) bool {
	return slices.Contains(s.Permissions, permissionID)
}

func (s *SessionScope) ListsChannel(channelID string) bool {
	return slices.Contains(s.Resources.ChannelIDs, channelID)
}

// IsScoped reports whether the session carries a scope, without parsing it.
func (s *Session) IsScoped() bool {
	_, ok := s.Props[SessionPropScope]
	return ok
}

// Scope returns the session's scope. A scope that fails to parse yields
// scoped=true with an empty scope, which denies everything.
func (s *Session) Scope() (scope *SessionScope, scoped bool) {
	raw, ok := s.Props[SessionPropScope]
	if !ok {
		return nil, false
	}

	var parsed SessionScope
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return &SessionScope{}, true
	}
	return &parsed, true
}

// SessionScopeGrantsTeamPublicChannels reports whether a public-channel grant of
// the scope covers team: the open-team grant for a team open to all users, or
// the team being in PublicChannelTeamIDs. Deleted and policy-enforced teams are
// never covered.
func SessionScopeGrantsTeamPublicChannels(scope *SessionScope, team *Team, limits SessionScopeLimits) bool {
	if scope == nil || team == nil || team.DeleteAt != 0 || team.PolicyEnforced {
		return false
	}
	if scope.Resources.OpenTeamPublicChannels && !limits.openTeamGrantOff() && team.IsOpenToAllUsers() {
		return true
	}
	return !limits.ComplianceMode && slices.Contains(scope.Resources.PublicChannelTeamIDs, team.Id)
}

// SessionScopeAllowsChannel is the single decision of whether a channel is in a
// session scope. team must be the channel's team, or nil if it isn't known; it
// is only consulted for the public-channel grants.
func SessionScopeAllowsChannel(scope *SessionScope, channel *Channel, team *Team, limits SessionScopeLimits) bool {
	if scope == nil || channel == nil {
		return false
	}
	if channel.DeleteAt != 0 || channel.PolicyEnforced || channel.IsGroupOrDirect() {
		return false
	}

	if scope.ListsChannel(channel.Id) {
		return true
	}

	return channel.Type == ChannelTypeOpen &&
		team != nil &&
		team.Id == channel.TeamId &&
		SessionScopeGrantsTeamPublicChannels(scope, team, limits)
}
