// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest/mocks"
)

func TestServerSyncSharedChannelHandler(t *testing.T) {
	t.Run("sync service inactive, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = false
		th.Service.SetSharedChannelService(mockService)

		th.Service.SharedChannelSyncHandler(&model.WebSocketEvent{})
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active and broadcast envelope has ineligible event, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventAddedToTeam, model.NewId(), channel.Id, "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active and broadcast envelope has eligible event but channel does not exist, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, model.NewId(), model.NewId(), "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active when received eligible event, it triggers a shared channel content sync", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, th.BasicTeam.Id, channel.Id, "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent)
		require.Len(t, mockService.channelNotifications, 1)
		assert.Equal(t, channel.Id, mockService.channelNotifications[0])
	})

	t.Run("sync service doesn't panic when no RemoteId", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.Service.Store.(*mocks.Store)

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", "channelID", true).Return(&model.Channel{
			Id:     "channelID",
			Shared: model.NewBool(true),
		}, nil)

		mockUserStore := &mocks.UserStore{}
		mockUserStore.On("Get", mock.Anything, "creator").Return(&model.User{}, nil)
		// Not setting RemoteId here causes the panic.
		mockUserStore.On("Get", mock.Anything, "teammate").Return(&model.User{}, nil)

		mockRemoteClusterStore := &mocks.RemoteClusterStore{}
		mockRemoteClusterStore.On("Get", mock.Anything).Return(&model.RemoteCluster{}, nil)

		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("User").Return(mockUserStore)
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		require.NotPanics(t, func() {
			websocketEvent := model.NewWebSocketEvent(model.WebsocketEventDirectAdded, "teamID", "channelID", "userID", nil, "")
			websocketEvent = websocketEvent.SetData(map[string]any{"creator_id": "creator", "teammate_id": "teammate"})
			th.Service.SharedChannelSyncHandler(websocketEvent)
			assert.Empty(t, mockService.channelNotifications)
		})
	})
}
