// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestCreateChannelBookmark(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	t.Run("should not work without a license", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		_, _, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	t.Run("a user should be able to create a channel bookmark in a public channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)
		require.Equal(t, cb.DisplayName, channelBookmark.DisplayName)
	})

	t.Run("a user should be able to create a channel bookmark in a private channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicPrivateChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)
		require.Equal(t, cb.DisplayName, channelBookmark.DisplayName)
	})

	t.Run("without the necessary permission on public channels, the creation should fail", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("without the necessary permission on private channels, the creation should fail", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicPrivateChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("bookmark creation should not work in a moderated channel", func(t *testing.T) {
		// moderate the channel to restrict bookmarks for members
		manageBookmarks := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, true)

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("bookmark creation should not work in an archived channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("a guest user should not be able to create a channel bookmark", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		// test in public channel
		cb, resp, err := guestClient.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)

		// test in private channel
		channelBookmark.ChannelId = th.BasicPrivateChannel.Id
		cb, resp, err = guestClient.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("a user should always be able to create channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelBookmark.ChannelId = gm.Id
		cb, resp, err = th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)
	})

	t.Run("a guest should not be able to create channel bookmarks on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := guestClient.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelBookmark.ChannelId = gm.Id
		cb, resp, err = guestClient.CreateChannelBookmark(context.Background(), channelBookmark)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, cb)
	})

	t.Run("a websockets event should be fired as part of creating a bookmark", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark1 := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		bookmark, appErr := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, appErr)

		var b model.ChannelBookmarkWithFileInfo
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkCreated {
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

func TestEditChannelBookmark(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId(), &model.ChannelBookmarkPatch{})
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
				removePermission: model.PermissionEditBookmarkPublicChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:             "private channel without permissions, should fail",
				channelId:        th.BasicPrivateChannel.Id,
				userClient:       th.Client,
				removePermission: model.PermissionEditBookmarkPrivateChannel.Id,
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

				channelBookmark := &model.ChannelBookmark{
					ChannelId:   tc.channelId,
					DisplayName: "Link bookmark test",
					LinkUrl:     "https://mattermost.com",
					Type:        model.ChannelBookmarkLink,
					Emoji:       ":smile:",
				}

				cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
				require.NoError(t, err)
				CheckCreatedStatus(t, resp)
				require.NotNil(t, cb)

				patch := &model.ChannelBookmarkPatch{
					DisplayName: new("Edited bookmark test"),
					LinkUrl:     new("http://edited.url"),
				}

				ucb, resp, err := tc.userClient.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
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
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageBookmarks := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, true)

		// try to patch the channel bookmark
		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("bookmark editing should not work in an archived channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelBookmark.ChannelId)

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to patch the channel bookmark
		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("trying to edit a nonexistent bookmark should fail", func(t *testing.T) {
		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId(), patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("trying to edit an already deleted bookmark should fail", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		_, appErr := th.App.DeleteChannelBookmark(cb.Id, "")
		require.Nil(t, appErr)

		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("a user should always be able to edit channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionEditBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionEditBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionEditBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionEditBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Nil(t, ucb.Deleted)
		require.NotNil(t, ucb.Updated)
		require.Equal(t, "Edited bookmark test", ucb.Updated.DisplayName)
		require.Equal(t, "http://edited.url", ucb.Updated.LinkUrl)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelBookmark.ChannelId = gm.Id
		gcb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, gcb)

		gucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), gcb.ChannelId, gcb.Id, patch)
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

		channelBookmark := &model.ChannelBookmark{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		ucb, resp, err := guestClient.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelBookmark.ChannelId = gm.Id
		gcb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		gucb, resp, err := guestClient.UpdateChannelBookmark(context.Background(), gcb.ChannelId, gcb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, gucb)
	})

	t.Run("a user should be able to edit another user's bookmark", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		patch := &model.ChannelBookmarkPatch{
			DisplayName: new("Edited bookmark test"),
			LinkUrl:     new("http://edited.url"),
		}

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		ucb, resp, err := client2.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
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

		bookmark1 := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		cb, appErr := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		patch := &model.ChannelBookmarkPatch{DisplayName: new("Edited bookmark test")}
		_, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		var ucb model.UpdateChannelBookmarkResponse
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkUpdated {
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

func TestUpdateChannelBookmarkSortOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	createBookmark := func(name, channelId string) *model.ChannelBookmarkWithFileInfo {
		b := &model.ChannelBookmark{
			ChannelId:   channelId,
			DisplayName: name,
			Type:        model.ChannelBookmarkLink,
			LinkUrl:     "https://sample.com",
		}

		nb, appErr := th.App.CreateChannelBookmark(th.Context, b, "")
		require.Nil(t, appErr)
		return nb
	}

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	publicBookmark1 := createBookmark("one", th.BasicChannel.Id)
	publicBookmark2 := createBookmark("two", th.BasicChannel.Id)
	publicBookmark3 := createBookmark("three", th.BasicChannel.Id)
	_ = createBookmark("four", th.BasicChannel.Id)

	privateBookmark1 := createBookmark("one", th.BasicPrivateChannel.Id)
	privateBookmark2 := createBookmark("two", th.BasicPrivateChannel.Id)
	_ = createBookmark("three", th.BasicPrivateChannel.Id)
	privateBookmark4 := createBookmark("four", th.BasicPrivateChannel.Id)

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 1)
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
			bookmarkId       string
			sortOrder        int64
			userClient       *model.Client4
			removePermission string
			expectedError    bool
			expectedStatus   int
		}{
			{
				name:           "public channel with permissions, should succeed",
				channelId:      th.BasicChannel.Id,
				bookmarkId:     publicBookmark2.Id,
				sortOrder:      3,
				userClient:     th.Client,
				expectedStatus: http.StatusOK,
			},
			{
				name:           "private channel with permissions, should succeed",
				channelId:      th.BasicPrivateChannel.Id,
				bookmarkId:     privateBookmark1.Id,
				sortOrder:      3,
				userClient:     th.Client,
				expectedStatus: http.StatusOK,
			},
			{
				name:             "public channel without permissions, should fail",
				channelId:        th.BasicChannel.Id,
				bookmarkId:       publicBookmark1.Id,
				sortOrder:        3,
				userClient:       th.Client,
				removePermission: model.PermissionOrderBookmarkPublicChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:             "private channel without permissions, should fail",
				channelId:        th.BasicPrivateChannel.Id,
				bookmarkId:       privateBookmark2.Id,
				sortOrder:        1,
				userClient:       th.Client,
				removePermission: model.PermissionOrderBookmarkPrivateChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:           "guest user in a public channel, should fail",
				channelId:      th.BasicChannel.Id,
				bookmarkId:     publicBookmark3.Id,
				sortOrder:      2,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
			{
				name:           "guest user in a private channel, should fail",
				channelId:      th.BasicPrivateChannel.Id,
				bookmarkId:     privateBookmark4.Id,
				sortOrder:      2,
				userClient:     guestClient,
				expectedError:  true,
				expectedStatus: http.StatusForbidden,
			},
			{
				name:           "public channel with permissions, setting order to a negative number, should fail",
				channelId:      th.BasicChannel.Id,
				bookmarkId:     publicBookmark2.Id,
				sortOrder:      -1,
				userClient:     th.Client,
				expectedError:  true,
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "public channel with permissions, setting order to a number greater than the amount of bookmarks of the channel, should fail",
				channelId:      th.BasicChannel.Id,
				bookmarkId:     publicBookmark2.Id,
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
				originalBookmark, appErr := th.App.GetBookmark(tc.bookmarkId, false)
				require.Nil(t, appErr)
				defer func() {
					_, err := th.App.UpdateChannelBookmarkSortOrder(originalBookmark.Id, originalBookmark.ChannelId, originalBookmark.SortOrder, "")
					require.Nil(t, err)
				}()

				bookmarks, resp, err := tc.userClient.UpdateChannelBookmarkSortOrder(context.Background(), tc.channelId, tc.bookmarkId, tc.sortOrder)
				if tc.expectedError {
					require.Error(t, err)
					require.Nil(t, bookmarks)
				} else {
					require.NoError(t, err)
					require.Len(t, bookmarks, 4)

					// find and compare bookmark's new sort order
					var bookmark *model.ChannelBookmarkWithFileInfo
					for _, b := range bookmarks {
						if b.Id == tc.bookmarkId {
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
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageBookmarks := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, true)

		// try to update the channel bookmark's order
		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), cb.ChannelId, cb.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("bookmark ordering should not work in an archived channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelBookmark.ChannelId)

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to update the channel bookmark's order
		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), cb.ChannelId, cb.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to update the order of a nonexistent bookmark should fail", func(t *testing.T) {
		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 1)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to update the order of an already deleted bookmark should fail", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		_, appErr := th.App.DeleteChannelBookmark(cb.Id, "")
		require.Nil(t, appErr)

		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 1)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("a user should always be able to update the channel bookmarks sort order on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionOrderBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionOrderBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionOrderBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionOrderBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmBookmark1 := createBookmark("one", dm.Id)
		dmBookmark2 := createBookmark("two", dm.Id)

		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), dm.Id, dmBookmark1.Id, 1)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, bookmarks, 2)
		require.Equal(t, dmBookmark2.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
		require.Equal(t, dmBookmark1.Id, bookmarks[1].Id)
		require.Equal(t, int64(1), bookmarks[1].SortOrder)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		gmBookmark1 := createBookmark("one", gm.Id)
		gmBookmark2 := createBookmark("two", gm.Id)

		bookmarks, resp, err = th.Client.UpdateChannelBookmarkSortOrder(context.Background(), gm.Id, gmBookmark2.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, bookmarks, 2)
		require.Equal(t, gmBookmark2.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
		require.Equal(t, gmBookmark1.Id, bookmarks[1].Id)
		require.Equal(t, int64(1), bookmarks[1].SortOrder)
	})

	t.Run("a guest should not be able to edit channel bookmarks sort order on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmBookmark1 := createBookmark("one", dm.Id)
		_ = createBookmark("two", dm.Id)

		bookmarks, resp, err := guestClient.UpdateChannelBookmarkSortOrder(context.Background(), dm.Id, dmBookmark1.Id, 1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		_ = createBookmark("one", gm.Id)
		gmBookmark2 := createBookmark("two", gm.Id)

		bookmarks, resp, err = guestClient.UpdateChannelBookmarkSortOrder(context.Background(), gm.Id, gmBookmark2.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("a user should be able to edit another user's bookmark sort order", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		bookmarks, resp, err := client2.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)
		require.Equal(t, cb.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
	})

	t.Run("a websockets event should be fired as part of editing a bookmark's sort order", func(t *testing.T) {
		now := model.GetMillis()

		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		bookmark2 := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test 2",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		cb, appErr := th.App.CreateChannelBookmark(th.Context, bookmark, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		cb, appErr = th.App.CreateChannelBookmark(th.Context, bookmark2, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)

		var bl []*model.ChannelBookmarkWithFileInfo
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkSorted {
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

func TestDeleteChannelBookmark(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId())
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
				removePermission: model.PermissionDeleteBookmarkPublicChannel.Id,
				expectedError:    true,
				expectedStatus:   http.StatusForbidden,
			},
			{
				name:             "private channel without permissions, should fail",
				channelId:        th.BasicPrivateChannel.Id,
				userClient:       th.Client,
				removePermission: model.PermissionDeleteBookmarkPrivateChannel.Id,
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
				bookmark := &model.ChannelBookmark{
					ChannelId:   tc.channelId,
					DisplayName: "Bookmark",
					Type:        model.ChannelBookmarkLink,
					LinkUrl:     "https://sample.com",
				}

				cb, appErr := th.App.CreateChannelBookmark(th.Context, bookmark, "")
				require.Nil(t, appErr)
				require.NotNil(t, cb)

				// then we try to delete with the parameters of the test
				b, resp, err := tc.userClient.DeleteChannelBookmark(context.Background(), tc.channelId, cb.Id)
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
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageBookmarks := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, true)

		// try to delete the channel bookmark
		bookmarks, resp, err := th.Client.DeleteChannelBookmark(context.Background(), cb.ChannelId, cb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("bookmark deletion should not work in an archived channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelBookmark.ChannelId)

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to delete the channel bookmark
		bookmarks, resp, err := th.Client.DeleteChannelBookmark(context.Background(), cb.ChannelId, cb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to delete a nonexistent bookmark should fail", func(t *testing.T) {
		bookmarks, resp, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("trying to delete an already deleted bookmark should fail", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		_, appErr := th.App.DeleteChannelBookmark(cb.Id, "")
		require.Nil(t, appErr)

		bookmarks, resp, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, cb.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, bookmarks)
	})

	t.Run("a user should always be able to delete the channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(t, model.PermissionDeleteBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(t, model.PermissionDeleteBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		}()

		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmBookmark := &model.ChannelBookmark{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		dmb, appErr := th.App.CreateChannelBookmark(th.Context, dmBookmark, "")
		require.Nil(t, appErr)

		ddmb, resp, err := th.Client.DeleteChannelBookmark(context.Background(), dm.Id, dmb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, dmb.Id, ddmb.Id)
		require.NotZero(t, ddmb.DeleteAt)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		gmBookmark := &model.ChannelBookmark{
			ChannelId:   gm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		gmb, appErr := th.App.CreateChannelBookmark(th.Context, gmBookmark, "")
		require.Nil(t, appErr)

		dgmb, resp, err := th.Client.DeleteChannelBookmark(context.Background(), gm.Id, gmb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, gmb.Id, dgmb.Id)
		require.NotZero(t, dgmb.DeleteAt)
	})

	t.Run("a guest should not be able to delete channel bookmarks on DMs and GMs", func(t *testing.T) {
		// DM
		dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
		require.Nil(t, dmErr)

		dmBookmark := &model.ChannelBookmark{
			ChannelId:   dm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		dmb, appErr := th.App.CreateChannelBookmark(th.Context, dmBookmark, "")
		require.Nil(t, appErr)

		ddmb, resp, err := guestClient.DeleteChannelBookmark(context.Background(), dm.Id, dmb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ddmb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		gmBookmark := &model.ChannelBookmark{
			ChannelId:   gm.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		gmb, appErr := th.App.CreateChannelBookmark(th.Context, gmBookmark, "")
		require.Nil(t, appErr)

		dgmb, resp, err := guestClient.DeleteChannelBookmark(context.Background(), gm.Id, gmb.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, dgmb)
	})

	t.Run("a user should be able to delete another user's bookmark", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
		require.NoError(t, lErr)

		dbm, resp, err := client2.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, cb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, dbm)
		require.Equal(t, cb.Id, dbm.Id)
		require.NotZero(t, dbm.DeleteAt)
	})

	t.Run("a websockets event should be fired as part of deleting a bookmark", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		bookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		// set the user for the session
		originalSessionUserId := th.Context.Session().UserId
		th.Context.Session().UserId = th.BasicUser.Id
		defer func() { th.Context.Session().UserId = originalSessionUserId }()

		cb, appErr := th.App.CreateChannelBookmark(th.Context, bookmark, "")
		require.Nil(t, appErr)
		require.NotNil(t, cb)

		dbm, resp, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, cb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, dbm)

		var b *model.ChannelBookmarkWithFileInfo
		timeout := time.After(5 * time.Second)
		waiting := true
		eventReceived := false
		for waiting {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkDeleted {
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

func TestListChannelBookmarksForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	createBookmark := func(name, channelId string) *model.ChannelBookmarkWithFileInfo {
		b := &model.ChannelBookmark{
			ChannelId:   channelId,
			DisplayName: name,
			Type:        model.ChannelBookmarkLink,
			LinkUrl:     "https://sample.com",
		}

		nb, appErr := th.App.CreateChannelBookmark(th.Context, b, "")
		require.Nil(t, appErr)
		time.Sleep(1 * time.Millisecond)
		return nb
	}

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId())
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	publicBookmark1 := createBookmark("one", th.BasicChannel.Id)
	publicBookmark2 := createBookmark("two", th.BasicChannel.Id)
	publicBookmark3 := createBookmark("three", th.BasicChannel.Id)
	publicBookmark4 := createBookmark("four", th.BasicChannel.Id)
	_, dErr := th.App.DeleteChannelBookmark(publicBookmark1.Id, "")
	require.Nil(t, dErr)

	privateBookmark1 := createBookmark("one", th.BasicPrivateChannel.Id)
	privateBookmark2 := createBookmark("two", th.BasicPrivateChannel.Id)
	privateBookmark3 := createBookmark("three", th.BasicPrivateChannel.Id)
	privateBookmark4 := createBookmark("four", th.BasicPrivateChannel.Id)
	_, dErr = th.App.DeleteChannelBookmark(privateBookmark1.Id, "")
	require.Nil(t, dErr)

	// an open channel for which the guest is a member but the basic
	// user is not
	onlyGuestChannel := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypePrivate)
	th.AddUserToChannel(t, guest, onlyGuestChannel)
	guestBookmark := createBookmark("guest", onlyGuestChannel.Id)

	// DM
	dm, dmErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, guest.Id)
	require.Nil(t, dmErr)
	dmBookmark := createBookmark("dm-one", dm.Id)

	// GM
	gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
	require.Nil(t, appErr)
	gmBookmark := createBookmark("gm-one", gm.Id)

	t.Run("a user listing bookmarks in public and private channels", func(t *testing.T) {
		testCases := []struct {
			name              string
			channelId         string
			since             int64
			userClient        *model.Client4
			expectedBookmarks []string
			expectedError     bool
			expectedStatus    int
		}{
			{
				name:              "public channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicChannel.Id,
				userClient:        th.Client,
				expectedBookmarks: []string{publicBookmark2.Id, publicBookmark3.Id, publicBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "private channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicPrivateChannel.Id,
				userClient:        th.Client,
				expectedBookmarks: []string{privateBookmark2.Id, privateBookmark3.Id, privateBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "public channel with since set early, should retrieve all bookmarks include the deleted one",
				channelId:         th.BasicChannel.Id,
				since:             publicBookmark1.CreateAt,
				userClient:        th.Client,
				expectedBookmarks: []string{publicBookmark1.Id, publicBookmark2.Id, publicBookmark3.Id, publicBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "Private channel with since set early, should retrieve all bookmarks include the deleted one",
				channelId:         th.BasicPrivateChannel.Id,
				since:             privateBookmark1.CreateAt,
				userClient:        th.Client,
				expectedBookmarks: []string{privateBookmark1.Id, privateBookmark2.Id, privateBookmark3.Id, privateBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "public channel with since, should retrieve some of the bookmarks",
				channelId:         th.BasicChannel.Id,
				since:             publicBookmark3.CreateAt,
				userClient:        th.Client,
				expectedBookmarks: []string{publicBookmark1.Id, publicBookmark3.Id, publicBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "private channel with since, should retrieve some of the bookmarks",
				channelId:         th.BasicPrivateChannel.Id,
				since:             privateBookmark4.CreateAt,
				userClient:        th.Client,
				expectedBookmarks: []string{privateBookmark1.Id, privateBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, public channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicChannel.Id,
				userClient:        guestClient,
				expectedBookmarks: []string{publicBookmark2.Id, publicBookmark3.Id, publicBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, private channel without since, should retrieve all non deleted bookmarks",
				channelId:         th.BasicPrivateChannel.Id,
				userClient:        guestClient,
				expectedBookmarks: []string{privateBookmark2.Id, privateBookmark3.Id, privateBookmark4.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, guest channel without since, should retrieve all non deleted bookmarks",
				channelId:         onlyGuestChannel.Id,
				userClient:        guestClient,
				expectedBookmarks: []string{guestBookmark.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "normal user, guest channel without since, should fail as user is not a member",
				channelId:         onlyGuestChannel.Id,
				userClient:        th.Client,
				expectedBookmarks: []string{},
				expectedError:     true,
				expectedStatus:    http.StatusForbidden,
			},
			{
				name:              "guest user, dm without since, should retrieve all non deleted bookmarks",
				channelId:         dm.Id,
				userClient:        guestClient,
				expectedBookmarks: []string{dmBookmark.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "normal user, dm without since, should retrieve all non deleted bookmarks",
				channelId:         dm.Id,
				userClient:        th.Client,
				expectedBookmarks: []string{dmBookmark.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "guest user, gm without since, should retrieve all non deleted bookmarks",
				channelId:         gm.Id,
				userClient:        guestClient,
				expectedBookmarks: []string{gmBookmark.Id},
				expectedStatus:    http.StatusOK,
			},
			{
				name:              "normal user, gm without since, should retrieve all non deleted bookmarks",
				channelId:         gm.Id,
				userClient:        th.Client,
				expectedBookmarks: []string{gmBookmark.Id},
				expectedStatus:    http.StatusOK,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				bookmarks, resp, err := tc.userClient.ListChannelBookmarksForChannel(context.Background(), tc.channelId, tc.since)
				if tc.expectedError {
					require.Error(t, err)
					require.Nil(t, bookmarks)
				} else {
					require.NoError(t, err)

					bookmarkIDs := make([]string, len(bookmarks))
					for i, b := range bookmarks {
						bookmarkIDs[i] = b.Id
					}

					require.ElementsMatch(t, tc.expectedBookmarks, bookmarkIDs)
				}
				checkHTTPStatus(t, resp, tc.expectedStatus)
			})
		}
	})

	t.Run("bookmark listing should work in an archived channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicDeletedChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		_, _, _ = th.SystemAdminClient.RestoreChannel(context.Background(), channelBookmark.ChannelId)

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		_, _ = th.SystemAdminClient.DeleteChannel(context.Background(), cb.ChannelId)

		// try to list the channel bookmarks
		bookmarks, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), cb.ChannelId, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, bookmarks)
	})

	t.Run("bookmark listing should work in a moderated channel", func(t *testing.T) {
		channelBookmark := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark test",
			LinkUrl:     "https://mattermost.com",
			Type:        model.ChannelBookmarkLink,
			Emoji:       ":smile:",
		}

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb)

		// moderate the channel to restrict bookmarks for members
		manageBookmarks := model.ChannelModeratedPermissions[4]
		th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(t, th.BasicChannel.Id, manageBookmarks, true)

		// try to list existing channel bookmarks
		bookmarks, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)
	})
}

func TestBoardChannelBookmarkAPIReadonly(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicense())
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	boardTargetID := model.NewId()
	seed := &model.ChannelBookmark{
		ChannelId:   th.BasicChannel.Id,
		OwnerId:     th.BasicUser.Id,
		DisplayName: "Roadmap",
		LinkUrl:     "/test/boards/" + boardTargetID,
		Type:        model.ChannelBookmarkBoard,
		TargetId:    boardTargetID,
	}
	saved, sErr := th.App.Srv().Store().ChannelBookmark().Save(seed, true)
	require.NoError(t, sErr)

	t.Run("POST create with type board is rejected", func(t *testing.T) {
		b := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "bad",
			LinkUrl:     "/x/y",
			Type:        model.ChannelBookmarkBoard,
			TargetId:    model.NewId(),
		}
		_, resp, err := th.Client.CreateChannelBookmark(context.Background(), b)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.bookmark.board.readonly.app_error")
	})

	t.Run("PATCH board bookmark is rejected", func(t *testing.T) {
		name := "n"
		_, resp, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, saved.Id, &model.ChannelBookmarkPatch{DisplayName: &name})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.bookmark.board.readonly.app_error")
	})

	t.Run("sort_order on board bookmark succeeds", func(t *testing.T) {
		other := &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link next to board",
			LinkUrl:     "https://example.com",
			Type:        model.ChannelBookmarkLink,
		}
		_, resp, err := th.Client.CreateChannelBookmark(context.Background(), other)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, saved.Id, int64(1))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		var boardOrder int64 = -1
		for _, b := range bookmarks {
			if b.Id == saved.Id {
				boardOrder = b.SortOrder
				break
			}
		}
		require.Equal(t, int64(1), boardOrder)
	})

	t.Run("DELETE board bookmark is rejected", func(t *testing.T) {
		_, resp, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, saved.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.bookmark.board.readonly.app_error")
	})

	t.Run("GET list includes seeded board bookmark", func(t *testing.T) {
		list, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		var found *model.ChannelBookmarkWithFileInfo
		for _, x := range list {
			if x.Id == saved.Id {
				found = x
				break
			}
		}
		require.NotNil(t, found)
		require.Equal(t, model.ChannelBookmarkBoard, found.Type)
		require.Equal(t, boardTargetID, found.TargetId)
	})
}

func TestListChannelBookmarksForChannelFileInfoABAC(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicense())
	th.Context.Session().UserId = th.BasicUser.Id

	mockDownloadDecision := func(t *testing.T, allowed bool) {
		t.Helper()

		mockACS := &einterfacesmocks.AccessControlServiceInterface{}
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
		})).Return(model.AccessDecision{Decision: allowed}, (*model.AppError)(nil))

		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().Channels().AccessControl = original
		})
	}

	miniPreview := []byte{1, 2, 3, 4}
	file := &model.FileInfo{
		Id:              model.NewId(),
		ChannelId:       th.BasicChannel.Id,
		CreatorId:       model.BookmarkFileOwner,
		Path:            "somepath",
		ThumbnailPath:   "thumbpath",
		PreviewPath:     "prevPath",
		Name:            "bookmark-secret.png",
		Extension:       "png",
		MimeType:        "image/png",
		Size:            873182,
		Width:           3076,
		Height:          2200,
		HasPreviewImage: true,
		MiniPreview:     &miniPreview,
	}
	_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
	require.NoError(t, err)

	fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
		ChannelId:   th.BasicChannel.Id,
		DisplayName: "File bookmark",
		Type:        model.ChannelBookmarkFile,
		FileId:      file.Id,
	}, "")
	require.Nil(t, appErr)

	linkBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
		ChannelId:   th.BasicChannel.Id,
		DisplayName: "Link bookmark",
		Type:        model.ChannelBookmarkLink,
		LinkUrl:     "https://mattermost.com",
	}, "")
	require.Nil(t, appErr)

	byID := func(t *testing.T, bookmarks []*model.ChannelBookmarkWithFileInfo) map[string]*model.ChannelBookmarkWithFileInfo {
		t.Helper()
		out := map[string]*model.ChannelBookmarkWithFileInfo{}
		for _, bookmark := range bookmarks {
			out[bookmark.Id] = bookmark
		}
		return out
	}

	t.Run("file info is stripped when the policy denies the download action", func(t *testing.T) {
		mockDownloadDecision(t, false)

		bookmarks, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		indexed := byID(t, bookmarks)
		require.Contains(t, indexed, fileBookmark.Id)
		assert.Nil(t, indexed[fileBookmark.Id].FileInfo, "file info should be stripped")

		require.Contains(t, indexed, linkBookmark.Id)
		assert.Equal(t, "https://mattermost.com", indexed[linkBookmark.Id].LinkUrl, "link bookmarks are unaffected")
		assert.Nil(t, indexed[linkBookmark.Id].FileInfo)
	})

	t.Run("file info is returned when the policy allows the download action", func(t *testing.T) {
		mockDownloadDecision(t, true)

		bookmarks, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		indexed := byID(t, bookmarks)
		require.Contains(t, indexed, fileBookmark.Id)
		require.NotNil(t, indexed[fileBookmark.Id].FileInfo)
		assert.Equal(t, file.Id, indexed[fileBookmark.Id].FileInfo.Id)
		assert.NotNil(t, indexed[fileBookmark.Id].FileInfo.MiniPreview)

		require.Contains(t, indexed, linkBookmark.Id)
		assert.Nil(t, indexed[linkBookmark.Id].FileInfo)
	})

	t.Run("file info is unaffected when ABAC is disabled", func(t *testing.T) {
		mockDownloadDecision(t, false)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(false)
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
			})
		})

		bookmarks, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		indexed := byID(t, bookmarks)
		require.Contains(t, indexed, fileBookmark.Id)
		require.NotNil(t, indexed[fileBookmark.Id].FileInfo)
	})
}

