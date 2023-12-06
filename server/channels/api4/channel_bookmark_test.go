// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
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
		CheckErrorID(t, err, "api.channel.bookmark.create_channel_bookmark.license.error")
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
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
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
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
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
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
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
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
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
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		require.Nil(t, cb)

		// test in private channel
		channelBookmark.ChannelId = th.BasicPrivateChannel.Id
		cb, resp, err = guestClient.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
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
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, cb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelBookmark.ChannelId = gm.Id
		cb, resp, err = th.Client.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
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
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		require.Nil(t, cb)

		// GM
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channelBookmark.ChannelId = gm.Id
		cb, resp, err = guestClient.CreateChannelBookmark(context.Background(), channelBookmark)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
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
		for {
			var exit bool
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventChannelBookmarkCreated {
					err := json.Unmarshal([]byte(event.GetData()["bookmark"].(string)), &b)
					require.NoError(t, err)
					received = true
				}
			case <-time.After(2 * time.Second):
				exit = true
			}
			if exit {
				break
			}
		}

		require.True(t, received)
		require.NotNil(t, b)
		require.NotEmpty(t, b.Id)
	})
}
