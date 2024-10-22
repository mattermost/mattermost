// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var UserCmd = &cobra.Command{
	Use:   "user",
	Short: "Management of users",
}

var UserActivateCmd = &cobra.Command{
	Use:   "activate [emails, usernames, userIds]",
	Short: "Activate users",
	Long:  "Activate users that have been deactivated.",
	Example: `  user activate user@example.com
  user activate username`,
	ValidArgsFunction: validateArgsWithClient(userActivateCompletionF),
	Args:              cobra.MinimumNArgs(1),
	RunE:              withClient(userActivateCmdF),
}

var UserDeactivateCmd = &cobra.Command{
	Use:   "deactivate [emails, usernames, userIds]",
	Short: "Deactivate users",
	Long:  "Deactivate users. Deactivated users are immediately logged out of all sessions and are unable to log back in.",
	Example: `  user deactivate user@example.com
  user deactivate username`,
	ValidArgsFunction: validateArgsWithClient(userDeactivateCompletionF),
	Args:              cobra.MinimumNArgs(1),
	RunE:              withClient(userDeactivateCmdF),
}

var UserCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a user",
	Long:  "Create a user",
	Example: `  # You can create a user
  $ mmctl user create --email user@example.com --username userexample --password Password1

  # You can define optional fields like first name, last name and nick name too
  $ mmctl user create --email user@example.com --username userexample --password Password1 --firstname User --lastname Example --nickname userex

  # Also you can create the user as system administrator
  $ mmctl user create --email user@example.com --username userexample --password Password1 --system-admin

  # Finally you can verify user on creation if you have enough permissions
  $ mmctl user create --email user@example.com --username userexample --password Password1 --system-admin --email-verified`,
	RunE: withClient(userCreateCmdF),
}

var UserInviteCmd = &cobra.Command{
	Use:   "invite [email] [teams]",
	Short: "Send user an email invite to a team.",
	Long: `Send user an email invite to a team.
You can invite a user to multiple teams by listing them.
You can specify teams by name or ID.`,
	Example: `  user invite user@example.com myteam
  user invite user@example.com myteam1 myteam2`,
	RunE: withClient(userInviteCmdF),
}

var SendPasswordResetEmailCmd = &cobra.Command{
	Use:     "reset-password [users]",
	Aliases: []string{"reset_password"},
	Short:   "Send users an email to reset their password",
	Long:    "Send users an email to reset their password",
	Example: "  user reset-password user@example.com",
	RunE:    withClient(sendPasswordResetEmailCmdF),
}

var UpdateUserEmailCmd = &cobra.Command{
	Use:     "email [user] [new email]",
	Short:   "Change email of the user",
	Long:    "Change the email address associated with a user.",
	Example: "  user email testuser user@example.com",
	RunE:    withClient(updateUserEmailCmdF),
}

var UpdateUsernameCmd = &cobra.Command{
	Use:     "username [user] [new username]",
	Short:   "Change username of the user",
	Long:    "Change username of the user.",
	Example: "  user username testuser newusername",
	Args:    cobra.ExactArgs(2),
	RunE:    withClient(updateUsernameCmdF),
}

var ChangePasswordUserCmd = &cobra.Command{
	Use:   "change-password <user>",
	Short: "Changes a user's password",
	Long:  "Changes the password of a user by a new one provided. If the user is changing their own password, the flag --current must indicate the current password. The flag --hashed can be used to indicate that the new password has been introduced already hashed",
	Example: `  # if you have system permissions, you can change other user's passwords
  $ mmctl user change-password john_doe --password new-password

  # if you are changing your own password, you need to provide the current one
  $ mmctl user change-password my-username --current current-password --password new-password

  # you can ommit these flags to introduce them interactively
  $ mmctl user change-password my-username
  Are you changing your own password? (YES/NO): YES
  Current password:
  New password:

  # if you have system permissions, you can update the password with the already hashed new
  # password. The hashing method should be the same that the server uses internally
  $ mmctl user change-password john_doe --password HASHED_PASSWORD --hashed`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(changePasswordUserCmdF),
}

var ResetUserMfaCmd = &cobra.Command{
	Use:   "resetmfa [users]",
	Short: "Turn off MFA",
	Long: `Turn off multi-factor authentication for a user.
If MFA enforcement is enabled, the user will be forced to re-enable MFA as soon as they log in.`,
	Example: "  user resetmfa user@example.com",
	RunE:    withClient(resetUserMfaCmdF),
}

var DeleteUsersCmd = &cobra.Command{
	Use:   "delete [users]",
	Short: "Delete users",
	Long: `Permanently delete some users.
Permanently deletes one or multiple users along with all related information including posts from the database.`,
	Example: "  user delete user@example.com",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(deleteUsersCmdF),
}

var DeleteAllUsersCmd = &cobra.Command{
	Use:     "deleteall",
	Short:   "Delete all users and all posts. Local command only.",
	Long:    "Permanently delete all users and all related information including posts. This command can only be run in local mode.",
	Example: "  user deleteall",
	Args:    cobra.NoArgs,
	PreRun:  localOnlyPrecheck,
	RunE:    withClient(deleteAllUsersCmdF),
}

