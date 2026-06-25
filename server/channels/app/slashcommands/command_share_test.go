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
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
	})
}

func TestShareProviderDoCommand(t *testing.T) {
	t.Run("share command sends a websocket channel updated event", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel share",
		}

		response := commandProvider.DoCommand(th.App, th.Context, args, "")
		require.Equal(t, "##### "+args.T("api.command_share.channel_shared"), response.Text)

		channelUpdatedMessages := testCluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			return err == nil && event.EventType() == model.WebsocketEventChannelUpdated
		})
		assert.Len(t, channelUpdatedMessages, 1) // one msg for share creation
	})

	t.Run("unshare command sends a websocket channel updated event", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel unshare",
		}

		response := commandProvider.DoCommand(th.App, th.Context, args, "")
		require.Equal(t, "##### "+args.T("api.command_share.shared_channel_unavailable"), response.Text)

		channelUpdatedMessages := testCluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			return err == nil && event.EventType() == model.WebsocketEventChannelUpdated
		})
		require.Len(t, channelUpdatedMessages, 2) // one msg for share creation, one for unshare.
	})

	t.Run("invite remote to channel shared with us", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

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
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true)) // will create with generated remoteID
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

func TestShareProviderGetAutoCompleteListItemsPermission(t *testing.T) {
	connectionIDArg := func() *model.AutocompleteArg {
		return &model.AutocompleteArg{Name: "connectionID"}
	}

	seedRemote := func(t *testing.T, th *TestHelper) *model.RemoteCluster {
		t.Helper()
		rc, err := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "remote-" + model.NewId(),
			DisplayName: "Remote Display Name Sentinel",
			SiteURL:     "https://remote-sentinel.example.com",
			Token:       model.NewId(),
			Topics:      "topic",
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			CreatorId:   model.NewId(),
		})
		require.Nil(t, err)
		return rc
	}

	assertNoRemoteData := func(t *testing.T, items []model.AutocompleteListItem, rc *model.RemoteCluster) {
		t.Helper()
		for i, item := range items {
			assert.NotContains(t, item.Item, rc.RemoteId, "item[%d].Item contained RemoteId", i)
			assert.NotContains(t, item.HelpText, rc.RemoteId, "item[%d].HelpText contained RemoteId", i)
			assert.NotContains(t, item.HelpText, rc.DisplayName, "item[%d].HelpText contained DisplayName", i)
			assert.NotContains(t, item.HelpText, rc.SiteURL, "item[%d].HelpText contained SiteURL", i)
		}
	}

	t.Run("invite without manage_shared_channels permission returns no remote cluster data", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		require.False(t, th.App.HasPermissionTo(th.BasicUser.Id, model.PermissionManageSharedChannels),
			"precondition: BasicUser must not have manage_shared_channels for this subtest")

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel invite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel invite ", "")

		if err == nil {
			assert.Empty(t, items, "expected empty autocomplete list when caller lacks manage_shared_channels")
		}
		assertNoRemoteData(t, items, rc)
	})

	t.Run("uninvite without manage_shared_channels permission returns no remote cluster data", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		require.False(t, th.App.HasPermissionTo(th.BasicUser.Id, model.PermissionManageSharedChannels),
			"precondition: BasicUser must not have manage_shared_channels for this subtest")

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel uninvite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel uninvite ", "")

		if err == nil {
			assert.Empty(t, items, "expected empty autocomplete list when caller lacks manage_shared_channels")
		}
		assertNoRemoteData(t, items, rc)
	})

	t.Run("invite with manage_shared_channels permission returns remote cluster data", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)
		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel invite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel invite ", "")
		require.NoError(t, err)
		require.NotEmpty(t, items, "expected at least one autocomplete item when caller has manage_shared_channels")

		found := false
		for _, item := range items {
			if item.Item == rc.RemoteId {
				found = true
				break
			}
		}
		require.True(t, found, "expected seeded RemoteId %q to appear in autocomplete items when caller has manage_shared_channels", rc.RemoteId)
	})

	t.Run("uninvite with manage_shared_channels permission returns remote cluster data", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)
		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel uninvite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel uninvite ", "")
		require.NoError(t, err)
		require.NotEmpty(t, items, "expected at least one autocomplete item when caller has manage_shared_channels")

		found := false
		for _, item := range items {
			if item.Item == rc.RemoteId {
				found = true
				break
			}
		}
		require.True(t, found, "expected seeded RemoteId %q to appear in autocomplete items when caller has manage_shared_channels", rc.RemoteId)
	})
}

