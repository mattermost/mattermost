// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var teamCmd = &cobra.Command{
	Use:   "team",
	Short: "Management of teams",
}

var teamCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a team",
	Long:  `Create a team.`,
	Example: `  team create --name mynewteam --display_name "My New Team"
  team create --name private --display_name "My New Private Team" --private`,
	RunE: createTeamCmdF,
}

var removeUsersCmd = &cobra.Command{
	Use:     "remove [team] [users]",
	Short:   "Remove users from team",
	Long:    "Remove some users from team",
	Example: "  team remove myteam user@example.com username",
	RunE:    removeUsersCmdF,
}

var addUsersCmd = &cobra.Command{
	Use:     "add [team] [users]",
	Short:   "Add users to team",
	Long:    "Add some users to team",
	Example: "  team add myteam user@example.com username",
	RunE:    addUsersCmdF,
}

var deleteTeamsCmd = &cobra.Command{
	Use:   "delete [teams]",
	Short: "Delete teams",
	Long: `Permanently delete some teams.
Permanently deletes a team along with all related information including posts from the database.`,
	Example: "  team delete myteam",
	RunE:    deleteTeamsCmdF,
}

func init() {
	teamCreateCmd.Flags().String("name", "", "Team Name")
	teamCreateCmd.Flags().String("display_name", "", "Team Display Name")
	teamCreateCmd.Flags().Bool("private", false, "Create a private team.")
	teamCreateCmd.Flags().String("email", "", "Administrator Email (anyone with this email is automatically a team admin)")

	deleteTeamsCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the team and a DB backup has been performed.")

	teamCmd.AddCommand(
		teamCreateCmd,
		removeUsersCmd,
		addUsersCmd,
		deleteTeamsCmd,
	)
}

func createTeamCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	name, errn := cmd.Flags().GetString("name")
	if errn != nil || name == "" {
		return errors.New("Name is required")
	}
	displayname, errdn := cmd.Flags().GetString("display_name")
	if errdn != nil || displayname == "" {
		return errors.New("Display Name is required")
	}
	email, _ := cmd.Flags().GetString("email")
	useprivate, _ := cmd.Flags().GetBool("private")

	teamType := model.TEAM_OPEN
	if useprivate {
		teamType = model.TEAM_INVITE
	}

	team := &model.Team{
		Name:        name,
		DisplayName: displayname,
		Email:       email,
		Type:        teamType,
	}

	if _, err := a.CreateTeam(team); err != nil {
		return errors.New("Team creation failed: " + err.Error())
	}

	return nil
}

func removeUsersCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 2 {
		return errors.New("Not enough arguments.")
	}

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	users := getUsersFromUserArgs(a, args[1:])
	for i, user := range users {
		removeUserFromTeam(a, team, user, args[i+1])
	}

	return nil
}

func removeUserFromTeam(a *app.App, team *model.Team, user *model.User, userArg string) {
	if user == nil {
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return
	}
	if err := a.LeaveTeam(team, user, ""); err != nil {
		CommandPrintErrorln("Unable to remove '" + userArg + "' from " + team.Name + ". Error: " + err.Error())
	}
}

func addUsersCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 2 {
		return errors.New("Not enough arguments.")
	}

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	users := getUsersFromUserArgs(a, args[1:])
	for i, user := range users {
		addUserToTeam(a, team, user, args[i+1])
	}

	return nil
}

func addUserToTeam(a *app.App, team *model.Team, user *model.User, userArg string) {
	if user == nil {
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return
	}
	if err := a.JoinUserToTeam(team, user, ""); err != nil {
		CommandPrintErrorln("Unable to add '" + userArg + "' to " + team.Name)
	}
}

func deleteTeamsCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Not enough arguments.")
	}

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		CommandPrettyPrintln("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
		CommandPrettyPrintln("Are you sure you want to delete the teams specified?  All data will be permanently deleted? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	teams := getTeamsFromTeamArgs(a, args)
	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		if err := deleteTeam(a, team); err != nil {
			CommandPrintErrorln("Unable to delete team '" + team.Name + "' error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted team '" + team.Name + "'")
		}
	}

	return nil
}

func deleteTeam(a *app.App, team *model.Team) *model.AppError {
	return a.PermanentDeleteTeam(team)
}
