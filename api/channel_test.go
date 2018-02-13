// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreateChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	SystemAdminClient := th.SystemAdminClient
	team := th.BasicTeam
	th.LoginBasic2()
	team2 := th.CreateTeam(th.BasicClient)
	th.LoginBasic()
	th.BasicClient.SetTeamId(team.Id)

	channel := model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	rchannel, err := Client.CreateChannel(&channel)
	if err != nil {
		t.Fatal(err)
	}

	if rchannel.Data.(*model.Channel).Name != channel.Name {
		t.Fatal("full name didn't match")
	}

	rget := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)
	nameMatch := false
	for _, c := range *rget {
		if c.Name == channel.Name {
			nameMatch = true
		}
	}

	if !nameMatch {
		t.Fatal("Did not create channel with correct name")
	}

	if _, err := Client.CreateChannel(rchannel.Data.(*model.Channel)); err == nil {
		t.Fatal("Cannot create an existing")
	}

	savedId := rchannel.Data.(*model.Channel).Id

	rchannel.Data.(*model.Channel).Id = ""
	if _, err := Client.CreateChannel(rchannel.Data.(*model.Channel)); err != nil {
		if err.Id != "store.sql_channel.save_channel.exists.app_error" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost(Client.GetTeamRoute()+"/channels/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}

	Client.DeleteChannel(savedId)
	if _, err := Client.CreateChannel(rchannel.Data.(*model.Channel)); err != nil {
		if err.Message != "A channel with that URL was previously created" {
			t.Fatal(err)
		}
	}

	channel = model.Channel{DisplayName: "Channel on Different Team", Name: "aaaa" + model.NewId() + "abbb", Type: model.CHANNEL_OPEN, TeamId: team2.Id}

	if _, err := Client.CreateChannel(&channel); err.StatusCode != http.StatusForbidden {
		t.Fatal(err)
	}

	channel = model.Channel{DisplayName: "Channel With No TeamId", Name: "aaaa" + model.NewId() + "abbb", Type: model.CHANNEL_OPEN, TeamId: ""}

	if _, err := Client.CreateChannel(&channel); err != nil {
		t.Fatal(err)
	}

	channel = model.Channel{DisplayName: "Test API Name", Name: model.NewId() + "__" + model.NewId(), Type: model.CHANNEL_OPEN, TeamId: team.Id}

	if _, err := Client.CreateChannel(&channel); err == nil {
		t.Fatal("Should have errored out on invalid '__' character")
	}

	channel = model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_DIRECT, TeamId: team.Id}

	if _, err := Client.CreateChannel(&channel); err == nil {
		t.Fatal("Should have errored out on direct channel type")
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	restrictPublicChannel := *th.App.Config().TeamSettings.RestrictPublicChannelManagement
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManagement
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = restrictPublicChannel })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = restrictPrivateChannel })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_ALL })
	th.App.SetDefaultRolesBasedOnConfig()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()

	channel2 := &model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel3 := &model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	if _, err := Client.CreateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.CreateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelCreation = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelCreation = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginBasic2()
	channel2.Name = "zz" + model.NewId() + "a"
	channel3.Name = "zz" + model.NewId() + "a"
	if _, err := Client.CreateChannel(channel2); err == nil {
		t.Fatal("should have errored not team admin")
	}
	if _, err := Client.CreateChannel(channel3); err == nil {
		t.Fatal("should have errored not team admin")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser, team)
	Client.Logout()
	th.LoginBasic()
	Client.SetTeamId(team.Id)

	if _, err := Client.CreateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.CreateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelCreation = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelCreation = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	channel2.Name = "zz" + model.NewId() + "a"
	channel3.Name = "zz" + model.NewId() + "a"
	if _, err := Client.CreateChannel(channel2); err == nil {
		t.Fatal("should have errored not system admin")
	}
	if _, err := Client.CreateChannel(channel3); err == nil {
		t.Fatal("should have errored not system admin")
	}

	th.LinkUserToTeam(th.SystemAdminUser, team)

	if _, err := SystemAdminClient.CreateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := SystemAdminClient.CreateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	// Check that if unlicensed the policy restriction is not enforced.
	utils.SetIsLicensed(false)
	utils.SetLicense(nil)
	th.App.SetDefaultRolesBasedOnConfig()

	channel4 := model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel5 := model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	if _, err := Client.CreateChannel(&channel4); err != nil {
		t.Fatal("should have succeeded")
	}
	if _, err := Client.CreateChannel(&channel5); err != nil {
		t.Fatal("should have succeeded")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelCreation = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelCreation = model.PERMISSIONS_ALL })
	th.App.SetDefaultRolesBasedOnConfig()
}

func TestCreateDirectChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user := th.BasicUser
	user2 := th.BasicUser2

	var channel *model.Channel
	if result, err := Client.CreateDirectChannel(th.BasicUser2.Id); err != nil {
		t.Fatal(err)
	} else {
		channel = result.Data.(*model.Channel)
	}

	channelName := ""
	if user2.Id > user.Id {
		channelName = user.Id + "__" + user2.Id
	} else {
		channelName = user2.Id + "__" + user.Id
	}

	if channel.Name != channelName {
		t.Fatal("channel name didn't match")
	}

	if channel.Type != model.CHANNEL_DIRECT {
		t.Fatal("channel type was not direct")
	}

	// Don't fail on direct channels already existing and return the original channel again
	if result, err := Client.CreateDirectChannel(th.BasicUser2.Id); err != nil {
		t.Fatal(err)
	} else if result.Data.(*model.Channel).Id != channel.Id {
		t.Fatal("didn't return original direct channel when saving a duplicate")
	}

	if _, err := Client.CreateDirectChannel("junk"); err == nil {
		t.Fatal("should have failed with bad user id")
	}

	if _, err := Client.CreateDirectChannel("12345678901234567890123456"); err == nil {
		t.Fatal("should have failed with non-existent user")
	}
}

func TestCreateGroupChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(Client)

	userIds := []string{user.Id, user2.Id, user3.Id}

	var channel *model.Channel
	if result, err := Client.CreateGroupChannel(userIds); err != nil {
		t.Fatal(err)
	} else {
		channel = result.Data.(*model.Channel)
	}

	if channel.Type != model.CHANNEL_GROUP {
		t.Fatal("channel type was not group")
	}

	// Don't fail on group channels already existing and return the original channel again
	if result, err := Client.CreateGroupChannel(userIds); err != nil {
		t.Fatal(err)
	} else if result.Data.(*model.Channel).Id != channel.Id {
		t.Fatal("didn't return original group channel when saving a duplicate")
	}

	if _, err := Client.CreateGroupChannel([]string{user.Id}); err == nil {
		t.Fatal("should have failed with not enough users")
	}

	if _, err := Client.CreateGroupChannel([]string{}); err == nil {
		t.Fatal("should have failed with not enough users")
	}

	if _, err := Client.CreateGroupChannel([]string{user.Id, user2.Id, user3.Id, "junk"}); err == nil {
		t.Fatal("should have failed with non-existent user")
	}
}

func TestUpdateChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	sysAdminUser := th.SystemAdminUser
	user := th.CreateUser(Client)
	th.LinkUserToTeam(user, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	Client.Login(user.Email, user.Password)

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	Client.AddChannelMember(channel1.Id, user.Id)

	header := "zz" + model.NewId() + "a"
	purpose := "zz" + model.NewId() + "a"
	upChannel1 := &model.Channel{Id: channel1.Id, Header: header, Purpose: purpose}
	upChannel1 = Client.Must(Client.UpdateChannel(upChannel1)).Data.(*model.Channel)

	if upChannel1.Header != header {
		t.Fatal("Channel admin failed to update header")
	}

	if upChannel1.Purpose != purpose {
		t.Fatal("Channel admin failed to update purpose")
	}

	if upChannel1.DisplayName != channel1.DisplayName {
		t.Fatal("Channel admin failed to skip displayName")
	}

	rget := Client.Must(Client.GetChannels(""))
	channels := rget.Data.(*model.ChannelList)
	for _, c := range *channels {
		if c.Name == model.DEFAULT_CHANNEL {
			c.Header = "new header"
			c.Name = "pseudo-square"
			if _, err := Client.UpdateChannel(c); err == nil {
				t.Fatal("should have errored on updating default channel name")
			}
			break
		}
	}

	Client.Login(user2.Email, user2.Password)

	if _, err := Client.UpdateChannel(upChannel1); err == nil {
		t.Fatal("Standard User should have failed to update")
	}

	Client.Must(Client.JoinChannel(channel1.Id))
	th.UpdateUserToTeamAdmin(user2, team)

	Client.Logout()
	Client.Login(user2.Email, user2.Password)
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateChannel(upChannel1); err != nil {
		t.Fatal(err)
	}

	Client.Login(sysAdminUser.Email, sysAdminUser.Password)
	th.LinkUserToTeam(sysAdminUser, team)
	Client.Must(Client.JoinChannel(channel1.Id))

	if _, err := Client.UpdateChannel(upChannel1); err != nil {
		t.Fatal(err)
	}

	Client.Must(Client.DeleteChannel(channel1.Id))

	if _, err := Client.UpdateChannel(upChannel1); err == nil {
		t.Fatal("should have failed - channel deleted")
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	restrictPublicChannel := *th.App.Config().TeamSettings.RestrictPublicChannelManagement
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManagement
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = restrictPublicChannel })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = restrictPrivateChannel })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_ALL })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel2 := th.CreateChannel(Client, team)
	channel3 := th.CreatePrivateChannel(Client, team)

	th.LinkUserToTeam(th.BasicUser, team)

	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.UpdateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_CHANNEL_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()
	th.MakeUserChannelUser(th.BasicUser, channel2)
	th.MakeUserChannelUser(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.UpdateChannel(channel2); err == nil {
		t.Fatal("should have errored not channel admin")
	}
	if _, err := Client.UpdateChannel(channel3); err == nil {
		t.Fatal("should have errored not channel admin")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser, team)
	th.App.InvalidateAllCaches()
	if _, err := Client.UpdateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannel(channel3); err != nil {
		t.Fatal(err)
	}
	th.UpdateUserToNonTeamAdmin(th.BasicUser, team)
	th.App.InvalidateAllCaches()

	th.MakeUserChannelAdmin(th.BasicUser, channel2)
	th.MakeUserChannelAdmin(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.UpdateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannel(channel2); err == nil {
		t.Fatal("should have errored not team admin")
	}
	if _, err := Client.UpdateChannel(channel3); err == nil {
		t.Fatal("should have errored not team admin")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser, team)
	Client.Logout()
	Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_SYSTEM_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannel(channel2); err == nil {
		t.Fatal("should have errored not system admin")
	}
	if _, err := Client.UpdateChannel(channel3); err == nil {
		t.Fatal("should have errored not system admin")
	}

	th.LoginSystemAdmin()

	if _, err := Client.UpdateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannel(channel3); err != nil {
		t.Fatal(err)
	}

	// Check that if unlicensed the policy restriction is not enforced.
	utils.SetIsLicensed(false)
	utils.SetLicense(nil)
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannel(channel2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannel(channel3); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateChannelDisplayName(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	user := th.CreateUser(Client)
	th.LinkUserToTeam(user, team)

	Client.Login(user.Email, user.Password)

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	Client.AddChannelMember(channel1.Id, user.Id)

	newDisplayName := "a" + channel1.DisplayName + "a"
	channel1.DisplayName = newDisplayName
	channel1 = Client.Must(Client.UpdateChannel(channel1)).Data.(*model.Channel)

	time.Sleep(100 * time.Millisecond)

	r1 := Client.Must(Client.GetPosts(channel1.Id, 0, 1, "")).Data.(*model.PostList)
	if len(r1.Order) != 1 {
		t.Fatal("Displayname update system message was not found")
	}
}

func TestUpdateChannelHeader(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	SystemAdminClient := th.SystemAdminClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	data := make(map[string]string)
	data["channel_id"] = channel1.Id
	data["channel_header"] = "new header"

	var upChannel1 *model.Channel
	if result, err := Client.UpdateChannelHeader(data); err != nil {
		t.Fatal(err)
	} else {
		upChannel1 = result.Data.(*model.Channel)
	}

	time.Sleep(100 * time.Millisecond)

	r1 := Client.Must(Client.GetPosts(channel1.Id, 0, 1, "")).Data.(*model.PostList)
	if len(r1.Order) != 1 {
		t.Fatal("Header update system message was not found")
	} else if val, ok := r1.Posts[r1.Order[0]].Props["old_header"]; !ok || val != "" {
		t.Fatal("Props should contain old_header with old header value")
	} else if val, ok := r1.Posts[r1.Order[0]].Props["new_header"]; !ok || val != "new header" {
		t.Fatal("Props should contain new_header with new header value")
	}

	if upChannel1.Header != data["channel_header"] {
		t.Fatal("Failed to update header")
	}

	data["channel_id"] = "junk"
	if _, err := Client.UpdateChannelHeader(data); err == nil {
		t.Fatal("should have errored on junk channel id")
	}

	data["channel_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateChannelHeader(data); err == nil {
		t.Fatal("should have errored on non-existent channel id")
	}

	data["channel_id"] = channel1.Id
	data["channel_header"] = strings.Repeat("a", 1050)
	if _, err := Client.UpdateChannelHeader(data); err == nil {
		t.Fatal("should have errored on bad channel header")
	}

	rchannel := Client.Must(Client.CreateDirectChannel(th.BasicUser2.Id)).Data.(*model.Channel)
	data["channel_id"] = rchannel.Id
	data["channel_header"] = "new header"
	var upChanneld *model.Channel
	if result, err := Client.UpdateChannelHeader(data); err != nil {
		t.Fatal(err)
	} else {
		upChanneld = result.Data.(*model.Channel)
	}

	if upChanneld.Header != data["channel_header"] {
		t.Fatal("Failed to update header")
	}

	th.LoginBasic2()

	data["channel_id"] = channel1.Id
	data["channel_header"] = "new header"
	if _, err := Client.UpdateChannelHeader(data); err == nil {
		t.Fatal("should have errored non-channel member trying to update header")
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	restrictPublicChannel := *th.App.Config().TeamSettings.RestrictPublicChannelManagement
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManagement
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = restrictPublicChannel })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = restrictPrivateChannel })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_ALL })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginBasic()
	channel2 := th.CreateChannel(Client, team)
	channel3 := th.CreatePrivateChannel(Client, team)

	data2 := make(map[string]string)
	data2["channel_id"] = channel2.Id
	data2["channel_header"] = "new header"

	data3 := make(map[string]string)
	data3["channel_id"] = channel3.Id
	data3["channel_header"] = "new header"

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.UpdateChannelHeader(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannelHeader(data3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()
	th.MakeUserChannelUser(th.BasicUser, channel2)
	th.MakeUserChannelUser(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.UpdateChannelHeader(data2); err == nil {
		t.Fatal("should have errored not channel admin")
	}
	if _, err := Client.UpdateChannelHeader(data3); err == nil {
		t.Fatal("should have errored not channel admin")
	}

	th.MakeUserChannelAdmin(th.BasicUser, channel2)
	th.MakeUserChannelAdmin(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.UpdateChannelHeader(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannelHeader(data3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannelHeader(data2); err == nil {
		t.Fatal("should have errored not team admin")
	}
	if _, err := Client.UpdateChannelHeader(data3); err == nil {
		t.Fatal("should have errored not team admin")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser, team)
	Client.Logout()
	th.LoginBasic()
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateChannelHeader(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannelHeader(data3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannelHeader(data2); err == nil {
		t.Fatal("should have errored not system admin")
	}
	if _, err := Client.UpdateChannelHeader(data3); err == nil {
		t.Fatal("should have errored not system admin")
	}

	th.LinkUserToTeam(th.SystemAdminUser, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.SystemAdminUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.SystemAdminUser.Id))
	th.LoginSystemAdmin()

	if _, err := SystemAdminClient.UpdateChannelHeader(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := SystemAdminClient.UpdateChannelHeader(data3); err != nil {
		t.Fatal(err)
	}

	// Check that if unlicensed the policy restriction is not enforced.
	utils.SetIsLicensed(false)
	utils.SetLicense(nil)
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := SystemAdminClient.UpdateChannelHeader(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := SystemAdminClient.UpdateChannelHeader(data3); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateChannelPurpose(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	SystemAdminClient := th.SystemAdminClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	data := make(map[string]string)
	data["channel_id"] = channel1.Id
	data["channel_purpose"] = "new purpose"

	var upChannel1 *model.Channel
	if result, err := Client.UpdateChannelPurpose(data); err != nil {
		t.Fatal(err)
	} else {
		upChannel1 = result.Data.(*model.Channel)
	}

	time.Sleep(100 * time.Millisecond)

	r1 := Client.Must(Client.GetPosts(channel1.Id, 0, 1, "")).Data.(*model.PostList)
	if len(r1.Order) != 1 {
		t.Fatal("Purpose update system message was not found")
	} else if val, ok := r1.Posts[r1.Order[0]].Props["old_purpose"]; !ok || val != "" {
		t.Fatal("Props should contain old_header with old purpose value")
	} else if val, ok := r1.Posts[r1.Order[0]].Props["new_purpose"]; !ok || val != "new purpose" {
		t.Fatal("Props should contain new_header with new purpose value")
	}

	if upChannel1.Purpose != data["channel_purpose"] {
		t.Fatal("Failed to update purpose")
	}

	data["channel_id"] = "junk"
	if _, err := Client.UpdateChannelPurpose(data); err == nil {
		t.Fatal("should have errored on junk channel id")
	}

	data["channel_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateChannelPurpose(data); err == nil {
		t.Fatal("should have errored on non-existent channel id")
	}

	data["channel_id"] = channel1.Id
	data["channel_purpose"] = strings.Repeat("a", 350)
	if _, err := Client.UpdateChannelPurpose(data); err == nil {
		t.Fatal("should have errored on bad channel purpose")
	}

	th.LoginBasic2()

	data["channel_id"] = channel1.Id
	data["channel_purpose"] = "new purpose"
	if _, err := Client.UpdateChannelPurpose(data); err == nil {
		t.Fatal("should have errored non-channel member trying to update purpose")
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	restrictPublicChannel := *th.App.Config().TeamSettings.RestrictPublicChannelManagement
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManagement
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = restrictPublicChannel })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = restrictPrivateChannel })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_ALL })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginBasic()
	channel2 := th.CreateChannel(Client, team)
	channel3 := th.CreatePrivateChannel(Client, team)

	data2 := make(map[string]string)
	data2["channel_id"] = channel2.Id
	data2["channel_purpose"] = "new purpose"

	data3 := make(map[string]string)
	data3["channel_id"] = channel3.Id
	data3["channel_purpose"] = "new purpose"

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.UpdateChannelPurpose(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannelPurpose(data3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()
	th.MakeUserChannelUser(th.BasicUser, channel2)
	th.MakeUserChannelUser(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.UpdateChannelPurpose(data2); err == nil {
		t.Fatal("should have errored not channel admin")
	}
	if _, err := Client.UpdateChannelPurpose(data3); err == nil {
		t.Fatal("should have errored not channel admin")
	}

	th.MakeUserChannelAdmin(th.BasicUser, channel2)
	th.MakeUserChannelAdmin(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.UpdateChannelPurpose(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannelPurpose(data3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannelPurpose(data2); err == nil {
		t.Fatal("should have errored not team admin")
	}
	if _, err := Client.UpdateChannelPurpose(data3); err == nil {
		t.Fatal("should have errored not team admin")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser, team)
	Client.Logout()
	th.LoginBasic()
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateChannelPurpose(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.UpdateChannelPurpose(data3); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.UpdateChannelPurpose(data2); err == nil {
		t.Fatal("should have errored not system admin")
	}
	if _, err := Client.UpdateChannelPurpose(data3); err == nil {
		t.Fatal("should have errored not system admin")
	}

	th.LinkUserToTeam(th.SystemAdminUser, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.SystemAdminUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.SystemAdminUser.Id))
	th.LoginSystemAdmin()

	if _, err := SystemAdminClient.UpdateChannelPurpose(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := SystemAdminClient.UpdateChannelPurpose(data3); err != nil {
		t.Fatal(err)
	}

	// Check that if unlicensed the policy restriction is not enforced.
	utils.SetIsLicensed(false)
	utils.SetLicense(nil)
	th.App.SetDefaultRolesBasedOnConfig()
	if _, err := SystemAdminClient.UpdateChannelHeader(data2); err != nil {
		t.Fatal(err)
	}
	if _, err := SystemAdminClient.UpdateChannelHeader(data3); err != nil {
		t.Fatal(err)
	}
}

func TestGetChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	team2 := th.CreateTeam(Client)

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	rget := Client.Must(Client.GetChannels(""))
	channels := rget.Data.(*model.ChannelList)

	if (*channels)[0].DisplayName != channel1.DisplayName {
		t.Fatal("full name didn't match")
	}

	if (*channels)[1].DisplayName != channel2.DisplayName {
		t.Fatal("full name didn't match")
	}

	// test etag caching
	if cache_result, err := Client.GetChannels(rget.Etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}

	view := model.ChannelView{ChannelId: channel2.Id, PrevChannelId: channel1.Id}
	if _, resp := Client.ViewChannel(view); resp.Error != nil {
		t.Fatal(resp.Error)
	}

	if resp, err := Client.GetChannel(channel1.Id, ""); err != nil {
		t.Fatal(err)
	} else {
		data := resp.Data.(*model.ChannelData)
		if data.Channel.DisplayName != channel1.DisplayName {
			t.Fatal("name didn't match")
		}

		// test etag caching
		if cache_result, err := Client.GetChannel(channel1.Id, resp.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(*model.ChannelData) != nil {
			t.Log(cache_result.Data)
			t.Fatal("cache should be empty")
		}
	}

	if _, err := Client.GetChannel("junk", ""); err == nil {
		t.Fatal("should have failed - bad channel id")
	}

	th.BasicClient.SetTeamId(team2.Id)
	if _, err := Client.GetChannel(channel2.Id, ""); err == nil {
		t.Fatal("should have failed - wrong team")
	}

	//Test if a wrong team id is supplied should return error
	if _, err := Client.CreateDirectChannel(th.BasicUser2.Id); err != nil {
		t.Fatal(err)
	}

	th.BasicClient.SetTeamId("nonexitingteamid")
	if _, err := Client.GetChannels(""); err == nil {
		t.Fatal("should have failed - wrong team id")
	}
}

func TestGetMoreChannelsPage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "b" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "C Test API Name", Name: "c" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	th.LoginBasic2()

	if r, err := Client.GetMoreChannelsPage(0, 100); err != nil {
		t.Fatal(err)
	} else {
		channels := r.Data.(*model.ChannelList)

		// 1 for BasicChannel, 1 for PinnedPostChannel, 2 for open channels created above
		if len(*channels) != 4 {
			t.Fatal("wrong length")
		}

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}

		if (*channels)[1].DisplayName != channel2.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if r, err := Client.GetMoreChannelsPage(0, 1); err != nil {
		t.Fatal(err)
	} else {
		channels := r.Data.(*model.ChannelList)

		if len(*channels) != 1 {
			t.Fatal("wrong length")
		}

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if r, err := Client.GetMoreChannelsPage(1, 1); err != nil {
		t.Fatal(err)
	} else {
		channels := r.Data.(*model.ChannelList)

		if len(*channels) != 1 {
			t.Fatal("wrong length")
		}

		if (*channels)[0].DisplayName != channel2.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	Client.SetTeamId("junk")
	if _, err := Client.GetMoreChannelsPage(0, 1); err == nil {
		t.Fatal("should have failed - bad team id")
	}
}

func TestGetChannelCounts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	if result, err := Client.GetChannelCounts(""); err != nil {
		t.Fatal(err)
	} else {
		counts := result.Data.(*model.ChannelCounts)

		if len(counts.Counts) != 6 {
			t.Fatal("wrong number of channel counts")
		}

		if len(counts.UpdateTimes) != 6 {
			t.Fatal("wrong number of channel update times")
		}

		if cache_result, err := Client.GetChannelCounts(result.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(*model.ChannelCounts) != nil {
			t.Log(cache_result.Data)
			t.Fatal("result data should be empty")
		}
	}

}

func TestGetMyChannelMembers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	if result, err := Client.GetMyChannelMembers(); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.(*model.ChannelMembers)

		// town-square, off-topic, basic test channel, pinned post channel, channel1, channel2
		if len(*members) != 6 {
			t.Fatal("wrong number of members", len(*members))
		}
	}

}

func TestJoinChannelById(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	th.LoginBasic2()

	Client.Must(Client.JoinChannel(channel1.Id))

	if _, err := Client.JoinChannel(channel3.Id); err == nil {
		t.Fatal("shouldn't be able to join secret group")
	}

	rchannel := Client.Must(Client.CreateDirectChannel(th.BasicUser.Id)).Data.(*model.Channel)

	user3 := th.CreateUser(th.BasicClient)
	th.LinkUserToTeam(user3, team)
	Client.Must(Client.Login(user3.Email, "Password1"))

	if _, err := Client.JoinChannel(rchannel.Id); err == nil {
		t.Fatal("shoudn't be able to join direct channel")
	}

	th.LoginBasic()

	if _, err := Client.JoinChannel(channel1.Id); err != nil {
		t.Fatal("should be able to join public channel that we're a member of")
	}

	if _, err := Client.JoinChannel(channel3.Id); err != nil {
		t.Fatal("should be able to join private channel that we're a member of")
	}

	if _, err := Client.JoinChannel(rchannel.Id); err != nil {
		t.Fatal("should be able to join direct channel that we're a member of")
	}
}

func TestJoinChannelByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	th.LoginBasic2()

	Client.Must(Client.JoinChannelByName(channel1.Name))

	if _, err := Client.JoinChannelByName(channel3.Name); err == nil {
		t.Fatal("shouldn't be able to join secret group")
	}

	rchannel := Client.Must(Client.CreateDirectChannel(th.BasicUser.Id)).Data.(*model.Channel)

	user3 := th.CreateUser(th.BasicClient)
	th.LinkUserToTeam(user3, team)
	Client.Must(Client.Login(user3.Email, "Password1"))

	if _, err := Client.JoinChannelByName(rchannel.Name); err == nil {
		t.Fatal("shoudn't be able to join direct channel")
	}

	th.LoginBasic()

	if _, err := Client.JoinChannelByName(channel1.Name); err != nil {
		t.Fatal("should be able to join public channel that we're a member of")
	}

	if _, err := Client.JoinChannelByName(channel3.Name); err != nil {
		t.Fatal("should be able to join private channel that we're a member of")
	}

	if _, err := Client.JoinChannelByName(rchannel.Name); err != nil {
		t.Fatal("should be able to join direct channel that we're a member of")
	}
}

func TestJoinChannelByNameDisabledUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	Client.Must(th.BasicClient.RemoveUserFromTeam(th.BasicTeam.Id, th.BasicUser.Id))

	if _, err := th.App.AddUserToChannel(th.BasicUser, channel1); err == nil {
		t.Fatal("shoudn't be able to join channel")
	} else {
		if err.Id != "api.channel.add_user.to.channel.failed.deleted.app_error" {
			t.Fatal("wrong error")
		}
	}
}

func TestLeaveChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	th.LoginBasic2()

	Client.Must(Client.JoinChannel(channel1.Id))

	// Cannot leave a the private group if you are the only member
	if _, err := Client.LeaveChannel(channel3.Id); err == nil {
		t.Fatal("should have errored, cannot leave private group if only one member")
	}

	rchannel := Client.Must(Client.CreateDirectChannel(th.BasicUser.Id)).Data.(*model.Channel)

	if _, err := Client.LeaveChannel(rchannel.Id); err == nil {
		t.Fatal("should have errored, cannot leave direct channel")
	}

	rget := Client.Must(Client.GetChannels(""))
	cdata := rget.Data.(*model.ChannelList)
	for _, c := range *cdata {
		if c.Name == model.DEFAULT_CHANNEL {
			if _, err := Client.LeaveChannel(c.Id); err == nil {
				t.Fatal("should have errored on leaving default channel")
			}
			break
		}
	}
}

func TestDeleteChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	userSystemAdmin := th.SystemAdminUser
	userTeamAdmin := th.CreateUser(Client)
	th.LinkUserToTeam(userTeamAdmin, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	Client.Login(user2.Email, user2.Password)

	channelMadeByCA := &model.Channel{DisplayName: "C Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channelMadeByCA = Client.Must(Client.CreateChannel(channelMadeByCA)).Data.(*model.Channel)

	Client.AddChannelMember(channelMadeByCA.Id, userTeamAdmin.Id)

	Client.Login(userTeamAdmin.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	if _, err := Client.DeleteChannel(channel1.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DeleteChannel(channelMadeByCA.Id); err != nil {
		t.Fatal("Team admin failed to delete Channel Admin's channel")
	}

	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	if _, err := Client.CreatePost(post1); err == nil {
		t.Fatal("should have failed to post to deleted channel")
	}

	userStd := th.CreateUser(Client)
	th.LinkUserToTeam(userStd, team)
	Client.Login(userStd.Email, userStd.Password)

	if _, err := Client.JoinChannel(channel1.Id); err == nil {
		t.Fatal("should have failed to join deleted channel")
	}

	Client.Must(Client.JoinChannel(channel2.Id))

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}

	rget := Client.Must(Client.GetChannels(""))
	cdata := rget.Data.(*model.ChannelList)
	for _, c := range *cdata {
		if c.Name == model.DEFAULT_CHANNEL {
			if _, err := Client.DeleteChannel(c.Id); err == nil {
				t.Fatal("should have errored on deleting default channel")
			}
			break
		}
	}

	th.UpdateUserToTeamAdmin(userStd, team)

	Client.Logout()
	Client.Login(userStd.Email, userStd.Password)
	Client.SetTeamId(team.Id)

	channel2 = th.CreateChannel(Client, team)

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}

	channel3 := &model.Channel{DisplayName: "B Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	Client.Login(userSystemAdmin.Email, userSystemAdmin.Password)
	Client.Must(Client.JoinChannel(channel3.Id))

	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DeleteChannel(channel3.Id); err == nil {
		t.Fatal("should have failed - channel already deleted")
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	restrictPublicChannel := *th.App.Config().TeamSettings.RestrictPublicChannelManagement
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManagement
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = restrictPublicChannel })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = restrictPrivateChannel })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelManagement = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManagement = model.PERMISSIONS_ALL })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginSystemAdmin()
	th.LinkUserToTeam(th.BasicUser, team)

	channel2 = th.CreateChannel(Client, team)
	channel3 = th.CreatePrivateChannel(Client, team)
	channel4 := th.CreateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel4.Id, th.BasicUser.Id))
	Client.Must(Client.LeaveChannel(channel4.Id))

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginSystemAdmin()

	channel2 = th.CreateChannel(Client, team)
	channel3 = th.CreatePrivateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.DeleteChannel(channel2.Id); err == nil {
		t.Fatal("should have errored not channel admin")
	}
	if _, err := Client.DeleteChannel(channel3.Id); err == nil {
		t.Fatal("should have errored not channel admin")
	}

	th.MakeUserChannelAdmin(th.BasicUser, channel2)
	th.MakeUserChannelAdmin(th.BasicUser, channel3)
	sqlstore.ClearChannelCaches()

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	th.LoginSystemAdmin()

	channel2 = th.CreateChannel(Client, team)
	channel3 = th.CreatePrivateChannel(Client, team)

	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))
	th.UpdateUserToTeamAdmin(th.BasicUser, team)

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	th.App.InvalidateAllCaches()

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	th.UpdateUserToNonTeamAdmin(th.BasicUser, team)
	th.App.InvalidateAllCaches()

	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginSystemAdmin()

	channel2 = th.CreateChannel(Client, team)
	channel3 = th.CreatePrivateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.DeleteChannel(channel2.Id); err == nil {
		t.Fatal("should have errored not team admin")
	}
	if _, err := Client.DeleteChannel(channel3.Id); err == nil {
		t.Fatal("should have errored not team admin")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser, team)
	Client.Logout()
	Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	Client.SetTeamId(team.Id)

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_SYSTEM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginSystemAdmin()

	channel2 = th.CreateChannel(Client, team)
	channel3 = th.CreatePrivateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.DeleteChannel(channel2.Id); err == nil {
		t.Fatal("should have errored not system admin")
	}
	if _, err := Client.DeleteChannel(channel3.Id); err == nil {
		t.Fatal("should have errored not system admin")
	}

	if _, err := Client.DeleteChannel(channel4.Id); err == nil {
		t.Fatal("Should not be able to delete channel, even though only one user is left")
	}

	th.LoginSystemAdmin()

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	// Check that if unlicensed the policy restriction is not enforced.
	utils.SetIsLicensed(false)
	utils.SetLicense(nil)
	th.App.SetDefaultRolesBasedOnConfig()

	channel2 = th.CreateChannel(Client, team)
	channel3 = th.CreatePrivateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel3.Id, th.BasicUser.Id))

	Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	if _, err := Client.DeleteChannel(channel2.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := Client.DeleteChannel(channel3.Id); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPublicChannelDeletion = model.PERMISSIONS_ALL })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelDeletion = model.PERMISSIONS_ALL })
	th.App.SetDefaultRolesBasedOnConfig()
}

