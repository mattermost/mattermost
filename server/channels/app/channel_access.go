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
}
type channelAccessMemo struct {
	mu        sync.Mutex
	decisions map[channelAccessKey]bool

	// enforcementDenial is the channel an *enforcement* gate denied for the
	// requesting session, deliberately not the same thing as a false entry in
	// decisions: filters and mention sanitisers record denials and still return
	// 200, so a decision alone cannot say why a request is failing.
	enforcementDenial string
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

func (m *channelAccessMemo) noteEnforcementDenial(channelID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.enforcementDenial = channelID
}

func (m *channelAccessMemo) getEnforcementDenial() string {
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
	memo := &channelAccessMemo{decisions: map[channelAccessKey]bool{}}
	return rctx.WithContext(context.WithValue(rctx.Context(), channelAccessMemoKey{}, memo))
}

func ChannelAccessEnforcementDenial(rctx request.CTX) string {
	memo := getChannelAccessMemo(rctx)
	if memo == nil {
		return ""
	}
	return memo.getEnforcementDenial()
}

func (a *App) EnforceAccessChannel(rctx request.CTX, userID string, channel *model.Channel) bool {
	if a.HasPermissionToAccessChannel(rctx, userID, channel) {
		return true
	}

	a.noteAccessChannelEnforcementDenial(rctx, userID, channel.Id)
	return false
}

func (a *App) EnforceAccessChannelByID(rctx request.CTX, userID, channelID string) bool {
	if a.HasPermissionToAccessChannelByID(rctx, userID, channelID) {
		return true
	}

	a.noteAccessChannelEnforcementDenial(rctx, userID, channelID)
	return false
}

func (a *App) noteAccessChannelEnforcementDenial(rctx request.CTX, userID, channelID string) {
	if channelID == "" || userID != rctx.Session().UserId {
		return
	}

	if memo := getChannelAccessMemo(rctx); memo != nil {
		memo.noteEnforcementDenial(channelID)
	}
}

func (a *App) accessChannelEnforcementActive() bool {
	return a.Config().FeatureFlags.IsAccessChannelABACPermissionEnabled() &&
		a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		a.Srv().Channels().AccessControl != nil
}

func (a *App) HasPermissionToAccessChannel(rctx request.CTX, userID string, channel *model.Channel) bool {
	if channel == nil || userID == "" {
		return true
	}

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return true
	}

	if !a.accessChannelEnforcementActive() {
		return true
	}

	memo := getChannelAccessMemo(rctx)
	key := channelAccessKey{userID: userID, channelID: channel.Id}
	if memo != nil {
		if allowed, ok := memo.get(key); ok {
			return allowed
		}
	}

	allowed := a.evaluateAccessChannel(rctx, userID, channel)
	if memo != nil {
		memo.set(key, allowed)
	}
	return allowed
}

func (a *App) evaluateAccessChannel(rctx request.CTX, userID string, channel *model.Channel) bool {
	acs := a.Srv().Channels().AccessControl

	governed, appErr := acs.ActionHasPermissionPolicy(rctx, model.AccessControlPolicyActionAccessChannel)
	if appErr != nil {
		rctx.Logger().Debug("Failed to check whether permission policies govern access_channel; evaluating anyway",
			mlog.String("channel_id", channel.Id),
			mlog.Err(appErr),
		)
	}
	if !governed && !channel.PolicyEnforced {
		return true
	}

	subject, appErr := a.buildAccessChannelSubject(rctx, userID, channel.Id)
	if appErr != nil {
		rctx.Logger().Info("Failed to build ABAC subject for access_channel evaluation; denying",
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
		Action: model.AccessControlPolicyActionAccessChannel,
	})
	if evalErr != nil {
		rctx.Logger().Warn("ABAC access_channel evaluation failed; denying",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channel.Id),
			mlog.Err(evalErr),
		)
		return false
	}

	return decision.Decision
}

func (a *App) buildAccessChannelSubject(rctx request.CTX, userID, channelID string) (*model.Subject, *model.AppError) {
	if rctx.Session().UserId == userID {
		return a.BuildAccessControlSubjectForSession(rctx, channelID)
	}

	user, appErr := a.GetUser(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}
	return a.BuildAccessControlSubject(rctx, userID, user.Roles, channelID)
}

func (a *App) FilterChannelIDsByAccess(rctx request.CTX, userID string, channelIDs []string) []string {
	if len(channelIDs) == 0 || !a.accessChannelEnforcementActive() {
		return channelIDs
	}

	filtered := make([]string, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if a.HasPermissionToAccessChannelByID(rctx, userID, channelID) {
			filtered = append(filtered, channelID)
		}
	}
	return filtered
}

func (a *App) FilterChannelsByAccess(rctx request.CTX, userID string, channels []*model.Channel) []*model.Channel {
	if len(channels) == 0 || !a.accessChannelEnforcementActive() {
		return channels
	}

	filtered := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		if a.HasPermissionToAccessChannel(rctx, userID, channel) {
			filtered = append(filtered, channel)
		}
	}
	return filtered
}

func (a *App) FilterChannelListByAccess(rctx request.CTX, userID string, channels model.ChannelList) model.ChannelList {
	return a.FilterChannelsByAccess(rctx, userID, channels)
}

func (a *App) FilterChannelListWithTeamDataByAccess(rctx request.CTX, userID string, channels model.ChannelListWithTeamData) (kept model.ChannelListWithTeamData, dropped int) {
	if len(channels) == 0 || !a.accessChannelEnforcementActive() {
		return channels, 0
	}

	filtered := make(model.ChannelListWithTeamData, 0, len(channels))
	for _, channel := range channels {
		if a.HasPermissionToAccessChannel(rctx, userID, &channel.Channel) {
			filtered = append(filtered, channel)
		}
	}
	return filtered, len(channels) - len(filtered)
}

func (a *App) FilterChannelMembersWithTeamDataByAccess(rctx request.CTX, userID string, members model.ChannelMembersWithTeamData) model.ChannelMembersWithTeamData {
	if len(members) == 0 || !a.accessChannelEnforcementActive() {
		return members
	}

	filtered := make(model.ChannelMembersWithTeamData, 0, len(members))
	for _, member := range members {
		if a.HasPermissionToAccessChannelByID(rctx, userID, member.ChannelId) {
			filtered = append(filtered, member)
		}
	}
	return filtered
}

func (a *App) HasPermissionToAccessChannelByID(rctx request.CTX, userID, channelID string) bool {
	if channelID == "" || !a.accessChannelEnforcementActive() {
		return true
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return true
		}
		rctx.Logger().Warn("Failed to resolve channel for access_channel evaluation; denying",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return false
	}

	return a.HasPermissionToAccessChannel(rctx, userID, channel)
}
