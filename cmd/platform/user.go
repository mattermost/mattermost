// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var userCmd = &cobra.Command{
	Use:   "user",
	Short: "Management of users",
}

var userActivateCmd = &cobra.Command{
	Use:   "activate [emails, usernames, userIds]",
	Short: "Activate users",
	Long:  "Activate users that have been deactivated.",
	Example: `  user activate user@example.com
  user activate username`,
	RunE: userActivateCmdF,
}

var userDeactivateCmd = &cobra.Command{
	Use:   "deactivate [emails, usernames, userIds]",
	Short: "Deactivate users",
	Long:  "Deactivate users. Deactivated users are immediately logged out of all sessions and are unable to log back in.",
	Example: `  user deactivate user@example.com
  user deactivate username`,
	RunE: userDeactivateCmdF,
}

var userCreateCmd = &cobra.Command{
	Use:     "create",
	Short:   "Create a user",
	Long:    "Create a user",
	Example: `  user create --email user@example.com --username userexample --password Password1`,
	RunE:    userCreateCmdF,
}

var userInviteCmd = &cobra.Command{
	Use:   "invite [email] [teams]",
	Short: "Send user an email invite to a team.",
	Long: `Send user an email invite to a team.
You can invite a user to multiple teams by listing them.
You can specify teams by name or ID.`,
	Example: `  user invite user@example.com myteam
  user invite user@example.com myteam1 myteam2`,
	RunE: userInviteCmdF,
}

var resetUserPasswordCmd = &cobra.Command{
	Use:     "password [user] [password]",
	Short:   "Set a user's password",
	Long:    "Set a user's password",
	Example: "  user password user@example.com Password1",
	RunE:    resetUserPasswordCmdF,
}

var resetUserMfaCmd = &cobra.Command{
	Use:   "resetmfa [users]",
	Short: "Turn off MFA",
	Long: `Turn off multi-factor authentication for a user.
If MFA enforcement is enabled, the user will be forced to re-enable MFA as soon as they login.`,
	Example: "  user resetmfa user@example.com",
	RunE:    resetUserMfaCmdF,
}

var deleteUserCmd = &cobra.Command{
	Use:     "delete [users]",
	Short:   "Delete users and all posts",
	Long:    "Permanently delete user and all related information including posts.",
	Example: "  user delete user@example.com",
	RunE:    deleteUserCmdF,
}

var deleteAllUsersCmd = &cobra.Command{
	Use:     "deleteall",
	Short:   "Delete all users and all posts",
	Long:    "Permanently delete all users and all related information including posts.",
	Example: "  user deleteall",
	RunE:    deleteAllUsersCommandF,
}

var migrateAuthCmd = &cobra.Command{
	Use:     "migrate_auth [from_auth] [to_auth] [migration-options]",
	Short:   "Mass migrate user accounts authentication type",
	Long:    `Migrates accounts from one authentication provider to another. For example, you can upgrade your authentication provider from email to ldap.`,
	Example: "  user migrate_auth email saml users.json",
	Args: func(cmd *cobra.Command, args []string) error {
		if len(args) < 2 {
			return errors.New("Auth migration requires at least 2 arguments.")
		}

		toAuth := args[1]

		if toAuth != "ldap" && toAuth != "saml" {
			return errors.New("Invalid to_auth parameter, must be saml or ldap.")
		}

		if toAuth == "ldap" && len(args) != 3 {
			return errors.New("Ldap migration requires 3 arguments.")
		}

		autoFlag, _ := cmd.Flags().GetBool("auto")

		if toAuth == "saml" && autoFlag {
			if len(args) != 2 {
				return errors.New("Saml migration requires two argument when use --auto flag. See help text for details.")
			}
		}

		if toAuth == "saml" && !autoFlag {
			if len(args) != 3 {
				return errors.New("Saml migration requires three arguments when not use --auto flag. See help text for details.")
			}
		}
		return nil
	},
	RunE: migrateAuthCmdF,
}

var verifyUserCmd = &cobra.Command{
	Use:     "verify [users]",
	Short:   "Verify email of users",
	Long:    "Verify the emails of some users.",
	Example: "  user verify user1",
	RunE:    verifyUserCmdF,
}

