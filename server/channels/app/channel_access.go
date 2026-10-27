// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"net/http"
	"slices"
	"strings"
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

// channelActionGovernedKey is the channel and action a governance answer was computed for.
type channelActionGovernedKey struct {
	channelID string
	action    string
}

// channelGovernance is whether any policy governs an action in a channel, and whether
// the channel's own policy is one of them.
type channelGovernance struct {
	governed        bool
	byChannelPolicy bool
}

// channelRoleKey is the user and channel a prefetched channel role belongs to.
type channelRoleKey struct {
	userID    string
	channelID string
}

type channelAccessMemo struct {
	mu             sync.Mutex
	decisions      map[channelAccessKey]bool
	actionGoverned map[channelActionGovernedKey]channelGovernance

	// subjects holds each user's subject without a channel role. Only that role
	// differs between a user's channels, so a request builds the rest once and
	// copies it per channel.
	subjects map[string]*model.Subject

	// channelRoles holds roles prepareChannelAccess fetched for a whole page in
	// one query, so evaluating each channel does not read its member row again.
	// An empty role is a fetched answer: the user is not a member.
	channelRoles map[channelRoleKey]string

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
	if m.decisions == nil {
		m.decisions = map[channelAccessKey]bool{}
	}
	m.decisions[key] = allowed
}

func (m *channelAccessMemo) getActionGoverned(channelID, action string) (governance channelGovernance, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	governance, ok = m.actionGoverned[channelActionGovernedKey{channelID: channelID, action: action}]
	return governance, ok
}

func (m *channelAccessMemo) setActionGoverned(channelID, action string, governance channelGovernance) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.actionGoverned == nil {
		m.actionGoverned = map[channelActionGovernedKey]channelGovernance{}
	}
	m.actionGoverned[channelActionGovernedKey{channelID: channelID, action: action}] = governance
}

func (m *channelAccessMemo) getSubject(userID string) *model.Subject {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.subjects[userID]
}

func (m *channelAccessMemo) setSubject(userID string, subject *model.Subject) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.subjects == nil {
		m.subjects = map[string]*model.Subject{}
	}
	m.subjects[userID] = subject
}

func (m *channelAccessMemo) getChannelRole(key channelRoleKey) (role string, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	role, ok = m.channelRoles[key]
	return role, ok
}

func (m *channelAccessMemo) setChannelRole(key channelRoleKey, role string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.channelRoles == nil {
		m.channelRoles = map[channelRoleKey]string{}
	}
	m.channelRoles[key] = role
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
	return rctx.WithContext(context.WithValue(rctx.Context(), channelAccessMemoKey{}, &channelAccessMemo{}))
}

func ChannelAccessEnforcementDenial(rctx request.CTX) (channelID string, action string) {
	memo := getChannelAccessMemo(rctx)
	if memo == nil {
		return "", ""
	}
	denial := memo.getEnforcementDenial()
	return denial.channelID, denial.action
}

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

func isChannelWritePermission(permission *model.Permission) bool {
	switch permission.Id {
	case model.PermissionAddReaction.Id,
		model.PermissionCreatePost.Id,
		model.PermissionCreatePostEphemeral.Id,
		model.PermissionCreatePostPublic.Id,
		model.PermissionDeleteOthersPosts.Id,
		model.PermissionDeletePost.Id,
		model.PermissionEditFileAttachment.Id,
		model.PermissionEditOthersPosts.Id,
		model.PermissionEditPost.Id,
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

func isChannelManagementPermission(permission *model.Permission) bool {
	switch permission.Id {
	case model.PermissionAddBookmarkPrivateChannel.Id,
		model.PermissionAddBookmarkPublicChannel.Id,
		model.PermissionConvertPrivateChannelToPublic.Id,
		model.PermissionConvertPublicChannelToPrivate.Id,
		model.PermissionDeleteBookmarkPrivateChannel.Id,
		model.PermissionDeleteBookmarkPublicChannel.Id,
		model.PermissionDeletePrivateChannel.Id,
		model.PermissionDeletePublicChannel.Id,
		model.PermissionEditBookmarkPrivateChannel.Id,
		model.PermissionEditBookmarkPublicChannel.Id,
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
		model.PermissionOrderBookmarkPublicChannel.Id:
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

func (a *App) EnforceChannelWriteAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	if a.channelWriteAccessDecision(rctx, userID, channel) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channel.Id, model.AccessControlPolicyActionChannelWriteAccess)
	return false
}

func (a *App) EnforceChannelWriteAccessByID(rctx request.CTX, userID, channelID string) bool {
	if a.channelWriteAccessDecisionByID(rctx, userID, channelID) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channelID, model.AccessControlPolicyActionChannelWriteAccess)
	return false
}

func (a *App) EnforceChannelManagementAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	if a.channelManagementAccessDecision(rctx, userID, channel) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channel.Id, model.AccessControlPolicyActionChannelManagementAccess)
	return false
}

