// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/sharedchannel"
)

// SharedChannelServiceIFace is the interface to the shared channel service
type SharedChannelServiceIFace interface {
	Shutdown() error
	Start() error
	NotifyChannelChanged(channelId string)
	SendChannelInvite(channel *model.Channel, userId string, description string, rc *model.RemoteCluster, options ...sharedchannel.InviteOption) error
	Active() bool
}

type MockOption func(service *mockRemoteClusterService)

func WithActive(active bool) MockOption {
	return func(mrcs *mockRemoteClusterService) {
		mrcs.active = active
	}
}

func NewMockRemoteClusterService(service SharedChannelServiceIFace, options ...MockOption) *mockRemoteClusterService {
	mrcs := &mockRemoteClusterService{service, true, []string{}, 0}
	for _, option := range options {
		option(mrcs)
	}
	return mrcs
}

type mockRemoteClusterService struct {
	SharedChannelServiceIFace
	active         bool
	notifications  []string
	numInvitations int
}

func (mrcs *mockRemoteClusterService) NotifyChannelChanged(channelId string) {
	mrcs.notifications = append(mrcs.notifications, channelId)
}

func (mrcs *mockRemoteClusterService) Shutdown() error {
	return nil
}

func (mrcs *mockRemoteClusterService) Start() error {
	return nil
}

func (mrcs *mockRemoteClusterService) Active() bool {
	return mrcs.active
}

func (mrcs *mockRemoteClusterService) SendChannelInvite(channel *model.Channel, userId string, description string, rc *model.RemoteCluster, options ...sharedchannel.InviteOption) error {
	mrcs.numInvitations += 1
	return nil
}

func (mrcs *mockRemoteClusterService) NumInvitations() int {
	return mrcs.numInvitations
}