func TestGetChannelStats(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	rget := Client.Must(Client.GetChannelStats(channel1.Id, ""))
	data := rget.Data.(*model.ChannelStats)
	if data.ChannelId != channel1.Id {
		t.Fatal("couldnt't get extra info")
	} else if data.MemberCount != 1 {
		t.Fatal("got incorrect member count")
	}
}

func TestAddChannelMember(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(Client)

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	if _, err := Client.AddChannelMember(channel1.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.AddChannelMember(channel1.Id, "dsgsdg"); err == nil {
		t.Fatal("Should have errored, bad user id")
	}

	if _, err := Client.AddChannelMember(channel1.Id, "12345678901234567890123456"); err == nil {
		t.Fatal("Should have errored, bad user id")
	}

	if _, err := Client.AddChannelMember(channel1.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.AddChannelMember("sgdsgsdg", user2.Id); err == nil {
		t.Fatal("Should have errored, bad channel id")
	}

	channel2 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	th.LoginBasic2()

	if _, err := Client.AddChannelMember(channel2.Id, user2.Id); err == nil {
		t.Fatal("Should have errored, user not in channel")
	}

	th.LoginBasic()

	Client.Must(Client.DeleteChannel(channel2.Id))

	if _, err := Client.AddChannelMember(channel2.Id, user2.Id); err == nil {
		t.Fatal("Should have errored, channel deleted")
	}

	if _, err := Client.AddChannelMember(channel1.Id, user3.Id); err == nil {
		t.Fatal("Should have errored, user not on team")
	}

	// Test policy does not apply to TE.
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManageMembers
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictPrivateChannelManageMembers = restrictPrivateChannel
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	channel3 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(th.SystemAdminClient.CreateChannel(channel3)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel3.Id, user1.Id))
	if _, err := Client.AddChannelMember(channel3.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Add a license
	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_ALL })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	// Check that a regular channel user can add other users.
	channel4 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel4 = Client.Must(th.SystemAdminClient.CreateChannel(channel4)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel4.Id, user1.Id))
	if _, err := Client.AddChannelMember(channel4.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Test with CHANNEL_ADMIN level permission.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_CHANNEL_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel5 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel5 = Client.Must(th.SystemAdminClient.CreateChannel(channel5)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel5.Id, user1.Id))
	if _, err := Client.AddChannelMember(channel5.Id, user2.Id); err == nil {
		t.Fatal("Should have failed due to permissions")
	}

	th.MakeUserChannelAdmin(user1, channel5)
	th.App.InvalidateAllCaches()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.AddChannelMember(channel5.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Test with TEAM_ADMIN level permission.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_TEAM_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel6 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel6 = Client.Must(th.SystemAdminClient.CreateChannel(channel6)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel6.Id, user1.Id))
	if _, err := Client.AddChannelMember(channel6.Id, user2.Id); err == nil {
		t.Fatal("Should have failed due to permissions")
	}

	th.UpdateUserToTeamAdmin(user1, team)
	th.App.InvalidateAllCaches()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.AddChannelMember(channel6.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Test with SYSTEM_ADMIN level permission.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_SYSTEM_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel7 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel7 = Client.Must(th.SystemAdminClient.CreateChannel(channel7)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel7.Id, user1.Id))
	if _, err := Client.AddChannelMember(channel7.Id, user2.Id); err == nil {
		t.Fatal("Should have failed due to permissions")
	}

	if _, err := th.SystemAdminClient.AddChannelMember(channel7.Id, user2.Id); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveChannelMember(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	th.UpdateUserToTeamAdmin(user2, team)

	channelMadeByCA := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channelMadeByCA = Client.Must(Client.CreateChannel(channelMadeByCA)).Data.(*model.Channel)

	Client.Must(Client.AddChannelMember(channelMadeByCA.Id, user2.Id))

	th.LoginBasic2()

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	userStd := th.CreateUser(th.BasicClient)
	th.LinkUserToTeam(userStd, team)

	Client.Must(Client.AddChannelMember(channel1.Id, userStd.Id))

	Client.Must(Client.AddChannelMember(channelMadeByCA.Id, userStd.Id))

	if _, err := Client.RemoveChannelMember(channel1.Id, "dsgsdg"); err == nil {
		t.Fatal("Should have errored, bad user id")
	}

	if _, err := Client.RemoveChannelMember("sgdsgsdg", userStd.Id); err == nil {
		t.Fatal("Should have errored, bad channel id")
	}

	if _, err := Client.RemoveChannelMember(channel1.Id, userStd.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.RemoveChannelMember(channelMadeByCA.Id, userStd.Id); err != nil {
		t.Fatal("Team Admin failed to remove member from Channel Admin's channel")
	}

	channel2 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	Client.Login(userStd.Email, userStd.Password)

	if _, err := Client.RemoveChannelMember(channel2.Id, userStd.Id); err == nil {
		t.Fatal("Should have errored, user not channel admin")
	}

	th.LoginBasic2()
	Client.Must(Client.AddChannelMember(channel2.Id, userStd.Id))

	Client.Must(Client.DeleteChannel(channel2.Id))

	if _, err := Client.RemoveChannelMember(channel2.Id, userStd.Id); err == nil {
		t.Fatal("Should have errored, channel deleted")
	}

	townSquare := Client.Must(Client.GetChannelByName("town-square")).Data.(*model.Channel)

	if _, err := Client.RemoveChannelMember(townSquare.Id, userStd.Id); err == nil {
		t.Fatal("should have errored, channel is default")
	}

	th.LoginBasic()

	// Test policy does not apply to TE.
	restrictPrivateChannel := *th.App.Config().TeamSettings.RestrictPrivateChannelManageMembers
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictPrivateChannelManageMembers = restrictPrivateChannel
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_CHANNEL_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	channel3 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(th.SystemAdminClient.CreateChannel(channel3)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel3.Id, user1.Id))
	Client.Must(th.SystemAdminClient.AddChannelMember(channel3.Id, user2.Id))
	if _, err := Client.RemoveChannelMember(channel3.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Add a license
	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_ALL })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	// Check that a regular channel user can remove other users.
	channel4 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel4 = Client.Must(th.SystemAdminClient.CreateChannel(channel4)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel4.Id, user1.Id))
	Client.Must(th.SystemAdminClient.AddChannelMember(channel4.Id, user2.Id))
	if _, err := Client.RemoveChannelMember(channel4.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Test with CHANNEL_ADMIN level permission.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_CHANNEL_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel5 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel5 = Client.Must(th.SystemAdminClient.CreateChannel(channel5)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel5.Id, user1.Id))
	Client.Must(th.SystemAdminClient.AddChannelMember(channel5.Id, user2.Id))
	if _, err := Client.RemoveChannelMember(channel5.Id, user2.Id); err == nil {
		t.Fatal("Should have failed due to permissions")
	}

	th.MakeUserChannelAdmin(user1, channel5)
	th.App.InvalidateAllCaches()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()

	if _, err := Client.RemoveChannelMember(channel5.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Test with TEAM_ADMIN level permission.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_TEAM_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel6 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel6 = Client.Must(th.SystemAdminClient.CreateChannel(channel6)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel6.Id, user1.Id))
	Client.Must(th.SystemAdminClient.AddChannelMember(channel6.Id, user2.Id))
	if _, err := Client.RemoveChannelMember(channel6.Id, user2.Id); err == nil {
		t.Fatal("Should have failed due to permissions")
	}

	th.UpdateUserToTeamAdmin(user1, team)
	th.App.InvalidateAllCaches()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.RemoveChannelMember(channel6.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Test with SYSTEM_ADMIN level permission.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictPrivateChannelManageMembers = model.PERMISSIONS_SYSTEM_ADMIN
	})
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	channel7 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel7 = Client.Must(th.SystemAdminClient.CreateChannel(channel7)).Data.(*model.Channel)
	Client.Must(th.SystemAdminClient.AddChannelMember(channel7.Id, user1.Id))
	Client.Must(th.SystemAdminClient.AddChannelMember(channel7.Id, user2.Id))
	if _, err := Client.RemoveChannelMember(channel7.Id, user2.Id); err == nil {
		t.Fatal("Should have failed due to permissions")
	}

	if _, err := th.SystemAdminClient.RemoveChannelMember(channel7.Id, user2.Id); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateNotifyProps(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user := th.BasicUser
	user2 := th.BasicUser2

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	data := make(map[string]string)
	data["channel_id"] = channel1.Id
	data["user_id"] = user.Id
	data[model.DESKTOP_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION

	//timeBeforeUpdate := model.GetMillis()
	time.Sleep(100 * time.Millisecond)

	// test updating desktop
	if result, err := Client.UpdateNotifyProps(data); err != nil {
		t.Fatal(err)
	} else if notifyProps := result.Data.(map[string]string); notifyProps[model.DESKTOP_NOTIFY_PROP] != model.CHANNEL_NOTIFY_MENTION {
		t.Fatal("NotifyProps[\"desktop\"] did not update properly")
	} else if notifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.CHANNEL_MARK_UNREAD_ALL {
		t.Fatalf("NotifyProps[\"mark_unread\"] changed to %v", notifyProps[model.MARK_UNREAD_NOTIFY_PROP])
	}

	// test an empty update
	delete(data, model.DESKTOP_NOTIFY_PROP)

	if result, err := Client.UpdateNotifyProps(data); err != nil {
		t.Fatal(err)
	} else if notifyProps := result.Data.(map[string]string); notifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.CHANNEL_MARK_UNREAD_ALL {
		t.Fatalf("NotifyProps[\"mark_unread\"] changed to %v", notifyProps[model.MARK_UNREAD_NOTIFY_PROP])
	} else if notifyProps[model.DESKTOP_NOTIFY_PROP] != model.CHANNEL_NOTIFY_MENTION {
		t.Fatalf("NotifyProps[\"desktop\"] changed to %v", notifyProps[model.DESKTOP_NOTIFY_PROP])
	}

	// test updating mark unread
	data[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_MENTION

	if result, err := Client.UpdateNotifyProps(data); err != nil {
		t.Fatal(err)
	} else if notifyProps := result.Data.(map[string]string); notifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.CHANNEL_MARK_UNREAD_MENTION {
		t.Fatal("NotifyProps[\"mark_unread\"] did not update properly")
	} else if notifyProps[model.DESKTOP_NOTIFY_PROP] != model.CHANNEL_NOTIFY_MENTION {
		t.Fatalf("NotifyProps[\"desktop\"] changed to %v", notifyProps[model.DESKTOP_NOTIFY_PROP])
	}

	// test updating both
	data[model.DESKTOP_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	data[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_MENTION

	if result, err := Client.UpdateNotifyProps(data); err != nil {
		t.Fatal(err)
	} else if notifyProps := result.Data.(map[string]string); notifyProps[model.DESKTOP_NOTIFY_PROP] != model.CHANNEL_NOTIFY_NONE {
		t.Fatal("NotifyProps[\"desktop\"] did not update properly")
	} else if notifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.CHANNEL_MARK_UNREAD_MENTION {
		t.Fatal("NotifyProps[\"mark_unread\"] did not update properly")
	}

	// test updating push notification preferences
	delete(data, model.DESKTOP_NOTIFY_PROP)
	delete(data, model.MARK_UNREAD_NOTIFY_PROP)
	data[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if result, err := Client.UpdateNotifyProps(data); err != nil {
		t.Fatal(err)
	} else if notifyProps := result.Data.(map[string]string); notifyProps[model.PUSH_NOTIFY_PROP] != model.CHANNEL_NOTIFY_MENTION {
		t.Fatal("NotifyProps[\"push\"] did not update properly")
	}

	// test updating email preferences
	delete(data, model.PUSH_NOTIFY_PROP)
	data[model.EMAIL_NOTIFY_PROP] = "true"
	if result, err := Client.UpdateNotifyProps(data); err != nil {
		t.Fatal(err)
	} else if notifyProps := result.Data.(map[string]string); notifyProps[model.EMAIL_NOTIFY_PROP] != "true" {
		t.Fatal("NotifyProps[\"email\"] did not update properly")
	}

	// test error cases
	data["user_id"] = "junk"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	data["user_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	data["user_id"] = user.Id
	data["channel_id"] = "junk"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad channel id")
	}

	data["channel_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad channel id")
	}

	data[model.DESKTOP_NOTIFY_PROP] = "junk"
	data[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_ALL
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad desktop notify level")
	}

	data[model.DESKTOP_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	data[model.MARK_UNREAD_NOTIFY_PROP] = "junk"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad mark unread level")
	}

	data[model.DESKTOP_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	data[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_ALL
	data[model.PUSH_NOTIFY_PROP] = "junk"
	data[model.EMAIL_NOTIFY_PROP] = "true"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad push level")
	}

	data[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	data[model.EMAIL_NOTIFY_PROP] = "junk"
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - bad email notification option")
	}

	th.LoginBasic2()

	data["channel_id"] = channel1.Id
	data["user_id"] = user2.Id
	data[model.DESKTOP_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	data[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_MENTION
	if _, err := Client.UpdateNotifyProps(data); err == nil {
		t.Fatal("Should have errored - user not in channel")
	}
}

func TestFuzzyChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	// Strings that should pass as acceptable channel names
	var fuzzyStringsPass = []string{
		"*", "?", ".", "}{][)(><", "{}[]()<>",

		"qahwah ( قهوة)",
		"שָׁלוֹם עֲלֵיכֶם",
		"Ramen チャーシュー chāshū",
		"言而无信",
		"Ṫ͌ó̍ ̍͂̓̍̍̀i̊ͯ͒",
		"&amp; &lt; &qu",

		"' or '1'='1' -- ",
		"' or '1'='1' ({ ",
		"' or '1'='1' /* ",
		"1;DROP TABLE users",

		"<b><i><u><strong><em>",

		"sue@thatmightbe",
		"sue@thatmightbe.",
		"sue@thatmightbe.c",
		"sue@thatmightbe.co",
		"su+san@thatmightbe.com",
		"a@b.中国",
		"1@2.am",
		"a@b.co.uk",
		"a@b.cancerresearch",
		"local@[127.0.0.1]",
	}

	for i := 0; i < len(fuzzyStringsPass); i++ {
		channel := model.Channel{DisplayName: fuzzyStringsPass[i], Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}

		_, err := Client.CreateChannel(&channel)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestGetChannelMember(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	if result, err := Client.GetChannelMember(channel1.Id, th.BasicUser.Id); err != nil {
		t.Fatal(err)
	} else {
		cm := result.Data.(*model.ChannelMember)

		if cm.UserId != th.BasicUser.Id {
			t.Fatal("user ids didn't match")
		}
		if cm.ChannelId != channel1.Id {
			t.Fatal("channel ids didn't match")
		}
	}

	if _, err := Client.GetChannelMember(channel1.Id, th.BasicUser2.Id); err == nil {
		t.Fatal("should have failed - user not in channel")
	}

	if _, err := Client.GetChannelMember("junk", th.BasicUser2.Id); err == nil {
		t.Fatal("should have failed - bad channel id")
	}

	if _, err := Client.GetChannelMember(channel1.Id, "junk"); err == nil {
		t.Fatal("should have failed - bad user id")
	}

	if _, err := Client.GetChannelMember("junk", "junk"); err == nil {
		t.Fatal("should have failed - bad channel and user id")
	}
}

func TestSearchMoreChannels(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "TestAPINameA", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "TestAPINameB", Name: "b" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	th.LoginBasic2()

	if result, err := Client.SearchMoreChannels(model.ChannelSearch{Term: "TestAPIName"}); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}

		if (*channels)[1].DisplayName != channel2.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if result, err := Client.SearchMoreChannels(model.ChannelSearch{Term: "TestAPINameA"}); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if result, err := Client.SearchMoreChannels(model.ChannelSearch{Term: "TestAPINameB"}); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if (*channels)[0].DisplayName != channel2.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if result, err := Client.SearchMoreChannels(model.ChannelSearch{Term: channel1.Name}); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if _, err := Client.SearchMoreChannels(model.ChannelSearch{Term: ""}); err == nil {
		t.Fatal("should have errored - empty term")
	}

	if result, err := Client.SearchMoreChannels(model.ChannelSearch{Term: "blargh"}); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if len(*channels) != 0 {
			t.Fatal("should have no channels")
		}
	}

	Client.SetTeamId("junk")
	if _, err := Client.SearchMoreChannels(model.ChannelSearch{Term: "blargh"}); err == nil {
		t.Fatal("should have errored - bad team id")
	}
}

func TestAutocompleteChannels(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "TestAPINameA", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "TestAPINameB", Name: "b" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "BadChannelC", Name: "c" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: model.NewId()}
	if _, err := th.SystemAdminClient.CreateChannel(channel3); err == nil {
		t.Fatal("channel must have valid team id")
	}

	channel4 := &model.Channel{DisplayName: "BadChannelD", Name: "d" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel4 = Client.Must(Client.CreateChannel(channel4)).Data.(*model.Channel)

	if result, err := Client.AutocompleteChannels("TestAPIName"); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}

		if (*channels)[1].DisplayName != channel2.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if result, err := Client.AutocompleteChannels(channel1.Name); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if (*channels)[0].DisplayName != channel1.DisplayName {
			t.Fatal("full name didn't match")
		}
	}

	if result, err := Client.AutocompleteChannels("BadChannelC"); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if len(*channels) != 0 {
			t.Fatal("should have been empty")
		}
	}

	if result, err := Client.AutocompleteChannels("BadChannelD"); err != nil {
		t.Fatal(err)
	} else {
		channels := result.Data.(*model.ChannelList)

		if len(*channels) != 0 {
			t.Fatal("should have been empty")
		}
	}

	Client.SetTeamId("junk")

	if _, err := Client.AutocompleteChannels("BadChannelD"); err == nil {
		t.Fatal("should have failed - bad team id")
	}
}

func TestGetChannelByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	if result, err := Client.GetChannelByName(th.BasicChannel.Name); err != nil {
		t.Fatal("Failed to get channel")
	} else {
		channel := result.Data.(*model.Channel)
		if channel.Name != th.BasicChannel.Name {
			t.Fatal("channel names did not match")
		}
	}

	if _, err := Client.GetChannelByName("InvalidChannelName"); err == nil {
		t.Fatal("Failed to get team")
	}

	Client.Must(Client.Logout())

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Jabba the Hutt", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.SetTeamId(th.BasicTeam.Id)

	Client.Login(user2.Email, "passwd1")

	if _, err := Client.GetChannelByName(th.BasicChannel.Name); err == nil {
		t.Fatal("Should fail due to not enough permissions")
	}
}

func TestViewChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	view := model.ChannelView{
		ChannelId: th.BasicChannel.Id,
	}

	if _, resp := Client.ViewChannel(view); resp.Error != nil {
		t.Fatal(resp.Error)
	}

	view.PrevChannelId = th.BasicChannel.Id

	if _, resp := Client.ViewChannel(view); resp.Error != nil {
		t.Fatal(resp.Error)
	}

	view.PrevChannelId = ""

	if _, resp := Client.ViewChannel(view); resp.Error != nil {
		t.Fatal(resp.Error)
	}

	view.PrevChannelId = "junk"

	if _, resp := Client.ViewChannel(view); resp.Error != nil {
		t.Fatal(resp.Error)
	}

	rdata := Client.Must(Client.GetChannel(th.BasicChannel.Id, "")).Data.(*model.ChannelData)

	if rdata.Channel.TotalMsgCount != rdata.Member.MsgCount {
		t.Log(rdata.Channel.Id)
		t.Log(rdata.Member.UserId)
		t.Log(rdata.Channel.TotalMsgCount)
		t.Log(rdata.Member.MsgCount)
		t.Fatal("message counts don't match")
	}

	if _, err := Client.DoApiPost(Client.GetTeamRoute()+"/channels/view", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestGetChannelMembersByIds(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if _, err := th.App.AddUserToChannel(th.BasicUser2, th.BasicChannel); err != nil {
		t.Fatal("Could not add second user to channel")
	}

	if result, err := th.BasicClient.GetChannelMembersByIds(th.BasicChannel.Id, []string{th.BasicUser.Id}); err != nil {
		t.Fatal(err)
	} else {
		member := (*result.Data.(*model.ChannelMembers))[0]
		if member.UserId != th.BasicUser.Id {
			t.Fatal("user id did not match")
		}
		if member.ChannelId != th.BasicChannel.Id {
			t.Fatal("team id did not match")
		}
	}

	if result, err := th.BasicClient.GetChannelMembersByIds(th.BasicChannel.Id, []string{th.BasicUser.Id, th.BasicUser2.Id, model.NewId()}); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.(*model.ChannelMembers)
		if len(*members) != 2 {
			t.Fatal("length should have been 2, got ", len(*members))
		}
	}

	if _, err := th.BasicClient.GetChannelMembersByIds("junk", []string{th.BasicUser.Id}); err == nil {
		t.Fatal("should have errored - bad team id")
	}

	if _, err := th.BasicClient.GetChannelMembersByIds(th.BasicChannel.Id, []string{}); err == nil {
		t.Fatal("should have errored - empty user ids")
	}
}

func TestUpdateChannelRoles(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	th.SystemAdminClient.SetTeamId(th.BasicTeam.Id)
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)

	const CHANNEL_ADMIN = "channel_admin channel_user"
	const CHANNEL_MEMBER = "channel_user"

	// User 1 creates a channel, making them channel admin by default.
	createChannel := model.Channel{
		DisplayName: "Test API Name",
		Name:        "zz" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
	}

	rchannel, err := th.BasicClient.CreateChannel(&createChannel)
	if err != nil {
		t.Fatal("Failed to create channel:", err)
	}
	channel := rchannel.Data.(*model.Channel)

	// User 1 adds User 2 to the channel, making them a channel member by default.
	if _, err := th.BasicClient.AddChannelMember(channel.Id, th.BasicUser2.Id); err != nil {
		t.Fatal("Failed to add user 2 to the channel:", err)
	}

	// System Admin can demote User 1 (channel admin).
	if data, meta := th.SystemAdminClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_MEMBER); data == nil {
		t.Fatal("System Admin failed to demote channel admin to channel member:", meta)
	}

	// User 1 (channel_member) cannot promote user 2 (channel_member).
	if data, meta := th.BasicClient.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_ADMIN); data != nil {
		t.Fatal("Channel member should not be able to promote another channel member to channel admin:", meta)
	}

	// System Admin can promote user 1 (channel member).
	if data, meta := th.SystemAdminClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_ADMIN); data == nil {
		t.Fatal("System Admin failed to promote channel member to channel admin:", meta)
	}

	// User 1 (channel_admin) can promote User 2 (channel member).
	if data, meta := th.BasicClient.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_ADMIN); data == nil {
		t.Fatal("Channel admin failed to promote channel member to channel admin:", meta)
	}

	// User 1 (channel admin) can demote User 2 (channel admin).
	if data, meta := th.BasicClient.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_MEMBER); data == nil {
		t.Fatal("Channel admin failed to demote channel admin to channel member:", meta)
	}

	// User 1 (channel admin) can demote itself.
	if data, meta := th.BasicClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_MEMBER); data == nil {
		t.Fatal("Channel admin failed to demote itself to channel member:", meta)
	}

	// Promote User2 again for next test.
	if data, meta := th.SystemAdminClient.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_ADMIN); data == nil {
		t.Fatal("System Admin failed to promote channel member to channel admin:", meta)
	}

	// User 1 (channel member) cannot demote user 2 (channel admin).
	if data, meta := th.BasicClient.UpdateChannelRoles(channel.Id, th.BasicUser2.Id, CHANNEL_MEMBER); data != nil {
		t.Fatal("Channel member should not be able to demote another channel admin to channel member:", meta)
	}

	// User 1 (channel member) cannot promote itself.
	if data, meta := th.BasicClient.UpdateChannelRoles(channel.Id, th.BasicUser.Id, CHANNEL_ADMIN); data != nil {
		t.Fatal("Channel member should not be able to promote itself to channel admin:", meta)
	}
}

func TestGetPinnedPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	post1 := th.BasicPost
	r1 := Client.Must(Client.GetPinnedPosts(post1.ChannelId)).Data.(*model.PostList)
	if len(r1.Order) != 0 {
		t.Fatal("should not have gotten a pinned post")
	}

	post2 := th.PinnedPost
	r2 := Client.Must(Client.GetPinnedPosts(post2.ChannelId)).Data.(*model.PostList)
	if len(r2.Order) == 0 {
		t.Fatal("should have gotten a pinned post")
	}

	if _, ok := r2.Posts[post2.Id]; !ok {
		t.Fatal("missing pinned post")
	}
}
