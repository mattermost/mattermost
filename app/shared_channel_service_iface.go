// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/v5/model"

// SharedChannelServiceIFace is the interface to the shared channel service
type SharedChannelServiceIFace interface {
	Shutdown() error
	Start() error
	NotifyChannelChanged(channel string)
	SendChannelInvite(channel *model.Channel, userId string, description string, rc *model.RemoteCluster) error
	Active() bool
}

func newMockRemoteClusterService(service SharedChannelServiceIFace) *mockRemoteClusterService {
	return &mockRemoteClusterService{service, true, []string{}}
}

type mockRemoteClusterService struct {
	SharedChannelServiceIFace
	active        bool
	notifications []string
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
