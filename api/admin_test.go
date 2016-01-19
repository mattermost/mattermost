// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestGetLogs(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.GetLogs(T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if logs, err := Client.GetLogs(T); err != nil {
		t.Fatal(err)
	} else if len(logs.Data.([]string)) <= 0 {
		t.Fatal()
	}
}

func TestGetClientProperties(t *testing.T) {
	Setup()

	if result, err := Client.GetClientProperties(T); err != nil {
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
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.GetConfig(T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if result, err := Client.GetConfig(T); err != nil {
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
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.SaveConfig(utils.Cfg, T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if result, err := Client.SaveConfig(utils.Cfg, T); err != nil {
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
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.TestEmail(utils.Cfg, T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.TestEmail(utils.Cfg, T); err != nil {
		t.Fatal(err)
	}
}

func TestGetAnalyticsStandard(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1, T)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1, T)).Data.(*model.Post)

	if _, err := Client.GetAnalytics(team.Id, "standard", T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if result, err := Client.GetAnalytics(team.Id, "standard", T); err != nil {
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
	}
}

func TestGetPostCount(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1, T)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1, T)).Data.(*model.Post)

	// manually update creation time, since it's always set to 0 upon saving and we only retrieve posts < today
	Srv.Store.(*store.SqlStore).GetMaster().Exec("UPDATE Posts SET CreateAt = :CreateAt WHERE ChannelId = :ChannelId",
		map[string]interface{}{"ChannelId": channel1.Id, "CreateAt": utils.MillisFromTime(utils.Yesterday())})

	if _, err := Client.GetAnalytics(team.Id, "post_counts_day", T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if result, err := Client.GetAnalytics(team.Id, "post_counts_day", T); err != nil {
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
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1, T)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1, T)).Data.(*model.Post)

	// manually update creation time, since it's always set to 0 upon saving and we only retrieve posts < today
	Srv.Store.(*store.SqlStore).GetMaster().Exec("UPDATE Posts SET CreateAt = :CreateAt WHERE ChannelId = :ChannelId",
		map[string]interface{}{"ChannelId": channel1.Id, "CreateAt": utils.MillisFromTime(utils.Yesterday())})

	if _, err := Client.GetAnalytics(team.Id, "user_counts_with_posts_day", T); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if result, err := Client.GetAnalytics(team.Id, "user_counts_with_posts_day", T); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}