var SearchUserCmd = &cobra.Command{
	Use:     "search [users]",
	Short:   "Search for users",
	Long:    "Search for users based on username, email, or user ID.",
	Example: "  user search user1@mail.com user2@mail.com",
	RunE:    withClient(searchUserCmdF),
}

var ListUsersCmd = &cobra.Command{
	Use:     "list",
	Short:   "List users",
	Long:    "List all users",
	Example: "  user list",
	RunE:    withClient(listUsersCmdF),
	Args:    cobra.NoArgs,
}

var VerifyUserEmailWithoutTokenCmd = &cobra.Command{
	Use:     "verify [users]",
	Short:   "Mark user's email as verified",
	Long:    "Mark user's email as verified without requiring user to complete email verification path.",
	Example: "  user verify user1",
	RunE:    withClient(verifyUserEmailWithoutTokenCmdF),
	Args:    cobra.MinimumNArgs(1),
}

var PromoteGuestToUserCmd = &cobra.Command{
	Use:     "promote [guests]",
	Short:   "Promote guests to users",
	Long:    "Convert a guest into a regular user.",
	Example: "  user promote guest1 guest2",
	RunE:    withClient(promoteGuestToUserCmdF),
	Args:    cobra.MinimumNArgs(1),
}

var DemoteUserToGuestCmd = &cobra.Command{
	Use:     "demote [users]",
	Short:   "Demote users to guests",
	Long:    "Convert a regular user into a guest.",
	Example: "  user demote user1 user2",
	RunE:    withClient(demoteUserToGuestCmdF),
	Args:    cobra.MinimumNArgs(1),
}

var UserConvertCmd = &cobra.Command{
	Use:   "convert (--bot [emails] [usernames] [userIds] | --user <username> --password PASSWORD [--email EMAIL])",
	Short: "Convert users to bots, or a bot to a user",
	Long:  "Convert user accounts to bots or convert bots to user accounts.",
	Example: `  # you can convert a user to a bot providing its email, id or username
  $ mmctl user convert user@example.com --bot

  # or multiple users in one go
  $ mmctl user convert user@example.com anotherUser --bot

  # you can convert a bot to a user specifying the email and password that the user will have after conversion
  $ mmctl user convert botusername --email new.email@email.com --password password --user`,
	RunE: withClient(userConvertCmdF),
	Args: cobra.MinimumNArgs(1),
}

const migrateAuthCmdDoc = `Migrates accounts from one authentication provider to either LDAP or SAML. For example, you can upgrade your authentication provider from Email to LDAP.

Arguments:
  from_auth:
    The authentication service to migrate users accounts from.
    Supported options: email, gitlab, google, ldap, office365, saml.

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
`

var MigrateAuthCmd = &cobra.Command{
	Use:     "migrate-auth [from_auth] [to_auth] [migration-options]",
	Aliases: []string{"migrate_auth"},
	Short:   "Mass migrate user accounts authentication type",
	Long:    migrateAuthCmdDoc,
	Example: "user migrate-auth email saml users.json",
	Args: func(command *cobra.Command, args []string) error {
		if len(args) < 2 {
			return errors.New("auth migration requires at least 2 arguments")
		}

		toAuth := args[1]

		if toAuth != "ldap" && toAuth != "saml" { // nolint: goconst
			return errors.New("invalid to_auth parameter, must be saml or ldap")
		}

		if toAuth == "ldap" && len(args) != 3 {
			return errors.New("ldap migration requires 3 arguments")
		}

		autoFlag, _ := command.Flags().GetBool("auto")

		if toAuth == "saml" && autoFlag {
			if len(args) != 2 {
				return errors.New("saml migration requires two arguments when using the --auto flag")
			}
		}

		if toAuth == "saml" && !autoFlag {
			if len(args) != 3 {
				return errors.New("saml migration requires three arguments when not using the --auto flag")
			}
		}
		return nil
	},
	RunE: withClient(migrateAuthCmdF),
}

var PreferenceCmd = &cobra.Command{
	Use:     "preference",
	Aliases: []string{"pref"},
	Short:   "Manage user preferences",
}

var PreferenceListCmd = &cobra.Command{
	Use:     "list [--category category] [users]",
	Short:   "List user preferences",
	Example: "preference list user@example.com",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(preferencesListCmdF),
}

var PreferenceGetCmd = &cobra.Command{
	Use:     "get --category [category] --name [name] [users]",
	Short:   "Get a specific user preference",
	Example: "preference get --category display_settings --name use_military_time user@example.com",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(preferencesGetCmdF),
}

var PreferenceUpdateCmd = &cobra.Command{
	Use:     "set --category [category] --name [name] --value [value] [users]",
	Aliases: []string{"update"},
	Short:   "Set a specific user preference",
	Example: "preference set --category display_settings --name use_military_time --value true user@example.com",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(preferencesUpdateCmdF),
}

var PreferenceDeleteCmd = &cobra.Command{
	Use:     "delete --category [category] --name [name] [users]",
	Short:   "Delete a specific user preference",
	Example: "preference delete --category display_settings --name use_military_time user@example.com",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(preferencesDeleteCmdF),
}

