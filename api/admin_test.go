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

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
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

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
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

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
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

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
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