func TestChannelBookmarkWriteEndpointsFileInfoABAC(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicense())
	th.Context.Session().UserId = th.BasicUser.Id

	mockDownloadDecision := func(t *testing.T, allowed bool) {
		t.Helper()

		mockACS := &einterfacesmocks.AccessControlServiceInterface{}
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
		})).Return(model.AccessDecision{Decision: allowed}, (*model.AppError)(nil))

		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().Channels().AccessControl = original
		})
	}

	newBookmarkFile := func(t *testing.T) *model.FileInfo {
		t.Helper()
		miniPreview := []byte{1, 2, 3, 4}
		file := &model.FileInfo{
			Id:              model.NewId(),
			ChannelId:       th.BasicChannel.Id,
			CreatorId:       model.BookmarkFileOwner,
			Path:            "somepath",
			ThumbnailPath:   "thumbpath",
			PreviewPath:     "prevPath",
			Name:            "bookmark-secret.png",
			Extension:       "png",
			MimeType:        "image/png",
			Size:            873182,
			Width:           3076,
			Height:          2200,
			HasPreviewImage: true,
			MiniPreview:     &miniPreview,
		}
		_, err := th.App.Srv().Store().FileInfo().Save(th.Context, file)
		require.NoError(t, err)
		return file
	}

	t.Run("createChannelBookmark strips file info when the policy denies the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, false)

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Nil(t, cb.FileInfo, "file info should be stripped")
	})

	t.Run("createChannelBookmark returns file info when the policy allows the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)

		cb, resp, err := th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, cb.FileInfo)
		assert.Equal(t, file.Id, cb.FileInfo.Id)
	})

	t.Run("updateChannelBookmark strips file info from the response when the policy denies the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)
		fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		}, "")
		require.Nil(t, appErr)

		mockDownloadDecision(t, false)
		newDisplayName := "renamed file bookmark"
		resp1, resp, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, fileBookmark.Id, &model.ChannelBookmarkPatch{
			DisplayName: &newDisplayName,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, resp1.Updated)
		assert.Equal(t, newDisplayName, resp1.Updated.DisplayName, "the patched field is still applied")
		assert.Nil(t, resp1.Updated.FileInfo, "file info should be stripped")
	})

	t.Run("updateChannelBookmark returns file info in the response when the policy allows the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)
		fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		}, "")
		require.Nil(t, appErr)

		newDisplayName := "renamed file bookmark 2"
		resp1, resp, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, fileBookmark.Id, &model.ChannelBookmarkPatch{
			DisplayName: &newDisplayName,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, resp1.Updated)
		require.NotNil(t, resp1.Updated.FileInfo)
		assert.Equal(t, file.Id, resp1.Updated.FileInfo.Id)
	})

	t.Run("updateChannelBookmarkSortOrder strips file info from the response when the policy denies the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)
		fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark for sort",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		}, "")
		require.Nil(t, appErr)
		_, appErr = th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "Link bookmark for sort",
			Type:        model.ChannelBookmarkLink,
			LinkUrl:     "https://mattermost.com",
		}, "")
		require.Nil(t, appErr)

		mockDownloadDecision(t, false)
		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, fileBookmark.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		found := false
		for _, b := range bookmarks {
			if b.Id == fileBookmark.Id {
				found = true
				assert.Nil(t, b.FileInfo, "file info should be stripped")
			}
		}
		assert.True(t, found, "the reordered file bookmark should be present in the response")
	})

	t.Run("updateChannelBookmarkSortOrder returns file info in the response when the policy allows the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)
		fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark for sort 2",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		}, "")
		require.Nil(t, appErr)

		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, fileBookmark.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		found := false
		for _, b := range bookmarks {
			if b.Id == fileBookmark.Id {
				found = true
				require.NotNil(t, b.FileInfo)
				assert.Equal(t, file.Id, b.FileInfo.Id)
			}
		}
		assert.True(t, found, "the reordered file bookmark should be present in the response")
	})

	t.Run("deleteChannelBookmark strips file info from the response when the policy denies the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)
		fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark to delete",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		}, "")
		require.Nil(t, appErr)

		mockDownloadDecision(t, false)
		deleted, resp, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, fileBookmark.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, deleted)
		assert.Nil(t, deleted.FileInfo, "file info should be stripped")
	})

	t.Run("deleteChannelBookmark returns file info in the response when the policy allows the download action", func(t *testing.T) {
		file := newBookmarkFile(t)
		mockDownloadDecision(t, true)
		fileBookmark, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
			ChannelId:   th.BasicChannel.Id,
			DisplayName: "File bookmark to delete 2",
			Type:        model.ChannelBookmarkFile,
			FileId:      file.Id,
		}, "")
		require.Nil(t, appErr)

		deleted, resp, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, fileBookmark.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, deleted)
		require.NotNil(t, deleted.FileInfo)
		assert.Equal(t, file.Id, deleted.FileInfo.Id)
	})
}

