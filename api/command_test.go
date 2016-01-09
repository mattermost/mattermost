// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestListCommands(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	if results, err := Client.ListCommands(); err != nil {
		t.Fatal(err)
	} else {
		commands := results.Data.([]*model.Command)
		foundEcho := false

		for _, command := range commands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
		}

		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
	}
}

func TestCreateCommand(t *testing.T) {
	Setup()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	cmd := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST}

	if _, err := Client.CreateCommand(cmd); err == nil {
		t.Fatal("should have failed because not admin")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)
	Client.LoginByEmail(team.Name, user.Email, "pwd")

	var rcmd *model.Command
	if result, err := Client.CreateCommand(cmd); err != nil {
		t.Fatal(err)
	} else {
		rcmd = result.Data.(*model.Command)
	}

	if rcmd.CreatorId != user.Id {
		t.Fatal("user ids didn't match")
	}

	if rcmd.TeamId != team.Id {
		t.Fatal("team ids didn't match")
	}

	cmd = &model.Command{CreatorId: "123", TeamId: "456", URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST}
	if result, err := Client.CreateCommand(cmd); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.Command).CreatorId != user.Id {
			t.Fatal("bad user id wasn't overwritten")
		}
		if result.Data.(*model.Command).TeamId != team.Id {
			t.Fatal("bad team id wasn't overwritten")
		}
	}

	*utils.Cfg.ServiceSettings.EnableCommands = false
}

func TestListTeamCommands(t *testing.T) {
	Setup()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)
	Client.LoginByEmail(team.Name, user.Email, "pwd")

	cmd1 := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST}
	cmd1 = Client.Must(Client.CreateCommand(cmd1)).Data.(*model.Command)

	if result, err := Client.ListTeamCommands(); err != nil {
		t.Fatal(err)
	} else {
		cmds := result.Data.([]*model.Command)

		if len(cmds) != 1 {
			t.Fatal("incorrect number of cmd")
		}
	}

	*utils.Cfg.ServiceSettings.EnableCommands = false
}

func TestRegenToken(t *testing.T) {
	Setup()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)
	Client.LoginByEmail(team.Name, user.Email, "pwd")

	cmd := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST}
	cmd = Client.Must(Client.CreateCommand(cmd)).Data.(*model.Command)

	data := make(map[string]string)
	data["id"] = cmd.Id

	if result, err := Client.RegenCommandToken(data); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.Command).Token == cmd.Token {
			t.Fatal("regen didn't work properly")
		}
	}

	*utils.Cfg.ServiceSettings.EnableCommands = false
}

func TestDeleteCommand(t *testing.T) {
	Setup()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN)
	Client.LoginByEmail(team.Name, user.Email, "pwd")

	cmd := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST}
	cmd = Client.Must(Client.CreateCommand(cmd)).Data.(*model.Command)

	data := make(map[string]string)
	data["id"] = cmd.Id

	if _, err := Client.DeleteCommand(data); err != nil {
		t.Fatal(err)
	}

	cmds := Client.Must(Client.ListTeamCommands()).Data.([]*model.Command)
	if len(cmds) != 0 {
		t.Fatal("delete didn't work properly")
	}

	*utils.Cfg.ServiceSettings.EnableCommands = false
}

// func TestLoadTestUrlCommand(t *testing.T) {
// 	Setup()

// 	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
// 	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
// 	defer func() {
// 		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
// 	}()

// 	utils.Cfg.ServiceSettings.EnableTesting = true

// 	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
// 	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

// 	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
// 	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
// 	store.Must(Srv.Store.User().VerifyEmail(user.Id))

// 	Client.LoginByEmail(team.Name, user.Email, "pwd")

// 	channel := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
// 	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

// 	command := "/loadtest url "
// 	if _, err := Client.Command(channel.Id, command, false); err == nil {
// 		t.Fatal("/loadtest url with no url should've failed")
// 	}

// 	command = "/loadtest url http://www.hopefullynonexistent.file/path/asdf/qwerty"
// 	if _, err := Client.Command(channel.Id, command, false); err == nil {
// 		t.Fatal("/loadtest url with invalid url should've failed")
// 	}

// 	command = "/loadtest url https://raw.githubusercontent.com/mattermost/platform/master/README.md"
// 	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.Command); r.Response != model.RESP_EXECUTED {
// 		t.Fatal("/loadtest url for README.md should've executed")
// 	}

// 	command = "/loadtest url test-emoticons.md"
// 	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.Command); r.Response != model.RESP_EXECUTED {
// 		t.Fatal("/loadtest url for test-emoticons.md should've executed")
// 	}

// 	command = "/loadtest url test-emoticons"
// 	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.Command); r.Response != model.RESP_EXECUTED {
// 		t.Fatal("/loadtest url for test-emoticons should've executed")
// 	}

// 	posts := Client.Must(Client.GetPosts(channel.Id, 0, 5, "")).Data.(*model.PostList)
// 	// note that this may make more than 3 posts if files are too long to fit in an individual post
// 	if len(posts.Order) < 3 {
// 		t.Fatal("/loadtest url made too few posts, perhaps there needs to be a delay before GetPosts in the test?")
// 	}
// }
