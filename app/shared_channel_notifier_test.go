// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/testlib"
)

func TestNotifySharedChannelSync(t *testing.T) {
	t.Run("when channel is not a shared one it does not notify", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()
		mockService := newMockRemoteClusterService(nil)
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(false)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Empty(t, mockService.notifications)
	})

	t.Run("when channel is shared and sync service is enabled it does notify", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()
		mockService := newMockRemoteClusterService(nil)
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Len(t, mockService.notifications, 1)
		assert.Equal(t, channel.Id, mockService.notifications[0])
	})

	t.Run("when channel is shared and sync service is not enabled it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		mockService.active = false
		th.App.srv.sharedChannelSyncService = mockService
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Empty(t, mockService.notifications)
	})
}

func TestServerSyncSharedChannelHandler(t *testing.T) {
	t.Run("sync service inactive, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		mockService.active = false
		th.App.srv.sharedChannelSyncService = mockService

		th.App.ServerSyncSharedChannelHandler(&model.WebSocketEvent{})
		assert.Empty(t, mockService.notifications)
	})

	t.Run("sync service active and broadcast envelope has ineligible event, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		mockService.active = true
		th.App.srv.sharedChannelSyncService = mockService
		channel := th.CreateChannel(th.BasicTeam, WithShared(true))

		websocketEvent := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, model.NewId(), channel.Id, "", nil)

		th.App.ServerSyncSharedChannelHandler(websocketEvent)
		assert.Empty(t, mockService.notifications)
	})

	t.Run("sync service active and broadcast envelope has eligible event but channel does not exist, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		mockService.active = true
		th.App.srv.sharedChannelSyncService = mockService

		websocketEvent := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, model.NewId(), model.NewId(), "", nil)

		th.App.ServerSyncSharedChannelHandler(websocketEvent)
		assert.Empty(t, mockService.notifications)
	})

	t.Run("sync service active when received eligible event, it triggers a shared channel content sync", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		mockService.active = true
		th.App.srv.sharedChannelSyncService = mockService

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, model.NewId(), channel.Id, "", nil)

		th.App.ServerSyncSharedChannelHandler(websocketEvent)
		assert.Len(t, mockService.notifications, 1)
		assert.Equal(t, channel.Id, mockService.notifications[0])
	})
}