func (a *App) EnforceChannelManagementAccessByID(rctx request.CTX, userID, channelID string) bool {
	if a.channelManagementAccessDecisionByID(rctx, userID, channelID) {
		return true
	}

	a.noteChannelAccessEnforcementDenial(rctx, userID, channelID, model.AccessControlPolicyActionChannelManagementAccess)
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

func (a *App) ChannelAccessEnforcementActive() bool {
	return a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		a.Srv().Channels().AccessControl != nil
}

// setupBroadcastHookForChannelReadAccess registers channelReadAccessBroadcastHook so each
// recipient's channel_read_access policy is evaluated before the event reaches them. The hook is
// left off when that evaluation would allow every recipient.
func (a *App) setupBroadcastHookForChannelReadAccess(channelID string, message *model.WebSocketEvent) {
	if channelID == "" || !a.ChannelAccessEnforcementActive() {
		return
	}

	rctx := request.EmptyContext(a.Log())
	channel, appErr := a.Srv().getChannel(rctx, channelID)
	if appErr != nil {
		// A channel that can't be loaded here keeps the hook, which loads it again per recipient.
		useChannelReadAccessHook(message, channelID, nil)
		return
	}
	if channelAccessExempt(channel) {
		return
	}

	governed, byChannelPolicy := a.channelAccessGoverned(rctx, channel, model.AccessControlPolicyActionChannelReadAccess)
	if governed {
		useChannelReadAccessHook(message, channelID, &byChannelPolicy)
	}
}

// attachChannelReadAccessHook is the platform's pre-publish hook: it filters every
// channel-scoped event of a channel whose channel_read_access is governed, except the
// events channelReadAccessExemptEvents lists.
func (a *App) attachChannelReadAccessHook(message *model.WebSocketEvent) {
	if !a.ChannelAccessEnforcementActive() {
		return
	}

	broadcast := message.GetBroadcast()
	if broadcast == nil || broadcast.ChannelId == "" {
		return
	}

	eventType := message.EventType()
	if _, exempt := channelReadAccessExemptEvents[eventType]; exempt || strings.HasPrefix(string(eventType), "custom_") {
		return
	}

	if slices.Contains(broadcast.BroadcastHooks, broadcastChannelReadAccess) ||
		slices.Contains(broadcast.BroadcastHooks, broadcastChannelReadAccessRedact) {
		return
	}

	rctx := request.EmptyContext(a.Log())
	// The bare cached read: governance comes from the policy cache, so the channel's
	// hydrated policy actions aren't needed.
	channel, appErr := a.Srv().getChannel(rctx, broadcast.ChannelId)
	if appErr != nil {
		rctx.Logger().Warn("Failed to resolve channel for channel_read_access; filtering the event anyway",
			mlog.String("channel_id", broadcast.ChannelId),
			mlog.String("event", string(eventType)),
			mlog.Err(appErr),
		)
		useChannelReadAccessHook(message, broadcast.ChannelId, nil)
		return
	}

	if channelAccessExempt(channel) {
		return
	}

	governed, byChannelPolicy := a.channelAccessGoverned(rctx, channel, model.AccessControlPolicyActionChannelReadAccess)
	if governed {
		useChannelReadAccessHook(message, broadcast.ChannelId, &byChannelPolicy)
	}
}

func (a *App) channelReadAccessWithholdsEmailContents(rctx request.CTX, channel *model.Channel) bool {
	if channel == nil || channelAccessExempt(channel) || !a.ChannelAccessEnforcementActive() {
		return false
	}

	return a.channelActionGoverned(rctx, channel, model.AccessControlPolicyActionChannelReadAccess)
}

// SetupBroadcastHookForChannelReadAccess exposes setupBroadcastHookForChannelReadAccess to
// services outside the app package that publish channel-scoped events.
func (a *App) SetupBroadcastHookForChannelReadAccess(channelID string, message *model.WebSocketEvent) {
	a.setupBroadcastHookForChannelReadAccess(channelID, message)
}

func (a *App) HasChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	return a.hasChannelAccess(rctx, userID, channel, model.AccessControlPolicyActionChannelReadAccess)
}

