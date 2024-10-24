// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

var PermissionsCmd = &cobra.Command{
	Use:   "permissions",
	Short: "Management of permissions",
}

var AddPermissionsCmd = &cobra.Command{
	Use:   "add <role> <permission...>",
	Short: "Add permissions to a role (EE Only)",
	Long:  `Add one or more permissions to an existing role (Only works in Enterprise Edition).`,
	Example: `  permissions add system_user list_open_teams
  permissions add system_manager sysconsole_read_user_management_channels`,
	Args: cobra.MinimumNArgs(2),
	RunE: withClient(addPermissionsCmdF),
}

var RemovePermissionsCmd = &cobra.Command{
	Use:   "remove <role> <permission...>",
	Short: "Remove permissions from a role (EE Only)",
	Long:  `Remove one or more permissions from an existing role (Only works in Enterprise Edition).`,
	Example: `  permissions remove system_user list_open_teams
  permissions remove system_manager sysconsole_read_user_management_channels`,
	Args: cobra.MinimumNArgs(2),
	RunE: withClient(removePermissionsCmdF),
}

var ShowRoleCmd = &cobra.Command{
	Use:        "show <role_name>",
	Deprecated: "please use \"mmctl permissions role show\" instead",
	Short:      "Show the role information",
	Long:       "Show all the information about a role.",
	Example:    `  permissions show system_user`,
	Args:       cobra.ExactArgs(1),
	RunE:       withClient(showRoleCmdF),
}

var ResetCmd = &cobra.Command{
	Use:   "reset <role_name>",
	Short: "Reset default permissions for role (EE Only)",
	Long:  "Reset the given role's permissions to the set that was originally released with",
	Example: `  # Reset the permissions of the 'system_read_only_admin' role.
  $ mmctl permissions reset system_read_only_admin`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(resetPermissionsCmdF),
}

func init() {
	PermissionsCmd.AddCommand(
		AddPermissionsCmd,
		RemovePermissionsCmd,
		ShowRoleCmd,
		ResetCmd,
	)

	RootCmd.AddCommand(PermissionsCmd)
}

func addPermissionsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	role, _, err := c.GetRoleByName(context.TODO(), args[0])
	if err != nil {
		return err
	}

	newPermissions := role.Permissions

	for _, permissionID := range args[1:] {
		newPermissions = append(newPermissions, permissionID)

		if ancillaryPermissions, ok := model.SysconsoleAncillaryPermissions[permissionID]; ok {
			for _, ancillaryPermission := range ancillaryPermissions {
				newPermissions = append(newPermissions, ancillaryPermission.Id)
			}
		}
	}

	patchRole := model.RolePatch{
		Permissions: &newPermissions,
	}

	if _, _, err = c.PatchRole(context.TODO(), role.Id, &patchRole); err != nil {
		return err
	}

	return nil
}

func removePermissionsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	role, _, err := c.GetRoleByName(context.TODO(), args[0])
	if err != nil {
		return err
	}

	newPermissionSet := role.Permissions
	for _, permissionID := range args[1:] {
		newPermissionSet = removeFromStringSlice(newPermissionSet, permissionID)
	}

	var ancillaryPermissionsStillUsed []*model.Permission
	for _, permissionID := range newPermissionSet {
		if ancillaryPermissions, ok := model.SysconsoleAncillaryPermissions[permissionID]; ok {
			ancillaryPermissionsStillUsed = append(ancillaryPermissionsStillUsed, ancillaryPermissions...)
		}
	}

	for _, permissionID := range args[1:] {
		if ancillaryPermissions, ok := model.SysconsoleAncillaryPermissions[permissionID]; ok {
			for _, permission := range ancillaryPermissions {
				if !permissionsSliceIncludes(ancillaryPermissionsStillUsed, permission) {
					newPermissionSet = removeFromStringSlice(newPermissionSet, permission.Id)
				}
			}
		}
	}

	patchRole := model.RolePatch{
		Permissions: &newPermissionSet,
	}

	if _, _, err = c.PatchRole(context.TODO(), role.Id, &patchRole); err != nil {
		return err
	}

	return nil
}

func resetPermissionsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	role, _, err := c.GetRoleByName(context.TODO(), args[0])
	if err != nil {
		return err
	}

	defaultRole, ok := model.MakeDefaultRoles()[role.Name]
	if !ok {
		return fmt.Errorf("no default permissions available for role")
	}

	patchRole := model.RolePatch{
		Permissions: &defaultRole.Permissions,
	}

	role, _, err = c.PatchRole(context.TODO(), role.Id, &patchRole)
	if err != nil {
		return err
	}

	printer.PrintT(prettyRole(role), nil)

	return nil
}

func removeFromStringSlice(items []string, item string) []string {
	newPermissions := []string{}
	for _, x := range items {
		if x != item {
			newPermissions = append(newPermissions, x)
		}
	}
	return newPermissions
}

func permissionsSliceIncludes(haystack []*model.Permission, needle *model.Permission) bool {
	for _, item := range haystack {
		if item.Id == needle.Id {
			return true
		}
	}
	return false
}
