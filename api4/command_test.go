// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
	// "time"

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
