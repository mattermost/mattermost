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
	memo := &channelReadAccessMemo{decisions: map[channelReadAccessKey]bool{}}
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
	return a.Config().FeatureFlags.IsChannelReadAccessABACPermissionEnabled() &&
		a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		a.Srv().Channels().AccessControl != nil
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

func (a *App) evaluateChannelReadAccess(rctx request.CTX, userID string, channel *model.Channel) bool {
	acs := a.Srv().Channels().AccessControl

	governed, appErr := acs.ActionHasPermissionPolicy(rctx, model.AccessControlPolicyActionChannelReadAccess)
	if appErr != nil {
		// Evaluate rather than short-circuit: a failed governance check says nothing
		// about whether a policy applies, and every other failure here denies.
		governed = true
		rctx.Logger().Debug("Failed to check whether permission policies govern channel_read_access; evaluating anyway",
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
	}
	if !governed && !channel.PolicyEnforced {
		return true
	}

	subject, appErr := a.buildChannelReadAccessSubject(rctx, userID, channel.Id)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for channel_read_access evaluation; denying",
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

func (a *App) buildChannelReadAccessSubject(rctx request.CTX, userID, channelID string) (*model.Subject, *model.AppError) {
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
	if len(channelIDs) == 0 || !a.channelReadAccessEnforcementActive() {
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
	if len(channels) == 0 || !a.channelReadAccessEnforcementActive() {
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
	if len(channels) == 0 || !a.channelReadAccessEnforcementActive() {
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

func (a *App) FilterChannelMembersWithTeamDataByReadAccess(rctx request.CTX, userID string, members model.ChannelMembersWithTeamData) model.ChannelMembersWithTeamData {
	if len(members) == 0 || !a.channelReadAccessEnforcementActive() {
		return members
	}

	filtered := make(model.ChannelMembersWithTeamData, 0, len(members))
	for _, member := range members {
		if a.HasChannelReadAccessByID(rctx, userID, member.ChannelId) {
			filtered = append(filtered, member)
		}
	}
	return filtered
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
