// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type channelAccessMemoKey struct{}

type channelAccessKey struct {
	userID    string
	channelID string
	action    string
}

// channelAccessDenial is the channel and action an *enforcement* gate denied for
// the requesting session.
type channelAccessDenial struct {
	channelID string
	action    string
}

type channelAccessMemo struct {
	mu        sync.Mutex
	decisions map[channelAccessKey]bool

	// writeGoverned caches, per channel, whether channel_write_access governs it
	// at all. Answering that can cost a policy read, and the write gate asks on
	// every write in the request.
	writeGoverned map[string]bool

	// enforcementDenial is the channel an *enforcement* gate denied for the
	// requesting session, deliberately not the same thing as a false entry in
	// decisions: filters and mention sanitisers record denials and still return
	// 200, so a decision alone cannot say why a request is failing. The action is
	// recorded with it because a write may be denied by either channel-access
	// policy, and the client switches on which.
	enforcementDenial channelAccessDenial
}

func (m *channelAccessMemo) get(key channelAccessKey) (allowed bool, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	allowed, ok = m.decisions[key]
	return allowed, ok
}

func (m *channelAccessMemo) set(key channelAccessKey, allowed bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.decisions[key] = allowed
}

func (m *channelAccessMemo) getWriteGoverned(channelID string) (governed bool, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	governed, ok = m.writeGoverned[channelID]
	return governed, ok
}

func (m *channelAccessMemo) setWriteGoverned(channelID string, governed bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.writeGoverned[channelID] = governed
}

func (m *channelAccessMemo) noteEnforcementDenial(denial channelAccessDenial) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.enforcementDenial = denial
}

func (m *channelAccessMemo) getEnforcementDenial() channelAccessDenial {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.enforcementDenial
}

func getChannelAccessMemo(rctx request.CTX) *channelAccessMemo {
	if v := rctx.Context().Value(channelAccessMemoKey{}); v != nil {
		if memo, ok := v.(*channelAccessMemo); ok {
			return memo
		}
	}
	return nil
}

func WithChannelAccessMemo(rctx request.CTX) request.CTX {
	if getChannelAccessMemo(rctx) != nil {
		return rctx
	}
	memo := &channelAccessMemo{
		decisions:     map[channelAccessKey]bool{},
		writeGoverned: map[string]bool{},
	}
	return rctx.WithContext(context.WithValue(rctx.Context(), channelAccessMemoKey{}, memo))
}

// ChannelAccessEnforcementDenial reports the channel an enforcement gate denied
// on this request and the channel-access action that denied it. Both are empty
// when no gate denied.
func ChannelAccessEnforcementDenial(rctx request.CTX) (channelID string, action string) {
	memo := getChannelAccessMemo(rctx)
	if memo == nil {
		return "", ""
	}
	denial := memo.getEnforcementDenial()
	return denial.channelID, denial.action
}

// ChannelAccessDeniedErrorID maps a channel-access action to the error id its
// denial reports. Clients switch on these to tell a policy denial from being
// removed from the channel, and a read denial from a write denial.
func ChannelAccessDeniedErrorID(action string) string {
	if action == model.AccessControlPolicyActionChannelWriteAccess {
		return "api.channel.channel_write_access.abac_denied.app_error"
	}
	return "api.channel.channel_read_access.abac_denied.app_error"
}

// isChannelReadPermission reports whether a channel permission means "read this
// channel". Only reads are gated on channel_read_access; every other permission is a
// write, and those are channel_write_access's question. A new read permission that is
// not listed here silently escapes the gate, which is what
// TestChannelPermissionClassification exists to catch.
func isChannelReadPermission(permission *model.Permission) bool {
	switch permission.Id {
	case model.PermissionReadChannel.Id,
		model.PermissionReadChannelContent.Id,
		model.PermissionReadPublicChannelGroups.Id,
		model.PermissionReadPrivateChannelGroups.Id:
		return true
	default:
		return false
	}
}

