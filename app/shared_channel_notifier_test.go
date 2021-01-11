// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/testlib"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

type mockRemoteClusterService struct {
	SharedChannelServiceIFace
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

func TestNotifySharedChannelSync(t *testing.T) {
	t.Run("when channel is not a shared one it does not notify", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()
		mockService := &mockRemoteClusterService{}
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(false)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Empty(t, mockService.notifications)
	})

	t.Run("when channel is shared and sync service is enabled it does notify", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()
		mockService := &mockRemoteClusterService{}
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Len(t, mockService.notifications, 1)
		assert.Equal(t, channel.Id, mockService.notifications[0])
	})

	t.Run("when channel is shared and sync service is not enabled it does broadcast a cluster message", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.srv.sharedChannelSyncService = nil
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Len(t, testCluster.GetMessages(), 1)

		message := *testCluster.GetMessages()[0]
		assert.Equal(t, model.CLUSTER_EVENT_SYNC_SHARED_CHANNEL, message.Event)
		expectedProps := map[string]string{
			"channelId": channel.Id,
			"event":     "",
		}
		assert.Equal(t, expectedProps, message.Props)
	})
}
