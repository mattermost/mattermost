// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/v8/channels/testlib"

	"github.com/mattermost/mattermost/server/v8/channels/app"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func setupForSharedChannels(tb testing.TB) *TestHelper {
	return setupConfig(tb, func(cfg *model.Config) {
		*cfg.ExperimentalSettings.EnableRemoteClusterService = true
		*cfg.ExperimentalSettings.EnableSharedChannels = true
	})
}

func TestShareProviderDoCommand(t *testing.T) {
	t.Run("share command sends a websocket channel converted event", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic()
		defer th.tearDown()

		th.addPermissionToRole(model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

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
		assert.Len(t, channelConvertedMessages, 1) // one msg for share creation
	})

	t.Run("unshare command sends a websocket channel converted event", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic()
		defer th.tearDown()

		th.addPermissionToRole(model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

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
		require.Len(t, channelConvertedMessages, 2) // one msg for share creation, one for unshare.
	})

	t.Run("invite remote to channel shared with us", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic()
		defer th.tearDown()

		th.addPermissionToRole(model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		remoteCluster, err := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:   model.NewId(),
			Name:       "remote",
			SiteURL:    "example.com",
			Token:      model.NewId(),
			Topics:     "topic",
			CreateAt:   model.GetMillis(),
			LastPingAt: model.GetMillis(),
			CreatorId:  model.NewId(),
		})
		require.Nil(t, err)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(th.BasicTeam, WithShared(true)) // will create with generated remoteID
		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel invite --connectionID " + remoteCluster.RemoteId,
		}

		response := commandProvider.DoCommand(th.App, th.Context, args, "")
		require.Contains(t, response.Text, args.T("api.command_share.invite_remote_to_channel.error"))
	})
}