// channelWriteAccessDecision evaluates channel_write_access alone: a channel_read_access
// denial does not refuse a write.
func (a *App) channelWriteAccessDecision(rctx request.CTX, userID string, channel *model.Channel) bool {
	if !a.channelAccessGateApplies(userID, channel) {
		return true
	}

	// Integrations are out of scope. A bot has no interactive session, so a rule
	// over user.session.* has nothing to evaluate and would deny every bot post.
	// Webhook and plugin writes never reach a permission check at all, so they are
	// already exempt; this covers the one integration that does carry a session.
	if userID == rctx.Session().UserId && rctx.Session().IsBotUser() {
		return true
	}

	if !a.channelActionGoverned(rctx, channel, model.AccessControlPolicyActionChannelWriteAccess) {
		return true
	}

	return a.hasChannelAccess(rctx, userID, channel, model.AccessControlPolicyActionChannelWriteAccess)
}

// channelManagementAccessDecision evaluates channel_management_access alone. Unlike
// writes, bot sessions are evaluated too; system admins are never bound.
func (a *App) channelManagementAccessDecision(rctx request.CTX, userID string, channel *model.Channel) bool {
	if !a.channelAccessGateApplies(userID, channel) ||
		!a.channelActionGoverned(rctx, channel, model.AccessControlPolicyActionChannelManagementAccess) {
		return true
	}

	// After the governance check, which is memoised, so an ungoverned channel skips the
	// role lookup and the roles slice it allocates.
	if a.holdsManageSystem(rctx, userID) {
		return true
	}

	return a.hasChannelAccess(rctx, userID, channel, model.AccessControlPolicyActionChannelManagementAccess)
}

func (a *App) holdsManageSystem(rctx request.CTX, userID string) bool {
	if userID == rctx.Session().UserId {
		return a.SessionHasPermissionTo(*rctx.Session(), model.PermissionManageSystem)
	}
	return a.HasPermissionTo(rctx, userID, model.PermissionManageSystem)
}

func (a *App) channelActionGoverned(rctx request.CTX, channel *model.Channel, action string) bool {
	governed, _ := a.channelAccessGoverned(rctx, channel, action)
	return governed
}

// channelAccessGoverned reports whether any policy governs action in channel, and whether
// the channel's own policy is one of them. Only that lane reads the subject's channel role.
func (a *App) channelAccessGoverned(rctx request.CTX, channel *model.Channel, action string) (governed, byChannelPolicy bool) {
	memo := getChannelAccessMemo(rctx)
	if memo != nil {
		if governance, ok := memo.getActionGoverned(channel.Id, action); ok {
			return governance.governed, governance.byChannelPolicy
		}
	}

	governance := a.evaluateChannelAccessGoverned(rctx, channel, action)
	if memo != nil {
		memo.setActionGoverned(channel.Id, action, governance)
	}
	return governance.governed, governance.byChannelPolicy
}

