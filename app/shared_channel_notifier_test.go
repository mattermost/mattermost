// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"testing"

	"github.com/mattermost/mattermost-server/v5/mlog"

	"github.com/mattermost/mattermost-server/v5/testlib"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
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

	t.Run("when channel is shared, sync service enabled, and clustering disabled, it triggers a sync", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		th.App.srv.sharedChannelSyncService = mockService
		th.Server.Cluster = nil

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Len(t, mockService.notifications, 1)
		assert.Equal(t, channel.Id, mockService.notifications[0])
	})

	t.Run("when channel is shared, sync service disabled, and clustering disabled, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.srv.sharedChannelSyncService = nil
		th.Server.Cluster = nil
		buf := &bytes.Buffer{}
		mockLogger := mlog.NewTestingLogger(t, buf)
		th.Server.SetLog(mockLogger)

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Contains(t, buf.String(), "Shared channel sync service is not running on this node and clustering is not enabled. Enable clustering to resolve.")
	})
}

func TestServerSyncSharedChannelHandler(t *testing.T) {
	t.Run("sync service enabled, it triggers a channel sync", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockService := newMockRemoteClusterService(nil)
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.ServerSyncSharedChannelHandler(map[string]string{
			"channelId": channel.Id,
			"event":     "sync",
		})
		assert.Len(t, mockService.notifications, 1)
		assert.Equal(t, channel.Id, mockService.notifications[0])
	})

	t.Run("sync service disabled, it does nothing", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.srv.sharedChannelSyncService = nil
		th.Server.Cluster = nil
		buf := &bytes.Buffer{}
		mockLogger := mlog.NewTestingLogger(t, buf)
		th.Server.SetLog(mockLogger)

		th.App.ServerSyncSharedChannelHandler(make(map[string]string))
		assert.Contains(t, buf.String(), "Received cluster message for shared channel sync but sync service is not running on this node. Skipping...")
	})
}