// isChannelWritePermission reports whether a channel permission means "change
// this channel or its content". It is a deliberate allowlist rather than "not a
// read": a new channel permission must be classified by hand, and
// TestChannelPermissionClassification fails until it is.
//
// read_deleted_posts is on neither list. It never reaches the channel gates —
// it only shapes an error payload behind an IsSystemAdmin check.
func isChannelWritePermission(permission *model.Permission) bool {
	switch permission.Id {
	case model.PermissionAddBookmarkPrivateChannel.Id,
		model.PermissionAddBookmarkPublicChannel.Id,
		model.PermissionAddReaction.Id,
		model.PermissionConvertPrivateChannelToPublic.Id,
		model.PermissionConvertPublicChannelToPrivate.Id,
		model.PermissionCreatePost.Id,
		model.PermissionCreatePostEphemeral.Id,
		model.PermissionCreatePostPublic.Id,
		model.PermissionDeleteBookmarkPrivateChannel.Id,
		model.PermissionDeleteBookmarkPublicChannel.Id,
		model.PermissionDeleteOthersPosts.Id,
		model.PermissionDeletePost.Id,
		model.PermissionDeletePrivateChannel.Id,
		model.PermissionDeletePublicChannel.Id,
		model.PermissionEditBookmarkPrivateChannel.Id,
		model.PermissionEditBookmarkPublicChannel.Id,
		model.PermissionEditFileAttachment.Id,
		model.PermissionEditOthersPosts.Id,
		model.PermissionEditPost.Id,
		model.PermissionManageChannelAccessRules.Id,
		model.PermissionManageChannelJoinRequests.Id,
		model.PermissionManageChannelRoles.Id,
		model.PermissionManagePrivateChannelAutoTranslation.Id,
		model.PermissionManagePrivateChannelBanner.Id,
		model.PermissionManagePrivateChannelDiscoverability.Id,
		model.PermissionManagePrivateChannelMembers.Id,
		model.PermissionManagePrivateChannelProperties.Id,
		model.PermissionManagePublicChannelAutoTranslation.Id,
		model.PermissionManagePublicChannelBanner.Id,
		model.PermissionManagePublicChannelMembers.Id,
		model.PermissionManagePublicChannelProperties.Id,
		model.PermissionOrderBookmarkPrivateChannel.Id,
		model.PermissionOrderBookmarkPublicChannel.Id,
		model.PermissionRemoveOthersReactions.Id,
		model.PermissionRemoveReaction.Id,
		model.PermissionUploadFile.Id,
		model.PermissionUseChannelMentions.Id,
		model.PermissionUseGroupMentions.Id,
		model.PermissionUseSlashCommands.Id:
		return true
	default:
		return false
	}
}

func (a *App) EnforceChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	if a.HasChannelReadAccess(rctx, userID, channel) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channel.Id, model.AccessControlPolicyActionChannelReadAccess)
	return false
}

func (a *App) EnforceChannelReadAccessByID(rctx request.CTX, userID, channelID string) bool {
	if a.HasChannelReadAccessByID(rctx, userID, channelID) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channelID, model.AccessControlPolicyActionChannelReadAccess)
	return false
}

// EnforceChannelWriteAccess denies the write and records why, so the handler's
// SetPermissionError can report whether the read or the write policy refused.
func (a *App) EnforceChannelWriteAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	allowed, deniedAction := a.channelWriteAccessDecision(rctx, userID, channel)
	if allowed {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channel.Id, deniedAction)
	return false
}

func (a *App) EnforceChannelWriteAccessByID(rctx request.CTX, userID, channelID string) bool {
	allowed, deniedAction := a.channelWriteAccessDecisionByID(rctx, userID, channelID)
	if allowed {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channelID, deniedAction)
	return false
}

func (a *App) noteChannelAccessEnforcementDenial(rctx request.CTX, userID, channelID, action string) {
	if channelID == "" || userID != rctx.Session().UserId {
		return
	}

	if memo := getChannelAccessMemo(rctx); memo != nil {
		memo.noteEnforcementDenial(channelAccessDenial{channelID: channelID, action: action})
	}
}

func (a *App) channelAccessEnforcementActive() bool {
	return a.Config().FeatureFlags.IsChannelAccessABACPermissionEnabled() &&
		a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		a.Srv().Channels().AccessControl != nil
}

func (a *App) HasChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	return a.hasChannelAccess(rctx, userID, channel, model.AccessControlPolicyActionChannelReadAccess)
}

// HasChannelWriteAccess reports whether the user may write to the channel.
//
// Writes stay ungated unless a channel_write_access policy governs the channel:
// a deployment that only restricts reading must not start refusing posts. Once
// one does govern, both channel-access policies must allow — a session that may
// not read the channel may not write to it either.
func (a *App) HasChannelWriteAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	allowed, _ := a.channelWriteAccessDecision(rctx, userID, channel)
	return allowed
}

