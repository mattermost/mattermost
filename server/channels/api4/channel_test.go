// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/channels/web"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestCreateChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	team := th.BasicTeam

	channel := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id}
	private := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypePrivate, TeamId: team.Id}

	rchannel, resp, err := client.CreateChannel(context.Background(), channel)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	require.Equal(t, channel.Name, rchannel.Name, "names did not match")
	require.Equal(t, channel.DisplayName, rchannel.DisplayName, "display names did not match")
	require.Equal(t, channel.TeamId, rchannel.TeamId, "team ids did not match")

	rprivate, _, err := client.CreateChannel(context.Background(), private)
	require.NoError(t, err)

	require.Equal(t, private.Name, rprivate.Name, "names did not match")
	require.Equal(t, model.ChannelTypePrivate, rprivate.Type, "wrong channel type")
	require.Equal(t, th.BasicUser.Id, rprivate.CreatorId, "wrong creator id")

	_, resp, err = client.CreateChannel(context.Background(), channel)
	CheckErrorID(t, err, "store.sql_channel.save_channel.exists.app_error")
	CheckBadRequestStatus(t, resp)

	direct := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeDirect, TeamId: team.Id}
	_, resp, err = client.CreateChannel(context.Background(), direct)
	CheckErrorID(t, err, "api.channel.create_channel.direct_channel.app_error")
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.CreateChannel(context.Background(), channel)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	userNotOnTeam := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), userNotOnTeam.Email, userNotOnTeam.Password)
	require.NoError(t, err)

	_, resp, err = client.CreateChannel(context.Background(), channel)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.CreateChannel(context.Background(), private)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()

	th.AddPermissionToRole(t, model.PermissionCreatePublicChannel.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)

	th.LoginBasic(t)

	channel.Name = GenerateTestChannelName()
	_, _, err = client.CreateChannel(context.Background(), channel)
	require.NoError(t, err)

	private.Name = GenerateTestChannelName()
	_, _, err = client.CreateChannel(context.Background(), private)
	require.NoError(t, err)

	th.AddPermissionToRole(t, model.PermissionCreatePublicChannel.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionCreatePublicChannel.Id, model.TeamUserRoleId)
	th.RemovePermissionFromRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)

	_, resp, err = client.CreateChannel(context.Background(), channel)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.CreateChannel(context.Background(), private)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginTeamAdmin(t)

	channel.Name = GenerateTestChannelName()
	_, _, err = client.CreateChannel(context.Background(), channel)
	require.NoError(t, err)

	private.Name = GenerateTestChannelName()
	_, _, err = client.CreateChannel(context.Background(), private)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		channel.Name = GenerateTestChannelName()
		_, _, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		private.Name = GenerateTestChannelName()
		_, _, err = client.CreateChannel(context.Background(), private)
		require.NoError(t, err)
	})

	t.Run("null value", func(t *testing.T) {
		var channel *model.Channel
		_, resp, err = client.CreateChannel(context.Background(), channel)

		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	// Test posting Garbage
	r, err := client.DoAPIPost(context.Background(), "/channels", "garbage")
	require.Error(t, err, "expected error")
	require.Equal(t, http.StatusBadRequest, r.StatusCode, "Expected 400 Bad Request")

	// Test GroupConstrained flag
	groupConstrainedChannel := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id, GroupConstrained: model.NewPointer(true)}
	rchannel, _, err = client.CreateChannel(context.Background(), groupConstrainedChannel)
	require.NoError(t, err)

	require.Equal(t, *groupConstrainedChannel.GroupConstrained, *rchannel.GroupConstrained, "GroupConstrained flags do not match")

	t.Run("Test create channel with missing team id", func(t *testing.T) {
		channel := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: ""}

		_, resp, err = client.CreateChannel(context.Background(), channel)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Test create channel with missing display name", func(t *testing.T) {
		channel := &model.Channel{DisplayName: "", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id}

		_, resp, err = client.CreateChannel(context.Background(), channel)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Can create channel with banner info", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: GenerateTestChannelName(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		var createdChannel *model.Channel
		createdChannel, resp, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.True(t, *createdChannel.BannerInfo.Enabled)
		require.Equal(t, "banner text", *createdChannel.BannerInfo.Text)
		require.Equal(t, "#dddddd", *createdChannel.BannerInfo.BackgroundColor)
	})

	t.Run("Cannot create channel with banner enabled but not configured", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			BannerInfo: &model.ChannelBannerInfo{
				Enabled: model.NewPointer(true),
			},
		}

		_, resp, err = client.CreateChannel(context.Background(), channel)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Guest users", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.AllowEmailAccounts = true })

		guestUser := th.CreateUser(t)
		appErr := th.App.VerifyUserEmail(guestUser.Id, guestUser.Email)
		require.Nil(t, appErr)

		appErr = th.App.DemoteUserToGuest(th.Context, guestUser)
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guestUser.Id, "")
		require.Nil(t, appErr)

		guestClient := th.CreateClient()
		_, _, err := guestClient.Login(context.Background(), guestUser.Username, guestUser.Password)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, lErr := guestClient.Logout(context.Background())
			require.NoError(t, lErr)
		})

		userOutsideOfChannels := th.CreateUser(t)
		_, _, err = th.Client.AddTeamMember(context.Background(), team.Id, userOutsideOfChannels.Id)
		require.NoError(t, err)

		public := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id}
		private := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypePrivate, TeamId: team.Id}

		t.Run("Guest user should not be able to create channels", func(t *testing.T) {
			_, resp, err = guestClient.CreateChannel(context.Background(), public)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)

			private.Name = GenerateTestChannelName()
			_, resp, err = guestClient.CreateChannel(context.Background(), private)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("Guest user should not be able to add channel members if they have no common channels", func(t *testing.T) {
			// Now actually create the channels with the main client
			public, _, err = th.Client.CreateChannel(context.Background(), public)
			require.NoError(t, err)
			private, _, err = th.Client.CreateChannel(context.Background(), private)
			require.NoError(t, err)

			// Add the guest user to the private channel
			_, _, err = th.Client.AddChannelMember(context.Background(), private.Id, guestUser.Id)
			require.NoError(t, err)

			// Verify that the guest user can access the private channel they were added to
			_, _, err = guestClient.GetChannel(context.Background(), private.Id, "")
			require.NoError(t, err)

			// Verify that the guest user cannot add members to the private channel
			_, resp, err = guestClient.AddChannelMember(context.Background(), private.Id, userOutsideOfChannels.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)

			// Add the guest user to the public channel
			_, _, err = th.Client.AddChannelMember(context.Background(), public.Id, guestUser.Id)
			require.NoError(t, err)

			// Verify that the guest user can access the public channel they were added to
			_, _, err = guestClient.GetChannel(context.Background(), public.Id, "")
			require.NoError(t, err)

			// Verify that the guest user cannot add members to the public channel
			_, resp, err = guestClient.AddChannelMember(context.Background(), public.Id, userOutsideOfChannels.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)

			// Update team guest permissions to allow creating private channels
			th.AddPermissionToRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamGuestRoleId)
			privateGuest := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypePrivate, TeamId: team.Id}
			privateGuest, resp, err = guestClient.CreateChannel(context.Background(), privateGuest)
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)

			// Verify that the guest user can't add users they have no visibility to
			_, resp, err = guestClient.AddChannelMember(context.Background(), privateGuest.Id, userOutsideOfChannels.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})
}

func TestUpdateChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	team := th.BasicTeam

	channel := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id}
	private := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypePrivate, TeamId: team.Id}

	channel, _, err := client.CreateChannel(context.Background(), channel)
	require.NoError(t, err)
	private, _, err = client.CreateChannel(context.Background(), private)
	require.NoError(t, err)

	// Update a open channel
	channel.DisplayName = "My new display name"
	channel.Header = "My fancy header"
	channel.Purpose = "Mattermost ftw!"

	newChannel, _, err := client.UpdateChannel(context.Background(), channel)
	require.NoError(t, err)

	require.Equal(t, channel.DisplayName, newChannel.DisplayName, "Update failed for DisplayName")
	require.Equal(t, channel.Header, newChannel.Header, "Update failed for Header")
	require.Equal(t, channel.Purpose, newChannel.Purpose, "Update failed for Purpose")

	// Test GroupConstrained flag
	channel.GroupConstrained = model.NewPointer(true)
	rchannel, resp, err := client.UpdateChannel(context.Background(), channel)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	require.Equal(t, *channel.GroupConstrained, *rchannel.GroupConstrained, "GroupConstrained flags do not match")

	// Update a private channel
	private.DisplayName = "My new display name for private channel"
	private.Header = "My fancy private header"
	private.Purpose = "Mattermost ftw! in private mode"

	newPrivateChannel, _, err := client.UpdateChannel(context.Background(), private)
	require.NoError(t, err)

	require.Equal(t, private.DisplayName, newPrivateChannel.DisplayName, "Update failed for DisplayName in private channel")
	require.Equal(t, private.Header, newPrivateChannel.Header, "Update failed for Header in private channel")
	require.Equal(t, private.Purpose, newPrivateChannel.Purpose, "Update failed for Purpose in private channel")

	// Test updating default channel's name and returns error
	defaultChannel, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, team.Id, false)
	require.Nil(t, appErr)
	defaultChannel.Name = "testing"
	_, resp, err = client.UpdateChannel(context.Background(), defaultChannel)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test that changing the type fails and returns error
	private.Type = model.ChannelTypeOpen
	_, resp, err = client.UpdateChannel(context.Background(), private)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test that keeping the same type succeeds

	private.Type = model.ChannelTypePrivate
	_, _, err = client.UpdateChannel(context.Background(), private)
	require.NoError(t, err)

	// Non existing channel
	channel1 := &model.Channel{DisplayName: "Test API Name for apiv4", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id}
	_, resp, err = client.UpdateChannel(context.Background(), channel1)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Try to update with not logged user
	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.UpdateChannel(context.Background(), channel)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// Try to update using another user
	user := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	channel.DisplayName = "Should not update"
	_, resp, err = client.UpdateChannel(context.Background(), channel)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Test updating the header of someone else's GM channel.
	user1 := th.CreateUser(t)
	user2 := th.CreateUser(t)
	user3 := th.CreateUser(t)

	groupChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id})
	require.NoError(t, err)

	groupChannel.Header = "lolololol"
	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = client.Login(context.Background(), user3.Email, user3.Password)
	require.NoError(t, err)
	_, resp, err = client.UpdateChannel(context.Background(), groupChannel)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Test updating the header of someone else's GM channel.
	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	directChannel, _, err := client.CreateDirectChannel(context.Background(), user.Id, user1.Id)
	require.NoError(t, err)

	directChannel.Header = "lolololol"
	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = client.Login(context.Background(), user3.Email, user3.Password)
	require.NoError(t, err)
	_, resp, err = client.UpdateChannel(context.Background(), directChannel)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	t.Run("null value", func(t *testing.T) {
		r, err := client.DoAPIPut(context.Background(), fmt.Sprintf("/channels"+"/%v", channel.Id), "null")
		resp := model.BuildResponse(r)
		defer closeBody(r)

		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
	t.Run("Should block changes to name, display name or purpose for group messages", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		groupChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		updatedChannel := &model.Channel{Id: groupChannel.Id, Name: "test name"}
		_, resp, err := client.UpdateChannel(context.Background(), updatedChannel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		updatedChannel2 := &model.Channel{Id: groupChannel.Id, DisplayName: "test display name"}
		_, resp, err = client.UpdateChannel(context.Background(), updatedChannel2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		updatedChannel3 := &model.Channel{Id: groupChannel.Id, Purpose: "test purpose"}
		_, resp, err = client.UpdateChannel(context.Background(), updatedChannel3)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Should block changes to name, display name or purpose for direct messages", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)

		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		directChannel, _, err := client.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
		require.NoError(t, err)

		updatedChannel := &model.Channel{Id: directChannel.Id, Name: "test name"}
		_, resp, err := client.UpdateChannel(context.Background(), updatedChannel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		updatedChannel2 := &model.Channel{Id: directChannel.Id, DisplayName: "test display name"}
		_, resp, err = client.UpdateChannel(context.Background(), updatedChannel2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		updatedChannel3 := &model.Channel{Id: directChannel.Id, Purpose: "test purpose"}
		_, resp, err = client.UpdateChannel(context.Background(), updatedChannel3)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestPatchChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	team := th.BasicTeam

	t.Run("should be unable to apply a null patch", func(t *testing.T) {
		var nullPatch *model.ChannelPatch

		_, nullResp, err := client.PatchChannel(context.Background(), th.BasicChannel.Id, nullPatch)
		require.Error(t, err)
		CheckBadRequestStatus(t, nullResp)
	})

	t.Run("should be able to patch values", func(t *testing.T) {
		patch := &model.ChannelPatch{
			Name:        new(string),
			DisplayName: new(string),
			Header:      new(string),
			Purpose:     new(string),
		}
		*patch.Name = model.NewId()
		*patch.DisplayName = model.NewId()
		*patch.Header = model.NewId()
		*patch.Purpose = model.NewId()

		channel, _, err := client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.NoError(t, err)

		require.Equal(t, *patch.Name, channel.Name, "do not match")
		require.Equal(t, *patch.DisplayName, channel.DisplayName, "do not match")
		require.Equal(t, *patch.Header, channel.Header, "do not match")
		require.Equal(t, *patch.Purpose, channel.Purpose, "do not match")
	})

	t.Run("should be able to patch with no name", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: GenerateTestChannelName(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		var err error
		channel, _, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		patch := &model.ChannelPatch{
			Header:  new(string),
			Purpose: new(string),
		}

		oldName := channel.Name
		patchedChannel, _, err := client.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)

		require.Equal(t, oldName, patchedChannel.Name, "should not have updated")
	})

	t.Run("Test updating default channel's name and returns error", func(t *testing.T) {
		// Test updating default channel's name and returns error
		defaultChannel, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, team.Id, false)
		require.Nil(t, appErr)
		defaultChannelPatch := &model.ChannelPatch{
			Name: new(string),
		}
		*defaultChannelPatch.Name = "testing"
		_, resp, err := client.PatchChannel(context.Background(), defaultChannel.Id, defaultChannelPatch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Test GroupConstrained flag", func(t *testing.T) {
		// Test GroupConstrained flag
		patch := &model.ChannelPatch{}
		patch.GroupConstrained = model.NewPointer(true)
		rchannel, resp, err := client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Equal(t, *rchannel.GroupConstrained, *patch.GroupConstrained, "GroupConstrained flags do not match")
		patch.GroupConstrained = nil

		_, resp, err = client.PatchChannel(context.Background(), "junk", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.PatchChannel(context.Background(), model.NewId(), patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		user := th.CreateUser(t)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)
		_, resp, err = client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			_, _, err = client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
			require.NoError(t, err)

			_, _, err = client.PatchChannel(context.Background(), th.BasicPrivateChannel.Id, patch)
			require.NoError(t, err)
		})
	})

	t.Run("Test GroupConstrained flag set to true and non group members are removed", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		// Create a test group
		group := th.CreateGroup(t)

		// Create a channel and set it as group-constrained
		channel := th.CreatePrivateChannel(t)
		// Add user to the channel
		th.AddUserToChannel(t, th.BasicUser2, channel)

		// Create a group user
		groupUser := th.CreateUser(t)
		th.LinkUserToTeam(t, groupUser, th.BasicTeam)

		// Create a group member
		_, appErr := th.App.UpsertGroupMember(group.Id, groupUser.Id)
		require.Nil(t, appErr)

		// Associate the group with the channel
		autoAdd := true
		schemeAdmin := true
		_, r, err := th.SystemAdminClient.LinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel, &model.GroupSyncablePatch{AutoAdd: &autoAdd, SchemeAdmin: &schemeAdmin})
		require.NoError(t, err)
		CheckCreatedStatus(t, r)

		patch := &model.ChannelPatch{}
		patch.GroupConstrained = model.NewPointer(true)
		_, r, err = th.SystemAdminClient.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Wait for the user to be removed from the channel by polling until they're gone
		// or until we hit the timeout
		timeout := time.After(3 * time.Second)
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		userRemoved := false
		for !userRemoved {
			select {
			case <-timeout:
				require.Fail(t, "Timed out waiting for user to be removed from channel")
				return
			case <-ticker.C:
				// Check if the user is still a member
				_, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, th.BasicUser2.Id, "")
				if err != nil && r.StatusCode == http.StatusNotFound {
					// User has been removed, we can continue the test
					userRemoved = true
				}
			}
		}

		// Verify the user is no longer a member of the channel
		_, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, th.BasicUser2.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, r)
	})

	t.Run("Test GroupConstrained flag changed from true to false and non group members are not removed", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		// Create a test group
		group := th.CreateGroup(t)

		// Create a channel and set it as group-constrained
		channel := th.CreatePrivateChannel(t)

		// Create a group user
		groupUser := th.CreateUser(t)
		th.LinkUserToTeam(t, groupUser, th.BasicTeam)

		// Create a group member
		_, appErr := th.App.UpsertGroupMember(group.Id, groupUser.Id)
		require.Nil(t, appErr)

		// Associate the group with the channel
		autoAdd := true
		schemeAdmin := true
		_, r, err := th.SystemAdminClient.LinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel, &model.GroupSyncablePatch{AutoAdd: &autoAdd, SchemeAdmin: &schemeAdmin})
		require.NoError(t, err)
		CheckCreatedStatus(t, r)

		// Wait for the user to be added to the channel by polling until you see them
		// or until we hit the timeout
		timeout := time.After(3 * time.Second)
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		var cm *model.ChannelMember
		userFound := false
		for !userFound {
			select {
			case <-timeout:
				require.Fail(t, "Timed out waiting for user to be added to the channel")
				return
			case <-ticker.C:
				// Check if the user is now a member
				cm, _, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				if err == nil && cm.UserId == groupUser.Id {
					// User has been added, we can continue the test
					userFound = true
				}
			}
		}

		patch := &model.ChannelPatch{}
		patch.GroupConstrained = model.NewPointer(true)
		_, r, err = th.SystemAdminClient.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Change the GroupConstrained flag to false
		patch.GroupConstrained = model.NewPointer(false)
		_, r, err = th.SystemAdminClient.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Unlink the group
		r, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Wait for a reasonable amount of time to ensure the user is not removed because the channel is no longer group constrained
		timeout = time.After(2 * time.Second)
		ticker = time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		userStillPresent := true
		for userStillPresent {
			select {
			case <-timeout:
				// If we reach the timeout, the user is still present, which is what we want
				// Verify the user is still a member of the channel
				cm, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				require.NoError(t, err)
				CheckOKStatus(t, r)
				require.Equal(t, groupUser.Id, cm.UserId)
				return
			case <-ticker.C:
				// Check if the user is still a member
				_, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				if err != nil && r.StatusCode == http.StatusNotFound {
					// User has been removed, which is not what we want
					require.Fail(t, "User was incorrectly removed from the channel")
					userStillPresent = false
				}
			}
		}
	})

	t.Run("Test updating the header of someone else's GM channel", func(t *testing.T) {
		// Test updating the header of someone else's GM channel.
		user := th.CreateUser(t)
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		groupChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id})
		require.NoError(t, err)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user3.Email, user3.Password)
		require.NoError(t, err)

		channelPatch := &model.ChannelPatch{}
		channelPatch.Header = new(string)
		*channelPatch.Header = "lolololol"

		_, resp, err := client.PatchChannel(context.Background(), groupChannel.Id, channelPatch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		directChannel, _, err := client.CreateDirectChannel(context.Background(), user.Id, user1.Id)
		require.NoError(t, err)

		_, err = client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user3.Email, user3.Password)
		require.NoError(t, err)
		_, resp, err = client.PatchChannel(context.Background(), directChannel.Id, channelPatch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Should block changes to name, display name or purpose for group messages", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		groupChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		groupChannelPatch := &model.ChannelPatch{
			Name: new(string),
		}
		*groupChannelPatch.Name = "testing"
		_, resp, err := client.PatchChannel(context.Background(), groupChannel.Id, groupChannelPatch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		groupChannelPatch2 := &model.ChannelPatch{
			DisplayName: new(string),
		}
		*groupChannelPatch2.DisplayName = "test display name"
		_, resp, err = client.PatchChannel(context.Background(), groupChannel.Id, groupChannelPatch2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		groupChannelPatch3 := &model.ChannelPatch{
			Purpose: new(string),
		}
		*groupChannelPatch3.Purpose = "test purpose"
		_, resp, err = client.PatchChannel(context.Background(), groupChannel.Id, groupChannelPatch3)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Should block changes to name, display name or purpose for direct messages", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)

		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, _, err = client.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		directChannel, _, err := client.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
		require.NoError(t, err)

		directChannelPatch := &model.ChannelPatch{
			Name: new(string),
		}
		*directChannelPatch.Name = "test"
		_, resp, err := client.PatchChannel(context.Background(), directChannel.Id, directChannelPatch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		directChannelPatch2 := &model.ChannelPatch{
			DisplayName: new(string),
		}
		*directChannelPatch2.DisplayName = "test display name"
		_, resp, err = client.PatchChannel(context.Background(), directChannel.Id, directChannelPatch2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		directChannelPatch3 := &model.ChannelPatch{
			Purpose: new(string),
		}
		*directChannelPatch3.Purpose = "test purpose"
		_, resp, err = client.PatchChannel(context.Background(), directChannel.Id, directChannelPatch3)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Should not be able to configure channel banner without a license", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)

		channel := &model.Channel{
			DisplayName: GenerateTestChannelName(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, _, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), channel.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, patchedChannel)
	})

	t.Run("Should not be able to configure channel banner with a professional license", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		channel := &model.Channel{
			DisplayName: GenerateTestChannelName(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, _, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), channel.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, patchedChannel)
	})

	t.Run("Should be able to configure channel banner on a channel", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		channel := &model.Channel{
			DisplayName: GenerateTestChannelName(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, _, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, patchedChannel.BannerInfo)
		require.True(t, *patchedChannel.BannerInfo.Enabled)
		require.Equal(t, "banner text", *patchedChannel.BannerInfo.Text)
		require.Equal(t, "#dddddd", *patchedChannel.BannerInfo.BackgroundColor)
	})

	t.Run("Should not be able to configure channel banner on a channel as a non-admin channel member", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		_, resp, err := client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Should be able to configure channel banner as a team admin", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginTeamAdmin(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), th.BasicChannel2.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, patchedChannel.BannerInfo)
		require.True(t, *patchedChannel.BannerInfo.Enabled)
		require.Equal(t, "banner text", *patchedChannel.BannerInfo.Text)
		require.Equal(t, "#dddddd", *patchedChannel.BannerInfo.BackgroundColor)
	})

	t.Run("Cannot enable channel banner without configuring it", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		channel := &model.Channel{
			DisplayName: GenerateTestChannelName(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, _, err = client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled: model.NewPointer(true),
			},
		}

		_, resp, err := client.PatchChannel(context.Background(), channel.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// now we will configure it first, then enable it
		patch = &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         nil,
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, patchedChannel.BannerInfo)
		require.Nil(t, patchedChannel.BannerInfo.Enabled)
		require.Equal(t, "banner text", *patchedChannel.BannerInfo.Text)
		require.Equal(t, "#dddddd", *patchedChannel.BannerInfo.BackgroundColor)

		patch = &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled: model.NewPointer(true),
			},
		}

		patchedChannel, resp, err = client.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, patchedChannel.BannerInfo)
		require.True(t, *patchedChannel.BannerInfo.Enabled)
		require.Equal(t, "banner text", *patchedChannel.BannerInfo.Text)
		require.Equal(t, "#dddddd", *patchedChannel.BannerInfo.BackgroundColor)
	})

	t.Run("Cannot configure channel banner on a DM channel", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		dmChannel, resp, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), dmChannel.Id, patch)
		require.Error(t, err)
		require.Equal(t, "Channel banner can only be configured on Public and Private channels.", err.Error())
		CheckBadRequestStatus(t, resp)
		require.Nil(t, patchedChannel)
	})

	t.Run("Cannot configure channel banner on a GM channel", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		user3 := th.CreateUser(t)
		gmChannel, resp, err := client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		patch := &model.ChannelPatch{
			BannerInfo: &model.ChannelBannerInfo{
				Enabled:         model.NewPointer(true),
				Text:            model.NewPointer("banner text"),
				BackgroundColor: model.NewPointer("#dddddd"),
			},
		}

		patchedChannel, resp, err := client.PatchChannel(context.Background(), gmChannel.Id, patch)
		require.Error(t, err)
		require.Equal(t, "Channel banner can only be configured on Public and Private channels.", err.Error())
		CheckBadRequestStatus(t, resp)
		require.Nil(t, patchedChannel)
	})
}

