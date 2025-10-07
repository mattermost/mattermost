// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestUserActivateCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Activate user", func(c client.Client) {
		printer.Clean()

		_, appErr := s.th.App.UpdateActive(s.th.Context, user, false)
		s.Require().Nil(appErr)

		err := userActivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().Zero(ruser.DeleteAt)
	})

	s.Run("Activate user without permissions", func() {
		printer.Clean()

		_, appErr := s.th.App.UpdateActive(s.th.Context, user, false)
		s.Require().Nil(appErr)

		err := userActivateCmdF(s.th.Client, &cobra.Command{}, []string{user.Email})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "unable to change activation status of user "+user.Id+": You do not have the appropriate permissions.")

		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().NotZero(ruser.DeleteAt)
	})

	s.RunForAllClients("Activate nonexistent user", func(c client.Client) {
		printer.Clean()

		err := userActivateCmdF(c, &cobra.Command{}, []string{"nonexistent@email"})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("1 error occurred:\n\t* user nonexistent@email not found\n\n", printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestUserDeactivateCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Deactivate user", func(c client.Client) {
		printer.Clean()

		_, appErr := s.th.App.UpdateActive(s.th.Context, user, true)
		s.Require().Nil(appErr)

		err := userDeactivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().NotZero(ruser.DeleteAt)
	})

	s.Run("Deactivate user without permissions", func() {
		printer.Clean()

		_, appErr := s.th.App.UpdateActive(s.th.Context, user, true)
		s.Require().Nil(appErr)

		err := userDeactivateCmdF(s.th.Client, &cobra.Command{}, []string{user.Email})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "unable to change activation status of user "+user.Id+": You do not have the appropriate permissions.")

		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().Zero(ruser.DeleteAt)
	})

	s.RunForAllClients("Deactivate nonexistent user", func(c client.Client) {
		printer.Clean()

		err := userDeactivateCmdF(c, &cobra.Command{}, []string{"nonexistent@email"})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("1 error occurred:\n\t* user nonexistent@email not found\n\n", printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestSearchUserCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Search for an existing user", func(c client.Client) {
		printer.Clean()

		err := searchUserCmdF(c, &cobra.Command{}, []string{s.th.BasicUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user := printer.GetLines()[0].(userOut)
		s.Equal(s.th.BasicUser.Username, user.Username)
		s.False(user.Deactivated)
		s.Empty(user.AuthData)
		s.Empty(user.AuthService)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("Search for a disabled user", func(c client.Client) {
		printer.Clean()

		// Create a disabled user
		disabledUser, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
			Email:    s.th.GenerateTestEmail(),
			Username: model.NewUsername(),
			Password: model.NewId(),
			DeleteAt: model.GetMillis(), // Set DeleteAt to disable the user
		})
		s.Require().Nil(appErr)

		err := searchUserCmdF(c, &cobra.Command{}, []string{disabledUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user := printer.GetLines()[0].(userOut)
		s.Equal(disabledUser.Username, user.Username)
		s.True(user.Deactivated) // Verify user shows as deactivated
		s.Empty(user.AuthData)
		s.Empty(user.AuthService)
		s.Len(printer.GetErrorLines(), 0)
	})

	// Create a LDAP user
	ldapUser, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:       s.th.GenerateTestEmail(),
		Username:    model.NewUsername(),
		AuthData:    model.NewPointer("1234"),
		AuthService: model.UserAuthServiceLdap,
	})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Search for a user with authData", func(c client.Client) {
		printer.Clean()
		err := searchUserCmdF(c, &cobra.Command{}, []string{ldapUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user := printer.GetLines()[0].(userOut)
		s.Equal(ldapUser.Username, user.Username)
		s.False(user.Deactivated)
		s.Equal(*ldapUser.AuthData, user.AuthData)
		s.Equal(ldapUser.AuthService, user.AuthService)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Search for a user with authData/Client", func() {
		printer.Clean()
		// Non-admin should not be able to see AuthData or AuthService
		err := searchUserCmdF(s.th.Client, &cobra.Command{}, []string{ldapUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user := printer.GetLines()[0].(userOut)
		s.Equal(ldapUser.Username, user.Username)
		s.False(user.Deactivated)
		s.Equal("", user.AuthData)
		s.Equal("", user.AuthService)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("Search for a nonexistent user", func(c client.Client) {
		printer.Clean()
		emailArg := "nonexistentUser@example.com"

		err := searchUserCmdF(c, &cobra.Command{}, []string{emailArg})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal(fmt.Sprintf("1 error occurred:\n\t* user %s not found\n\n", emailArg), printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestListUserCmd() {
	s.SetupTestHelper().InitBasic().DeleteBots()

	// populate map for checking
	userPool := []string{
		s.th.BasicUser.Username,
		s.th.BasicUser2.Username,
		s.th.TeamAdminUser.Username,
		s.th.SystemAdminUser.Username,
		s.th.SystemManagerUser.Username,
	}
	for range 10 {
		userData := model.User{
			Username: "fakeuser" + model.NewRandomString(10),
			Password: "Pa$$word11",
			Email:    s.th.GenerateTestEmail(),
		}
		usr, err := s.th.App.CreateUser(s.th.Context, &userData)
		s.Require().Nil(err)
		userPool = append(userPool, usr.Username)
	}

	inactivePool := []string{}
	// create inactive users
	for range 2 {
		userData := model.User{
			Username: "fakeuser" + model.NewRandomString(10),
			Password: "Pa$$word11",
			Email:    s.th.GenerateTestEmail(),
			DeleteAt: model.GetMillis(),
		}
		usr, err := s.th.App.CreateUser(s.th.Context, &userData)
		s.Require().Nil(err)
		userPool = append(userPool, usr.Username)
		inactivePool = append(inactivePool, usr.Username)
	}

	s.RunForAllClients("Get some random user", func(c client.Client) {
		printer.Clean()

		cmd := ResetListUsersCmd(s.T())
		s.Require().NoError(cmd.Flags().Set("per-page", "5"))

		err := listUsersCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().GreaterOrEqual(len(printer.GetLines()), 5)
		s.Len(printer.GetErrorLines(), 0)

		for _, u := range printer.GetLines() {
			user := u.(*model.User)
			s.Require().Contains(userPool, user.Username)
		}
	})

	s.RunForAllClients("Get list of all user", func(c client.Client) {
		printer.Clean()

		cmd := ResetListUsersCmd(s.T())
		s.Require().NoError(cmd.Flags().Set("per-page", "12"))
		s.Require().NoError(cmd.Flags().Set("all", "true"))

		err := listUsersCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().GreaterOrEqual(len(printer.GetLines()), 16)
		s.Len(printer.GetErrorLines(), 0)
		for _, each := range printer.GetLines() {
			user := each.(*model.User)
			s.Require().Contains(userPool, user.Username)
		}
	})

	s.RunForAllClients("Get list of inactive users", func(c client.Client) {
		printer.Clean()

		cmd := ResetListUsersCmd(s.T())
		s.Require().NoError(cmd.Flags().Set("per-page", "12"))
		s.Require().NoError(cmd.Flags().Set("all", "true"))
		s.Require().NoError(cmd.Flags().Set("inactive", "true"))

		err := listUsersCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().GreaterOrEqual(len(printer.GetLines()), 2)
		s.Len(printer.GetErrorLines(), 0)
		for _, each := range printer.GetLines() {
			user := each.(*model.User)
			s.Require().Contains(inactivePool, user.Username)
		}
	})

	// create users with team
	for range 10 {
		userData := model.User{
			Username: "teamuser" + model.NewRandomString(10),
			Password: "Pa$$word11",
			Email:    s.th.GenerateTestEmail(),
		}
		usr, err := s.th.App.CreateUser(s.th.Context, &userData)
		s.Require().Nil(err)
		userPool = append(userPool, usr.Username)
		s.th.LinkUserToTeam(usr, s.th.BasicTeam)
	}

	s.RunForAllClients("Get list users given team", func(c client.Client) {
		printer.Clean()

		cmd := ResetListUsersCmd(s.T())
		s.Require().NoError(cmd.Flags().Set("per-page", "40"))
		s.Require().NoError(cmd.Flags().Set("all", "true"))
		s.Require().NoError(cmd.Flags().Set("team", s.th.BasicTeam.Name))

		err := listUsersCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().GreaterOrEqual(len(printer.GetLines()), 10)
		s.Len(printer.GetErrorLines(), 0)
		for _, each := range printer.GetLines() {
			user := each.(*model.User)
			s.Require().Contains(userPool, user.Username)
		}
	})

	// create inactive users with team
	inactiveUserPool := []string{}

	for range 10 {
		userData := model.User{
			Username: "inactiveteamuser" + model.NewRandomString(10),
			Password: "Pa$$word11",
			Email:    s.th.GenerateTestEmail(),
			DeleteAt: model.GetMillis(),
		}
		usr, err := s.th.App.CreateUser(s.th.Context, &userData)
		s.Require().Nil(err)
		inactiveUserPool = append(inactiveUserPool, usr.Username)
		s.th.LinkUserToTeam(usr, s.th.BasicTeam)
	}

	s.RunForAllClients("Get list of inactive users given team", func(c client.Client) {
		printer.Clean()

		cmd := ResetListUsersCmd(s.T())
		s.Require().NoError(cmd.Flags().Set("per-page", "40"))
		s.Require().NoError(cmd.Flags().Set("all", "true"))
		s.Require().NoError(cmd.Flags().Set("team", s.th.BasicTeam.Name))
		s.Require().NoError(cmd.Flags().Set("inactive", "true"))

		err := listUsersCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().GreaterOrEqual(len(printer.GetLines()), 10)
		s.Len(printer.GetErrorLines(), 0)
		for _, each := range printer.GetLines() {
			user := each.(*model.User)
			s.Require().Contains(inactiveUserPool, user.Username)
		}
	})
}

func (s *MmctlE2ETestSuite) TestUserInviteCmdf() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Invite user", func(c client.Client) {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableEmailInvitations
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })
		defer s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = *previousVal })

		err := userInviteCmdF(c, &cobra.Command{}, []string{s.th.BasicUser.Email, s.th.BasicTeam.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Invites may or may not have been sent.")
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("Inviting when email invitation disabled", func(c client.Client) {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableEmailInvitations
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = false })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = *previousVal })
		}()

		err := userInviteCmdF(c, &cobra.Command{}, []string{s.th.BasicUser.Email, s.th.BasicTeam.Id})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(
			fmt.Sprintf("Unable to invite user with email %s to team %s. Error: Email invitations are disabled.",
				s.th.BasicUser.Email,
				s.th.BasicTeam.Name,
			),
			printer.GetErrorLines()[0],
		)
	})

	s.RunForAllClients("Invite user outside of accepted domain", func(c client.Client) {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableEmailInvitations
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = *previousVal })
		}()

		team := s.th.CreateTeam()
		team.AllowedDomains = "@example.com"
		team, appErr := s.th.App.UpdateTeam(team)
		s.Require().Nil(appErr)

		user := s.th.CreateUser()
		err := userInviteCmdF(c, &cobra.Command{}, []string{user.Email, team.Id})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(
			fmt.Sprintf(`Unable to invite user with email %s to team %s. Error: The following email addresses do not belong to an accepted domain: %s. Please contact your System Administrator for details.`,
				user.Email,
				team.Name,
				user.Email,
			),
			printer.GetErrorLines()[0],
		)
	})
}

