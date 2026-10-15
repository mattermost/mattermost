// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/v8/channels/testlib"

	"github.com/mattermost/mattermost/server/v8/channels/app"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
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

		remoteCluster := seedRemoteCluster(t, th, func(rc *model.RemoteCluster) {
			rc.Topics = "topic"
			rc.LastPingAt = model.GetMillis()
		})

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

func TestShareProviderDoStatus(t *testing.T) {
	seedInvitedRemote := func(t *testing.T, th *TestHelper, channelID string) *model.SharedChannelRemote {
		t.Helper()
		rc := seedRemoteCluster(t, th, func(rc *model.RemoteCluster) {
			rc.DisplayName = "Remote Status Display"
			rc.Topics = "topic"
			rc.LastPingAt = model.GetMillis()
		})

		scr, saveErr := th.App.SaveSharedChannelRemote(&model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channelID,
			RemoteId:          rc.RemoteId,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
		})
		require.NoError(t, saveErr)
		return scr
	}

	statusArgs := func(th *TestHelper, channelID string) *model.CommandArgs {
		return &model.CommandArgs{
			T:         func(s string, args ...any) string { return s },
			ChannelId: channelID,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			Command:   "/share-channel status",
		}
	}

	t.Run("renders the last sync timestamp for a remote that has synced", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)
		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		scr := seedInvitedRemote(t, th, channel.Id)

		syncAt := model.GetMillis() - 5000
		require.NoError(t, th.App.Srv().Store().SharedChannel().UpdateRemoteCursor(scr.Id, model.GetPostsSinceForSyncCursor{
			LastPostUpdateAt: syncAt,
			LastPostUpdateID: model.NewId(),
		}))

		commandProvider := ShareProvider{}
		response := commandProvider.DoCommand(th.App, th.Context, statusArgs(th, channel.Id), "")

		require.Contains(t, response.Text, "Remote Status Display")
		assert.Contains(t, response.Text, "Today ", "expected a rendered timestamp in the Last Sync column, got:\n%s", response.Text)
		assert.NotContains(t, response.Text, "| -- |", "Last Sync column should not be the placeholder for a synced remote:\n%s", response.Text)
	})

	t.Run("renders a placeholder when the remote has never synced", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)
		th.addPermissionToRole(t, model.PermissionManageSharedChannels.Id, th.BasicUser.Roles)

		mockSyncService := app.NewMockSharedChannelService(th.Server.GetSharedChannelSyncService())
		th.Server.SetSharedChannelSyncService(mockSyncService)

		channel := th.CreateChannel(t, th.BasicTeam, WithShared(true))
		seedInvitedRemote(t, th, channel.Id)

		commandProvider := ShareProvider{}
		response := commandProvider.DoCommand(th.App, th.Context, statusArgs(th, channel.Id), "")

		require.Contains(t, response.Text, "Remote Status Display")
		assert.Contains(t, response.Text, "| -- |", "expected the Last Sync placeholder for an unsynced remote, got:\n%s", response.Text)
		assert.NotContains(t, response.Text, "Today ", "unsynced remote should not render a timestamp:\n%s", response.Text)
	})
}

