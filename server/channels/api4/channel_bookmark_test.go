// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestCreateChannelBookmark(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ChannelBookmarks", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ChannelBookmarks")

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.SetPhase2PermissionsMigrationStatus(true)

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

	guest, guestClient := th.CreateGuestAndClient()

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
		th.RemovePermissionFromRole(model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)

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
		th.RemovePermissionFromRole(model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)

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
		th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, true)

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
		th.RemovePermissionFromRole(model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(model.PermissionAddBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionAddBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
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
		t.Skip("https://mattermost.atlassian.net/browse/MM-57393")
		webSocketClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		webSocketClient.Listen()
		defer webSocketClient.Close()

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

		_, appErr := th.App.CreateChannelBookmark(th.Context, bookmark1, "")
		require.Nil(t, appErr)

		var b model.ChannelBookmarkWithFileInfo
		require.Eventuallyf(t, func() bool {
			event := <-webSocketClient.EventChannel
			if event.EventType() == model.WebsocketEventChannelBookmarkCreated {
				err := json.Unmarshal([]byte(event.GetData()["bookmark"].(string)), &b)
				require.NoError(t, err)
				return true
			}
			return false
		}, 2*time.Second, 250*time.Millisecond, "Websocket event for bookmark created not received", nil)
		require.NotNil(t, b)
		require.NotEmpty(t, b.Id)
	})
}

func TestEditChannelBookmark(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ChannelBookmarks", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ChannelBookmarks")

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.SetPhase2PermissionsMigrationStatus(true)

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId(), &model.ChannelBookmarkPatch{})
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient()

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
					th.RemovePermissionFromRole(tc.removePermission, model.ChannelUserRoleId)
					defer th.AddPermissionToRole(tc.removePermission, model.ChannelUserRoleId)
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
					DisplayName: model.NewString("Edited bookmark test"),
					LinkUrl:     model.NewString("http://edited.url"),
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
		th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, true)

		// try to patch the channel bookmark
		patch := &model.ChannelBookmarkPatch{
			DisplayName: model.NewString("Edited bookmark test"),
			LinkUrl:     model.NewString("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("trying to edit a nonexistent bookmark should fail", func(t *testing.T) {
		patch := &model.ChannelBookmarkPatch{
			DisplayName: model.NewString("Edited bookmark test"),
			LinkUrl:     model.NewString("http://edited.url"),
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
			DisplayName: model.NewString("Edited bookmark test"),
			LinkUrl:     model.NewString("http://edited.url"),
		}

		ucb, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Nil(t, ucb)
	})

	t.Run("a user should always be able to edit channel bookmarks on DMs and GMs", func(t *testing.T) {
		// this should work independently of the permissions applied
		th.RemovePermissionFromRole(model.PermissionEditBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(model.PermissionEditBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(model.PermissionEditBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionEditBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
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
			DisplayName: model.NewString("Edited bookmark test"),
			LinkUrl:     model.NewString("http://edited.url"),
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
			DisplayName: model.NewString("Edited bookmark test"),
			LinkUrl:     model.NewString("http://edited.url"),
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
			DisplayName: model.NewString("Edited bookmark test"),
			LinkUrl:     model.NewString("http://edited.url"),
		}

		// create a client for basic user 2
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
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
		t.Skip("https://mattermost.atlassian.net/browse/MM-57392")
		webSocketClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		webSocketClient.Listen()
		defer webSocketClient.Close()

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

		patch := &model.ChannelBookmarkPatch{DisplayName: model.NewString("Edited bookmark test")}
		_, resp, err := th.Client.UpdateChannelBookmark(context.Background(), cb.ChannelId, cb.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		var ucb model.UpdateChannelBookmarkResponse
		require.Eventuallyf(t, func() bool {
			event := <-webSocketClient.EventChannel
			if event.EventType() == model.WebsocketEventChannelBookmarkUpdated {
				err := json.Unmarshal([]byte(event.GetData()["bookmarks"].(string)), &ucb)
				require.NoError(t, err)
				return true
			}
			return false
		}, 2*time.Second, 250*time.Millisecond, "Websocket event for bookmark edited not received", nil)

		require.NotNil(t, ucb)
		require.NotEmpty(t, ucb.Updated)
		require.Equal(t, "Edited bookmark test", ucb.Updated.DisplayName)
	})
}

func TestUpdateChannelBookmarkSortOrder(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ChannelBookmarks", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ChannelBookmarks")

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.SetPhase2PermissionsMigrationStatus(true)

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

	guest, guestClient := th.CreateGuestAndClient()

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
					th.RemovePermissionFromRole(tc.removePermission, model.ChannelUserRoleId)
					defer th.AddPermissionToRole(tc.removePermission, model.ChannelUserRoleId)
				}

				// first we capture and later restore original bookmark's sort order
				originalBookmark, appErr := th.App.GetBookmark(tc.bookmarkId, false)
				require.Nil(t, appErr)
				defer func() {
					th.App.UpdateChannelBookmarkSortOrder(originalBookmark.Id, originalBookmark.ChannelId, originalBookmark.SortOrder, "")
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
		th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, true)

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
		th.RemovePermissionFromRole(model.PermissionOrderBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(model.PermissionOrderBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(model.PermissionOrderBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionOrderBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
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
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		bookmarks, resp, err := client2.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)
		require.Equal(t, cb.Id, bookmarks[0].Id)
		require.Equal(t, int64(0), bookmarks[0].SortOrder)
	})

	t.Run("a websockets event should be fired as part of editing a bookmark's sort order", func(t *testing.T) {
		webSocketClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		webSocketClient.Listen()
		defer webSocketClient.Close()

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

		bookmarks, resp, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, cb.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)

		var bl []*model.ChannelBookmarkWithFileInfo
		require.Eventuallyf(t, func() bool {
			event := <-webSocketClient.EventChannel
			if event.EventType() == model.WebsocketEventChannelBookmarkSorted {
				err := json.Unmarshal([]byte(event.GetData()["bookmarks"].(string)), &bl)
				require.NoError(t, err)
				return true
			}
			return false
		}, 2*time.Second, 250*time.Millisecond, "Websocket event for bookmark sorted not received", nil)

		require.NotEmpty(t, bl)
		require.Equal(t, cb.Id, bl[0].Id)
		require.Equal(t, int64(0), bl[0].SortOrder)
	})
}

