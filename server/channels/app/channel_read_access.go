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

type channelReadAccessMemoKey struct{}

type channelReadAccessKey struct {
	userID    string
	channelID string
}
type channelReadAccessMemo struct {
	mu        sync.Mutex
	decisions map[channelReadAccessKey]bool

	// subjects holds each user's subject without a channel role. Only that role
	// differs between a user's channels, so a request builds the rest once and
	// copies it per channel.
	subjects map[string]*model.Subject

	// channelRoles holds roles PrepareChannelReadAccess fetched for a whole page in
	// one query, so evaluating each channel does not read its member row again.
	// An empty role is a fetched answer: the user is not a member.
	channelRoles map[channelReadAccessKey]string

	// enforcementDenial is the channel an *enforcement* gate denied for the
	// requesting session, deliberately not the same thing as a false entry in
	// decisions: filters and mention sanitisers record denials and still return
	// 200, so a decision alone cannot say why a request is failing.
	enforcementDenial string
}

func (m *channelReadAccessMemo) get(key channelReadAccessKey) (allowed bool, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	allowed, ok = m.decisions[key]
	return allowed, ok
}

func (m *channelReadAccessMemo) set(key channelReadAccessKey, allowed bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.decisions[key] = allowed
}

func (m *channelReadAccessMemo) getSubject(userID string) *model.Subject {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.subjects[userID]
}

func (m *channelReadAccessMemo) setSubject(userID string, subject *model.Subject) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.subjects[userID] = subject
}

func (m *channelReadAccessMemo) getChannelRole(key channelReadAccessKey) (role string, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	role, ok = m.channelRoles[key]
	return role, ok
}

func (m *channelReadAccessMemo) setChannelRole(key channelReadAccessKey, role string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.channelRoles[key] = role
}

func (m *channelReadAccessMemo) noteEnforcementDenial(channelID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.enforcementDenial = channelID
}

func (m *channelReadAccessMemo) getEnforcementDenial() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.enforcementDenial
}

func getChannelReadAccessMemo(rctx request.CTX) *channelReadAccessMemo {
	if v := rctx.Context().Value(channelReadAccessMemoKey{}); v != nil {
		if memo, ok := v.(*channelReadAccessMemo); ok {
			return memo
		}
	}
	return nil
}

func WithChannelReadAccessMemo(rctx request.CTX) request.CTX {
	if getChannelReadAccessMemo(rctx) != nil {
		return rctx
	}
	memo := &channelReadAccessMemo{
		decisions:    map[channelReadAccessKey]bool{},
		subjects:     map[string]*model.Subject{},
		channelRoles: map[channelReadAccessKey]string{},
	}
	return rctx.WithContext(context.WithValue(rctx.Context(), channelReadAccessMemoKey{}, memo))
}

func ChannelReadAccessEnforcementDenial(rctx request.CTX) string {
	memo := getChannelReadAccessMemo(rctx)
	if memo == nil {
		return ""
	}
	return memo.getEnforcementDenial()
}

// isChannelReadPermission reports whether a channel permission means "read this
// channel". Only reads are gated on channel_read_access; every other permission is a
// write, and those are channel_write_access's question. A new read permission that is
// not listed here silently escapes the gate, which is what
// TestChannelReadPermissionClassification exists to catch.
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

func (a *App) EnforceChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	if a.HasChannelReadAccess(rctx, userID, channel) {
		return true
	}

	a.noteChannelReadAccessEnforcementDenial(rctx, userID, channel.Id)
	return false
}

func (a *App) EnforceChannelReadAccessByID(rctx request.CTX, userID, channelID string) bool {
	if a.HasChannelReadAccessByID(rctx, userID, channelID) {
		return true
	}

	a.noteChannelReadAccessEnforcementDenial(rctx, userID, channelID)
	return false
}

func (a *App) noteChannelReadAccessEnforcementDenial(rctx request.CTX, userID, channelID string) {
	if channelID == "" || userID != rctx.Session().UserId {
		return
	}

	if memo := getChannelReadAccessMemo(rctx); memo != nil {
		memo.noteEnforcementDenial(channelID)
	}
}