func (s *MmctlE2ETestSuite) TestResetUserMfaCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId(), MfaActive: true, MfaSecret: "secret"})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Reset user mfa", func(c client.Client) {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableMultifactorAuthentication
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })
		defer s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = *previousVal })

		err := resetUserMfaCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// make sure user is updated after reset mfa
		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().NotEqual(ruser.UpdateAt, user.UpdateAt)
	})

	s.RunForSystemAdminAndLocal("Reset mfa disabled config", func(c client.Client) {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableMultifactorAuthentication
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = false })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = *previousVal })
		}()

		userMfaInactive, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId(), MfaActive: false})
		s.Require().Nil(appErr)

		err := resetUserMfaCmdF(c, &cobra.Command{}, []string{userMfaInactive.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reset user mfa without permission", func() {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableMultifactorAuthentication

		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = *previousVal })
		}()

		err := resetUserMfaCmdF(s.th.Client, &cobra.Command{}, []string{user.Email})

		var expected error

		expected = multierror.Append(
			expected, fmt.Errorf(`unable to reset user %q MFA. Error: You do not have the appropriate permissions.`, user.Id), //nolint:revive

		)

		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestVerifyUserEmailWithoutTokenCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Verify user email without token", func(c client.Client) {
		printer.Clean()

		err := verifyUserEmailWithoutTokenCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Verify user email without token (without permission)", func() {
		printer.Clean()

		err := verifyUserEmailWithoutTokenCmdF(s.th.Client, &cobra.Command{}, []string{user.Email})
		var expected error

		expected = multierror.Append(
			expected, fmt.Errorf("unable to verify user %s email: You do not have the appropriate permissions.", user.Id),
		)

		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 0)
	})

	s.RunForAllClients("Verify user email without token for nonexistent user", func(c client.Client) {
		printer.Clean()

		err := verifyUserEmailWithoutTokenCmdF(c, &cobra.Command{}, []string{"nonexistent@email"})
		var expected error

		expected = multierror.Append(
			expected, ExtractErrorFromResponse(
				&model.Response{StatusCode: http.StatusNotFound},
				ErrEntityNotFound{Type: "user", ID: "nonexistent@email"},
			),
		)

		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestCreateUserCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Should not create a user w/o username", func(c client.Client) {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		cmd := &cobra.Command{}
		cmd.Flags().String("password", "somepass", "")
		cmd.Flags().String("email", email, "")

		err := userCreateCmdF(c, cmd, []string{})
		s.EqualError(err, "Username is required: flag accessed but not defined: username")
		s.Require().Empty(printer.GetLines())
		_, err = s.th.App.GetUserByEmail(email)
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "GetUserByEmail: Unable to find the user., failed to find User: resource \"User\" not found, id: email="+email)
	})

	s.RunForAllClients("Should not create a user w/o email", func(c client.Client) {
		printer.Clean()
		username := model.NewUsername()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("password", "somepass", "")

		err := userCreateCmdF(c, cmd, []string{})
		s.EqualError(err, "Email is required: flag accessed but not defined: email")
		s.Require().Empty(printer.GetLines())
		_, err = s.th.App.GetUserByUsername(username)
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "GetUserByUsername: Unable to find an existing account matching your username for this team. This team may require an invite from the team owner to join., failed to find User: resource \"User\" not found, id: username="+username)
	})

	s.RunForAllClients("Should not create a user w/o password", func(c client.Client) {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", model.NewId(), "")
		cmd.Flags().String("email", email, "")

		err := userCreateCmdF(c, cmd, []string{})
		s.EqualError(err, "Password is required: flag accessed but not defined: password")
		s.Require().Empty(printer.GetLines())
		_, err = s.th.App.GetUserByEmail(email)
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "GetUserByEmail: Unable to find the user., failed to find User: resource \"User\" not found, id: email="+email)
	})

	s.Run("Should create a user but w/o system-admin privileges", func() {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		username := model.NewUsername()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("email", email, "")
		cmd.Flags().String("password", "password", "")
		cmd.Flags().Bool("system-admin", true, "")

		err := userCreateCmdF(s.th.Client, cmd, []string{})
		s.EqualError(err, "Unable to update user roles. Error: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		user, err := s.th.App.GetUserByEmail(email)
		s.Require().Nil(err)
		s.Equal(username, user.Username)
		s.Equal(false, user.IsSystemAdmin())
	})

	s.RunForSystemAdminAndLocal("Should create new system-admin user given required params", func(c client.Client) {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		username := model.NewUsername()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("email", email, "")
		cmd.Flags().String("password", "somepass", "")
		cmd.Flags().Bool("system-admin", true, "")

		err := userCreateCmdF(s.th.SystemAdminClient, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user, err := s.th.App.GetUserByEmail(email)
		s.Require().Nil(err)
		s.Equal(username, user.Username)
		s.Equal(true, user.IsSystemAdmin())
	})

	s.RunForAllClients("Should create new user given required params", func(c client.Client) {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		username := model.NewUsername()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("email", email, "")
		cmd.Flags().String("password", "somepass", "")

		err := userCreateCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user, err := s.th.App.GetUserByEmail(email)
		s.Require().Nil(err)
		s.Equal(username, user.Username)
		s.Equal(false, user.IsSystemAdmin())
	})

	s.RunForSystemAdminAndLocal("Should create new user with the email already verified only for admin or local mode", func(c client.Client) {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		username := model.NewUsername()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("email", email, "")
		cmd.Flags().String("password", "somepass", "")
		cmd.Flags().Bool("email-verified", true, "")

		err := userCreateCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		user, err := s.th.App.GetUserByEmail(email)
		s.Require().Nil(err)
		s.Equal(username, user.Username)
		s.Equal(false, user.IsSystemAdmin())
		s.Equal(true, user.EmailVerified)
	})
}

func (s *MmctlE2ETestSuite) TestDeleteUsersCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("Delete user", func(c client.Client) {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableAPIUserDeletion
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = true })
		defer s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = *previousVal })

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		newUser := s.th.CreateUser()
		err := deleteUsersCmdF(c, cmd, []string{newUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)

		deletedUser := printer.GetLines()[0].(*model.User)
		s.Require().Equal(newUser.Username, deletedUser.Username)

		// expect user deleted
		_, err = s.th.App.GetUser(newUser.Id)
		s.Require().NotNil(err)
		s.Require().Equal("GetUser: Unable to find the user., resource \"User\" not found, id: "+newUser.Id, err.Error())
	})

	s.RunForSystemAdminAndLocal("Delete nonexistent user", func(c client.Client) {
		printer.Clean()
		emailArg := "nonexistentUser@example.com"

		var expectedErr *multierror.Error
		expectedErr = multierror.Append(expectedErr, fmt.Errorf("user %s not found", emailArg))

		previousVal := s.th.App.Config().ServiceSettings.EnableAPIUserDeletion
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = true })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = *previousVal })
		}()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		err := deleteUsersCmdF(c, cmd, []string{emailArg})
		s.Require().NotNil(err)
		s.Require().EqualError(err, expectedErr.Error())
	})

	s.Run("Delete user without permission", func() {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableAPIUserDeletion
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = true })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = *previousVal })
		}()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		newUser := s.th.CreateUser()

		var expectedErr *multierror.Error
		expectedErr = multierror.Append(expectedErr, fmt.Errorf("unable to delete user %s error: %w", newUser.Username,
			fmt.Errorf("You do not have the appropriate permissions.")))

		err := deleteUsersCmdF(s.th.Client, cmd, []string{newUser.Email})
		s.Require().NotNil(err)
		s.Require().EqualError(err, expectedErr.Error())

		// expect user not deleted
		user, err := s.th.App.GetUser(newUser.Id)
		s.Require().Nil(err)
		s.Require().Equal(newUser.Username, user.Username)
	})

	s.Run("Delete user with disabled config as system admin", func() {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableAPIUserDeletion
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = false })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = *previousVal })
		}()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		newUser := s.th.CreateUser()

		var expectedErr *multierror.Error
		expectedErr = multierror.Append(expectedErr, fmt.Errorf("unable to delete user %s error: %w", newUser.Username,
			fmt.Errorf("Permanent user deletion feature is not enabled. Please contact your System Administrator.")))

		err := deleteUsersCmdF(s.th.SystemAdminClient, cmd, []string{newUser.Email})
		s.Require().NotNil(err)
		s.Require().EqualError(err, expectedErr.Error())

		// expect user not deleted
		user, err := s.th.App.GetUser(newUser.Id)
		s.Require().Nil(err)
		s.Require().Equal(newUser.Username, user.Username)
	})

	s.Run("Delete user with disabled config as local client", func() {
		printer.Clean()

		previousVal := s.th.App.Config().ServiceSettings.EnableAPIUserDeletion
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = false })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = *previousVal })
		}()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		newUser := s.th.CreateUser()
		err := deleteUsersCmdF(s.th.LocalClient, cmd, []string{newUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)

		deletedUser := printer.GetLines()[0].(*model.User)
		s.Require().Equal(newUser.Username, deletedUser.Username)

		// expect user deleted
		_, err = s.th.App.GetUser(newUser.Id)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "GetUser: Unable to find the user., resource \"User\" not found, id: "+newUser.Id)
	})
}

