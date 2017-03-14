// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestCreateChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	team := th.BasicTeam

	channel := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.CHANNEL_OPEN, TeamId: team.Id}
	private := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.CHANNEL_PRIVATE, TeamId: team.Id}

	rchannel, resp := Client.CreateChannel(channel)
	CheckNoError(t, resp)

	if rchannel.Name != channel.Name {
		t.Fatal("names did not match")
	}

	if rchannel.DisplayName != channel.DisplayName {
		t.Fatal("display names did not match")
	}

	if rchannel.TeamId != channel.TeamId {
		t.Fatal("team ids did not match")
	}

	rprivate, resp := Client.CreateChannel(private)
	CheckNoError(t, resp)

	if rprivate.Name != private.Name {
		t.Fatal("names did not match")
	}

	if rprivate.Type != model.CHANNEL_PRIVATE {
		t.Fatal("wrong channel type")
	}

	if rprivate.CreatorId != th.BasicUser.Id {
		t.Fatal("wrong creator id")
	}

	_, resp = Client.CreateChannel(channel)
	CheckErrorMessage(t, resp, "store.sql_channel.save_channel.exists.app_error")
	CheckBadRequestStatus(t, resp)

	direct := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.CHANNEL_DIRECT, TeamId: team.Id}
	_, resp = Client.CreateChannel(direct)
	CheckErrorMessage(t, resp, "api.channel.create_channel.direct_channel.app_error")
	CheckBadRequestStatus(t, resp)

	Client.Logout()
	_, resp = Client.CreateChannel(channel)
	CheckUnauthorizedStatus(t, resp)

	userNotOnTeam := th.CreateUser()
	Client.Login(userNotOnTeam.Email, userNotOnTeam.Password)

	_, resp = Client.CreateChannel(channel)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.CreateChannel(private)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	// Check permissions with policy config changes
	isLicensed := utils.IsLicensed
	license := utils.License
	restrictPublicChannel := *utils.Cfg.TeamSettings.RestrictPublicChannelCreation
	restrictPrivateChannel := *utils.Cfg.TeamSettings.RestrictPrivateChannelCreation
	defer func() {
		*utils.Cfg.TeamSettings.RestrictPublicChannelCreation = restrictPublicChannel
		*utils.Cfg.TeamSettings.RestrictPrivateChannelCreation = restrictPrivateChannel
		utils.IsLicensed = isLicensed
		utils.License = license
		utils.SetDefaultRolesBasedOnConfig()
	}()
	*utils.Cfg.TeamSettings.RestrictPublicChannelCreation = model.PERMISSIONS_ALL
	*utils.Cfg.TeamSettings.RestrictPrivateChannelCreation = model.PERMISSIONS_ALL
	utils.SetDefaultRolesBasedOnConfig()
	utils.IsLicensed = true
	utils.License = &model.License{Features: &model.Features{}}
	utils.License.Features.SetDefaults()

	channel.Name = GenerateTestChannelName()
	_, resp = Client.CreateChannel(channel)
	CheckNoError(t, resp)

	private.Name = GenerateTestChannelName()
	_, resp = Client.CreateChannel(private)
	CheckNoError(t, resp)

	*utils.Cfg.TeamSettings.RestrictPublicChannelCreation = model.PERMISSIONS_TEAM_ADMIN
	*utils.Cfg.TeamSettings.RestrictPrivateChannelCreation = model.PERMISSIONS_TEAM_ADMIN
	utils.SetDefaultRolesBasedOnConfig()

	_, resp = Client.CreateChannel(channel)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.CreateChannel(private)
	CheckForbiddenStatus(t, resp)

	th.LoginTeamAdmin()

	channel.Name = GenerateTestChannelName()
	_, resp = Client.CreateChannel(channel)
	CheckNoError(t, resp)

	private.Name = GenerateTestChannelName()
	_, resp = Client.CreateChannel(private)
	CheckNoError(t, resp)

	channel.Name = GenerateTestChannelName()
	_, resp = th.SystemAdminClient.CreateChannel(channel)
	CheckNoError(t, resp)

	private.Name = GenerateTestChannelName()
	_, resp = th.SystemAdminClient.CreateChannel(private)
	CheckNoError(t, resp)

	*utils.Cfg.TeamSettings.RestrictPublicChannelCreation = model.PERMISSIONS_SYSTEM_ADMIN
	*utils.Cfg.TeamSettings.RestrictPrivateChannelCreation = model.PERMISSIONS_SYSTEM_ADMIN
	utils.SetDefaultRolesBasedOnConfig()

	th.LoginBasic()

	_, resp = Client.CreateChannel(channel)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.CreateChannel(private)
	CheckForbiddenStatus(t, resp)

	th.LoginTeamAdmin()

	_, resp = Client.CreateChannel(channel)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.CreateChannel(private)
	CheckForbiddenStatus(t, resp)

	channel.Name = GenerateTestChannelName()
	_, resp = th.SystemAdminClient.CreateChannel(channel)
	CheckNoError(t, resp)

	private.Name = GenerateTestChannelName()
	_, resp = th.SystemAdminClient.CreateChannel(private)
	CheckNoError(t, resp)

	if r, err := Client.DoApiPost("/channels", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}
}

func TestUpdateChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	team := th.BasicTeam

	channel := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.CHANNEL_OPEN, TeamId: team.Id}
	private := &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.CHANNEL_PRIVATE, TeamId: team.Id}

	channel, resp := Client.CreateChannel(channel)
	private, resp = Client.CreateChannel(private)

	//Update a open channel
	channel.DisplayName = "My new display name"
	channel.Header = "My fancy header"
	channel.Purpose = "Mattermost ftw!"

	newChannel, resp := Client.UpdateChannel(channel)
	CheckNoError(t, resp)

	if newChannel.DisplayName != channel.DisplayName {
		t.Fatal("Update failed for DisplayName")
	}

	if newChannel.Header != channel.Header {
		t.Fatal("Update failed for Header")
	}

	if newChannel.Purpose != channel.Purpose {
		t.Fatal("Update failed for Purpose")
	}

	//Update a private channel
	private.DisplayName = "My new display name for private channel"
	private.Header = "My fancy private header"
	private.Purpose = "Mattermost ftw! in private mode"

	newPrivateChannel, resp := Client.UpdateChannel(private)
	CheckNoError(t, resp)

	if newPrivateChannel.DisplayName != private.DisplayName {
		t.Fatal("Update failed for DisplayName in private channel")
	}

	if newPrivateChannel.Header != private.Header {
		t.Fatal("Update failed for Header in private channel")
	}

	if newPrivateChannel.Purpose != private.Purpose {
		t.Fatal("Update failed for Purpose in private channel")
	}

	//Non existing channel
	channel1 := &model.Channel{DisplayName: "Test API Name for apiv4", Name: GenerateTestChannelName(), Type: model.CHANNEL_OPEN, TeamId: team.Id}
	_, resp = Client.UpdateChannel(channel1)
	CheckNotFoundStatus(t, resp)

	//Try to update with not logged user
	Client.Logout()
	_, resp = Client.UpdateChannel(channel)
	CheckUnauthorizedStatus(t, resp)

	//Try to update using another user
	user := th.CreateUser()
	Client.Login(user.Email, user.Password)

	channel.DisplayName = "Should not update"
	_, resp = Client.UpdateChannel(channel)
	CheckNotFoundStatus(t, resp)

}

func TestCreateDirectChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()

	dm, resp := Client.CreateDirectChannel(user1.Id, user2.Id)
	CheckNoError(t, resp)

	channelName := ""
	if user2.Id > user1.Id {
		channelName = user1.Id + "__" + user2.Id
	} else {
		channelName = user2.Id + "__" + user1.Id
	}

	if dm.Name != channelName {
		t.Fatal("dm name didn't match")
	}

	_, resp = Client.CreateDirectChannel("junk", user2.Id)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.CreateDirectChannel(user1.Id, model.NewId())
	CheckBadRequestStatus(t, resp)

	_, resp = Client.CreateDirectChannel(model.NewId(), user1.Id)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.CreateDirectChannel(model.NewId(), user2.Id)
	CheckForbiddenStatus(t, resp)

	if r, err := Client.DoApiPost("/channels/direct", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()
	_, resp = Client.CreateDirectChannel(model.NewId(), user2.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.CreateDirectChannel(user3.Id, user2.Id)
	CheckNoError(t, resp)
}

func TestGetChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	channel, resp := Client.GetChannel(th.BasicChannel.Id, "")
	CheckNoError(t, resp)

	if channel.Id != th.BasicChannel.Id {
		t.Fatal("ids did not match")
	}

	_, resp = Client.GetChannel(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetChannel(th.BasicChannel.Id, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetChannel(th.BasicChannel.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetChannel(th.BasicChannel.Id, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetChannel(th.BasicUser.Id, "")
	CheckNotFoundStatus(t, resp)
}

func TestGetPublicChannelsForTeam(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	team := th.BasicTeam
	publicChannel1 := th.BasicChannel
	publicChannel2 := th.BasicChannel2

	channels, resp := Client.GetPublicChannelsForTeam(team.Id, 0, 100, "")
	CheckNoError(t, resp)
	if len(*channels) != 4 {
		t.Fatal("wrong length")
	}

	for i, c := range *channels {
		if c.Type != model.CHANNEL_OPEN {
			t.Fatal("should include open channel only")
		}

		// only check the created 2 public channels
		if i < 2 && !(c.DisplayName == publicChannel1.DisplayName || c.DisplayName == publicChannel2.DisplayName) {
			t.Logf("channel %v: %v", i, c.DisplayName)
			t.Fatal("should match public channel display name only")
		}
	}

	privateChannel := th.CreatePrivateChannel()
	channels, resp = Client.GetPublicChannelsForTeam(team.Id, 0, 100, "")
	CheckNoError(t, resp)
	if len(*channels) != 4 {
		t.Fatal("wrong length")
	}

	for _, c := range *channels {
		if c.Type != model.CHANNEL_OPEN {
			t.Fatal("should not include private channel")
		}

		if c.DisplayName == privateChannel.DisplayName {
			t.Fatal("should not match private channel display name")
		}
	}

	channels, resp = Client.GetPublicChannelsForTeam(team.Id, 0, 1, "")
	CheckNoError(t, resp)
	if len(*channels) != 1 {
		t.Fatal("should be one channel per page")
	}

	channels, resp = Client.GetPublicChannelsForTeam(team.Id, 1, 1, "")
	CheckNoError(t, resp)
	if len(*channels) != 1 {
		t.Fatal("should be one channel per page")
	}

	channels, resp = Client.GetPublicChannelsForTeam(team.Id, 10000, 100, "")
	CheckNoError(t, resp)
	if len(*channels) != 0 {
		t.Fatal("should be no channel")
	}

	_, resp = Client.GetPublicChannelsForTeam("junk", 0, 100, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPublicChannelsForTeam(model.NewId(), 0, 100, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPublicChannelsForTeam(team.Id, 0, 100, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetPublicChannelsForTeam(team.Id, 0, 100, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetPublicChannelsForTeam(team.Id, 0, 100, "")
	CheckNoError(t, resp)
}

func TestDeleteChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	team := th.BasicTeam
	user := th.BasicUser
	user2 := th.BasicUser2

	// successful delete of public channel
	publicChannel1 := th.CreatePublicChannel()
	pass, resp := Client.DeleteChannel(publicChannel1.Id)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	if ch, err := app.GetChannel(publicChannel1.Id); err == nil && ch.DeleteAt == 0 {
		t.Fatal("should have failed to get deleted channel")
	} else if err := app.JoinChannel(ch, user2.Id); err == nil {
		t.Fatal("should have failed to join deleted channel")
	}

	post1 := &model.Post{ChannelId: publicChannel1.Id, Message: "a" + GenerateTestId() + "a"}
	if _, err := Client.CreatePost(post1); err == nil {
		t.Fatal("should have failed to post to deleted channel")
	}

	// successful delete of private channel
	privateChannel2 := th.CreatePrivateChannel()
	_, resp = Client.DeleteChannel(privateChannel2.Id)
	CheckNoError(t, resp)

	// successful delete of channel with multiple members
	publicChannel3 := th.CreatePublicChannel()
	app.AddUserToChannel(user2, publicChannel3)
	_, resp = Client.DeleteChannel(publicChannel3.Id)
	CheckNoError(t, resp)

	// successful delete by TeamAdmin of channel created by user
	publicChannel4 := th.CreatePublicChannel()
	th.LoginTeamAdmin()
	_, resp = Client.DeleteChannel(publicChannel4.Id)
	CheckNoError(t, resp)

	// default channel cannot be deleted.
	defaultChannel, _ := app.GetChannelByName(model.DEFAULT_CHANNEL, team.Id)
	pass, resp = Client.DeleteChannel(defaultChannel.Id)
	CheckBadRequestStatus(t, resp)

	if pass {
		t.Fatal("should have failed")
	}

	th.LoginBasic()
	publicChannel5 := th.CreatePublicChannel()
	Client.Logout()

	Client.Login(user2.Id, user2.Password)
	_, resp = Client.DeleteChannel(publicChannel5.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.DeleteChannel("junk")
	CheckUnauthorizedStatus(t, resp)

	Client.Logout()
	_, resp = Client.DeleteChannel(GenerateTestId())
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.DeleteChannel(publicChannel5.Id)
	CheckNoError(t, resp)

	isLicensed := utils.IsLicensed
	license := utils.License
	restrictPublicChannel := *utils.Cfg.TeamSettings.RestrictPublicChannelManagement
	restrictPrivateChannel := *utils.Cfg.TeamSettings.RestrictPrivateChannelManagement
	defer func() {
		*utils.Cfg.TeamSettings.RestrictPublicChannelManagement = restrictPublicChannel
		*utils.Cfg.TeamSettings.RestrictPrivateChannelManagement = restrictPrivateChannel
		utils.IsLicensed = isLicensed
		utils.License = license
		utils.SetDefaultRolesBasedOnConfig()
	}()
	*utils.Cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_ALL
	*utils.Cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_ALL
	utils.IsLicensed = true
	utils.License = &model.License{Features: &model.Features{}}
	utils.License.Features.SetDefaults()
	utils.SetDefaultRolesBasedOnConfig()

	th = Setup().InitBasic().InitSystemAdmin()
	Client = th.Client
	team = th.BasicTeam
	user = th.BasicUser

	// channels created by SystemAdmin
	publicChannel6 := th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_OPEN)
	privateChannel7 := th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)
	app.AddUserToChannel(user, publicChannel6)
	app.AddUserToChannel(user, privateChannel7)

	// successful delete by user
	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckNoError(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckNoError(t, resp)

	*utils.Cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_CHANNEL_ADMIN
	*utils.Cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_CHANNEL_ADMIN
	utils.SetDefaultRolesBasedOnConfig()

	// channels created by SystemAdmin
	publicChannel6 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_OPEN)
	privateChannel7 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)
	app.AddUserToChannel(user, publicChannel6)
	app.AddUserToChannel(user, privateChannel7)

	// cannot delete by user
	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckForbiddenStatus(t, resp)

	// successful delete by channel admin
	MakeUserChannelAdmin(user, publicChannel6)
	MakeUserChannelAdmin(user, privateChannel7)
	store.ClearChannelCaches()

	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckNoError(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckNoError(t, resp)

	// // channels created by SystemAdmin
	publicChannel6 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_OPEN)
	privateChannel7 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)
	app.AddUserToChannel(user, publicChannel6)
	app.AddUserToChannel(user, privateChannel7)

	// successful delete by team admin
	UpdateUserToTeamAdmin(user, team)
	app.InvalidateAllCaches()

	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckNoError(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckNoError(t, resp)

	*utils.Cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_TEAM_ADMIN
	*utils.Cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_TEAM_ADMIN
	utils.SetDefaultRolesBasedOnConfig()
	UpdateUserToNonTeamAdmin(user, team)
	app.InvalidateAllCaches()

	// channels created by SystemAdmin
	publicChannel6 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_OPEN)
	privateChannel7 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)
	app.AddUserToChannel(user, publicChannel6)
	app.AddUserToChannel(user, privateChannel7)

	// cannot delete by user
	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckForbiddenStatus(t, resp)

	// // cannot delete by channel admin
	MakeUserChannelAdmin(user, publicChannel6)
	MakeUserChannelAdmin(user, privateChannel7)
	store.ClearChannelCaches()

	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckForbiddenStatus(t, resp)

	// successful delete by team admin
	UpdateUserToTeamAdmin(th.BasicUser, team)
	app.InvalidateAllCaches()

	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckNoError(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckNoError(t, resp)

	*utils.Cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_SYSTEM_ADMIN
	*utils.Cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_SYSTEM_ADMIN
	utils.SetDefaultRolesBasedOnConfig()

	// channels created by SystemAdmin
	publicChannel6 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_OPEN)
	privateChannel7 = th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)
	app.AddUserToChannel(user, publicChannel6)
	app.AddUserToChannel(user, privateChannel7)

	// cannot delete by user
	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckForbiddenStatus(t, resp)

	// cannot delete by channel admin
	MakeUserChannelAdmin(user, publicChannel6)
	MakeUserChannelAdmin(user, privateChannel7)
	store.ClearChannelCaches()

	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckForbiddenStatus(t, resp)

	// cannot delete by team admin
	UpdateUserToTeamAdmin(th.BasicUser, team)
	app.InvalidateAllCaches()

	_, resp = Client.DeleteChannel(publicChannel6.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteChannel(privateChannel7.Id)
	CheckForbiddenStatus(t, resp)

	// successful delete by SystemAdmin
	_, resp = th.SystemAdminClient.DeleteChannel(publicChannel6.Id)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.DeleteChannel(privateChannel7.Id)
	CheckNoError(t, resp)
}

func TestGetChannelByName(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	channel, resp := Client.GetChannelByName(th.BasicChannel.Name, th.BasicTeam.Id, "")
	CheckNoError(t, resp)

	if channel.Name != th.BasicChannel.Name {
		t.Fatal("names did not match")
	}

	_, resp = Client.GetChannelByName(GenerateTestChannelName(), th.BasicTeam.Id, "")
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetChannelByName(th.BasicChannel.Name, th.BasicTeam.Id, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetChannelByName(th.BasicChannel.Name, th.BasicTeam.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetChannelByName(th.BasicChannel.Name, th.BasicTeam.Id, "")
	CheckNoError(t, resp)
}

func TestGetChannelByNameForTeamName(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	channel, resp := th.SystemAdminClient.GetChannelByNameForTeamName(th.BasicChannel.Name, th.BasicTeam.Name, "")
	CheckNoError(t, resp)

	if channel.Name != th.BasicChannel.Name {
		t.Fatal("names did not match")
	}

	_, resp = Client.GetChannelByNameForTeamName(th.BasicChannel.Name, th.BasicTeam.Name, "")
	CheckNoError(t, resp)

	_, resp = Client.GetChannelByNameForTeamName(th.BasicChannel.Name, model.NewRandomString(15), "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetChannelByNameForTeamName(GenerateTestChannelName(), th.BasicTeam.Name, "")
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetChannelByNameForTeamName(th.BasicChannel.Name, th.BasicTeam.Name, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetChannelByNameForTeamName(th.BasicChannel.Name, th.BasicTeam.Name, "")
	CheckForbiddenStatus(t, resp)
}

func TestGetChannelMembers(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	members, resp := Client.GetChannelMembers(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)

	if len(*members) != 3 {
		t.Fatal("should only be 3 users in channel")
	}

	members, resp = Client.GetChannelMembers(th.BasicChannel.Id, 0, 2, "")
	CheckNoError(t, resp)

	if len(*members) != 2 {
		t.Fatal("should only be 2 users")
	}

	members, resp = Client.GetChannelMembers(th.BasicChannel.Id, 1, 1, "")
	CheckNoError(t, resp)

	if len(*members) != 1 {
		t.Fatal("should only be 1 user")
	}

	members, resp = Client.GetChannelMembers(th.BasicChannel.Id, 1000, 100000, "")
	CheckNoError(t, resp)

	if len(*members) != 0 {
		t.Fatal("should be 0 users")
	}

	_, resp = Client.GetChannelMembers("", 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.GetChannelMembers("junk", 0, 60, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetChannelMembers(model.NewId(), 0, 60, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetChannelMembers(th.BasicChannel.Id, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetChannelMembers(th.BasicChannel.Id, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetChannelMembers(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetChannelMember(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	member, resp := Client.GetChannelMember(th.BasicChannel.Id, th.BasicUser.Id, "")
	CheckNoError(t, resp)

	if member.ChannelId != th.BasicChannel.Id {
		t.Fatal("wrong channel id")
	}

	if member.UserId != th.BasicUser.Id {
		t.Fatal("wrong user id")
	}

	_, resp = Client.GetChannelMember("", th.BasicUser.Id, "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetChannelMember("junk", th.BasicUser.Id, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetChannelMember(model.NewId(), th.BasicUser.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetChannelMember(th.BasicChannel.Id, "", "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetChannelMember(th.BasicChannel.Id, "junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetChannelMember(th.BasicChannel.Id, model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetChannelMember(th.BasicChannel.Id, th.BasicUser.Id, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetChannelMember(th.BasicChannel.Id, th.BasicUser.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetChannelMember(th.BasicChannel.Id, th.BasicUser.Id, "")
	CheckNoError(t, resp)
}

func TestGetChannelMembersForUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	members, resp := Client.GetChannelMembersForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
	CheckNoError(t, resp)

	if len(*members) != 4 {
		t.Fatal("should have 4 members on team")
	}

	_, resp = Client.GetChannelMembersForUser("", th.BasicTeam.Id, "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetChannelMembersForUser("junk", th.BasicTeam.Id, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetChannelMembersForUser(model.NewId(), th.BasicTeam.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetChannelMembersForUser(th.BasicUser.Id, "", "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetChannelMembersForUser(th.BasicUser.Id, "junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetChannelMembersForUser(th.BasicUser.Id, model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetChannelMembersForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetChannelMembersForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetChannelMembersForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
	CheckNoError(t, resp)
}

func TestViewChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	view := &model.ChannelView{
		ChannelId: th.BasicChannel.Id,
	}

	pass, resp := Client.ViewChannel(th.BasicUser.Id, view)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	view.PrevChannelId = th.BasicChannel.Id
	_, resp = Client.ViewChannel(th.BasicUser.Id, view)
	CheckNoError(t, resp)

	view.PrevChannelId = ""
	_, resp = Client.ViewChannel(th.BasicUser.Id, view)
	CheckNoError(t, resp)

	view.PrevChannelId = "junk"
	_, resp = Client.ViewChannel(th.BasicUser.Id, view)
	CheckNoError(t, resp)

	member, resp := Client.GetChannelMember(th.BasicChannel.Id, th.BasicUser.Id, "")
	CheckNoError(t, resp)
	channel, resp := Client.GetChannel(th.BasicChannel.Id, "")
	CheckNoError(t, resp)

	if member.MsgCount != channel.TotalMsgCount {
		t.Fatal("should match message counts")
	}

	if member.MentionCount != 0 {
		t.Fatal("should have no mentions")
	}

	_, resp = Client.ViewChannel("junk", view)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ViewChannel(th.BasicUser2.Id, view)
	CheckForbiddenStatus(t, resp)

	if r, err := Client.DoApiPost(fmt.Sprintf("/channels/members/%v/view", th.BasicUser.Id), "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()
	_, resp = Client.ViewChannel(th.BasicUser.Id, view)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.ViewChannel(th.BasicUser.Id, view)
	CheckNoError(t, resp)
}

func TestUpdateChannelRoles(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	const CHANNEL_ADMIN = "channel_admin channel_user"
	const CHANNEL_MEMBER = "channel_user"

	// User 1 creates a channel, making them channel admin by default.
	channel := th.CreatePublicChannel()

	// Adds User 2 to the channel, making them a channel member by default.
	app.AddUserToChannel(th.BasicUser2, channel)

	// User 1 promotes User 2
	pass, resp := Client.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_ADMIN)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	member, resp := Client.GetChannelMember(channel.Id, th.BasicUser2.Id, "")
	CheckNoError(t, resp)

	if member.Roles != CHANNEL_ADMIN {
		t.Fatal("roles don't match")
	}

	// User 1 demotes User 2
	_, resp = Client.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_MEMBER)
	CheckNoError(t, resp)

	th.LoginBasic2()

	// User 2 cannot demote User 1
	_, resp = Client.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_MEMBER)
	CheckForbiddenStatus(t, resp)

	// User 2 cannot promote self
	_, resp = Client.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_ADMIN)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	// User 1 demotes self
	_, resp = Client.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_MEMBER)
	CheckNoError(t, resp)

	// System Admin promotes User 1
	_, resp = th.SystemAdminClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_ADMIN)
	CheckNoError(t, resp)

	// System Admin demotes User 1
	_, resp = th.SystemAdminClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_MEMBER)
	CheckNoError(t, resp)

	// System Admin promotes User 1
	pass, resp = th.SystemAdminClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_ADMIN)
	CheckNoError(t, resp)

	th.LoginBasic()

	_, resp = Client.UpdateChannelRoles(channel.Id, th.BasicUser.Id, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateChannelRoles(channel.Id, "junk", CHANNEL_MEMBER)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateChannelRoles("junk", th.BasicUser.Id, CHANNEL_MEMBER)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateChannelRoles(channel.Id, model.NewId(), CHANNEL_MEMBER)
	CheckNotFoundStatus(t, resp)

	_, resp = Client.UpdateChannelRoles(model.NewId(), th.BasicUser.Id, CHANNEL_MEMBER)
	CheckForbiddenStatus(t, resp)
}

func TestRemoveChannelMember(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	pass, resp := Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser2.Id)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	_, resp = Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser2.Id)
	CheckNoError(t, resp)

	_, resp = Client.RemoveUserFromChannel(th.BasicChannel.Id, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.RemoveUserFromChannel(th.BasicChannel.Id, model.NewId())
	CheckNotFoundStatus(t, resp)

	th.LoginBasic2()
	_, resp = Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser.Id)
	CheckForbiddenStatus(t, resp)

	app.AddUserToChannel(th.BasicUser2, th.BasicChannel)
	_, resp = Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser2.Id)
	CheckNoError(t, resp)

	_, resp = Client.RemoveUserFromChannel(th.BasicChannel2.Id, th.BasicUser.Id)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser.Id)
	CheckNoError(t, resp)

	th.LoginBasic()
	private := th.CreatePrivateChannel()
	app.AddUserToChannel(th.BasicUser2, private)

	_, resp = Client.RemoveUserFromChannel(private.Id, th.BasicUser2.Id)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.RemoveUserFromChannel(private.Id, th.BasicUser.Id)
	CheckNoError(t, resp)
}
