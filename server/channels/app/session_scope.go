// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// SessionScopeTarget is the object a permission check is about. Set at most one
// of the fields; an empty target is a system-wide check.
type SessionScopeTarget struct {
	TeamID    string
	ChannelID string
	Channel   *model.Channel
	PostID    string
}

// EvaluateSessionScope is the single scope decision shared by every permission
// check. scoped is false for an unscoped session, in which case the caller
// applies its normal rules. For a scoped session allowed is final: roles,
// memberships and ABAC must not override a denial.
//
// A scoped session may use a permission only if the scope holds it, and only
// on a channel in the scope (see model.SessionScopeAllowsChannel), or for
// view_team/list_team_channels, on a team open to all users or holding a
// channel the scope lists by ID. Everything else, including every system-wide
// check, is denied.
func (a *App) EvaluateSessionScope(rctx request.CTX, session *model.Session, permissionID string, target SessionScopeTarget) (scoped bool, allowed bool) {
	if session == nil {
		return false, false
	}
	scope, scoped := session.Scope()
	if !scoped {
		return false, false
	}
	if !scope.HasPermission(permissionID) {
		return true, false
	}

	switch {
	case target.Channel != nil:
		return true, a.ScopeAllowsChannel(rctx, scope, target.Channel)
	case target.ChannelID != "":
		channel, appErr := a.GetChannel(rctx, target.ChannelID)
		if appErr != nil {
			return true, false
		}
		return true, a.ScopeAllowsChannel(rctx, scope, channel)
	case target.PostID != "":
		channel, err := a.Srv().Store().Channel().GetForPost(target.PostID)
		if err != nil {
			return true, false
		}
		return true, a.ScopeAllowsChannel(rctx, scope, channel)
	case target.TeamID != "":
		if permissionID != model.PermissionViewTeam.Id && permissionID != model.PermissionListTeamChannels.Id {
			return true, false
		}
		team, appErr := a.GetTeam(target.TeamID)
		if appErr != nil {
			return true, false
		}
		if team.DeleteAt != 0 {
			return true, false
		}
		openTeamGrant := scope.Resources.OpenTeamPublicChannels && team.IsOpenToAllUsers() && !a.openTeamGrantDisabled(rctx)
		return true, openTeamGrant || a.scopeListsChannelOnTeam(rctx, scope, team.Id)
	}

	return true, false
}

// openTeamGrantDisabled reports whether the server turns the scope's open-team
// grant off: in compliance mode, or when ordinary users can't join open teams,
// since the grant is only safe because any user could read those channels.
func (a *App) openTeamGrantDisabled(rctx request.CTX) bool {
	if *a.Config().ComplianceSettings.Enable {
		return true
	}
	role, err := a.Srv().Store().Role().GetByName(rctx, model.SystemUserRoleId)
	if err != nil {
		rctx.Logger().Warn("Failed to get the system user role for a session scope check", mlog.Err(err))
		return true
	}
	return !slices.Contains(role.Permissions, model.PermissionJoinPublicTeams.Id)
}

// scopeListedChannels returns the channels the scope lists by ID that are in
// scope.
func (a *App) scopeListedChannels(rctx request.CTX, scope *model.SessionScope) []*model.Channel {
	if len(scope.Resources.ChannelIDs) == 0 {
		return nil
	}
	channels, appErr := a.GetChannels(rctx, scope.Resources.ChannelIDs)
	if appErr != nil {
		if appErr.StatusCode != http.StatusNotFound {
			rctx.Logger().Warn("Failed to get the channels listed by a session scope", mlog.Err(appErr))
		}
		return nil
	}
	listed := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		if model.SessionScopeAllowsChannel(scope, channel, nil, true) {
			listed = append(listed, channel)
		}
	}
	return listed
}

// scopeListsChannelOnTeam reports whether the scope lists, by ID, an in-scope
// channel on the team, which makes the team itself visible to the session.
func (a *App) scopeListsChannelOnTeam(rctx request.CTX, scope *model.SessionScope, teamID string) bool {
	return slices.ContainsFunc(a.scopeListedChannels(rctx, scope), func(channel *model.Channel) bool {
		return channel.TeamId == teamID
	})
}