func (s *MmctlE2ETestSuite) TestUserConvertCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("Error when no flag provided", func(c client.Client) {
		printer.Clean()

		emailArg := "example@example.com"
		cmd := &cobra.Command{}

		err := userConvertCmdF(c, cmd, []string{emailArg})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Equal("either \"user\" flag or \"bot\" flag should be provided", err.Error())
	})

	s.RunForAllClients("Error for invalid user", func(c client.Client) {
		printer.Clean()

		emailArg := "something@something.com"
		cmd := &cobra.Command{}
		cmd.Flags().Bool("bot", true, "")

		_ = userConvertCmdF(c, cmd, []string{emailArg})
		s.Require().Len(printer.GetLines(), 0)
	})

	s.RunForSystemAdminAndLocal("Valid user to bot convert", func(c client.Client) {
		printer.Clean()

		user, _ := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})

		email := user.Email
		cmd := &cobra.Command{}
		cmd.Flags().Bool("bot", true, "")

		err := userConvertCmdF(c, cmd, []string{email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		bot := printer.GetLines()[0].(*model.Bot)
		s.Equal(user.Username, bot.Username)
		s.Equal(user.Id, bot.UserId)
		s.Equal(user.Id, bot.OwnerId)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Permission error for valid user to bot convert", func() {
		printer.Clean()

		email := s.th.BasicUser2.Email
		cmd := &cobra.Command{}
		cmd.Flags().Bool("bot", true, "")

		_ = userConvertCmdF(s.th.Client, cmd, []string{email})
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Equal("You do not have the appropriate permissions.", printer.GetErrorLines()[0])
	})

	s.RunForSystemAdminAndLocal("Valid bot to user convert", func(c client.Client) {
		printer.Clean()

		username := "fakeuser" + model.NewRandomString(10)
		bot, _ := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: username, DisplayName: username, OwnerId: username})

		cmd := &cobra.Command{}
		cmd.Flags().Bool("user", true, "")
		cmd.Flags().String("password", "password", "")

		err := userConvertCmdF(c, cmd, []string{bot.Username})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		user := printer.GetLines()[0].(*model.User)
		s.Equal(user.Username, bot.Username)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Permission error for valid bot to user convert", func() {
		printer.Clean()

		username := "fakeuser" + model.NewRandomString(10)
		bot, _ := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: username, DisplayName: username, OwnerId: username})

		cmd := &cobra.Command{}
		cmd.Flags().Bool("user", true, "")
		cmd.Flags().String("password", "password", "")

		err := userConvertCmdF(s.th.Client, cmd, []string{bot.Username})
		s.Require().Error(err)
		s.EqualError(err, "You do not have the appropriate permissions.")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestDeleteAllUserCmd() {
	s.SetupTestHelper().InitBasic()

	s.Run("Delete all user as unpriviliged user should not work", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		err := deleteAllUsersCmdF(s.th.Client, cmd, []string{})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)

		// expect users not deleted
		users, err := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(err)
		s.Require().NotZero(len(users))
	})

	s.Run("Delete all user as system admin through the port API should not work", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		err := deleteAllUsersCmdF(s.th.SystemAdminClient, cmd, []string{})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)

		// expect users not deleted
		users, err := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(err)
		s.Require().NotZero(len(users))
	})

	s.Run("Delete all users through local mode should work correctly", func() {
		printer.Clean()

		// populate with some user
		for range 10 {
			userData := model.User{
				Username: "fakeuser" + model.NewRandomString(10),
				Password: "Pa$$word11",
				Email:    s.th.GenerateTestEmail(),
			}
			_, err := s.th.App.CreateUser(s.th.Context, &userData)
			s.Require().Nil(err)
		}

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		// delete all users only works on local mode
		err := deleteAllUsersCmdF(s.th.LocalClient, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(printer.GetLines()[0], "All users successfully deleted")

		// expect users deleted
		users, err := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(err)
		s.Require().Zero(len(users))
	})
}

