// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
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

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
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
		s.Require().Equal(printer.GetErrorLines()[0], "unable to change activation status of user: "+user.Id)

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

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
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
		s.Require().Equal(printer.GetErrorLines()[0], "unable to change activation status of user: "+user.Id)

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
		user := printer.GetLines()[0].(*model.User)
		s.Equal(s.th.BasicUser.Username, user.Username)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.RunForAllClients("Search for a nonexistent user", func(c client.Client) {
		printer.Clean()
		emailArg := "nonexistentUser@example.com"

		err := searchUserCmdF(c, &cobra.Command{}, []string{emailArg})
		s.Require().Nil(err)
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
	for i := 0; i < 10; i++ {
		userData := model.User{
			Username: "fakeuser" + model.NewRandomString(10),
			Password: "Pa$$word11",
			Email:    s.th.GenerateTestEmail(),
		}
		usr, err := s.th.App.CreateUser(s.th.Context, &userData)
		s.Require().Nil(err)
		userPool = append(userPool, usr.Username)
	}

	s.RunForAllClients("Get some random user", func(c client.Client) {
		printer.Clean()

		var page int
		var all bool
		perpage := 5
		team := ""
		cmd := &cobra.Command{}
		cmd.Flags().IntVar(&page, "page", page, "page")
		cmd.Flags().IntVar(&perpage, "per-page", perpage, "perpage")
		cmd.Flags().BoolVar(&all, "all", all, "all")
		cmd.Flags().StringVar(&team, "team", team, "team")

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

		var page int
		perpage := 10
		all := true
		team := ""
		cmd := &cobra.Command{}
		cmd.Flags().IntVar(&page, "page", page, "page")
		cmd.Flags().IntVar(&perpage, "per-page", perpage, "perpage")
		cmd.Flags().BoolVar(&all, "all", all, "all")
		cmd.Flags().StringVar(&team, "team", team, "team")

		err := listUsersCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().GreaterOrEqual(len(printer.GetLines()), 14)
		s.Len(printer.GetErrorLines(), 0)
		for _, each := range printer.GetLines() {
			user := each.(*model.User)
			s.Require().Contains(userPool, user.Username)
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
			fmt.Sprintf("Unable to invite user with email %s to team %s. Error: : Email invitations are disabled.",
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
			fmt.Sprintf(`Unable to invite user with email %s to team %s. Error: : The following email addresses do not belong to an accepted domain: %s. Please contact your System Administrator for details.`,
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

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId(), MfaActive: true, MfaSecret: "secret"})
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

		userMfaInactive, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId(), MfaActive: false})
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
			expected, fmt.Errorf(`unable to reset user %q MFA. Error: : You do not have the appropriate permissions.`, user.Id), //nolint:revive

		)

		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestVerifyUserEmailWithoutTokenCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
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
			expected, fmt.Errorf("unable to verify user "+user.Id+" email: : You do not have the appropriate permissions."),
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
		s.Require().ErrorContains(err, "GetUserByEmail: Unable to find the user., failed to find User: resource: User id: email="+email)
	})

	s.RunForAllClients("Should not create a user w/o email", func(c client.Client) {
		printer.Clean()
		username := model.NewId()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("password", "somepass", "")

		err := userCreateCmdF(c, cmd, []string{})
		s.EqualError(err, "Email is required: flag accessed but not defined: email")
		s.Require().Empty(printer.GetLines())
		_, err = s.th.App.GetUserByUsername(username)
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "GetUserByUsername: Unable to find an existing account matching your username for this team. This team may require an invite from the team owner to join., failed to find User: resource: User id: username="+username)
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
		s.Require().ErrorContains(err, "GetUserByEmail: Unable to find the user., failed to find User: resource: User id: email="+email)
	})

	s.Run("Should create a user but w/o system-admin privileges", func() {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		username := model.NewId()
		cmd := &cobra.Command{}
		cmd.Flags().String("username", username, "")
		cmd.Flags().String("email", email, "")
		cmd.Flags().String("password", "password", "")
		cmd.Flags().Bool("system-admin", true, "")

		err := userCreateCmdF(s.th.Client, cmd, []string{})
		s.EqualError(err, "Unable to update user roles. Error: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		user, err := s.th.App.GetUserByEmail(email)
		s.Require().Nil(err)
		s.Equal(username, user.Username)
		s.Equal(false, user.IsSystemAdmin())
	})

	s.RunForSystemAdminAndLocal("Should create new system-admin user given required params", func(c client.Client) {
		printer.Clean()
		email := s.th.GenerateTestEmail()
		username := model.NewId()
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
		username := model.NewId()
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
		username := model.NewId()
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

func (s *MmctlE2ETestSuite) TestUpdateUserEmailCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("admin and local user can change user email", func(c client.Client) {
		printer.Clean()
		oldEmail := s.th.BasicUser2.Email
		newEmail := "basicuser2@fakedomain.com"
		err := updateUserEmailCmdF(c, &cobra.Command{}, []string{s.th.BasicUser2.Email, newEmail})
		s.Require().Nil(err)

		u, err := s.th.App.GetUser(s.th.BasicUser2.Id)
		s.Require().Nil(err)
		s.Require().Equal(newEmail, u.Email)

		u.Email = oldEmail
		_, err = s.th.App.UpdateUser(s.th.Context, u, false)
		s.Require().Nil(err)
	})

	s.Run("normal user doesn't have permission to change another user's email", func() {
		printer.Clean()
		newEmail := "basicuser2-change@fakedomain.com"
		err := updateUserEmailCmdF(s.th.Client, &cobra.Command{}, []string{s.th.BasicUser2.Id, newEmail})
		s.Require().EqualError(err, ": You do not have the appropriate permissions.")

		u, err := s.th.App.GetUser(s.th.BasicUser2.Id)
		s.Require().Nil(err)
		s.Require().Equal(s.th.BasicUser2.Email, u.Email)
	})

	s.Run("normal users can't update their own email due to security reasons", func() {
		printer.Clean()

		newEmail := "basicuser-change@fakedomain.com"
		err := updateUserEmailCmdF(s.th.Client, &cobra.Command{}, []string{s.th.BasicUser.Id, newEmail})
		s.Require().EqualError(err, ": Invalid or missing password in request body.")
	})
}

func (s *MmctlE2ETestSuite) TestUpdateUsernameCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("admin and local user can change user name", func(c client.Client) {
		printer.Clean()
		oldName := s.th.BasicUser2.Username
		newName := "basicusernamechange"
		err := updateUsernameCmdF(c, &cobra.Command{}, []string{s.th.BasicUser2.Username, newName})
		s.Require().Nil(err)

		u, err := s.th.App.GetUser(s.th.BasicUser2.Id)
		s.Require().Nil(err)
		s.Require().Equal(newName, u.Username)

		u.Username = oldName
		_, err = s.th.App.UpdateUser(s.th.Context, u, false)
		s.Require().Nil(err)
	})

	s.Run("normal user doesn't have permission to change another user's name", func() {
		printer.Clean()
		newUsername := "basicusernamechange"
		err := updateUsernameCmdF(s.th.Client, &cobra.Command{}, []string{s.th.BasicUser2.Id, newUsername})
		s.Require().EqualError(err, ": You do not have the appropriate permissions.")

		u, err := s.th.App.GetUser(s.th.BasicUser2.Id)
		s.Require().Nil(err)
		s.Require().Equal(s.th.BasicUser2.Username, u.Username)
	})

	s.Run("Can't change by a invalid username", func() {
		printer.Clean()
		newUsername := "invalid username"
		err := updateUsernameCmdF(s.th.Client, &cobra.Command{}, []string{s.th.BasicUser2.Id, newUsername})
		s.Require().EqualError(err, "invalid username: '"+newUsername+"'")

		u, err := s.th.App.GetUser(s.th.BasicUser2.Id)
		s.Require().Nil(err)
		s.Require().Equal(s.th.BasicUser2.Username, u.Username)
	})

	s.RunForSystemAdminAndLocal("Delete nonexistent user", func(c client.Client) {
		printer.Clean()
		oldName := "nonexistentuser"
		newUsername := "basicusernamechange"
		err := updateUsernameCmdF(s.th.Client, &cobra.Command{}, []string{oldName, newUsername})
		s.Require().EqualError(err, "unable to find user '"+oldName+"'")
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
		s.Require().Equal("GetUser: Unable to find the user., resource: User id: "+newUser.Id, err.Error())
	})

	s.RunForSystemAdminAndLocal("Delete nonexistent user", func(c client.Client) {
		printer.Clean()
		emailArg := "nonexistentUser@example.com"

		previousVal := s.th.App.Config().ServiceSettings.EnableAPIUserDeletion
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = true })
		defer func() {
			s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = *previousVal })
		}()

		cmd := &cobra.Command{}
		confirm := true
		cmd.Flags().BoolVar(&confirm, "confirm", confirm, "confirm")

		err := deleteUsersCmdF(c, cmd, []string{emailArg})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Equal(fmt.Sprintf("1 error occurred:\n\t* user %s not found\n\n", emailArg), printer.GetErrorLines()[0])
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
		err := deleteUsersCmdF(s.th.Client, cmd, []string{newUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("Unable to delete user '%s' error: : You do not have the appropriate permissions.", newUser.Username), printer.GetErrorLines()[0])

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
		err := deleteUsersCmdF(s.th.SystemAdminClient, cmd, []string{newUser.Email})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("Unable to delete user '%s' error: : Permanent user deletion feature is not enabled. Please contact your System Administrator.", newUser.Username), printer.GetErrorLines()[0])

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
		s.Require().EqualError(err, "GetUser: Unable to find the user., resource: User id: "+newUser.Id)
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

		user, _ := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})

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
		s.Equal(": You do not have the appropriate permissions.", printer.GetErrorLines()[0])
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
		s.EqualError(err, ": You do not have the appropriate permissions.")
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
		for i := 0; i < 10; i++ {
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

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.th.App.UpdateConfig(func(c *model.Config) { *c.GuestAccountsSettings.Enable = true })
	defer s.th.App.UpdateConfig(func(c *model.Config) { *c.GuestAccountsSettings.Enable = false })

	s.Require().Nil(s.th.App.DemoteUserToGuest(s.th.Context, user))

	s.RunForSystemAdminAndLocal("MM-T3936 Promote a guest to a user", func(c client.Client) {
		printer.Clean()

		err := promoteGuestToUserCmdF(c, nil, []string{user.Email})
		s.Require().Nil(err)
		defer s.Require().Nil(s.th.App.DemoteUserToGuest(s.th.Context, user))
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("MM-T3937 Promote a guest to a user with normal client", func() {
		printer.Clean()

		err := promoteGuestToUserCmdF(s.th.Client, nil, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to promote guest %s: %s", user.Email, ": You do not have the appropriate permissions."), printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestDemoteUserToGuestCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
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
		s.Require().Equal(fmt.Sprintf("unable to demote user %s: %s", user.Email, ": You do not have the appropriate permissions."), printer.GetErrorLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestMigrateAuthCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	configForLdap(s.th)

	s.Require().NoError(s.th.App.Srv().Jobs.StartWorkers()) // we need to start workers do actual sync

	ldapUser, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:       s.th.GenerateTestEmail(),
		Username:    model.NewId(),
		AuthData:    model.NewString("test.user.1"),
		AuthService: model.UserAuthServiceLdap,
	})
	s.Require().Nil(appErr)

	samlUser, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:       "success+devone@simulator.amazonses.com",
		Username:    "dev.one",
		AuthData:    model.NewString("dev.one"),
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
			_, appErr := s.th.App.UpdateUserAuth(ldapUser.Id, &model.UserAuth{
				AuthData:    model.NewString("test.user.1"),
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
			_, appErr := s.th.App.UpdateUserAuth(samlUser.Id, &model.UserAuth{
				AuthData:    model.NewString("dev.one"),
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
