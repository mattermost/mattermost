// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

// SharedChannelServiceIFace is the interface to the shared channel service
type SharedChannelServiceIFace interface {
	Shutdown() error
	Start() error
	NotifyChannelChanged(channelId string)
	NotifyUserProfileChanged(userID string)
	NotifyUserStatusChanged(status *model.Status)
	SendChannelInvite(channel *model.Channel, userId string, rc *model.RemoteCluster, options ...sharedchannel.InviteOption) error
	Active() bool
	InviteRemoteToChannel(channelID, remoteID, userID string, shareIfNotShared bool) error
	UninviteRemoteFromChannel(channelID, remoteID string) error
	ShareChannel(sc *model.SharedChannel) (*model.SharedChannel, error)
	CheckChannelNotShared(channelID string) error
	CheckChannelIsShared(channelID string) error
	CheckCanInviteToSharedChannel(channelId string) error
	HandleMembershipChange(channelID, userID string, isAdd bool, remoteID string)
	TransformMentionsOnReceiveForTesting(rctx request.CTX, post *model.Post, targetChannel *model.Channel, rc *model.RemoteCluster, mentionTransforms map[string]string)
}

type MockOptionSharedChannelService func(service *mockSharedChannelService)

func MockOptionSharedChannelServiceWithActive(active bool) MockOptionSharedChannelService {
	return func(mrcs *mockSharedChannelService) {
		mrcs.active = active
	}
}

func NewMockSharedChannelService(service SharedChannelServiceIFace, options ...MockOptionSharedChannelService) *mockSharedChannelService {
	mrcs := &mockSharedChannelService{service, true, []string{}, []string{}, 0}
	for _, option := range options {
		option(mrcs)
	}
	return mrcs
}

type mockSharedChannelService struct {
	SharedChannelServiceIFace
	active                   bool
	channelNotifications     []string
	userProfileNotifications []string
	numInvitations           int
}

func (mrcs *mockSharedChannelService) NotifyChannelChanged(channelId string) {
	mrcs.channelNotifications = append(mrcs.channelNotifications, channelId)
}

func (mrcs *mockSharedChannelService) NotifyUserProfileChanged(userId string) {
	mrcs.userProfileNotifications = append(mrcs.userProfileNotifications, userId)
}

func (mrcs *mockSharedChannelService) Shutdown() error {
	return nil
}

func (mrcs *mockSharedChannelService) Start() error {
	return nil
}

func (mrcs *mockSharedChannelService) Active() bool {
	return mrcs.active
}

func (mrcs *mockSharedChannelService) SendChannelInvite(channel *model.Channel, userId string, rc *model.RemoteCluster, options ...sharedchannel.InviteOption) error {
	mrcs.numInvitations += 1
	return nil
}

func (mrcs *mockSharedChannelService) NumInvitations() int {
	return mrcs.numInvitations
}

func (mrcs *mockSharedChannelService) HandleMembershipChange(channelID, userID string, isAdd bool, remoteID string) {
	// This is a mock implementation - it doesn't need to do anything
}

func (mrcs *mockSharedChannelService) TransformMentionsOnReceiveForTesting(rctx request.CTX, post *model.Post, targetChannel *model.Channel, rc *model.RemoteCluster, mentionTransforms map[string]string) {
	// This is a mock implementation - it doesn't need to do anything
}