func init() {
	UserCreateCmd.Flags().String("username", "", "Required. Username for the new user account")
	_ = UserCreateCmd.MarkFlagRequired("username")
	UserCreateCmd.Flags().String("email", "", "Required. The email address for the new user account")
	_ = UserCreateCmd.MarkFlagRequired("email")
	UserCreateCmd.Flags().String("password", "", "Required. The password for the new user account")
	_ = UserCreateCmd.MarkFlagRequired("password")
	UserCreateCmd.Flags().String("nickname", "", "Optional. The nickname for the new user account")
	UserCreateCmd.Flags().String("firstname", "", "Optional. The first name for the new user account")
	UserCreateCmd.Flags().String("lastname", "", "Optional. The last name for the new user account")
	UserCreateCmd.Flags().String("locale", "", "Optional. The locale (ex: en, fr) for the new user account")
	UserCreateCmd.Flags().Bool("system-admin", false, "Optional. If supplied, the new user will be a system administrator. Defaults to false")
	UserCreateCmd.Flags().Bool("system_admin", false, "")
	_ = UserCreateCmd.Flags().MarkDeprecated("system_admin", "please use system-admin instead")
	UserCreateCmd.Flags().Bool("guest", false, "Optional. If supplied, the new user will be a guest. Defaults to false")
	UserCreateCmd.Flags().Bool("email-verified", false, "Optional. If supplied, the new user will have the email verified. Defaults to false")
	UserCreateCmd.Flags().Bool("email_verified", false, "")
	_ = UserCreateCmd.Flags().MarkDeprecated("email_verified", "please use email-verified instead")
	UserCreateCmd.Flags().Bool("disable-welcome-email", false, "Optional. If supplied, the new user will not receive a welcome email. Defaults to false")

	DeleteUsersCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the user and a DB backup has been performed")
	DeleteAllUsersCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the user and a DB backup has been performed")

	ListUsersCmd.Flags().Int("page", 0, "Page number to fetch for the list of users")
	ListUsersCmd.Flags().Int("per-page", DefaultPageSize, "Number of users to be fetched")
	ListUsersCmd.Flags().Bool("all", false, "Fetch all users. --page flag will be ignore if provided")
	ListUsersCmd.Flags().String("team", "", "If supplied, only users belonging to this team will be listed")
	ListUsersCmd.Flags().Bool("inactive", false, "If supplied, only users which are inactive will be fetch")

	UserConvertCmd.Flags().Bool("bot", false, "If supplied, convert users to bots")
	UserConvertCmd.Flags().Bool("user", false, "If supplied, convert a bot to a user")
	UserConvertCmd.Flags().String("password", "", "The password for converted new user account. Required when \"user\" flag is set")
	UserConvertCmd.Flags().String("username", "", "Username for the converted user account. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().String("email", "", "The email address for the converted user account. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().String("nickname", "", "The nickname for the converted user account. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().String("firstname", "", "The first name for the converted user account. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().String("lastname", "", "The last name for the converted user account. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().String("locale", "", "The locale (ex: en, fr) for converted new user account. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().Bool("system-admin", false, "If supplied, the converted user will be a system administrator. Defaults to false. Required when the \"bot\" flag is set")
	UserConvertCmd.Flags().Bool("system_admin", false, "")
	_ = UserConvertCmd.Flags().MarkDeprecated("system_admin", "please use system-admin instead")

	ChangePasswordUserCmd.Flags().StringP("current", "c", "", "The current password of the user. Use only if changing your own password")
	ChangePasswordUserCmd.Flags().StringP("password", "p", "", "The new password for the user")
	ChangePasswordUserCmd.Flags().Bool("hashed", false, "The supplied password is already hashed")

	MigrateAuthCmd.Flags().Bool("force", false, "Force the migration to occur even if there are duplicates on the LDAP server. Duplicates will not be migrated. (ldap only)")
	MigrateAuthCmd.Flags().Bool("auto", false, "Automatically migrate all users. Assumes the usernames and emails are identical between Mattermost and SAML services. (saml only)")
	MigrateAuthCmd.Flags().Bool("confirm", false, "Confirm you really want to proceed with auto migration. (saml only)")
	MigrateAuthCmd.SetHelpTemplate(`Usage:
  mmctl user migrate-auth [from_auth] [to_auth] [migration-options] [flags]

Examples:
  mmctl {{.Example}}

` + migrateAuthCmdDoc + `

Flags:
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}

Global Flags:
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}
`)

	PreferenceListCmd.Flags().StringP("category", "c", "", "The optional category by which to filter")
	PreferenceGetCmd.Flags().StringP("category", "c", "", "The category of the preference")
	PreferenceGetCmd.Flags().StringP("name", "n", "", "The name of the preference")
	_ = PreferenceGetCmd.MarkFlagRequired("category")
	_ = PreferenceGetCmd.MarkFlagRequired("name")
	PreferenceUpdateCmd.Flags().StringP("category", "c", "", "The category of the preference")
	PreferenceUpdateCmd.Flags().StringP("name", "n", "", "The name of the preference")
	PreferenceUpdateCmd.Flags().StringP("value", "v", "", "The value of the preference")
	_ = PreferenceUpdateCmd.MarkFlagRequired("category")
	_ = PreferenceUpdateCmd.MarkFlagRequired("name")
	_ = PreferenceUpdateCmd.MarkFlagRequired("value")
	PreferenceDeleteCmd.Flags().StringP("category", "c", "", "The category of the preference")
	PreferenceDeleteCmd.Flags().StringP("name", "n", "", "The name of the preference")
	_ = PreferenceDeleteCmd.MarkFlagRequired("category")
	_ = PreferenceDeleteCmd.MarkFlagRequired("name")

	UserCmd.AddCommand(
		UserActivateCmd,
		UserDeactivateCmd,
		UserCreateCmd,
		UserInviteCmd,
		SendPasswordResetEmailCmd,
		UpdateUserEmailCmd,
		UpdateUsernameCmd,
		ChangePasswordUserCmd,
		ResetUserMfaCmd,
		DeleteUsersCmd,
		DeleteAllUsersCmd,
		SearchUserCmd,
		ListUsersCmd,
		VerifyUserEmailWithoutTokenCmd,
		UserConvertCmd,
		MigrateAuthCmd,
		PromoteGuestToUserCmd,
		DemoteUserToGuestCmd,
		PreferenceCmd,
	)
	PreferenceCmd.AddCommand(
		PreferenceListCmd,
		PreferenceGetCmd,
		PreferenceUpdateCmd,
		PreferenceDeleteCmd,
	)

	RootCmd.AddCommand(UserCmd)
}

func userActivateCmdF(c client.Client, command *cobra.Command, args []string) error {
	return changeUsersActiveStatus(c, args, true)
}

func userActivateCompletionF(ctx context.Context, c client.Client, cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return fetchAndComplete(
		func(ctx context.Context, c client.Client, page, perPage int) ([]*model.User, *model.Response, error) {
			return c.GetUsersWithCustomQueryParameters(ctx, page, perPage, "inactive=true", "")
		},
		func(u *model.User) []string { return []string{u.Id, u.Username, u.Email} },
	)(ctx, c, cmd, args, toComplete)
}

func changeUsersActiveStatus(c client.Client, userArgs []string, active bool) error {
	var multiErr *multierror.Error
	users, err := getUsersFromArgs(c, userArgs)
	if err != nil {
		printer.PrintError(err.Error())
		multiErr = multierror.Append(multiErr, err)
	}
	for _, user := range users {
		if err := changeUserActiveStatus(c, user, active); err != nil {
			printer.PrintError(err.Error())
			multiErr = multierror.Append(multiErr, err)
		}
	}
	return multiErr.ErrorOrNil()
}

func changeUserActiveStatus(c client.Client, user *model.User, activate bool) error {
	if !activate && user.IsSSOUser() {
		printer.Print("You must also deactivate user " + user.Id + " in the SSO provider or they will be reactivated on next login or sync.")
	}
	if _, err := c.UpdateUserActive(context.TODO(), user.Id, activate); err != nil {
		return fmt.Errorf("unable to change activation status of user: %v", user.Id)
	}

	return nil
}

func userDeactivateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	return changeUsersActiveStatus(c, args, false)
}

func userDeactivateCompletionF(ctx context.Context, c client.Client, cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return fetchAndComplete(
		func(ctx context.Context, c client.Client, page, perPage int) ([]*model.User, *model.Response, error) {
			return c.GetUsersWithCustomQueryParameters(ctx, page, perPage, "active=true", "")
		},
		func(u *model.User) []string { return []string{u.Id, u.Username, u.Email} },
	)(ctx, c, cmd, args, toComplete)
}

func userCreateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	username, erru := cmd.Flags().GetString("username")
	if erru != nil {
		return errors.Wrap(erru, "Username is required")
	}
	email, erre := cmd.Flags().GetString("email")
	if erre != nil {
		return errors.Wrap(erre, "Email is required")
	}
	password, errp := cmd.Flags().GetString("password")
	if errp != nil {
		return errors.Wrap(errp, "Password is required")
	}
	nickname, _ := cmd.Flags().GetString("nickname")
	firstname, _ := cmd.Flags().GetString("firstname")
	lastname, _ := cmd.Flags().GetString("lastname")
	locale, _ := cmd.Flags().GetString("locale")
	systemAdmin, _ := cmd.Flags().GetBool("system-admin")
	if !systemAdmin {
		systemAdmin, _ = cmd.Flags().GetBool("system_admin")
	}
	guest, _ := cmd.Flags().GetBool("guest")
	emailVerified, _ := cmd.Flags().GetBool("email-verified")
	if !emailVerified {
		emailVerified, _ = cmd.Flags().GetBool("email_verified")
	}
	disableWelcomeEmail, _ := cmd.Flags().GetBool("disable-welcome-email")

	user := &model.User{
		Username:            username,
		Email:               email,
		Password:            password,
		Nickname:            nickname,
		FirstName:           firstname,
		LastName:            lastname,
		Locale:              locale,
		EmailVerified:       emailVerified,
		DisableWelcomeEmail: disableWelcomeEmail,
	}

	ruser, _, err := c.CreateUser(context.TODO(), user)

	if err != nil {
		return errors.New("Unable to create user. Error: " + err.Error())
	}

	if systemAdmin {
		if _, err := c.UpdateUserRoles(context.TODO(), ruser.Id, "system_user system_admin"); err != nil {
			return errors.New("Unable to update user roles. Error: " + err.Error())
		}
	} else if guest {
		if _, err := c.DemoteUserToGuest(context.TODO(), ruser.Id); err != nil {
			return errors.Wrapf(err, "Unable to demote use to guest")
		}
	}

	printer.PrintT("Created user {{.Username}}", ruser)

	return nil
}

func userInviteCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	var errs *multierror.Error
	if len(args) < 2 {
		return errors.New("expected at least two arguments. See help text for details")
	}

	email := args[0]
	if !model.IsValidEmail(email) {
		errs = multierror.Append(errs, fmt.Errorf("invalid email %q", email))
	}

	teams := getTeamsFromTeamArgs(c, args[1:])
	for i, team := range teams {
		err := inviteUser(c, email, team, args[i+1])
		if err != nil {
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
		}
	}

	return errs.ErrorOrNil()
}