func (a *App) channelReadAccessEnforcementActive() bool {
	return a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		a.Srv().Channels().AccessControl != nil
}

func (a *App) channelReadAccessWithholdsEmailContents(rctx request.CTX, channel *model.Channel) bool {
	if channel == nil || channel.IsGroupOrDirect() || !a.channelReadAccessEnforcementActive() {
		return false
	}

	governed, _ := a.channelReadAccessGoverned(rctx, channel)
	return governed
}

func (a *App) setupBroadcastHookForChannelReadAccess(channelID string, message *model.WebSocketEvent) {
	if channelID == "" || !a.channelReadAccessEnforcementActive() {
		return
	}

	useChannelReadAccessHook(message, channelID)
}

// SetupBroadcastHookForChannelReadAccess exposes setupBroadcastHookForChannelReadAccess to
// services outside the app package that publish channel-scoped events.
func (a *App) SetupBroadcastHookForChannelReadAccess(channelID string, message *model.WebSocketEvent) {
	a.setupBroadcastHookForChannelReadAccess(channelID, message)
}

func (a *App) HasChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	if channel == nil || userID == "" {
		return true
	}

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return true
	}

	if !a.channelReadAccessEnforcementActive() {
		return true
	}

	memo := getChannelReadAccessMemo(rctx)
	key := channelReadAccessKey{userID: userID, channelID: channel.Id}
	if memo != nil {
		if allowed, ok := memo.get(key); ok {
			return allowed
		}
	}

	allowed := a.evaluateChannelReadAccess(rctx, userID, channel)
	if memo != nil {
		memo.set(key, allowed)
	}
	return allowed
}

func (a *App) channelReadAccessGoverned(rctx request.CTX, channel *model.Channel) (governed, byChannelPolicy bool) {
	acs := a.Srv().Channels().AccessControl
	action := model.AccessControlPolicyActionChannelReadAccess

	bySystemPolicy, appErr := acs.ActionHasPermissionPolicy(rctx, action)
	if appErr != nil {
		rctx.Logger().Debug("Failed to check whether permission policies govern channel_read_access; evaluating anyway",
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		bySystemPolicy = true
	}

	// PolicyEnforced is false only when the channel has no policy of its own to ask about.
	if channel.PolicyEnforced {
		byChannelPolicy, appErr = acs.ResourcePolicyGovernsAction(rctx, channel.Id, action)
		if appErr != nil {
			rctx.Logger().Debug("Failed to check whether the channel's policy governs channel_read_access; evaluating anyway",
				mlog.String("channel_id", channel.Id),
				mlog.Err(appErr),
			)
			byChannelPolicy = true
		}
	}

	return bySystemPolicy || byChannelPolicy, byChannelPolicy
}

func (a *App) evaluateChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	acs := a.Srv().Channels().AccessControl

	governed, byChannelPolicy := a.channelReadAccessGoverned(rctx, channel)
	if !governed {
		return true
	}

	subject, appErr := a.channelReadAccessSubject(rctx, userID, channel.Id, byChannelPolicy)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for channel_read_access evaluation; denying",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
		return false
	}

	decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
		Subject: subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypeChannel,
			ID:   channel.Id,
		},
		Action: model.AccessControlPolicyActionChannelReadAccess,
	})
	if evalErr != nil {
		rctx.Logger().Warn("ABAC channel_read_access evaluation failed; denying",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(evalErr),
		)
		return false
	}

	return decision.Decision
}

