// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// TODO: platform: remove this and use from platform package
import (
	"github.com/mattermost/mattermost/server/public/model"
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
	UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error)
	UnshareChannel(channelID string) (bool, error)
	CheckChannelNotShared(channelID string) error
	CheckChannelIsShared(channelID string) error
	CheckCanInviteToSharedChannel(channelId string) error
}

func NewMockSharedChannelService(service SharedChannelServiceIFace) *mockSharedChannelService {
	mrcs := &mockSharedChannelService{
		SharedChannelServiceIFace: service,
		channelNotifications:      []string{},
		userProfileNotifications:  []string{},
		numInvitations:            0,
	}
	return mrcs
}

type mockSharedChannelService struct {
	SharedChannelServiceIFace
	channelNotifications     []string
	userProfileNotifications []string
	numInvitations           int
}

func (mrcs *mockSharedChannelService) NotifyChannelChanged(channelId string) {
	mrcs.channelNotifications = append(mrcs.channelNotifications, channelId)
	if mrcs.SharedChannelServiceIFace != nil {
		mrcs.SharedChannelServiceIFace.NotifyChannelChanged(channelId)
	}
}

func (mrcs *mockSharedChannelService) NotifyUserProfileChanged(userId string) {
	mrcs.userProfileNotifications = append(mrcs.userProfileNotifications, userId)
	if mrcs.SharedChannelServiceIFace != nil {
		mrcs.SharedChannelServiceIFace.NotifyUserProfileChanged(userId)
	}
}

func (mrcs *mockSharedChannelService) Shutdown() error {
	if mrcs.SharedChannelServiceIFace != nil {
		return mrcs.SharedChannelServiceIFace.Shutdown()
	}
	return nil
}

func (mrcs *mockSharedChannelService) Start() error {
	if mrcs.SharedChannelServiceIFace != nil {
		return mrcs.SharedChannelServiceIFace.Start()
	}
	return nil
}

func (mrcs *mockSharedChannelService) Active() bool {
	if mrcs.SharedChannelServiceIFace != nil {
		return mrcs.SharedChannelServiceIFace.Active()
	}
	return false
}

func (mrcs *mockSharedChannelService) SendChannelInvite(channel *model.Channel, userId string, rc *model.RemoteCluster, options ...sharedchannel.InviteOption) error {
	mrcs.numInvitations += 1
	if mrcs.SharedChannelServiceIFace != nil {
		return mrcs.SharedChannelServiceIFace.SendChannelInvite(channel, userId, rc, options...)
	}
	return nil
}

func (mrcs *mockSharedChannelService) NumInvitations() int {
	return mrcs.numInvitations
}
