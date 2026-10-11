// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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

// DMGMStartAllowedForSession reports whether userID may start a new conversation.
// Start is evaluated only for the session user: plugins, system bots, webhooks, import
// and shared channels create conversations on nobody's behalf and are never refused.
func (a *App) DMGMStartAllowedForSession(rctx request.CTX, userID string) bool {
	if userID == "" || userID != rctx.Session().UserId {
		return true
	}
	return a.HasDMGMAccess(rctx, userID, model.AccessControlPolicyActionDMGMStart)
}

// GetDirectOrGroupChannelByName returns the conversation with the given name, or nil
// when there is none. Start applies only when a conversation would be created, so
// callers use it to tell reopening from starting.
func (a *App) GetDirectOrGroupChannelByName(rctx request.CTX, name string) (*model.Channel, *model.AppError) {
	channel, err := a.Srv().Store().Channel().GetByName("", name, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, nil
		}
		return nil, model.NewAppError("GetDirectOrGroupChannelByName", "app.channel.get_by_name.existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return channel, nil
}

// DirectAndGroupHidden reports whether the user's direct and group messages are
// hidden from them, which is what list predicates exclude.
func (a *App) DirectAndGroupHidden(rctx request.CTX, userID string) bool {
	return userID != "" && a.ChannelAccessEnforcementActive() &&
		!a.HasDMGMAccess(rctx, userID, model.AccessControlPolicyActionDMGMReadAccess)
}

// conversationPreviewWithheld reports whether a permalink preview of a post in channel
// must not be unfurled: a conversation post is never embedded while a policy governs
// reading conversations, which avoids evaluating every recipient.
func (a *App) conversationPreviewWithheld(rctx request.CTX, channel *model.Channel) bool {
	return channel.IsGroupOrDirect() && a.ChannelAccessEnforcementActive() &&
		a.dmGmActionGoverned(rctx, model.AccessControlPolicyActionDMGMReadAccess)
}

// dmGmReadDecisionTTL bounds how long a cached session decision lives, for the
// invalidations core can't see, such as a change made inside the policy engine.
const dmGmReadDecisionTTL = time.Minute

// dmGmReadDecision is a session's cached dm_gm_read_access decision and a digest of
// the inputs it was evaluated from.
type dmGmReadDecision struct {
	Inputs  string
	Allowed bool
}

// HasDirectAndGroupReadAccessForSession reports whether the session in rctx may read
// direct and group messages. Only the WebSocket hook uses it: it runs for every
// recipient of every conversation event, so the decision is cached per session and
// reused while the inputs it was evaluated from are unchanged. REST requests always
// evaluate live, through HasDMGMAccess.
func (a *App) HasDirectAndGroupReadAccessForSession(rctx request.CTX) bool {
	session := rctx.Session()
	if session.UserId == "" || !a.ChannelAccessEnforcementActive() {
		return true
	}

	inputs, err := a.dmGmReadDecisionInputs(rctx)
	if err != nil {
		rctx.Logger().Debug("Failed to read the inputs of the cached direct and group message decision; evaluating without the cache",
			mlog.String("user_id", session.UserId),
			mlog.Err(err),
		)
		allowed, _ := a.evaluateDMGMAccess(rctx, session.UserId, model.AccessControlPolicyActionDMGMReadAccess)
		return allowed
	}

	var cached dmGmReadDecision
	if a.ch.dmGmReadDecisions.Get(session.Id, &cached) == nil && cached.Inputs == inputs {
		return cached.Allowed
	}

	allowed, appErr := a.evaluateDMGMAccess(rctx, session.UserId, model.AccessControlPolicyActionDMGMReadAccess)
	if appErr != nil {
		// Denied, and not cached, so the next event evaluates again.
		return false
	}
	if err := a.ch.dmGmReadDecisions.SetWithDefaultExpiry(session.Id, dmGmReadDecision{Inputs: inputs, Allowed: allowed}); err != nil {
		rctx.Logger().Debug("Failed to cache the direct and group message decision", mlog.Err(err))
	}
	return allowed
}

// dmGmReadDecisionInputs digests what a session's direct and group message decision
// is evaluated from: its session attributes as the policy sees them (TTL and grace
// applied), the user's property values, the session roles, the user record and the
// permission policies. Any change to them misses the cache.
func (a *App) dmGmReadDecisionInputs(rctx request.CTX) (string, error) {
	session := rctx.Session()

	attrs, appErr := a.GetSessionAttributes(rctx, session.Id)
	if appErr != nil {
		return "", appErr
	}
	attrsJSON, err := json.Marshal(attrs)
	if err != nil {
		return "", err
	}

	propertyEpoch, err := a.Srv().Store().Attributes().GetUserPropertyValuesEpoch(rctx, session.UserId)
	if err != nil {
		return "", err
	}

	user, appErr := a.GetUser(rctx, session.UserId)
	if appErr != nil {
		return "", appErr
	}

	policyEpoch, err := a.Srv().Store().AccessControlPolicy().GetEtagEpoch(rctx, "")
	if err != nil {
		return "", err
	}

	digest := sha256.New()
	fmt.Fprintf(digest, "%s\x00%s\x00%s\x00%d\x00%s", attrsJSON, propertyEpoch, session.Roles, user.UpdateAt, policyEpoch)
	return hex.EncodeToString(digest.Sum(nil)), nil
}

// setupBroadcastHookForDirectAndGroupReadAccess registers dmGmReadAccessBroadcastHook on an
// event about a direct or group message channel, so it reaches only sessions that may read
// conversations. It does nothing for any other channel.
func (a *App) setupBroadcastHookForDirectAndGroupReadAccess(channel *model.Channel, message *model.WebSocketEvent) {
	if channel.IsGroupOrDirect() {
		a.setupBroadcastHookForConversationReadAccess(message)
	}
}

// setupBroadcastHookForDirectAndGroupReadAccessByID is setupBroadcastHookForDirectAndGroupReadAccess
// for a channel id. A channel that can't be loaded gets the channel read hook, which loads it
// again per recipient and evaluates whichever action governs it.
func (a *App) setupBroadcastHookForDirectAndGroupReadAccessByID(channelID string, message *model.WebSocketEvent) {
	if channelID == "" || !a.ChannelAccessEnforcementActive() {
		return
	}

	channel, appErr := a.Srv().getChannel(request.EmptyContext(a.Log()), channelID)
	if appErr != nil {
		useChannelReadAccessHook(message, channelID)
		return
	}
	a.setupBroadcastHookForDirectAndGroupReadAccess(channel, message)
}

// setupBroadcastHookForConversationReadAccess registers dmGmReadAccessBroadcastHook on an
// event that only concerns direct and group messages. The hook is left off while no policy
// governs reading them, so the event costs nothing then.
func (a *App) setupBroadcastHookForConversationReadAccess(message *model.WebSocketEvent) {
	if !a.ChannelAccessEnforcementActive() ||
		!a.dmGmActionGoverned(request.EmptyContext(a.Log()), model.AccessControlPolicyActionDMGMReadAccess) {
		return
	}
	useDMGMReadAccessHook(message)
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