func TestCanEditChannelBanner(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("when license is nil", func(t *testing.T) {
		channel := &model.Channel{
			Type: model.ChannelTypeOpen,
		}

		th.App.Srv().SetLicense(nil)

		webContext := &Context{
			App:        th.App,
			AppContext: th.Context,
			Params: &web.Params{
				ChannelId: "channel_id",
			},
		}

		canEditChannelBanner(webContext, channel)

		require.NotNil(t, webContext.Err)
		assert.Equal(t, "api.context.permissions.app_error", webContext.Err.Id)
		assert.Equal(t, http.StatusForbidden, webContext.Err.StatusCode)
	})

	t.Run("when license is not E20 or Enterprise", func(t *testing.T) {
		license := model.NewTestLicenseSKU(model.LicenseShortSkuProfessional)
		th.App.Srv().SetLicense(license)

		webContext := &Context{
			App:        th.App,
			AppContext: th.Context,
			Params: &web.Params{
				ChannelId: "channel_id",
			},
		}

		channel := &model.Channel{
			Type: model.ChannelTypeOpen,
		}

		canEditChannelBanner(webContext, channel)

		require.NotNil(t, webContext.Err)
		assert.Equal(t, "api.context.permissions.app_error", webContext.Err.Id)
		assert.Equal(t, http.StatusForbidden, webContext.Err.StatusCode)
	})

	t.Run("when channel type is direct message", func(t *testing.T) {
		license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)
		th.App.Srv().SetLicense(license)

		webContext := &Context{
			App:        th.App,
			AppContext: th.Context,
			Params: &web.Params{
				ChannelId: "channel_id",
			},
		}

		channel := &model.Channel{
			Type: model.ChannelTypeDirect,
		}

		canEditChannelBanner(webContext, channel)

		require.NotNil(t, webContext.Err)
		assert.Equal(t, "api.channel.update_channel.banner_info.channel_type.not_allowed", webContext.Err.Id)
		assert.Equal(t, http.StatusBadRequest, webContext.Err.StatusCode)
	})

	t.Run("when channel type is group message", func(t *testing.T) {
		license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)
		th.App.Srv().SetLicense(license)

		webContext := &Context{
			App:        th.App,
			AppContext: th.Context,
			Params: &web.Params{
				ChannelId: "channel_id",
			},
		}

		channel := &model.Channel{
			Type: model.ChannelTypeGroup,
		}

		canEditChannelBanner(webContext, channel)
		require.NotNil(t, webContext.Err)
		assert.Equal(t, "api.channel.update_channel.banner_info.channel_type.not_allowed", webContext.Err.Id)
		assert.Equal(t, http.StatusBadRequest, webContext.Err.StatusCode)
	})

	t.Run("when channel type is open and license is valid", func(t *testing.T) {
		license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)
		th.App.Srv().SetLicense(license)

		channel := th.CreatePublicChannel(t)
		th.MakeUserChannelAdmin(t, th.BasicUser, channel)

		webContext := &Context{
			App:        th.App,
			AppContext: th.Context,
			Params: &web.Params{
				ChannelId: channel.Id,
			},
		}

		webContext.AppContext = webContext.AppContext.WithSession(&model.Session{
			UserId: th.BasicUser.Id,
		})

		canEditChannelBanner(webContext, channel)
		assert.Nil(t, webContext.Err)
	})

	t.Run("when channel type is private and license is valid", func(t *testing.T) {
		license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)
		th.App.Srv().SetLicense(license)

		channel := th.CreatePrivateChannel(t)
		th.MakeUserChannelAdmin(t, th.BasicUser, channel)

		webContext := &Context{
			App:        th.App,
			AppContext: th.Context,
			Params: &web.Params{
				ChannelId: channel.Id,
			},
		}

		webContext.AppContext = webContext.AppContext.WithSession(&model.Session{
			UserId: th.BasicUser.Id,
		})

		canEditChannelBanner(webContext, channel)
		assert.Nil(t, webContext.Err)
	})
}

func TestChannelUnicodeNames(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	team := th.BasicTeam

	t.Run("create channel unicode", func(t *testing.T) {
		channel := &model.Channel{
			Name:        "\u206cenglish\u206dchannel",
			DisplayName: "The \u206cEnglish\u206d Channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}

		rchannel, resp, err := client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.Equal(t, "englishchannel", rchannel.Name, "bad unicode should be filtered from name")
		require.Equal(t, "The English Channel", rchannel.DisplayName, "bad unicode should be filtered from display name")
	})

	t.Run("update channel unicode", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "Test API Name",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, _, err := client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		channel.Name = "\u206ahistorychannel"
		channel.DisplayName = "UFO's and \ufff9stuff\ufffb."

		newChannel, _, err := client.UpdateChannel(context.Background(), channel)
		require.NoError(t, err)

		require.Equal(t, "historychannel", newChannel.Name, "bad unicode should be filtered from name")
		require.Equal(t, "UFO's and stuff.", newChannel.DisplayName, "bad unicode should be filtered from display name")
	})

	t.Run("patch channel unicode", func(t *testing.T) {
		patch := &model.ChannelPatch{
			Name:        new(string),
			DisplayName: new(string),
			Header:      new(string),
			Purpose:     new(string),
		}
		*patch.Name = "\u206ecommunitychannel\u206f"
		*patch.DisplayName = "Natalie Tran's \ufffcAwesome Channel"

		channel, _, err := client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.NoError(t, err)

		require.Equal(t, "communitychannel", channel.Name, "bad unicode should be filtered from name")
		require.Equal(t, "Natalie Tran's Awesome Channel", channel.DisplayName, "bad unicode should be filtered from display name")
	})
}

func TestCreateDirectChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(t)

	dm, _, err := client.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
	require.NoError(t, err)

	channelName := ""
	if user2.Id > user1.Id {
		channelName = user1.Id + "__" + user2.Id
	} else {
		channelName = user2.Id + "__" + user1.Id
	}

	require.Equal(t, channelName, dm.Name, "dm name didn't match")

	_, resp, err := client.CreateDirectChannel(context.Background(), "junk", user2.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.CreateDirectChannel(context.Background(), user1.Id, model.NewId())
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.CreateDirectChannel(context.Background(), model.NewId(), user1.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.CreateDirectChannel(context.Background(), model.NewId(), user2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	r, err := client.DoAPIPost(context.Background(), "/channels/direct", "garbage")
	require.Error(t, err)
	require.Equal(t, http.StatusBadRequest, r.StatusCode)

	_, _, err = th.SystemAdminClient.CreateDirectChannel(context.Background(), user3.Id, user2.Id)
	require.NoError(t, err)

	// Normal client should not be allowed to create a direct channel if users are
	// restricted to messaging members of their own team
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageTeam
	})
	user4 := th.CreateUser(t)
	_, resp, err = th.Client.CreateDirectChannel(context.Background(), user1.Id, user4.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	th.LinkUserToTeam(t, user4, th.BasicTeam)
	_, _, err = th.Client.CreateDirectChannel(context.Background(), user1.Id, user4.Id)
	require.NoError(t, err)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.CreateDirectChannel(context.Background(), model.NewId(), user2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestCreateDirectChannelAsGuest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user1 := th.BasicUser

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	id := model.NewId()
	guest := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	guest, appErr := th.App.CreateGuest(th.Context, guest)
	require.Nil(t, appErr)

	_, _, err := client.Login(context.Background(), guest.Username, "Password1")
	require.NoError(t, err)

	t.Run("Try to created DM with not visible user", func(t *testing.T) {
		var resp *model.Response
		_, resp, err = client.CreateDirectChannel(context.Background(), guest.Id, user1.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = client.CreateDirectChannel(context.Background(), user1.Id, guest.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Creating DM with visible user", func(t *testing.T) {
		th.LinkUserToTeam(t, guest, th.BasicTeam)
		th.AddUserToChannel(t, guest, th.BasicChannel)

		_, _, err = client.CreateDirectChannel(context.Background(), guest.Id, user1.Id)
		require.NoError(t, err)
	})
}

func TestDeleteDirectChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser
	user2 := th.BasicUser2

	rgc, resp, err := client.CreateDirectChannel(context.Background(), user.Id, user2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.NotNil(t, rgc, "should have created a direct channel")

	_, err = client.DeleteChannel(context.Background(), rgc.Id)
	CheckErrorID(t, err, "api.channel.delete_channel.type.invalid")
}

func TestCreateGroupChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(t)

	userIds := []string{user.Id, user2.Id, user3.Id}

	rgc, resp, err := client.CreateGroupChannel(context.Background(), userIds)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	require.NotNil(t, rgc, "should have created a group channel")
	require.Equal(t, model.ChannelTypeGroup, rgc.Type, "should have created a channel of group type")

	m, appErr := th.App.GetChannelMembersPage(th.Context, rgc.Id, 0, 10)
	require.Nil(t, appErr)
	require.Len(t, m, 3, "should have 3 channel members")

	// saving duplicate group channel
	rgc2, _, err := client.CreateGroupChannel(context.Background(), []string{user3.Id, user2.Id})
	require.NoError(t, err)
	require.Equal(t, rgc.Id, rgc2.Id, "should have returned existing channel")

	m2, appErr := th.App.GetChannelMembersPage(th.Context, rgc2.Id, 0, 10)
	require.Nil(t, appErr)
	require.ElementsMatch(t, m, m2)

	_, resp, err = client.CreateGroupChannel(context.Background(), []string{user2.Id})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	user4 := th.CreateUser(t)
	user5 := th.CreateUser(t)
	user6 := th.CreateUser(t)
	user7 := th.CreateUser(t)
	user8 := th.CreateUser(t)
	user9 := th.CreateUser(t)

	rgc, resp, err = client.CreateGroupChannel(context.Background(), []string{user.Id, user2.Id, user3.Id, user4.Id, user5.Id, user6.Id, user7.Id, user8.Id, user9.Id})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	require.Nil(t, rgc)

	_, resp, err = client.CreateGroupChannel(context.Background(), []string{user.Id, user2.Id, user3.Id, GenerateTestID()})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.CreateGroupChannel(context.Background(), []string{user.Id, user2.Id, user3.Id, "junk"})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.CreateGroupChannel(context.Background(), userIds)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.CreateGroupChannel(context.Background(), userIds)
	require.NoError(t, err)
}

func TestCreateGroupChannelAsGuest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(t)
	user4 := th.CreateUser(t)
	user5 := th.CreateUser(t)
	th.LinkUserToTeam(t, user2, th.BasicTeam)
	th.AddUserToChannel(t, user2, th.BasicChannel)
	th.LinkUserToTeam(t, user3, th.BasicTeam)
	th.AddUserToChannel(t, user3, th.BasicChannel)

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	id := model.NewId()
	guest := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	guest, appErr := th.App.CreateGuest(th.Context, guest)
	require.Nil(t, appErr)

	_, _, err := client.Login(context.Background(), guest.Username, "Password1")
	require.NoError(t, err)

	var resp *model.Response

	t.Run("Try to created GM with not visible users", func(t *testing.T) {
		_, resp, err = client.CreateGroupChannel(context.Background(), []string{guest.Id, user1.Id, user2.Id, user3.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, guest.Id, user3.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Try to created GM with visible and not visible users", func(t *testing.T) {
		th.LinkUserToTeam(t, guest, th.BasicTeam)
		th.AddUserToChannel(t, guest, th.BasicChannel)

		_, resp, err = client.CreateGroupChannel(context.Background(), []string{guest.Id, user1.Id, user3.Id, user4.Id, user5.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, guest.Id, user4.Id, user5.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Creating GM with visible users", func(t *testing.T) {
		_, _, err = client.CreateGroupChannel(context.Background(), []string{guest.Id, user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)
	})
}

func TestDeleteGroupChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	user := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(t)

	userIds := []string{user.Id, user2.Id, user3.Id}

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rgc, resp, err := th.Client.CreateGroupChannel(context.Background(), userIds)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, rgc, "should have created a group channel")
		_, err = client.DeleteChannel(context.Background(), rgc.Id)
		CheckErrorID(t, err, "api.channel.delete_channel.type.invalid")
	})
}

func TestGetChannel(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	client := th.Client

	channel, _, err := client.GetChannel(context.Background(), th.BasicChannel.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicChannel.Id, channel.Id, "ids did not match")

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, _, err = client.GetChannel(context.Background(), th.BasicChannel.Id, "")
	require.NoError(t, err)

	channel, _, err = client.GetChannel(context.Background(), th.BasicPrivateChannel.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicPrivateChannel.Id, channel.Id, "ids did not match")

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, resp, err := client.GetChannel(context.Background(), th.BasicPrivateChannel.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetChannel(context.Background(), model.NewId(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetChannel(context.Background(), th.BasicChannel.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = client.GetChannel(context.Background(), th.BasicChannel.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.GetChannel(context.Background(), th.BasicChannel.Id, "")
		require.NoError(t, err)

		_, _, err = client.GetChannel(context.Background(), th.BasicPrivateChannel.Id, "")
		require.NoError(t, err)

		_, resp, err = client.GetChannel(context.Background(), th.BasicUser.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("Content reviewer should be able to get channel without membership with flagged post", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		contentReviewClient := th.CreateClient()
		_, _, err := contentReviewClient.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		privateChannel := th.CreateChannelWithClient(t, contentReviewClient, model.ChannelTypePrivate)
		post := th.CreatePostWithClient(t, contentReviewClient, privateChannel)

		response, err := contentReviewClient.FlagPostForContentReview(context.Background(), post.Id, &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive content",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, response.StatusCode)

		th.RemoveUserFromChannel(t, th.BasicUser, privateChannel)

		// We will fetch the channel providing the required params to indicate that we are fetching it for content review
		fetchedChannel, _, err := contentReviewClient.GetChannelAsContentReviewer(context.Background(), privateChannel.Id, "", post.Id)
		require.NoError(t, err)
		require.Equal(t, privateChannel.Id, fetchedChannel.Id)

		// This also doesn't work if user is not a content reviewer
		contentFlaggingSettings, _, err := th.SystemAdminClient.GetContentFlaggingSettings(context.Background())
		require.NoError(t, err)
		require.NotNil(t, contentFlaggingSettings)

		// Making system admin as a reviewer because there needs to be some reviewers
		contentFlaggingSettings.ReviewerSettings.CommonReviewerIds = []string{th.SystemAdminUser.Id}
		resp, err = th.SystemAdminClient.SaveContentFlaggingSettings(context.Background(), contentFlaggingSettings)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, resp, err = contentReviewClient.GetChannelAsContentReviewer(context.Background(), privateChannel.Id, "", post.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetDeletedChannelsForTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	team := th.BasicTeam

	th.LoginTeamAdmin(t)

	channels, _, err := client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.NoError(t, err)
	numInitialChannelsForTeam := len(channels)

	// create and delete public channel
	publicChannel1 := th.CreatePublicChannel(t)
	_, err = client.DeleteChannel(context.Background(), publicChannel1.Id)
	require.NoError(t, err)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
		require.NoError(t, err)
		require.Len(t, channels, numInitialChannelsForTeam+1, "should be 1 deleted channel")
	})

	publicChannel2 := th.CreatePublicChannel(t)
	_, err = client.DeleteChannel(context.Background(), publicChannel2.Id)
	require.NoError(t, err)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
		require.NoError(t, err)
		require.Len(t, channels, numInitialChannelsForTeam+2, "should be 2 deleted channels")
	})

	th.LoginBasic(t)

	privateChannel1 := th.CreatePrivateChannel(t)
	_, err = client.DeleteChannel(context.Background(), privateChannel1.Id)
	require.NoError(t, err)

	channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.NoError(t, err)
	require.Len(t, channels, numInitialChannelsForTeam+3)

	// Login as different user and create private channel
	th.LoginBasic2(t)
	privateChannel2 := th.CreatePrivateChannel(t)
	_, err = client.DeleteChannel(context.Background(), privateChannel2.Id)
	require.NoError(t, err)

	// Log back in as first user
	th.LoginBasic(t)

	channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.NoError(t, err)
	require.Len(t, channels, numInitialChannelsForTeam+3)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
		require.NoError(t, err)
		// Local admin should see private archived channels
		require.Len(t, channels, numInitialChannelsForTeam+4)
	})

	channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, channels, 1, "should be one channel per page")

	channels, _, err = client.GetDeletedChannelsForTeam(context.Background(), team.Id, 1, 1, "")
	require.NoError(t, err)
	require.Len(t, channels, 1, "should be one channel per page")

	// test non team member
	_, err = th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, resp, err := client.GetDeletedChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetPrivateChannelsForTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	team := th.BasicTeam

	// normal user
	_, resp, err := th.Client.GetPrivateChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		channels, _, err := c.GetPrivateChannelsForTeam(context.Background(), team.Id, 0, 100, "")
		require.NoError(t, err)
		// th.BasicPrivateChannel and th.BasicPrivateChannel2
		require.Len(t, channels, 2, "wrong number of private channels")
		for _, c := range channels {
			// check all channels included are private
			require.Equal(t, model.ChannelTypePrivate, c.Type, "should include private channels only")
		}

		channels, _, err = c.GetPrivateChannelsForTeam(context.Background(), team.Id, 0, 1, "")
		require.NoError(t, err)
		require.Len(t, channels, 1, "should be one channel per page")

		channels, _, err = c.GetPrivateChannelsForTeam(context.Background(), team.Id, 1, 1, "")
		require.NoError(t, err)
		require.Len(t, channels, 1, "should be one channel per page")

		channels, _, err = c.GetPrivateChannelsForTeam(context.Background(), team.Id, 10000, 100, "")
		require.NoError(t, err)
		require.Empty(t, channels, "should be no channel")

		_, resp, err = c.GetPrivateChannelsForTeam(context.Background(), "junk", 0, 100, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetPublicChannelsForTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	team := th.BasicTeam
	publicChannel1 := th.BasicChannel
	publicChannel2 := th.BasicChannel2

	channels, _, err := client.GetPublicChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.NoError(t, err)
	require.Len(t, channels, 4, "wrong path")

	var foundPublicChannel1, foundPublicChannel2 bool
	for _, c := range channels {
		// check all channels included are open
		require.Equal(t, model.ChannelTypeOpen, c.Type, "should include open channel only")

		// only check the created 2 public channels
		switch c.DisplayName {
		case publicChannel1.DisplayName:
			foundPublicChannel1 = true
		case publicChannel2.DisplayName:
			foundPublicChannel2 = true
		}
	}

	require.True(t, foundPublicChannel1, "failed to find publicChannel1")
	require.True(t, foundPublicChannel2, "failed to find publicChannel2")

	privateChannel := th.CreatePrivateChannel(t)
	channels, _, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.NoError(t, err)
	require.Len(t, channels, 4, "incorrect length of team public channels")

	for _, c := range channels {
		require.Equal(t, model.ChannelTypeOpen, c.Type, "should not include private channel")
		require.NotEqual(t, privateChannel.DisplayName, c.DisplayName, "should not match private channel display name")
	}

	channels, _, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, channels, 1, "should be one channel per page")

	channels, _, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 1, 1, "")
	require.NoError(t, err)
	require.Len(t, channels, 1, "should be one channel per page")

	channels, _, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 10000, 100, "")
	require.NoError(t, err)
	require.Empty(t, channels, "should be no channel")

	_, resp, err := client.GetPublicChannelsForTeam(context.Background(), "junk", 0, 100, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetPublicChannelsForTeam(context.Background(), model.NewId(), 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.GetPublicChannelsForTeam(context.Background(), team.Id, 0, 100, "")
		require.NoError(t, err)
	})
}

func TestGetPublicChannelsByIdsForTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	teamId := th.BasicTeam.Id

	t.Run("should return 1 channel", func(t *testing.T) {
		input := []string{th.BasicChannel.Id}
		output := []string{th.BasicChannel.DisplayName}

		channels, _, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, input)
		require.NoError(t, err)
		require.Len(t, channels, 1, "should return 1 channel")
		require.Equal(t, output[0], channels[0].DisplayName, "missing channel")
	})

	t.Run("should return 2 channels", func(t *testing.T) {
		input := []string{th.BasicChannel.Id}
		output := []string{th.BasicChannel.DisplayName}

		input = append(input, GenerateTestID())
		input = append(input, th.BasicChannel2.Id)
		input = append(input, th.BasicPrivateChannel.Id)
		output = append(output, th.BasicChannel2.DisplayName)
		sort.Strings(output)

		channels, _, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, input)
		require.NoError(t, err)
		require.Len(t, channels, 2, "should return 2 channels")

		for i, c := range channels {
			require.Equal(t, output[i], c.DisplayName, "missing channel")
		}
	})

	t.Run("forbidden for invalid team", func(t *testing.T) {
		input := []string{th.BasicChannel.Id, th.BasicChannel2.Id}
		_, resp, err := client.GetPublicChannelsByIdsForTeam(context.Background(), GenerateTestID(), input)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("bad request for empty input", func(t *testing.T) {
		_, resp, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("bad request for junk id", func(t *testing.T) {
		_, resp, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, []string{"junk"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("not found for non-existent id", func(t *testing.T) {
		_, resp, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, []string{GenerateTestID()})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("not found for private channel id", func(t *testing.T) {
		_, resp, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, []string{th.BasicPrivateChannel.Id})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized when logged out", func(t *testing.T) {
		input := []string{th.BasicChannel.Id, th.BasicChannel2.Id}
		_, lErr := client.Logout(context.Background())
		require.NoError(t, lErr)

		_, resp, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, input)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("system admin can get channels", func(t *testing.T) {
		input := []string{th.BasicChannel.Id, th.BasicChannel2.Id}
		_, _, err := th.SystemAdminClient.GetPublicChannelsByIdsForTeam(context.Background(), teamId, input)
		require.NoError(t, err)
	})

	t.Run("guest users should not be able to get channels", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.AllowEmailAccounts = true })

		id := model.NewId()
		guest := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}
		guest, appErr := th.App.CreateGuest(th.Context, guest)
		require.Nil(t, appErr)

		guestClient := th.CreateClient()
		_, _, err := guestClient.Login(context.Background(), guest.Username, "Password1")
		require.NoError(t, err)
		t.Cleanup(func() {
			_, lErr := guestClient.Logout(context.Background())
			require.NoError(t, lErr)
		})

		input := []string{th.BasicChannel.Id, th.BasicChannel2.Id}
		_, resp, err := guestClient.GetPublicChannelsByIdsForTeam(context.Background(), teamId, input)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetChannelsForTeamForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("get channels for the team for user", func(t *testing.T) {
		channels, resp, err := client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, "")
		require.NoError(t, err)

		found := make([]bool, 3)
		for _, c := range channels {
			if c.Id == th.BasicChannel.Id {
				found[0] = true
			} else if c.Id == th.BasicChannel2.Id {
				found[1] = true
			} else if c.Id == th.BasicPrivateChannel.Id {
				found[2] = true
			}

			require.True(t, c.TeamId == "" || c.TeamId == th.BasicTeam.Id)
		}

		for _, f := range found {
			require.True(t, f, "missing a channel")
		}

		channels, resp, err = client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, resp.Etag)
		require.NoError(t, err)
		CheckEtag(t, channels, resp)

		_, resp, err = client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, "junk", false, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetChannelsForTeamForUser(context.Background(), "junk", th.BasicUser.Id, false, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser2.Id, false, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = client.GetChannelsForTeamForUser(context.Background(), model.NewId(), th.BasicUser.Id, false, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, _, err = th.SystemAdminClient.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, "")
		require.NoError(t, err)
	})

	t.Run("deleted channel could be retrieved using the proper flag", func(t *testing.T) {
		testChannel := &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
			CreatorId:   th.BasicUser.Id,
		}
		testChannel, appErr := th.App.CreateChannel(th.Context, testChannel, true)
		require.Nil(t, appErr)
		defer func() {
			appErr = th.App.PermanentDeleteChannel(th.Context, testChannel)
			require.Nil(t, appErr)
		}()

		channels, _, err := client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, "")
		require.NoError(t, err)
		assert.Equal(t, 6, len(channels))
		appErr = th.App.DeleteChannel(th.Context, testChannel, th.BasicUser.Id)
		require.Nil(t, appErr)
		channels, _, err = client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, "")
		require.NoError(t, err)
		assert.Equal(t, 5, len(channels))

		// Should return all channels including basicDeleted.
		channels, _, err = client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, true, "")
		require.NoError(t, err)
		assert.Equal(t, 7, len(channels))

		// Should stil return all channels including basicDeleted.
		now := time.Now().Add(-time.Minute).Unix() * 1000
		channels, _, err = client.GetChannelsForTeamAndUserWithLastDeleteAt(context.Background(), th.BasicTeam.Id, th.BasicUser.Id,
			true, int(now), "")
		require.NoError(t, err)
		assert.Equal(t, 7, len(channels))
	})
}

func TestGetChannelsForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client

	// Adding another team with more channels (public and private)
	myTeam := th.CreateTeam(t)
	ch1 := th.CreateChannelWithClientAndTeam(t, client, model.ChannelTypeOpen, myTeam.Id)
	ch2 := th.CreateChannelWithClientAndTeam(t, client, model.ChannelTypePrivate, myTeam.Id)
	th.LinkUserToTeam(t, th.BasicUser, myTeam)
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, ch1, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, ch2, false)
	require.Nil(t, appErr)

	channels, _, err := client.GetChannelsForUserWithLastDeleteAt(context.Background(), th.BasicUser.Id, 0)
	require.NoError(t, err)

	numPrivate := 0
	numPublic := 0
	numOffTopic := 0
	numTownSquare := 0
	for _, ch := range channels {
		if ch.Type == model.ChannelTypeOpen {
			numPublic++
		} else if ch.Type == model.ChannelTypePrivate {
			numPrivate++
		}

		if ch.DisplayName == "Off-Topic" {
			numOffTopic++
		} else if ch.DisplayName == "Town Square" {
			numTownSquare++
		}
	}

	assert.Len(t, channels, 9)
	assert.Equal(t, 2, numPrivate)
	assert.Equal(t, 7, numPublic)
	assert.Equal(t, 2, numOffTopic)
	assert.Equal(t, 2, numTownSquare)

	// Creating some more channels to be exactly 100 to test page size boundaries.
	for range 91 {
		ch1 = th.CreateChannelWithClientAndTeam(t, client, model.ChannelTypeOpen, myTeam.Id)
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, ch1, false)
		require.Nil(t, appErr)
	}

	channels, _, err = client.GetChannelsForUserWithLastDeleteAt(context.Background(), th.BasicUser.Id, 0)
	require.NoError(t, err)
	assert.Len(t, channels, 100)
}

func TestGetAllChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.LoginSystemManager(t)
	client := th.Client

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		channels, _, err := client.GetAllChannels(context.Background(), 0, 20, "")
		require.NoError(t, err)

		// At least, all the not-deleted channels created during the InitBasic
		require.True(t, len(channels) >= 3)
		for _, c := range channels {
			require.NotEqual(t, c.TeamId, "")
		}

		channels, _, err = client.GetAllChannels(context.Background(), 0, 10, "")
		require.NoError(t, err)
		require.True(t, len(channels) >= 3)

		channels, _, err = client.GetAllChannels(context.Background(), 1, 1, "")
		require.NoError(t, err)
		require.Len(t, channels, 1)

		channels, _, err = client.GetAllChannels(context.Background(), 10000, 10000, "")
		require.NoError(t, err)
		require.Empty(t, channels)

		channels, _, err = client.GetAllChannels(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		beforeCount := len(channels)

		deletedChannel := channels[0].Channel

		// Never try to delete the default channel
		if deletedChannel.Name == "town-square" {
			deletedChannel = channels[1].Channel
		}

		_, err = client.DeleteChannel(context.Background(), deletedChannel.Id)
		require.NoError(t, err)

		channels, _, err = client.GetAllChannels(context.Background(), 0, 10000, "")
		var ids []string
		for _, item := range channels {
			ids = append(ids, item.Channel.Id)
		}
		require.NoError(t, err)
		require.Len(t, channels, beforeCount-1)
		require.NotContains(t, ids, deletedChannel.Id)

		channels, _, err = client.GetAllChannelsIncludeDeleted(context.Background(), 0, 10000, "")
		ids = []string{}
		for _, item := range channels {
			ids = append(ids, item.Channel.Id)
		}
		require.NoError(t, err)
		require.True(t, len(channels) > beforeCount)
		require.Contains(t, ids, deletedChannel.Id)
	})

	_, resp, err := client.GetAllChannels(context.Background(), 0, 20, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	sysManagerChannels, resp, err := th.SystemManagerClient.GetAllChannels(context.Background(), 0, 10000, "")
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	policyChannel := (sysManagerChannels)[0]
	policy, err := th.App.Srv().Store().RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "Policy 1",
			PostDurationDays: model.NewPointer(int64(30)),
		},
		ChannelIDs: []string{policyChannel.Id},
	})
	require.NoError(t, err)

	t.Run("exclude policy constrained", func(t *testing.T) {
		_, resp, err := th.SystemManagerClient.GetAllChannelsExcludePolicyConstrained(context.Background(), 0, 10000, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		channels, resp, err := th.SystemAdminClient.GetAllChannelsExcludePolicyConstrained(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		found := false
		for _, channel := range channels {
			if channel.Id == policyChannel.Id {
				found = true
				break
			}
		}
		require.False(t, found)
	})

	t.Run("does not return policy ID", func(t *testing.T) {
		channels, resp, err := th.SystemManagerClient.GetAllChannels(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		found := false
		for _, channel := range channels {
			if channel.Id == policyChannel.Id {
				found = true
				require.Nil(t, channel.PolicyID)
				break
			}
		}
		require.True(t, found)
	})

	t.Run("returns policy ID", func(t *testing.T) {
		channels, resp, err := th.SystemAdminClient.GetAllChannels(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		found := false
		for _, channel := range channels {
			if channel.Id == policyChannel.Id {
				found = true
				require.Equal(t, *channel.PolicyID, policy.ID)
				break
			}
		}
		require.True(t, found)
	})

	t.Run("verify correct sanitization", func(t *testing.T) {
		channels, resp, err := th.SystemAdminClient.GetAllChannels(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.True(t, len(channels) > 0)
		for _, channel := range channels {
			if channel.DisplayName != "Off-Topic" && channel.DisplayName != "Town Square" {
				require.NotEqual(t, "", channel.CreatorId)
				require.NotEqual(t, "", channel.Name)
			}
		}

		channels, resp, err = th.SystemManagerClient.GetAllChannels(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.True(t, len(channels) > 0)
		for _, channel := range channels {
			if channel.DisplayName != "Off-Topic" && channel.DisplayName != "Town Square" {
				require.NotEqual(t, "", channel.CreatorId)
				require.NotEqual(t, "", channel.Name)
			}
		}

		th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadUserManagementChannels.Id, model.SystemManagerRoleId)
		channels, resp, err = th.SystemManagerClient.GetAllChannels(context.Background(), 0, 10000, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.True(t, len(channels) > 0)
		for _, channel := range channels {
			require.Equal(t, "", channel.CreatorId)
			require.Equal(t, "", channel.Name)
		}
	})
}

func TestGetAllChannelsWithCount(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	channels, total, _, err := th.SystemAdminClient.GetAllChannelsWithCount(context.Background(), 0, 20, "")
	require.NoError(t, err)

	// At least, all the not-deleted channels created during the InitBasic
	require.True(t, len(channels) >= 3)
	for _, c := range channels {
		require.NotEqual(t, c.TeamId, "")
	}
	require.Equal(t, int64(6), total)

	channels, _, _, err = th.SystemAdminClient.GetAllChannelsWithCount(context.Background(), 0, 10, "")
	require.NoError(t, err)
	require.True(t, len(channels) >= 3)

	channels, _, _, err = th.SystemAdminClient.GetAllChannelsWithCount(context.Background(), 1, 1, "")
	require.NoError(t, err)
	require.Len(t, channels, 1)

	channels, _, _, err = th.SystemAdminClient.GetAllChannelsWithCount(context.Background(), 10000, 10000, "")
	require.NoError(t, err)
	require.Empty(t, channels)

	_, _, resp, err := client.GetAllChannelsWithCount(context.Background(), 0, 20, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestSearchChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("Search using null value", func(t *testing.T) {
		var nullSearch *model.ChannelSearch

		_, resp, err := client.SearchChannels(context.Background(), th.BasicTeam.Id, nullSearch)

		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	search := &model.ChannelSearch{Term: th.BasicChannel.Name}

	channels, _, err := client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
	require.NoError(t, err)

	found := false
	for _, c := range channels {
		require.Equal(t, model.ChannelTypeOpen, c.Type, "should only return public channels")

		if c.Id == th.BasicChannel.Id {
			found = true
		}
	}
	require.True(t, found, "didn't find channel")

	search.Term = th.BasicPrivateChannel.Name
	channels, _, err = client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
	require.NoError(t, err)

	found = false
	for _, c := range channels {
		if c.Id == th.BasicPrivateChannel.Id {
			found = true
		}
	}
	require.False(t, found, "shouldn't find private channel")

	search.Term = ""
	_, _, err = client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
	require.NoError(t, err)

	search.Term = th.BasicChannel.Name
	_, resp, err := client.SearchChannels(context.Background(), model.NewId(), search)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.SearchChannels(context.Background(), "junk", search)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, _, err = th.SystemAdminClient.SearchChannels(context.Background(), th.BasicTeam.Id, search)
	require.NoError(t, err)

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()

	// Remove list channels permission from the user
	th.RemovePermissionFromRole(t, model.PermissionListTeamChannels.Id, model.TeamUserRoleId)

	t.Run("Search for a BasicChannel, which the user is a member of", func(t *testing.T) {
		search.Term = th.BasicChannel.Name
		channelList, _, err := client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
		require.NoError(t, err)

		channelNames := []string{}
		for _, c := range channelList {
			channelNames = append(channelNames, c.Name)
		}
		require.Contains(t, channelNames, th.BasicChannel.Name)
	})

	t.Run("Remove the user from BasicChannel and search again, should not be returned", func(t *testing.T) {
		appErr := th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, th.BasicUser.Id, th.BasicChannel)
		require.Nil(t, appErr)

		search.Term = th.BasicChannel.Name
		channelList, _, err := client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
		require.NoError(t, err)

		channelNames := []string{}
		for _, c := range channelList {
			channelNames = append(channelNames, c.Name)
		}
		require.NotContains(t, channelNames, th.BasicChannel.Name)
	})

	t.Run("Guests only receive autocompletion for which accounts they are a member of", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense(""))
		defer th.App.Srv().SetLicense(nil)

		enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.GuestAccountsSettings.Enable = &enableGuestAccounts })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })

		guest := th.CreateUser(t)
		_, appErr := th.SystemAdminClient.DemoteUserToGuest(context.Background(), guest.Id)
		require.NoError(t, appErr)

		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), th.BasicTeam.Id, guest.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		_, resp, err = client.Login(context.Background(), guest.Username, guest.Password)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		search.Term = th.BasicChannel2.Name
		channelList, _, err := client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
		require.NoError(t, err)

		require.Empty(t, channelList)

		_, resp, err = th.SystemAdminClient.AddChannelMember(context.Background(), th.BasicChannel2.Id, guest.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		search.Term = th.BasicChannel2.Name
		channelList, _, err = client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
		require.NoError(t, err)

		require.NotEmpty(t, channelList)
		require.Equal(t, th.BasicChannel2.Id, channelList[0].Id)
	})
}

func TestSearchAllChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupForSharedChannels(t).InitBasic(t)

	th.LoginSystemManager(t)
	client := th.Client

	openChannel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "SearchAllChannels-FOOBARDISPLAYNAME",
		Name:        "whatever",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)

	privateChannel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "SearchAllChannels-private1",
		Name:        "private1",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)

	team := th.CreateTeam(t)
	privateChannel2, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "dn_private2",
		Name:        "private2",
		Type:        model.ChannelTypePrivate,
		TeamId:      team.Id,
	})
	require.NoError(t, err)
	th.LinkUserToTeam(t, th.SystemAdminUser, team)
	th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)

	groupConstrainedChannel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName:      "SearchAllChannels-groupConstrained-1",
		Name:             "groupconstrained1",
		Type:             model.ChannelTypePrivate,
		GroupConstrained: model.NewPointer(true),
		TeamId:           team.Id,
	})
	require.NoError(t, err)

	// share the open and private channels, one homed locally and the
	// other remotely
	sco := &model.SharedChannel{
		ChannelId: openChannel.Id,
		TeamId:    openChannel.TeamId,
		Home:      true,
		ShareName: "testsharelocal",
		CreatorId: th.BasicChannel.CreatorId,
	}
	_, scoErr := th.App.ShareChannel(th.Context, sco)
	require.NoError(t, scoErr)

	scp := &model.SharedChannel{
		ChannelId: privateChannel.Id,
		TeamId:    privateChannel.TeamId,
		Home:      false,
		RemoteId:  model.NewId(),
		ShareName: "testshareremote",
		CreatorId: th.BasicChannel.CreatorId,
	}
	_, scpErr := th.App.ShareChannel(th.Context, scp)
	require.NoError(t, scpErr)

	testCases := []struct {
		Description        string
		Search             *model.ChannelSearch
		ExpectedChannelIds []string
	}{
		{
			"Middle of word search",
			&model.ChannelSearch{Term: "bardisplay"},
			[]string{openChannel.Id},
		},
		{
			"Prefix search",
			&model.ChannelSearch{Term: "SearchAllChannels-foobar"},
			[]string{openChannel.Id},
		},
		{
			"Suffix search",
			&model.ChannelSearch{Term: "displayname"},
			[]string{openChannel.Id},
		},
		{
			"Name search",
			&model.ChannelSearch{Term: "what"},
			[]string{openChannel.Id},
		},
		{
			"Name suffix search",
			&model.ChannelSearch{Term: "ever"},
			[]string{openChannel.Id},
		},
		{
			"Basic channel name middle of word search",
			&model.ChannelSearch{Term: th.BasicChannel.Name[2:14]},
			[]string{th.BasicChannel.Id},
		},
		{
			"Upper case search",
			&model.ChannelSearch{Term: strings.ToUpper(th.BasicChannel.Name)},
			[]string{th.BasicChannel.Id},
		},
		{
			"Mixed case search",
			&model.ChannelSearch{Term: th.BasicChannel.Name[0:2] + strings.ToUpper(th.BasicChannel.Name[2:5]) + th.BasicChannel.Name[5:]},
			[]string{th.BasicChannel.Id},
		},
		{
			"Non mixed case search",
			&model.ChannelSearch{Term: th.BasicChannel.Name},
			[]string{th.BasicChannel.Id},
		},
		{
			"Search private channel name",
			&model.ChannelSearch{Term: th.BasicPrivateChannel.Name},
			[]string{th.BasicPrivateChannel.Id},
		},
		{
			"Search with private channel filter",
			&model.ChannelSearch{Private: true},
			[]string{th.BasicPrivateChannel.Id, privateChannel2.Id, th.BasicPrivateChannel2.Id, privateChannel.Id, groupConstrainedChannel.Id},
		},
		{
			"Search with public channel filter",
			&model.ChannelSearch{Term: "SearchAllChannels", Public: true},
			[]string{openChannel.Id},
		},
		{
			"Search with private channel filter",
			&model.ChannelSearch{Term: "SearchAllChannels", Private: true},
			[]string{privateChannel.Id, groupConstrainedChannel.Id},
		},
		{
			"Search with teamIds channel filter",
			&model.ChannelSearch{Term: "SearchAllChannels", TeamIds: []string{th.BasicTeam.Id}},
			[]string{openChannel.Id, privateChannel.Id},
		},
		{
			"Search with deleted without IncludeDeleted filter",
			&model.ChannelSearch{Term: th.BasicDeletedChannel.Name},
			[]string{},
		},
		{
			"Search with deleted IncludeDeleted filter",
			&model.ChannelSearch{Term: th.BasicDeletedChannel.Name, IncludeDeleted: true},
			[]string{th.BasicDeletedChannel.Id},
		},
		{
			"Search with deleted IncludeDeleted filter",
			&model.ChannelSearch{Term: th.BasicDeletedChannel.Name, IncludeDeleted: true},
			[]string{th.BasicDeletedChannel.Id},
		},
		{
			"Search with deleted Deleted filter and empty term",
			&model.ChannelSearch{Term: "", Deleted: true},
			[]string{th.BasicDeletedChannel.Id},
		},
		{
			"Search for group constrained",
			&model.ChannelSearch{Term: "SearchAllChannels", GroupConstrained: true},
			[]string{groupConstrainedChannel.Id},
		},
		{
			"Search for group constrained and public",
			&model.ChannelSearch{Term: "SearchAllChannels", GroupConstrained: true, Public: true},
			[]string{},
		},
		{
			"Search for exclude group constrained",
			&model.ChannelSearch{Term: "SearchAllChannels", ExcludeGroupConstrained: true},
			[]string{openChannel.Id, privateChannel.Id},
		},
		{
			"Search for local only channels",
			&model.ChannelSearch{Term: "SearchAllChannels", ExcludeRemote: true},
			[]string{openChannel.Id, groupConstrainedChannel.Id},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			var channels model.ChannelListWithTeamData
			channels, _, err = th.SystemAdminClient.SearchAllChannels(context.Background(), testCase.Search)
			require.NoError(t, err)
			assert.Equal(t, len(testCase.ExpectedChannelIds), len(channels))
			actualChannelIds := []string{}
			for _, channelWithTeamData := range channels {
				actualChannelIds = append(actualChannelIds, channelWithTeamData.Channel.Id)
			}
			assert.ElementsMatch(t, testCase.ExpectedChannelIds, actualChannelIds)
		})
	}

	userChannels, _, err := th.SystemAdminClient.SearchAllChannelsForUser(context.Background(), "private")
	require.NoError(t, err)
	assert.Len(t, userChannels, 2)

	userChannels, _, err = th.SystemAdminClient.SearchAllChannelsForUser(context.Background(), "FOOBARDISPLAYNAME")
	require.NoError(t, err)
	assert.Len(t, userChannels, 1)

	// Searching with no terms returns all default channels
	allChannels, _, err := th.SystemAdminClient.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: ""})
	require.NoError(t, err)
	assert.True(t, len(allChannels) >= 3)

	_, resp, err := client.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: ""})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Choose a policy which the system manager can read
	sysManagerChannels, resp, err := th.SystemManagerClient.GetAllChannels(context.Background(), 0, 10000, "")
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	policyChannel := sysManagerChannels[0]
	policy, savePolicyErr := th.App.Srv().Store().RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "Policy 1",
			PostDurationDays: model.NewPointer(int64(30)),
		},
		ChannelIDs: []string{policyChannel.Id},
	})
	require.NoError(t, savePolicyErr)

	t.Run("does not return policy ID", func(t *testing.T) {
		channels, resp, err := th.SystemManagerClient.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: policyChannel.Name})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		found := false
		for _, channel := range channels {
			if channel.Id == policyChannel.Id {
				found = true
				require.Nil(t, channel.PolicyID)
				break
			}
		}
		require.True(t, found)
	})
	t.Run("returns policy ID", func(t *testing.T) {
		channels, resp, err := th.SystemAdminClient.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: policyChannel.Name})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		found := false
		for _, channel := range channels {
			if channel.Id == policyChannel.Id {
				found = true
				require.Equal(t, *channel.PolicyID, policy.ID)
				break
			}
		}
		require.True(t, found)
	})

	t.Run("verify correct sanitization", func(t *testing.T) {
		channels, resp, err := th.SystemAdminClient.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: ""})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.True(t, len(channels) > 0)
		for _, channel := range channels {
			if channel.DisplayName != "Off-Topic" && channel.DisplayName != "Town Square" {
				require.NotEqual(t, "", channel.CreatorId)
				require.NotEqual(t, "", channel.Name)
			}
		}

		channels, resp, err = th.SystemManagerClient.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: ""})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.True(t, len(channels) > 0)
		for _, channel := range channels {
			if channel.DisplayName != "Off-Topic" && channel.DisplayName != "Town Square" {
				require.NotEqual(t, "", channel.CreatorId)
				require.NotEqual(t, "", channel.Name)
			}
		}

		th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadUserManagementChannels.Id, model.SystemManagerRoleId)
		channels, resp, err = th.SystemManagerClient.SearchAllChannels(context.Background(), &model.ChannelSearch{Term: ""})
		require.NoError(t, err)
		require.True(t, len(channels) > 0)
		CheckOKStatus(t, resp)
		for _, channel := range channels {
			require.Equal(t, "", channel.CreatorId)
			require.Equal(t, "", channel.Name)
		}
	})
}