func TestShareProviderGetAutoCompleteListItemsPermission(t *testing.T) {
	connectionIDArg := func() *model.AutocompleteArg {
		return &model.AutocompleteArg{Name: "connectionID"}
	}

	seedRemote := func(t *testing.T, th *TestHelper) *model.RemoteCluster {
		t.Helper()
		return seedRemoteCluster(t, th, func(rc *model.RemoteCluster) {
			rc.DisplayName = "Remote Display Name Sentinel"
			rc.Topics = "topic"
			rc.LastPingAt = model.GetMillis()
		})
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

		require.False(t, th.App.HasPermissionTo(th.Context, th.BasicUser.Id, model.PermissionManageSharedChannels),
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

		require.False(t, th.App.HasPermissionTo(th.Context, th.BasicUser.Id, model.PermissionManageSharedChannels),
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
		return seedRemoteCluster(t, th, func(rc *model.RemoteCluster) {
			rc.DisplayName = "Adjacent Sentinel Display"
			rc.Topics = "topic"
			rc.LastPingAt = model.GetMillis()
		})
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
		require.False(t, th.App.HasPermissionTo(th.Context, guest.Id, model.PermissionManageSharedChannels),
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
		require.False(t, th.App.HasPermissionTo(th.Context, guest.Id, model.PermissionManageSharedChannels),
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

		require.True(t, th.App.HasPermissionTo(th.Context, th.SystemAdminUser.Id, model.PermissionManageSharedChannels),
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

		require.True(t, th.App.HasPermissionTo(th.Context, th.SystemAdminUser.Id, model.PermissionManageSharedChannels),
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

func shareHomeChannel(t *testing.T, th *TestHelper, channel *model.Channel) {
	t.Helper()
	_, err := th.App.ShareChannel(th.Context, &model.SharedChannel{
		ChannelId: channel.Id,
		TeamId:    channel.TeamId,
		Home:      true,
		ShareName: channel.Name,
		CreatorId: th.BasicUser.Id,
	})
	require.NoError(t, err)
}

func TestShareProviderDoCommandGuards(t *testing.T) {
	T := i18n.GetUserTranslations("en")

	t.Run("rejects users without manage_shared_channels", func(t *testing.T) {
		th := setupForSharedChannels(t).initBasic(t)
		require.False(t, th.App.HasPermissionTo(th.Context, th.BasicUser.Id, model.PermissionManageSharedChannels))

		text := runCommand(th, &ShareProvider{}, th.BasicUser.Id, th.BasicChannel.Id, "/share-channel share")

		require.Equal(t, T("api.command_share.permission_required", map[string]any{"Permission": "manage_shared_channels"}), text)
		shared, err := th.App.HasSharedChannel(th.BasicChannel.Id)
		require.NoError(t, err)
		require.False(t, shared)
	})

	t.Run("shared channel service disabled", func(t *testing.T) {
		th := setupConfig(t, func(cfg *model.Config) {
			*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
			*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = false
		}).initBasic(t)
		require.Nil(t, th.Server.GetSharedChannelSyncService())
		require.NotNil(t, th.Server.GetRemoteClusterService())

		text := runCommand(th, &ShareProvider{}, th.SystemAdminUser.Id, th.BasicChannel.Id, "/share-channel status")
		require.Equal(t, T("api.command_share.service_disabled"), text)
	})

	t.Run("remote cluster service disabled", func(t *testing.T) {
		th := setup(t).initBasic(t)
		th.Server.SetSharedChannelSyncService(app.NewMockSharedChannelService(nil))
		require.Nil(t, th.Server.GetRemoteClusterService())

		text := runCommand(th, &ShareProvider{}, th.SystemAdminUser.Id, th.BasicChannel.Id, "/share-channel status")
		require.Equal(t, T("api.command_remote.service_disabled"), text)
	})

	th := setupForSharedChannels(t).initBasic(t)

	t.Run("missing action", func(t *testing.T) {
		text := runCommand(th, &ShareProvider{}, th.SystemAdminUser.Id, th.BasicChannel.Id, "/share-channel")
		require.Equal(t, T("api.command_share.missing_action", map[string]any{"Actions": AvailableShareActions}), text)
	})

	t.Run("unknown action", func(t *testing.T) {
		text := runCommand(th, &ShareProvider{}, th.SystemAdminUser.Id, th.BasicChannel.Id, "/share-channel bogus")
		require.Equal(t, T("api.command_share.unknown_action", map[string]any{"Action": "bogus", "Actions": AvailableShareActions}), text)
	})
}

func TestShareProviderShareUnshareStatusErrors(t *testing.T) {
	T := i18n.GetUserTranslations("en")
	th := setupForSharedChannels(t).initBasic(t)
	adminID := th.SystemAdminUser.Id

	isShared := func(t *testing.T, channelID string) bool {
		t.Helper()
		shared, err := th.App.HasSharedChannel(channelID)
		require.NoError(t, err)
		return shared
	}

	t.Run("share with an invalid readonly value", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel share --readonly maybe")

		_, parseErr := parseBool("maybe")
		require.Error(t, parseErr)
		require.Equal(t, T("api.command_share.invalid_value.error", map[string]any{"Arg": "readonly", "Error": parseErr.Error()}), text)
		require.False(t, isShared(t, channel.Id))
	})

	t.Run("share with readonly", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel share --readonly Y")

		require.Equal(t, "##### "+T("api.command_share.channel_shared"), text)
		sc, err := th.App.GetSharedChannel(channel.Id)
		require.NoError(t, err)
		require.True(t, sc.ReadOnly)
		require.True(t, sc.Home)
	})

	t.Run("share a channel that does not exist", func(t *testing.T) {
		text := runCommand(th, &ShareProvider{}, adminID, model.NewId(), "/share-channel share")
		require.True(t, strings.HasPrefix(text, T("api.command_share.share_channel.error", map[string]any{"Error": ""})), text)
	})

	t.Run("share a direct message channel", func(t *testing.T) {
		dm := th.createDmChannel(t, th.BasicUser2)

		text := runCommand(th, &ShareProvider{}, adminID, dm.Id, "/share-channel share")

		require.Equal(t, T("api.command_share.share_channel.error", map[string]any{"Error": "cannot share a direct or group channel"}), text)
		require.False(t, isShared(t, dm.Id))
	})

	t.Run("unshare a channel that is not shared", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel unshare")
		require.Equal(t, T("api.command_share.not_shared_channel_unshare"), text)
	})

	t.Run("status of a channel that is not shared", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel status")
		prefix := strings.TrimSuffix(T("api.command_share.fetch_remote_status.error", map[string]any{"Error": ""}), ".")
		require.True(t, strings.HasPrefix(text, prefix), text)
		require.Contains(t, text, model.ErrChannelNotShared.Error())
	})

	t.Run("status of a shared channel with no remotes", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		shareHomeChannel(t, th, channel)

		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel status")
		require.Equal(t, T("api.command_share.no_remote_invited"), text)
	})
}

func TestShareProviderDoInviteRemote(t *testing.T) {
	T := i18n.GetUserTranslations("en")
	th := setupForSharedChannels(t).initBasic(t)
	adminID := th.SystemAdminUser.Id

	hasRemote := func(t *testing.T, channelID, remoteID string) bool {
		t.Helper()
		has, err := th.App.HasRemote(channelID, remoteID)
		require.NoError(t, err)
		return has
	}

	t.Run("missing connection ID", func(t *testing.T) {
		for _, command := range []string{"/share-channel invite", "/share-channel invite --connectionID"} {
			text := runCommand(th, &ShareProvider{}, adminID, th.BasicChannel.Id, command)
			require.Equal(t, T("api.command_share.must_specify_valid_remote"), text, command)
		}
	})

	t.Run("remote already invited", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		rc := seedRemoteCluster(t, th)
		shareHomeChannel(t, th, channel)
		_, err := th.App.SaveSharedChannelRemote(&model.SharedChannelRemote{
			ChannelId: channel.Id,
			RemoteId:  rc.RemoteId,
			CreatorId: th.BasicUser.Id,
		})
		require.NoError(t, err)

		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel invite --connectionID "+rc.RemoteId)
		require.Equal(t, T("api.command_share.remote_already_invited"), text)
	})

	t.Run("unknown connection ID", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		shareHomeChannel(t, th, channel)
		remoteID := model.NewId()

		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel invite --connectionID "+remoteID)

		require.True(t, strings.HasPrefix(text, T("api.command_share.remote_id_invalid.error", map[string]any{"Error": ""})), text)
		require.False(t, hasRemote(t, channel.Id, remoteID))
	})

	t.Run("invite to a channel that cannot be shared", func(t *testing.T) {
		dm := th.createDmChannel(t, th.BasicUser2)
		rc := seedRemoteCluster(t, th)

		text := runCommand(th, &ShareProvider{}, adminID, dm.Id, "/share-channel invite --connectionID "+rc.RemoteId)

		shareErr, inviteErr, found := strings.Cut(text, "\n")
		require.True(t, found, "expected the share error followed by the invite error, got:\n%s", text)
		require.Equal(t, T("api.command_share.share_channel.error", map[string]any{"Error": "cannot share a direct or group channel"}), shareErr)
		require.True(t, strings.HasPrefix(inviteErr, T("api.command_share.invite_remote_to_channel.error", map[string]any{"Error": ""})), inviteErr)
		require.False(t, hasRemote(t, dm.Id, rc.RemoteId))
	})

	t.Run("invite to a channel that is already shared", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		shareHomeChannel(t, th, channel)
		rc := seedRemoteCluster(t, th)

		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel invite --connectionID "+rc.RemoteId)

		require.Equal(t, "##### "+T("api.command_share.invitation_sent", map[string]any{"Name": rc.DisplayName, "SiteURL": rc.SiteURL}), text)
		require.True(t, hasRemote(t, channel.Id, rc.RemoteId))
	})

	t.Run("invite to a channel that is not shared yet shares it first", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		rc := seedRemoteCluster(t, th)

		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel invite --connectionID "+rc.RemoteId)

		require.Equal(t,
			"##### "+T("api.command_share.channel_shared")+"\n"+
				"##### "+T("api.command_share.invitation_sent", map[string]any{"Name": rc.DisplayName, "SiteURL": rc.SiteURL}),
			text)
		sc, err := th.App.GetSharedChannel(channel.Id)
		require.NoError(t, err)
		require.True(t, sc.Home)
		require.True(t, hasRemote(t, channel.Id, rc.RemoteId))
	})
}