func (s *MmctlE2ETestSuite) TestPromoteGuestToUserCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.th.App.UpdateConfig(func(c *model.Config) { *c.GuestAccountsSettings.Enable = true })
	defer s.th.App.UpdateConfig(func(c *model.Config) { *c.GuestAccountsSettings.Enable = false })

	s.Require().Nil(s.th.App.DemoteUserToGuest(s.th.Context, user))

	s.RunForSystemAdminAndLocal("MM-T3936 Promote a guest to a user", func(c client.Client) {
		printer.Clean()

		err := promoteGuestToUserCmdF(c, nil, []string{user.Email})
		s.Require().NoError(err)
		defer s.Require().Nil(s.th.App.DemoteUserToGuest(s.th.Context, user))
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("MM-T3937 Promote a guest to a user with normal client", func() {
		printer.Clean()

		err := promoteGuestToUserCmdF(s.th.Client, nil, []string{user.Email})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to promote guest %s: You do not have the appropriate permissions.", user.Email), printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestDemoteUserToGuestCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewUsername(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.th.App.UpdateConfig(func(c *model.Config) { *c.GuestAccountsSettings.Enable = true })
	defer s.th.App.UpdateConfig(func(c *model.Config) { *c.GuestAccountsSettings.Enable = false })

	s.RunForSystemAdminAndLocal("MM-T3938 Demote a user to a guest", func(c client.Client) {
		printer.Clean()

		err := demoteUserToGuestCmdF(c, nil, []string{user.Email})
		s.Require().Nil(err)
		defer s.Require().Nil(s.th.App.PromoteGuestToUser(s.th.Context, user, ""))
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("MM-T3939 Demote a user to a guest with normal client", func() {
		printer.Clean()

		err := demoteUserToGuestCmdF(s.th.Client, nil, []string{user.Email})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to demote user %s: You do not have the appropriate permissions.", user.Email), printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestMigrateAuthCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	configForLdap(s.th)

	s.Require().NoError(s.th.App.Srv().Jobs.StartWorkers()) // we need to start workers do actual sync

	ldapUser, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:       s.th.GenerateTestEmail(),
		Username:    model.NewId(),
		AuthData:    model.NewPointer("test.user.1"),
		AuthService: model.UserAuthServiceLdap,
	})
	s.Require().Nil(appErr)

	samlUser, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:       "success+devone@simulator.amazonses.com",
		Username:    "dev.one",
		AuthData:    model.NewPointer("dev.one"),
		AuthService: model.UserAuthServiceSaml,
	})
	s.Require().Nil(appErr)

	s.Run("Should fail when regular user tries to migrate auth", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("auto", true, "")
		cmd.Flags().Bool("confirm", true, "")

		err := migrateAuthCmdF(s.th.Client, cmd, []string{"ldap", "saml"})
		s.Require().Error(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Migrate from ldap to saml", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("auto", true, "")
		cmd.Flags().Bool("confirm", true, "")

		err := migrateAuthCmdF(c, cmd, []string{"ldap", "saml"})
		s.Require().NoError(err)
		defer func() {
			_, appErr := s.th.App.UpdateUserAuth(s.th.Context, ldapUser.Id, &model.UserAuth{
				AuthData:    model.NewPointer("test.user.1"),
				AuthService: model.UserAuthServiceLdap,
			})
			s.Require().Nil(appErr)

			newUser, appErr := s.th.App.UpdateUser(s.th.Context, ldapUser, false)
			s.Require().Nil(appErr)
			s.Require().Equal(model.UserAuthServiceLdap, newUser.AuthService)
		}()
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("Successfully migrated accounts.", printer.GetLines()[0])
		s.Require().Empty(printer.GetErrorLines())

		updatedUser, appErr := s.th.App.GetUser(ldapUser.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(model.UserAuthServiceSaml, updatedUser.AuthService)
	})

	s.RunForSystemAdminAndLocal("Migrate from saml to ldap", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("force", true, "")

		err := migrateAuthCmdF(c, cmd, []string{"saml", "ldap", "email"})
		s.Require().NoError(err)
		defer func() {
			_, appErr := s.th.App.UpdateUserAuth(s.th.Context, samlUser.Id, &model.UserAuth{
				AuthData:    model.NewPointer("dev.one"),
				AuthService: model.UserAuthServiceSaml,
			})
			s.Require().Nil(appErr)

			newUser, appErr := s.th.App.UpdateUser(s.th.Context, samlUser, false)
			s.Require().Nil(appErr)
			s.Require().Equal(model.UserAuthServiceSaml, newUser.AuthService)
		}()
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("Successfully migrated accounts.", printer.GetLines()[0])
		s.Require().Empty(printer.GetErrorLines())

		updatedUser, appErr := s.th.App.GetUser(samlUser.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(model.UserAuthServiceLdap, updatedUser.AuthService)
	})
}

func (s *MmctlE2ETestSuite) cleanUpPreferences(userID string) {
	s.T().Helper()

	// Delete any existing preferences
	preferences, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), userID)
	s.NoError(err)

	if len(preferences) == 0 {
		return
	}

	_, err = s.th.SystemAdminClient.DeletePreferences(context.TODO(), userID, preferences)
	s.NoError(err)
}

func (s *MmctlE2ETestSuite) TestPreferenceListCmd() {
	s.SetupTestHelper().InitBasic()

	s.cleanUpPreferences(s.th.BasicUser.Id)
	s.cleanUpPreferences(s.th.BasicUser2.Id)

	preference1 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	_, err := s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference1})
	s.NoError(err)
	preference2 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "threads_view"}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference2})
	s.NoError(err)
	preference3 := model.Preference{UserId: s.th.BasicUser.Id, Category: "drafts", Name: "drafts_tour_tip_showed", Value: `{"drafts_tour_tip_showed":true}`}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference3})
	s.NoError(err)

	preference4 := model.Preference{UserId: s.th.BasicUser2.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser2.Id, model.Preferences{preference4})
	s.NoError(err)

	s.Run("list all preferences for single user", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", "", "")

		err = preferencesListCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 3)
		s.Require().Equal(preference1, printer.GetLines()[0])
		s.Require().Equal(preference2, printer.GetLines()[1])
		s.Require().Equal(preference3, printer.GetLines()[2])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("list filtered preferences for single user", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")

		err = preferencesListCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(preference1, printer.GetLines()[0])
		s.Require().Equal(preference2, printer.GetLines()[1])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("list all preferences for multiple users as admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", "", "")

		err = preferencesListCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 4)
		s.Require().Equal(preference1, printer.GetLines()[0])
		s.Require().Equal(preference2, printer.GetLines()[1])
		s.Require().Equal(preference3, printer.GetLines()[2])
		s.Require().Equal(preference4, printer.GetLines()[3])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("list filtered preferences for multiple users as admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")

		err = preferencesListCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 3)
		s.Require().Equal(preference1, printer.GetLines()[0])
		s.Require().Equal(preference2, printer.GetLines()[1])
		s.Require().Equal(preference4, printer.GetLines()[2])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("list preferences for multiple users as non-admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")

		err = preferencesListCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().Error(err)
	})
}