func TestSearchAllChannelsPaged(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	search := &model.ChannelSearch{Term: th.BasicChannel.Name}
	search.Term = ""
	search.Page = model.NewPointer(0)
	search.PerPage = model.NewPointer(2)
	channelsWithCount, _, err := th.SystemAdminClient.SearchAllChannelsPaged(context.Background(), search)
	require.NoError(t, err)
	require.Len(t, channelsWithCount.Channels, 2)

	search.Term = th.BasicChannel.Name
	_, resp, err := client.SearchAllChannels(context.Background(), search)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestSearchGroupChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	u1 := th.CreateUserWithClient(t, th.SystemAdminClient)

	// Create a group channel in which base user belongs but not sysadmin
	gc1, _, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, u1.Id})
	require.NoError(t, err)

	gc2, _, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id})
	require.NoError(t, err)

	search := &model.ChannelSearch{Term: th.BasicUser2.Username}

	// sysadmin should only find gc2 as he doesn't belong to gc1
	channels, _, err := th.SystemAdminClient.SearchGroupChannels(context.Background(), search)
	require.NoError(t, err)

	assert.Len(t, channels, 1)
	assert.Equal(t, channels[0].Id, gc2.Id)

	// basic user should find both
	_, _, err = client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)
	channels, _, err = client.SearchGroupChannels(context.Background(), search)
	require.NoError(t, err)

	assert.Len(t, channels, 2)
	channelIds := []string{}
	for _, c := range channels {
		channelIds = append(channelIds, c.Id)
	}
	assert.ElementsMatch(t, channelIds, []string{gc1.Id, gc2.Id})

	// searching for sysadmin, it should only find gc1
	search = &model.ChannelSearch{Term: th.SystemAdminUser.Username}
	channels, _, err = client.SearchGroupChannels(context.Background(), search)
	require.NoError(t, err)

	assert.Len(t, channels, 1)
	assert.Equal(t, channels[0].Id, gc2.Id)

	// with an empty search, response should be empty
	search = &model.ChannelSearch{Term: ""}
	channels, _, err = client.SearchGroupChannels(context.Background(), search)
	require.NoError(t, err)

	assert.Empty(t, channels)

	// search unprivileged, forbidden
	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err := client.SearchAllChannels(context.Background(), search)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	t.Run("search with null value", func(t *testing.T) {
		var search *model.ChannelSearch
		_, _, err := client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
		require.NoError(t, err)
		_, resp, err := client.SearchGroupChannels(context.Background(), search)

		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestDeleteChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	c := th.Client
	team := th.BasicTeam
	user := th.BasicUser
	user2 := th.BasicUser2

	// successful delete of public channel
	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		publicChannel1 := th.CreatePublicChannel(t)
		_, err := client.DeleteChannel(context.Background(), publicChannel1.Id)
		require.NoError(t, err)

		ch, appErr := th.App.GetChannel(th.Context, publicChannel1.Id)
		require.Nil(t, appErr)
		require.True(t, ch.DeleteAt != 0, "should have returned one with a populated DeleteAt.")

		post1 := &model.Post{ChannelId: publicChannel1.Id, Message: "a" + GenerateTestID() + "a"}
		_, resp, err := client.CreatePost(context.Background(), post1)
		require.Error(t, err)
		require.NotNil(t, resp, "expected response to not be nil")

		// successful delete of private channel
		privateChannel2 := th.CreatePrivateChannel(t)
		_, err = client.DeleteChannel(context.Background(), privateChannel2.Id)
		require.NoError(t, err)

		// successful delete of channel with multiple members
		publicChannel3 := th.CreatePublicChannel(t)
		_, appErr = th.App.AddUserToChannel(th.Context, user, publicChannel3, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, user2, publicChannel3, false)
		require.Nil(t, appErr)
		_, err = client.DeleteChannel(context.Background(), publicChannel3.Id)
		require.NoError(t, err)

		// default channel cannot be deleted.
		defaultChannel, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, team.Id, false)
		require.Nil(t, appErr)
		resp, err = client.DeleteChannel(context.Background(), defaultChannel.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// check system admin can delete a channel without any appropriate team or channel membership.
		sdTeam := th.CreateTeamWithClient(t, c)
		sdPublicChannel := &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpen,
			TeamId:      sdTeam.Id,
		}
		sdPublicChannel, _, err = c.CreateChannel(context.Background(), sdPublicChannel)
		require.NoError(t, err)
		_, err = client.DeleteChannel(context.Background(), sdPublicChannel.Id)
		require.NoError(t, err)

		sdPrivateChannel := &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypePrivate,
			TeamId:      sdTeam.Id,
		}
		sdPrivateChannel, _, err = c.CreateChannel(context.Background(), sdPrivateChannel)
		require.NoError(t, err)
		_, err = client.DeleteChannel(context.Background(), sdPrivateChannel.Id)
		require.NoError(t, err)
	})

	th.LoginBasic(t)
	publicChannel5 := th.CreatePublicChannel(t)
	_, err := c.Logout(context.Background())
	require.NoError(t, err)

	// Other users can't delete the channel
	_, _, err = c.Login(context.Background(), user2.Email, user2.Password)
	require.NoError(t, err)
	resp, err := c.DeleteChannel(context.Background(), publicChannel5.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = c.DeleteChannel(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = c.Logout(context.Background())
	require.NoError(t, err)
	resp, err = c.DeleteChannel(context.Background(), GenerateTestID())
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// The creator can delete the channel
	_, err = c.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = c.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	resp, err = c.DeleteChannel(context.Background(), publicChannel5.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
}

func TestDeleteChannel2(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()

	th.AddPermissionToRole(t, model.PermissionDeletePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeletePrivateChannel.Id, model.ChannelUserRoleId)

	// channels created by SystemAdmin
	publicChannel6 := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypeOpen)
	privateChannel7 := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypePrivate)
	_, appErr := th.App.AddUserToChannel(th.Context, user, publicChannel6, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, user, privateChannel7, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, user, privateChannel7, false)
	require.Nil(t, appErr)

	// successful delete by user
	_, err := client.DeleteChannel(context.Background(), publicChannel6.Id)
	require.NoError(t, err)

	_, err = client.DeleteChannel(context.Background(), privateChannel7.Id)
	require.NoError(t, err)

	// Restrict permissions to Channel Admins
	th.RemovePermissionFromRole(t, model.PermissionDeletePublicChannel.Id, model.ChannelUserRoleId)
	th.RemovePermissionFromRole(t, model.PermissionDeletePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeletePublicChannel.Id, model.ChannelAdminRoleId)
	th.AddPermissionToRole(t, model.PermissionDeletePrivateChannel.Id, model.ChannelAdminRoleId)

	// channels created by SystemAdmin
	publicChannel6 = th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypeOpen)
	privateChannel7 = th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypePrivate)
	_, appErr = th.App.AddUserToChannel(th.Context, user, publicChannel6, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, user, privateChannel7, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, user, privateChannel7, false)
	require.Nil(t, appErr)

	// cannot delete by user
	resp, err := client.DeleteChannel(context.Background(), publicChannel6.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = client.DeleteChannel(context.Background(), privateChannel7.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// successful delete by channel admin
	th.MakeUserChannelAdmin(t, user, publicChannel6)
	th.MakeUserChannelAdmin(t, user, privateChannel7)
	th.App.Srv().Store().Channel().ClearCaches()

	_, err = client.DeleteChannel(context.Background(), publicChannel6.Id)
	require.NoError(t, err)

	_, err = client.DeleteChannel(context.Background(), privateChannel7.Id)
	require.NoError(t, err)

	// Make sure team admins don't have permission to delete channels.
	th.RemovePermissionFromRole(t, model.PermissionDeletePublicChannel.Id, model.ChannelAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionDeletePrivateChannel.Id, model.ChannelAdminRoleId)

	// last member of a public channel should have required permission to delete
	publicChannel6 = th.CreateChannelWithClient(t, th.Client, model.ChannelTypeOpen)
	resp, err = client.DeleteChannel(context.Background(), publicChannel6.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// last member of a private channel should not be able to delete it if they don't have required permissions
	privateChannel7 = th.CreateChannelWithClient(t, th.Client, model.ChannelTypePrivate)
	resp, err = client.DeleteChannel(context.Background(), privateChannel7.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestPermanentDeleteChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	enableAPIChannelDeletion := *th.App.Config().ServiceSettings.EnableAPIChannelDeletion
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPIChannelDeletion = &enableAPIChannelDeletion })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIChannelDeletion = false })

	publicChannel1 := th.CreatePublicChannel(t)
	t.Run("Permanent deletion not available through API if EnableAPIChannelDeletion is not set", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PermanentDeleteChannel(context.Background(), publicChannel1.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Permanent deletion available through local mode even if EnableAPIChannelDeletion is not set", func(t *testing.T) {
		_, err := th.LocalClient.PermanentDeleteChannel(context.Background(), publicChannel1.Id)
		require.NoError(t, err)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIChannelDeletion = true })
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		publicChannel := th.CreatePublicChannel(t)
		_, err := c.PermanentDeleteChannel(context.Background(), publicChannel.Id)
		require.NoError(t, err)

		_, appErr := th.App.GetChannel(th.Context, publicChannel.Id)
		assert.NotNil(t, appErr)

		resp, err := c.PermanentDeleteChannel(context.Background(), "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "Permanent deletion with EnableAPIChannelDeletion set")
}

func TestUpdateChannelPrivacy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	defaultChannel, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, th.BasicTeam.Id, false)
	require.Nil(t, appErr)

	type testTable []struct {
		name            string
		channel         *model.Channel
		expectedPrivacy model.ChannelType
	}

	t.Run("Should get a forbidden response if not logged in", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		publicChannel := th.CreatePublicChannel(t)

		tt := testTable{
			{"Updating default channel should fail with forbidden status if not logged in", defaultChannel, model.ChannelTypeOpen},
			{"Updating private channel should fail with forbidden status if not logged in", privateChannel, model.ChannelTypePrivate},
			{"Updating public channel should fail with forbidden status if not logged in", publicChannel, model.ChannelTypeOpen},
		}

		for _, tc := range tt {
			t.Run(tc.name, func(t *testing.T) {
				_, resp, err := th.Client.UpdateChannelPrivacy(context.Background(), tc.channel.Id, tc.expectedPrivacy)
				require.Error(t, err)
				CheckForbiddenStatus(t, resp)
			})
		}
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		privateChannel := th.CreatePrivateChannel(t)
		publicChannel := th.CreatePublicChannel(t)

		tt := testTable{
			{"Converting default channel to private should fail", defaultChannel, model.ChannelTypePrivate},
			{"Updating privacy to an invalid setting should fail", publicChannel, "invalid"},
		}

		for _, tc := range tt {
			t.Run(tc.name, func(t *testing.T) {
				_, resp, err := client.UpdateChannelPrivacy(context.Background(), tc.channel.Id, tc.expectedPrivacy)
				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
			})
		}

		tt = testTable{
			{"Default channel should stay public", defaultChannel, model.ChannelTypeOpen},
			{"Public channel should stay public", publicChannel, model.ChannelTypeOpen},
			{"Private channel should stay private", privateChannel, model.ChannelTypePrivate},
			{"Public channel should convert to private", publicChannel, model.ChannelTypePrivate},
			{"Private channel should convert to public", privateChannel, model.ChannelTypeOpen},
		}

		for _, tc := range tt {
			t.Run(tc.name, func(t *testing.T) {
				updatedChannel, _, err := client.UpdateChannelPrivacy(context.Background(), tc.channel.Id, tc.expectedPrivacy)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedPrivacy, updatedChannel.Type)
				updatedChannel, appErr := th.App.GetChannel(th.Context, tc.channel.Id)
				require.Nil(t, appErr)
				assert.Equal(t, tc.expectedPrivacy, updatedChannel.Type)
			})
		}
	})

	t.Run("Enforces convert channel permissions", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		publicChannel := th.CreatePublicChannel(t)

		th.LoginTeamAdmin(t)

		th.RemovePermissionFromRole(t, model.PermissionConvertPublicChannelToPrivate.Id, model.TeamAdminRoleId)
		th.RemovePermissionFromRole(t, model.PermissionConvertPrivateChannelToPublic.Id, model.TeamAdminRoleId)

		_, resp, err := th.Client.UpdateChannelPrivacy(context.Background(), publicChannel.Id, model.ChannelTypePrivate)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		_, resp, err = th.Client.UpdateChannelPrivacy(context.Background(), privateChannel.Id, model.ChannelTypeOpen)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		th.AddPermissionToRole(t, model.PermissionConvertPublicChannelToPrivate.Id, model.TeamAdminRoleId)
		th.AddPermissionToRole(t, model.PermissionConvertPrivateChannelToPublic.Id, model.TeamAdminRoleId)

		_, _, err = th.Client.UpdateChannelPrivacy(context.Background(), privateChannel.Id, model.ChannelTypeOpen)
		require.NoError(t, err)
		_, _, err = th.Client.UpdateChannelPrivacy(context.Background(), publicChannel.Id, model.ChannelTypePrivate)
		require.NoError(t, err)
	})
}

func TestRestoreChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	publicChannel1 := th.CreatePublicChannel(t)
	_, err := th.Client.DeleteChannel(context.Background(), publicChannel1.Id)
	require.NoError(t, err)

	privateChannel1 := th.CreatePrivateChannel(t)
	_, err = th.Client.DeleteChannel(context.Background(), privateChannel1.Id)
	require.NoError(t, err)

	_, resp, err := th.Client.RestoreChannel(context.Background(), publicChannel1.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.RestoreChannel(context.Background(), privateChannel1.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Make BasicUser, a User Manager
	oldRoles := th.BasicUser.Roles

	// Because the permissions get set on initialization,
	// remove the manage_team permission from the User Management Role
	th.RemovePermissionFromRole(t, model.PermissionManageTeam.Id, model.SystemUserManagerRoleId)
	_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserManagerRoleId, false)
	require.Nil(t, appErr)
	defer func() {
		_, appErr = th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, oldRoles, false)
		require.Nil(t, appErr)
	}()
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)
	_, _, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)

	_, resp, err = th.Client.RestoreChannel(context.Background(), publicChannel1.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	_, resp, err = th.Client.RestoreChannel(context.Background(), privateChannel1.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	_, err = th.Client.DeleteChannel(context.Background(), publicChannel1.Id)
	require.NoError(t, err)
	_, err = th.Client.DeleteChannel(context.Background(), privateChannel1.Id)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		defer func() {
			_, err = client.DeleteChannel(context.Background(), publicChannel1.Id)
			require.NoError(t, err)
			_, err = client.DeleteChannel(context.Background(), privateChannel1.Id)
			require.NoError(t, err)
		}()

		_, resp, err = client.RestoreChannel(context.Background(), publicChannel1.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, resp, err = client.RestoreChannel(context.Background(), privateChannel1.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestGetChannelByName(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	channel, _, err := client.GetChannelByName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicChannel.Name, channel.Name, "names did not match")

	channel, _, err = client.GetChannelByName(context.Background(), th.BasicPrivateChannel.Name, th.BasicTeam.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicPrivateChannel.Name, channel.Name, "names did not match")

	_, _, err = client.GetChannelByName(context.Background(), strings.ToUpper(th.BasicPrivateChannel.Name), th.BasicTeam.Id, "")
	require.NoError(t, err)

	_, resp, err := client.GetChannelByName(context.Background(), th.BasicDeletedChannel.Name, th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	channel, _, err = client.GetChannelByNameIncludeDeleted(context.Background(), th.BasicDeletedChannel.Name, th.BasicTeam.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicDeletedChannel.Name, channel.Name, "names did not match")

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, _, err = client.GetChannelByName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Id, "")
	require.NoError(t, err)

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, resp, err = client.GetChannelByName(context.Background(), th.BasicPrivateChannel.Name, th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetChannelByName(context.Background(), GenerateTestChannelName(), th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetChannelByName(context.Background(), GenerateTestChannelName(), "junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetChannelByName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = client.GetChannelByName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.GetChannelByName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Id, "")
		require.NoError(t, err)
	})

	_, err = th.SystemAdminClient.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.TeamAdminUser.Id)
	require.NoError(t, err)
	TeamAdminClient := th.CreateClient()
	th.LoginTeamAdminWithClient(t, TeamAdminClient)
	channel, _, err = TeamAdminClient.GetChannelByName(context.Background(), th.BasicPrivateChannel.Name, th.BasicTeam.Id, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicPrivateChannel.Name, channel.Name, "names did not match")
}

func TestGetChannelByNameForTeamName(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	channel, _, err := th.SystemAdminClient.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Name, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicChannel.Name, channel.Name, "names did not match")

	_, err = th.SystemAdminClient.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.TeamAdminUser.Id)
	require.NoError(t, err)
	TeamAdminClient := th.CreateClient()
	th.LoginTeamAdminWithClient(t, TeamAdminClient)
	channel, _, err = TeamAdminClient.GetChannelByNameForTeamName(context.Background(), th.BasicPrivateChannel.Name, th.BasicTeam.Name, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicPrivateChannel.Name, channel.Name, "names did not match")

	channel, _, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Name, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicChannel.Name, channel.Name, "names did not match")

	channel, _, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicPrivateChannel.Name, th.BasicTeam.Name, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicPrivateChannel.Name, channel.Name, "names did not match")

	_, resp, err := client.GetChannelByNameForTeamName(context.Background(), th.BasicDeletedChannel.Name, th.BasicTeam.Name, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	channel, _, err = client.GetChannelByNameForTeamNameIncludeDeleted(context.Background(), th.BasicDeletedChannel.Name, th.BasicTeam.Name, "")
	require.NoError(t, err)
	require.Equal(t, th.BasicDeletedChannel.Name, channel.Name, "names did not match")

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, _, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Name, "")
	require.NoError(t, err)

	_, err = client.RemoveUserFromChannel(context.Background(), th.BasicPrivateChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, resp, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicPrivateChannel.Name, th.BasicTeam.Name, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, model.NewRandomString(15), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetChannelByNameForTeamName(context.Background(), GenerateTestChannelName(), th.BasicTeam.Name, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Name, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Name, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetChannelMembers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		members, _, err := client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 0, 60, "")
		require.NoError(t, err)
		require.Len(t, members, 3, "should only be 3 users in channel")

		members, _, err = client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 0, 2, "")
		require.NoError(t, err)
		require.Len(t, members, 2, "should only be 2 users")

		members, _, err = client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 1, 1, "")
		require.NoError(t, err)
		require.Len(t, members, 1, "should only be 1 user")

		members, _, err = client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 1000, 100000, "")
		require.NoError(t, err)
		require.Empty(t, members, "should be 0 users")

		_, resp, err := client.GetChannelMembers(context.Background(), "junk", 0, 60, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetChannelMembers(context.Background(), "", 0, 60, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, _, err = client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 0, 60, "")
		require.NoError(t, err)
	})

	_, resp, err := th.Client.GetChannelMembers(context.Background(), model.NewId(), 0, 60, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = th.Client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 0, 60, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = th.Client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = th.Client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 0, 60, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetChannelMembersByIds(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	cm, _, err := client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{th.BasicUser.Id})
	require.NoError(t, err)
	require.Equal(t, th.BasicUser.Id, cm[0].UserId, "returned wrong user")

	_, resp, err := client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	cm1, _, err := client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{"junk"})
	require.NoError(t, err)
	require.Empty(t, cm1, "no users should be returned")

	cm1, _, err = client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{"junk", th.BasicUser.Id})
	require.NoError(t, err)
	require.Len(t, cm1, 1, "1 member should be returned")

	cm1, _, err = client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{th.BasicUser2.Id, th.BasicUser.Id})
	require.NoError(t, err)
	require.Len(t, cm1, 2, "2 members should be returned")

	_, resp, err = client.GetChannelMembersByIds(context.Background(), "junk", []string{th.BasicUser.Id})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetChannelMembersByIds(context.Background(), model.NewId(), []string{th.BasicUser.Id})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{th.BasicUser.Id})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{th.BasicUser2.Id, th.BasicUser.Id})
	require.NoError(t, err)
}

func TestGetChannelMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	c := th.Client
	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		member, _, err := client.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
		require.NoError(t, err)
		require.Equal(t, th.BasicChannel.Id, member.ChannelId, "wrong channel id")
		require.Equal(t, th.BasicUser.Id, member.UserId, "wrong user id")

		_, resp, err := client.GetChannelMember(context.Background(), "", th.BasicUser.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, resp, err = client.GetChannelMember(context.Background(), "junk", th.BasicUser.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		_, resp, err = client.GetChannelMember(context.Background(), th.BasicChannel.Id, "", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, resp, err = client.GetChannelMember(context.Background(), th.BasicChannel.Id, "junk", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetChannelMember(context.Background(), th.BasicChannel.Id, model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, _, err = client.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
		require.NoError(t, err)
	})

	_, resp, err := c.GetChannelMember(context.Background(), model.NewId(), th.BasicUser.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = c.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = c.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = c.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = c.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetChannelMembersForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	members, _, err := client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.NoError(t, err)
	require.Len(t, members, 6, "should have 6 members on team")

	_, resp, err := client.GetChannelMembersForUser(context.Background(), "", th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetChannelMembersForUser(context.Background(), "junk", th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetChannelMembersForUser(context.Background(), model.NewId(), th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, "", "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, "junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, model.NewId(), "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	_, resp, err = client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.NoError(t, err)
}

func TestViewChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	view := &model.ChannelView{
		ChannelId: th.BasicChannel.Id,
	}

	viewResp, _, err := client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.NoError(t, err)
	require.Equal(t, "OK", viewResp.Status, "should have passed")

	channel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr)

	require.Equal(t, channel.LastPostAt, viewResp.LastViewedAtTimes[channel.Id], "LastPostAt does not match returned LastViewedAt time")

	view.PrevChannelId = th.BasicChannel.Id
	_, _, err = client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.NoError(t, err)

	view.PrevChannelId = ""
	_, _, err = client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.NoError(t, err)

	view.PrevChannelId = "junk"
	_, resp, err := client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// All blank is OK we use it for clicking off of the browser.
	view.PrevChannelId = ""
	view.ChannelId = ""
	_, _, err = client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.NoError(t, err)

	view.PrevChannelId = ""
	view.ChannelId = "junk"
	_, resp, err = client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	view.ChannelId = "correctlysizedjunkdddfdfdf"
	viewResult, _, err := client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.NoError(t, err)
	require.Len(t, viewResult.LastViewedAtTimes, 0)

	view.ChannelId = th.BasicChannel.Id

	member, _, err := client.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	channel, _, err = client.GetChannel(context.Background(), th.BasicChannel.Id, "")
	require.NoError(t, err)
	require.Equal(t, channel.TotalMsgCount, member.MsgCount, "should match message counts")
	require.Equal(t, int64(0), member.MentionCount, "should have no mentions")
	require.Equal(t, int64(0), member.MentionCountRoot, "should have no mentions")

	_, resp, err = client.ViewChannel(context.Background(), "junk", view)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ViewChannel(context.Background(), th.BasicUser2.Id, view)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	r, err := client.DoAPIPost(context.Background(), fmt.Sprintf("/channels/members/%v/view", th.BasicUser.Id), "garbage")
	require.Error(t, err)
	require.Equal(t, http.StatusBadRequest, r.StatusCode)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.ViewChannel(context.Background(), th.BasicUser.Id, view)
	require.NoError(t, err)
}

func TestReadMultipleChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser

	t.Run("Should successfully mark public channels as read for self", func(t *testing.T) {
		channel, _, err := client.GetChannel(context.Background(), th.BasicChannel.Id, "")
		require.NoError(t, err)
		channel2, _, err := client.GetChannel(context.Background(), th.BasicChannel2.Id, "")
		require.NoError(t, err)

		channelResponse, _, err := client.ReadMultipleChannels(context.Background(), user.Id, []string{channel.Id, channel2.Id})
		require.NoError(t, err)
		require.Equal(t, "OK", channelResponse.Status, "invalid status return")
		require.Equal(t, channel.LastPostAt, channelResponse.LastViewedAtTimes[channel.Id], "wrong number of viewed at times")
		require.Equal(t, channel2.LastPostAt, channelResponse.LastViewedAtTimes[channel2.Id], "wrong number of viewed at times")
	})

	t.Run("Should successfully mark private channels as read for self", func(t *testing.T) {
		channel, _, err := client.GetChannel(context.Background(), th.BasicPrivateChannel.Id, "")
		require.NoError(t, err)

		// private channel without membership should be ignored
		channelResponse, _, err := client.ReadMultipleChannels(context.Background(), user.Id, []string{channel.Id, th.BasicPrivateChannel2.Id})
		require.NoError(t, err)
		require.Equal(t, "OK", channelResponse.Status, "invalid status return")
		require.Equal(t, 1, len(channelResponse.LastViewedAtTimes), "unexpected response")
		require.Equal(t, channel.LastPostAt, channelResponse.LastViewedAtTimes[channel.Id], "wrong number of viewed at times")
	})

	t.Run("Should fail marking public/private channels for other user", func(t *testing.T) {
		channel, _, err := client.GetChannel(context.Background(), th.BasicChannel.Id, "")
		require.NoError(t, err)

		_, _, err = client.ReadMultipleChannels(context.Background(), th.BasicUser2.Id, []string{channel.Id})
		require.Error(t, err)
	})

	t.Run("Admin should succeed in marking public/private channels for other user", func(t *testing.T) {
		adminClient := th.SystemAdminClient
		channel, _, err := adminClient.GetChannel(context.Background(), th.BasicChannel.Id, "")
		require.NoError(t, err)
		privateChannel, _, err := adminClient.GetChannel(context.Background(), th.BasicPrivateChannel.Id, "")
		require.NoError(t, err)

		channelResponse, _, err := adminClient.ReadMultipleChannels(context.Background(), th.BasicUser2.Id, []string{channel.Id, privateChannel.Id})
		require.NoError(t, err)
		require.Equal(t, "OK", channelResponse.Status, "invalid status return")
		require.Equal(t, channel.LastPostAt, channelResponse.LastViewedAtTimes[channel.Id], "wrong number of viewed at times")
		require.Equal(t, privateChannel.LastPostAt, channelResponse.LastViewedAtTimes[privateChannel.Id], "wrong number of viewed at times")
	})

	t.Run("SystemManager should succeed in marking public/private channels for other user", func(t *testing.T) {
		th.LoginSystemManager(t)
		sysMgrClient := th.SystemManagerClient

		channel, _, err := sysMgrClient.GetChannel(context.Background(), th.BasicChannel.Id, "")
		require.NoError(t, err)
		privateChannel, _, err := sysMgrClient.GetChannel(context.Background(), th.BasicPrivateChannel.Id, "")
		require.NoError(t, err)

		_, _, err = sysMgrClient.ReadMultipleChannels(context.Background(), th.BasicUser2.Id, []string{channel.Id, privateChannel.Id})
		require.Error(t, err)
	})

	t.Run("SystemManager without editOtherUsers should fail in marking public/private channels for other user", func(t *testing.T) {
		sysMgrClient := th.SystemManagerClient
		th.RemovePermissionFromRole(t, model.PermissionEditOtherUsers.Id, model.SystemManagerRoleId)

		defer func() {
			th.AddPermissionToRole(t, model.PermissionEditOtherUsers.Id, model.SystemManagerRoleId)
		}()

		_, _, err := sysMgrClient.ReadMultipleChannels(context.Background(), th.BasicUser2.Id, []string{th.BasicChannel.Id})
		require.Error(t, err)
	})
}

func TestGetChannelUnread(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser
	channel := th.BasicChannel

	channelUnread, _, err := client.GetChannelUnread(context.Background(), channel.Id, user.Id)
	require.NoError(t, err)
	require.Equal(t, th.BasicTeam.Id, channelUnread.TeamId, "wrong team id returned for a regular user call")
	require.Equal(t, channel.Id, channelUnread.ChannelId, "wrong team id returned for a regular user call")

	_, resp, err := client.GetChannelUnread(context.Background(), "junk", user.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetChannelUnread(context.Background(), channel.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetChannelUnread(context.Background(), channel.Id, model.NewId())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetChannelUnread(context.Background(), model.NewId(), user.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	newUser := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), newUser.Email, newUser.Password)
	require.NoError(t, err)
	_, resp, err = client.GetChannelUnread(context.Background(), th.BasicChannel.Id, user.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetChannelUnread(context.Background(), channel.Id, user.Id)
	require.NoError(t, err)

	_, resp, err = th.SystemAdminClient.GetChannelUnread(context.Background(), model.NewId(), user.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetChannelUnread(context.Background(), channel.Id, model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestGetChannelStats(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	channel := th.CreatePrivateChannel(t)

	stats, _, err := client.GetChannelStats(context.Background(), channel.Id, "", false)
	require.NoError(t, err)

	require.Equal(t, channel.Id, stats.ChannelId, "couldn't get extra info")
	require.Equal(t, int64(1), stats.MemberCount, "got incorrect member count")
	require.Equal(t, int64(0), stats.PinnedPostCount, "got incorrect pinned post count")
	require.Equal(t, int64(0), stats.FilesCount, "got incorrect file count")

	th.CreatePinnedPostWithClient(t, th.Client, channel)
	stats, _, err = client.GetChannelStats(context.Background(), channel.Id, "", false)
	require.NoError(t, err)
	require.Equal(t, int64(1), stats.PinnedPostCount, "should have returned 1 pinned post count")

	// create a post with a file
	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)
	fileResp, _, err := client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)
	th.CreatePostInChannelWithFiles(t, channel, fileResp.FileInfos...)
	// make sure the file count channel stats is updated
	stats, _, err = client.GetChannelStats(context.Background(), channel.Id, "", false)
	require.NoError(t, err)
	require.Equal(t, int64(1), stats.FilesCount, "should have returned 1 file count")

	// exclude file counts
	stats, _, err = client.GetChannelStats(context.Background(), channel.Id, "", true)
	require.NoError(t, err)
	require.Equal(t, int64(-1), stats.FilesCount, "should have returned -1 file count for exclude_files_count=true")

	_, resp, err := client.GetChannelStats(context.Background(), "junk", "", false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetChannelStats(context.Background(), model.NewId(), "", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetChannelStats(context.Background(), channel.Id, "", false)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2(t)

	_, resp, err = client.GetChannelStats(context.Background(), channel.Id, "", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetChannelStats(context.Background(), channel.Id, "", false)
	require.NoError(t, err)
}

func TestGetPinnedPosts(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	channel := th.BasicChannel

	posts, _, err := client.GetPinnedPosts(context.Background(), channel.Id, "")
	require.NoError(t, err)
	require.Empty(t, posts.Posts, "should not have gotten a pinned post")

	pinnedPost := th.CreatePinnedPost(t)
	posts, resp, err := client.GetPinnedPosts(context.Background(), channel.Id, "")
	require.NoError(t, err)
	require.Len(t, posts.Posts, 1, "should have returned 1 pinned post")
	require.Contains(t, posts.Posts, pinnedPost.Id, "missing pinned post")

	posts, resp, err = client.GetPinnedPosts(context.Background(), channel.Id, resp.Etag)
	require.NoError(t, err)
	CheckEtag(t, posts, resp)

	_, resp, err = client.GetPinnedPosts(context.Background(), GenerateTestID(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetPinnedPosts(context.Background(), "junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPinnedPosts(context.Background(), channel.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetPinnedPosts(context.Background(), channel.Id, "")
	require.NoError(t, err)
}

func TestUpdateChannelRoles(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	const ChannelAdmin = "channel_user channel_admin"
	const ChannelMember = "channel_user"

	// User 1 creates a channel, making them channel admin by default.
	channel := th.CreatePublicChannel(t)

	// Adds User 2 to the channel, making them a channel member by default.
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, channel, false)
	require.Nil(t, appErr)

	// User 1 promotes User 2
	_, err := client.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser2.Id, ChannelAdmin)
	require.NoError(t, err)

	member, _, err := client.GetChannelMember(context.Background(), channel.Id, th.BasicUser2.Id, "")
	require.NoError(t, err)
	require.Equal(t, ChannelAdmin, member.Roles, "roles don't match")

	// User 1 demotes User 2
	_, err = client.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser2.Id, ChannelMember)
	require.NoError(t, err)

	th.LoginBasic2(t)

	// User 2 cannot demote User 1
	resp, err := client.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser.Id, ChannelMember)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// User 2 cannot promote self
	resp, err = client.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser2.Id, ChannelAdmin)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic(t)

	// User 1 demotes self
	_, err = client.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser.Id, ChannelMember)
	require.NoError(t, err)

	// System Admin promotes User 1
	_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser.Id, ChannelAdmin)
	require.NoError(t, err)

	// System Admin demotes User 1
	_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser.Id, ChannelMember)
	require.NoError(t, err)

	// System Admin promotes User 1
	_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser.Id, ChannelAdmin)
	require.NoError(t, err)

	th.LoginBasic(t)

	resp, err = client.UpdateChannelRoles(context.Background(), channel.Id, th.BasicUser.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UpdateChannelRoles(context.Background(), channel.Id, "junk", ChannelMember)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UpdateChannelRoles(context.Background(), "junk", th.BasicUser.Id, ChannelMember)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UpdateChannelRoles(context.Background(), channel.Id, model.NewId(), ChannelMember)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	resp, err = client.UpdateChannelRoles(context.Background(), model.NewId(), th.BasicUser.Id, ChannelMember)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestUpdateChannelMemberSchemeRoles(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	id := model.NewId()
	guest := &model.User{
		Email:         th.GenerateTestEmail(),
		Nickname:      "nn_" + id,
		FirstName:     "f_" + id,
		LastName:      "l_" + id,
		Password:      "Pa$$word11",
		EmailVerified: true,
	}
	guest, appError := th.App.CreateGuest(th.Context, guest)
	require.Nil(t, appError)
	_, _, appError = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, "")
	th.AddUserToChannel(t, guest, th.BasicChannel)

	require.Nil(t, appError)

	SystemAdminClient := th.SystemAdminClient
	WebSocketClient := th.CreateConnectedWebSocketClient(t)

	th.LoginBasic(t)

	// cannot change the user scheme to false
	s1 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  false,
		SchemeGuest: false,
	}
	_, err := SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, s1)
	require.Error(t, err)

	tm1, _, err := SystemAdminClient.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm1.SchemeGuest)
	assert.Equal(t, true, tm1.SchemeUser)
	assert.Equal(t, false, tm1.SchemeAdmin)

	s2 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  true,
		SchemeGuest: false,
	}
	_, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, s2)
	require.NoError(t, err)

	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() == model.WebsocketEventChannelMemberUpdated {
				require.Equal(t, model.WebsocketEventChannelMemberUpdated, event.EventType())
				waiting = false
			}
		case <-time.After(2 * time.Second):
			require.Fail(t, "Should have received event channel member websocket event and not timedout")
			waiting = false
		}
	}

	tm2, _, err := SystemAdminClient.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm2.SchemeGuest)
	assert.Equal(t, true, tm2.SchemeUser)
	assert.Equal(t, false, tm2.SchemeAdmin)

	// cannot set Guest to User for single channel
	resp, err := SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, guest.Id, s2)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	s3 := &model.SchemeRoles{
		SchemeAdmin: true,
		SchemeUser:  true,
		SchemeGuest: false,
	}
	_, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, s3)
	require.NoError(t, err)

	tm3, _, err := SystemAdminClient.GetChannelMember(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm3.SchemeGuest)
	assert.Equal(t, true, tm3.SchemeUser)
	assert.Equal(t, true, tm3.SchemeAdmin)

	s4 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  false,
		SchemeGuest: true,
	}
	// cannot set user to guest for a single channel
	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, s4)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	s5 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  true,
		SchemeGuest: true,
	}
	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, s5)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), model.NewId(), th.BasicUser.Id, s3)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, model.NewId(), s3)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), "ASDF", th.BasicUser.Id, s3)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, "ASDF", s3)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.LoginBasic2(t)
	resp, err = th.Client.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, s3)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	resp, err = SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), th.BasicChannel.Id, th.SystemAdminUser.Id, s4)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateChannelNotifyProps(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	props := map[string]string{}
	props[model.DesktopNotifyProp] = model.ChannelNotifyMention
	props[model.MarkUnreadNotifyProp] = model.ChannelMarkUnreadMention

	_, err := client.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, props)
	require.NoError(t, err)

	member, appErr := th.App.GetChannelMember(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
	require.Nil(t, appErr)
	require.Equal(t, model.ChannelNotifyMention, member.NotifyProps[model.DesktopNotifyProp], "bad update")
	require.Equal(t, model.ChannelMarkUnreadMention, member.NotifyProps[model.MarkUnreadNotifyProp], "bad update")

	resp, err := client.UpdateChannelNotifyProps(context.Background(), "junk", th.BasicUser.Id, props)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, "junk", props)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UpdateChannelNotifyProps(context.Background(), model.NewId(), th.BasicUser.Id, props)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	resp, err = client.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, model.NewId(), props)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, map[string]string{})
	require.NoError(t, err)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, props)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, err = th.SystemAdminClient.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, props)
	require.NoError(t, err)
}

func TestAddChannelMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser
	user2 := th.BasicUser2
	team := th.BasicTeam
	publicChannel := th.CreatePublicChannel(t)
	privateChannel := th.CreatePrivateChannel(t)

	user3 := th.CreateUserWithClient(t, th.SystemAdminClient)
	_, _, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, user3.Id)
	require.NoError(t, err)

	cm, resp, err := client.AddChannelMember(context.Background(), publicChannel.Id, user2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, publicChannel.Id, cm.ChannelId, "should have returned exact channel")
	require.Equal(t, user2.Id, cm.UserId, "should have returned exact user added to public channel")

	cm, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user2.Id)
	require.NoError(t, err)
	require.Equal(t, privateChannel.Id, cm.ChannelId, "should have returned exact channel")
	require.Equal(t, user2.Id, cm.UserId, "should have returned exact user added to private channel")

	post := &model.Post{ChannelId: publicChannel.Id, Message: "a" + GenerateTestID() + "a"}
	rpost, _, err := client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	_, err = client.RemoveUserFromChannel(context.Background(), publicChannel.Id, user.Id)
	require.NoError(t, err)
	_, resp, err = client.AddChannelMemberWithRootId(context.Background(), publicChannel.Id, user.Id, rpost.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	_, err = client.RemoveUserFromChannel(context.Background(), publicChannel.Id, user.Id)
	require.NoError(t, err)
	_, resp, err = client.AddChannelMemberWithRootId(context.Background(), publicChannel.Id, user.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.AddChannelMemberWithRootId(context.Background(), publicChannel.Id, user.Id, GenerateTestID())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, _, err = client.AddChannelMember(context.Background(), publicChannel.Id, user.Id)
	require.NoError(t, err)

	cm, resp, err = client.AddChannelMember(context.Background(), publicChannel.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	require.Nil(t, cm, "should return nothing")

	_, resp, err = client.AddChannelMember(context.Background(), publicChannel.Id, GenerateTestID())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.AddChannelMember(context.Background(), "junk", user2.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.AddChannelMember(context.Background(), GenerateTestID(), user2.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	otherUser := th.CreateUser(t)
	otherChannel := th.CreatePublicChannel(t)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = client.Login(context.Background(), user2.Email, user2.Password)
	require.NoError(t, err)

	_, resp, err = client.AddChannelMember(context.Background(), publicChannel.Id, otherUser.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.AddChannelMember(context.Background(), privateChannel.Id, otherUser.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.AddChannelMember(context.Background(), otherChannel.Id, otherUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	// should fail adding user who is not a member of the team
	_, resp, err = client.AddChannelMember(context.Background(), otherChannel.Id, otherUser.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.DeleteChannel(context.Background(), otherChannel.Id)
	require.NoError(t, err)

	// Adding user to a deleted channel is fine
	_, resp, err = client.AddChannelMember(context.Background(), otherChannel.Id, user2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.AddChannelMember(context.Background(), publicChannel.Id, user2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = client.AddChannelMember(context.Background(), privateChannel.Id, user2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.AddChannelMember(context.Background(), publicChannel.Id, user2.Id)
		require.NoError(t, err)

		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user2.Id)
		require.NoError(t, err)
	})

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()

	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelUserRoleId)

	// Check that a regular channel user can add other users.
	_, _, err = client.Login(context.Background(), user2.Username, user2.Password)
	require.NoError(t, err)
	privateChannel = th.CreatePrivateChannel(t)
	_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user.Id)
	require.NoError(t, err)
	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, _, err = client.Login(context.Background(), user.Username, user.Password)
	require.NoError(t, err)
	_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user3.Id)
	require.NoError(t, err)
	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	// Restrict the permission for adding users to Channel Admins
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelUserRoleId)

	_, _, err = client.Login(context.Background(), user2.Username, user2.Password)
	require.NoError(t, err)
	privateChannel = th.CreatePrivateChannel(t)
	_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user.Id)
	require.NoError(t, err)
	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, _, err = client.Login(context.Background(), user.Username, user.Password)
	require.NoError(t, err)
	_, resp, err = client.AddChannelMember(context.Background(), privateChannel.Id, user3.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	th.MakeUserChannelAdmin(t, user, privateChannel)
	appErr := th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	_, _, err = client.Login(context.Background(), user.Username, user.Password)
	require.NoError(t, err)
	_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user3.Id)
	require.NoError(t, err)
	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	// Set a channel to group-constrained
	privateChannel.GroupConstrained = model.NewPointer(true)
	_, appErr = th.App.UpdateChannel(th.Context, privateChannel)
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// User is not in associated groups so shouldn't be allowed
		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user.Id)
		CheckErrorID(t, err, "api.channel.add_members.user_denied")
	})

	// Associate group to team
	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    th.Group.Id,
		SyncableId: privateChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.Nil(t, appErr)

	// Add user to group
	_, appErr = th.App.UpsertGroupMember(th.Group.Id, user.Id)
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user.Id)
		require.NoError(t, err)
	})

	t.Run("requester is not a member of the team and tries to add a user to a channel where it is already a member", func(t *testing.T) {
		// Create two teams using SystemAdminClient
		t1 := th.CreateTeamWithClient(t, th.SystemAdminClient)
		t2 := th.CreateTeamWithClient(t, th.SystemAdminClient)

		// Use existing users - user will be BasicUser, user2 will be BasicUser2
		u1 := th.BasicUser
		u2 := th.BasicUser2

		// Add user1 to team1 and user2 to team2 (they're already on BasicTeam)
		th.LinkUserToTeam(t, u1, t1)
		th.LinkUserToTeam(t, u2, t2)

		// Create a public channel in team1
		pubChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, t1.Id)

		// Add user1 to the public channel
		th.AddUserToChannel(t, u1, pubChannel)

		// Create client for user2
		client2 := th.CreateClient()
		_, _, err := client2.Login(context.Background(), u2.Email, u2.Password)
		require.NoError(t, err)

		// Try to add user1 to the public channel using user2's credentials
		// This should fail with 403 since user2 is not a member of the team
		_, resp, err := client2.AddChannelMember(context.Background(), pubChannel.Id, u1.Id)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("invalid request data", func(t *testing.T) {
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			// correct type for user ids (string) but invalid value.
			requestBody := map[string]any{"user_ids": []string{"invalid", user2.Id}}
			requestData, err := json.Marshal(requestBody)
			require.NoError(t, err)

			res, err := client.DoAPIPost(context.Background(), "/channels/"+publicChannel.Id+"/members", string(requestData))
			if client == th.LocalClient {
				require.EqualError(t, err, "Invalid or missing user_id in request body.")
			} else {
				require.EqualError(t, err, "Invalid or missing user_id in user_ids in request body.")
			}
			require.Equal(t, http.StatusBadRequest, res.StatusCode)

			// invalid type for user ids (should be string).
			requestBody = map[string]any{"user_ids": []any{45, user2.Id}}
			requestData, err = json.Marshal(requestBody)
			require.NoError(t, err)

			res, err = client.DoAPIPost(context.Background(), "/channels/"+privateChannel.Id+"/members", string(requestData))
			if client == th.LocalClient {
				require.EqualError(t, err, "Invalid or missing user_id in request body.")
			} else {
				require.EqualError(t, err, "Invalid or missing user_id in user_ids in request body.")
			}
			require.Equal(t, http.StatusBadRequest, res.StatusCode)
		})
	})
}

func TestAddChannelMembers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser
	user2 := th.BasicUser2
	team := th.BasicTeam
	publicChannel := th.CreatePublicChannel(t)
	privateChannel := th.CreatePrivateChannel(t)

	user3 := th.CreateUserWithClient(t, th.SystemAdminClient)
	_, _, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, user3.Id)
	require.NoError(t, err)

	cm, resp, err := client.AddChannelMembers(context.Background(), publicChannel.Id, "", []string{user.Id, user2.Id, user3.Id})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, publicChannel.Id, cm[0].ChannelId, "should have returned exact channel")
	require.Equal(t, user.Id, cm[0].UserId, "should have returned exact user added to public channel")
	require.Equal(t, user2.Id, cm[1].UserId, "should have returned exact user added to public channel")
	require.Equal(t, user3.Id, cm[2].UserId, "should have returned exact user added to public channel")

	cm, _, err = client.AddChannelMembers(context.Background(), privateChannel.Id, "", []string{user.Id, user2.Id, user3.Id})
	require.NoError(t, err)
	require.Equal(t, privateChannel.Id, cm[0].ChannelId, "should have returned exact channel")
	require.Equal(t, user.Id, cm[0].UserId, "should have returned exact user added to public channel")
	require.Equal(t, user2.Id, cm[1].UserId, "should have returned exact user added to public channel")
	require.Equal(t, user3.Id, cm[2].UserId, "should have returned exact user added to public channel")
}

func TestAddChannelMemberFromThread(t *testing.T) {
	mainHelper.Parallel(t)
	t.Skip("MM-41285")
	th := Setup(t).InitBasic(t)
	team := th.BasicTeam
	user := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUserWithClient(t, th.SystemAdminClient)
	_, _, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, user3.Id)
	require.NoError(t, err)

	wsClient := th.CreateConnectedWebSocketClient(t)

	publicChannel := th.CreatePublicChannel(t)

	_, resp, err := th.Client.AddChannelMember(context.Background(), publicChannel.Id, user3.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	_, resp, err = th.Client.AddChannelMember(context.Background(), publicChannel.Id, user2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	post := &model.Post{
		ChannelId: publicChannel.Id,
		Message:   "A root post",
		UserId:    user3.Id,
	}
	rpost, _, err := th.SystemAdminClient.CreatePost(context.Background(), post)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.CreatePost(context.Background(),
		&model.Post{
			ChannelId: publicChannel.Id,
			Message:   "A reply post with mention @" + user.Username,
			UserId:    user2.Id,
			RootId:    rpost.Id,
		})
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.CreatePost(context.Background(),
		&model.Post{
			ChannelId: publicChannel.Id,
			Message:   "Another reply post with mention @" + user.Username,
			UserId:    user2.Id,
			RootId:    rpost.Id,
		})
	require.NoError(t, err)

	// Simulate adding a user to a channel from a thread
	_, _, err = th.SystemAdminClient.AddChannelMemberWithRootId(context.Background(), publicChannel.Id, user.Id, rpost.Id)
	require.NoError(t, err)

	// Threadmembership should exist for added user
	ut, _, err := th.Client.GetUserThread(context.Background(), user.Id, team.Id, rpost.Id, false)
	require.NoError(t, err)
	// Should have two mentions. There might be a race condition
	// here between the "added user to the channel" message and the GetUserThread call
	require.LessOrEqual(t, int64(2), ut.UnreadMentions)

	var caught bool
	func() {
		for {
			select {
			case ev := <-wsClient.EventChannel:
				if ev.EventType() == model.WebsocketEventThreadUpdated {
					caught = true
					var thread model.ThreadResponse
					data := ev.GetData()
					jsonErr := json.Unmarshal([]byte(data["thread"].(string)), &thread)

					require.NoError(t, jsonErr)
					require.EqualValues(t, int64(2), thread.UnreadReplies)
					require.EqualValues(t, int64(2), thread.UnreadMentions)
					require.EqualValues(t, float64(0), data["previous_unread_replies"])
					require.EqualValues(t, float64(0), data["previous_unread_mentions"])
				}
			case <-time.After(2 * time.Second):
				return
			}
		}
	}()
	require.Truef(t, caught, "User should have received %s event", model.WebsocketEventThreadUpdated)
}

func TestAddChannelMemberGuestAccessControl(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Enable guest accounts and add license
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.GuestAccountsSettings.Enable = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	// Create a guest user
	guest, guestClient := th.CreateGuestAndClient(t)

	// Create a public channel to which the guest doesn't belong
	publicChannel := th.CreatePublicChannel(t)

	// Try to add another user to the channel using the guest's client
	// This should fail with a permission error, validating our fix
	_, resp, err := guestClient.AddChannelMember(context.Background(), publicChannel.Id, th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Also verify that using user IDs in the request body doesn't bypass the check
	_, resp, err = guestClient.AddChannelMembers(context.Background(), publicChannel.Id, "", []string{th.BasicUser2.Id})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Verify that the guest can get channel members for channels they belong to
	channelWithGuest := th.CreatePublicChannel(t)
	th.AddUserToChannel(t, guest, channelWithGuest)

	// Guest should be able to read members of channels they belong to
	members, _, err := guestClient.GetChannelMembers(context.Background(), channelWithGuest.Id, 0, 100, "")
	require.NoError(t, err)
	require.NotEmpty(t, members)
}

func TestAddChannelMemberAddMyself(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.CreateUser(t)
	th.LinkUserToTeam(t, user, th.BasicTeam)
	notMemberPublicChannel1 := th.CreatePublicChannel(t)
	notMemberPublicChannel2 := th.CreatePublicChannel(t)
	notMemberPrivateChannel := th.CreatePrivateChannel(t)

	memberPublicChannel := th.CreatePublicChannel(t)
	memberPrivateChannel := th.CreatePrivateChannel(t)
	th.AddUserToChannel(t, user, memberPublicChannel)
	th.AddUserToChannel(t, user, memberPrivateChannel)

	testCases := []struct {
		Name                     string
		Channel                  *model.Channel
		WithJoinPublicPermission bool
		ExpectedError            string
	}{
		{
			"Add myself to a public channel with JoinPublicChannel permission",
			notMemberPublicChannel1,
			true,
			"",
		},
		{
			"Try to add myself to a private channel with the JoinPublicChannel permission",
			notMemberPrivateChannel,
			true,
			"api.context.permissions.app_error",
		},
		{
			"Try to add myself to a public channel without the JoinPublicChannel permission",
			notMemberPublicChannel2,
			false,
			"api.context.permissions.app_error",
		},
		{
			"Add myself a public channel where I'm already a member, not having JoinPublicChannel or ManageMembers permission",
			memberPublicChannel,
			false,
			"",
		},
		{
			"Add myself a private channel where I'm already a member, not having JoinPublicChannel or ManageMembers permission",
			memberPrivateChannel,
			false,
			"",
		},
	}
	_, _, err := client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			// Check the appropriate permissions are enforced.
			defaultRolePermissions := th.SaveDefaultRolePermissions(t)
			defer func() {
				th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
			}()

			if !tc.WithJoinPublicPermission {
				th.RemovePermissionFromRole(t, model.PermissionJoinPublicChannels.Id, model.TeamUserRoleId)
			}

			_, _, err := client.AddChannelMember(context.Background(), tc.Channel.Id, user.Id)
			if tc.ExpectedError == "" {
				require.NoError(t, err)
			} else {
				CheckErrorID(t, err, tc.ExpectedError)
			}
		})
	}
}

func TestRemoveChannelMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	user1 := th.BasicUser
	user2 := th.BasicUser2
	team := th.BasicTeam
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})
	bot := th.CreateBotWithSystemAdminClient(t)
	_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, bot.UserId, "")
	require.Nil(t, appErr)

	_, err := client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser2.Id)
	require.NoError(t, err)

	resp, err := client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	resp, err = client.RemoveUserFromChannel(context.Background(), model.NewId(), th.BasicUser2.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.LoginBasic2(t)
	resp, err = client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	t.Run("success", func(t *testing.T) {
		// Setup the system administrator to listen for websocket events from the channels.
		th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
		_, appErr = th.App.AddUserToChannel(th.Context, th.SystemAdminUser, th.BasicChannel, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, th.SystemAdminUser, th.BasicChannel2, false)
		require.Nil(t, appErr)
		props := map[string]string{}
		props[model.DesktopNotifyProp] = model.ChannelNotifyAll
		_, err = th.SystemAdminClient.UpdateChannelNotifyProps(context.Background(), th.BasicChannel.Id, th.SystemAdminUser.Id, props)
		require.NoError(t, err)
		_, err = th.SystemAdminClient.UpdateChannelNotifyProps(context.Background(), th.BasicChannel2.Id, th.SystemAdminUser.Id, props)
		require.NoError(t, err)

		wsClient := th.CreateConnectedWebSocketClientWithClient(t, th.SystemAdminClient)

		// requirePost listens for websocket events and tries to find the post matching
		// the expected post's channel and message.
		requirePost := func(expectedPost *model.Post) {
			t.Helper()
			for {
				select {
				case event := <-wsClient.EventChannel:
					postData, ok := event.GetData()["post"]
					if !ok {
						continue
					}

					var post model.Post
					err = json.Unmarshal([]byte(postData.(string)), &post)
					require.NoError(t, err)
					if post.ChannelId == expectedPost.ChannelId && post.Message == expectedPost.Message {
						return
					}
				case <-time.After(5 * time.Second):
					require.FailNow(t, "failed to find expected post after 5 seconds")
					return
				}
			}
		}

		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
		require.Nil(t, appErr)
		_, err2 := client.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser2.Id)
		require.NoError(t, err2)

		requirePost(&model.Post{
			Message:   fmt.Sprintf("@%s left the channel.", th.BasicUser2.Username),
			ChannelId: th.BasicChannel.Id,
		})

		_, err2 = client.RemoveUserFromChannel(context.Background(), th.BasicChannel2.Id, th.BasicUser.Id)
		require.NoError(t, err2)
		requirePost(&model.Post{
			Message:   fmt.Sprintf("@%s removed from the channel.", th.BasicUser.Username),
			ChannelId: th.BasicChannel2.Id,
		})

		_, err2 = th.SystemAdminClient.RemoveUserFromChannel(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err2)
		requirePost(&model.Post{
			Message:   fmt.Sprintf("@%s removed from the channel.", th.BasicUser.Username),
			ChannelId: th.BasicChannel.Id,
		})
	})

	// Leave deleted channel
	th.LoginBasic(t)
	deletedChannel := th.CreatePublicChannel(t)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, deletedChannel, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, deletedChannel, false)
	require.Nil(t, appErr)

	appErr = th.App.DeleteChannel(th.Context, deletedChannel, "")
	require.Nil(t, appErr)

	_, err = client.RemoveUserFromChannel(context.Background(), deletedChannel.Id, th.BasicUser.Id)
	require.NoError(t, err)

	th.LoginBasic(t)
	private := th.CreatePrivateChannel(t)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, private, false)
	require.Nil(t, appErr)

	_, err = client.RemoveUserFromChannel(context.Background(), private.Id, th.BasicUser2.Id)
	require.NoError(t, err)

	th.LoginBasic2(t)
	resp, err = client.RemoveUserFromChannel(context.Background(), private.Id, th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, private, false)
		require.Nil(t, appErr)
		_, err = client.RemoveUserFromChannel(context.Background(), private.Id, th.BasicUser.Id)
		require.NoError(t, err)
	})

	th.LoginBasic(t)
	th.UpdateUserToNonTeamAdmin(t, user1, team)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()

	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelUserRoleId)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// Check that a regular channel user can remove other users.
		privateChannel := th.CreateChannelWithClient(t, client, model.ChannelTypePrivate)
		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user1.Id)
		require.NoError(t, err)
		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user2.Id)
		require.NoError(t, err)

		_, err = client.RemoveUserFromChannel(context.Background(), privateChannel.Id, user2.Id)
		require.NoError(t, err)
	})

	// Restrict the permission for adding users to Channel Admins
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelUserRoleId)

	privateChannel := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypePrivate)
	_, _, err = th.SystemAdminClient.AddChannelMember(context.Background(), privateChannel.Id, user1.Id)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.AddChannelMember(context.Background(), privateChannel.Id, user2.Id)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.AddChannelMember(context.Background(), privateChannel.Id, bot.UserId)
	require.NoError(t, err)

	resp, err = client.RemoveUserFromChannel(context.Background(), privateChannel.Id, user2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.MakeUserChannelAdmin(t, user1, privateChannel)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	_, err = client.RemoveUserFromChannel(context.Background(), privateChannel.Id, user2.Id)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.AddChannelMember(context.Background(), privateChannel.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)

	// If the channel is group-constrained the user cannot be removed
	privateChannel.GroupConstrained = model.NewPointer(true)
	_, appErr = th.App.UpdateChannel(th.Context, privateChannel)
	require.Nil(t, appErr)
	_, err = client.RemoveUserFromChannel(context.Background(), privateChannel.Id, user2.Id)
	CheckErrorID(t, err, "api.channel.remove_member.group_constrained.app_error")

	// If the channel is group-constrained user can remove self
	_, err = th.SystemAdminClient.RemoveUserFromChannel(context.Background(), privateChannel.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)

	// Test on preventing removal of user from a direct channel
	directChannel, _, err := client.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
	require.NoError(t, err)

	// If the channel is group-constrained a user can remove a bot
	_, err = client.RemoveUserFromChannel(context.Background(), privateChannel.Id, bot.UserId)
	require.NoError(t, err)

	resp, err = client.RemoveUserFromChannel(context.Background(), directChannel.Id, user1.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.RemoveUserFromChannel(context.Background(), directChannel.Id, user2.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.SystemAdminClient.RemoveUserFromChannel(context.Background(), directChannel.Id, user1.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test on preventing removal of user from a group channel
	user3 := th.CreateUser(t)
	groupChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
	require.NoError(t, err)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		resp, err = client.RemoveUserFromChannel(context.Background(), groupChannel.Id, user1.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestAutocompleteChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// A private channel to make sure private channels are used.
	ptown, _, err := th.Client.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "Town",
		Name:        "town",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)
	tower, _, err := th.Client.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "Tower",
		Name:        "tower",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)
	defer func() {
		_, err = th.Client.DeleteChannel(context.Background(), ptown.Id)
		require.NoError(t, err)
		_, err = th.Client.DeleteChannel(context.Background(), tower.Id)
		require.NoError(t, err)
	}()

	for _, tc := range []struct {
		description      string
		teamId           string
		fragment         string
		expectedIncludes []string
		expectedExcludes []string
	}{
		{
			"Basic town-square",
			th.BasicTeam.Id,
			"town",
			[]string{"town-square", "town"},
			[]string{"off-topic", "tower"},
		},
		{
			"Basic off-topic",
			th.BasicTeam.Id,
			"off-to",
			[]string{"off-topic"},
			[]string{"town-square", "town", "tower"},
		},
		{
			"Basic town square and off topic",
			th.BasicTeam.Id,
			"tow",
			[]string{"town-square", "tower", "town"},
			[]string{"off-topic"},
		},
	} {
		t.Run(tc.description, func(t *testing.T) {
			channels, _, err := th.Client.AutocompleteChannelsForTeam(context.Background(), tc.teamId, tc.fragment)
			require.NoError(t, err)
			names := make([]string, len(channels))
			for i, c := range channels {
				names[i] = c.Name
			}
			for _, name := range tc.expectedIncludes {
				require.Contains(t, names, name, "channel not included")
			}
			for _, name := range tc.expectedExcludes {
				require.NotContains(t, names, name, "channel not excluded")
			}
		})
	}
}

func TestAutocompleteChannelsForSearch(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.LoginSystemAdminWithClient(t, th.SystemAdminClient)
	th.LoginBasicWithClient(t, th.Client)

	u1 := th.CreateUserWithClient(t, th.SystemAdminClient)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, u1)
		require.Nil(t, appErr)
	}()
	u2 := th.CreateUserWithClient(t, th.SystemAdminClient)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, u2)
		require.Nil(t, appErr)
	}()
	u3 := th.CreateUserWithClient(t, th.SystemAdminClient)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, u3)
		require.Nil(t, appErr)
	}()
	u4 := th.CreateUserWithClient(t, th.SystemAdminClient)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, u4)
		require.Nil(t, appErr)
	}()

	// A private channel to make sure private channels are not used
	ptown, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "Town",
		Name:        "town",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)
	defer func() {
		_, err = th.SystemAdminClient.DeleteChannel(context.Background(), ptown.Id)
		require.NoError(t, err)
	}()

	mypriv, _, err := th.Client.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "My private town",
		Name:        "townpriv",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)
	defer func() {
		_, err = th.SystemAdminClient.DeleteChannel(context.Background(), mypriv.Id)
		require.NoError(t, err)
	}()

	dc1, _, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, u1.Id)
	require.NoError(t, err)
	dc2, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), u2.Id, u3.Id)
	require.NoError(t, err)

	gc1, _, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, u2.Id, u3.Id})
	require.NoError(t, err)
	gc2, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{u2.Id, u3.Id, u4.Id})
	require.NoError(t, err)

	for _, tc := range []struct {
		description      string
		teamID           string
		fragment         string
		expectedIncludes []string
		expectedExcludes []string
	}{
		{
			"Basic town-square",
			th.BasicTeam.Id,
			"town",
			[]string{"town-square", "townpriv"},
			[]string{"off-topic", "town"},
		},
		{
			"Basic off-topic",
			th.BasicTeam.Id,
			"off-to",
			[]string{"off-topic"},
			[]string{"town-square", "town", "townpriv"},
		},
		{
			"Basic town square and townpriv",
			th.BasicTeam.Id,
			"tow",
			[]string{"town-square", "townpriv"},
			[]string{"off-topic", "town"},
		},
		{
			"Direct and group messages",
			th.BasicTeam.Id,
			"fakeuser",
			[]string{dc1.Name, gc1.Name},
			[]string{dc2.Name, gc2.Name},
		},
	} {
		t.Run(tc.description, func(t *testing.T) {
			channels, _, err := th.Client.AutocompleteChannelsForTeamForSearch(context.Background(), tc.teamID, tc.fragment)
			require.NoError(t, err)
			names := make([]string, len(channels))
			for i, c := range channels {
				names[i] = c.Name
			}
			for _, name := range tc.expectedIncludes {
				require.Contains(t, names, name, "channel not included")
			}
			for _, name := range tc.expectedExcludes {
				require.NotContains(t, names, name, "channel not excluded")
			}
		})
	}
}

