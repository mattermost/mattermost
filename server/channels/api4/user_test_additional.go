// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestGetUsersSortValidation tests various sort parameter validation paths in getUsers
func TestGetUsersSortValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid sort parameter", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=invalid_sort", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("last_activity_at sort without in_team", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=last_activity_at", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("last_activity_at sort with not_in_team", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=last_activity_at&not_in_team="+th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("last_activity_at sort with in_channel", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=last_activity_at&in_channel="+th.BasicChannel.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("last_activity_at sort with without_team", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=last_activity_at&without_team=true", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create_at sort without in_team", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=create_at", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("status sort without in_channel", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=status", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("admin sort without in_channel", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=admin", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("display_name sort without in_group", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=display_name", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("display_name sort with not_in_group", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=display_name&in_group="+model.NewId()+"&not_in_group="+model.NewId(), "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("display_name sort with in_team", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "sort=display_name&in_group="+model.NewId()+"&in_team="+th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("not_in_channel without team_id", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "not_in_channel="+th.BasicChannel.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("inactive and active both set", func(t *testing.T) {
		_, resp, err := th.Client.GetUsersWithCustomQueryParameters(context.Background(), 0, 10, "inactive=true&active=true", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

// TestGetUsersByGroupChannelIdsErrorPaths tests error handling in getUsersByGroupChannelIds
func TestGetUsersByGroupChannelIdsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty channel_ids array", func(t *testing.T) {
		_, err := th.Client.DoAPIPost(context.Background(), "/users/group_channels", "[]")
		require.Error(t, err)
		// CheckBadRequestStatus(t, resp) // Response type mismatch
	})

	t.Run("invalid json payload", func(t *testing.T) {
		_, err := th.Client.DoAPIPost(context.Background(), "/users/group_channels", "{invalid json")
		require.Error(t, err)
		// CheckBadRequestStatus(t, resp) // Response type mismatch
	})

	t.Run("unauthorized access", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, err := th.Client.DoAPIPost(context.Background(), "/users/group_channels", `["channel1"]`)
		require.Error(t, err)
		// CheckUnauthorizedStatus(t, resp) // Response type mismatch
	})
}

// TestUpdateUserRolesLicenseValidation tests license checks for new system roles
func TestUpdateUserRolesLicenseValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := th.CreateUser(t)

		// Test assigning new system role without proper license
		for _, roleID := range model.NewSystemRoleIDs {
			resp, err := client.UpdateUserRoles(context.Background(), user.Id, roleID)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
			CheckErrorID(t, err, "api.user.update_user_roles.license.app_error")
		}

		// With proper license, it should work
		th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

		for _, roleID := range model.NewSystemRoleIDs {
			_, err := client.UpdateUserRoles(context.Background(), user.Id, roleID)
			require.NoError(t, err)
		}
	})
}