func inviteUser(c client.Client, email string, team *model.Team, teamArg string) error {
	invites := []string{email}
	if team == nil {
		return fmt.Errorf("can't find team '%v'", teamArg)
	}

	if _, err := c.InviteUsersToTeam(context.TODO(), team.Id, invites); err != nil {
		return errors.New("Unable to invite user with email " + email + " to team " + team.Name + ". Error: " + err.Error())
	}

	printer.Print("Invites may or may not have been sent.")

	return nil
}

func sendPasswordResetEmailCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) < 1 {
		return errors.New("expected at least one argument. See help text for details")
	}

	var result *multierror.Error

	for _, email := range args {
		if !model.IsValidEmail(email) {
			result = multierror.Append(result, fmt.Errorf("invalid email '%s'", email))
			printer.PrintError("Invalid email '" + email + "'")
			continue
		}
		if _, err := c.SendPasswordResetEmail(context.TODO(), email); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable send reset password email to email %s: %w", email, err))
			printer.PrintError("Unable send reset password email to email " + email + ". Error: " + err.Error())
		}
	}

	return result.ErrorOrNil()
}

func updateUserEmailCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	if len(args) != 2 {
		return errors.New("expected two arguments. See help text for details")
	}

	newEmail := args[1]

	if !model.IsValidEmail(newEmail) {
		return errors.New("invalid email: '" + newEmail + "'")
	}

	user, err := getUserFromArg(c, args[0])
	if err != nil {
		return err
	}

	user.Email = newEmail

	ruser, _, err := c.UpdateUser(context.TODO(), user)
	if err != nil {
		return errors.New(err.Error())
	}

	printer.PrintT("User {{.Username}} updated successfully", ruser)

	return nil
}

func updateUsernameCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	newUsername := args[1]

	if !model.IsValidUsername(newUsername) {
		return errors.New("invalid username: '" + newUsername + "'")
	}

	user := getUserFromUserArg(c, args[0])
	if user == nil {
		return errors.New("unable to find user '" + args[0] + "'")
	}

	user.Username = newUsername

	ruser, _, err := c.UpdateUser(context.TODO(), user)
	if err != nil {
		return errors.New(err.Error())
	}

	printer.PrintT("User {{.Username}} updated successfully", ruser)

	return nil
}

func changePasswordUserCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	password, _ := cmd.Flags().GetString("password")
	current, _ := cmd.Flags().GetString("current")
	hashed, _ := cmd.Flags().GetBool("hashed")

	if password == "" {
		if err := getConfirmation("Are you changing your own password?", false); err == nil {
			fmt.Printf("Current password: ")
			var err error
			current, err = getPasswordFromStdin()
			if err != nil {
				return errors.Wrap(err, "couldn't read password")
			}
		}

		fmt.Printf("New password: ")
		var err error
		password, err = getPasswordFromStdin()
		if err != nil {
			return errors.Wrap(err, "couldn't read password")
		}
	}

	user, err := getUserFromArg(c, args[0])
	if err != nil {
		return err
	}

	if hashed {
		if _, err := c.UpdateUserHashedPassword(context.TODO(), user.Id, password); err != nil {
			return errors.Wrap(err, "changing user hashed password failed")
		}
	} else {
		if _, err := c.UpdateUserPassword(context.TODO(), user.Id, current, password); err != nil {
			return errors.Wrap(err, "changing user password failed")
		}
	}

	printer.PrintT("Password for user {{.Username}} successfully changed", user)
	return nil
}

func resetUserMfaCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) < 1 {
		return errors.New("expected at least one argument. See help text for details")
	}

	var result *multierror.Error
	users, err := getUsersFromArgs(c, args)
	if err != nil {
		result = multierror.Append(result, err)
	}

	for _, user := range users {
		if _, err := c.UpdateUserMfa(context.TODO(), user.Id, "", false); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to reset user %q MFA. Error: %w", user.Id, err))
		}
	}

	return result.ErrorOrNil()
}

func deleteUsersCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		if err := getConfirmation("Are you sure you want to delete the users specified? All data will be permanently deleted?", true); err != nil {
			return err
		}
	}

	users, err := getUsersFromArgs(c, args)
	if err != nil {
		printer.PrintError(err.Error())
	}
	for i, user := range users {
		if user == nil {
			printer.PrintError("Unable to find user '" + args[i] + "'")
			continue
		}
		if res, err := c.PermanentDeleteUser(context.TODO(), user.Id); err != nil {
			printer.PrintError("Unable to delete user '" + user.Username + "' error: " + err.Error())
		} else {
			// res.StatusCode is checked for 202 to identify issues with file deletion.
			if res.StatusCode == http.StatusAccepted {
				printer.PrintError("There were issues with deleting profile image of the user. Please delete it manually. Id: " + user.Id)
			}
			printer.PrintT("Deleted user '{{.Username}}'", user)
		}
	}
	return nil
}

func deleteAllUsersCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		if err := getConfirmation("Are you sure you want to permanently delete all user accounts?", true); err != nil {
			return err
		}
	}

	if _, err := c.PermanentDeleteAllUsers(context.TODO()); err != nil {
		return err
	}

	defer printer.Print("All users successfully deleted")

	return nil
}

func searchUserCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	if len(args) < 1 {
		return errors.New("expected at least one argument. See help text for details")
	}

	users, err := getUsersFromArgs(c, args)
	if err != nil {
		printer.PrintError(err.Error())
		return err
	}

	for i, user := range users {
		tpl := `id: {{.Id}}
username: {{.Username}}
nickname: {{.Nickname}}
position: {{.Position}}
first_name: {{.FirstName}}
last_name: {{.LastName}}
email: {{.Email}}
auth_service: {{.AuthService}}`
		if i > 0 {
			tpl = "------------------------------\n" + tpl
		}

		printer.PrintT(tpl, user)
	}

	return nil
}

func ResetListUsersCmd(t *testing.T) *cobra.Command {
	require.NoError(t, ListUsersCmd.Flags().Set("page", "0"))
	require.NoError(t, ListUsersCmd.Flags().Set("per-page", "200"))
	require.NoError(t, ListUsersCmd.Flags().Set("all", "false"))
	require.NoError(t, ListUsersCmd.Flags().Set("team", ""))
	require.NoError(t, ListUsersCmd.Flags().Set("inactive", "false"))

	return ListUsersCmd
}

func listUsersCmdF(c client.Client, command *cobra.Command, args []string) error {
	page, err := command.Flags().GetInt("page")
	if err != nil {
		return err
	}
	perPage, err := command.Flags().GetInt("per-page")
	if err != nil {
		return err
	}
	showAll, err := command.Flags().GetBool("all")
	if err != nil {
		return err
	}
	teamName, err := command.Flags().GetString("team")
	if err != nil {
		return err
	}
	// if inactive, DeletedAt != 0
	inactive, err := command.Flags().GetBool("inactive")
	if err != nil {
		return err
	}

	if showAll {
		page = 0
	}

	var team *model.Team
	if teamName != "" {
		var err error
		team, _, err = c.GetTeamByName(context.TODO(), teamName, "")
		if err != nil {
			return errors.Wrap(err, fmt.Sprintf("Failed to get team %s", teamName))
		}
	}

	params := url.Values{}
	if inactive {
		params.Add("inactive", "true")
	}
	if team != nil {
		params.Add("in_team", team.Id)
	}

	tpl := `{{.Id}}: {{.Username}} ({{.Email}})`
	for {
		users, _, err := c.GetUsersWithCustomQueryParameters(context.TODO(), page, perPage, params.Encode(), "")
		if err != nil {
			return errors.Wrap(err, "Failed to fetch users")
		}

		if len(users) == 0 {
			break
		}

		for _, user := range users {
			printer.PrintT(tpl, user)
		}

		if !showAll {
			break
		}
		page++
	}

	return nil
}

func verifyUserEmailWithoutTokenCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	var result *multierror.Error
	users, err := getUsersFromArgs(c, userArgs)
	if err != nil {
		result = multierror.Append(result, err)
	}

	for _, user := range users {
		if newUser, _, err := c.VerifyUserEmailWithoutToken(context.TODO(), user.Id); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to verify user %s email: %w", user.Id, err))
		} else {
			printer.PrintT("User {{.Username}} verified", newUser)
		}
	}
	return result.ErrorOrNil()
}

func userConvertCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	toBot, _ := cmd.Flags().GetBool("bot")
	toUser, _ := cmd.Flags().GetBool("user")

	if !(toUser || toBot) {
		return fmt.Errorf("either %q flag or %q flag should be provided", "user", "bot")
	}

	if toBot {
		return convertUserToBot(c, cmd, userArgs)
	}

	return convertBotToUser(c, cmd, userArgs)
}

func convertUserToBot(c client.Client, _ *cobra.Command, userArgs []string) error {
	users, err := getUsersFromArgs(c, userArgs)
	if err != nil {
		printer.PrintError(err.Error())
	}
	for _, user := range users {
		bot, _, err := c.ConvertUserToBot(context.TODO(), user.Id)
		if err != nil {
			printer.PrintError(err.Error())
			continue
		}

		printer.PrintT("{{.Username}} converted to bot.", bot)
	}
	return nil
}