var searchUserCmd = &cobra.Command{
	Use:     "search [users]",
	Short:   "Search for users",
	Long:    "Search for users based on username, email, or user ID.",
	Example: "  user search user1@mail.com user2@mail.com",
	RunE:    searchUserCmdF,
}

func init() {
	userCreateCmd.Flags().String("username", "", "Required. Username for the new user account.")
	userCreateCmd.Flags().String("email", "", "Required. The email address for the new user account.")
	userCreateCmd.Flags().String("password", "", "Required. The password for the new user account.")
	userCreateCmd.Flags().String("nickname", "", "Optional. The nickname for the new user account.")
	userCreateCmd.Flags().String("firstname", "", "Optional. The first name for the new user account.")
	userCreateCmd.Flags().String("lastname", "", "Optional. The last name for the new user account.")
	userCreateCmd.Flags().String("locale", "", "Optional. The locale (ex: en, fr) for the new user account.")
	userCreateCmd.Flags().Bool("system_admin", false, "Optional. If supplied, the new user will be a system administrator. Defaults to false.")

	deleteUserCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the user and a DB backup has been performed.")

	deleteAllUsersCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the user and a DB backup has been performed.")

	migrateAuthCmd.Flags().Bool("force", false, "Force the migration to occour even if there are duplicates on the LDAP server. Duplicates will not be migrated. (ldap only)")
	migrateAuthCmd.Flags().Bool("auto", false, "Auto migrate all users assuming that the SAML service usernames and emails are identical to the mattermost usernames and emails. (saml only)")
	migrateAuthCmd.Flags().Bool("dryRun", false, "Run a simulation of the migration process without changing the database.")
	migrateAuthCmd.SetUsageTemplate(`Usage:
  platform user migrate_auth [from_auth] [to_auth] [migration-options] [flags]

Examples:
{{.Example}}

Arguments:
  from_auth:
    The authentication service to migrate users accounts from.
    Supported options: email, gitlab, ldap.

  to_auth:
    The authentication service to migrate users to.
    Supported options: ldap, saml.

  migration-options:
    Migration specific options, full command help for more information.

Flags:
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}

Global Flags:
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}
`)
	migrateAuthCmd.SetHelpTemplate(`Usage:
  platform user migrate_auth [from_auth] [to_auth] [migration-options] [flags]

Examples:
{{.Example}}

Arguments:
  from_auth:
    The authentication service to migrate users accounts from.
    Supported options: email, gitlab, ldap.

  to_auth:
    The authentication service to migrate users to.
    Supported options: ldap, saml.

  migration-options (ldap):
    match_field:
      The field that is guaranteed to be the same in both authentication services. For example, if the users emails are consistent set to email.
      Supported options: email, username.

  migration-options (saml):
    users_file:
      The path of a json file with the usernames and emails of all users to migrate to SAML. The username and email must be the same that the SAML service provider store. And the email must match with the email in mattermost database.

      Example json content:
        {
          "usr1@email.com": "usr.one",
          "usr2@email.com": "usr.two"
        }

Flags:
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}

Global Flags:
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}
`)

	userCmd.AddCommand(
		userActivateCmd,
		userDeactivateCmd,
		userCreateCmd,
		userInviteCmd,
		resetUserPasswordCmd,
		resetUserMfaCmd,
		deleteUserCmd,
		deleteAllUsersCmd,
		migrateAuthCmd,
		verifyUserCmd,
		searchUserCmd,
	)
}

func userActivateCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	changeUsersActiveStatus(a, args, true)
	return nil
}

func changeUsersActiveStatus(a *app.App, userArgs []string, active bool) {
	users := getUsersFromUserArgs(a, userArgs)
	for i, user := range users {
		err := changeUserActiveStatus(a, user, userArgs[i], active)

		if err != nil {
			CommandPrintErrorln(err.Error())
		}
	}
}

