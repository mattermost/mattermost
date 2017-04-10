// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestCreateCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	enableCommands := *utils.Cfg.ServiceSettings.EnableCommands
	defer func() {
		utils.Cfg.ServiceSettings.EnableCommands = &enableCommands
	}()
	*utils.Cfg.ServiceSettings.EnableCommands = true

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
	newCmd.Trigger = "test"
	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckInternalErrorStatus(t, resp)
	CheckErrorMessage(t, resp, "model.command.is_valid.method.app_error")

	*utils.Cfg.ServiceSettings.EnableCommands = false
	newCmd.Method = "P"
	newCmd.Trigger = "test"
	_, resp = th.SystemAdminClient.CreateCommand(newCmd)
	CheckNotImplementedStatus(t, resp)
	CheckErrorMessage(t, resp, "api.command.disabled.app_error")
}

func TestUpdateCommand(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.BasicTeam

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
		Trigger:   "trigger1",
	}

	cmd1, _ = app.CreateCommand(cmd1)

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
	defer TearDown()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.BasicTeam

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
		Trigger:   "trigger1",
	}

	rcmd1, _ := app.CreateCommand(cmd1)

	ok, resp := Client.DeleteCommand(rcmd1.Id)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have returned true")
	}

	rcmd1, _ = app.GetCommand(rcmd1.Id)
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

	rcmd2, _ := app.CreateCommand(cmd2)

	_, resp = th.Client.DeleteCommand(rcmd2.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.DeleteCommand(rcmd2.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestListCommands(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
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
	defer TearDown()
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
