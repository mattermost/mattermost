// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// assertUserInSlice checks if a user is present in a slice of users
func (s *MmctlE2ETestSuite) assertUserInSlice(users []*model.User, targetUser *model.User, shouldBeFound bool, msg string) {
	s.T().Helper()

	found := false
	for _, u := range users {
		if u.Id == targetUser.Id {
			found = true
			break
		}
	}

	if shouldBeFound {
		s.Require().True(found, msg)
	} else {
		s.Require().False(found, msg)
	}
}

// assertUserNotInSlice checks that a user is not present in any user in a slice (for OutOfChannel checks)
func (s *MmctlE2ETestSuite) assertUserNotInSlice(users []*model.User, targetUser *model.User, msg string) {
	s.T().Helper()

	for _, u := range users {
		s.Require().NotEqual(targetUser.Id, u.Id, msg)
	}
}

func (s *MmctlE2ETestSuite) TestUserDeactivationAutocompleteExclusion() {
	s.SetupTestHelper().InitBasic()

	// Create a test user for deactivation testing
	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:    s.th.GenerateTestEmail(),
		Username: "autocomplete-test-user",
		Password: model.NewId(),
	})
	s.Require().Nil(appErr)

	// Add user to team and channel for autocomplete testing
	s.th.LinkUserToTeam(user, s.th.BasicTeam)
	s.th.AddUserToChannel(user, s.th.BasicChannel)

	s.RunForSystemAdminAndLocal("Deactivated user should be excluded from autocomplete", func(c client.Client) {
		printer.Clean()

		// Ensure user is active first
		_, appErr := s.th.App.UpdateActive(s.th.Context, user, true)
		s.Require().Nil(appErr)

		// Verify user appears in autocomplete before deactivation (using API directly)
		rusers, _, err := s.th.SystemAdminClient.AutocompleteUsersInChannel(
			context.Background(),
			s.th.BasicTeam.Id,
			s.th.BasicChannel.Id,
			"autocomplete-test",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		// Check that the user is in autocomplete results
		s.assertUserInSlice(rusers.Users, user, true, "active user should appear in autocomplete results")

		// Deactivate user via mmctl
		err = userDeactivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		printer.Clean()

		// Verify user is deactivated
		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().NotZero(ruser.DeleteAt)

		// Verify user does not appear in autocomplete after deactivation
		// This uses the default API behavior with AllowInactive=false
		rusers, _, err = s.th.SystemAdminClient.AutocompleteUsersInChannel(
			context.Background(),
			s.th.BasicTeam.Id,
			s.th.BasicChannel.Id,
			"autocomplete-test",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		// Check that the user is not in autocomplete results
		s.assertUserInSlice(rusers.Users, user, false, "deactivated user should not appear in autocomplete results")

		// Also check OutOfChannel users are properly filtered
		s.assertUserNotInSlice(rusers.OutOfChannel, user, "deactivated user should not appear in out-of-channel autocomplete results")

		// Reactivate user via mmctl
		err = userActivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)

		// Verify user appears in autocomplete again after reactivation
		rusers, _, err = s.th.SystemAdminClient.AutocompleteUsersInChannel(
			context.Background(),
			s.th.BasicTeam.Id,
			s.th.BasicChannel.Id,
			"autocomplete-test",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		// Check that the user is back in autocomplete results
		s.assertUserInSlice(rusers.Users, user, true, "reactivated user should appear in autocomplete results again")
	})
}

func (s *MmctlE2ETestSuite) TestUserDeactivationAutocompleteExclusionMultipleContexts() {
	s.SetupTestHelper().InitBasic()

	// Create a test user for deactivation testing
	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{
		Email:    s.th.GenerateTestEmail(),
		Username: "autocomplete-multi-test-user",
		Password: model.NewId(),
	})
	s.Require().Nil(appErr)

	// Add user to team for autocomplete testing
	s.th.LinkUserToTeam(user, s.th.BasicTeam)
	s.th.AddUserToChannel(user, s.th.BasicChannel)

	s.RunForSystemAdminAndLocal("Deactivated user should be excluded from all autocomplete contexts", func(c client.Client) {
		printer.Clean()

		// Ensure user is active first
		_, appErr := s.th.App.UpdateActive(s.th.Context, user, true)
		s.Require().Nil(appErr)

		// Test 1: Team-level autocomplete
		teamUsers, _, err := s.th.SystemAdminClient.AutocompleteUsersInTeam(
			context.Background(),
			s.th.BasicTeam.Id,
			"autocomplete-multi",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		// Check that the user is in team autocomplete results
		s.assertUserInSlice(teamUsers.Users, user, true, "active user should appear in team autocomplete results")

		// Test 2: General user search (used for DM creation)
		searchUsers, _, err := s.th.SystemAdminClient.SearchUsers(context.Background(), &model.UserSearch{
			Term: "autocomplete-multi",
		})
		s.Require().NoError(err)

		// Check that the user is in search results
		s.assertUserInSlice(searchUsers, user, true, "active user should appear in user search results")

		// Deactivate user via mmctl
		err = userDeactivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		printer.Clean()

		// Verify user is deactivated
		ruser, err := s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().NotZero(ruser.DeleteAt)

		// Test 1 After Deactivation: Team-level autocomplete
		// This uses the default API behavior with AllowInactive=false
		teamUsers, _, err = s.th.SystemAdminClient.AutocompleteUsersInTeam(
			context.Background(),
			s.th.BasicTeam.Id,
			"autocomplete-multi",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		// Check that the user is NOT in team autocomplete results
		s.assertUserInSlice(teamUsers.Users, user, false, "deactivated user should not appear in team autocomplete results")

		// Test 2 After Deactivation: General user search
		// This uses the default API behavior with AllowInactive=false
		searchUsers, _, err = s.th.SystemAdminClient.SearchUsers(context.Background(), &model.UserSearch{
			Term: "autocomplete-multi",
			// AllowInactive is false by default
		})
		s.Require().NoError(err)

		// Check that the user is NOT in search results
		s.assertUserInSlice(searchUsers, user, false, "deactivated user should not appear in user search results")

		// Test 3: Channel autocomplete (should also be excluded)
		// This uses the default API behavior with AllowInactive=false
		channelUsers, _, err := s.th.SystemAdminClient.AutocompleteUsersInChannel(
			context.Background(),
			s.th.BasicTeam.Id,
			s.th.BasicChannel.Id,
			"autocomplete-multi",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		// Check that the user is NOT in channel autocomplete results
		s.assertUserInSlice(channelUsers.Users, user, false, "deactivated user should not appear in channel autocomplete results")

		// Also check that deactivated user is not in OutOfChannel list
		s.assertUserNotInSlice(channelUsers.OutOfChannel, user, "deactivated user should not appear in out-of-channel autocomplete results")

		// Reactivate user via mmctl
		err = userActivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)

		// Verify all autocomplete contexts work after reactivation
		// Team autocomplete
		teamUsers, _, err = s.th.SystemAdminClient.AutocompleteUsersInTeam(
			context.Background(),
			s.th.BasicTeam.Id,
			"autocomplete-multi",
			model.UserSearchDefaultLimit,
			"",
		)
		s.Require().NoError(err)

		s.assertUserInSlice(teamUsers.Users, user, true, "reactivated user should appear in team autocomplete results again")

		// User search
		searchUsers, _, err = s.th.SystemAdminClient.SearchUsers(context.Background(), &model.UserSearch{
			Term: "autocomplete-multi",
		})
		s.Require().NoError(err)

		s.assertUserInSlice(searchUsers, user, true, "reactivated user should appear in user search results again")

		// Test 4: Check that deactivated users can be found with AllowInactive=true option
		// First, deactivate user again
		err = userDeactivateCmdF(c, &cobra.Command{}, []string{user.Email})
		s.Require().Nil(err)

		// Verify user is deactivated
		ruser, err = s.th.App.GetUser(user.Id)
		s.Require().Nil(err)
		s.Require().NotZero(ruser.DeleteAt)

		// Search with AllowInactive=true
		searchUsers, _, err = s.th.SystemAdminClient.SearchUsers(context.Background(), &model.UserSearch{
			Term:          "autocomplete-multi",
			AllowInactive: true,
		})
		s.Require().NoError(err)

		// Check that the user IS found when AllowInactive=true
		s.assertUserInSlice(searchUsers, user, true, "deactivated user should appear in search results when AllowInactive=true")
	})
}
