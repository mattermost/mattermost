// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
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
		return true, team.IsOpenToAllUsers() || a.scopeListsChannelOnTeam(rctx, scope, team)
	}

	return true, false
}

// scopeListsChannelOnTeam reports whether the scope lists, by ID, an in-scope
// channel on team, which makes the team itself visible to the session.
func (a *App) scopeListsChannelOnTeam(rctx request.CTX, scope *model.SessionScope, team *model.Team) bool {
	if team.DeleteAt != 0 {
		return false
	}
	for _, channelID := range scope.Resources.ChannelIDs {
		channel, appErr := a.GetChannel(rctx, channelID)
		if appErr == nil && channel.TeamId == team.Id && model.SessionScopeAllowsChannel(scope, channel, nil, false) {
			return true
		}
	}
	return false
}

// ScopeAllowsChannel reports whether channel is in scope, loading the channel's
// team only when the open-team grant needs it.
func (a *App) ScopeAllowsChannel(rctx request.CTX, scope *model.SessionScope, channel *model.Channel) bool {
	if scope == nil || channel == nil {
		return false
	}

	complianceEnabled := *a.Config().ComplianceSettings.Enable
	var team *model.Team
	if scope.Resources.OpenTeamPublicChannels && !complianceEnabled && channel.Type == model.ChannelTypeOpen && !scope.ListsChannel(channel.Id) {
		var appErr *model.AppError
		team, appErr = a.GetTeam(channel.TeamId)
		if appErr != nil {
			rctx.Logger().Debug("Failed to get team for session scope check", mlog.String("team_id", channel.TeamId), mlog.Err(appErr))
			return false
		}
	}

	return model.SessionScopeAllowsChannel(scope, channel, team, complianceEnabled)
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
	if rctx == nil {
		return false, false
	}
	session := rctx.Session()
	if session == nil || session.UserId == "" || session.UserId != userID {
		return false, false
	}
	return a.EvaluateSessionScope(rctx, session, permissionID, target)
}

// CreateScopedSession creates a session for userID that can only read what scope
// allows, on behalf of the plugin pluginID. It is the only way to create a
// scoped session.
func (a *App) CreateScopedSession(rctx request.CTX, pluginID, userID string, scope *model.SessionScope, expiresAt int64) (*model.Session, *model.AppError) {
	auditRec := a.MakeAuditRecord(rctx, model.AuditEventCreateScopedSession, model.AuditStatusFail)
	defer a.LogAuditRec(rctx, auditRec, nil)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)
	model.AddEventParameterToAuditRec(auditRec, "expires_at", expiresAt)
	auditRec.AddMeta(model.AuditKeyCreatedByPluginID, pluginID)

	if pluginID == "" {
		return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.plugin_id.app_error", nil, "", http.StatusBadRequest)
	}
	if scope == nil {
		return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.scope_missing.app_error", nil, "", http.StatusBadRequest)
	}

	scopeCopy := *scope
	scopeCopy.Permissions = slices.Clone(scope.Permissions)
	scopeCopy.Resources.ChannelIDs = slices.Clone(scope.Resources.ChannelIDs)
	scopeCopy.CreatedByPluginID = pluginID
	auditRec.AddMeta(model.AuditKeyOnBehalfOfUserID, scopeCopy.OnBehalfOfUserID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", scopeCopy.Resources.ChannelIDs)
	model.AddEventParameterToAuditRec(auditRec, "open_team_public_channels", scopeCopy.Resources.OpenTeamPublicChannels)
	model.AddEventParameterToAuditRec(auditRec, "permissions", scopeCopy.Permissions)

	if appErr := scopeCopy.IsValid(); appErr != nil {
		return nil, appErr
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

	for _, channelID := range scopeCopy.Resources.ChannelIDs {
		channel, chErr := a.GetChannel(rctx, channelID)
		if chErr != nil {
			return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.channel.app_error", nil, "channel_id="+channelID, http.StatusBadRequest).Wrap(chErr)
		}
		if channel.IsGroupOrDirect() {
			return nil, model.NewAppError("CreateScopedSession", "app.session.create_scoped.channel.app_error", nil, "direct or group channel_id="+channelID, http.StatusBadRequest)
		}
	}

	scopeJSON, err := json.Marshal(scopeCopy)
	if err != nil {
		return nil, model.NewAppError("CreateScopedSession", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	session := &model.Session{
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
	sessions, err := a.Srv().Store().Session().GetScopedSessions(rctx)
	if err != nil {
		return model.NewAppError("RevokeScopedSessionsForPlugin", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var revoked int
	for _, session := range sessions {
		scope, _ := session.Scope()
		if scope.CreatedByPluginID != pluginID {
			continue
		}
		if appErr := a.RevokeSession(rctx, session); appErr != nil {
			return appErr
		}
		revoked++
	}

	if revoked > 0 {
		rctx.Logger().Info("Revoked scoped sessions for disabled plugin", mlog.String("plugin_id", pluginID), mlog.Int("count", revoked))
	}
	return nil
}

func (ch *Channels) revokeScopedSessionsForPlugin(pluginID string) {
	rctx := request.EmptyContext(ch.srv.Log())
	if appErr := New(ServerConnector(ch)).RevokeScopedSessionsForPlugin(rctx, pluginID); appErr != nil {
		rctx.Logger().Error("Failed to revoke scoped sessions for plugin", mlog.String("plugin_id", pluginID), mlog.Err(appErr))
	}
}