func convertBotToUser(c client.Client, cmd *cobra.Command, userArgs []string) error {
	user, err := getUserFromArg(c, userArgs[0])
	if err != nil {
		return err
	}

	password, _ := cmd.Flags().GetString("password")
	if password == "" {
		return errors.New("password is required")
	}

	up := &model.UserPatch{Password: &password}

	username, _ := cmd.Flags().GetString("username")
	if username == "" {
		if user.Username == "" {
			return errors.New("username is empty")
		}
	} else {
		up.Username = model.NewPointer(username)
	}

	email, _ := cmd.Flags().GetString("email")
	if email == "" {
		if user.Email == "" {
			return errors.New("email is empty")
		}
	} else {
		up.Email = model.NewPointer(email)
	}

	nickname, _ := cmd.Flags().GetString("nickname")
	if nickname != "" {
		up.Nickname = model.NewPointer(nickname)
	}

	firstname, _ := cmd.Flags().GetString("firstname")
	if firstname != "" {
		up.FirstName = model.NewPointer(firstname)
	}

	lastname, _ := cmd.Flags().GetString("lastname")
	if lastname != "" {
		up.LastName = model.NewPointer(lastname)
	}

	locale, _ := cmd.Flags().GetString("locale")
	if locale != "" {
		up.Locale = model.NewPointer(locale)
	}

	systemAdmin, _ := cmd.Flags().GetBool("system-admin")
	if !systemAdmin {
		systemAdmin, _ = cmd.Flags().GetBool("system_admin")
	}

	user, _, err = c.ConvertBotToUser(context.TODO(), user.Id, up, systemAdmin)
	if err != nil {
		return err
	}

	printer.PrintT("{{.Username}} converted to user.", user)

	return nil
}

func migrateAuthCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	if userArgs[1] == "saml" {
		return migrateAuthToSamlCmdF(c, cmd, userArgs)
	}
	return migrateAuthToLdapCmdF(c, cmd, userArgs)
}

func migrateAuthToSamlCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	fromAuth := userArgs[0]
	auto, _ := cmd.Flags().GetBool("auto")
	confirm, _ := cmd.Flags().GetBool("confirm")
	if auto && !confirm {
		if err := getConfirmation("You are about to perform an automatic \""+fromAuth+" to saml\" migration. This must only be done if your current Mattermost users with "+fromAuth+" auth have the same username and email in your SAML service. Otherwise, provide the usernames and emails from your SAML Service using the \"users file\" without the \"--auto\" option.\n\nDo you want to proceed with automatic migration anyway?", false); err != nil {
			return err
		}
	}

	matches := map[string]string{}
	if !auto {
		matchesFile := userArgs[2]

		file, err := os.ReadFile(matchesFile)
		if err != nil {
			return fmt.Errorf("could not read file: %w", err)
		}
		if err := json.Unmarshal(file, &matches); err != nil {
			return fmt.Errorf("invalid json: %w", err)
		}
	}

	if fromAuth == "" || (fromAuth != "email" && fromAuth != "gitlab" && fromAuth != "ldap" && fromAuth != "google" && fromAuth != "office365") {
		return errors.New("invalid from_auth argument")
	}

	resp, err := c.MigrateAuthToSaml(context.TODO(), fromAuth, matches, auto)
	if err != nil {
		return err
	} else if resp.StatusCode == http.StatusOK {
		printer.Print("Successfully migrated accounts.")
	}

	return nil
}

func migrateAuthToLdapCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	fromAuth := userArgs[0]
	if fromAuth == "" || (fromAuth != "email" && fromAuth != "gitlab" && fromAuth != "saml" && fromAuth != "google" && fromAuth != "office365") { // nolint:goconst
		return errors.New("invalid from_auth argument")
	}

	matchField := userArgs[2]
	if matchField == "" || (matchField != "email" && matchField != "username") {
		return errors.New("invalid match_field argument")
	}

	force, _ := cmd.Flags().GetBool("force")

	resp, err := c.MigrateAuthToLdap(context.TODO(), fromAuth, matchField, force)
	if err != nil {
		return err
	} else if resp.StatusCode == http.StatusOK {
		printer.Print("Successfully migrated accounts.")
	}

	return nil
}