func (a *App) evaluateChannelAccessGoverned(rctx request.CTX, channel *model.Channel, action string) channelGovernance {
	acs := a.Srv().Channels().AccessControl

	bySystemPolicy, appErr := acs.ActionHasPermissionPolicy(rctx, action)
	if appErr != nil {
		// A failed governance check says nothing about whether a policy applies, so
		// fall through to the evaluation rather than skipping a gate that would deny.
		rctx.Logger().Debug("Failed to check whether permission policies govern the channel action; evaluating anyway",
			mlog.String("action", action),
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		bySystemPolicy = true
	}

	// PolicyEnforced is false only when the channel has no policy of its own to ask about.
	var byChannelPolicy bool
	if channel.PolicyEnforced {
		byChannelPolicy, appErr = acs.ResourcePolicyGovernsAction(rctx, channel.Id, action)
		if appErr != nil {
			rctx.Logger().Debug("Failed to check whether the channel's policy governs the channel action; evaluating anyway",
				mlog.String("action", action),
				mlog.String("channel_id", channel.Id),
				mlog.Err(appErr),
			)
			byChannelPolicy = true
		}
	}

	return channelGovernance{governed: bySystemPolicy || byChannelPolicy, byChannelPolicy: byChannelPolicy}
}

func isChannelAccessAction(action string) bool {
	return action == model.AccessControlPolicyActionChannelReadAccess ||
		action == model.AccessControlPolicyActionChannelWriteAccess ||
		action == model.AccessControlPolicyActionChannelManagementAccess
}

func channelAccessExempt(channel *model.Channel) bool {
	return channel.IsGroupOrDirect()
}

func (a *App) channelAccessGateApplies(userID string, channel *model.Channel) bool {
	if channel == nil || userID == "" {
		return false
	}

	if channelAccessExempt(channel) {
		return false
	}

	return a.ChannelAccessEnforcementActive()
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
	governed, byChannelPolicy := a.channelAccessGoverned(rctx, channel, action)
	if !governed {
		return true
	}

	return a.evaluateGovernedChannelAccess(rctx, userID, channel.Id, action, byChannelPolicy)
}

// evaluateGovernedChannelAccess evaluates action for a channel already known to be governed,
// byChannelPolicy saying whether the channel's own policy is one of those governing it. The
// decision is cached across requests (channelAccessDecisionCache); a failed evaluation denies
// and is not cached, so the next call tries again.
func (a *App) evaluateGovernedChannelAccess(rctx request.CTX, userID, channelID, action string, byChannelPolicy bool) bool {
	key, sessionID, cacheable := channelAccessDecisionKeyFor(rctx, userID, channelID, action)
	if !cacheable {
		allowed, _ := a.evaluateGovernedChannelAccessUncached(rctx, userID, channelID, action, byChannelPolicy)
		return allowed
	}

	if allowed, ok := a.cachedChannelAccessDecision(key); ok {
		return allowed
	}

	seq := a.Srv().Channels().channelAccessDecisions.snapshot()
	allowed, evaluated := a.evaluateGovernedChannelAccessUncached(rctx, userID, channelID, action, byChannelPolicy)
	if evaluated {
		a.cacheChannelAccessDecision(rctx, key, userID, sessionID, seq, allowed)
	}
	return allowed
}

// evaluateGovernedChannelAccessUncached builds the subject and asks the PDP. evaluated is false
// when either step failed, in which case allowed is false.
func (a *App) evaluateGovernedChannelAccessUncached(rctx request.CTX, userID, channelID, action string, byChannelPolicy bool) (allowed, evaluated bool) {
	acs := a.Srv().Channels().AccessControl

	subject, appErr := a.channelAccessSubject(rctx, userID, channelID, byChannelPolicy)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for channel-access evaluation; denying",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return false, false
	}

	decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
		Subject: subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypeChannel,
			ID:   channelID,
		},
		Action: action,
	})
	if evalErr != nil {
		rctx.Logger().Warn("ABAC channel-access evaluation failed; denying",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.Err(evalErr),
		)
		return false, false
	}

	return decision.Decision, true
}

// channelAccessSubject returns the subject to evaluate userID against in one channel.
// The base subject comes from channelAccessBaseSubject; withChannelRole adds the user's
// role in the channel, taken from the roles prepareChannelAccess fetched for the page
// when it has one, and read from the member row otherwise.
func (a *App) channelAccessSubject(rctx request.CTX, userID, channelID string, withChannelRole bool) (model.Subject, *model.AppError) {
	base, appErr := a.channelAccessBaseSubject(rctx, userID)
	if appErr != nil {
		return model.Subject{}, appErr
	}

	// A copy: SetScopedRole allocates a fresh ScopedRoles slice, so the memoised
	// base never picks up one channel's role.
	subject := *base
	if !withChannelRole {
		return subject, nil
	}

	if memo := getChannelAccessMemo(rctx); memo != nil {
		if role, ok := memo.getChannelRole(channelRoleKey{userID: userID, channelID: channelID}); ok {
			subject.SetScopedRole(model.AccessControlSubjectScopeChannel, role)
			return subject, nil
		}
	}
	return a.attachChannelScopedRole(rctx, subject, userID, channelID)
}

