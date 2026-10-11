// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// conversationAction maps a channel-access action to the direct and group
// message action that governs it in a conversation: reading maps to
// dm_gm_read_access, and writing and managing both map to dm_gm_write_access.
func conversationAction(action string) string {
	switch action {
	case model.AccessControlPolicyActionChannelReadAccess:
		return model.AccessControlPolicyActionDMGMReadAccess
	case model.AccessControlPolicyActionChannelWriteAccess,
		model.AccessControlPolicyActionChannelManagementAccess:
		return model.AccessControlPolicyActionDMGMWriteAccess
	default:
		return action
	}
}

// governingAction is the action a channel-access gate evaluates for channel.
func governingAction(channel *model.Channel, action string) string {
	if channel.IsGroupOrDirect() {
		return conversationAction(action)
	}
	return action
}

// HasDMGMAccess reports whether a direct and group message action is allowed
// for userID. The answer is the same for every conversation, so it is memoised
// per user and action: one evaluation per request, however many conversations
// it touches. Like HasChannelReadAccess it records nothing for the error
// contract; enforcement gates use EnforceDMGMAccess.
func (a *App) HasDMGMAccess(rctx request.CTX, userID, action string) bool {
	if userID == "" || !a.ChannelAccessEnforcementActive() {
		return true
	}

	memo := getChannelAccessMemo(rctx)
	key := channelAccessKey{userID: userID, action: action}
	if memo != nil {
		if allowed, ok := memo.get(key); ok {
			return allowed
		}
	}

	allowed, _ := a.evaluateDMGMAccess(rctx, userID, action)
	if memo != nil {
		memo.set(key, allowed)
	}
	return allowed
}

// EnforceDMGMAccess is HasDMGMAccess for an enforcement gate: a denial is
// recorded so the handler reports the action's error id.
func (a *App) EnforceDMGMAccess(rctx request.CTX, userID, action string) bool {
	if a.HasDMGMAccess(rctx, userID, action) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, "", action)
	return false
}

// DirectAndGroupHidden reports whether the user's direct and group messages are
// hidden from them, which is what list predicates exclude.
func (a *App) DirectAndGroupHidden(rctx request.CTX, userID string) bool {
	return userID != "" && a.ChannelAccessEnforcementActive() &&
		!a.HasDMGMAccess(rctx, userID, model.AccessControlPolicyActionDMGMReadAccess)
}

// HasChannelWriteAccess reports whether the user may write in channel, without
// recording a denial.
func (a *App) HasChannelWriteAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	return a.channelWriteAccessDecision(rctx, userID, channel)
}

func (a *App) dmGmActionGoverned(rctx request.CTX, action string) bool {
	memo := getChannelAccessMemo(rctx)
	if memo != nil {
		if governed, ok := memo.getActionGoverned("", action); ok {
			return governed
		}
	}

	governed, appErr := a.Srv().Channels().AccessControl.ActionHasPermissionPolicy(rctx, action)
	if appErr != nil {
		// A failed governance check says nothing about whether a policy applies,
		// so evaluate rather than skip a gate that would deny.
		rctx.Logger().Debug("Failed to check whether permission policies govern the direct and group message action; evaluating anyway",
			mlog.String("action", action),
			mlog.Err(appErr),
		)
		governed = true
	}

	if memo != nil {
		memo.setActionGoverned("", action, governed)
	}
	return governed
}

// evaluateDMGMAccess evaluates a direct and group message action for userID
// against the system permission resource, never the conversation. It expects
// enforcement to be active. Session attributes are included only when userID is
// the session user; anyone else, such as a push recipient, is evaluated without
// a session. A subject-build or PDP error denies and is returned.
func (a *App) evaluateDMGMAccess(rctx request.CTX, userID, action string) (bool, *model.AppError) {
	if !a.dmGmActionGoverned(rctx, action) {
		return true, nil
	}

	subject, appErr := a.buildChannelAccessSubject(rctx, userID, "")
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for direct and group message evaluation; denying",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.Err(appErr),
		)
		return false, appErr
	}

	decision, appErr := a.Srv().Channels().AccessControl.AccessEvaluation(rctx, model.AccessRequest{
		Subject: *subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypePermission,
			ID:   "",
		},
		Action: action,
	})
	if appErr != nil {
		rctx.Logger().Warn("ABAC direct and group message evaluation failed; denying",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.Err(appErr),
		)
		return false, appErr
	}

	return decision.Decision, nil
}
