// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"strings"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/model"
)

var RolesCmd = &cobra.Command{
	Use:   "roles",
	Short: "Management of user roles",
}

var MakeSystemAdminCmd = &cobra.Command{
	Use:     "system_admin [users]",
	Short:   "Set a user as system admin",
	Long:    "Make some users system admins",
	Example: "  roles system_admin user1",
	RunE:    makeSystemAdminCmdF,
}

var MakeMemberCmd = &cobra.Command{
	Use:     "member [users]",
	Short:   "Remove system admin privileges",
	Long:    "Remove system admin privileges from some users.",
	Example: "  roles member user1",
	RunE:    makeMemberCmdF,
}

func init() {
	RolesCmd.AddCommand(
		MakeSystemAdminCmd,
		MakeMemberCmd,
	)
	RootCmd.AddCommand(RolesCmd)
}

func makeSystemAdminCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Enter at least one user.")
	}

	users := getUsersFromUserArgs(a, args)
	for i, user := range users {
		if user == nil {
			return errors.New("Unable to find user '" + args[i] + "'")
		}

		systemAdmin := false
		systemUser := false

		roles := strings.Fields(user.Roles)
		for _, role := range roles {
			switch role {
			case model.SYSTEM_ADMIN_ROLE_ID:
				systemAdmin = true
			case model.SYSTEM_USER_ROLE_ID:
				systemUser = true
			}
		}

		if !systemUser {
			roles = append(roles, model.SYSTEM_USER_ROLE_ID)
		}
		if !systemAdmin {
			roles = append(roles, model.SYSTEM_ADMIN_ROLE_ID)
		}

		if _, err := a.UpdateUserRoles(user.Id, strings.Join(roles, " "), true); err != nil {
			return err
		}
	}

	return nil
}

func makeMemberCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Enter at least one user.")
	}

	users := getUsersFromUserArgs(a, args)
	for i, user := range users {
		if user == nil {
			return errors.New("Unable to find user '" + args[i] + "'")
		}

		systemUser := false
		var newRoles []string

		roles := strings.Fields(user.Roles)
		for _, role := range roles {
			switch role {
			case model.SYSTEM_ADMIN_ROLE_ID:
			default:
				if role == model.SYSTEM_USER_ROLE_ID {
					systemUser = true
				}
				newRoles = append(newRoles, role)
			}
		}

		if !systemUser {
			newRoles = append(roles, model.SYSTEM_USER_ROLE_ID)
		}

		if _, err := a.UpdateUserRoles(user.Id, strings.Join(newRoles, " "), true); err != nil {
			return err
		}
	}

	return nil
}
