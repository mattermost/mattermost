// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestListCommands(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient

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
	th := Setup().InitBasic().InitSystemAdmin()
	Client := th.BasicClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam

	enableCommands := *utils.Cfg.ServiceSettings.EnableCommands
	defer func() {
		utils.Cfg.ServiceSettings.EnableCommands = &enableCommands
	}()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	cmd1 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	if _, err := Client.CreateCommand(cmd1); err == nil {
		t.Fatal("should have failed because not admin")
	}

	Client = th.SystemAdminClient

	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	var rcmd *model.Command
	if result, err := Client.CreateCommand(cmd2); err != nil {
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

	cmd3 := &model.Command{
		CreatorId: "123",
		TeamId:    "456",
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}
	if _, err := Client.CreateCommand(cmd3); err == nil {
		t.Fatal("trigger cannot be duplicated")
	}

	cmd4 := cmd3
	if _, err := Client.CreateCommand(cmd4); err == nil {
		t.Fatal("command cannot be duplicated")
	}
}

func TestListTeamCommands(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient

	enableCommands := *utils.Cfg.ServiceSettings.EnableCommands
	defer func() {
		utils.Cfg.ServiceSettings.EnableCommands = &enableCommands
	}()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	cmd1 := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST, Trigger: "trigger"}
	cmd1 = Client.Must(Client.CreateCommand(cmd1)).Data.(*model.Command)

	if result, err := Client.ListTeamCommands(); err != nil {
		t.Fatal(err)
	} else {
		cmds := result.Data.([]*model.Command)

		if len(cmds) != 1 {
			t.Fatal("incorrect number of cmd")
		}
	}
}

func TestRegenToken(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient

	enableCommands := *utils.Cfg.ServiceSettings.EnableCommands
	defer func() {
		utils.Cfg.ServiceSettings.EnableCommands = &enableCommands
	}()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	cmd := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST, Trigger: "trigger"}
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
}

func TestDeleteCommand(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient

	enableCommands := *utils.Cfg.ServiceSettings.EnableCommands
	defer func() {
		utils.Cfg.ServiceSettings.EnableCommands = &enableCommands
	}()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	cmd := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST, Trigger: "trigger"}
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
}

func TestTestCommand(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	channel1 := th.SystemAdminChannel

	enableCommands := *utils.Cfg.ServiceSettings.EnableCommands
	defer func() {
		utils.Cfg.ServiceSettings.EnableCommands = &enableCommands
	}()
	*utils.Cfg.ServiceSettings.EnableCommands = true

	cmd1 := &model.Command{
		URL:     "http://localhost" + utils.Cfg.ServiceSettings.ListenAddress + model.API_URL_SUFFIX + "/teams/command_test",
		Method:  model.COMMAND_METHOD_POST,
		Trigger: "test",
	}

	cmd1 = Client.Must(Client.CreateCommand(cmd1)).Data.(*model.Command)

	r1 := Client.Must(Client.Command(channel1.Id, "/test", false)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Test command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 1 {
		t.Fatal("Test command failed to send")
	}

	cmd2 := &model.Command{
		URL:     "http://localhost" + utils.Cfg.ServiceSettings.ListenAddress + model.API_URL_SUFFIX + "/teams/command_test",
		Method:  model.COMMAND_METHOD_GET,
		Trigger: "test2",
	}

	cmd2 = Client.Must(Client.CreateCommand(cmd2)).Data.(*model.Command)

	r2 := Client.Must(Client.Command(channel1.Id, "/test2", false)).Data.(*model.CommandResponse)
	if r2 == nil {
		t.Fatal("Test2 command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p2 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p2.Order) != 2 {
		t.Fatal("Test command failed to send")
	}
}
