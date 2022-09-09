// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestServerSyncSharedChannelHandler(t *testing.T) {
	t.Run("sync service inactive, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = false
		th.App.ch.srv.SetSharedChannelSyncService(mockService)

		th.App.ch.srv.SharedChannelSyncHandler(&model.WebSocketEvent{})
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active and broadcast envelope has ineligible event, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.App.ch.srv.SetSharedChannelSyncService(mockService)
		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))

		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventAddedToTeam, model.NewId(), channel.Id, "", nil, "")

		th.App.ch.srv.SharedChannelSyncHandler(websocketEvent)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active and broadcast envelope has eligible event but channel does not exist, it does nothing", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.App.ch.srv.SetSharedChannelSyncService(mockService)

		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, model.NewId(), model.NewId(), "", nil, "")

		th.App.ch.srv.SharedChannelSyncHandler(websocketEvent)
		assert.Empty(t, mockService.channelNotifications)
	})

	t.Run("sync service active when received eligible event, it triggers a shared channel content sync", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockService := NewMockSharedChannelService(nil)
		mockService.active = true
		th.App.ch.srv.SetSharedChannelSyncService(mockService)

		channel := th.CreateChannel(th.Context, th.BasicTeam, WithShared(true))
		websocketEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, model.NewId(), channel.Id, "", nil, "")

		th.App.ch.srv.SharedChannelSyncHandler(websocketEvent)
		assert.Len(t, mockService.channelNotifications, 1)
		assert.Equal(t, channel.Id, mockService.channelNotifications[0])
	})
}
