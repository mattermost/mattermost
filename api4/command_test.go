// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestCreateCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	_, resp := Client.CreateCommand(newCmd)
	CheckForbiddenStatus(t, resp)

	createdCmd, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)
	if createdCmd.CreatorId != th.SystemAdminUser.Id {
		t.Fatal("user ids didn't match")
	}
	if createdCmd.TeamId != th.BasicTeam.Id {
		t.Fatal("team ids didn't match")
	}

	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckBadRequestStatus(t, resp)
	CheckErrorMessage(t, resp, "api.command.duplicate_trigger.app_error")

	newCmd.Method = "Wrong"
	newCmd.Trigger = "testcommand"
	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckBadRequestStatus(t, resp)
	CheckErrorMessage(t, resp, "model.command.is_valid.method.app_error")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = false })
	newCmd.Method = "P"
	newCmd.Trigger = "testcommand"
	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckNotImplementedStatus(t, resp)
	CheckErrorMessage(t, resp, "api.command.disabled.app_error")
}

func TestUpdateCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.BasicTeam

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
		Trigger:   "trigger1",
	}

	cmd1, _ = th.App.CreateCommand(cmd1)

	cmd2 := &model.Command{
		CreatorId: GenerateTestId(),
		TeamId:    team.Id,
		URL:       "http://nowhere.com/change",
		Method:    model.COMMAND_METHOD_GET,
		Trigger:   "trigger2",
		Id:        cmd1.Id,
		Token:     "tokenchange",
	}

	rcmd, resp := Client.UpdateCommand(cmd2)
	CheckNoError(t, resp)

	if rcmd.Trigger != cmd2.Trigger {
		t.Fatal("Trigger should have updated")
	}

	if rcmd.Method != cmd2.Method {
		t.Fatal("Method should have updated")
	}

	if rcmd.URL != cmd2.URL {
		t.Fatal("URL should have updated")
	}

	if rcmd.CreatorId != cmd1.CreatorId {
		t.Fatal("CreatorId should have not updated")
	}

	if rcmd.Token != cmd1.Token {
		t.Fatal("Token should have not updated")
	}

	cmd2.Id = GenerateTestId()

	rcmd, resp = Client.UpdateCommand(cmd2)
	CheckNotFoundStatus(t, resp)

	if rcmd != nil {
		t.Fatal("should be empty")
	}

	cmd2.Id = "junk"

	_, resp = Client.UpdateCommand(cmd2)
	CheckBadRequestStatus(t, resp)

	cmd2.Id = cmd1.Id
	cmd2.TeamId = GenerateTestId()

	_, resp = Client.UpdateCommand(cmd2)
	CheckBadRequestStatus(t, resp)

	cmd2.TeamId = team.Id

	_, resp = th.Client.UpdateCommand(cmd2)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdateCommand(cmd2)
	CheckUnauthorizedStatus(t, resp)
}

func TestDeleteCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.BasicTeam

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
		Trigger:   "trigger1",
	}

	rcmd1, _ := th.App.CreateCommand(cmd1)

	ok, resp := Client.DeleteCommand(rcmd1.Id)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have returned true")
	}

	rcmd1, _ = th.App.GetCommand(rcmd1.Id)
	if rcmd1 != nil {
		t.Fatal("should be nil")
	}

	ok, resp = Client.DeleteCommand("junk")
	CheckBadRequestStatus(t, resp)

	if ok {
		t.Fatal("should have returned false")
	}

	_, resp = Client.DeleteCommand(GenerateTestId())
	CheckNotFoundStatus(t, resp)

	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger2",
	}

	rcmd2, _ := th.App.CreateCommand(cmd2)

	_, resp = th.Client.DeleteCommand(rcmd2.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.DeleteCommand(rcmd2.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestListCommands(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "custom_command"}

	_, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)

	t.Run("ListSystemAndCustomCommands", func(t *testing.T) {
		listCommands, resp := th.SystemAdminClient.ListCommands(th.BasicTeam.Id, false)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if !foundCustom {
			t.Fatal("Should list the custom command")
		}
	})

	t.Run("ListCustomOnlyCommands", func(t *testing.T) {
		listCommands, resp := th.SystemAdminClient.ListCommands(th.BasicTeam.Id, true)
		CheckNoError(t, resp)

		if len(listCommands) > 1 {
			t.Fatal("Should list just one custom command")
		}
		if listCommands[0].Trigger != "custom_command" {
			t.Fatal("Wrong custom command trigger")
		}
	})

	t.Run("UserWithNoPermissionForCustomCommands", func(t *testing.T) {
		_, resp := Client.ListCommands(th.BasicTeam.Id, true)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, resp := Client.ListCommands(th.BasicTeam.Id, false)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if foundCustom {
			t.Fatal("Should not list the custom command")
		}
	})
}

func TestListAutocompleteCommands(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "custom_command"}

	_, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)

	t.Run("ListAutocompleteCommandsOnly", func(t *testing.T) {
		listCommands, resp := th.SystemAdminClient.ListAutocompleteCommands(th.BasicTeam.Id)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if foundCustom {
			t.Fatal("Should not list the custom command")
		}
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, resp := Client.ListAutocompleteCommands(th.BasicTeam.Id)
		CheckNoError(t, resp)

		foundEcho := false
		foundCustom := false
		for _, command := range listCommands {
			if command.Trigger == "echo" {
				foundEcho = true
			}
			if command.Trigger == "custom_command" {
				foundCustom = true
			}
		}
		if !foundEcho {
			t.Fatal("Couldn't find echo command")
		}
		if foundCustom {
			t.Fatal("Should not list the custom command")
		}
	})
}

func TestRegenToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "trigger"}

	createdCmd, resp := th.SystemAdminClient.CreateCommand(newCmd)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	token, resp := th.SystemAdminClient.RegenCommandToken(createdCmd.Id)
	CheckNoError(t, resp)
	if token == createdCmd.Token {
		t.Fatal("should update the token")
	}

	token, resp = Client.RegenCommandToken(createdCmd.Id)
	CheckForbiddenStatus(t, resp)
	if token != "" {
		t.Fatal("should not return the token")
	}
}

func TestExecuteCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

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

	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V4 + "/teams/command_test",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}

	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	commandResponse, resp := Client.ExecuteCommand(channel.Id, "/postcommand")
	CheckNoError(t, resp)

	if commandResponse == nil {
		t.Fatal("command response should have returned")
	}

	posts, err := th.App.GetPostsPage(channel.Id, 0, 10)
	if err != nil || posts == nil || len(posts.Order) != 3 {
		t.Fatal("Test command failed to send")
	}

	cmdPosted := false
	for _, post := range posts.Posts {
		if strings.Contains(post.Message, "test command response") {
			if post.Type != "custom_test" {
				t.Fatal("wrong type set in slash command post")
			}

			if post.Props["someprop"] != "somevalue" {
				t.Fatal("wrong prop set in slash command post")
			}

			cmdPosted = true
			break
		}
	}

	if !cmdPosted {
		t.Fatal("Test command response failed to post")
	}

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V4 + "/teams/command_test",
		Method:    model.COMMAND_METHOD_GET,
		Trigger:   "getcommand",
	}

	if _, err := th.App.CreateCommand(getCmd); err != nil {
		t.Fatal("failed to create get command")
	}

	commandResponse, resp = Client.ExecuteCommand(channel.Id, "/getcommand")
	CheckNoError(t, resp)

	if commandResponse == nil {
		t.Fatal("command response should have returned")
	}

	posts, err = th.App.GetPostsPage(channel.Id, 0, 10)
	if err != nil || posts == nil || len(posts.Order) != 4 {
		t.Fatal("Test command failed to send")
	}

	_, resp = Client.ExecuteCommand(channel.Id, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ExecuteCommand(channel.Id, "/")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ExecuteCommand(channel.Id, "getcommand")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.ExecuteCommand(channel.Id, "/junk")
	CheckNotFoundStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)

	_, resp = Client.ExecuteCommand(channel.Id, "/getcommand")
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.ExecuteCommand(channel.Id, "/getcommand")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.ExecuteCommand(channel.Id, "/getcommand")
	CheckNoError(t, resp)
}

func TestExecuteCommandAgainstChannelOnAnotherTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

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

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V4 + "/teams/command_test",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// the execute command endpoint will always search for the command by trigger and team id, inferring team id from the
	// channel id, so there is no way to use that slash command on a channel that belongs to some other team
	_, resp := Client.ExecuteCommand(channel.Id, "/postcommand")
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandAgainstChannelUserIsNotIn(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	client := th.Client

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

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V4 + "/teams/command_test",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// make a channel on that team, ensuring that our test user isn't in it
	channel2 := th.CreateChannelWithClientAndTeam(client, model.CHANNEL_OPEN, team2.Id)
	if success, _ := client.RemoveUserFromChannel(channel2.Id, th.BasicUser.Id); !success {
		t.Fatal("Failed to remove user from channel")
	}

	// we should not be able to run the slash command in channel2, because we aren't in it
	_, resp := client.ExecuteCommandWithTeam(channel2.Id, team2.Id, "/postcommand")
	CheckForbiddenStatus(t, resp)
}

func TestExecuteCommandInDirectMessageChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	client := th.Client

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

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam()
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V4 + "/teams/command_test",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// make a direct message channel
	dmChannel, response := client.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp := client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	CheckOKStatus(t, resp)

	// but we can't run the slash command in the DM channel if we sub in some other team's id
	_, resp = client.ExecuteCommandWithTeam(dmChannel.Id, th.BasicTeam.Id, "/postcommand")
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandInTeamUserIsNotOn(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	client := th.Client

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

	// create a team that the user isn't a part of
	team2 := th.CreateTeam()

	// create a slash command on that team
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port) + model.API_URL_SUFFIX_V4 + "/teams/command_test",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "postcommand",
	}
	if _, err := th.App.CreateCommand(postCmd); err != nil {
		t.Fatal("failed to create post command")
	}

	// make a direct message channel
	dmChannel, response := client.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp := client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	CheckOKStatus(t, resp)

	// if the user is removed from the team, they should NOT be able to run the slash command in the DM channel
	if success, _ := client.RemoveTeamMember(team2.Id, th.BasicUser.Id); !success {
		t.Fatal("Failed to remove user from team")
	}
	_, resp = client.ExecuteCommandWithTeam(dmChannel.Id, team2.Id, "/postcommand")
	CheckForbiddenStatus(t, resp)

	// if we omit the team id from the request, the slash command will fail because this is a DM channel, and the
	// team id can't be inherited from the channel
	_, resp = client.ExecuteCommand(dmChannel.Id, "/postcommand")
	CheckForbiddenStatus(t, resp)
}