func promoteGuestToUserCmdF(c client.Client, _ *cobra.Command, userArgs []string) error {
	var errs *multierror.Error
	for i, user := range getUsersFromUserArgs(c, userArgs) {
		if user == nil {
			err := fmt.Errorf("can't find guest '%s'", userArgs[i])
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		if _, err := c.PromoteGuestToUser(context.TODO(), user.Id); err != nil {
			err = fmt.Errorf("unable to promote guest %s: %w", userArgs[i], err)
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		printer.PrintT("User {{.Username}} promoted.", user)
	}

	return errs.ErrorOrNil()
}

func demoteUserToGuestCmdF(c client.Client, _ *cobra.Command, userArgs []string) error {
	var errs *multierror.Error
	for i, user := range getUsersFromUserArgs(c, userArgs) {
		if user == nil {
			err := fmt.Errorf("can't find user '%s'", userArgs[i])
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		if _, err := c.DemoteUserToGuest(context.TODO(), user.Id); err != nil {
			err = fmt.Errorf("unable to demote user %s: %w", userArgs[i], err)
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		printer.PrintT("User {{.Username}} demoted.", user)
	}

	return errs.ErrorOrNil()
}

type ByPreference model.Preferences

func (p ByPreference) Len() int      { return len(p) }
func (p ByPreference) Swap(i, j int) { p[i], p[j] = p[j], p[i] }
func (p ByPreference) Less(i, j int) bool {
	if p[i].UserId < p[j].UserId {
		return true
	}

	if p[i].Category < p[j].Category {
		return true
	}

	if p[i].Name < p[j].Name {
		return true
	}

	return p[i].Value < p[j].Value
}

func preferencesListCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	category, _ := cmd.Flags().GetString("category")

	var errs *multierror.Error
	for i, user := range getUsersFromUserArgs(c, userArgs) {
		if user == nil {
			err := fmt.Errorf("can't find user '%s'", userArgs[i])
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		var preferences model.Preferences
		var err error
		if category == "" {
			preferences, _, err = c.GetPreferences(context.TODO(), user.Id)

			if err != nil {
				err = fmt.Errorf("unable to list user preferences %s: %w", userArgs[i], err)
				errs = multierror.Append(errs, err)
				printer.PrintError(err.Error())
				continue
			}
		} else {
			preferences, _, err = c.GetPreferencesByCategory(context.TODO(), user.Id, category)

			if err != nil {
				err = fmt.Errorf("unable to list user preferences by category %s for %s: %w", category, userArgs[i], err)
				errs = multierror.Append(errs, err)
				printer.PrintError(err.Error())
				continue
			}
		}

		sort.Sort(ByPreference(preferences))

		for j, preference := range preferences {
			tpl := `user_id: {{.UserId}}
category: {{.Category}}
name: {{.Name}}
value: {{.Value}}`
			if j > 0 {
				tpl = "------------------------------\n" + tpl
			}

			printer.PrintT(tpl, preference)
		}
	}

	return errs.ErrorOrNil()
}

func preferencesGetCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	category, _ := cmd.Flags().GetString("category")
	preferenceName, _ := cmd.Flags().GetString("name")

	var errs *multierror.Error
	for i, user := range getUsersFromUserArgs(c, userArgs) {
		if user == nil {
			err := fmt.Errorf("can't find user '%s'", userArgs[i])
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		preference, _, err := c.GetPreferenceByCategoryAndName(context.TODO(), user.Id, category, preferenceName)
		if err != nil {
			err = fmt.Errorf("unable to get user preference %s %s for %s: %w", category, preferenceName, userArgs[i], err)
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		tpl := `user_id: {{.UserId}}
category: {{.Category}}
name: {{.Name}}
value: {{.Value}}`

		printer.PrintT(tpl, preference)
	}

	return errs.ErrorOrNil()
}

func preferencesUpdateCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	category, _ := cmd.Flags().GetString("category")
	preferenceName, _ := cmd.Flags().GetString("name")
	value, _ := cmd.Flags().GetString("value")

	var errs *multierror.Error
	for i, user := range getUsersFromUserArgs(c, userArgs) {
		if user == nil {
			err := fmt.Errorf("can't find user '%s'", userArgs[i])
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		preferences := model.Preferences{
			model.Preference{
				UserId:   user.Id,
				Category: category,
				Name:     preferenceName,
				Value:    value,
			},
		}

		_, err := c.UpdatePreferences(context.TODO(), user.Id, preferences)
		if err != nil {
			err = fmt.Errorf("unable to update user preference %s %s for %s: %w", category, preferenceName, userArgs[i], err)
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		printer.Print(fmt.Sprintf("Preference %s %s for %s updated successfully", category, preferenceName, userArgs[i]))
	}

	return errs.ErrorOrNil()
}

func preferencesDeleteCmdF(c client.Client, cmd *cobra.Command, userArgs []string) error {
	category, _ := cmd.Flags().GetString("category")
	preferenceName, _ := cmd.Flags().GetString("name")

	var errs *multierror.Error
	for i, user := range getUsersFromUserArgs(c, userArgs) {
		if user == nil {
			err := fmt.Errorf("can't find user '%s'", userArgs[i])
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		preferences := model.Preferences{
			model.Preference{
				UserId:   user.Id,
				Category: category,
				Name:     preferenceName,
			},
		}

		_, err := c.DeletePreferences(context.TODO(), user.Id, preferences)
		if err != nil {
			err = fmt.Errorf("unable to delete user preference %s %s for %s: %w", category, preferenceName, userArgs[i], err)
			errs = multierror.Append(errs, err)
			printer.PrintError(err.Error())
			continue
		}

		printer.Print(fmt.Sprintf("Preference %s %s for %s deleted successfully", category, preferenceName, userArgs[i]))
	}

	return errs.ErrorOrNil()
}
