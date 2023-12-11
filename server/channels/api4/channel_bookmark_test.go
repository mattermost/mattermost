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

func TestCreateChannelBookmark(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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

	// create a guest user and add it to the basic team and public/private channels
	guest, cgErr := th.App.CreateGuest(th.Context, &model.User{
		Email:         "test_guest@sample.com",
		Username:      "test_guest",
		Nickname:      "test_guest",
		Password:      "Password1",
		EmailVerified: true,
	})
	require.Nil(t, cgErr)

	_, _, tErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, th.SystemAdminUser.Id)
	require.Nil(t, tErr)
	th.AddUserToChannel(guest, th.BasicChannel)
	th.AddUserToChannel(guest, th.BasicPrivateChannel)

	// create a client to use in tests
	guestClient := th.CreateClient()
	_, _, lErr := guestClient.Login(context.Background(), guest.Username, "Password1")
	require.NoError(t, lErr)

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

		var received bool
		var b model.ChannelBookmarkWithFileInfo
	loop:
		for {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkCreated {
					err := json.Unmarshal([]byte(event.GetData()["bookmark"].(string)), &b)
					require.NoError(t, err)
					received = true
					break loop
				}
			case <-time.After(2 * time.Second):
				break loop
			}
		}

		require.True(t, received)
		require.NotNil(t, b)
		require.NotEmpty(t, b.Id)
	})
}

func TestEditChannelBookmark(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelBookmark(context.Background(), th.BasicChannel.Id, model.NewId(), &model.ChannelBookmarkPatch{})
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	// create a guest user and add it to the basic team and public/private channels
	guest, cgErr := th.App.CreateGuest(th.Context, &model.User{
		Email:         "test_guest@sample.com",
		Username:      "test_guest",
		Nickname:      "test_guest",
		Password:      "Password1",
		EmailVerified: true,
	})
	require.Nil(t, cgErr)

	_, _, tErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, th.SystemAdminUser.Id)
	require.Nil(t, tErr)
	th.AddUserToChannel(guest, th.BasicChannel)
	th.AddUserToChannel(guest, th.BasicPrivateChannel)

	// create a client to use in tests
	guestClient := th.CreateClient()
	_, _, lErr := guestClient.Login(context.Background(), guest.Username, "Password1")
	require.NoError(t, lErr)

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

		var received bool
		var ucb model.UpdateChannelBookmarkResponse
	loop:
		for {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkUpdated {
					err := json.Unmarshal([]byte(event.GetData()["bookmarks"].(string)), &ucb)
					require.NoError(t, err)
					received = true
					break loop
				}
			case <-time.After(2 * time.Second):
				break loop
			}
		}

		require.True(t, received)
		require.NotNil(t, ucb)
		require.NotEmpty(t, ucb.Updated)
		require.Equal(t, "Edited bookmark test", ucb.Updated.DisplayName)
	})
}

func TestUpdateChannelBookmarkSortOrder(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	createBookmark := func(name, channelId string) *model.ChannelBookmark {
		return &model.ChannelBookmark{
			ChannelId:   channelId,
			DisplayName: name,
			Type:        model.ChannelBookmarkLink,
			LinkUrl:     "https://sample.com",
		}
	}

	th.Context.Session().UserId = th.BasicUser.Id // set the user for the session

	publicBookmark1, err := th.App.CreateChannelBookmark(th.Context, createBookmark("one", th.BasicChannel.Id), "")
	require.Nil(t, err)
	publicBookmark2, err := th.App.CreateChannelBookmark(th.Context, createBookmark("two", th.BasicChannel.Id), "")
	require.Nil(t, err)
	publicBookmark3, err := th.App.CreateChannelBookmark(th.Context, createBookmark("three", th.BasicChannel.Id), "")
	require.Nil(t, err)
	_, err = th.App.CreateChannelBookmark(th.Context, createBookmark("four", th.BasicChannel.Id), "")
	require.Nil(t, err)

	privateBookmark1, err := th.App.CreateChannelBookmark(th.Context, createBookmark("one", th.BasicPrivateChannel.Id), "")
	require.Nil(t, err)
	privateBookmark2, err := th.App.CreateChannelBookmark(th.Context, createBookmark("two", th.BasicPrivateChannel.Id), "")
	require.Nil(t, err)
	_, err = th.App.CreateChannelBookmark(th.Context, createBookmark("three", th.BasicPrivateChannel.Id), "")
	require.Nil(t, err)
	privateBookmark4, err := th.App.CreateChannelBookmark(th.Context, createBookmark("four", th.BasicPrivateChannel.Id), "")
	require.Nil(t, err)

	t.Run("should not work without a license", func(t *testing.T) {
		_, _, err := th.Client.UpdateChannelBookmarkSortOrder(context.Background(), th.BasicChannel.Id, model.NewId(), 1)
		CheckErrorID(t, err, "api.channel.bookmark.channel_bookmark.license.error")
	})

	// enable guest accounts and add the license
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	// create a guest user and add it to the basic team and public/private channels
	guest, cgErr := th.App.CreateGuest(th.Context, &model.User{
		Email:         "test_guest@sample.com",
		Username:      "test_guest",
		Nickname:      "test_guest",
		Password:      "Password1",
		EmailVerified: true,
	})
	require.Nil(t, cgErr)

	_, _, tErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, th.SystemAdminUser.Id)
	require.Nil(t, tErr)
	th.AddUserToChannel(guest, th.BasicChannel)
	th.AddUserToChannel(guest, th.BasicPrivateChannel)

	// create a client to use in tests
	guestClient := th.CreateClient()
	_, _, lErr := guestClient.Login(context.Background(), guest.Username, "Password1")
	require.NoError(t, lErr)

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

		dmBookmark1, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("one", dm.Id), "")
		require.Nil(t, appErr)
		dmBookmark2, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("two", dm.Id), "")
		require.Nil(t, appErr)

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

		gmBookmark1, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("one", gm.Id), "")
		require.Nil(t, appErr)
		gmBookmark2, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("two", gm.Id), "")
		require.Nil(t, appErr)

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

		dmBookmark1, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("one", dm.Id), "")
		require.Nil(t, appErr)
		_, appErr = th.App.CreateChannelBookmark(th.Context, createBookmark("two", dm.Id), "")
		require.Nil(t, appErr)

		bookmarks, resp, err := guestClient.UpdateChannelBookmarkSortOrder(context.Background(), dm.Id, dmBookmark1.Id, 1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, bookmarks)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.CreateChannelBookmark(th.Context, createBookmark("one", gm.Id), "")
		require.Nil(t, appErr)
		gmBookmark2, appErr := th.App.CreateChannelBookmark(th.Context, createBookmark("two", gm.Id), "")
		require.Nil(t, appErr)

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

		var received bool
		var bl []*model.ChannelBookmarkWithFileInfo
	loop:
		for {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkSorted {
					err := json.Unmarshal([]byte(event.GetData()["bookmarks"].(string)), &bl)
					require.NoError(t, err)
					received = true
					break loop
				}
			case <-time.After(2 * time.Second):
				break loop
			}
		}

		require.True(t, received)
		require.NotEmpty(t, bl)
		require.Equal(t, cb.Id, bl[0].Id)
		require.Equal(t, int64(0), bl[0].SortOrder)
	})
}
