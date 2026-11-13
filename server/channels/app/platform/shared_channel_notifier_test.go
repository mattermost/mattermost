// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestServerSyncSharedChannelHandler(t *testing.T) {
	t.Run("sync service inactive, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		mockService := NewMockSharedChannelService(nil)
		mockService.active = false
		th.Service.SetSharedChannelService(mockService)

		th.Service.SharedChannelSyncHandler(&model.WebSocketEvent{}, true)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active and broadcast envelope has ineligible event, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventAddedToTeam, model.NewId(), channel.Id, "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent, true)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active and broadcast envelope has eligible event but channel does not exist, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, model.NewId(), model.NewId(), "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent, true)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active when received eligible event, it triggers a shared channel content sync", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, th.BasicTeam.Id, channel.Id, "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent, true)
		require.Len(t, mockService.channelNotifications, 1)
		assert.Equal(t, channel.Id, mockService.channelNotifications[0])
	})

	t.Run("sync service doesn't panic when no RemoteId", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		mockStore := th.Service.Store.(*mocks.Store)

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", "channelID", true).Return(&model.Channel{
			Id:     "channelID",
			Shared: new(true),
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
			th.Service.SharedChannelSyncHandler(websocketEvent, true)
			assert.Empty(t, mockService.channelNotifications)
		})
	})

	t.Run("sync service inactive and event published on this node is sent best effort, it triggers a shared channel content sync", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil, MockOptionSharedChannelServiceWithActive(false))
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		for _, eventType := range []model.WebsocketEventType{
			model.WebsocketEventReactionAdded,
			model.WebsocketEventReactionRemoved,
			model.WebsocketEventPostDeleted,
			model.WebsocketEventAcknowledgementAdded,
			model.WebsocketEventAcknowledgementRemoved,
		} {
			mockService.channelNotifications = nil
			websocketEvent := model.NewWebSocketEvent(eventType, th.BasicTeam.Id, channel.Id, "", nil, "")

			th.Service.SharedChannelSyncHandler(websocketEvent, true)
			assert.Equal(t, []string{channel.Id}, mockService.channelNotifications, eventType)
		}
	})

	t.Run("sync service inactive and event received from another node, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil, MockOptionSharedChannelServiceWithActive(false))
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventReactionAdded, th.BasicTeam.Id, channel.Id, "", nil, "")

		th.Service.SharedChannelSyncHandler(websocketEvent, false)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service inactive and event published on this node is sent reliably, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil, MockOptionSharedChannelServiceWithActive(false))
		th.Service.SetSharedChannelService(mockService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		for _, eventType := range []model.WebsocketEventType{model.WebsocketEventPosted, model.WebsocketEventPostEdited} {
			websocketEvent := model.NewWebSocketEvent(eventType, th.BasicTeam.Id, channel.Id, "", nil, "")
			th.Service.SharedChannelSyncHandler(websocketEvent, true)
		}

		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventReactionAdded, th.BasicTeam.Id, channel.Id, "", nil, "")
		websocketEvent.GetBroadcast().ReliableClusterSend = true
		th.Service.SharedChannelSyncHandler(websocketEvent, true)

		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service inactive, it does not auto-share a DM or send an invitation", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockService := NewMockSharedChannelService(nil, MockOptionSharedChannelServiceWithActive(false))
		th.Service.SetSharedChannelService(mockService)

		_, err := th.Service.Store.RemoteCluster().Save(&model.RemoteCluster{
			Name:      "autoshare",
			SiteURL:   "http://autoshare.example.com",
			Token:     model.NewId(),
			CreatorId: th.BasicUser.Id,
			Options:   model.BitflagOptionAutoShareDMs,
		})
		require.NoError(t, err)

		dm, err := th.Service.Store.Channel().CreateDirectChannel(th.Context, th.BasicUser, th.BasicUser2)
		require.NoError(t, err)

		reaction := model.NewWebSocketEvent(model.WebsocketEventReactionAdded, "", dm.Id, "", nil, "")
		th.Service.SharedChannelSyncHandler(reaction, true)

		directAdded := model.NewWebSocketEvent(model.WebsocketEventDirectAdded, "", dm.Id, "", nil, "")
		directAdded = directAdded.SetData(map[string]any{"creator_id": th.BasicUser.Id, "teammate_id": th.BasicUser2.Id})
		th.Service.SharedChannelSyncHandler(directAdded, true)

		assert.Empty(t, mockService.channelNotifications)
		assert.Zero(t, mockService.NumInvitations())
	})
}