// ScopeAllowsChannel reports whether channel is in scope, loading the channel's
// team only when the open-team grant needs it.
func (a *App) ScopeAllowsChannel(rctx request.CTX, scope *model.SessionScope, channel *model.Channel) bool {
	if scope == nil || channel == nil {
		return false
	}

	var team *model.Team
	openTeamGrantDisabled := true
	if scope.Resources.OpenTeamPublicChannels && channel.Type == model.ChannelTypeOpen && !scope.ListsChannel(channel.Id) {
		openTeamGrantDisabled = a.openTeamGrantDisabled(rctx)
		if !openTeamGrantDisabled {
			var appErr *model.AppError
			team, appErr = a.GetTeam(channel.TeamId)
			if appErr != nil {
				rctx.Logger().Debug("Failed to get team for session scope check", mlog.String("team_id", channel.TeamId), mlog.Err(appErr))
				return false
			}
		}
	}

	return model.SessionScopeAllowsChannel(scope, channel, team, openTeamGrantDisabled)
}

// sessionScopeDecision is EvaluateSessionScope for callers without a request
// context.
func (a *App) sessionScopeDecision(session *model.Session, permissionID string, target SessionScopeTarget) (scoped bool, allowed bool) {
	if !session.IsScoped() {
		return false, false
	}
	return a.EvaluateSessionScope(request.EmptyContext(a.Log()), session, permissionID, target)
}

// requestScopeDecision applies the request session's scope to a check made by
// user ID, when that user is the session's own user. This keeps user-based
// helpers called during a scoped request from reading past the scope.
func (a *App) requestScopeDecision(rctx request.CTX, userID string, permissionID string, target SessionScopeTarget) (scoped bool, allowed bool) {
	session := requestScopedSession(rctx, userID)
	if session == nil {
		return false, false
	}
	return a.EvaluateSessionScope(rctx, session, permissionID, target)
}

// requestScopedSession returns the request's session if it is scoped and
// belongs to userID, or nil otherwise.
func requestScopedSession(rctx request.CTX, userID string) *model.Session {
	if rctx == nil {
		return nil
	}
	session := rctx.Session()
	if session == nil || session.UserId == "" || session.UserId != userID || !session.IsScoped() {
		return nil
	}
	return session
}

// scopedViewUsersRestrictions limits the users a scoped session can see, when
// the user can't see everyone, to members of the teams it is on and can view
// under the scope, and members of the in-scope channels the scope lists. Its
// other memberships, such as DMs, don't count.
func (a *App) scopedViewUsersRestrictions(rctx request.CTX, session *model.Session, teamIDs []string) *model.ViewUsersRestrictions {
	restrictions := &model.ViewUsersRestrictions{Teams: []string{}, Channels: []string{}}
	for _, teamID := range teamIDs {
		if _, allowed := a.EvaluateSessionScope(rctx, session, model.PermissionViewTeam.Id, SessionScopeTarget{TeamID: teamID}); allowed {
			restrictions.Teams = append(restrictions.Teams, teamID)
		}
	}

	scope, _ := session.Scope()
	if scope.HasPermission(model.PermissionReadChannel.Id) {
		for _, channel := range a.scopeListedChannels(rctx, scope) {
			restrictions.Channels = append(restrictions.Channels, channel.Id)
		}
	}
	return restrictions
}