// channelWriteAccessDecision returns whether the write is allowed and, on a
// denial, the channel-access action that refused it.
func (a *App) channelWriteAccessDecision(rctx request.CTX, userID string, channel *model.Channel) (allowed bool, deniedAction string) {
	if !a.channelAccessGateApplies(userID, channel) {
		return true, ""
	}

	// Integrations are out of scope. A bot has no interactive session, so a rule
	// over user.session.* has nothing to evaluate and would deny every bot post.
	// Webhook and plugin writes never reach a permission check at all, so they are
	// already exempt; this covers the one integration that does carry a session.
	if userID == rctx.Session().UserId && rctx.Session().IsBotUser() {
		return true, ""
	}

	if !a.channelWriteAccessGoverned(rctx, channel) {
		return true, ""
	}

	if !a.hasChannelAccess(rctx, userID, channel, model.AccessControlPolicyActionChannelReadAccess) {
		return false, model.AccessControlPolicyActionChannelReadAccess
	}

	if !a.hasChannelAccess(rctx, userID, channel, model.AccessControlPolicyActionChannelWriteAccess) {
		return false, model.AccessControlPolicyActionChannelWriteAccess
	}

	return true, ""
}

// channelWriteAccessGoverned reports whether any policy puts channel_write_access
// in play for this channel. A channel policy that carries only a read rule does
// not: evaluating the write action against it would allow vacuously, and then
// the read half of the write gate would deny a write nothing asked to restrict.
func (a *App) channelWriteAccessGoverned(rctx request.CTX, channel *model.Channel) bool {
	memo := getChannelAccessMemo(rctx)
	if memo != nil {
		if governed, ok := memo.getWriteGoverned(channel.Id); ok {
			return governed
		}
	}

	governed := a.evaluateChannelWriteAccessGoverned(rctx, channel)
	if memo != nil {
		memo.setWriteGoverned(channel.Id, governed)
	}
	return governed
}

func (a *App) evaluateChannelWriteAccessGoverned(rctx request.CTX, channel *model.Channel) bool {
	acs := a.Srv().Channels().AccessControl

	governed, appErr := acs.ActionHasPermissionPolicy(rctx, model.AccessControlPolicyActionChannelWriteAccess)
	if appErr != nil {
		// A failed governance check says nothing about whether a policy applies, so
		// fall through to the evaluation rather than skipping a gate that would deny.
		rctx.Logger().Debug("Failed to check whether permission policies govern channel_write_access; evaluating anyway",
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		return true
	}
	if governed {
		return true
	}

	if !channel.PolicyEnforced {
		return false
	}

	// A channel resource policy is stored under the channel id.
	policy, appErr := acs.GetPolicy(rctx, channel.Id)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load the channel policy for channel_write_access governance; evaluating anyway",
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		return true
	}

	return policy.HasAction(model.AccessControlPolicyActionChannelWriteAccess)
}

// channelAccessGateApplies reports whether the channel-access gates have anything
// to say at all. DMs and GMs are out of scope for both actions, and the gates are
// inert until the feature is licensed, enabled and flagged on.
func (a *App) channelAccessGateApplies(userID string, channel *model.Channel) bool {
	if channel == nil || userID == "" {
		return false
	}

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return false
	}

	return a.channelAccessEnforcementActive()
}

func (a *App) hasChannelAccess(rctx request.CTX, userID string, channel *model.Channel, action string) bool {
	if !a.channelAccessGateApplies(userID, channel) {
		return true
	}

	memo := getChannelAccessMemo(rctx)
	key := channelAccessKey{userID: userID, channelID: channel.Id, action: action}
	if memo != nil {
		if allowed, ok := memo.get(key); ok {
			return allowed
		}
	}

	allowed := a.evaluateChannelAccess(rctx, userID, channel, action)
	if memo != nil {
		memo.set(key, allowed)
	}
	return allowed
}

