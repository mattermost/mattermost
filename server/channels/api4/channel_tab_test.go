// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestCreateChannelTab(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	t.Run("should not work without a license", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		_, _, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	t.Run("a user should be able to create a channel bookmark in a public channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)
		require.Equal(t, cb.DisplayName, channelTab.DisplayName)
	})

	t.Run("a user should be able to create a channel bookmark in a private channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicPrivateChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)
		require.Equal(t, cb.DisplayName, channelTab.DisplayName)
	})

	t.Run("without the necessary permission on public channels, the creation should fail", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionAddTabPublicChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionAddTabPublicChannel.Id, model.ChannelUserRoleId)

		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("without the necessary permission on private channels, the creation should fail", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionAddTabPrivateChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionAddTabPrivateChannel.Id, model.ChannelUserRoleId)

		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicPrivateChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("bookmark creation should not work in a moderated channel", func(t *testing.T) {
		// moderate the channel to restrict bookmarks for members
		manageTabs := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, true)

		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("bookmark creation should not work in an archived channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("a guest user should not be able to create a channel bookmark", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		// test in public channel
		cb, resp, err := guestClient.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)

		// test in private channel
		channelTab.ChannelId = th.BasicPrivateChannel.Id
		cb, resp, err = guestClient.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("a user should always be able to create channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionAddTabPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionAddTabPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionAddTabPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionAddTabPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelTab := &model.ChannelTab{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelTab.ChannelId = gm.Id
		cb, resp, err = th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)
	})

	t.Run("a guest should not be able to create channel bookmarks on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelTab := &model.ChannelTab{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := guestClient.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelTab.ChannelId = gm.Id
		cb, resp, err = guestClient.CreateChannelTab(context.Background(), channelTab)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("a websockets event should be fired as part of creating a bookmark", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark1 := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		bookmark, appErr := th.App.CreateChannelTab(th.Context, bookmark1, "")
		require.Nil(t, appErr)

		var b model.ChannelTabWithFileInfo
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelTabCreated {
					err := json.Unmarshal([]byte(event.GetData()["bookmark"].(string)), &b)
					require.NoError(t, err)
					eventReceived = true
					waiting = false
				}
			case <-timeout:
				waiting = false
			}
		}

		require.True(t, eventReceived, "Expected WebSocket event was not received within the timeout period")
		require.NotNil(t, b)
		require.NotEmpty(t, b.Id)
		require.Equal(t, bookmark, &b)
	})
}