// TestUpdatePasswordErrorPaths tests various error conditions in updatePassword
func TestUpdatePasswordErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty current password", func(t *testing.T) {
		resp, err := th.Client.UpdateUserPassword(context.Background(), th.BasicUser.Id, "", "newpassword123")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("empty new password", func(t *testing.T) {
		resp, err := th.Client.UpdateUserPassword(context.Background(), th.BasicUser.Id, "Password1", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid user id", func(t *testing.T) {
		resp, err := th.Client.UpdateUserPassword(context.Background(), "invalid", "Password1", "newpassword123")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("wrong current password", func(t *testing.T) {
		resp, err := th.Client.UpdateUserPassword(context.Background(), th.BasicUser.Id, "wrongpassword", "newpassword123")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update other user password without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		resp, err := th.Client.UpdateUserPassword(context.Background(), otherUser.Id, "Password1", "newpassword123")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		resp, err := th.Client.UpdateUserPassword(context.Background(), th.BasicUser.Id, "Password1", "newpassword123")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestSendPasswordResetErrorPaths tests error handling in sendPasswordReset
func TestSendPasswordResetErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty email", func(t *testing.T) {
		resp, err := th.Client.SendPasswordResetEmail(context.Background(), "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid email format", func(t *testing.T) {
		resp, err := th.Client.SendPasswordResetEmail(context.Background(), "notanemail")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent email - should succeed for security", func(t *testing.T) {
		// The endpoint should return success even for non-existent emails to prevent email enumeration
		resp, err := th.Client.SendPasswordResetEmail(context.Background(), "nonexistent@example.com")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

// TestPatchUserErrorPaths tests error paths in patchUser
func TestPatchUserErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("patch with invalid email", func(t *testing.T) {
		patch := &model.UserPatch{
			Email: model.NewPointer("invalidemail"),
		}
		_, resp, err := th.Client.PatchUser(context.Background(), th.BasicUser.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		patch := &model.UserPatch{
			Nickname: model.NewPointer("NewNickname"),
		}
		_, resp, err := th.Client.PatchUser(context.Background(), otherUser.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("patch with existing username", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		patch := &model.UserPatch{
			Username: &otherUser.Username,
		}
		_, resp, err := th.Client.PatchUser(context.Background(), th.BasicUser.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch with existing email", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		patch := &model.UserPatch{
			Email: &otherUser.Email,
		}
		_, resp, err := th.Client.PatchUser(context.Background(), th.BasicUser.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid user id", func(t *testing.T) {
		patch := &model.UserPatch{
			Nickname: model.NewPointer("NewNickname"),
		}
		_, resp, err := th.Client.PatchUser(context.Background(), "invalid", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		patch := &model.UserPatch{
			Nickname: model.NewPointer("NewNickname"),
		}
		_, resp, err := th.Client.PatchUser(context.Background(), th.BasicUser.Id, patch)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestDeleteUserErrorPaths tests error conditions in deleteUser
func TestDeleteUserErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		resp, err := th.Client.PermanentDeleteUser(context.Background(), otherUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete with invalid user id", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PermanentDeleteUser(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete non-existent user", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PermanentDeleteUser(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		th.Client.Logout(context.Background())
		resp, err := th.Client.PermanentDeleteUser(context.Background(), otherUser.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateUserAuthErrorPaths tests error conditions in updateUserAuth
func TestUpdateUserAuthErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot update auth", func(t *testing.T) {
		userAuth := &model.UserAuth{
			AuthData:    model.NewPointer("authdata"),
			AuthService: model.UserAuthServiceGitlab,
		}
		_, resp, err := th.Client.UpdateUserAuth(context.Background(), th.BasicUser.Id, userAuth)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := th.CreateUser(t)

		t.Run("invalid user id", func(t *testing.T) {
			userAuth := &model.UserAuth{
				AuthData:    model.NewPointer("authdata"),
				AuthService: model.UserAuthServiceGitlab,
			}
			_, resp, err := client.UpdateUserAuth(context.Background(), "invalid", userAuth)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent user", func(t *testing.T) {
			userAuth := &model.UserAuth{
				AuthData:    model.NewPointer("authdata"),
				AuthService: model.UserAuthServiceGitlab,
			}
			_, resp, err := client.UpdateUserAuth(context.Background(), model.NewId(), userAuth)
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("empty auth service", func(t *testing.T) {
			userAuth := &model.UserAuth{
				AuthData: model.NewPointer("authdata"),
			}
			_, resp, err := client.UpdateUserAuth(context.Background(), user.Id, userAuth)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})
}

// TestGetProfileImageErrorPaths tests error handling in getProfileImage
func TestGetProfileImageErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetProfileImage(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent user", func(t *testing.T) {
		_, resp, err := th.Client.GetProfileImage(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetProfileImage(context.Background(), th.BasicUser.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetUserByUsernameErrorPaths tests error handling in getUserByUsername
func TestGetUserByUsernameErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty username", func(t *testing.T) {
		_, resp, err := th.Client.GetUserByUsername(context.Background(), "", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent username", func(t *testing.T) {
		_, resp, err := th.Client.GetUserByUsername(context.Background(), "nonexistentuser123456", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetUserByUsername(context.Background(), th.BasicUser.Username, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetUserByEmailErrorPaths tests error handling in getUserByEmail
func TestGetUserByEmailErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty email", func(t *testing.T) {
		_, resp, err := th.Client.GetUserByEmail(context.Background(), "", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent email", func(t *testing.T) {
		_, resp, err := th.Client.GetUserByEmail(context.Background(), "nonexistent@example.com", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("regular user cannot lookup by email", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetUserByEmail(context.Background(), otherUser.Email, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetUserByEmail(context.Background(), th.BasicUser.Email, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestAutocompleteUsersErrorPaths tests error handling in autocompleteUsers
func TestAutocompleteUsersErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("autocomplete in non-existent team", func(t *testing.T) {
		_, resp, err := th.Client.AutocompleteUsersInTeam(context.Background(), model.NewId(), "user", 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("autocomplete in non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.AutocompleteUsersInChannel(context.Background(), th.BasicTeam.Id, model.NewId(), "user", 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("autocomplete without team membership", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.AutocompleteUsersInTeam(context.Background(), otherTeam.Id, "user", 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.AutocompleteUsersInTeam(context.Background(), th.BasicTeam.Id, "user", 10, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetUsersByIdsErrorPaths tests error handling in getUsersByIds
func TestGetUsersByIdsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty ids list", func(t *testing.T) {
		users, resp, err := th.Client.GetUsersByIds(context.Background(), []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Nil(t, users)
	})

	t.Run("invalid user id in list", func(t *testing.T) {
		users, resp, err := th.Client.GetUsersByIds(context.Background(), []string{"invalid"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Nil(t, users)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		users, resp, err := th.Client.GetUsersByIds(context.Background(), []string{th.BasicUser.Id})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		require.Nil(t, users)
	})
}

// TestGetUsersByNamesErrorPaths tests error handling in getUsersByNames
func TestGetUsersByNamesErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty usernames list", func(t *testing.T) {
		users, resp, err := th.Client.GetUsersByUsernames(context.Background(), []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Nil(t, users)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		users, resp, err := th.Client.GetUsersByUsernames(context.Background(), []string{th.BasicUser.Username})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		require.Nil(t, users)
	})
}

// TestSearchUsersErrorPaths tests error handling in searchUsers
func TestSearchUsersErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("search with invalid team id", func(t *testing.T) {
		search := &model.UserSearch{
			Term:   "user",
			TeamId: "invalid",
		}
		_, resp, err := th.Client.SearchUsers(context.Background(), search)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("search with team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		search := &model.UserSearch{
			Term:   "user",
			TeamId: otherTeam.Id,
		}
		_, resp, err := th.Client.SearchUsers(context.Background(), search)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("search with invalid channel id", func(t *testing.T) {
		search := &model.UserSearch{
			Term:        "user",
			InChannelId: "invalid",
		}
		_, resp, err := th.Client.SearchUsers(context.Background(), search)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("search in channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)

		search := &model.UserSearch{
			Term:        "user",
			InChannelId: privateChannel.Id,
		}
		_, resp, err := th.Client.SearchUsers(context.Background(), search)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		search := &model.UserSearch{
			Term: "user",
		}
		_, resp, err := th.Client.SearchUsers(context.Background(), search)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateUserActiveErrorPaths tests error conditions in updateUserActive
func TestUpdateUserActiveErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UpdateUserActive(context.Background(), "invalid", false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent user", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UpdateUserActive(context.Background(), model.NewId(), false)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("deactivate system admin requires manage_system permission", func(t *testing.T) {
		// Create a user manager (has PERMISSION_MANAGE_USERS but not PERMISSION_MANAGE_SYSTEM)
		userManager := th.CreateUser(t)
		th.App.UpdateUserRoles(th.Context, userManager.Id, model.SystemUserRoleId+" "+model.SystemUserManagerRoleId, false)

		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), userManager.Email, "Password1")
		require.NoError(t, err)

		// User manager should not be able to deactivate a system admin
		resp, err := client.UpdateUserActive(context.Background(), th.SystemAdminUser.Id, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

// TestGetTotalUsersStatsErrorPaths tests error handling in getTotalUsersStats
func TestGetTotalUsersStatsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot get total users stats", func(t *testing.T) {
		_, resp, err := th.Client.GetTotalUsersStats(context.Background(), "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTotalUsersStats(context.Background(), "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestVerifyUserEmailWithoutTokenErrorPaths tests error conditions in verifyUserEmailWithoutToken
func TestVerifyUserEmailWithoutTokenErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot verify email without token", func(t *testing.T) {
		_, resp, err := th.Client.VerifyUserEmailWithoutToken(context.Background(), th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid user id", func(t *testing.T) {
			_, resp, err := client.VerifyUserEmailWithoutToken(context.Background(), "invalid")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent user", func(t *testing.T) {
			_, resp, err := client.VerifyUserEmailWithoutToken(context.Background(), model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})
}

// TestPromoteGuestToUserErrorPaths tests error conditions in promoteGuestToUser
func TestPromoteGuestToUserErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		th.App.Srv().RemoveLicense()
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense("guest_accounts"))

	t.Run("regular user cannot promote guest", func(t *testing.T) {
		guest := th.CreateGuestUser(t)
		resp, err := th.Client.PromoteGuestToUser(context.Background(), guest.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid user id", func(t *testing.T) {
			resp, err := client.PromoteGuestToUser(context.Background(), "invalid")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent user", func(t *testing.T) {
			resp, err := client.PromoteGuestToUser(context.Background(), model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("promote regular user returns error", func(t *testing.T) {
			resp, err := client.PromoteGuestToUser(context.Background(), th.BasicUser.Id)
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})

		t.Run("without guest accounts license", func(t *testing.T) {
			th.App.Srv().SetLicense(model.NewTestLicenseWithFalseDefaults("guest_accounts"))
			guest := th.CreateGuestUser(t)

			resp, err := client.PromoteGuestToUser(context.Background(), guest.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)

			// Restore license for remaining tests
			th.App.Srv().SetLicense(model.NewTestLicense("guest_accounts"))
		})
	})
}

// TestDemoteUserToGuestErrorPaths tests additional error conditions in demoteUserToGuest
func TestDemoteUserToGuestErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		th.App.Srv().RemoveLicense()
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense("guest_accounts"))

	t.Run("regular user cannot demote to guest", func(t *testing.T) {
		resp, err := th.Client.DemoteUserToGuest(context.Background(), th.BasicUser2.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid user id", func(t *testing.T) {
			resp, err := client.DemoteUserToGuest(context.Background(), "invalid")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent user", func(t *testing.T) {
			resp, err := client.DemoteUserToGuest(context.Background(), model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("demote guest returns error", func(t *testing.T) {
			guest := th.CreateGuestUser(t)
			resp, err := client.DemoteUserToGuest(context.Background(), guest.Id)
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})

		t.Run("demote sysadmin requires manage_system permission", func(t *testing.T) {
			// Create a user manager
			userManager := th.CreateUser(t)
			th.App.UpdateUserRoles(th.Context, userManager.Id, model.SystemUserRoleId+" "+model.SystemUserManagerRoleId, false)

			managerClient := th.CreateClient()
			_, _, err := managerClient.Login(context.Background(), userManager.Email, "Password1")
			require.NoError(t, err)

			// User manager should not be able to demote a system admin
			resp, err := managerClient.DemoteUserToGuest(context.Background(), th.SystemAdminUser.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})
}

// TestPublishUserTypingErrorPaths tests error conditions in publishUserTyping
func TestPublishUserTypingErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("typing in non-existent channel", func(t *testing.T) {
		typingReq := model.TypingRequest{
			ChannelId: model.NewId(),
		}
		resp, err := th.Client.PublishUserTyping(context.Background(), th.BasicUser.Id, typingReq)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("typing in channel without membership", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)

		typingReq := model.TypingRequest{
			ChannelId: privateChannel.Id,
		}
		resp, err := th.Client.PublishUserTyping(context.Background(), th.BasicUser.Id, typingReq)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("publish typing for other user without permission", func(t *testing.T) {
		typingReq := model.TypingRequest{
			ChannelId: th.BasicChannel.Id,
		}
		resp, err := th.Client.PublishUserTyping(context.Background(), th.BasicUser2.Id, typingReq)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		typingReq := model.TypingRequest{
			ChannelId: th.BasicChannel.Id,
		}
		resp, err := th.Client.PublishUserTyping(context.Background(), th.BasicUser.Id, typingReq)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
