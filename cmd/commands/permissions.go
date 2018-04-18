// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/cmd"
)

var PermissionsCmd = &cobra.Command{
	Use:   "permissions",
	Short: "Management of the Permissions system",
}

var ResetPermissionsCmd = &cobra.Command{
	Use:     "reset",
	Short:   "Reset the permissions system to its default state",
	Long:    "Reset the permissions system to its default state",
	Example: "  permissions reset",
	RunE:    resetPermissionsCmdF,
}

func init() {
	ResetPermissionsCmd.Flags().Bool("confirm", false, "Confirm you really want to reset the permissions system and a database backup has been performed.")

	PermissionsCmd.AddCommand(
		ResetPermissionsCmd,
	)
	cmd.RootCmd.AddCommand(PermissionsCmd)
}

func resetPermissionsCmdF(command *cobra.Command, args []string) error {
	a, err := cmd.InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}

	confirmFlag, _ := command.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		cmd.CommandPrettyPrintln("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
		cmd.CommandPrettyPrintln("Are you sure you want to reset the permissions system? All data related to the permissions system will be permanently deleted and all users will revert to having the default permissions. (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	if err := a.ResetPermissionsSystem(); err != nil {
		return errors.New(err.Error())
	}

	cmd.CommandPrettyPrintln("Permissions system successfully reset")

	return nil
}
