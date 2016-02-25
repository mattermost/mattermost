// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestGetLogs(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.GetLogs(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if logs, err := Client.GetLogs(); err != nil {
		t.Fatal(err)
	} else if len(logs.Data.([]string)) <= 0 {
		t.Fatal()
	}
}

func TestGetAllAudits(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.GetAllAudits(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if audits, err := Client.GetAllAudits(); err != nil {
		t.Fatal(err)
	} else if len(audits.Data.(model.Audits)) <= 0 {
		t.Fatal()
	}
}

func TestGetClientProperties(t *testing.T) {
	Setup()

	if result, err := Client.GetClientProperties(); err != nil {
		t.Fatal(err)
	} else {
		props := result.Data.(map[string]string)

		if len(props["Version"]) == 0 {
			t.Fatal()
		}
	}
}

func TestGetConfig(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.GetConfig(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.GetConfig(); err != nil {
		t.Fatal(err)
	} else {
		cfg := result.Data.(*model.Config)

		if len(cfg.TeamSettings.SiteName) == 0 {
			t.Fatal()
		}
	}
}

func TestSaveConfig(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.SaveConfig(utils.Cfg); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.SaveConfig(utils.Cfg); err != nil {
		t.Fatal(err)
	} else {
		cfg := result.Data.(*model.Config)

		if len(cfg.TeamSettings.SiteName) == 0 {
			t.Fatal()
		}
	}
}

func TestEmailTest(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.TestEmail(utils.Cfg); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.TestEmail(utils.Cfg); err != nil {
		t.Fatal(err)
	}
}

func TestGetTeamAnalyticsStandard(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	if _, err := Client.GetTeamAnalytics(team.Id, "standard"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.GetTeamAnalytics(team.Id, "standard"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "channel_open_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[0].Value != 2 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "channel_private_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "unique_user_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "team_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}

	if result, err := Client.GetSystemAnalytics("standard"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "channel_open_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[0].Value < 2 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "channel_private_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "unique_user_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "team_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestGetPostCount(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	// manually update creation time, since it's always set to 0 upon saving and we only retrieve posts < today
	Srv.Store.(*store.SqlStore).GetMaster().Exec("UPDATE Posts SET CreateAt = :CreateAt WHERE ChannelId = :ChannelId",
		map[string]interface{}{"ChannelId": channel1.Id, "CreateAt": utils.MillisFromTime(utils.Yesterday())})

	if _, err := Client.GetTeamAnalytics(team.Id, "post_counts_day"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.GetTeamAnalytics(team.Id, "post_counts_day"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestUserCountsWithPostsByDay(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	// manually update creation time, since it's always set to 0 upon saving and we only retrieve posts < today
	Srv.Store.(*store.SqlStore).GetMaster().Exec("UPDATE Posts SET CreateAt = :CreateAt WHERE ChannelId = :ChannelId",
		map[string]interface{}{"ChannelId": channel1.Id, "CreateAt": utils.MillisFromTime(utils.Yesterday())})

	if _, err := Client.GetTeamAnalytics(team.Id, "user_counts_with_posts_day"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.GetTeamAnalytics(team.Id, "user_counts_with_posts_day"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestGetTeamAnalyticsExtra(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "#test a" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	if _, err := Client.GetTeamAnalytics("", "extra_counts"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.GetTeamAnalytics(team.Id, "extra_counts"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "file_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[0].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "hashtag_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "incoming_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "outgoing_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "command_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[5].Name != "session_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[5].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}

	if result, err := Client.GetSystemAnalytics("extra_counts"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "file_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "hashtag_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value < 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "incoming_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "outgoing_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "command_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[5].Name != "session_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}
