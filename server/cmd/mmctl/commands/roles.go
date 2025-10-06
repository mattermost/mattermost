// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var RolesCmd = &cobra.Command{
	Use:   "roles",
	Short: "Manage user roles",
}

var RolesSystemAdminCmd = &cobra.Command{
	Use:     "system-admin [users]",
	Aliases: []string{"system_admin"},
	Short:   "Set a user as system admin",
	Long:    "Make some users system admins.",
	Example: `  # You can make one user a sysadmin
  $ mmctl roles system-admin john_doe

  # Or promote multiple users at the same time
  $ mmctl roles system-admin john_doe jane_doe`,
	RunE: withClient(rolesSystemAdminCmdF),
	Args: cobra.MinimumNArgs(1),
}

var RolesMemberCmd = &cobra.Command{
	Use:   "member [users]",
	Short: "Remove system admin privileges",
	Long:  "Remove system admin privileges from some users.",
	Example: `  # You can remove admin privileges from one user
  $ mmctl roles member john_doe

  # Or demote multiple users at the same time
  $ mmctl roles member john_doe jane_doe`,
	RunE: withClient(rolesMemberCmdF),
	Args: cobra.MinimumNArgs(1),
}
var RolesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List available roles",
	Example: `  $ mmctl roles list
  $ mmctl roles list --json`,
	RunE: withClient(rolesListCmdF),
	Args: cobra.NoArgs,
}

func init() {
	RolesCmd.AddCommand(
		RolesSystemAdminCmd,
		RolesMemberCmd,
		RolesListCmd,
	)

	RootCmd.AddCommand(RolesCmd)
}

func rolesListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	var errs *multierror.Error

	roles, resp, err := c.GetAllRoles(context.TODO())
	if err != nil {
		errs = multierror.Append(errs, fmt.Errorf("failed to get roles: %w", err))
	}

	jsonOut := viper.GetBool("json")

	if len(roles) == 0 {
		if resp != nil && (resp.StatusCode == 401 || resp.StatusCode == 403) {
			printer.PrintError("You don't have permissions to list roles")
		} else {
			printer.Print("No roles found.")
		}
		return errs.ErrorOrNil()
	}

	if jsonOut {
		for _, role := range roles {
			printer.Print(role)
		}
	} else {
		printer.Print("Available roles:")
		for _, role := range roles {
			printer.Print(fmt.Sprintf("- %s", role.Name))
		}
	}

	return errs.ErrorOrNil()
}

func rolesSystemAdminCmdF(c client.Client, _ *cobra.Command, args []string) error {
	var errs *multierror.Error
	users := getUsersFromUserArgs(c, args)
	for i, user := range users {
		if user == nil {
			userErr := fmt.Errorf("unable to find user %q", args[i])
			errs = multierror.Append(errs, userErr)
			printer.PrintError(userErr.Error())
			continue
		}

		systemAdmin := false
		roles := strings.Fields(user.Roles)
		for _, role := range roles {
			if role == model.SystemAdminRoleId {
				systemAdmin = true
			}
		}

		if !systemAdmin {
			roles = append(roles, model.SystemAdminRoleId)
			if _, err := c.UpdateUserRoles(context.TODO(), user.Id, strings.Join(roles, " ")); err != nil {
				updateErr := fmt.Errorf("can't update roles for user %q: %w", args[i], err)
				errs = multierror.Append(errs, updateErr)
				printer.PrintError(updateErr.Error())
				continue
			}

			printer.Print(fmt.Sprintf("System admin role assigned to user %q. Current roles are: %s", args[i], strings.Join(roles, ", ")))
		}
	}

	return errs.ErrorOrNil()
}

func rolesMemberCmdF(c client.Client, _ *cobra.Command, args []string) error {
	var errs *multierror.Error
	users := getUsersFromUserArgs(c, args)
	for i, user := range users {
		if user == nil {
			userErr := fmt.Errorf("unable to find user %q", args[i])
			errs = multierror.Append(errs, userErr)
			printer.PrintError(userErr.Error())
			continue
		}

		shouldRemoveSysadmin := false
		var newRoles []string

		roles := strings.FieldsSeq(user.Roles)
		for role := range roles {
			switch role {
			case model.SystemAdminRoleId:
				shouldRemoveSysadmin = true
			default:
				newRoles = append(newRoles, role)
			}
		}

		if shouldRemoveSysadmin {
			if _, err := c.UpdateUserRoles(context.TODO(), user.Id, strings.Join(newRoles, " ")); err != nil {
				updateErr := fmt.Errorf("can't update roles for user %q: %w", args[i], err)
				errs = multierror.Append(errs, updateErr)
				printer.PrintError(updateErr.Error())
				continue
			}

			printer.Print(fmt.Sprintf("System admin role revoked for user %q. Current roles are: %s", args[i], strings.Join(newRoles, ", ")))
		}
	}

	return errs.ErrorOrNil()
}