// CreateScopedSession creates a session for userID that can only read what scope
// allows, on behalf of the plugin pluginID. It is the only way to create a
// scoped session.
func (a *App) CreateScopedSession(rctx request.CTX, pluginID, userID string, scope *model.SessionScope, expiresAt int64) (session *model.Session, appErr *model.AppError) {
	auditRec := a.MakeAuditRecord(rctx, model.AuditEventCreateScopedSession, model.AuditStatusFail)
	defer func() {
		var err error
		if appErr != nil {
			err = appErr
		}
		a.LogAuditRec(rctx, auditRec, err)
	}()
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)
	model.AddEventParameterToAuditRec(auditRec, "expires_at", expiresAt)
	auditRec.AddMeta(model.AuditKeyCreatedByPluginID, pluginID)

	if scope == nil {
		return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.scope_missing.app_error", nil, "", http.StatusBadRequest)
	}

	scopeCopy := *scope
	scopeCopy.CreatedByPluginID = pluginID
	auditRec.AddMeta(model.AuditKeyOnBehalfOfUserID, scopeCopy.OnBehalfOfUserID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", scopeCopy.Resources.ChannelIDs)
	model.AddEventParameterToAuditRec(auditRec, "open_team_public_channels", scopeCopy.Resources.OpenTeamPublicChannels)
	model.AddEventParameterToAuditRec(auditRec, "permissions", scopeCopy.Permissions)

	if validErr := scopeCopy.IsValid(); validErr != nil {
		return nil, validErr
	}

	now := model.GetMillis()
	if expiresAt <= now || expiresAt > now+model.SessionScopeMaxLifetimeMillis {
		return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.expires_at.app_error", nil, "", http.StatusBadRequest)
	}

	user, appErr := a.GetUser(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}
	if user.DeleteAt != 0 || user.IsRemote() {
		return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.user.app_error", nil, "user_id="+userID, http.StatusBadRequest)
	}

	if len(scopeCopy.Resources.ChannelIDs) > 0 {
		channels, chErr := a.GetChannels(rctx, scopeCopy.Resources.ChannelIDs)
		if chErr != nil {
			return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.channel.app_error", nil, "", http.StatusBadRequest).Wrap(chErr)
		}
		found := make(map[string]bool, len(channels))
		for _, channel := range channels {
			if channel.IsGroupOrDirect() {
				return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.channel.app_error", nil, "direct or group channel_id="+channel.Id, http.StatusBadRequest)
			}
			found[channel.Id] = true
		}
		for _, channelID := range scopeCopy.Resources.ChannelIDs {
			if !found[channelID] {
				return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.channel.app_error", nil, "channel_id="+channelID, http.StatusBadRequest)
			}
		}
	}

	scopeJSON, err := json.Marshal(scopeCopy)
	if err != nil {
		return nil, model.NewAppError("CreateScopedSession", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	session = &model.Session{
		UserId:    user.Id,
		Roles:     user.GetRawRoles(),
		ExpiresAt: expiresAt,
	}
	session.AddProp(model.SessionPropScope, string(scopeJSON))
	if user.IsBot {
		session.AddProp(model.SessionPropIsBot, model.SessionPropIsBotValue)
	}
	if user.IsGuest() {
		session.AddProp(model.SessionPropIsGuest, "true")
	} else {
		session.AddProp(model.SessionPropIsGuest, "false")
	}

	session, appErr = a.createSession(rctx, session)
	if appErr != nil {
		return nil, appErr
	}

	auditRec.Success()
	auditRec.AddEventObjectType("session")
	model.AddEventParameterToAuditRec(auditRec, "session_id", session.Id)
	return session, nil
}

// RevokeScopedSessionsForPlugin revokes every live session minted by the plugin.
// It runs when the plugin is disabled; session expiry is the backstop.
func (a *App) RevokeScopedSessionsForPlugin(rctx request.CTX, pluginID string) *model.AppError {
	return a.revokeScopedSessions(rctx.WithLogFields(mlog.String("plugin_id", pluginID)), func(scope *model.SessionScope) bool {
		return scope.CreatedByPluginID == pluginID
	})
}

// RevokeAllScopedSessions revokes every live scoped session. It runs when
// plugins are turned off server-wide.
func (a *App) RevokeAllScopedSessions(rctx request.CTX) *model.AppError {
	return a.revokeScopedSessions(rctx, func(*model.SessionScope) bool { return true })
}

// revokeScopedSessions revokes the scoped sessions whose scope matches. It keeps
// going past a failed revocation and returns the failures together.
func (a *App) revokeScopedSessions(rctx request.CTX, match func(*model.SessionScope) bool) *model.AppError {
	sessions, err := a.Srv().Store().Session().GetScopedSessions(rctx)
	if err != nil {
		return model.NewAppError("revokeScopedSessions", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var revoked int
	var errs []error
	for _, session := range sessions {
		scope, _ := session.Scope()
		if !match(scope) {
			continue
		}
		if appErr := a.RevokeSession(rctx, session); appErr != nil {
			errs = append(errs, appErr)
			continue
		}
		revoked++
	}

	if revoked > 0 {
		rctx.Logger().Info("Revoked scoped sessions", mlog.Int("count", revoked))
	}
	if len(errs) > 0 {
		return model.NewAppError("revokeScopedSessions", "app.session.revoke_scoped.app_error", map[string]any{"Count": len(errs)}, "", http.StatusInternalServerError).Wrap(errors.Join(errs...))
	}
	return nil
}

func (ch *Channels) revokeScopedSessionsForPlugin(pluginID string) {
	rctx := request.EmptyContext(ch.srv.Log())
	if appErr := New(ServerConnector(ch)).RevokeScopedSessionsForPlugin(rctx, pluginID); appErr != nil {
		rctx.Logger().Error("Failed to revoke scoped sessions for plugin", mlog.String("plugin_id", pluginID), mlog.Err(appErr))
	}
}

func (ch *Channels) revokeAllScopedSessions() {
	rctx := request.EmptyContext(ch.srv.Log())
	if appErr := New(ServerConnector(ch)).RevokeAllScopedSessions(rctx); appErr != nil {
		rctx.Logger().Error("Failed to revoke scoped sessions", mlog.Err(appErr))
	}
}