func TestDeleteChannelBookmark(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ChannelBookmarks", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ChannelBookmarks")

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.SetPhase2PermissionsMigrationStatus(true)

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId())
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient()

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
					th.RemovePermissionFromRole(tc.removePermission, model.ChannelUserRoleId)
					defer th.AddPermissionToRole(tc.removePermission, model.ChannelUserRoleId)
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
		th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, true)

		// try to delete the channel bookmark's order
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
		th.RemovePermissionFromRole(model.PermissionDeleteBookmarkPublicChannel.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(model.PermissionDeleteBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
		defer func() {
			th.AddPermissionToRole(model.PermissionDeleteBookmarkPublicChannel.Id, model.ChannelUserRoleId)
			th.AddPermissionToRole(model.PermissionDeleteBookmarkPrivateChannel.Id, model.ChannelUserRoleId)
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
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		dbm, resp, err := client2.DeleteChannelBookmark(context.Background(), th.BasicChannel.Id, cb.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, dbm)
		require.Equal(t, cb.Id, dbm.Id)
		require.NotZero(t, dbm.DeleteAt)
	})

	t.Run("a websockets event should be fired as part of deleting a bookmark", func(t *testing.T) {
		webSocketClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		webSocketClient.Listen()
		defer webSocketClient.Close()

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
		require.Eventuallyf(t, func() bool {
			event := <-webSocketClient.EventChannel
			if event.EventType() == model.WebsocketEventChannelBookmarkDeleted {
				err := json.Unmarshal([]byte(event.GetData()["bookmark"].(string)), &b)
				require.NoError(t, err)
				return true
			}
			return false
		}, 2*time.Second, 250*time.Millisecond, "Websocket event for bookmark deleted not received", nil)

		require.NotEmpty(t, b)
		require.Equal(t, cb.Id, b.Id)
		require.NotEmpty(t, b.DeleteAt)
	})
}

func TestListChannelBookmarksForChannel(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ChannelBookmarks", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ChannelBookmarks")

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.App.SetPhase2PermissionsMigrationStatus(true)

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

	guest, guestClient := th.CreateGuestAndClient()

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
	onlyGuestChannel := th.CreateChannelWithClient(th.SystemAdminClient, model.ChannelTypeOpen)
	th.AddUserToChannel(guest, onlyGuestChannel)
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
		th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, false)
		defer th.PatchChannelModerationsForMembers(th.BasicChannel.Id, manageBookmarks, true)

		// try to list existing channel bookmarks
		bookmarks, resp, err := th.Client.ListChannelBookmarksForChannel(context.Background(), th.BasicChannel.Id, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, bookmarks)
	})
}