func TestEditChannelTab(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelTab(context.Background(), th.BasicChannel.Id, model.NewId(), &model.ChannelTabPatch{})
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	t.Run("a user editing a channel bookmark in public and private channels", func(t *testing.T) {
		testCases := []struct {
			name             string
			channelId        string
			userClient       *model.Client4
			removePermission string
			expectedError    bool
			expectedStatus   int
		}{
			{
				name:           "public channel with permissions, should succeed",
				channelId:      th.BasicChannel.Id,
				userClient:     th.Client,
				expectedError:  false,
				expectedStatus: http.StatusOK,
			},
			{
				name:           "private channel with permissions, should succeed",
				channelId:      th.BasicPrivateChannel.Id,
				userClient:     th.Client,
				expectedError:  false,
				expectedStatus: http.StatusOK,
			},
			{
				name:             "public channel without permissions, should fail",
				channelId:        th.BasicChannel.Id,
				userClient:       th.Client,
				removePermission: model.PermissionEditTabPublicChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:             "private channel without permissions, should fail",
				channelId:        th.BasicPrivateChannel.Id,
				userClient:       th.Client,
				removePermission: model.PermissionEditTabPrivateChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:           "guest user in a public channel, should fail",
				channelId:      th.BasicChannel.Id,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
			{
				name:           "guest user in a private channel, should fail",
				channelId:      th.BasicPrivateChannel.Id,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				if tc.removePermission != "" {
					th.RemovePermissionFromRole(t, tc.removePermission, model.ChannelUserRoleId)
					defer th.AddPermissionToRole(t, tc.removePermission, model.ChannelUserRoleId)
				}

				channelTab := &model.ChannelTab{
					ChannelId:   tc.channelId,
					DisplayName: "Link bookmark test",
					LinkUrl:     "https://mattermost.com",
					Type:        model.ChannelTabLink,
					Emoji:       ":smile:",
				}

				cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
				require.NoError(t, err)
				CheckCreatedStatus(t, resp)
				require.NotNil(t, cb)

				patch := &model.ChannelTabPatch{
					DisplayName: model.NewPointer("Edited bookmark test"),
					LinkUrl:     model.NewPointer("http://edited.url"),
				}

				ucb, resp, err := tc.userClient.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
				if tc.expectedError {
					require.Error(t, err)
					require.Nil(t, ucb)
				} else {
					require.NoError(t, err)
					require.Nil(t, ucb.Deleted)
					require.NotNil(t, ucb.Updated)
					require.Equal(t, "Edited bookmark test", ucb.Updated.DisplayName)
					require.Equal(t, "http://edited.url", ucb.Updated.LinkUrl)
				}
				checkHTTPStatus(t, resp, tc.expectedStatus)
			})
		}
	})

	t.Run("bookmark editing should not work in a moderated channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageTabs := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, true)

		// try to patch the channel bookmark
		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("bookmark editing should not work in an archived channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelTab.ChannelId)

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to patch the channel bookmark
		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("trying to edit a nonexistent bookmark should fail", func(t *testing.T) {
		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelTab(context.Background(), th.BasicChannel.Id, model.NewId(), patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("trying to edit an already deleted bookmark should fail", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		_, appErr := th.App.DeleteChannelTab(cb.Id, "")
		require.Nil(t, appErr)

		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("a user should always be able to edit channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionEditTabPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionEditTabPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionEditTabPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionEditTabPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelTab := &model.ChannelTab{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Nil(t, ucb.Deleted)
		require.NotNil(t, ucb.Updated)
		require.Equal(t, "Edited bookmark test", ucb.Updated.DisplayName)
		require.Equal(t, "http://edited.url", ucb.Updated.LinkUrl)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelTab.ChannelId = gm.Id
		gcb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, gcb)

		gucb, resp, err := th.Client.UpdateChannelTab(context.Background(), gcb.ChannelId, gcb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Nil(t, gucb.Deleted)
		require.NotNil(t, gucb.Updated)
		require.Equal(t, "Edited bookmark test", gucb.Updated.DisplayName)
		require.Equal(t, "http://edited.url", gucb.Updated.LinkUrl)
	})

	t.Run("a guest should not be able to edit channel bookmarks on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelTab := &model.ChannelTab{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		ucb, resp, err := guestClient.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelTab.ChannelId = gm.Id
		gcb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		gucb, resp, err := guestClient.UpdateChannelTab(context.Background(), gcb.ChannelId, gcb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, gucb)
	})

	t.Run("a user should be able to edit another user's bookmark", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		patch := &model.ChannelTabPatch{
			DisplayName: model.NewPointer("Edited bookmark test"),
			LinkUrl:     model.NewPointer("http://edited.url"),
		}

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		ucb, resp, err := client2.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Deleted should contain old channel bookmark
		require.NotNil(t, ucb.Deleted)
		require.Equal(t, cb.DisplayName, ucb.Deleted.DisplayName)
		require.Equal(t, cb.LinkUrl, ucb.Deleted.LinkUrl)
		require.Equal(t, th.BasicUser.Id, ucb.Deleted.OwnerId)

		// Updated should contain the new channel bookmark
		require.NotNil(t, ucb.Updated)
		require.Equal(t, *patch.DisplayName, ucb.Updated.DisplayName)
		require.Equal(t, *patch.LinkUrl, ucb.Updated.LinkUrl)
		require.Equal(t, th.BasicUser2.Id, ucb.Updated.OwnerId)
	})

	t.Run("a websockets event should be fired as part of editing a bookmark", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark1 := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		cb, appErr := th.App.CreateChannelTab(th.Context, bookmark1, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		patch := &model.ChannelTabPatch{DisplayName: model.NewPointer("Edited bookmark test")}
		_, resp, err := th.Client.UpdateChannelTab(context.Background(), cb.ChannelId, cb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		var ucb model.UpdateChannelTabResponse
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelTabUpdated {
					err := json.Unmarshal([]byte(event.GetData()["bookmarks"].(string)), &ucb)
					require.NoError(t, err)
					eventReceived = true
					waiting = false
				}
			case <-timeout:
				waiting = false
			}
		}

		require.True(t, eventReceived, "Expected WebSocket event was not received within the timeout period")
		require.NotNil(t, ucb)
		require.NotEmpty(t, ucb.Updated)
		require.Equal(t, "Edited bookmark test", ucb.Updated.DisplayName)
	})
}

func TestUpdateChannelTabSortOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	createTab := func(name, channelId string) *model.ChannelTabWithFileInfo {
		b := &model.ChannelTab{
			ChannelId:   channelId,
			DisplayName: name,
			Type:        model.ChannelTabLink,
			LinkUrl:     "https://sample.com",
		}

		nb, appErr := th.App.CreateChannelTab(th.Context, b, "")
		require.Nil(t, appErr)
		return nb
	}

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	publicTab1 := createTab("one", th.BasicChannel.Id)
	publicTab2 := createTab("two", th.BasicChannel.Id)
	publicTab3 := createTab("three", th.BasicChannel.Id)
	_ = createTab("four", th.BasicChannel.Id)

	privateTab1 := createTab("one", th.BasicPrivateChannel.Id)
	privateTab2 := createTab("two", th.BasicPrivateChannel.Id)
	_ = createTab("three", th.BasicPrivateChannel.Id)
	privateTab4 := createTab("four", th.BasicPrivateChannel.Id)

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelTabSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 1)
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	t.Run("a user updating a bookmark's order in public and private channels", func(t *testing.T) {
		testCases := []struct {
			name             string
			channelId        string
			tabId       string
			sortOrder        int64
			userClient       *model.Client4
			removePermission string
			expectedError    bool
			expectedStatus   int
		}{
			{
				name:           "public channel with permissions, should succeed",
				channelId:      th.BasicChannel.Id,
				tabId:     publicTab2.Id,
				sortOrder:      3,
				userClient:     th.Client,
				expectedStatus: http.StatusOK,
			},
			{
				name:           "private channel with permissions, should succeed",
				channelId:      th.BasicPrivateChannel.Id,
				tabId:     privateTab1.Id,
				sortOrder:      3,
				userClient:     th.Client,
				expectedStatus: http.StatusOK,
			},
			{
				name:             "public channel without permissions, should fail",
				channelId:        th.BasicChannel.Id,
				tabId:       publicTab1.Id,
				sortOrder:        3,
				userClient:       th.Client,
				removePermission: model.PermissionOrderTabPublicChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:             "private channel without permissions, should fail",
				channelId:        th.BasicPrivateChannel.Id,
				tabId:       privateTab2.Id,
				sortOrder:        1,
				userClient:       th.Client,
				removePermission: model.PermissionOrderTabPrivateChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:           "guest user in a public channel, should fail",
				channelId:      th.BasicChannel.Id,
				tabId:     publicTab3.Id,
				sortOrder:      2,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
			{
				name:           "guest user in a private channel, should fail",
				channelId:      th.BasicPrivateChannel.Id,
				tabId:     privateTab4.Id,
				sortOrder:      2,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
			{
				name:           "public channel with permissions, setting order to a negative number, should fail",
				channelId:      th.BasicChannel.Id,
				tabId:     publicTab2.Id,
				sortOrder:      -1,
				userClient:     th.Client,
				expectedError:  true,
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "public channel with permissions, setting order to a number greater than the amount of bookmarks of the channel, should fail",
				channelId:      th.BasicChannel.Id,
				tabId:     publicTab2.Id,
				sortOrder:      300,
				userClient:     th.Client,
				expectedError:  true,
				expectedStatus: http.StatusBadRequest,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				if tc.removePermission != "" {
					th.RemovePermissionFromRole(t, tc.removePermission, model.ChannelUserRoleId)
					defer th.AddPermissionToRole(t, tc.removePermission, model.ChannelUserRoleId)
				}

				// first we capture and later restore original bookmark's sort order
				originalTab, appErr := th.App.GetTab(tc.tabId, false)
				require.Nil(t, appErr)
				defer func() {
					_, err := th.App.UpdateChannelTabSortOrder(originalTab.Id, originalTab.ChannelId, originalTab.SortOrder, "")
					require.Nil(t, err)
				}()

				bookmarks, resp, err := tc.userClient.UpdateChannelTabSortOrder(context.Background(), tc.channelId, tc.tabId, tc.sortOrder)
				if tc.expectedError {
					require.Error(t, err)
					require.Nil(t, bookmarks)
				} else {
					require.NoError(t, err)
					require.Len(t, bookmarks, 4)

					// find and compare bookmark's new sort order
					var bookmark *model.ChannelTabWithFileInfo
					for _, b := range bookmarks {
						if b.Id == tc.tabId {
							bookmark = b
							break
						}
					}
					require.NotNil(t, bookmark, "updated bookmark should be in the client's response")
					require.Equal(t, tc.sortOrder, bookmark.SortOrder)
				}
				checkHTTPStatus(t, resp, tc.expectedStatus)
			})
		}
	})

	t.Run("bookmark ordering should not work in a moderated channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageTabs := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, true)

		// try to update the channel bookmark's order
		bookmarks, resp, err := th.Client.UpdateChannelTabSortOrder(context.Background(), cb.ChannelId, cb.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("bookmark ordering should not work in an archived channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelTab.ChannelId)

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to update the channel bookmark's order
		bookmarks, resp, err := th.Client.UpdateChannelTabSortOrder(context.Background(), cb.ChannelId, cb.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to update the order of a nonexistent bookmark should fail", func(t *testing.T) {
		bookmarks, resp, err := th.Client.UpdateChannelTabSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 1)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to update the order of an already deleted bookmark should fail", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		_, appErr := th.App.DeleteChannelTab(cb.Id, "")
		require.Nil(t, appErr)

		bookmarks, resp, err := th.Client.UpdateChannelTabSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 1)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("a user should always be able to update the channel bookmarks sort order on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionOrderTabPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionOrderTabPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionOrderTabPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionOrderTabPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmTab1 := createTab("one", dm.Id)
		dmTab2 := createTab("two", dm.Id)

		bookmarks, resp, err := th.Client.UpdateChannelTabSortOrder(context.Background(), dm.Id, dmTab1.Id, 1)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, bookmarks, 2)
		require.Equal(t, dmTab2.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
		require.Equal(t, dmTab1.Id, bookmarks[1].Id)
		require.Equal(t, int64(1), bookmarks[1].SortOrder)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		gmTab1 := createTab("one", gm.Id)
		gmTab2 := createTab("two", gm.Id)

		bookmarks, resp, err = th.Client.UpdateChannelTabSortOrder(context.Background(), gm.Id, gmTab2.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, bookmarks, 2)
		require.Equal(t, gmTab2.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
		require.Equal(t, gmTab1.Id, bookmarks[1].Id)
		require.Equal(t, int64(1), bookmarks[1].SortOrder)
	})

	t.Run("a guest should not be able to edit channel bookmarks sort order on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmTab1 := createTab("one", dm.Id)
		_ = createTab("two", dm.Id)

		bookmarks, resp, err := guestClient.UpdateChannelTabSortOrder(context.Background(), dm.Id, dmTab1.Id, 1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		_ = createTab("one", gm.Id)
		gmTab2 := createTab("two", gm.Id)

		bookmarks, resp, err = guestClient.UpdateChannelTabSortOrder(context.Background(), gm.Id, gmTab2.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("a user should be able to edit another user's bookmark sort order", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		bookmarks, resp, err := client2.UpdateChannelTabSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)
		require.Equal(t, cb.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
	})

	t.Run("a websockets event should be fired as part of editing a bookmark's sort order", func(t *testing.T) {
		now := model.GetMillis()

		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		bookmark2 := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test 2",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		cb, appErr := th.App.CreateChannelTab(th.Context, bookmark, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		cb, appErr = th.App.CreateChannelTab(th.Context, bookmark2, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		bookmarks, resp, err := th.Client.UpdateChannelTabSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)

		var bl []*model.ChannelTabWithFileInfo
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelTabSorted {
					err := json.Unmarshal([]byte(event.GetData()["bookmarks"].(string)), &bl)
					require.NoError(t, err)
					for _, b := range bl {
						require.Greater(t, b.UpdateAt, now)
					}
					eventReceived = true
					waiting = false
				}
			case <-timeout:
				waiting = false
			}
		}

		require.True(t, eventReceived, "Expected WebSocket event was not received within the timeout period")
		require.NotEmpty(t, bl)
		require.Equal(t, cb.Id, bl[0].Id)
		require.Equal(t, int64(0), bl[0].SortOrder)
	})
}

func TestDeleteChannelTab(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.DeleteChannelTab(context.Background(), th.BasicChannel.Id, model.NewId())
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	t.Run("a user deleting bookmarks in public and private channels", func(t *testing.T) {
		testCases := []struct {
			name             string
			channelId        string
			userClient       *model.Client4
			removePermission string
			expectedError    bool
			expectedStatus   int
		}{
			{
				name:           "public channel with permissions, should succeed",
				channelId:      th.BasicChannel.Id,
				userClient:     th.Client,
				expectedStatus: http.StatusOK,
			},
			{
				name:           "private channel with permissions, should succeed",
				channelId:      th.BasicPrivateChannel.Id,
				userClient:     th.Client,
				expectedStatus: http.StatusOK,
			},
			{
				name:             "public channel without permissions, should fail",
				channelId:        th.BasicChannel.Id,
				userClient:       th.Client,
				removePermission: model.PermissionDeleteTabPublicChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:             "private channel without permissions, should fail",
				channelId:        th.BasicPrivateChannel.Id,
				userClient:       th.Client,
				removePermission: model.PermissionDeleteTabPrivateChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:           "guest user in a public channel, should fail",
				channelId:      th.BasicChannel.Id,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
			{
				name:           "guest user in a private channel, should fail",
				channelId:      th.BasicPrivateChannel.Id,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				if tc.removePermission != "" {
					th.RemovePermissionFromRole(t, tc.removePermission, model.ChannelUserRoleId)
					defer th.AddPermissionToRole(t, tc.removePermission, model.ChannelUserRoleId)
				}

				// first we create a bookmark for the test case channel
				bookmark := &model.ChannelTab{
					ChannelId:   tc.channelId,
					DisplayName: "Tab",
					Type:        model.ChannelTabLink,
					LinkUrl:     "https://sample.com",
				}

				cb, appErr := th.App.CreateChannelTab(th.Context, bookmark, "")
				require.Nil(t, appErr)
				require.NotNil(t, cb)

				// then we try to delete with the parameters of the test
				b, resp, err := tc.userClient.DeleteChannelTab(context.Background(), tc.channelId, cb.Id)
				if tc.expectedError {
					require.Error(t, err)
					require.Nil(t, b)
				} else {
					require.NoError(t, err)
					require.Equal(t, cb.Id, b.Id)
				}
				checkHTTPStatus(t, resp, tc.expectedStatus)
			})
		}
	})

	t.Run("bookmark deletion should not work in a moderated channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageTabs := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, true)

		// try to delete the channel bookmark
		bookmarks, resp, err := th.Client.DeleteChannelTab(context.Background(), cb.ChannelId, cb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("bookmark deletion should not work in an archived channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelTab.ChannelId)

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to delete the channel bookmark
		bookmarks, resp, err := th.Client.DeleteChannelTab(context.Background(), cb.ChannelId, cb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to delete a nonexistent bookmark should fail", func(t *testing.T) {
		bookmarks, resp, err := th.Client.DeleteChannelTab(context.Background(), th.BasicChannel.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to delete an already deleted bookmark should fail", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		_, appErr := th.App.DeleteChannelTab(cb.Id, "")
		require.Nil(t, appErr)

		bookmarks, resp, err := th.Client.DeleteChannelTab(context.Background(), th.BasicChannel.Id, cb.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("a user should always be able to delete the channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionDeleteTabPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionDeleteTabPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionDeleteTabPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionDeleteTabPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmTab := &model.ChannelTab{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		dmb, appErr := th.App.CreateChannelTab(th.Context, dmTab, "")
		require.Nil(t, appErr)

		ddmb, resp, err := th.Client.DeleteChannelTab(context.Background(), dm.Id, dmb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, dmb.Id, ddmb.Id)
		require.NotZero(t, ddmb.DeleteAt)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		gmTab := &model.ChannelTab{
			ChannelId:   gm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		gmb, appErr := th.App.CreateChannelTab(th.Context, gmTab, "")
		require.Nil(t, appErr)

		dgmb, resp, err := th.Client.DeleteChannelTab(context.Background(), gm.Id, gmb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, gmb.Id, dgmb.Id)
		require.NotZero(t, dgmb.DeleteAt)
	})

	t.Run("a guest should not be able to delete channel bookmarks on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmTab := &model.ChannelTab{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		dmb, appErr := th.App.CreateChannelTab(th.Context, dmTab, "")
		require.Nil(t, appErr)

		ddmb, resp, err := guestClient.DeleteChannelTab(context.Background(), dm.Id, dmb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ddmb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		gmTab := &model.ChannelTab{
			ChannelId:   gm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		gmb, appErr := th.App.CreateChannelTab(th.Context, gmTab, "")
		require.Nil(t, appErr)

		dgmb, resp, err := guestClient.DeleteChannelTab(context.Background(), gm.Id, gmb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, dgmb)
	})

	t.Run("a user should be able to delete another user's bookmark", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		dbm, resp, err := client2.DeleteChannelTab(context.Background(), th.BasicChannel.Id, cb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, dbm)
		require.Equal(t, cb.Id, dbm.Id)
		require.NotZero(t, dbm.DeleteAt)
	})

	t.Run("a websockets event should be fired as part of deleting a bookmark", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		cb, appErr := th.App.CreateChannelTab(th.Context, bookmark, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		dbm, resp, err := th.Client.DeleteChannelTab(context.Background(), th.BasicChannel.Id, cb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, dbm)

		var b *model.ChannelTabWithFileInfo
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelTabDeleted {
					err := json.Unmarshal([]byte(event.GetData()["bookmark"].(string)), &b)
					require.NoError(t, err)
					eventReceived = true
					waiting = false
				}
			case <-timeout:
				waiting = false
			}
		}
		require.True(t, eventReceived, "Expected WebSocket event was not received within the timeout period")
		require.NotEmpty(t, b)
		require.Equal(t, cb.Id, b.Id)
		require.NotEmpty(t, b.DeleteAt)
	})
}

func TestListChannelTabsForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	createTab := func(name, channelId string) *model.ChannelTabWithFileInfo {
		b := &model.ChannelTab{
			ChannelId:   channelId,
			DisplayName: name,
			Type:        model.ChannelTabLink,
			LinkUrl:     "https://sample.com",
		}

		nb, appErr := th.App.CreateChannelTab(th.Context, b, "")
		require.Nil(t, appErr)
		time.Sleep(1 * time.Millisecond)
		return nb
	}

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.DeleteChannelTab(context.Background(), th.BasicChannel.Id, model.NewId())
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	publicTab1 := createTab("one", th.BasicChannel.Id)
	publicTab2 := createTab("two", th.BasicChannel.Id)
	publicTab3 := createTab("three", th.BasicChannel.Id)
	publicTab4 := createTab("four", th.BasicChannel.Id)
	_, dErr := th.App.DeleteChannelTab(publicTab1.Id, "")
	require.Nil(t, dErr)

	privateTab1 := createTab("one", th.BasicPrivateChannel.Id)
	privateTab2 := createTab("two", th.BasicPrivateChannel.Id)
	privateTab3 := createTab("three", th.BasicPrivateChannel.Id)
	privateTab4 := createTab("four", th.BasicPrivateChannel.Id)
	_, dErr = th.App.DeleteChannelTab(privateTab1.Id, "")
	require.Nil(t, dErr)

	// an open channel for which the guest is a member but the basic
	// user is not
	onlyGuestChannel := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypePrivate)
	th.AddUserToChannel(t, guest, onlyGuestChannel)
	guestTab := createTab("guest", onlyGuestChannel.Id)

	// DM
	dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
	require.Nil(t, dmErr)
	dmTab := createTab("dm-one", dm.Id)

	// GM
	gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
	require.Nil(t, appErr)
	gmTab := createTab("gm-one", gm.Id)

	t.Run("a user listing bookmarks in public and private channels", func(t *testing.T) {
		testCases := []struct {
			name              string
			channelId         string
			since             int64
			userClient        *model.Client4
			expectedTabs []string
			expectedError     bool
			expectedStatus    int
		}{
			{
				name:              "public channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicChannel.Id,
				userClient:        th.Client,
				expectedTabs: []string{publicTab2.Id, publicTab3.Id, publicTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "private channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicPrivateChannel.Id,
				userClient:        th.Client,
				expectedTabs: []string{privateTab2.Id, privateTab3.Id, privateTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "public channel with since set early, should retrieve all bookmarks include the deleted one",
				channelId:         th.BasicChannel.Id,
				since:             publicTab1.CreateAt,
				userClient:        th.Client,
				expectedTabs: []string{publicTab1.Id, publicTab2.Id, publicTab3.Id, publicTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "Private channel with since set early, should retrieve all bookmarks include the deleted one",
				channelId:         th.BasicPrivateChannel.Id,
				since:             privateTab1.CreateAt,
				userClient:        th.Client,
				expectedTabs: []string{privateTab1.Id, privateTab2.Id, privateTab3.Id, privateTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "public channel with since, should retrieve some of the bookmarks",
				channelId:         th.BasicChannel.Id,
				since:             publicTab3.CreateAt,
				userClient:        th.Client,
				expectedTabs: []string{publicTab1.Id, publicTab3.Id, publicTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "private channel with since, should retrieve some of the bookmarks",
				channelId:         th.BasicPrivateChannel.Id,
				since:             privateTab4.CreateAt,
				userClient:        th.Client,
				expectedTabs: []string{privateTab1.Id, privateTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, public channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicChannel.Id,
				userClient:        guestClient,
				expectedTabs: []string{publicTab2.Id, publicTab3.Id, publicTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, private channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicPrivateChannel.Id,
				userClient:        guestClient,
				expectedTabs: []string{privateTab2.Id, privateTab3.Id, privateTab4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, guest channel without since, should retrieve all non deleted bookmarks",
				channelId:         onlyGuestChannel.Id,
				userClient:        guestClient,
				expectedTabs: []string{guestTab.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "normal user, guest channel without since, should fail as user is not a member",
				channelId:         onlyGuestChannel.Id,
				userClient:        th.Client,
				expectedTabs: []string{},
				expectedError:     true,
				expectedStatus:    http.StatusForbidden,
			},
			{
				name:              "guest user, dm without since, should retrieve all non deleted bookmarks",
				channelId:         dm.Id,
				userClient:        guestClient,
				expectedTabs: []string{dmTab.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "normal user, dm without since, should retrieve all non deleted bookmarks",
				channelId:         dm.Id,
				userClient:        th.Client,
				expectedTabs: []string{dmTab.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, gm without since, should retrieve all non deleted bookmarks",
				channelId:         gm.Id,
				userClient:        guestClient,
				expectedTabs: []string{gmTab.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "normal user, gm without since, should retrieve all non deleted bookmarks",
				channelId:         gm.Id,
				userClient:        th.Client,
				expectedTabs: []string{gmTab.Id},
				expectedStatus:    http.StatusOK,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				bookmarks, resp, err := tc.userClient.ListChannelTabsForChannel(context.Background(), tc.channelId, tc.since)
				if tc.expectedError {
					require.Error(t, err)
					require.Nil(t, bookmarks)
				} else {
					require.NoError(t, err)

					tabIDs := make([]string, len(bookmarks))
					for i, b := range bookmarks {
						tabIDs[i] = b.Id
					}

					require.ElementsMatch(t, tc.expectedTabs, tabIDs)
				}
				checkHTTPStatus(t, resp, tc.expectedStatus)
			})
		}
	})

	t.Run("bookmark listing should work in an archived channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelTab.ChannelId)

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to list the channel bookmarks
		bookmarks, resp, err := th.Client.ListChannelTabsForChannel(context.Background(), cb.ChannelId, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, bookmarks)
	})

	t.Run("bookmark listing should work in a moderated channel", func(t *testing.T) {
		channelTab := &model.ChannelTab{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelTabLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelTab(context.Background(), channelTab)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageTabs := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageTabs, true)

		// try to list existing channel bookmarks
		bookmarks, resp, err := th.Client.ListChannelTabsForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)
	})
}
