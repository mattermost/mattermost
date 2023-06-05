// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestShowRoleCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	s.RunForAllClients("MM-T3928 Should allow all users to see a role", func(c client.Client) {
		printer.Clean()

		err := showRoleCmdF(c, &cobra.Command{}, []string{model.SystemAdminRoleId})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("MM-T3959 Should return error to all users for a none exitent role", func(c client.Client) {
		printer.Clean()

		err := showRoleCmdF(c, &cobra.Command{}, []string{"none_existent_role"})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestAddPermissionsCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	role, appErr := s.th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
	s.Require().Nil(appErr)
	s.Require().NotContains(role.Permissions, model.PermissionCreateBot.Id)

	s.Run("MM-T3961 Should not allow normal user to add a permission to a role", func() {
		printer.Clean()

		err := addPermissionsCmdF(s.th.Client, &cobra.Command{}, []string{model.SystemUserRoleId, model.PermissionCreateBot.Id})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3960 Should be able to add a permission to a role", func(c client.Client) {
		printer.Clean()

		err := addPermissionsCmdF(c, &cobra.Command{}, []string{model.SystemUserRoleId, model.PermissionCreateBot.Id})
		s.Require().NoError(err)
		defer func() {
			permissions := role.Permissions
			newRole, appErr := s.th.App.PatchRole(role, &model.RolePatch{Permissions: &permissions})
			s.Require().Nil(appErr)
			s.Require().NotContains(newRole.Permissions, model.PermissionCreateBot.Id)
		}()

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
		updatedRole, appErr := s.th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
		s.Require().Nil(appErr)
		s.Require().Contains(updatedRole.Permissions, model.PermissionCreateBot.Id)
	})
}

func (s *MmctlE2ETestSuite) TestRemovePermissionsCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	role, appErr := s.th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
	s.Require().Nil(appErr)
	s.Require().Contains(role.Permissions, model.PermissionCreateDirectChannel.Id)

	s.Run("MM-T3963 Should not allow normal user to remove a permission from a role", func() {
		printer.Clean()

		err := removePermissionsCmdF(s.th.Client, &cobra.Command{}, []string{model.SystemUserRoleId, model.PermissionCreateDirectChannel.Id})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3962 Should be able to remove a permission from a role", func(c client.Client) {
		printer.Clean()

		err := removePermissionsCmdF(c, &cobra.Command{}, []string{model.SystemUserRoleId, model.PermissionCreateDirectChannel.Id})
		s.Require().NoError(err)
		defer func() {
			permissions := []string{model.PermissionCreateDirectChannel.Id}
			newRole, appErr := s.th.App.PatchRole(role, &model.RolePatch{Permissions: &permissions})
			s.Require().Nil(appErr)
			s.Require().Contains(newRole.Permissions, model.PermissionCreateDirectChannel.Id)
		}()

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		updatedRole, appErr := s.th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
		s.Require().Nil(appErr)
		s.Require().NotContains(updatedRole.Permissions, model.PermissionCreateDirectChannel.Id)
	})
}