func TestListChannelBookmarksSinceKeepsBookmarkIdentity(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.Context.Session().UserId = th.BasicUser.Id

	bookmarkByID := func(bookmarks []*model.ChannelBookmarkWithFileInfo, id string) *model.ChannelBookmarkWithFileInfo {
		for _, bookmark := range bookmarks {
			if bookmark != nil && bookmark.Id == id {
				return bookmark
			}
		}
		return nil
	}

	listChannelBookmarks := func(t *testing.T, client *model.Client4, channelID string, since int64) ([]*model.ChannelBookmarkWithFileInfo, string) {
		t.Helper()
		endpoint := fmt.Sprintf("/channels/%s/bookmarks?bookmarks_since=%d", channelID, since)
		resp, err := client.DoAPIGet(context.Background(), endpoint, "")
		require.NoError(t, err)
		require.NotNil(t, resp)
		defer resp.Body.Close()

		body, readErr := io.ReadAll(resp.Body)
		require.NoError(t, readErr)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var bookmarks []*model.ChannelBookmarkWithFileInfo
		require.NoError(t, json.Unmarshal(body, &bookmarks))
		return bookmarks, string(body)
	}

	requireBodyOmits := func(t *testing.T, body string, values []string) {
		t.Helper()
		var present []string
		for _, value := range values {
			require.NotEmpty(t, value)
			if strings.Contains(body, value) {
				present = append(present, value)
			}
		}
		require.Empty(t, present, "response body contains %q", present)
	}

	createLinkBookmark := func(t *testing.T, channelID, displayName, linkURL, imageURL, emoji string) *model.ChannelBookmarkWithFileInfo {
		t.Helper()
		bookmark, resp, createErr := th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
			ChannelId:   channelID,
			DisplayName: displayName,
			LinkUrl:     linkURL,
			ImageUrl:    imageURL,
			Emoji:       emoji,
			Type:        model.ChannelBookmarkLink,
		})
		require.NoError(t, createErr)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, bookmark)
		require.Equal(t, linkURL, bookmark.LinkUrl)
		require.Equal(t, imageURL, bookmark.ImageUrl)
		require.Equal(t, emoji, bookmark.Emoji)
		require.Equal(t, displayName, bookmark.DisplayName)
		return bookmark
	}

	deleteBookmark := func(t *testing.T, channelID, bookmarkID string) *model.ChannelBookmarkWithFileInfo {
		t.Helper()
		deleted, resp, deleteErr := th.Client.DeleteChannelBookmark(context.Background(), channelID, bookmarkID)
		require.NoError(t, deleteErr)
		CheckOKStatus(t, resp)
		require.NotNil(t, deleted)
		require.Greater(t, deleted.DeleteAt, int64(0))
		return deleted
	}

	// The listed row keeps its id and delete_at. Stored link, image, emoji, and display name are absent.
	assertRemovedLinkFieldsAbsent := func(t *testing.T, client *model.Client4, channelID string, created *model.ChannelBookmarkWithFileInfo, since int64) {
		t.Helper()
		bookmarks, body := listChannelBookmarks(t, client, channelID, since)
		listed := bookmarkByID(bookmarks, created.Id)
		require.NotNil(t, listed)
		require.Greater(t, listed.DeleteAt, int64(0))
		require.Empty(t, listed.LinkUrl)
		require.Empty(t, listed.ImageUrl)
		require.Empty(t, listed.Emoji)
		require.Empty(t, listed.DisplayName)
		requireBodyOmits(t, body, []string{created.LinkUrl, created.ImageUrl, created.Emoji, created.DisplayName})
	}

	laterMemberClient := func(t *testing.T, channel *model.Channel) *model.Client4 {
		t.Helper()
		user := th.CreateUser(t)
		require.NotNil(t, user)
		client := th.CreateClient()
		_, _, loginErr := client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, loginErr)
		th.LinkUserToTeam(t, user, th.BasicTeam)
		th.AddUserToChannel(t, user, channel)
		return client
	}

	testCases := []struct {
		name string
		run  func(t *testing.T)
	}{
		{
			name: "removed link bookmark keeps id for a later channel member",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				linkURL := "https://bm-link-q7k2m9.example/target"
				imageURL := "https://bm-image-r8n3w5.example/target"
				emoji := "bmemoji-t6w2x9"
				displayName := "bmname-s4p8v1"
				created := createLinkBookmark(t, channel.Id, displayName, linkURL, imageURL, emoji)
				deleteBookmark(t, channel.Id, created.Id)

				client := laterMemberClient(t, channel)
				assertRemovedLinkFieldsAbsent(t, client, channel.Id, created, 1)
			},
		},
		{
			name: "removed file bookmark keeps id for a later channel member",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				miniPreview := []byte{0xfb, 0x10, 0x21, 0x32, 0x43, 0x54, 0x65, 0x76, 0x87, 0x98, 0xa9, 0xba, 0xcb, 0xdc, 0xed, 0xfe}
				file := &model.FileInfo{
					Id:              model.NewId(),
					ChannelId:       channel.Id,
					CreatorId:       model.BookmarkFileOwner,
					Path:            "somepath",
					ThumbnailPath:   "thumbpath",
					PreviewPath:     "prevPath",
					Name:            "r8n3w5t1y6u2-file.bin",
					Extension:       "ext-r8n3w5",
					MimeType:        "application/x-s4p8v1w3c7d5",
					Size:            873182,
					Width:           3076,
					Height:          2200,
					HasPreviewImage: true,
					MiniPreview:     &miniPreview,
				}
				_, saveErr := th.App.Srv().Store().FileInfo().Save(th.Context, file)
				require.NoError(t, saveErr)

				created, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
					ChannelId:   channel.Id,
					DisplayName: "File mark q7k2",
					Type:        model.ChannelBookmarkFile,
					FileId:      file.Id,
				}, "")
				require.Nil(t, appErr)
				deleteBookmark(t, channel.Id, created.Id)

				client := laterMemberClient(t, channel)
				bookmarks, body := listChannelBookmarks(t, client, channel.Id, 1)

				// The bookmark id is present and delete_at is set.
				listed := bookmarkByID(bookmarks, created.Id)
				require.NotNil(t, listed)
				require.Equal(t, created.Id, listed.Id)
				require.Greater(t, listed.DeleteAt, int64(0))
				require.Nil(t, listed.FileInfo)
				require.Empty(t, listed.FileId)
				require.Empty(t, listed.DisplayName)
				// File id, name, extension, mime type, size, width, height, mini preview, and display name are absent from the response body.
				requireBodyOmits(t, body, []string{
					file.Id,
					file.Name,
					file.Extension,
					file.MimeType,
					`"size":873182`,
					`"width":3076`,
					`"height":2200`,
					base64.StdEncoding.EncodeToString(miniPreview),
					created.DisplayName,
				})
			},
		},
		{
			name: "bookmark edited by another member keeps both ids for a later channel member",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				th.AddUserToChannel(t, th.BasicUser2, channel)

				urlA := "https://bm-urla-u1y5z3.example/old"
				urlB := "https://bm-urlb-v2a6b4.example/new"
				created := createLinkBookmark(t, channel.Id, "bmname-c3d4e5", urlA, "https://bm-image-c3d4e5.example/icon", "bmemoji-c3d4e5")

				editor := th.CreateClient()
				th.LoginBasic2WithClient(t, editor)
				edited, resp, updateErr := editor.UpdateChannelBookmark(context.Background(), channel.Id, created.Id, &model.ChannelBookmarkPatch{
					LinkUrl: &urlB,
				})
				require.NoError(t, updateErr)
				CheckOKStatus(t, resp)
				require.NotNil(t, edited)
				require.NotNil(t, edited.Updated)
				require.NotNil(t, edited.Deleted)
				require.Equal(t, created.Id, edited.Deleted.Id)
				require.NotEqual(t, created.Id, edited.Updated.Id)
				require.Equal(t, urlB, edited.Updated.LinkUrl)

				client := laterMemberClient(t, channel)
				bookmarks, body := listChannelBookmarks(t, client, channel.Id, 1)

				// The edited bookmark is present with its link_url.
				updated := bookmarkByID(bookmarks, edited.Updated.Id)
				require.NotNil(t, updated)
				require.Equal(t, urlB, updated.LinkUrl)
				require.Contains(t, body, urlB)
				// The replacement row keeps image_url, emoji, and display_name, so those strings stay in the body.
				require.Equal(t, created.ImageUrl, updated.ImageUrl)
				require.Equal(t, created.Emoji, updated.Emoji)
				require.Equal(t, created.DisplayName, updated.DisplayName)
				require.Contains(t, body, created.ImageUrl)
				require.Contains(t, body, created.Emoji)
				require.Contains(t, body, created.DisplayName)
				// The previous row id is present and delete_at is set.
				removed := bookmarkByID(bookmarks, edited.Deleted.Id)
				require.NotNil(t, removed)
				require.Greater(t, removed.DeleteAt, int64(0))
				require.Empty(t, removed.LinkUrl)
				require.Empty(t, removed.ImageUrl)
				require.Empty(t, removed.Emoji)
				require.Empty(t, removed.DisplayName)
				// The previous link_url is the value unique to the removed row, and it is absent from the response body.
				requireBodyOmits(t, body, []string{urlA})
			},
		},
		{
			name: "file bookmark whose file another member replaced omits the previous file id for a later channel member",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				th.AddUserToChannel(t, th.BasicUser2, channel)

				newBookmarkFile := func(name string) *model.FileInfo {
					file := &model.FileInfo{
						Id:        model.NewId(),
						ChannelId: channel.Id,
						CreatorId: model.BookmarkFileOwner,
						Path:      "somepath",
						Name:      name,
						MimeType:  "application/octet-stream",
						Size:      100,
					}
					_, saveErr := th.App.Srv().Store().FileInfo().Save(th.Context, file)
					require.NoError(t, saveErr)
					return file
				}
				fileA := newBookmarkFile("bm-file-a-k3m8.bin")
				fileB := newBookmarkFile("bm-file-b-p5q2.bin")

				created, appErr := th.App.CreateChannelBookmark(th.Context, &model.ChannelBookmark{
					ChannelId:   channel.Id,
					DisplayName: "File mark swap",
					Type:        model.ChannelBookmarkFile,
					FileId:      fileA.Id,
				}, "")
				require.Nil(t, appErr)

				editor := th.CreateClient()
				th.LoginBasic2WithClient(t, editor)
				edited, resp, updateErr := editor.UpdateChannelBookmark(context.Background(), channel.Id, created.Id, &model.ChannelBookmarkPatch{
					FileId: &fileB.Id,
				})
				require.NoError(t, updateErr)
				CheckOKStatus(t, resp)
				require.NotNil(t, edited.Updated)
				require.NotNil(t, edited.Deleted)
				require.Equal(t, created.Id, edited.Deleted.Id)
				require.Equal(t, fileB.Id, edited.Updated.FileId)

				client := laterMemberClient(t, channel)
				bookmarks, body := listChannelBookmarks(t, client, channel.Id, 1)

				updated := bookmarkByID(bookmarks, edited.Updated.Id)
				require.NotNil(t, updated)
				require.Equal(t, fileB.Id, updated.FileId)

				removed := bookmarkByID(bookmarks, edited.Deleted.Id)
				require.NotNil(t, removed)
				require.Greater(t, removed.DeleteAt, int64(0))
				require.Empty(t, removed.FileId)
				require.Nil(t, removed.FileInfo)
				requireBodyOmits(t, body, []string{fileA.Id, fileA.Name})
			},
		},
		{
			name: "later channel member full list returns the active link bookmark",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				removed := createLinkBookmark(t, channel.Id, "bmname-gone-h1j2k3", "https://bm-gone-link-h1j2k3.example/old", "https://bm-gone-image-h1j2k3.example/old", "bmemoji-gone-h1j2k3")
				deleteBookmark(t, channel.Id, removed.Id)
				active := createLinkBookmark(t, channel.Id, "bmname-w4x5y6", "https://bm-live-link-m4n5p6.example/now", "https://bm-live-image-q7r8s9.example/now", "bmemoji-t1u2v3")

				client := laterMemberClient(t, channel)
				bookmarks, _ := listChannelBookmarks(t, client, channel.Id, 0)

				// The removed bookmark id is absent from the list.
				require.Nil(t, bookmarkByID(bookmarks, removed.Id))
				// The active bookmark is present with the stored link_url, image_url, emoji, and display_name.
				listed := bookmarkByID(bookmarks, active.Id)
				require.NotNil(t, listed)
				require.Equal(t, active.LinkUrl, listed.LinkUrl)
				require.Equal(t, active.ImageUrl, listed.ImageUrl)
				require.Equal(t, active.Emoji, listed.Emoji)
				require.Equal(t, active.DisplayName, listed.DisplayName)
			},
		},
		{
			name: "member since list returns an owner edited link bookmark",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				th.AddUserToChannel(t, th.BasicUser2, channel)
				created := createLinkBookmark(t, channel.Id, "bmname-owner-edit", "https://bm-before-a1b2c3.example/then", "https://bm-owner-image-g7h8i9.example/icon", "bmemoji-j1k2l3")
				since := created.UpdateAt

				updatedURL := "https://bm-after-d4e5f6.example/now"
				edited, resp, updateErr := th.Client.UpdateChannelBookmark(context.Background(), channel.Id, created.Id, &model.ChannelBookmarkPatch{
					LinkUrl: &updatedURL,
				})
				require.NoError(t, updateErr)
				CheckOKStatus(t, resp)
				require.NotNil(t, edited)
				require.NotNil(t, edited.Updated)
				require.Equal(t, created.Id, edited.Updated.Id)
				require.Equal(t, updatedURL, edited.Updated.LinkUrl)

				memberClient := th.CreateClient()
				th.LoginBasic2WithClient(t, memberClient)
				bookmarks, body := listChannelBookmarks(t, memberClient, channel.Id, since)

				// The updated link_url is in the response body and on the decoded bookmark.
				listed := bookmarkByID(bookmarks, created.Id)
				require.NotNil(t, listed)
				require.Equal(t, updatedURL, listed.LinkUrl)
				require.Contains(t, body, updatedURL)
			},
		},
		{
			name: "owner since list keeps removed link bookmark id",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				created := createLinkBookmark(t, channel.Id, "bmname-owner-a9c2", "https://bm-owner-link-a9c2.example/target", "https://bm-owner-image-a9c2.example/target", "bmemoji-owner-a9c2")
				deleteBookmark(t, channel.Id, created.Id)
				assertRemovedLinkFieldsAbsent(t, th.Client, channel.Id, created, 1)
			},
		},
		{
			name: "guest added after removal sees removed link bookmark id",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				created := createLinkBookmark(t, channel.Id, "bmname-guest-b8d3", "https://bm-guest-link-b8d3.example/target", "https://bm-guest-image-b8d3.example/target", "bmemoji-guest-b8d3")
				deleteBookmark(t, channel.Id, created.Id)

				guest, guestClient := th.CreateGuestAndClient(t)
				th.AddUserToChannel(t, guest, channel)
				assertRemovedLinkFieldsAbsent(t, guestClient, channel.Id, created, 1)
			},
		},
		{
			name: "channel admin added after removal sees removed link bookmark id",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				created := createLinkBookmark(t, channel.Id, "bmname-admin-c7e4", "https://bm-admin-link-c7e4.example/target", "https://bm-admin-image-c7e4.example/target", "bmemoji-admin-c7e4")
				deleteBookmark(t, channel.Id, created.Id)

				user := th.CreateUser(t)
				client := th.CreateClient()
				_, _, loginErr := client.Login(context.Background(), user.Email, user.Password)
				require.NoError(t, loginErr)
				th.LinkUserToTeam(t, user, th.BasicTeam)
				th.AddUserToChannel(t, user, channel)
				resp, roleErr := th.Client.UpdateChannelRoles(context.Background(), channel.Id, user.Id, model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
				require.NoError(t, roleErr)
				CheckOKStatus(t, resp)
				assertRemovedLinkFieldsAbsent(t, client, channel.Id, created, 1)
			},
		},
		{
			name: "system admin added after removal sees removed link bookmark id",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				created := createLinkBookmark(t, channel.Id, "bmname-sys-d6f5", "https://bm-sys-link-d6f5.example/target", "https://bm-sys-image-d6f5.example/target", "bmemoji-sys-d6f5")
				deleteBookmark(t, channel.Id, created.Id)

				th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
				th.AddUserToChannel(t, th.SystemAdminUser, channel)
				assertRemovedLinkFieldsAbsent(t, th.SystemAdminClient, channel.Id, created, 1)
			},
		},
		{
			name: "since equal to delete_at keeps removed link bookmark id",
			run: func(t *testing.T) {
				channel := th.CreatePrivateChannel(t)
				created := createLinkBookmark(t, channel.Id, "bmname-bound-e5g6", "https://bm-bound-link-e5g6.example/target", "https://bm-bound-image-e5g6.example/target", "bmemoji-bound-e5g6")
				deleted := deleteBookmark(t, channel.Id, created.Id)

				client := laterMemberClient(t, channel)
				// bookmarks_since equal to delete_at still returns the row with stored fields absent.
				assertRemovedLinkFieldsAbsent(t, client, channel.Id, created, deleted.DeleteAt)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, tc.run)
	}
}
