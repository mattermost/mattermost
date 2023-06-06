// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

var TeamUsersCmd = &cobra.Command{
	Use:   "users",
	Short: "Management of team users",
}

var TeamUsersRemoveCmd = &cobra.Command{
	Use:     "remove [team] [users]",
	Short:   "Remove users from team",
	Long:    "Remove some users from team",
	Example: "  team users remove myteam user@example.com username",
	Args:    cobra.MinimumNArgs(2),
	RunE:    withClient(teamUsersRemoveCmdF),
}

var TeamUsersAddCmd = &cobra.Command{
	Use:     "add [team] [users]",
	Short:   "Add users to team",
	Long:    "Add some users to team",
	Example: "  team users add myteam user@example.com username",
	Args:    cobra.MinimumNArgs(2),
	RunE:    withClient(teamUsersAddCmdF),
}

func init() {
	TeamUsersCmd.AddCommand(
		TeamUsersRemoveCmd,
		TeamUsersAddCmd,
	)

	TeamCmd.AddCommand(TeamUsersCmd)
}

func teamUsersRemoveCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	var errs *multierror.Error
	users := getUsersFromUserArgs(c, args[1:])
	for i, user := range users {
		if err := removeUserFromTeam(c, team, user, args[i+1]); err != nil {
			errs = multierror.Append(errs, err)
		}
	}

	return errs.ErrorOrNil()
}

func removeUserFromTeam(c client.Client, team *model.Team, user *model.User, userArg string) error {
	if user == nil {
		err := fmt.Errorf("can't find user '%s'", userArg)
		printer.PrintError(err.Error())
		return err
	}

	var err error
	if _, err = c.RemoveTeamMember(context.TODO(), team.Id, user.Id); err != nil {
		err = fmt.Errorf("unable to remove '%s' from %s. Error: %w", userArg, team.Name, err)
		printer.PrintError(err.Error())
	}

	return err
}

func teamUsersAddCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	var errs *multierror.Error
	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	users := getUsersFromUserArgs(c, args[1:])
	for i, user := range users {
		if user == nil {
			userErr := fmt.Errorf("can't find user '%s'", args[i+1])
			printer.PrintError(userErr.Error())
			errs = multierror.Append(errs, userErr)
			continue
		}
		addUserToTeam(c, team, user, args[i+1])
	}

	return errs.ErrorOrNil()
}

func addUserToTeam(c client.Client, team *model.Team, user *model.User, userArg string) {
	if _, _, err := c.AddTeamMember(context.TODO(), team.Id, user.Id); err != nil {
		printer.PrintError("Unable to add '" + userArg + "' to " + team.Name + ". Error: " + err.Error())
	}
}