func (s *MmctlE2ETestSuite) TestPreferenceGetCmd() {
	s.SetupTestHelper().InitBasic()

	s.cleanUpPreferences(s.th.BasicUser.Id)
	s.cleanUpPreferences(s.th.BasicUser2.Id)

	preference1 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	_, err := s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference1})
	s.NoError(err)
	preference2 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "threads_view"}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference2})
	s.NoError(err)
	preference3 := model.Preference{UserId: s.th.BasicUser.Id, Category: "drafts", Name: "drafts_tour_tip_showed", Value: `{"drafts_tour_tip_showed":true}`}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference3})
	s.NoError(err)

	preference4 := model.Preference{UserId: s.th.BasicUser2.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser2.Id, model.Preferences{preference4})
	s.NoError(err)

	s.Run("get preference for single user", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")
		cmd.Flags().StringP("name", "n", preference1.Name, "")

		err = preferencesGetCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(&preference1, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("get preferences for multiple users as admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")
		cmd.Flags().StringP("name", "n", preference1.Name, "")

		err = preferencesGetCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(&preference1, printer.GetLines()[0])
		s.Require().Equal(&preference4, printer.GetLines()[1])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("get preferences for multiple users as non-admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")
		cmd.Flags().StringP("name", "n", preference1.Name, "")

		err = preferencesGetCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().Error(err)
	})
}