func TestShareProviderDoUninviteRemote(t *testing.T) {
	T := i18n.GetUserTranslations("en")
	th := setupForSharedChannels(t).initBasic(t)
	adminID := th.SystemAdminUser.Id

	t.Run("missing connection ID", func(t *testing.T) {
		for _, command := range []string{"/share-channel uninvite", "/share-channel uninvite --connectionID"} {
			text := runCommand(th, &ShareProvider{}, adminID, th.BasicChannel.Id, command)
			require.Equal(t, T("api.command_share.remote_not_valid"), text, command)
		}
	})

	t.Run("remote not invited to the channel", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		shareHomeChannel(t, th, channel)
		rc := seedRemoteCluster(t, th)

		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel uninvite --connectionID "+rc.RemoteId)
		require.Contains(t, text, T("api.command_share.channel_remote_id_not_exists", map[string]any{"RemoteId": rc.RemoteId}))
	})

	t.Run("success", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		rc := seedRemoteCluster(t, th)
		text := runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel invite --connectionID "+rc.RemoteId)
		require.Contains(t, text, T("api.command_share.invitation_sent", map[string]any{"Name": rc.DisplayName, "SiteURL": rc.SiteURL}))

		text = runCommand(th, &ShareProvider{}, adminID, channel.Id, "/share-channel uninvite --connectionID "+rc.RemoteId)

		require.Equal(t, "##### "+T("api.command_share.remote_uninvited", map[string]any{"RemoteId": rc.RemoteId}), text)
		has, err := th.App.HasRemote(channel.Id, rc.RemoteId)
		require.NoError(t, err)
		require.False(t, has)
	})
}