// channelReadAccessSubject returns the subject to evaluate userID against in one
// channel. The base subject comes from channelReadAccessBaseSubject; withChannelRole
// adds the user's role in the channel, taken from the roles PrepareChannelReadAccess
// fetched for the page when it has one, and read from the member row otherwise.
func (a *App) channelReadAccessSubject(rctx request.CTX, userID, channelID string, withChannelRole bool) (model.Subject, *model.AppError) {
	base, appErr := a.channelReadAccessBaseSubject(rctx, userID)
	if appErr != nil {
		return model.Subject{}, appErr
	}

	// A copy: SetScopedRole allocates a fresh ScopedRoles slice, so the memoised
	// base never picks up one channel's role.
	subject := *base
	if !withChannelRole {
		return subject, nil
	}

	if memo := getChannelReadAccessMemo(rctx); memo != nil {
		if role, ok := memo.getChannelRole(channelReadAccessKey{userID: userID, channelID: channelID}); ok {
			subject.SetScopedRole(model.AccessControlSubjectScopeChannel, role)
			return subject, nil
		}
	}
	return a.attachChannelScopedRole(rctx, subject, userID, channelID)
}

// channelReadAccessBaseSubject returns userID's subject without a channel role.
// Nothing else in it depends on the channel, so a request with a memo builds it once
// per user rather than once per channel.
func (a *App) channelReadAccessBaseSubject(rctx request.CTX, userID string) (*model.Subject, *model.AppError) {
	memo := getChannelReadAccessMemo(rctx)
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
	memo := getChannelReadAccessMemo(rctx)
	if memo == nil || userID == "" || len(channels) == 0 || !a.channelReadAccessEnforcementActive() {
		return
	}

	var channelIDs []string
	for _, channel := range channels {
		if channel == nil || channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
			continue
		}
		key := channelReadAccessKey{userID: userID, channelID: channel.Id}
		if _, decided := memo.get(key); decided {
			continue
		}
		if _, fetched := memo.getChannelRole(key); fetched {
			continue
		}
		if _, byChannelPolicy := a.channelReadAccessGoverned(rctx, channel); byChannelPolicy {
			channelIDs = append(channelIDs, channel.Id)
		}
	}
	if len(channelIDs) == 0 {
		return
	}

	members, err := a.Srv().Store().Channel().GetMembersByChannelIds(channelIDs, userID)
	if err != nil {
		rctx.Logger().Warn("Failed to fetch channel roles for channel_read_access evaluation; reading them per channel",
			mlog.String("user_id", userID),
			mlog.Int("channels", len(channelIDs)),
			mlog.Err(err),
		)
		return
	}

	roles := make(map[string]string, len(members))
	for i := range members {
		roles[members[i].ChannelId] = channelRoleForMember(rctx, &members[i])
	}
	for _, channelID := range channelIDs {
		// No row means not a member, which GetSubjectChannelRole also reports as no role.
		memo.setChannelRole(channelReadAccessKey{userID: userID, channelID: channelID}, roles[channelID])
	}
}

// PrepareChannelReadAccessByIDs is PrepareChannelReadAccess for callers that hold
// channel IDs. It reads the channels from the cache to see which need a role.
func (a *App) PrepareChannelReadAccessByIDs(rctx request.CTX, userID string, channelIDs []string) {
	if getChannelReadAccessMemo(rctx) == nil || len(channelIDs) == 0 || !a.channelReadAccessEnforcementActive() {
		return
	}

	channels, err := a.Srv().Store().Channel().GetMany(channelIDs, true)
	if err != nil {
		// Nothing to prepare; each channel is loaded and evaluated on its own.
		return
	}
	a.PrepareChannelReadAccess(rctx, userID, channels)
}

func (a *App) FilterChannelIDsByReadAccess(rctx request.CTX, userID string, channelIDs []string) []string {
	if len(channelIDs) == 0 || !a.channelReadAccessEnforcementActive() {
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

func (a *App) FilterChannelsByReadAccess(rctx request.CTX, userID string, channels []*model.Channel) []*model.Channel {
	if len(channels) == 0 || !a.channelReadAccessEnforcementActive() {
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
	if len(channels) == 0 || !a.channelReadAccessEnforcementActive() {
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
	if channelID == "" || !a.channelReadAccessEnforcementActive() {
		return true
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return true
		}
		rctx.Logger().Warn("Failed to resolve channel for channel_read_access evaluation; denying",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return false
	}

	return a.HasChannelReadAccess(rctx, userID, channel)
}