func (s *MmctlE2ETestSuite) TestPreferenceUpdateCmd() {
	s.SetupTestHelper().InitBasic()

	preference1 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	preference2 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "threads_view"}
	preference3 := model.Preference{UserId: s.th.BasicUser.Id, Category: "drafts", Name: "drafts_tour_tip_showed", Value: `{"drafts_tour_tip_showed":true}`}

	preference4 := model.Preference{UserId: s.th.BasicUser2.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}

	setup := func() {
		s.T().Helper()

		s.cleanUpPreferences(s.th.BasicUser.Id)
		s.cleanUpPreferences(s.th.BasicUser2.Id)

		_, err := s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference1})
		s.NoError(err)
		_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference2})
		s.NoError(err)
		_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference3})
		s.NoError(err)

		_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser2.Id, model.Preferences{preference4})
		s.NoError(err)
	}

	s.Run("add new preference for single user", func() {
		setup()
		printer.Clean()

		preferenceNew := model.Preference{UserId: s.th.BasicUser.Id, Category: "zzz_custom", Name: "new", Value: "value"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preferenceNew.Category, "")
		cmd.Flags().StringP("name", "n", preferenceNew.Name, "")
		cmd.Flags().StringP("value", "v", preferenceNew.Value, "")

		err := preferencesUpdateCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 4)
		s.Require().Equal(preference1, actualPreferencesUser1[0])
		s.Require().Equal(preference2, actualPreferencesUser1[1])
		s.Require().Equal(preference3, actualPreferencesUser1[2])
		s.Require().Equal(preferenceNew, actualPreferencesUser1[3])

		// Second user unaffected
		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 1)
		s.Require().Equal(preference4, actualPreferencesUser2[0])
	})

	s.Run("add new preference for multiple users as admin", func() {
		setup()
		printer.Clean()

		preferenceNew := model.Preference{UserId: s.th.BasicUser.Id, Category: "zzz_custom", Name: "new", Value: "value"}
		preferenceNew2 := model.Preference{UserId: s.th.BasicUser2.Id, Category: "zzz_custom", Name: "new", Value: "value"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preferenceNew.Category, "")
		cmd.Flags().StringP("name", "n", preferenceNew.Name, "")
		cmd.Flags().StringP("value", "v", preferenceNew.Value, "")

		err := preferencesUpdateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 4)
		s.Require().Equal(preference1, actualPreferencesUser1[0])
		s.Require().Equal(preference2, actualPreferencesUser1[1])
		s.Require().Equal(preference3, actualPreferencesUser1[2])
		s.Require().Equal(preferenceNew, actualPreferencesUser1[3])

		// Second user unaffected
		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 2)
		s.Require().Equal(preference4, actualPreferencesUser2[0])
		s.Require().Equal(preferenceNew2, actualPreferencesUser2[1])
	})

	s.Run("add new preference for multiple users as non-admin", func() {
		setup()
		printer.Clean()

		preference := model.Preference{Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference.Category, "")
		cmd.Flags().StringP("name", "n", preference.Name, "")
		cmd.Flags().StringP("value", "v", preference.Value, "")

		err := preferencesUpdateCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().Error(err)
	})

	s.Run("update existing preference for single user", func() {
		setup()
		printer.Clean()

		preferenceUpdated := model.Preference{UserId: s.th.BasicUser.Id, Category: preference1.Category, Name: preference1.Name, Value: "new_value"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preferenceUpdated.Category, "")
		cmd.Flags().StringP("name", "n", preferenceUpdated.Name, "")
		cmd.Flags().StringP("value", "v", preferenceUpdated.Value, "")

		err := preferencesUpdateCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 3)

		// We can't guarantee the order of preferences returned by the database since they are not sorted at SQL query level.
		s.Require().Contains(actualPreferencesUser1, preferenceUpdated)
		s.Require().Contains(actualPreferencesUser1, preference2)
		s.Require().Contains(actualPreferencesUser1, preference3)

		// Second user unaffected
		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 1)
		s.Require().Equal(preference4, actualPreferencesUser2[0])
	})

	s.Run("update existing preference for multiple users as admin", func() {
		setup()
		printer.Clean()

		preferenceUpdated := model.Preference{UserId: s.th.BasicUser.Id, Category: preference1.Category, Name: preference1.Name, Value: "new_value"}
		preferenceUpdated2 := model.Preference{UserId: s.th.BasicUser2.Id, Category: preference1.Category, Name: preference1.Name, Value: "new_value"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preferenceUpdated.Category, "")
		cmd.Flags().StringP("name", "n", preferenceUpdated.Name, "")
		cmd.Flags().StringP("value", "v", preferenceUpdated.Value, "")

		err := preferencesUpdateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 3)

		// We can't guarantee the order of preferences returned by the database since they are not sorted at SQL query level.
		s.Require().Contains(actualPreferencesUser1, preferenceUpdated)
		s.Require().Contains(actualPreferencesUser1, preference2)
		s.Require().Contains(actualPreferencesUser1, preference3)

		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 1)
		s.Require().Equal(preferenceUpdated2, actualPreferencesUser2[0])
	})

	s.Run("update existing preference for multiple users as non-admin", func() {
		setup()
		printer.Clean()

		preferenceUpdated := model.Preference{Category: preference1.Category, Name: preference1.Name, Value: "new_value"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preferenceUpdated.Category, "")
		cmd.Flags().StringP("name", "n", preferenceUpdated.Name, "")
		cmd.Flags().StringP("value", "v", preferenceUpdated.Value, "")

		err := preferencesUpdateCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().Error(err)
	})
}