func changeUserActiveStatus(a *app.App, user *model.User, userArg string, activate bool) error {
	if user == nil {
		return fmt.Errorf("Can't find user '%v'", userArg)
	}
	if user.IsSSOUser() {
		fmt.Println("You must also deactivate this user in the SSO provider or they will be reactivated on next login or sync.")
	}
	if _, err := a.UpdateActive(user, activate); err != nil {
		return fmt.Errorf("Unable to change activation status of user: %v", userArg)
	}

	return nil
}

func userDeactivateCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	changeUsersActiveStatus(a, args, false)
	return nil
}

func userCreateCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	username, erru := cmd.Flags().GetString("username")
	if erru != nil || username == "" {
		return errors.New("Username is required")
	}
	email, erre := cmd.Flags().GetString("email")
	if erre != nil || email == "" {
		return errors.New("Email is required")
	}
	password, errp := cmd.Flags().GetString("password")
	if errp != nil || password == "" {
		return errors.New("Password is required")
	}
	nickname, _ := cmd.Flags().GetString("nickname")
	firstname, _ := cmd.Flags().GetString("firstname")
	lastname, _ := cmd.Flags().GetString("lastname")
	locale, _ := cmd.Flags().GetString("locale")
	systemAdmin, _ := cmd.Flags().GetBool("system_admin")

	user := &model.User{
		Username:  username,
		Email:     email,
		Password:  password,
		Nickname:  nickname,
		FirstName: firstname,
		LastName:  lastname,
		Locale:    locale,
	}

	if ruser, err := a.CreateUser(user); err != nil {
		return errors.New("Unable to create user. Error: " + err.Error())
	} else if systemAdmin {
		a.UpdateUserRoles(ruser.Id, "system_user system_admin", false)
	}

	CommandPrettyPrintln("Created User")

	return nil
}

func userInviteCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 2 {
		return errors.New("Expected at least two arguments. See help text for details.")
	}

	email := args[0]
	if !model.IsValidEmail(email) {
		return errors.New("Invalid email")
	}

	teams := getTeamsFromTeamArgs(a, args[1:])
	for i, team := range teams {
		err := inviteUser(a, email, team, args[i+1])

		if err != nil {
			CommandPrintErrorln(err.Error())
		}
	}

	return nil
}

func inviteUser(a *app.App, email string, team *model.Team, teamArg string) error {
	invites := []string{email}
	if team == nil {
		return fmt.Errorf("Can't find team '%v'", teamArg)
	}

	a.SendInviteEmails(team, "Administrator", invites, *a.Config().ServiceSettings.SiteURL)
	CommandPrettyPrintln("Invites may or may not have been sent.")

	return nil
}

func resetUserPasswordCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) != 2 {
		return errors.New("Expected two arguments. See help text for details.")
	}

	user := getUserFromUserArg(a, args[0])
	if user == nil {
		return errors.New("Unable to find user '" + args[0] + "'")
	}
	password := args[1]

	if result := <-a.Srv.Store.User().UpdatePassword(user.Id, model.HashPassword(password)); result.Err != nil {
		return result.Err
	}

	return nil
}

func resetUserMfaCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	users := getUsersFromUserArgs(a, args)

	for i, user := range users {
		if user == nil {
			return errors.New("Unable to find user '" + args[i] + "'")
		}

		if err := a.DeactivateMfa(user.Id); err != nil {
			return err
		}
	}

	return nil
}

func deleteUserCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		CommandPrettyPrintln("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
		CommandPrettyPrintln("Are you sure you want to permanently delete the specified users? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	users := getUsersFromUserArgs(a, args)

	for i, user := range users {
		if user == nil {
			return errors.New("Unable to find user '" + args[i] + "'")
		}

		if err := a.PermanentDeleteUser(user); err != nil {
			return err
		}
	}

	return nil
}

func deleteAllUsersCommandF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) > 0 {
		return errors.New("Expected zero arguments.")
	}

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		CommandPrettyPrintln("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
		CommandPrettyPrintln("Are you sure you want to permanently delete all user accounts? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	if err := a.PermanentDeleteAllUsers(); err != nil {
		return err
	}

	CommandPrettyPrintln("All user accounts successfully deleted.")
	return nil
}

