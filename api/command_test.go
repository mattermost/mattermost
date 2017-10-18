// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestListCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

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
	defer th.TearDown()

	Client := th.BasicClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

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
	defer th.TearDown()

	Client := th.SystemAdminClient

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

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

func TestUpdateCommand(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	cmd1 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	cmd1 = Client.Must(Client.CreateCommand(cmd1)).Data.(*model.Command)

	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger2",
		Token:     cmd1.Token,
		Id:        cmd1.Id}

	if result, err := Client.UpdateCommand(cmd2); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.Command).Trigger == cmd1.Trigger {
			t.Fatal("update didn't work properly")
		}
	}
}

func TestRegenToken(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	onlyAdminIntegration := *th.App.Config().ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = onlyAdminIntegration })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })

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

	cmd2 := &model.Command{URL: "http://nowhere.com", Method: model.COMMAND_METHOD_POST, Trigger: "trigger2"}
	cmd2 = Client.Must(Client.CreateCommand(cmd2)).Data.(*model.Command)

	data2 := make(map[string]string)
	data2["id"] = cmd2.Id
	if _, err := th.BasicClient.DeleteCommand(data2); err == nil {
		t.Fatal("Should have errored. Your not allowed to delete other's commands")
	}

	cmds2 := Client.Must(Client.ListTeamCommands()).Data.([]*model.Command)
	if len(cmds2) != 1 {
		t.Fatal("Client was able to delete command without permission.")
	}
}

func TestTestCommand(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	channel1 := th.SystemAdminChannel

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	allowedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.AllowedUntrustedInternalConnections = &allowedInternalConnections
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost" })

	cmd1 := &model.Command{
		URL:     fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V3 + "/teams/command_test",
		Method:  model.COMMAND_METHOD_POST,
		Trigger: "testcommand",
	}

	cmd1 = Client.Must(Client.CreateCommand(cmd1)).Data.(*model.Command)

	r1 := Client.Must(Client.Command(channel1.Id, "/testcommand")).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Test command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel1.Id, 0, 10, "")).Data.(*model.PostList)
	// including system 'joined' message
	if len(p1.Order) != 2 {
		t.Fatal("Test command response failed to send")
	}

	cmdPosted := false
	for _, post := range p1.Posts {
		if strings.Contains(post.Message, "test command response") {
			cmdPosted = true
			break
		}
	}

	if !cmdPosted {
		t.Fatal("Test command response failed to post")
	}

	cmd2 := &model.Command{
		URL:     fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V3 + "/teams/command_test",
		Method:  model.COMMAND_METHOD_GET,
		Trigger: "test2",
	}

	cmd2 = Client.Must(Client.CreateCommand(cmd2)).Data.(*model.Command)

	r2 := Client.Must(Client.Command(channel1.Id, "/test2")).Data.(*model.CommandResponse)
	if r2 == nil {
		t.Fatal("Test2 command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p2 := Client.Must(Client.GetPosts(channel1.Id, 0, 10, "")).Data.(*model.PostList)
	if len(p2.Order) != 3 {
		t.Fatal("Test command failed to send")
	}
}