func (s *MmctlE2ETestSuite) TestPreferenceDeleteCmd() {
	s.SetupTestHelper().InitBasic()

	s.cleanUpPreferences(s.th.BasicUser.Id)
	s.cleanUpPreferences(s.th.BasicUser2.Id)

	preference1 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	_, err := s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference1})
	s.NoError(err)
	preference2 := model.Preference{UserId: s.th.BasicUser.Id, Category: "display_settings", Name: "colorize_usernames", Value: "threads_view"}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference2})
	s.NoError(err)
	preference3 := model.Preference{UserId: s.th.BasicUser.Id, Category: "drafts", Name: "drafts_tour_tip_showed", Value: `{"drafts_tour_tip_showed":true}`}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser.Id, model.Preferences{preference3})
	s.NoError(err)

	preference4 := model.Preference{UserId: s.th.BasicUser2.Id, Category: "display_settings", Name: "collapsed_reply_threads", Value: "threads_view"}
	_, err = s.th.SystemAdminClient.UpdatePreferences(context.TODO(), s.th.BasicUser2.Id, model.Preferences{preference4})
	s.NoError(err)

	s.Run("delete non-existing preference for single user", func() {
		printer.Clean()

		preference := model.Preference{Category: "does", Name: "not"}

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference.Category, "")
		cmd.Flags().StringP("name", "n", preference.Name, "")

		err := preferencesDeleteCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 3)
		s.Require().Equal(preference1, actualPreferencesUser1[0])
		s.Require().Equal(preference2, actualPreferencesUser1[1])
		s.Require().Equal(preference3, actualPreferencesUser1[2])

		// Second user unaffected
		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 1)
		s.Require().Equal(preference4, actualPreferencesUser2[0])
	})

	s.Run("delete existing preference for single user", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")
		cmd.Flags().StringP("name", "n", preference1.Name, "")

		err := preferencesDeleteCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 2)
		s.Require().Equal(preference2, actualPreferencesUser1[0])
		s.Require().Equal(preference3, actualPreferencesUser1[1])

		// Second user unaffected
		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 1)
		s.Require().Equal(preference4, actualPreferencesUser2[0])
	})

	s.Run("delete existing preferences for multiple users as admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")
		cmd.Flags().StringP("name", "n", preference1.Name, "")

		err := preferencesDeleteCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)

		actualPreferencesUser1, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser1, 2)
		s.Require().Equal(preference2, actualPreferencesUser1[0])
		s.Require().Equal(preference3, actualPreferencesUser1[1])

		// Second user unaffected
		actualPreferencesUser2, _, err := s.th.SystemAdminClient.GetPreferences(context.TODO(), s.th.BasicUser2.Id)
		s.NoError(err)
		s.Require().Len(actualPreferencesUser2, 0)
	})

	s.Run("delete existing preferences for multiple users as non-admin", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringP("category", "c", preference1.Category, "")
		cmd.Flags().StringP("name", "n", preference1.Name, "")

		err := preferencesDeleteCmdF(s.th.Client, cmd, []string{s.th.BasicUser.Email, s.th.BasicUser2.Email})
		s.Require().Error(err)
	})
}

