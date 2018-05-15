// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"

	"github.com/spf13/cobra"
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

		if _, err := a.UpdateUserRoles(user.Id, "system_admin system_user", true); err != nil {
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

		if _, err := a.UpdateUserRoles(user.Id, "system_user", true); err != nil {
			return err
		}
	}

	return nil
}