func TestShareProviderGetAutoCompleteListItemsAdjacentRoles(t *testing.T) {
	connectionIDArg := func() *model.AutocompleteArg {
		return &model.AutocompleteArg{Name: "connectionID"}
	}

	seedRemote := func(t *testing.T, th *TestHelper) *model.RemoteCluster {
		t.Helper()
		rc, err := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "remote-" + model.NewId(),
			DisplayName: "Adjacent Sentinel Display",
			SiteURL:     "https://adjacent-sentinel.example.com",
			Token:       model.NewId(),
			Topics:      "topic",
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			CreatorId:   model.NewId(),
		})
		require.Nil(t, err)
		return rc
	}

	assertNoRemoteData := func(t *testing.T, items []model.AutocompleteListItem, rc *model.RemoteCluster) {
		t.Helper()
		for i, item := range items {
			assert.NotContains(t, item.Item, rc.RemoteId, "item[%d].Item contained RemoteId", i)
			assert.NotContains(t, item.HelpText, rc.RemoteId, "item[%d].HelpText contained RemoteId", i)
			assert.NotContains(t, item.HelpText, rc.DisplayName, "item[%d].HelpText contained DisplayName", i)
			assert.NotContains(t, item.HelpText, rc.SiteURL, "item[%d].HelpText contained SiteURL", i)
		}
	}

	t.Run("guest user receives no remote cluster data on invite autocomplete", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		guest := th.createGuest(t)
		require.False(t, th.App.HasPermissionTo(guest.Id, model.PermissionManageSharedChannels),
			"precondition: a freshly-created guest must not have manage_shared_channels")

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    guest.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel invite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel invite ", "")
		if err == nil {
			assert.Empty(t, items, "expected empty autocomplete list for guest on invite")
		}
		assertNoRemoteData(t, items, rc)
	})

	t.Run("guest user receives no remote cluster data on uninvite autocomplete", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		guest := th.createGuest(t)
		require.False(t, th.App.HasPermissionTo(guest.Id, model.PermissionManageSharedChannels),
			"precondition: a freshly-created guest must not have manage_shared_channels")

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    guest.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel uninvite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel uninvite ", "")
		if err == nil {
			assert.Empty(t, items, "expected empty autocomplete list for guest on uninvite")
		}
		assertNoRemoteData(t, items, rc)
	})

	t.Run("system admin receives remote cluster data on invite", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		require.True(t, th.App.HasPermissionTo(th.SystemAdminUser.Id, model.PermissionManageSharedChannels),
			"precondition: SystemAdminUser must have manage_shared_channels via inherited permissions")

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.SystemAdminUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel invite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel invite ", "")
		require.NoError(t, err)
		require.NotEmpty(t, items, "expected at least one autocomplete item for system admin")

		found := false
		for _, item := range items {
			if item.Item == rc.RemoteId {
				found = true
				break
			}
		}
		require.True(t, found, "expected seeded RemoteId %q to appear for system admin", rc.RemoteId)
	})

	t.Run("system admin receives remote cluster data on uninvite", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)

		require.True(t, th.App.HasPermissionTo(th.SystemAdminUser.Id, model.PermissionManageSharedChannels),
			"precondition: SystemAdminUser must have manage_shared_channels via inherited permissions")

		rc := seedRemote(t, th)

		commandProvider := ShareProvider{}
		channel := th.CreateChannel(t, th.BasicTeam, WithShared(false))

		args := &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channel.Id,
			UserId:    th.SystemAdminUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel uninvite --connectionID",
		}

		items, err := commandProvider.GetAutoCompleteListItems(th.Context, th.App, args, connectionIDArg(), "/share-channel uninvite ", "")
		require.NoError(t, err)
		require.NotEmpty(t, items, "expected at least one autocomplete item for system admin")

		found := false
		for _, item := range items {
			if item.Item == rc.RemoteId {
				found = true
				break
			}
		}
		require.True(t, found, "expected seeded RemoteId %q to appear for system admin", rc.RemoteId)
	})
}
