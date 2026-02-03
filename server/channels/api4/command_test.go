// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestCreateCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	LocalClient := th.LocalClient

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		URL:     "http://nowhere.com",
		Method:  model.CommandMethodPost,
		Trigger: "trigger",
	}

	_, resp, err := client.CreateCommand(context.Background(), newCmd)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	createdCmd, resp, err := th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, th.SystemAdminUser.Id, createdCmd.CreatorId, "user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, createdCmd.TeamId, "team ids didn't match")

	_, resp, err = th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "api.command.duplicate_trigger.app_error")

	newCmd.Trigger = "Local"
	newCmd.CreatorId = th.BasicUser.Id
	localCreatedCmd, resp, err := LocalClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, th.BasicUser.Id, localCreatedCmd.CreatorId, "local client: user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, localCreatedCmd.TeamId, "local client: team ids didn't match")

	newCmd.Method = "Wrong"
	newCmd.Trigger = "testcommand"
	_, resp, err = th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "model.command.is_valid.method.app_error")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = false })
	newCmd.Method = "P"
	newCmd.Trigger = "testcommand"
	_, resp, err = th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
	CheckErrorID(t, err, "api.command.disabled.app_error")

	// Confirm that local clients can't override disable command setting
	newCmd.Trigger = "LocalOverride"
	_, _, err = LocalClient.CreateCommand(context.Background(), newCmd)
	CheckErrorID(t, err, "api.command.disabled.app_error")
}

func TestCreateCommandForOtherUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	// Give BasicUser permission to manage their own commands
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserWithOnlyManageOwnCannotCreateForOthers", func(t *testing.T) {
		cmdForOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_for_other_fail",
		}

		_, resp, err := th.Client.CreateCommand(context.Background(), cmdForOther)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("UserWithManageOthersCanCreateForOthers", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		cmdForOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_for_other_success",
		}

		createdCmd, _, err := th.Client.CreateCommand(context.Background(), cmdForOther)
		require.NoError(t, err)
		require.Equal(t, th.BasicUser2.Id, createdCmd.CreatorId, "command should be owned by BasicUser2")
		require.Equal(t, th.BasicTeam.Id, createdCmd.TeamId)
	})

	t.Run("UserWithManageOthersCannotCreateForNonExistentUser", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		cmdForInvalidUser := &model.Command{
			CreatorId: model.NewId(), // Non-existent user ID
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_invalid_user",
		}

		_, resp, err := th.Client.CreateCommand(context.Background(), cmdForInvalidUser)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("SystemAdminCanCreateForOthers", func(t *testing.T) {
		cmdForOther := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_admin_for_other",
		}

		createdCmd, _, err := th.SystemAdminClient.CreateCommand(context.Background(), cmdForOther)
		require.NoError(t, err)
		require.Equal(t, th.BasicUser.Id, createdCmd.CreatorId, "command should be owned by BasicUser")
		require.Equal(t, th.BasicTeam.Id, createdCmd.TeamId)
	})
}

func TestUpdateCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
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
		Method:    model.CommandMethodPost,
		Trigger:   "trigger1",
	}

	cmd1, _ = th.App.CreateCommand(cmd1)

	cmd2 := &model.Command{
		CreatorId: GenerateTestID(),
		TeamId:    team.Id,
		URL:       "http://nowhere.com/change",
		Method:    model.CommandMethodGet,
		Trigger:   "trigger2",
		Id:        cmd1.Id,
		Token:     "tokenchange",
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcmd, _, err := client.UpdateCommand(context.Background(), cmd2)
		require.NoError(t, err)

		require.Equal(t, cmd2.Trigger, rcmd.Trigger, "Trigger should have updated")

		require.Equal(t, cmd2.Method, rcmd.Method, "Method should have updated")

		require.Equal(t, cmd2.URL, rcmd.URL, "URL should have updated")

		require.Equal(t, cmd1.CreatorId, rcmd.CreatorId, "CreatorId should have not updated")

		require.Equal(t, cmd1.Token, rcmd.Token, "Token should have not updated")

		cmd2.Id = GenerateTestID()

		rcmd, resp, err := client.UpdateCommand(context.Background(), cmd2)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		require.Nil(t, rcmd, "should be empty")

		cmd2.Id = "junk"

		_, resp, err = client.UpdateCommand(context.Background(), cmd2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		cmd2.Id = cmd1.Id
		cmd2.TeamId = GenerateTestID()

		_, resp, err = client.UpdateCommand(context.Background(), cmd2)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		cmd2.TeamId = team.Id

		_, resp, err = th.Client.UpdateCommand(context.Background(), cmd2)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
	_, err := th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err := th.SystemAdminClient.UpdateCommand(context.Background(), cmd2)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// Permission tests
	th.LoginBasic(t)

	// Give BasicUser permission to manage their own commands
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserCanUpdateTheirOwnCommand", func(t *testing.T) {
		// Create a command owned by BasicUser
		cmd := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own",
		}
		createdCmd, _ := th.App.CreateCommand(cmd)

		// Update the command
		createdCmd.URL = "http://newurl.com"
		updatedCmd, _, err := th.Client.UpdateCommand(context.Background(), createdCmd)
		require.NoError(t, err)
		require.Equal(t, "http://newurl.com", updatedCmd.URL)
	})

	t.Run("UserWithoutManageOthersCannotUpdateOthersCommand", func(t *testing.T) {
		// Create a command owned by BasicUser2
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other",
		}
		createdCmd, _ := th.App.CreateCommand(cmd)

		// Try to update the command
		createdCmd.URL = "http://newurl.com"
		_, resp, err := th.Client.UpdateCommand(context.Background(), createdCmd)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("UserWithManageOthersCanUpdateOthersCommand", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Create a command owned by BasicUser2
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other2",
		}
		createdCmd, _ := th.App.CreateCommand(cmd)

		// Update the command
		createdCmd.URL = "http://newurl.com"
		updatedCmd, _, err := th.Client.UpdateCommand(context.Background(), createdCmd)
		require.NoError(t, err)
		require.Equal(t, "http://newurl.com", updatedCmd.URL)
	})

	t.Run("UserWithOnlyManageOwnCannotUpdateOthersCommand", func(t *testing.T) {
		// BasicUser should only have ManageOwn permission (already set up in the test)
		// Create a command owned by BasicUser2
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other3",
		}
		createdCmd, _ := th.App.CreateCommand(cmd)

		// Try to update the command
		createdCmd.URL = "http://newurl.com"
		_, resp, err := th.Client.UpdateCommand(context.Background(), createdCmd)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestMoveCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	user := th.SystemAdminUser
	team := th.BasicTeam
	newTeam := th.CreateTeam(t)

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	cmd1 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger1",
	}

	rcmd1, _ := th.App.CreateCommand(cmd1)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err := client.MoveCommand(context.Background(), newTeam.Id, rcmd1.Id)
		require.NoError(t, err)

		rcmd1, _ = th.App.GetCommand(rcmd1.Id)
		require.NotNil(t, rcmd1)
		require.Equal(t, newTeam.Id, rcmd1.TeamId)

		resp, err := client.MoveCommand(context.Background(), newTeam.Id, "bogus")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.MoveCommand(context.Background(), GenerateTestID(), rcmd1.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger2",
	}

	rcmd2, _ := th.App.CreateCommand(cmd2)

	resp, err := th.Client.MoveCommand(context.Background(), newTeam.Id, rcmd2.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	resp, err = th.SystemAdminClient.MoveCommand(context.Background(), newTeam.Id, rcmd2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// Set up for permission tests
	th.LoginBasic(t)
	th.LinkUserToTeam(t, th.BasicUser, newTeam)
	th.LinkUserToTeam(t, th.BasicUser2, newTeam)

	// Give BasicUser permission to manage their own commands on both teams
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserWithoutManageOthersPermissionCannotMoveOthersCommand", func(t *testing.T) {
		// Create a command owned by BasicUser2
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger3",
		}
		rcmd, _ := th.App.CreateCommand(cmd)

		// BasicUser should not be able to move BasicUser2's command
		resp, err := th.Client.MoveCommand(context.Background(), newTeam.Id, rcmd.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Verify the command was not moved
		movedCmd, _ := th.App.GetCommand(rcmd.Id)
		require.Equal(t, team.Id, movedCmd.TeamId)
	})

	t.Run("UserWithManageOthersPermissionCanMoveOthersCommand", func(t *testing.T) {
		// Create a command owned by BasicUser2
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger4",
		}
		rcmd, _ := th.App.CreateCommand(cmd)

		// Give BasicUser the permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Now BasicUser should be able to move BasicUser2's command
		_, err := th.Client.MoveCommand(context.Background(), newTeam.Id, rcmd.Id)
		require.NoError(t, err)

		// Verify the command was moved
		movedCmd, _ := th.App.GetCommand(rcmd.Id)
		require.Equal(t, newTeam.Id, movedCmd.TeamId)
	})

	t.Run("CreatorCanMoveTheirOwnCommand", func(t *testing.T) {
		// Create a command owned by BasicUser
		cmd := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger5",
		}
		rcmd, _ := th.App.CreateCommand(cmd)

		// BasicUser should be able to move their own command
		_, err := th.Client.MoveCommand(context.Background(), newTeam.Id, rcmd.Id)
		require.NoError(t, err)

		// Verify the command was moved
		movedCmd, _ := th.App.GetCommand(rcmd.Id)
		require.Equal(t, newTeam.Id, movedCmd.TeamId)
	})

	t.Run("UserWithOnlyManageOwnCannotMoveOthersCommand", func(t *testing.T) {
		// BasicUser should only have ManageOwn permission (already set up in the test)
		// Create a command owned by BasicUser2
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger6",
		}
		rcmd, _ := th.App.CreateCommand(cmd)

		// BasicUser should not be able to move BasicUser2's command
		resp, err := th.Client.MoveCommand(context.Background(), newTeam.Id, rcmd.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Verify the command was not moved
		notMovedCmd, _ := th.App.GetCommand(rcmd.Id)
		require.Equal(t, team.Id, notMovedCmd.TeamId)
	})

	t.Run("CannotMoveCommandWhenCreatorHasNoPermissionToNewTeam", func(t *testing.T) {
		// Create a third team that the command creator (BasicUser2) is NOT a member of
		thirdTeam := th.CreateTeam(t)
		th.LinkUserToTeam(t, th.BasicUser, thirdTeam)

		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Create a command owned by BasicUser2
		// Note: BasicUser2 is NOT a member of thirdTeam (only member of team and newTeam)
		cmd := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger7",
		}
		rcmd, _ := th.App.CreateCommand(cmd)

		// BasicUser attempts to move BasicUser2's command to thirdTeam
		// This should fail because BasicUser2 doesn't have permission to thirdTeam
		resp, err := th.Client.MoveCommand(context.Background(), thirdTeam.Id, rcmd.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// Verify the command was not moved
		notMovedCmd, _ := th.App.GetCommand(rcmd.Id)
		require.Equal(t, team.Id, notMovedCmd.TeamId)
	})
}

func TestDeleteCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
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
		Method:    model.CommandMethodPost,
		Trigger:   "trigger1",
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		cmd1.Id = ""
		rcmd1, appErr := th.App.CreateCommand(cmd1)
		require.Nil(t, appErr)
		_, err := client.DeleteCommand(context.Background(), rcmd1.Id)
		require.NoError(t, err)

		rcmd1, _ = th.App.GetCommand(rcmd1.Id)
		require.Nil(t, rcmd1)

		resp, err := client.DeleteCommand(context.Background(), "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.DeleteCommand(context.Background(), GenerateTestID())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
	cmd2 := &model.Command{
		CreatorId: user.Id,
		TeamId:    team.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "trigger2",
	}

	rcmd2, _ := th.App.CreateCommand(cmd2)

	resp, err := th.Client.DeleteCommand(context.Background(), rcmd2.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	resp, err = th.SystemAdminClient.DeleteCommand(context.Background(), rcmd2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// Permission tests for ManageOwn vs ManageOthers
	th.LoginBasic(t)

	// Give BasicUser permission to manage their own commands
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserWithManageOwnCanDeleteOnlyOwnCommand", func(t *testing.T) {
		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_delete",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_delete",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// Should be able to delete own command
		_, err := th.Client.DeleteCommand(context.Background(), createdCmdOwn.Id)
		require.NoError(t, err)

		// Verify the command was deleted
		deletedCmd, _ := th.App.GetCommand(createdCmdOwn.Id)
		require.Nil(t, deletedCmd)

		// Should not be able to delete other user's command
		resp, err := th.Client.DeleteCommand(context.Background(), createdCmdOther.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Verify the command was not deleted
		notDeletedCmd, _ := th.App.GetCommand(createdCmdOther.Id)
		require.NotNil(t, notDeletedCmd)
	})

	t.Run("UserWithManageOthersCanDeleteAnyCommand", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_delete2",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    team.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_delete2",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// Should be able to delete own command
		_, err := th.Client.DeleteCommand(context.Background(), createdCmdOwn.Id)
		require.NoError(t, err)

		// Verify the command was deleted
		deletedCmd, _ := th.App.GetCommand(createdCmdOwn.Id)
		require.Nil(t, deletedCmd)

		// Should be able to delete other user's command
		_, err = th.Client.DeleteCommand(context.Background(), createdCmdOther.Id)
		require.NoError(t, err)

		// Verify the command was deleted
		deletedCmd, _ = th.App.GetCommand(createdCmdOther.Id)
		require.Nil(t, deletedCmd)
	})
}