// channelAccessBaseSubject returns userID's subject without a channel role. Nothing
// else in it depends on the channel, so a request with a memo builds it once per user
// rather than once per channel.
func (a *App) channelAccessBaseSubject(rctx request.CTX, userID string) (*model.Subject, *model.AppError) {
	memo := getChannelAccessMemo(rctx)
	if memo != nil {
		if subject := memo.getSubject(userID); subject != nil {
			return subject, nil
		}
	}

	var subject *model.Subject
	var appErr *model.AppError
	if rctx.Session().UserId == userID {
		subject, appErr = a.BuildAccessControlSubjectForSession(rctx, "")
	} else {
		var user *model.User
		user, appErr = a.GetUser(rctx, userID)
		if appErr != nil {
			return nil, appErr
		}
		subject, appErr = a.BuildAccessControlSubject(rctx, userID, user.Roles, "")
	}
	if appErr != nil {
		return nil, appErr
	}

	if memo != nil {
		memo.setSubject(userID, subject)
	}
	return subject, nil
}

// PrepareChannelReadAccess fetches userID's role in every channel of a page whose own
// policy declares channel_read_access, in one query, so evaluating the page does not read
// a member row per channel. It only fills the request memo: without one it does nothing,
// and a role it did not fetch is read when its channel is evaluated.
func (a *App) PrepareChannelReadAccess(rctx request.CTX, userID string, channels []*model.Channel) {
	a.prepareChannelAccess(rctx, userID, channels, model.AccessControlPolicyActionChannelReadAccess)
}

// PrepareChannelReadAccessByIDs is PrepareChannelReadAccess for callers that hold
// channel IDs. It reads the channels from the cache to see which need a role.
func (a *App) PrepareChannelReadAccessByIDs(rctx request.CTX, userID string, channelIDs []string) {
	a.prepareChannelAccessByIDs(rctx, userID, channelIDs, model.AccessControlPolicyActionChannelReadAccess)
}

func (a *App) prepareChannelAccess(rctx request.CTX, userID string, channels []*model.Channel, action string) {
	memo := getChannelAccessMemo(rctx)
	if memo == nil || userID == "" || len(channels) == 0 || !a.ChannelAccessEnforcementActive() {
		return
	}

	var channelIDs []string
	for _, channel := range channels {
		if channel == nil || channelAccessExempt(channel) {
			continue
		}
		if _, decided := memo.get(channelAccessKey{userID: userID, channelID: channel.Id, action: action}); decided {
			continue
		}
		if _, fetched := memo.getChannelRole(channelRoleKey{userID: userID, channelID: channel.Id}); fetched {
			continue
		}
		if _, byChannelPolicy := a.channelAccessGoverned(rctx, channel, action); byChannelPolicy {
			channelIDs = append(channelIDs, channel.Id)
		}
	}
	if len(channelIDs) == 0 {
		return
	}

	// The same cached read GetSubjectChannelRole makes, done once for the page.
	memberRoles, err := a.Srv().Store().Channel().GetChannelMemberRoles(rctx, userID, channelIDs, true)
	if err != nil {
		rctx.Logger().Warn("Failed to fetch channel roles for channel-access evaluation; reading them per channel",
			mlog.String("action", action),
			mlog.String("user_id", userID),
			mlog.Int("channels", len(channelIDs)),
			mlog.Err(err),
		)
		return
	}

	for _, channelID := range channelIDs {
		// No row means not a member, which GetSubjectChannelRole also reports as no role.
		var role string
		if cm, ok := memberRoles[channelID]; ok {
			role = channelRoleForMember(rctx, userID, channelID, cm)
		}
		memo.setChannelRole(channelRoleKey{userID: userID, channelID: channelID}, role)
	}
}

func (a *App) prepareChannelAccessByIDs(rctx request.CTX, userID string, channelIDs []string, action string) {
	if getChannelAccessMemo(rctx) == nil || len(channelIDs) == 0 || !a.ChannelAccessEnforcementActive() {
		return
	}

	channels, err := a.Srv().Store().Channel().GetMany(channelIDs, true)
	if err != nil {
		// Nothing to prepare; each channel is loaded and evaluated on its own.
		return
	}
	a.prepareChannelAccess(rctx, userID, channels, action)
}

func (a *App) FilterChannelIDsByReadAccess(rctx request.CTX, userID string, channelIDs []string) []string {
	if len(channelIDs) == 0 || !a.ChannelAccessEnforcementActive() {
		return channelIDs
	}

	a.PrepareChannelReadAccessByIDs(rctx, userID, channelIDs)

	filtered := make([]string, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if a.HasChannelReadAccessByID(rctx, userID, channelID) {
			filtered = append(filtered, channelID)
		}
	}
	return filtered
}