func (s *MmctlE2ETestSuite) TestSendPasswordResetEmailCmd() {
	s.SetupTestHelper().InitBasic()
	s.RunForAllClients("all users can send password reset email", func(c client.Client) {
		printer.Clean()
		emailArg1 := "demo1@example.com"
		emailArg2 := "demo2@example.com"

		err := sendPasswordResetEmailCmdF(c, &cobra.Command{}, []string{emailArg1, emailArg2})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("send valid and invalid email", func(c client.Client) {
		printer.Clean()
		emailArg1 := "demo@example.com"
		emailArg2 := "invalid.Email@example.com"

		var expected error
		expected = multierror.Append(expected, fmt.Errorf("invalid email '%s'", emailArg2))

		err := sendPasswordResetEmailCmdF(c, &cobra.Command{}, []string{emailArg1, emailArg2})
		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.RunForAllClients("no arguments passed", func(c client.Client) {
		printer.Clean()
		err := sendPasswordResetEmailCmdF(c, &cobra.Command{}, []string{})
		s.Require().EqualError(err, "expected at least one argument. See help text for details")
	})
}

func (s *MmctlE2ETestSuite) TestUserEditUsernameCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:    s.th.GenerateTestEmail(),
		Username: model.NewUsername(),
		Password: model.NewId(),
	})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Edit username successfully", func(c client.Client) {
		printer.Clean()

		oldUsername := user.Username
		newUsername := "editedusername" + model.NewRandomString(5)

		err := userEditUsernameCmdF(c, &cobra.Command{}, []string{user.Username, newUsername})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify username was updated
		updatedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(newUsername, updatedUser.Username)

		// Restore original username for next test
		user.Username = oldUsername
		_, appErr = s.th.App.UpdateUser(s.th.Context, user, false)
		s.Require().Nil(appErr)
	})

	s.Run("Edit username without permission", func() {
		printer.Clean()

		newUsername := "unauthorizedusername"

		err := userEditUsernameCmdF(s.th.Client, &cobra.Command{}, []string{user.Username, newUsername})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify username was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(user.Username, unchangedUser.Username)
	})

	s.RunForAllClients("Edit username with invalid username", func(c client.Client) {
		printer.Clean()

		invalidUsername := "invalid username with spaces"

		err := userEditUsernameCmdF(c, &cobra.Command{}, []string{user.Username, invalidUsername})
		s.Require().Error(err)
		s.Require().EqualError(err, "invalid username: '"+invalidUsername+"'")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify username was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(user.Username, unchangedUser.Username)
	})

	s.RunForAllClients("Edit username for nonexistent user", func(c client.Client) {
		printer.Clean()

		nonexistentUser := "nonexistentuser"
		newUsername := "newusername"

		err := userEditUsernameCmdF(c, &cobra.Command{}, []string{nonexistentUser, newUsername})
		s.Require().Error(err)
		s.Require().EqualError(err, "user "+nonexistentUser+" not found")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestUserEditEmailCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:    s.th.GenerateTestEmail(),
		Username: model.NewUsername(),
		Password: model.NewId(),
	})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Edit email successfully", func(c client.Client) {
		printer.Clean()

		oldEmail := user.Email
		newEmail := "newemail" + model.NewRandomString(5) + "@example.com"

		err := userEditEmailCmdF(c, &cobra.Command{}, []string{user.Username, newEmail})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify email was updated
		updatedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(newEmail, updatedUser.Email)

		// Restore original email for next test
		user.Email = oldEmail
		_, appErr = s.th.App.UpdateUser(s.th.Context, user, false)
		s.Require().Nil(appErr)
	})

	s.Run("Edit email without permission", func() {
		printer.Clean()

		newEmail := "unauthorized@example.com"

		err := userEditEmailCmdF(s.th.Client, &cobra.Command{}, []string{user.Username, newEmail})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify email was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(user.Email, unchangedUser.Email)
	})

	s.RunForAllClients("Edit email with invalid email", func(c client.Client) {
		printer.Clean()

		invalidEmail := "invalidemail"

		err := userEditEmailCmdF(c, &cobra.Command{}, []string{user.Username, invalidEmail})
		s.Require().Error(err)
		s.Require().EqualError(err, "invalid email: '"+invalidEmail+"'")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify email was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(user.Email, unchangedUser.Email)
	})

	s.RunForAllClients("Edit email for nonexistent user", func(c client.Client) {
		printer.Clean()

		nonexistentUser := "nonexistentuser"
		newEmail := "newemail@example.com"

		err := userEditEmailCmdF(c, &cobra.Command{}, []string{nonexistentUser, newEmail})
		s.Require().Error(err)
		s.Require().EqualError(err, "user "+nonexistentUser+" not found")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestUserEditAuthdataCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:       s.th.GenerateTestEmail(),
		Username:    model.NewUsername(),
		AuthData:    model.NewPointer("existingauthdata"),
		AuthService: model.UserAuthServiceLdap,
	})
	s.Require().Nil(appErr)

	newAuthdata := "newauthdata123"

	s.Run("Edit authdata without permission", func() {
		printer.Clean()

		err := userEditAuthdataCmdF(s.th.Client, &cobra.Command{}, []string{user.Username, newAuthdata})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify authdata was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().NotNil(unchangedUser.AuthData)
		s.Require().Equal("existingauthdata", *unchangedUser.AuthData)
	})

	s.RunForSystemAdminAndLocal("Clear authdata returns error", func(c client.Client) {
		printer.Clean()

		// Attempt to clear authdata with empty string should return error
		err := userEditAuthdataCmdF(c, &cobra.Command{}, []string{user.Username, ""})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify authdata was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().NotNil(unchangedUser.AuthData)
		s.Require().Equal("existingauthdata", *unchangedUser.AuthData)
	})

	s.RunForSystemAdminAndLocal("Edit authdata with too long value", func(c client.Client) {
		printer.Clean()

		// Create authdata longer than maximum allowed length
		longAuthdata := make([]byte, model.UserAuthDataMaxLength+1)
		for i := range longAuthdata {
			longAuthdata[i] = 'a'
		}

		err := userEditAuthdataCmdF(c, &cobra.Command{}, []string{user.Username, string(longAuthdata)})
		s.Require().Error(err)
		s.Require().EqualError(err, fmt.Sprintf("authdata too long. Maximum length is %d characters", model.UserAuthDataMaxLength))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify authdata was not changed
		unchangedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().NotNil(unchangedUser.AuthData)
		s.Require().Equal("existingauthdata", *unchangedUser.AuthData)
	})

	s.RunForSystemAdminAndLocal("Edit authdata for nonexistent user", func(c client.Client) {
		printer.Clean()

		nonexistentUser := "nonexistentuser"

		err := userEditAuthdataCmdF(c, &cobra.Command{}, []string{nonexistentUser, newAuthdata})
		s.Require().Error(err)
		s.Require().EqualError(err, "user "+nonexistentUser+" not found")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
	s.RunForSystemAdminAndLocal("Edit authdata successfully", func(c client.Client) {
		printer.Clean()

		err := userEditAuthdataCmdF(c, &cobra.Command{}, []string{user.Username, newAuthdata})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify authdata was updated
		updatedUser, appErr := s.th.App.GetUser(user.Id)
		s.Require().Nil(appErr)
		s.Require().NotNil(updatedUser.AuthData)
		s.Require().Equal(newAuthdata, *updatedUser.AuthData)
	})
}