func TestAutocompleteChannelsForSearchGuestUsers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	u1 := th.CreateUserWithClient(t, th.SystemAdminClient)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, u1)
		require.Nil(t, appErr)
	}()

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	id := model.NewId()
	guest := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	guest, appErr := th.App.CreateGuest(th.Context, guest)
	require.Nil(t, appErr)

	th.LoginSystemAdminWithClient(t, th.SystemAdminClient)

	_, _, err := th.SystemAdminClient.AddTeamMember(context.Background(), th.BasicTeam.Id, guest.Id)
	require.NoError(t, err)

	// A private channel to make sure private channels are not used
	town, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "Town",
		Name:        "town",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)
	defer func() {
		_, err = th.SystemAdminClient.DeleteChannel(context.Background(), town.Id)
		require.NoError(t, err)
	}()
	_, _, err = th.SystemAdminClient.AddChannelMember(context.Background(), town.Id, guest.Id)
	require.NoError(t, err)

	mypriv, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "My private town",
		Name:        "townpriv",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
	})
	require.NoError(t, err)
	defer func() {
		_, err = th.SystemAdminClient.DeleteChannel(context.Background(), mypriv.Id)
		require.NoError(t, err)
	}()
	_, _, err = th.SystemAdminClient.AddChannelMember(context.Background(), mypriv.Id, guest.Id)
	require.NoError(t, err)

	dc1, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), th.BasicUser.Id, guest.Id)
	require.NoError(t, err)
	dc2, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
	require.NoError(t, err)

	gc1, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, guest.Id})
	require.NoError(t, err)
	gc2, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, u1.Id})
	require.NoError(t, err)

	_, _, err = th.Client.Login(context.Background(), guest.Username, "Password1")
	require.NoError(t, err)

	for _, tc := range []struct {
		description      string
		teamID           string
		fragment         string
		expectedIncludes []string
		expectedExcludes []string
	}{
		{
			"Should return those channel where is member",
			th.BasicTeam.Id,
			"town",
			[]string{"town", "townpriv"},
			[]string{"town-square", "off-topic"},
		},
		{
			"Should return empty if not member of the searched channels",
			th.BasicTeam.Id,
			"off-to",
			[]string{},
			[]string{"off-topic", "town-square", "town", "townpriv"},
		},
		{
			"Should return direct and group messages",
			th.BasicTeam.Id,
			"fakeuser",
			[]string{dc1.Name, gc1.Name},
			[]string{dc2.Name, gc2.Name},
		},
	} {
		t.Run(tc.description, func(t *testing.T) {
			channels, _, err := th.Client.AutocompleteChannelsForTeamForSearch(context.Background(), tc.teamID, tc.fragment)
			require.NoError(t, err)
			names := make([]string, len(channels))
			for i, c := range channels {
				names[i] = c.Name
			}
			for _, name := range tc.expectedIncludes {
				require.Contains(t, names, name, "channel not included")
			}
			for _, name := range tc.expectedExcludes {
				require.NotContains(t, names, name, "channel not excluded")
			}
		})
	}
}

func TestUpdateChannelScheme(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.Srv().SetLicense(model.NewTestLicense(""))

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	team, _, err := th.SystemAdminClient.CreateTeam(context.Background(), &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	})
	require.NoError(t, err)

	channel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "Name",
		Name:        "z-z-" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
	})
	require.NoError(t, err)

	channelScheme, _, err := th.SystemAdminClient.CreateScheme(context.Background(), &model.Scheme{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Description: "Some description",
		Scope:       model.SchemeScopeChannel,
	})
	require.NoError(t, err)

	teamScheme, _, err := th.SystemAdminClient.CreateScheme(context.Background(), &model.Scheme{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Description: "Some description",
		Scope:       model.SchemeScopeTeam,
	})
	require.NoError(t, err)

	// Test the setup/base case.
	_, err = th.SystemAdminClient.UpdateChannelScheme(context.Background(), channel.Id, channelScheme.Id)
	require.NoError(t, err)

	// Test various invalid channel and scheme id combinations.
	resp, err := th.SystemAdminClient.UpdateChannelScheme(context.Background(), channel.Id, "x")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.SystemAdminClient.UpdateChannelScheme(context.Background(), "x", channelScheme.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.SystemAdminClient.UpdateChannelScheme(context.Background(), "x", "x")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test that permissions are required.
	resp, err = th.Client.UpdateChannelScheme(context.Background(), channel.Id, channelScheme.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Test that a license is required.
	th.App.Srv().SetLicense(nil)
	resp, err = th.SystemAdminClient.UpdateChannelScheme(context.Background(), channel.Id, channelScheme.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	th.App.Srv().SetLicense(model.NewTestLicense(""))

	// Test an invalid scheme scope.
	resp, err = th.SystemAdminClient.UpdateChannelScheme(context.Background(), channel.Id, teamScheme.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test that an unauthenticated user gets rejected.
	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	resp, err = th.SystemAdminClient.UpdateChannelScheme(context.Background(), channel.Id, channelScheme.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetChannelMembersTimezones(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	user := th.BasicUser
	user.Timezone["useAutomaticTimezone"] = "false"
	user.Timezone["manualTimezone"] = "XOXO/BLABLA"
	_, _, err := client.UpdateUser(context.Background(), user)
	require.NoError(t, err)

	user2 := th.BasicUser2
	user2.Timezone["automaticTimezone"] = "NoWhere/Island"
	_, _, err = th.SystemAdminClient.UpdateUser(context.Background(), user2)
	require.NoError(t, err)

	timezone, _, err := client.GetChannelMembersTimezones(context.Background(), th.BasicChannel.Id)
	require.NoError(t, err)
	require.Len(t, timezone, 2, "should return 2 timezones")

	// both users have same timezone
	user2.Timezone["automaticTimezone"] = "XOXO/BLABLA"
	_, _, err = th.SystemAdminClient.UpdateUser(context.Background(), user2)
	require.NoError(t, err)

	timezone, _, err = client.GetChannelMembersTimezones(context.Background(), th.BasicChannel.Id)
	require.NoError(t, err)
	require.Len(t, timezone, 1, "should return 1 timezone")

	// no timezone set should return empty
	user2.Timezone["automaticTimezone"] = ""
	_, _, err = th.SystemAdminClient.UpdateUser(context.Background(), user2)
	require.NoError(t, err)

	user.Timezone["manualTimezone"] = ""
	_, _, err = client.UpdateUser(context.Background(), user)
	require.NoError(t, err)

	timezone, _, err = client.GetChannelMembersTimezones(context.Background(), th.BasicChannel.Id)
	require.NoError(t, err)
	require.Empty(t, timezone, "should return 0 timezone")
}

func TestChannelMembersMinusGroupMembers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	user1 := th.BasicUser
	user2 := th.BasicUser2

	channel := th.CreatePrivateChannel(t)

	_, appErr := th.App.AddChannelMember(th.Context, user1.Id, channel, app.ChannelMemberOpts{})
	require.Nil(t, appErr)
	_, appErr = th.App.AddChannelMember(th.Context, user2.Id, channel, app.ChannelMemberOpts{})
	require.Nil(t, appErr)

	channel.GroupConstrained = model.NewPointer(true)
	channel, appErr = th.App.UpdateChannel(th.Context, channel)
	require.Nil(t, appErr)

	group1 := th.CreateGroup(t)
	group2 := th.CreateGroup(t)

	_, appErr = th.App.UpsertGroupMember(group1.Id, user1.Id)
	require.Nil(t, appErr)
	_, appErr = th.App.UpsertGroupMember(group2.Id, user2.Id)
	require.Nil(t, appErr)

	// No permissions
	_, _, _, err := th.Client.ChannelMembersMinusGroupMembers(context.Background(), channel.Id, []string{group1.Id, group2.Id}, 0, 100, "")
	CheckErrorID(t, err, "api.context.permissions.app_error")

	testCases := map[string]struct {
		groupIDs        []string
		page            int
		perPage         int
		length          int
		count           int
		otherAssertions func([]*model.UserWithGroups)
	}{
		"All groups, expect no users removed": {
			groupIDs: []string{group1.Id, group2.Id},
			page:     0,
			perPage:  100,
			length:   0,
			count:    0,
		},
		"Some nonexistent group, page 0": {
			groupIDs: []string{model.NewId()},
			page:     0,
			perPage:  1,
			length:   1,
			count:    2,
		},
		"Some nonexistent group, page 1": {
			groupIDs: []string{model.NewId()},
			page:     1,
			perPage:  1,
			length:   1,
			count:    2,
		},
		"One group, expect one user removed": {
			groupIDs: []string{group1.Id},
			page:     0,
			perPage:  100,
			length:   1,
			count:    1,
			otherAssertions: func(uwg []*model.UserWithGroups) {
				require.Equal(t, uwg[0].Id, user2.Id)
			},
		},
		"Other group, expect other user removed": {
			groupIDs: []string{group2.Id},
			page:     0,
			perPage:  100,
			length:   1,
			count:    1,
			otherAssertions: func(uwg []*model.UserWithGroups) {
				require.Equal(t, uwg[0].Id, user1.Id)
			},
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			uwg, count, _, err := th.SystemAdminClient.ChannelMembersMinusGroupMembers(context.Background(), channel.Id, tc.groupIDs, tc.page, tc.perPage, "")
			require.NoError(t, err)
			require.Len(t, uwg, tc.length)
			require.Equal(t, tc.count, int(count))
			if tc.otherAssertions != nil {
				tc.otherAssertions(uwg)
			}
		})
	}
}

func TestGetChannelModerations(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	team := th.BasicTeam

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	t.Run("Errors without a license", func(t *testing.T) {
		_, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		CheckErrorID(t, err, "api.channel.get_channel_moderations.license.error")
	})

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Errors as a non sysadmin", func(t *testing.T) {
		_, _, err := th.Client.GetChannelModerations(context.Background(), channel.Id, "")
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Returns default moderations with default roles", func(t *testing.T) {
		moderations, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
		require.Equal(t, len(moderations), 5)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" || moderation.Name == "manage_bookmarks" {
				require.Empty(t, moderation.Roles.Guests)
			} else {
				require.Equal(t, moderation.Roles.Guests.Value, true)
				require.Equal(t, moderation.Roles.Guests.Enabled, true)
			}

			require.Equal(t, moderation.Roles.Members.Value, true)
			require.Equal(t, moderation.Roles.Members.Enabled, true)
		}
	})

	t.Run("Returns value false and enabled false for permissions that are not present in higher scoped scheme when no channel scheme present", func(t *testing.T) {
		scheme := th.SetupTeamScheme(t)
		team.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, scheme.DefaultChannelGuestRole)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, scheme.DefaultChannelGuestRole)

		moderations, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == model.PermissionCreatePost.Id {
				require.Equal(t, moderation.Roles.Members.Value, true)
				require.Equal(t, moderation.Roles.Members.Enabled, true)
				require.Equal(t, moderation.Roles.Guests.Value, false)
				require.Equal(t, moderation.Roles.Guests.Enabled, false)
			}
		}
	})

	t.Run("Returns value false and enabled true for permissions that are not present in channel scheme but present in team scheme", func(t *testing.T) {
		scheme := th.SetupChannelScheme(t)
		channel.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateChannelScheme(th.Context, channel)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, scheme.DefaultChannelGuestRole)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, scheme.DefaultChannelGuestRole)

		moderations, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == model.PermissionCreatePost.Id {
				require.Equal(t, moderation.Roles.Members.Value, true)
				require.Equal(t, moderation.Roles.Members.Enabled, true)
				require.Equal(t, moderation.Roles.Guests.Value, false)
				require.Equal(t, moderation.Roles.Guests.Enabled, true)
			}
		}
	})

	t.Run("Returns value false and enabled false for permissions that are not present in channel & team scheme", func(t *testing.T) {
		teamScheme := th.SetupTeamScheme(t)
		team.SchemeId = &teamScheme.Id
		_, appErr := th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		scheme := th.SetupChannelScheme(t)
		channel.SchemeId = &scheme.Id
		_, appErr = th.App.UpdateChannelScheme(th.Context, channel)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, scheme.DefaultChannelGuestRole)
		th.RemovePermissionFromRole(t, model.PermissionCreatePost.Id, teamScheme.DefaultChannelGuestRole)

		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, scheme.DefaultChannelGuestRole)
		defer th.AddPermissionToRole(t, model.PermissionCreatePost.Id, teamScheme.DefaultChannelGuestRole)

		moderations, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == model.PermissionCreatePost.Id {
				require.Equal(t, moderation.Roles.Members.Value, true)
				require.Equal(t, moderation.Roles.Members.Enabled, true)
				require.Equal(t, moderation.Roles.Guests.Value, false)
				require.Equal(t, moderation.Roles.Guests.Enabled, false)
			}
		}
	})

	t.Run("Returns the correct value for manage_members depending on whether the channel is public or private", func(t *testing.T) {
		scheme := th.SetupTeamScheme(t)
		team.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelMembers.Id, scheme.DefaultChannelUserRole)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelMembers.Id, scheme.DefaultChannelUserRole)

		// public channel does not have the permission
		moderations, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" {
				require.Equal(t, moderation.Roles.Members.Value, false)
			}
		}

		// private channel does have the permission
		moderations, _, err = th.SystemAdminClient.GetChannelModerations(context.Background(), th.BasicPrivateChannel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" {
				require.Equal(t, moderation.Roles.Members.Value, true)
			}
		}
	})

	t.Run("Returns the correct value for manage_bookmarks depending on whether the channel is public or private", func(t *testing.T) {
		scheme := th.SetupTeamScheme(t)
		team.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		bookmarkPublicPermissions := []string{
			model.PermissionAddBookmarkPublicChannel.Id,
			model.PermissionEditBookmarkPublicChannel.Id,
			model.PermissionDeleteBookmarkPublicChannel.Id,
			model.PermissionOrderBookmarkPublicChannel.Id,
		}

		for _, p := range bookmarkPublicPermissions {
			th.RemovePermissionFromRole(t, p, scheme.DefaultChannelUserRole)
		}

		defer func() {
			for _, p := range bookmarkPublicPermissions {
				th.AddPermissionToRole(t, p, scheme.DefaultChannelUserRole)
			}
		}()

		// public channel does not have the permissions
		moderations, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == "manage_bookmarks" {
				require.Equal(t, moderation.Roles.Members.Value, false)
			}
		}

		// private channel does have the permissions
		moderations, _, err = th.SystemAdminClient.GetChannelModerations(context.Background(), th.BasicPrivateChannel.Id, "")
		require.NoError(t, err)
		for _, moderation := range moderations {
			if moderation.Name == "manage_bookmarks" {
				require.Equal(t, moderation.Roles.Members.Value, true)
			}
		}
	})

	t.Run("Does not return an error if the team scheme has a blank DefaultChannelGuestRole field", func(t *testing.T) {
		scheme := th.SetupTeamScheme(t)
		scheme.DefaultChannelGuestRole = ""

		mockStore := mocks.Store{}

		// Playbooks DB job requires a plugin mock
		pluginStore := mocks.PluginStore{}
		pluginStore.On("List", mock.Anything, mock.Anything, mock.Anything).Return([]string{}, nil)
		mockStore.On("Plugin").Return(&pluginStore)

		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", mock.Anything).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(th.App.Srv().Store().Team())
		mockStore.On("Channel").Return(th.App.Srv().Store().Channel())
		mockStore.On("User").Return(th.App.Srv().Store().User())
		mockStore.On("Post").Return(th.App.Srv().Store().Post())
		mockStore.On("FileInfo").Return(th.App.Srv().Store().FileInfo())
		mockStore.On("Webhook").Return(th.App.Srv().Store().Webhook())
		mockStore.On("System").Return(th.App.Srv().Store().System())
		mockStore.On("License").Return(th.App.Srv().Store().License())
		mockStore.On("Role").Return(th.App.Srv().Store().Role())
		mockStore.On("Close").Return(nil)
		th.App.Srv().SetStore(&mockStore)

		team.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		_, _, err := th.SystemAdminClient.GetChannelModerations(context.Background(), channel.Id, "")
		require.NoError(t, err)
	})
}