func migrateAuthCmdF(cmd *cobra.Command, args []string) error {
	if args[1] == "saml" {
		return migrateAuthToSamlCmdF(cmd, args)
	}
	return migrateAuthToLdapCmdF(cmd, args)
}

func migrateAuthToLdapCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	fromAuth := args[0]
	matchField := args[1]

	if len(fromAuth) == 0 || (fromAuth != "email" && fromAuth != "gitlab" && fromAuth != "saml") {
		return errors.New("Invalid from_auth argument")
	}

	// Email auth in Mattermost system is represented by ""
	if fromAuth == "email" {
		fromAuth = ""
	}

	if len(matchField) == 0 || (matchField != "email" && matchField != "username") {
		return errors.New("Invalid match_field argument")
	}

	forceFlag, _ := cmd.Flags().GetBool("force")
	dryRunFlag, _ := cmd.Flags().GetBool("dryRun")

	if migrate := a.AccountMigration; migrate != nil {
		if err := migrate.MigrateToLdap(fromAuth, matchField, forceFlag, dryRunFlag); err != nil {
			return errors.New("Error while migrating users: " + err.Error())
		}

		CommandPrettyPrintln("Sucessfully migrated accounts.")
	}

	return nil
}

func migrateAuthToSamlCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	dryRunFlag, _ := cmd.Flags().GetBool("dryRun")
	autoFlag, _ := cmd.Flags().GetBool("auto")

	matchesFile := ""
	matches := map[string]string{}
	if !autoFlag {
		matchesFile = args[1]

		file, e := ioutil.ReadFile(matchesFile)
		if e != nil {
			return errors.New("Invalid users file.")
		}
		if json.Unmarshal(file, &matches) != nil {
			return errors.New("Invalid users file.")
		}
	}

	fromAuth := args[0]

	if len(fromAuth) == 0 || (fromAuth != "email" && fromAuth != "gitlab" && fromAuth != "ldap") {
		return errors.New("Invalid from_auth argument")
	}

	if autoFlag && !dryRunFlag {
		var confirm string
		CommandPrettyPrintln("You are about to perform an automatic \"" + fromAuth + " to saml\" migration, this must be done only if you are sure your current mattermost users using " + fromAuth + " auth have the same username and email in your SAML service, otherwise you must provide the users and emails from your Saml Service using the \"users file\" instead of \"--auto\" option. Do you want to proceed with auto migration anyway? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	// Email auth in Mattermost system is represented by ""
	if fromAuth == "email" {
		fromAuth = ""
	}

	if migrate := a.AccountMigration; migrate != nil {
		if err := migrate.MigrateToSaml(fromAuth, matches, autoFlag, dryRunFlag); err != nil {
			return errors.New("Error while migrating users: " + err.Error())
		}
		l4g.Close()
		CommandPrettyPrintln("Sucessfully migrated accounts.")
	}

	return nil
}

func verifyUserCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	users := getUsersFromUserArgs(a, args)

	for i, user := range users {
		if user == nil {
			CommandPrintErrorln("Unable to find user '" + args[i] + "'")
			continue
		}
		if cresult := <-a.Srv.Store.User().VerifyEmail(user.Id); cresult.Err != nil {
			CommandPrintErrorln("Unable to verify '" + args[i] + "' email. Error: " + cresult.Err.Error())
		}
	}

	return nil
}

func searchUserCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	users := getUsersFromUserArgs(a, args)

	for i, user := range users {
		if i > 0 {
			CommandPrettyPrintln("------------------------------")
		}
		if user == nil {
			CommandPrintErrorln("Unable to find user '" + args[i] + "'")
			continue
		}

		CommandPrettyPrintln("id: " + user.Id)
		CommandPrettyPrintln("username: " + user.Username)
		CommandPrettyPrintln("nickname: " + user.Nickname)
		CommandPrettyPrintln("position: " + user.Position)
		CommandPrettyPrintln("first_name: " + user.FirstName)
		CommandPrettyPrintln("last_name: " + user.LastName)
		CommandPrettyPrintln("email: " + user.Email)
		CommandPrettyPrintln("auth_service: " + user.AuthService)
	}

	return nil
}