func (a *App) evaluateChannelAccess(rctx request.CTX, userID string, channel *model.Channel, action string) bool {
	acs := a.Srv().Channels().AccessControl

	governed, appErr := acs.ActionHasPermissionPolicy(rctx, action)
	if appErr != nil {
		// Evaluate rather than short-circuit: a failed governance check says nothing
		// about whether a policy applies, and every other failure here denies.
		governed = true
		rctx.Logger().Debug("Failed to check whether permission policies govern the channel-access action; evaluating anyway",
			mlog.String("action", action),
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
	}
	if !governed && !channel.PolicyEnforced {
		return true
	}

	subject, appErr := a.buildChannelAccessSubject(rctx, userID, channel.Id)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for channel-access evaluation; denying",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		return false
	}

	decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
		Subject: *subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypeChannel,
			ID:   channel.Id,
		},
		Action: action,
	})
	if evalErr != nil {
		rctx.Logger().Warn("ABAC channel-access evaluation failed; denying",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(evalErr),
		)
		return false
	}

	return decision.Decision
}

func (a *App) buildChannelAccessSubject(rctx request.CTX, userID, channelID string) (*model.Subject, *model.AppError) {
	if rctx.Session().UserId == userID {
		return a.BuildAccessControlSubjectForSession(rctx, channelID)
	}

	user, appErr := a.GetUser(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}
	return a.BuildAccessControlSubject(rctx, userID, user.Roles, channelID)
}

func (a *App) FilterChannelIDsByReadAccess(rctx request.CTX, userID string, channelIDs []string) []string {
	if len(channelIDs) == 0 || !a.channelAccessEnforcementActive() {
		return channelIDs
	}

	filtered := make([]string, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if a.HasChannelReadAccessByID(rctx, userID, channelID) {
			filtered = append(filtered, channelID)
		}
	}
	return filtered
}

func (a *App) FilterChannelsByReadAccess(rctx request.CTX, userID string, channels []*model.Channel) []*model.Channel {
	if len(channels) == 0 || !a.channelAccessEnforcementActive() {
		return channels
	}

	filtered := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		if a.HasChannelReadAccess(rctx, userID, channel) {
			filtered = append(filtered, channel)
		}
	}
	return filtered
}

func (a *App) FilterChannelListByReadAccess(rctx request.CTX, userID string, channels model.ChannelList) model.ChannelList {
	return a.FilterChannelsByReadAccess(rctx, userID, channels)
}

func (a *App) FilterChannelListWithTeamDataByReadAccess(rctx request.CTX, userID string, channels model.ChannelListWithTeamData) (kept model.ChannelListWithTeamData, dropped int) {
	if len(channels) == 0 || !a.channelAccessEnforcementActive() {
		return channels, 0
	}

	filtered := make(model.ChannelListWithTeamData, 0, len(channels))
	for _, channel := range channels {
		if a.HasChannelReadAccess(rctx, userID, &channel.Channel) {
			filtered = append(filtered, channel)
		}
	}
	return filtered, len(channels) - len(filtered)
}

func (a *App) HasChannelReadAccessByID(rctx request.CTX, userID, channelID string) bool {
	return a.hasChannelAccessByID(rctx, userID, channelID, func(channel *model.Channel) bool {
		return a.HasChannelReadAccess(rctx, userID, channel)
	})
}

func (a *App) HasChannelWriteAccessByID(rctx request.CTX, userID, channelID string) bool {
	return a.hasChannelAccessByID(rctx, userID, channelID, func(channel *model.Channel) bool {
		return a.HasChannelWriteAccess(rctx, userID, channel)
	})
}

// hasChannelAccessByID resolves the channel and hands it to check. Nothing to
// gate — no channel id, an inactive gate, a channel that no longer exists —
// allows; a channel that exists but cannot be loaded denies, because failing
// open there would let a store error bypass the policy.
func (a *App) hasChannelAccessByID(rctx request.CTX, userID, channelID string, check func(*model.Channel) bool) bool {
	if channelID == "" || !a.channelAccessEnforcementActive() {
		return true
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return true
		}
		rctx.Logger().Warn("Failed to resolve channel for channel-access evaluation; denying",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return false
	}

	return check(channel)
}

// channelWriteAccessDecisionByID is channelWriteAccessDecision for callers that
// hold only a channel id.
func (a *App) channelWriteAccessDecisionByID(rctx request.CTX, userID, channelID string) (allowed bool, deniedAction string) {
	if channelID == "" || !a.channelAccessEnforcementActive() {
		return true, ""
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return true, ""
		}
		rctx.Logger().Warn("Failed to resolve channel for channel_write_access evaluation; denying",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return false, model.AccessControlPolicyActionChannelWriteAccess
	}

	return a.channelWriteAccessDecision(rctx, userID, channel)
}
