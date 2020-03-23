// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/spf13/cobra"
)

var TeamCmd = &cobra.Command{
	Use:   "team",
	Short: "Management of teams",
}

var TeamCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a team",
	Long:  `Create a team.`,
	Example: `  team create --name mynewteam --display_name "My New Team"
  team create --name private --display_name "My New Private Team" --private`,
	RunE: createTeamCmdF,
}

var RemoveUsersCmd = &cobra.Command{
	Use:     "remove [team] [users]",
	Short:   "Remove users from team",
	Long:    "Remove some users from team",
	Example: "  team remove myteam user@example.com username",
	Args:    cobra.MinimumNArgs(2),
	RunE:    removeUsersCmdF,
}

var AddUsersCmd = &cobra.Command{
	Use:     "add [team] [users]",
	Short:   "Add users to team",
	Long:    "Add some users to team",
	Example: "  team add myteam user@example.com username",
	Args:    cobra.MinimumNArgs(2),
	RunE:    addUsersCmdF,
}

var DeleteTeamsCmd = &cobra.Command{
	Use:   "delete [teams]",
	Short: "Delete teams",
	Long: `Permanently delete some teams.
Permanently deletes a team along with all related information including posts from the database.`,
	Example: "  team delete myteam",
	Args:    cobra.MinimumNArgs(1),
	RunE:    deleteTeamsCmdF,
}

var ListTeamsCmd = &cobra.Command{
	Use:     "list",
	Short:   "List all teams.",
	Long:    `List all teams on the server.`,
	Example: "  team list",
	RunE:    listTeamsCmdF,
}

var SearchTeamCmd = &cobra.Command{
	Use:     "search [teams]",
	Short:   "Search for teams",
	Long:    "Search for teams based on name",
	Example: "  team search team1",
	Args:    cobra.MinimumNArgs(1),
	RunE:    searchTeamCmdF,
}

var ArchiveTeamCmd = &cobra.Command{
	Use:     "archive [teams]",
	Short:   "Archive teams",
	Long:    "Archive teams based on name",
	Example: "  team archive team1",
	Args:    cobra.MinimumNArgs(1),
	RunE:    archiveTeamCmdF,
}

var RestoreTeamsCmd = &cobra.Command{
	Use:     "restore [teams]",
	Short:   "Restore some teams",
	Long:    `Restore a previously deleted team`,
	Example: "  team restore myteam",
	Args:    cobra.MinimumNArgs(1),
	RunE:    restoreTeamsCmdF,
}

var TeamRenameCmd = &cobra.Command{
	Use:   "rename",
	Short: "Rename a team",
	Long:  `Rename a team.`,
	Example: `  team rename myteam newteamname --display_name "My New Team Name"
	team rename myteam - --display_name "My New Team Name"`,
	Args: cobra.MinimumNArgs(2),
	RunE: renameTeamCmdF,
}

var ModifyTeamCmd = &cobra.Command{
	Use:     "modify [team] [flag]",
	Short:   "Modify a team's privacy setting to public or private",
	Long:    `Modify a team's privacy setting to public or private.`,
	Example: "  team modify myteam --private",
	Args:    cobra.ExactArgs(1),
	RunE:    modifyTeamCmdF,
}

func init() {
	TeamCreateCmd.Flags().String("name", "", "Team Name")
	TeamCreateCmd.Flags().String("display_name", "", "Team Display Name")
	TeamCreateCmd.Flags().Bool("private", false, "Create a private team.")
	TeamCreateCmd.Flags().String("email", "", "Administrator Email (anyone with this email is automatically a team admin)")

	DeleteTeamsCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the team and a DB backup has been performed.")

	TeamRenameCmd.Flags().String("display_name", "", "Team Display Name")

	ModifyTeamCmd.Flags().Bool("private", false, "Convert the team to a private team")
	ModifyTeamCmd.Flags().Bool("public", false, "Convert the team to a public team")

	TeamCmd.AddCommand(
		TeamCreateCmd,
		RemoveUsersCmd,
		AddUsersCmd,
		DeleteTeamsCmd,
		ListTeamsCmd,
		SearchTeamCmd,
		ArchiveTeamCmd,
		RestoreTeamsCmd,
		TeamRenameCmd,
		ModifyTeamCmd,
	)
	RootCmd.AddCommand(TeamCmd)
}

func createTeamCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	name, errn := command.Flags().GetString("name")
	if errn != nil || name == "" {
		return errors.New("Name is required")
	}
	displayname, errdn := command.Flags().GetString("display_name")
	if errdn != nil || displayname == "" {
		return errors.New("Display Name is required")
	}
	email, _ := command.Flags().GetString("email")
	email = strings.ToLower(email)
	useprivate, _ := command.Flags().GetBool("private")

	teamType := model.TEAM_OPEN
	if useprivate {
		teamType = model.TEAM_INVITE
	}

	auditRec := a.MakeAuditRecord("createTeam", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()

	team := &model.Team{
		Name:        name,
		DisplayName: displayname,
		Email:       email,
		Type:        teamType,
	}

	if _, err := a.CreateTeam(team); err != nil {
		return errors.New("Team creation failed: " + err.Error())
	}

	auditRec.Success()
	auditRec.AddMeta("team", team)

	return nil
}

func removeUsersCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	auditRec := a.MakeAuditRecord("removeUsers", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}
	auditRec.AddMeta("team", team)

	var usersOk, usersErr []*model.User

	users := getUsersFromUserArgs(a, args[1:])
	for i, user := range users {
		if err := removeUserFromTeam(a, team, user, args[i+1]); err != nil {
			usersErr = append(usersErr, user)
		} else {
			usersOk = append(usersOk, user)
		}
	}

	auditRec.Success()
	auditRec.AddMeta("users", usersOk)
	auditRec.AddMeta("errors", usersErr)

	return nil
}

func removeUserFromTeam(a *app.App, team *model.Team, user *model.User, userArg string) error {
	if user == nil {
		err := fmt.Errorf("Can't find user '%s'", userArg)
		CommandPrintErrorln(err.Error())
		return err
	}
	if err := a.LeaveTeam(team, user, ""); err != nil {
		CommandPrintErrorln("Unable to remove '" + userArg + "' from " + team.Name + ". Error: " + err.Error())
		return err
	}
	return nil
}

func addUsersCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	auditRec := a.MakeAuditRecord("addUsers", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}
	auditRec.AddMeta("team", team)

	var usersOk, usersErr []*model.User

	users := getUsersFromUserArgs(a, args[1:])
	for i, user := range users {
		if err := addUserToTeam(a, team, user, args[i+1]); err != nil {
			usersErr = append(usersErr, user)
		} else {
			usersOk = append(usersOk, user)
		}
	}

	auditRec.Success()
	auditRec.AddMeta("users", usersOk)
	auditRec.AddMeta("errors", usersErr)

	return nil
}

func addUserToTeam(a *app.App, team *model.Team, user *model.User, userArg string) error {
	if user == nil {
		err := fmt.Errorf("Can't find user '%s'", userArg)
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return err
	}
	if err := a.JoinUserToTeam(team, user, ""); err != nil {
		CommandPrintErrorln("Unable to add '" + userArg + "' to " + team.Name)
		return err
	}
	return nil
}

func deleteTeamsCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	confirmFlag, _ := command.Flags().GetBool("confirm")
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

	auditRec := a.MakeAuditRecord("deleteTeams", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()

	var teamsOk, teamsErr []*model.Team

	teams := getTeamsFromTeamArgs(a, args)
	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		if err := deleteTeam(a, team); err != nil {
			CommandPrintErrorln("Unable to delete team '" + team.Name + "' error: " + err.Error())
			teamsErr = append(teamsErr, team)
		} else {
			CommandPrettyPrintln("Deleted team '" + team.Name + "'")
			teamsOk = append(teamsOk, team)
		}
	}

	auditRec.Success()
	auditRec.AddMeta("users", teamsOk)
	auditRec.AddMeta("errors", teamsErr)

	return nil
}

func deleteTeam(a *app.App, team *model.Team) *model.AppError {
	return a.PermanentDeleteTeam(team)
}

func listTeamsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	teams, err2 := a.GetAllTeams()
	if err2 != nil {
		return err2
	}

	for _, team := range teams {
		if team.DeleteAt > 0 {
			CommandPrettyPrintln(team.Name + " (archived)")
		} else {
			CommandPrettyPrintln(team.Name)
		}
	}

	return nil
}

func searchTeamCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	var teams []*model.Team

	for _, searchTerm := range args {
		foundTeams, _, err := a.SearchAllTeams(&model.TeamSearch{Term: searchTerm})
		if err != nil {
			return err
		}
		teams = append(teams, foundTeams...)
	}

	sortedTeams := removeDuplicatesAndSortTeams(teams)

	for _, team := range sortedTeams {
		if team.DeleteAt > 0 {
			CommandPrettyPrintln(team.Name + ": " + team.DisplayName + " (" + team.Id + ")" + " (archived)")
		} else {
			CommandPrettyPrintln(team.Name + ": " + team.DisplayName + " (" + team.Id + ")")
		}
	}

	return nil
}

// Restores archived teams by name
func restoreTeamsCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	auditRec := a.MakeAuditRecord("restoreTeams", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()

	var teamsOk, teamsErr []*model.Team

	teams := getTeamsFromTeamArgs(a, args)
	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		err := a.RestoreTeam(team.Id)
		if err != nil {
			CommandPrintErrorln("Unable to restore team '" + team.Name + "' error: " + err.Error())
			teamsErr = append(teamsErr, team)
		} else {
			teamsOk = append(teamsOk, team)
		}
	}

	auditRec.Success()
	auditRec.AddMeta("teams", teamsOk)
	auditRec.AddMeta("errors", teamsErr)

	return nil
}

// Removes duplicates and sorts teams by name
func removeDuplicatesAndSortTeams(teams []*model.Team) []*model.Team {
	keys := make(map[string]bool)
	result := []*model.Team{}
	for _, team := range teams {
		if _, value := keys[team.Name]; !value {
			keys[team.Name] = true
			result = append(result, team)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})
	return result
}

func archiveTeamCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	auditRec := a.MakeAuditRecord("archiveTeam", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()

	var teamsOk, teamsErr []*model.Team

	foundTeams := getTeamsFromTeamArgs(a, args)
	for i, team := range foundTeams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		if err := a.SoftDeleteTeam(team.Id); err != nil {
			CommandPrintErrorln("Unable to archive team '"+team.Name+"' error: ", err)
			teamsErr = append(teamsErr, team)
		} else {
			teamsOk = append(teamsOk, team)
		}
	}

	auditRec.Success()
	auditRec.AddMeta("teams", teamsOk)
	auditRec.AddMeta("errors", teamsErr)

	return nil
}

func renameTeamCmdF(command *cobra.Command, args []string) (cmdError error) {

	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	auditRec := a.MakeAuditRecord("renameTeam", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()
	auditRec.AddMeta("team", team)

	var newDisplayName, newTeamName string

	newTeamName = args[1]

	// let user use old team Name when only Display Name change is wanted
	if newTeamName == team.Name {
		newTeamName = "-"
	}

	newDisplayName, errdn := command.Flags().GetString("display_name")
	if errdn != nil {
		return errdn
	}

	updatedTeam, errrt := a.RenameTeam(team, newTeamName, newDisplayName)
	if errrt != nil {
		CommandPrintErrorln("Unable to rename team to '"+newTeamName+"' error: ", errrt)
	}

	auditRec.Success()
	auditRec.AddMeta("update", updatedTeam)

	return nil
}

func modifyTeamCmdF(command *cobra.Command, args []string) (cmdError error) {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	public, _ := command.Flags().GetBool("public")
	private, _ := command.Flags().GetBool("private")

	if public == private {
		return errors.New("You must specify only one of --public or --private")
	}

	auditRec := a.MakeAuditRecord("modifyTeam", audit.Fail)
	defer func() { a.LogAuditRec(auditRec, cmdError) }()
	auditRec.AddMeta("team", team)

	if public {
		team.Type = model.TEAM_OPEN
		team.AllowOpenInvite = true
	} else if private {
		team.Type = model.TEAM_INVITE
		team.AllowOpenInvite = false
	}

	if err := a.UpdateTeamPrivacy(team.Id, team.Type, team.AllowOpenInvite); err != nil {
		return errors.New("Failed to update privacy for team" + args[0])
	}

	auditRec.Success()
	auditRec.AddMeta("type", team.Type)
	auditRec.AddMeta("allow_open_invite", team.AllowOpenInvite)

	return nil
}