func TestPatchChannelModerations(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel

	emptyPatch := []*model.ChannelModerationPatch{}

	createPosts := model.ChannelModeratedPermissions[0]

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	t.Run("Errors without a license", func(t *testing.T) {
		_, _, err := th.SystemAdminClient.PatchChannelModerations(context.Background(), channel.Id, emptyPatch)
		CheckErrorID(t, err, "api.channel.patch_channel_moderations.license.error")
	})

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Errors as a non sysadmin", func(t *testing.T) {
		_, _, err := th.Client.PatchChannelModerations(context.Background(), channel.Id, emptyPatch)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Returns default moderations with empty patch", func(t *testing.T) {
		moderations, _, err := th.SystemAdminClient.PatchChannelModerations(context.Background(), channel.Id, emptyPatch)
		require.NoError(t, err)
		require.Equal(t, len(moderations), 5)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" || moderation.Name == "manage_bookmarks" {
				require.Empty(t, moderation.Roles.Guests)
			} else {
				require.Equal(t, moderation.Roles.Guests.Value, true)
				require.Equal(t, moderation.Roles.Guests.Enabled, true)
			}

			require.Equal(t, moderation.Roles.Members.Value, true)
			require.Equal(t, moderation.Roles.Members.Enabled, true)
		}

		require.Nil(t, channel.SchemeId)
	})

	t.Run("Creates a scheme and returns the updated channel moderations when patching an existing permission", func(t *testing.T) {
		patch := []*model.ChannelModerationPatch{
			{
				Name:  &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(false)},
			},
		}

		moderations, _, err := th.SystemAdminClient.PatchChannelModerations(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		require.Equal(t, len(moderations), 5)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" || moderation.Name == "manage_bookmarks" {
				require.Empty(t, moderation.Roles.Guests)
			} else {
				require.Equal(t, moderation.Roles.Guests.Value, true)
				require.Equal(t, moderation.Roles.Guests.Enabled, true)
			}

			if moderation.Name == createPosts {
				require.Equal(t, moderation.Roles.Members.Value, false)
				require.Equal(t, moderation.Roles.Members.Enabled, true)
			} else {
				require.Equal(t, moderation.Roles.Members.Value, true)
				require.Equal(t, moderation.Roles.Members.Enabled, true)
			}
		}
		var appErr *model.AppError
		channel, appErr = th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel.SchemeId)
	})

	t.Run("Removes the existing scheme when moderated permissions are set back to higher scoped values", func(t *testing.T) {
		var appErr *model.AppError
		channel, appErr = th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		schemeId := channel.SchemeId

		scheme, appErr := th.App.GetScheme(*schemeId)
		require.Nil(t, appErr)
		require.Equal(t, scheme.DeleteAt, int64(0))

		patch := []*model.ChannelModerationPatch{
			{
				Name:  &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
			},
		}

		moderations, _, err := th.SystemAdminClient.PatchChannelModerations(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		require.Equal(t, len(moderations), 5)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" || moderation.Name == "manage_bookmarks" {
				require.Empty(t, moderation.Roles.Guests)
			} else {
				require.Equal(t, moderation.Roles.Guests.Value, true)
				require.Equal(t, moderation.Roles.Guests.Enabled, true)
			}

			require.Equal(t, moderation.Roles.Members.Value, true)
			require.Equal(t, moderation.Roles.Members.Enabled, true)
		}

		channel, appErr = th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.Nil(t, channel.SchemeId)

		scheme, appErr = th.App.GetScheme(*schemeId)
		require.Nil(t, appErr)
		require.NotEqual(t, scheme.DeleteAt, int64(0))
	})

	t.Run("Does not return an error if the team scheme has a blank DefaultChannelGuestRole field", func(t *testing.T) {
		team := th.BasicTeam
		scheme := th.SetupTeamScheme(t)
		scheme.DefaultChannelGuestRole = ""

		mockStore := mocks.Store{}

		// Playbooks DB job requires a plugin mock
		pluginStore := mocks.PluginStore{}
		pluginStore.On("List", mock.Anything, mock.Anything, mock.Anything).Return([]string{}, nil)
		mockStore.On("Plugin").Return(&pluginStore)

		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", mock.Anything).Return(scheme, nil)
		mockSchemeStore.On("Save", mock.Anything).Return(scheme, nil)
		mockSchemeStore.On("Delete", mock.Anything).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(th.App.Srv().Store().Team())
		mockStore.On("Channel").Return(th.App.Srv().Store().Channel())
		mockStore.On("User").Return(th.App.Srv().Store().User())
		mockStore.On("Post").Return(th.App.Srv().Store().Post())
		mockStore.On("FileInfo").Return(th.App.Srv().Store().FileInfo())
		mockStore.On("Webhook").Return(th.App.Srv().Store().Webhook())
		mockStore.On("System").Return(th.App.Srv().Store().System())
		mockStore.On("License").Return(th.App.Srv().Store().License())
		mockStore.On("Role").Return(th.App.Srv().Store().Role())
		mockStore.On("Close").Return(nil)
		th.App.Srv().SetStore(&mockStore)

		team.SchemeId = &scheme.Id
		_, appErr := th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		moderations, _, err := th.SystemAdminClient.PatchChannelModerations(context.Background(), channel.Id, emptyPatch)
		require.NoError(t, err)
		require.Equal(t, len(moderations), 5)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" || moderation.Name == "manage_bookmarks" {
				require.Empty(t, moderation.Roles.Guests)
			} else {
				require.Equal(t, moderation.Roles.Guests.Value, false)
				require.Equal(t, moderation.Roles.Guests.Enabled, false)
			}

			require.Equal(t, moderation.Roles.Members.Value, true)
			require.Equal(t, moderation.Roles.Members.Enabled, true)
		}

		patch := []*model.ChannelModerationPatch{
			{
				Name:  &createPosts,
				Roles: &model.ChannelModeratedRolesPatch{Members: model.NewPointer(true)},
			},
		}

		moderations, _, err = th.SystemAdminClient.PatchChannelModerations(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		require.Equal(t, len(moderations), 5)
		for _, moderation := range moderations {
			if moderation.Name == "manage_members" || moderation.Name == "manage_bookmarks" {
				require.Empty(t, moderation.Roles.Guests)
			} else {
				require.Equal(t, moderation.Roles.Guests.Value, false)
				require.Equal(t, moderation.Roles.Guests.Enabled, false)
			}

			require.Equal(t, moderation.Roles.Members.Value, true)
			require.Equal(t, moderation.Roles.Members.Enabled, true)
		}
	})
}

func TestGetChannelMemberCountsByGroup(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	t.Run("Errors without a license", func(t *testing.T) {
		_, _, err := th.SystemAdminClient.GetChannelMemberCountsByGroup(context.Background(), channel.Id, false, "")
		CheckErrorID(t, err, "api.channel.channel_member_counts_by_group.license.error")
	})

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Errors without read permission to the channel", func(t *testing.T) {
		_, _, err := th.Client.GetChannelMemberCountsByGroup(context.Background(), model.NewId(), false, "")
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("Returns empty for a channel with no members or groups", func(t *testing.T) {
		memberCounts, _, err := th.SystemAdminClient.GetChannelMemberCountsByGroup(context.Background(), channel.Id, false, "")
		require.NoError(t, err)
		require.Equal(t, []*model.ChannelMemberCountByGroup{}, memberCounts)
	})

	user := th.BasicUser
	user.Timezone["useAutomaticTimezone"] = "false"
	user.Timezone["manualTimezone"] = "XOXO/BLABLA"
	_, appErr := th.App.UpsertGroupMember(th.Group.Id, user.Id)
	require.Nil(t, appErr)
	_, _, err := th.SystemAdminClient.UpdateUser(context.Background(), user)
	require.NoError(t, err)

	user2 := th.BasicUser2
	user2.Timezone["automaticTimezone"] = "NoWhere/Island"
	_, appErr = th.App.UpsertGroupMember(th.Group.Id, user2.Id)
	require.Nil(t, appErr)
	_, _, err = th.SystemAdminClient.UpdateUser(context.Background(), user2)
	require.NoError(t, err)

	t.Run("Returns users in group without timezones", func(t *testing.T) {
		memberCounts, _, err := th.SystemAdminClient.GetChannelMemberCountsByGroup(context.Background(), channel.Id, false, "")
		require.NoError(t, err)
		expectedMemberCounts := []*model.ChannelMemberCountByGroup{
			{
				GroupId:                     th.Group.Id,
				ChannelMemberCount:          2,
				ChannelMemberTimezonesCount: 0,
			},
		}
		require.Equal(t, expectedMemberCounts, memberCounts)
	})

	t.Run("Returns users in group with timezones", func(t *testing.T) {
		memberCounts, _, err := th.SystemAdminClient.GetChannelMemberCountsByGroup(context.Background(), channel.Id, true, "")
		require.NoError(t, err)
		expectedMemberCounts := []*model.ChannelMemberCountByGroup{
			{
				GroupId:                     th.Group.Id,
				ChannelMemberCount:          2,
				ChannelMemberTimezonesCount: 2,
			},
		}
		require.Equal(t, expectedMemberCounts, memberCounts)
	})

	id := model.NewId()
	group := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewPointer(model.NewId()),
	}

	_, appErr = th.App.CreateGroup(group)
	require.Nil(t, appErr)
	_, appErr = th.App.UpsertGroupMember(group.Id, user.Id)
	require.Nil(t, appErr)

	t.Run("Returns multiple groups with users in group with timezones", func(t *testing.T) {
		memberCounts, _, err := th.SystemAdminClient.GetChannelMemberCountsByGroup(context.Background(), channel.Id, true, "")
		require.NoError(t, err)
		expectedMemberCounts := []*model.ChannelMemberCountByGroup{
			{
				GroupId:                     group.Id,
				ChannelMemberCount:          1,
				ChannelMemberTimezonesCount: 1,
			},
			{
				GroupId:                     th.Group.Id,
				ChannelMemberCount:          2,
				ChannelMemberTimezonesCount: 2,
			},
		}
		require.ElementsMatch(t, expectedMemberCounts, memberCounts)
	})
}

func TestGetChannelsMemberCount(t *testing.T) {
	mainHelper.Parallel(t)
	// Setup
	th := Setup(t).InitBasic(t)

	client := th.Client

	channel1 := th.CreatePublicChannel(t)
	channel2 := th.CreatePrivateChannel(t)
	channel3 := th.CreatePrivateChannel(t)
	th.RemoveUserFromChannel(t, th.BasicUser, channel3)

	user1 := th.CreateUser(t)
	user2 := th.CreateUser(t)
	user3 := th.CreateUser(t)

	th.LinkUserToTeam(t, user1, th.BasicTeam)
	th.LinkUserToTeam(t, user2, th.BasicTeam)
	th.LinkUserToTeam(t, user3, th.BasicTeam)

	th.AddUserToChannel(t, user1, channel1)
	th.AddUserToChannel(t, user2, channel1)
	th.AddUserToChannel(t, user3, channel1)
	th.AddUserToChannel(t, user2, channel2)

	t.Run("Should return correct member count", func(t *testing.T) {
		// Create a request with channel IDs
		channelIDs := []string{channel1.Id, channel2.Id}
		channelsMemberCount, _, err := client.GetChannelsMemberCount(context.Background(), channelIDs)
		require.NoError(t, err)

		// Verify the member counts
		require.Contains(t, channelsMemberCount, channel1.Id)
		require.Contains(t, channelsMemberCount, channel2.Id)
		require.Equal(t, int64(4), channelsMemberCount[channel1.Id])
		require.Equal(t, int64(2), channelsMemberCount[channel2.Id])
	})

	t.Run("Should return empty object when empty array is passed", func(t *testing.T) {
		channelsMemberCount, _, err := client.GetChannelsMemberCount(context.Background(), []string{})
		require.NoError(t, err)
		require.Equal(t, 0, len(channelsMemberCount))
	})

	t.Run("Should fail due to permissions", func(t *testing.T) {
		_, resp, err := client.GetChannelsMemberCount(context.Background(), []string{channel3.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("Should fail due to expired session when logged out", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		channelIDs := []string{channel1.Id, channel2.Id}
		_, resp, err := client.GetChannelsMemberCount(context.Background(), channelIDs)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "api.context.session_expired.app_error")
	})

	t.Run("Should fail due to expired session when logged out", func(t *testing.T) {
		th.LoginBasic2(t)
		channelIDs := []string{channel1.Id, channel2.Id}
		_, resp, err := client.GetChannelsMemberCount(context.Background(), channelIDs)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("Should not fail for public channels that the user is not a member of", func(t *testing.T) {
		th.LoginBasic2(t)
		channelIDs := []string{channel1.Id}
		_, _, err := client.GetChannelsMemberCount(context.Background(), channelIDs)
		require.NoError(t, err)
	})

	t.Run("Should fail for private channels that the user is not a member of", func(t *testing.T) {
		th.LoginBasic2(t)
		channelIDs := []string{channel2.Id}
		_, _, err := client.GetChannelsMemberCount(context.Background(), channelIDs)
		require.Error(t, err)
	})
}

func TestMoveChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	team1 := th.BasicTeam
	team2 := th.CreateTeam(t)

	t.Run("Should move channel", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		ch, _, err := th.SystemAdminClient.MoveChannel(context.Background(), publicChannel.Id, team2.Id, false)
		require.NoError(t, err)
		require.Equal(t, team2.Id, ch.TeamId)
	})

	t.Run("Should return custom error with repeated channel", func(t *testing.T) {
		channelT1 := &model.Channel{
			DisplayName: "repeated",
			Name:        "repeated",
			Type:        model.ChannelTypePrivate,
			TeamId:      team1.Id,
		}
		channelT1, _, err := th.Client.CreateChannel(context.Background(), channelT1)
		require.NoError(t, err)

		channelT2 := &model.Channel{
			DisplayName: "repeated",
			Name:        "repeated",
			Type:        model.ChannelTypePrivate,
			TeamId:      team2.Id,
		}
		_, _, err = th.Client.CreateChannel(context.Background(), channelT2)
		require.NoError(t, err)

		_, _, err = th.SystemAdminClient.MoveChannel(context.Background(), channelT1.Id, team2.Id, false)
		require.EqualError(t, err, "A channel with that name already exists on the same team.")
	})

	t.Run("Should move private channel", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t)
		ch, _, err := th.SystemAdminClient.MoveChannel(context.Background(), channel.Id, team1.Id, false)
		require.NoError(t, err)
		require.Equal(t, team1.Id, ch.TeamId)
	})

	t.Run("Should fail when trying to move a DM channel", func(t *testing.T) {
		user := th.CreateUser(t)
		dmChannel := th.CreateDmChannel(t, user)
		_, _, err := client.MoveChannel(context.Background(), dmChannel.Id, team1.Id, false)
		require.Error(t, err)
		CheckErrorID(t, err, "api.channel.move_channel.type.invalid")
	})

	t.Run("Should fail when trying to move a group channel", func(t *testing.T) {
		user := th.CreateUser(t)

		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, th.TeamAdminUser.Id}, user.Id)
		require.Nil(t, appErr)
		_, _, err := client.MoveChannel(context.Background(), gmChannel.Id, team1.Id, false)
		require.Error(t, err)
		CheckErrorID(t, err, "api.channel.move_channel.type.invalid")
	})

	t.Run("Should fail due to permissions", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		_, _, err := client.MoveChannel(context.Background(), publicChannel.Id, team1.Id, false)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		publicChannel := th.CreatePublicChannel(t)
		user := th.BasicUser

		_, err := client.RemoveTeamMember(context.Background(), team2.Id, user.Id)
		require.NoError(t, err)

		_, _, err = client.AddChannelMember(context.Background(), publicChannel.Id, user.Id)
		require.NoError(t, err)

		_, _, err = client.MoveChannel(context.Background(), publicChannel.Id, team2.Id, false)
		require.Error(t, err)
		CheckErrorID(t, err, "app.channel.move_channel.members_do_not_match.error")
	}, "Should fail to move public channel due to a member not member of target team")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		privateChannel := th.CreatePrivateChannel(t)
		user := th.BasicUser

		_, err := client.RemoveTeamMember(context.Background(), team2.Id, user.Id)
		require.NoError(t, err)

		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user.Id)
		require.NoError(t, err)

		_, _, err = client.MoveChannel(context.Background(), privateChannel.Id, team2.Id, false)
		require.Error(t, err)
		CheckErrorID(t, err, "app.channel.move_channel.members_do_not_match.error")
	}, "Should fail to move private channel due to a member not member of target team")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		publicChannel := th.CreatePublicChannel(t)
		user := th.BasicUser

		_, err := client.RemoveTeamMember(context.Background(), team2.Id, user.Id)
		require.NoError(t, err)

		_, _, err = client.AddChannelMember(context.Background(), publicChannel.Id, user.Id)
		require.NoError(t, err)

		newChannel, _, err := client.MoveChannel(context.Background(), publicChannel.Id, team2.Id, true)
		require.NoError(t, err)
		require.Equal(t, team2.Id, newChannel.TeamId)
	}, "Should be able to (force) move public channel by a member that is not member of target team")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		privateChannel := th.CreatePrivateChannel(t)
		user := th.BasicUser

		_, err := client.RemoveTeamMember(context.Background(), team2.Id, user.Id)
		require.NoError(t, err)

		_, _, err = client.AddChannelMember(context.Background(), privateChannel.Id, user.Id)
		require.NoError(t, err)

		newChannel, _, err := client.MoveChannel(context.Background(), privateChannel.Id, team2.Id, true)
		require.NoError(t, err)
		require.Equal(t, team2.Id, newChannel.TeamId)
	}, "Should be able to (force) move private channel by a member that is not member of target team")
}

func TestRootMentionsCount(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	user := th.BasicUser
	channel := th.BasicChannel

	// initially, MentionCountRoot is 0 in the database
	channelMember, err := th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, user.Id)
	require.NoError(t, err)
	require.Equal(t, int64(0), channelMember.MentionCountRoot)
	require.Equal(t, int64(0), channelMember.MentionCount)

	// mention the user in a root post
	post1, _, err := th.SystemAdminClient.CreatePost(context.Background(), &model.Post{ChannelId: channel.Id, Message: "hey @" + user.Username})
	require.NoError(t, err)
	// mention the user in a reply post
	post2 := &model.Post{ChannelId: channel.Id, Message: "reply at @" + user.Username, RootId: post1.Id}
	_, _, err = th.SystemAdminClient.CreatePost(context.Background(), post2)
	require.NoError(t, err)

	// this should perform lazy migration and populate the field
	channelUnread, _, err := client.GetChannelUnread(context.Background(), channel.Id, user.Id)
	require.NoError(t, err)
	// reply post is not counted, so we should have one root mention
	require.EqualValues(t, int64(1), channelUnread.MentionCountRoot)
	// regular count stays the same
	require.Equal(t, int64(2), channelUnread.MentionCount)
	// validate that DB is updated
	channelMember, err = th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, user.Id)
	require.NoError(t, err)
	require.EqualValues(t, int64(1), channelMember.MentionCountRoot)

	// validate that Team level counts are calculated
	counts, appErr := th.App.GetTeamUnread(channel.TeamId, user.Id)
	require.Nil(t, appErr)
	require.Equal(t, int64(1), counts.MentionCountRoot)
	require.Equal(t, int64(2), counts.MentionCount)
}

func TestViewChannelWithoutCollapsedThreads(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	client := th.Client
	user := th.BasicUser
	team := th.BasicTeam
	channel := th.BasicChannel

	// mention the user in a root post
	post1, _, err := th.SystemAdminClient.CreatePost(context.Background(), &model.Post{ChannelId: channel.Id, Message: "hey @" + user.Username})
	require.NoError(t, err)
	// mention the user in a reply post
	post2 := &model.Post{ChannelId: channel.Id, Message: "reply at @" + user.Username, RootId: post1.Id}
	_, _, err = th.SystemAdminClient.CreatePost(context.Background(), post2)
	require.NoError(t, err)

	threads, _, err := client.GetUserThreads(context.Background(), user.Id, team.Id, model.GetUserThreadsOpts{})
	require.NoError(t, err)
	require.EqualValues(t, int64(1), threads.TotalUnreadMentions)

	// simulate opening the channel from an old client
	_, _, err = client.ViewChannel(context.Background(), user.Id, &model.ChannelView{
		ChannelId:                 channel.Id,
		PrevChannelId:             "",
		CollapsedThreadsSupported: false,
	})
	require.NoError(t, err)

	threads, _, err = client.GetUserThreads(context.Background(), user.Id, team.Id, model.GetUserThreadsOpts{})
	require.NoError(t, err)
	require.Zero(t, threads.TotalUnreadMentions)
}

func TestChannelMemberSanitization(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	user := th.BasicUser
	user2 := th.BasicUser2
	channel := th.CreatePublicChannel(t)

	// Add second user to channel
	_, _, err := client.AddChannelMember(context.Background(), channel.Id, user2.Id)
	require.NoError(t, err)

	t.Run("getChannelMembers sanitizes LastViewedAt and LastUpdateAt for other users", func(t *testing.T) {
		members, _, err := client.GetChannelMembers(context.Background(), channel.Id, 0, 60, "")
		require.NoError(t, err)

		for _, member := range members {
			if member.UserId == user.Id {
				// Current user should see their own timestamps
				assert.NotEqual(t, int64(-1), member.LastViewedAt, "Current user should see their LastViewedAt")
				assert.NotEqual(t, int64(-1), member.LastUpdateAt, "Current user should see their LastUpdateAt")
			} else {
				// Other users' timestamps should be sanitized
				assert.Equal(t, int64(-1), member.LastViewedAt, "Other users' LastViewedAt should be sanitized")
				assert.Equal(t, int64(-1), member.LastUpdateAt, "Other users' LastUpdateAt should be sanitized")
			}
		}
	})

	t.Run("getChannelMember sanitizes LastViewedAt and LastUpdateAt for other users", func(t *testing.T) {
		// Get other user's membership data
		member, _, err := client.GetChannelMember(context.Background(), channel.Id, user2.Id, "")
		require.NoError(t, err)

		// Should be sanitized since it's not the current user
		assert.Equal(t, int64(-1), member.LastViewedAt, "Other user's LastViewedAt should be sanitized")
		assert.Equal(t, int64(-1), member.LastUpdateAt, "Other user's LastUpdateAt should be sanitized")

		// Get current user's membership data
		currentMember, _, err := client.GetChannelMember(context.Background(), channel.Id, user.Id, "")
		require.NoError(t, err)

		// Should not be sanitized since it's the current user
		assert.NotEqual(t, int64(-1), currentMember.LastViewedAt, "Current user should see their LastViewedAt")
		assert.NotEqual(t, int64(-1), currentMember.LastUpdateAt, "Current user should see their LastUpdateAt")
	})

	t.Run("getChannelMembersByIds sanitizes data appropriately", func(t *testing.T) {
		userIds := []string{user.Id, user2.Id}
		members, _, err := client.GetChannelMembersByIds(context.Background(), channel.Id, userIds)
		require.NoError(t, err)
		require.Len(t, members, 2)

		for _, member := range members {
			if member.UserId == user.Id {
				// Current user should see their own timestamps
				assert.NotEqual(t, int64(-1), member.LastViewedAt, "Current user should see their LastViewedAt")
				assert.NotEqual(t, int64(-1), member.LastUpdateAt, "Current user should see their LastUpdateAt")
			} else {
				// Other users' timestamps should be sanitized
				assert.Equal(t, int64(-1), member.LastViewedAt, "Other users' LastViewedAt should be sanitized")
				assert.Equal(t, int64(-1), member.LastUpdateAt, "Other users' LastUpdateAt should be sanitized")
			}
		}
	})

	t.Run("addChannelMember sanitizes returned member data", func(t *testing.T) {
		newUser := th.CreateUser(t)
		th.LinkUserToTeam(t, newUser, th.BasicTeam)

		// Add new user and check returned member data
		returnedMember, _, err := client.AddChannelMember(context.Background(), channel.Id, newUser.Id)
		require.NoError(t, err)

		// The returned member should be sanitized since it's not the current user
		assert.Equal(t, int64(-1), returnedMember.LastViewedAt, "Returned member LastViewedAt should be sanitized")
		assert.Equal(t, int64(-1), returnedMember.LastUpdateAt, "Returned member LastUpdateAt should be sanitized")
		assert.Equal(t, newUser.Id, returnedMember.UserId, "UserId should be preserved")
		assert.Equal(t, channel.Id, returnedMember.ChannelId, "ChannelId should be preserved")
	})
}