func TestListCommands(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		URL:     "http://nowhere.com",
		Method:  model.CommandMethodPost,
		Trigger: "custom_command",
	}
	_, _, rootErr := th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, rootErr)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		listCommands, _, err := c.ListCommands(context.Background(), th.BasicTeam.Id, false)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.True(t, foundCustom, "Should list the custom command")
	}, "ListSystemAndCustomCommands")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		listCommands, _, err := c.ListCommands(context.Background(), th.BasicTeam.Id, true)
		require.NoError(t, err)

		require.Len(t, listCommands, 1, "Should list just one custom command")
		require.Equal(t, listCommands[0].Trigger, "custom_command", "Wrong custom command trigger")
	}, "ListCustomOnlyCommands")

	t.Run("UserWithNoPermissionForCustomCommands", func(t *testing.T) {
		_, resp, err := client.ListCommands(context.Background(), th.BasicTeam.Id, true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, _, err := client.ListCommands(context.Background(), th.BasicTeam.Id, false)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("NoMember", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)

		user := th.CreateUser(t)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		_, resp, err := client.ListCommands(context.Background(), th.BasicTeam.Id, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		_, resp, err = client.ListCommands(context.Background(), th.BasicTeam.Id, true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.ListCommands(context.Background(), th.BasicTeam.Id, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		_, resp, err = client.ListCommands(context.Background(), th.BasicTeam.Id, true)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	// Permission tests for ManageOwn vs ManageOthers
	th.LoginBasic(t)

	// Give BasicUser permission to manage their own commands
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserWithManageOwnCanListOnlyOwnCustomCommands", func(t *testing.T) {
		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_list",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_list",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// List custom commands only
		listCommands, _, err := th.Client.ListCommands(context.Background(), th.BasicTeam.Id, true)
		require.NoError(t, err)

		foundOwn := false
		foundOther := false
		for _, command := range listCommands {
			if command.Id == createdCmdOwn.Id {
				foundOwn = true
			}
			if command.Id == createdCmdOther.Id {
				foundOther = true
			}
		}
		require.True(t, foundOwn, "Should list own command")
		require.False(t, foundOther, "Should not list other user's command")

		// List all commands (system + custom)
		listCommandsAll, _, err := th.Client.ListCommands(context.Background(), th.BasicTeam.Id, false)
		require.NoError(t, err)

		foundOwn = false
		foundOther = false
		foundSystem := false
		for _, command := range listCommandsAll {
			if command.Id == createdCmdOwn.Id {
				foundOwn = true
			}
			if command.Id == createdCmdOther.Id {
				foundOther = true
			}
			if command.Trigger == "echo" {
				foundSystem = true
			}
		}
		require.True(t, foundOwn, "Should list own command")
		require.False(t, foundOther, "Should not list other user's command")
		require.True(t, foundSystem, "Should list system commands")
	})

	t.Run("UserWithManageOthersCanListAllCustomCommands", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_list2",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_list2",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// List custom commands only
		listCommands, _, err := th.Client.ListCommands(context.Background(), th.BasicTeam.Id, true)
		require.NoError(t, err)

		foundOwn := false
		foundOther := false
		for _, command := range listCommands {
			if command.Id == createdCmdOwn.Id {
				foundOwn = true
			}
			if command.Id == createdCmdOther.Id {
				foundOther = true
			}
		}
		require.True(t, foundOwn, "Should list own command")
		require.True(t, foundOther, "Should list other user's command")

		// List all commands (system + custom)
		listCommandsAll, _, err := th.Client.ListCommands(context.Background(), th.BasicTeam.Id, false)
		require.NoError(t, err)

		foundOwn = false
		foundOther = false
		for _, command := range listCommandsAll {
			if command.Id == createdCmdOwn.Id {
				foundOwn = true
			}
			if command.Id == createdCmdOther.Id {
				foundOther = true
			}
		}
		require.True(t, foundOwn, "Should list own command")
		require.True(t, foundOther, "Should list other user's command")
	})
}

func TestListAutocompleteCommands(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	newCmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		URL:     "http://nowhere.com",
		Method:  model.CommandMethodPost,
		Trigger: "custom_command",
	}

	_, _, err := th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, err)

	t.Run("ListAutocompleteCommandsOnly", func(t *testing.T) {
		listCommands, _, err := th.SystemAdminClient.ListAutocompleteCommands(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		listCommands, _, err := client.ListAutocompleteCommands(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)

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
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("NoMember", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)

		user := th.CreateUser(t)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		_, resp, err := client.ListAutocompleteCommands(context.Background(), th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.ListAutocompleteCommands(context.Background(), th.BasicTeam.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestListCommandAutocompleteSuggestions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	newCmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		URL:     "http://nowhere.com",
		Method:  model.CommandMethodPost,
		Trigger: "custom_command",
	}

	_, _, err := th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, err)

	t.Run("ListAutocompleteSuggestionsOnly", func(t *testing.T) {
		suggestions, _, err := th.SystemAdminClient.ListCommandAutocompleteSuggestions(context.Background(), "/", th.BasicTeam.Id)
		require.NoError(t, err)

		foundEcho := false
		foundShrug := false
		foundCustom := false
		for _, command := range suggestions {
			if command.Suggestion == "echo" {
				foundEcho = true
			}
			if command.Suggestion == "shrug" {
				foundShrug = true
			}
			if command.Suggestion == "custom_command" {
				foundCustom = true
			}
		}
		require.True(t, foundEcho, "Couldn't find echo command")
		require.True(t, foundShrug, "Couldn't find shrug command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("ListAutocompleteSuggestionsOnlyWithInput", func(t *testing.T) {
		suggestions, _, err := th.SystemAdminClient.ListCommandAutocompleteSuggestions(context.Background(), "/e", th.BasicTeam.Id)
		require.NoError(t, err)

		foundEcho := false
		foundShrug := false
		for _, command := range suggestions {
			if command.Suggestion == "echo" {
				foundEcho = true
			}
			if command.Suggestion == "shrug" {
				foundShrug = true
			}
		}
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundShrug, "Should not list the shrug command")
	})

	t.Run("RegularUserCanListOnlySystemCommands", func(t *testing.T) {
		suggestions, _, err := client.ListCommandAutocompleteSuggestions(context.Background(), "/", th.BasicTeam.Id)
		require.NoError(t, err)

		foundEcho := false
		foundCustom := false
		for _, suggestion := range suggestions {
			if suggestion.Suggestion == "echo" {
				foundEcho = true
			}
			if suggestion.Suggestion == "custom_command" {
				foundCustom = true
			}
		}
		require.True(t, foundEcho, "Couldn't find echo command")
		require.False(t, foundCustom, "Should not list the custom command")
	})

	t.Run("NoMember", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)

		user := th.CreateUser(t)
		_, _, err = client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		_, resp, err := client.ListCommandAutocompleteSuggestions(context.Background(), "/", th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.ListCommandAutocompleteSuggestions(context.Background(), "/", th.BasicTeam.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		URL:     "http://nowhere.com",
		Method:  model.CommandMethodPost,
		Trigger: "roger",
	}
	newCmd, _, rootErr := th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, rootErr)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("ValidId", func(t *testing.T) {
			cmd, _, err := client.GetCommandById(context.Background(), newCmd.Id)
			require.NoError(t, err)

			require.Equal(t, newCmd.Id, cmd.Id)
			require.Equal(t, newCmd.CreatorId, cmd.CreatorId)
			require.Equal(t, newCmd.TeamId, cmd.TeamId)
			require.Equal(t, newCmd.URL, cmd.URL)
			require.Equal(t, newCmd.Method, cmd.Method)
			require.Equal(t, newCmd.Trigger, cmd.Trigger)
		})

		t.Run("InvalidId", func(t *testing.T) {
			_, _, err := client.GetCommandById(context.Background(), strings.Repeat("z", len(newCmd.Id)))
			require.Error(t, err)
		})
	})
	t.Run("UserWithNoPermissionForCustomCommands", func(t *testing.T) {
		_, resp, err := th.Client.GetCommandById(context.Background(), newCmd.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("NoMember", func(t *testing.T) {
		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)

		user := th.CreateUser(t)
		_, _, err = th.Client.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		_, resp, err := th.Client.GetCommandById(context.Background(), newCmd.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := th.Client.GetCommandById(context.Background(), newCmd.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	// Permission tests for ManageOwn vs ManageOthers
	th.LoginBasic(t)

	// Give BasicUser permission to manage their own commands
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserWithManageOwnCanGetOnlyOwnCommand", func(t *testing.T) {
		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_get",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_get",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// Should be able to get own command
		cmd, _, err := th.Client.GetCommandById(context.Background(), createdCmdOwn.Id)
		require.NoError(t, err)
		require.Equal(t, createdCmdOwn.Id, cmd.Id)

		// Should not be able to get other user's command
		_, resp, err := th.Client.GetCommandById(context.Background(), createdCmdOther.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("UserWithManageOthersCanGetAnyCommand", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_get2",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_get2",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// Should be able to get own command
		cmd, _, err := th.Client.GetCommandById(context.Background(), createdCmdOwn.Id)
		require.NoError(t, err)
		require.Equal(t, createdCmdOwn.Id, cmd.Id)

		// Should be able to get other user's command
		cmd, _, err = th.Client.GetCommandById(context.Background(), createdCmdOther.Id)
		require.NoError(t, err)
		require.Equal(t, createdCmdOther.Id, cmd.Id)
	})
}

func TestRegenToken(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	enableCommands := *th.App.Config().ServiceSettings.EnableCommands
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableCommands = &enableCommands })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCommands = true })

	newCmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		URL:     "http://nowhere.com",
		Method:  model.CommandMethodPost,
		Trigger: "trigger",
	}

	createdCmd, resp, err := th.SystemAdminClient.CreateCommand(context.Background(), newCmd)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	token, _, err := th.SystemAdminClient.RegenCommandToken(context.Background(), createdCmd.Id)
	require.NoError(t, err)
	require.NotEqual(t, createdCmd.Token, token, "should update the token")

	token, resp, err = client.RegenCommandToken(context.Background(), createdCmd.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	require.Empty(t, token, "should not return the token")

	// Permission tests for ManageOwn vs ManageOthers
	th.LoginBasic(t)

	// Give BasicUser permission to manage their own commands
	th.AddPermissionToRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionManageOwnSlashCommands.Id, model.TeamUserRoleId)

	t.Run("UserWithManageOwnCanRegenOnlyOwnCommandToken", func(t *testing.T) {
		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_regen",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)
		oldToken := createdCmdOwn.Token

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_regen",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)

		// Should be able to regenerate own command token
		newToken, _, err := th.Client.RegenCommandToken(context.Background(), createdCmdOwn.Id)
		require.NoError(t, err)
		require.NotEqual(t, oldToken, newToken)

		// Should not be able to regenerate other user's command token
		_, resp, err := th.Client.RegenCommandToken(context.Background(), createdCmdOther.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("UserWithManageOthersCanRegenAnyCommandToken", func(t *testing.T) {
		// Give BasicUser permission to manage others' commands
		th.AddPermissionToRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageOthersSlashCommands.Id, model.TeamUserRoleId)

		// Create a command owned by BasicUser
		cmdOwn := &model.Command{
			CreatorId: th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_own_regen2",
		}
		createdCmdOwn, _ := th.App.CreateCommand(cmdOwn)
		oldTokenOwn := createdCmdOwn.Token

		// Create a command owned by BasicUser2
		cmdOther := &model.Command{
			CreatorId: th.BasicUser2.Id,
			TeamId:    th.BasicTeam.Id,
			URL:       "http://nowhere.com",
			Method:    model.CommandMethodPost,
			Trigger:   "trigger_other_regen2",
		}
		createdCmdOther, _ := th.App.CreateCommand(cmdOther)
		oldTokenOther := createdCmdOther.Token

		// Should be able to regenerate own command token
		newToken, _, err := th.Client.RegenCommandToken(context.Background(), createdCmdOwn.Id)
		require.NoError(t, err)
		require.NotEqual(t, oldTokenOwn, newToken)

		// Should be able to regenerate other user's command token
		newToken, _, err = th.Client.RegenCommandToken(context.Background(), createdCmdOther.Id)
		require.NoError(t, err)
		require.NotEqual(t, oldTokenOther, newToken)
	})
}

func TestExecuteInvalidCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.0/8" })

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rc := &model.CommandResponse{}

		if err := json.NewEncoder(w).Encode(rc); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodGet,
		Trigger:   "getcommand",
	}

	_, appErr := th.App.CreateCommand(getCmd)
	require.Nil(t, appErr, "failed to create get command")

	_, resp, err := client.ExecuteCommand(context.Background(), channel.Id, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ExecuteCommand(context.Background(), channel.Id, "/")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ExecuteCommand(context.Background(), channel.Id, "getcommand")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.ExecuteCommand(context.Background(), channel.Id, "/junk")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	otherUser := th.CreateUser(t)
	_, _, err = client.Login(context.Background(), otherUser.Email, otherUser.Password)
	require.NoError(t, err)

	_, resp, err = client.ExecuteCommand(context.Background(), channel.Id, "/getcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.ExecuteCommand(context.Background(), channel.Id, "/getcommand")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.ExecuteCommand(context.Background(), channel.Id, "/getcommand")
	require.NoError(t, err)
}

func TestExecuteGetCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.0/8" })

	token := model.NewId()
	expectedCommandResponse := &model.CommandResponse{
		Text:         "test get command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)

		values, err := url.ParseQuery(r.URL.RawQuery)
		require.NoError(t, err)

		require.Equal(t, token, values.Get("token"))
		require.Equal(t, th.BasicTeam.Name, values.Get("team_domain"))
		require.Equal(t, "ourCommand", values.Get("cmd"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	getCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL + "/?cmd=ourCommand",
		Method:    model.CommandMethodGet,
		Trigger:   "getcommand",
		Token:     token,
	}

	_, appErr := th.App.CreateCommand(getCmd)
	require.Nil(t, appErr, "failed to create get command")

	commandResponse, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/getcommand")
	require.NoError(t, err)
	assert.True(t, len(commandResponse.TriggerId) == 26)

	expectedCommandResponse.TriggerId = commandResponse.TriggerId
	require.Equal(t, expectedCommandResponse, commandResponse)
}

func TestExecutePostCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.0/8" })

	token := model.NewId()
	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)

		err := r.ParseForm()
		require.NoError(t, err)

		require.Equal(t, token, r.FormValue("token"))
		require.Equal(t, th.BasicTeam.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
		Token:     token,
	}

	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create get command")

	commandResponse, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/postcommand")
	require.NoError(t, err)
	assert.True(t, len(commandResponse.TriggerId) == 26)

	expectedCommandResponse.TriggerId = commandResponse.TriggerId
	require.Equal(t, expectedCommandResponse, commandResponse)
}

func TestExecuteCommandAgainstChannelOnAnotherTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
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
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam(t)
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// the execute command endpoint will always search for the command by trigger and team id, inferring team id from the
	// channel id, so there is no way to use that slash command on a channel that belongs to some other team
	_, resp, err := client.ExecuteCommand(context.Background(), channel.Id, "/postcommand")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandAgainstChannelUserIsNotIn(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	team2 := th.CreateTeam(t)
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// make a channel on that team, ensuring that our test user isn't in it
	channel2 := th.CreateChannelWithClientAndTeam(t, client, model.ChannelTypeOpen, team2.Id)
	_, err := th.Client.RemoveUserFromChannel(context.Background(), channel2.Id, th.BasicUser.Id)
	require.NoError(t, err, "Failed to remove user from channel")

	// we should not be able to run the slash command in channel2, because we aren't in it
	_, resp, err := client.ExecuteCommandWithTeam(context.Background(), channel2.Id, team2.Id, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestExecuteCommandInDirectMessageChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	// create a team that the user isn't a part of
	team2 := th.CreateTeam(t)

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on some other team where we have permission to do so
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// make a direct message channel
	dmChannel, response, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp, err := client.ExecuteCommandWithTeam(context.Background(), dmChannel.Id, team2.Id, "/postcommand")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// but we can't run the slash command in the DM channel if we sub in some other team's id
	_, resp, err = client.ExecuteCommandWithTeam(context.Background(), dmChannel.Id, th.BasicTeam.Id, "/postcommand")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestExecuteCommandInTeamUserIsNotOn(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	// create a team that the user isn't a part of
	team2 := th.CreateTeam(t)

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		err := r.ParseForm()
		require.NoError(t, err)
		require.Equal(t, team2.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on that team
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team2.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// make a direct message channel
	dmChannel, response, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	// we should be able to run the slash command in the DM channel
	_, resp, err := client.ExecuteCommandWithTeam(context.Background(), dmChannel.Id, team2.Id, "/postcommand")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// if the user is removed from the team, they should NOT be able to run the slash command in the DM channel
	_, err = th.Client.RemoveTeamMember(context.Background(), team2.Id, th.BasicUser.Id)
	require.NoError(t, err, "Failed to remove user from team")

	_, resp, err = client.ExecuteCommandWithTeam(context.Background(), dmChannel.Id, team2.Id, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// if we omit the team id from the request, the slash command will fail because this is a DM channel, and the
	// team id can't be inherited from the channel
	_, resp, err = client.ExecuteCommand(context.Background(), dmChannel.Id, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestExecuteCommandReadOnly(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	expectedCommandResponse := &model.CommandResponse{
		Text:         "test post command response",
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         "custom_test",
		Props:        map[string]any{"someprop": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		err := r.ParseForm()
		require.NoError(t, err)
		require.Equal(t, th.BasicTeam.Name, r.FormValue("team_domain"))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(expectedCommandResponse); err != nil {
			th.TestLogger.Warn("Error while writing response", mlog.Err(err))
		}
	}))
	defer ts.Close()

	// create a slash command on that team
	postCmd := &model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       ts.URL,
		Method:    model.CommandMethodPost,
		Trigger:   "postcommand",
	}
	_, appErr := th.App.CreateCommand(postCmd)
	require.Nil(t, appErr, "failed to create post command")

	// Confirm that the command works when the channel is not read only
	_, resp, err := client.ExecuteCommandWithTeam(context.Background(), th.BasicChannel.Id, th.BasicChannel.TeamId, "/postcommand")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// Enable Enterprise features
	th.App.Srv().SetLicense(model.NewTestLicense())

	err = th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	_, appErr = th.App.PatchChannelModerationsForChannel(
		th.Context,
		th.BasicChannel,
		[]*model.ChannelModerationPatch{{
			Name: &model.PermissionCreatePost.Id,
			Roles: &model.ChannelModeratedRolesPatch{
				Guests:  model.NewPointer(false),
				Members: model.NewPointer(false),
			},
		}})
	require.Nil(t, appErr)

	// Confirm that the command fails when the channel is read only
	_, resp, err = client.ExecuteCommandWithTeam(context.Background(), th.BasicChannel.Id, th.BasicChannel.TeamId, "/postcommand")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Confirm that the command works when the channel is not read only - use different channel
	_, resp, err = client.ExecuteCommandWithTeam(context.Background(), th.BasicChannel2.Id, th.BasicChannel2.TeamId, "/postcommand")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	appErr = th.App.DeleteChannel(
		th.Context,
		th.BasicChannel2,
		th.SystemAdminUser.Id,
	)
	require.Nil(t, appErr, "failed to delete channel")

	// Confirm that the command fails when the channel is archived
	_, resp, err = client.ExecuteCommandWithTeam(context.Background(), th.BasicChannel2.Id, th.BasicChannel2.TeamId, "/postcommand")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}