// FilterChannelIDsByManagementAccess drops the channels the user may not manage. Like the
// read filters it is deliberately non-recording: a filtered request succeeds, so there is
// no denial for SetPermissionError to report.
func (a *App) FilterChannelIDsByManagementAccess(rctx request.CTX, userID string, channelIDs []string) []string {
	if len(channelIDs) == 0 || !a.ChannelAccessEnforcementActive() {
		return channelIDs
	}

	a.prepareChannelAccessByIDs(rctx, userID, channelIDs, model.AccessControlPolicyActionChannelManagementAccess)

	filtered := make([]string, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if a.channelManagementAccessDecisionByID(rctx, userID, channelID) {
			filtered = append(filtered, channelID)
		}
	}
	return filtered
}

func (a *App) FilterChannelMembersByReadAccess(rctx request.CTX, userID string, members model.ChannelMembers) model.ChannelMembers {
	if len(members) == 0 || !a.ChannelAccessEnforcementActive() {
		return members
	}

	filtered := make(model.ChannelMembers, 0, len(members))
	for _, member := range members {
		if a.HasChannelReadAccessByID(rctx, userID, member.ChannelId) {
			filtered = append(filtered, member)
		}
	}
	return filtered
}

func (a *App) FilterChannelsByReadAccess(rctx request.CTX, userID string, channels []*model.Channel) []*model.Channel {
	if len(channels) == 0 || !a.ChannelAccessEnforcementActive() {
		return channels
	}

	a.PrepareChannelReadAccess(rctx, userID, channels)

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
	if len(channels) == 0 || !a.ChannelAccessEnforcementActive() {
		return channels, 0
	}

	page := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		page = append(page, &channel.Channel)
	}
	a.PrepareChannelReadAccess(rctx, userID, page)

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

// WarmChannelAccessSubject builds a new websocket connection's ABAC subject off the hub. The
// read-access broadcast hook builds the same subject on the hub for the connection's first
// governed event; doing it here first puts the user's attributes, user record and session
// attributes in their caches, so that build reads only memory. It runs when the connection
// registers, on a goroutine of its own.
func (a *App) WarmChannelAccessSubject(session *model.Session) {
	if session == nil || session.UserId == "" || !a.ChannelAccessEnforcementActive() {
		return
	}

	rctx := request.EmptyContext(a.Log()).WithSession(session)
	if _, appErr := a.BuildAccessControlSubjectForSession(rctx, ""); appErr != nil {
		rctx.Logger().Debug("Failed to warm the ABAC subject for a new websocket connection",
			mlog.String("user_id", session.UserId),
			mlog.Err(appErr),
		)
	}
}

// HasChannelReadAccessGoverned is HasChannelReadAccessByID for a caller that has already worked
// out the channel's governance: the channel_read_access broadcast hook, whose publisher loaded
// the channel once and found it governed, non-exempt, and byChannelPolicy or not. Skipping the
// channel load and the governance check matters there because the hook runs once per recipient
// on the websocket hub.
func (a *App) HasChannelReadAccessGoverned(rctx request.CTX, userID, channelID string, byChannelPolicy bool) bool {
	if channelID == "" || userID == "" || !a.ChannelAccessEnforcementActive() {
		return true
	}

	return a.evaluateGovernedChannelAccess(rctx, userID, channelID, model.AccessControlPolicyActionChannelReadAccess, byChannelPolicy)
}

func (a *App) hasChannelAccessByID(rctx request.CTX, userID, channelID string, check func(*model.Channel) bool) bool {
	if channelID == "" || !a.ChannelAccessEnforcementActive() {
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

func (a *App) channelWriteAccessDecisionByID(rctx request.CTX, userID, channelID string) bool {
	return a.hasChannelAccessByID(rctx, userID, channelID, func(channel *model.Channel) bool {
		return a.channelWriteAccessDecision(rctx, userID, channel)
	})
}

func (a *App) channelManagementAccessDecisionByID(rctx request.CTX, userID, channelID string) bool {
	return a.hasChannelAccessByID(rctx, userID, channelID, func(channel *model.Channel) bool {
		return a.channelManagementAccessDecision(rctx, userID, channel)
	})
}
