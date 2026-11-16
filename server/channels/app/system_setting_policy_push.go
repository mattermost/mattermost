// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// systemSettingPolicyPushActive reports whether any system_setting policy can
// produce overrides on this server, so callers can skip pushes entirely when
// the feature is off or no policy exists.
func (a *App) systemSettingPolicyPushActive(rctx request.CTX) bool {
	if a.Srv().Channels().AccessControl == nil ||
		!systemSettingPoliciesEnabled(a.Config()) ||
		!model.MinimumEnterpriseAdvancedLicense(a.License()) {
		return false
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies for override push", mlog.Err(err))
		return false
	}
	return len(policies) > 0
}

// pushClientConfigOverrides re-evaluates overrides for the user's sessions in
// the background and publishes them. An empty sessionID targets every session
// of the user. force pushes even to sessions whose role chain no policy
// targets, so a role change that moves a user out of a targeted role clears
// its overrides.
func (a *App) pushClientConfigOverrides(rctx request.CTX, userID, sessionID string, force bool) {
	if userID == "" || !a.systemSettingPolicyPushActive(rctx) {
		return
	}

	a.Srv().Go(func() {
		a.pushClientConfigOverridesForUser(request.EmptyContext(a.Log()), userID, sessionID, force)
	})
}

// pushClientConfigOverridesForEveryone re-evaluates overrides for every
// connected session, for changes such as attribute field mutations that may
// affect any user.
func (a *App) pushClientConfigOverridesForEveryone(rctx request.CTX) {
	if !a.systemSettingPolicyPushActive(rctx) {
		return
	}
	a.publishSystemSettingPolicyUpdate(rctx)
}

// pushClientConfigOverridesForUser evaluates overrides on this node for each
// targeted session of the user and publishes a single user-scoped event. Each
// connection picks the entry for its own session in
// systemSettingOverridesBySessionBroadcastHook, so other nodes never evaluate
// against attribute data they may not have caught up on yet.
func (a *App) pushClientConfigOverridesForUser(rctx request.CTX, userID, sessionID string, force bool) {
	sessions, appErr := a.GetSessions(rctx, userID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load sessions for client config override push", mlog.String("user_id", userID), mlog.Err(appErr))
		return
	}

	overridesBySession := make(map[string]map[string]string, len(sessions))
	for _, session := range sessions {
		if session.IsExpired() || (sessionID != "" && session.Id != sessionID) {
			continue
		}

		overrides, hasCandidate, evalErr := a.evaluateClientConfigOverrides(rctx.WithSession(session))
		if evalErr != nil {
			rctx.Logger().Warn("Failed to evaluate client config overrides for push",
				mlog.String("user_id", userID),
				mlog.String("session_id", session.Id),
				mlog.Err(evalErr),
			)
			continue
		}
		if !hasCandidate && !force {
			continue
		}
		overridesBySession[session.Id] = overrides
	}

	if len(overridesBySession) == 0 {
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", userID, nil, "")
	useSystemSettingOverridesBySessionHook(message, overridesBySession)
	a.Publish(message)
}
