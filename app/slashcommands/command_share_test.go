// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/testlib"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/services/remotecluster"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestShareProviderDoCommand(t *testing.T) {
	t.Run("share command sends a websocket channel converted event", func(t *testing.T) {
		th := setup(t).initBasic()
		defer th.tearDown()

		th.addPermissionToRole(model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(mockSyncService)
		mockRemoteCluster, err := remotecluster.NewRemoteClusterService(th.Server)
		require.NoError(t, err)

		th.Server.SetRemoteClusterService(mockRemoteCluster)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel share",
		}

		response := commandProvider.DoCommand(th.App, th.Context, args, "")
		require.Equal(t, "##### "+args.T("api.command_share.channel_shared"), response.Text)

		channelConvertedMessages := testCluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			return err == nil && event.EventType() == model.WebsocketEventChannelConverted
		})
		assert.Len(t, channelConvertedMessages, 1)
	})

	t.Run("unshare command sends a websocket channel converted event", func(t *testing.T) {
		th := setup(t).initBasic()
		defer th.tearDown()

		th.addPermissionToRole(model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(nil)
		th.Server.SetSharedChannelSyncService(mockSyncService)
		mockRemoteCluster, err := remotecluster.NewRemoteClusterService(th.Server)
		require.NoError(t, err)

		th.Server.SetRemoteClusterService(mockRemoteCluster)
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(th.BasicTeam, WithShared(true))
		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel unshare",
		}

		response := commandProvider.DoCommand(th.App, th.Context, args, "")
		require.Equal(t, "##### "+args.T("api.command_share.shared_channel_unavailable"), response.Text)

		channelConvertedMessages := testCluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			return err == nil && event.EventType() == model.WebsocketEventChannelConverted
		})
		require.Len(t, channelConvertedMessages, 1)
	})
}
