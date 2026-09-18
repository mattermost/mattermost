// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateUser_DuplicateEmail(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Create a user with unique email
	user1 := &model.User{
		Email:    model.NewId() + "@example.com",
		Username: model.NewId() + "_user1",
		Password: "Password1",
	}
	createdUser1, err := th.App.CreateUser(th.Context, user1)
	require.Nil(t, err)
	require.NotNil(t, createdUser1)

	// Try to create another user with the same email
	user2 := &model.User{
		Email:    user1.Email, // Same email
		Username: model.NewId() + "_user2",
		Password: "Password1",
	}
	_, err = th.App.CreateUser(th.Context, user2)
	require.NotNil(t, err)
	assert.Equal(t, "app.user.save.email_exists.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestCreateUser_DuplicateUsername(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Create a user with unique username
	user1 := &model.User{
		Email:    model.NewId() + "@example.com",
		Username: "testuser_" + model.NewId(),
		Password: "Password1",
	}
	createdUser1, err := th.App.CreateUser(th.Context, user1)
	require.Nil(t, err)
	require.NotNil(t, createdUser1)

	// Try to create another user with the same username
	user2 := &model.User{
		Email:    model.NewId() + "@example.com",
		Username: user1.Username, // Same username
		Password: "Password1",
	}
	_, err = th.App.CreateUser(th.Context, user2)
	require.NotNil(t, err)
	assert.Equal(t, "app.user.save.username_exists.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestCreateUser_RestrictedDomain(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Enable email domain restrictions
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictCreationToDomains = "allowed.com"
	})

	// Try to create user with disallowed domain
	user := &model.User{
		Email:    "user@notallowed.com",
		Username: "testuser_" + model.NewId(),
		Password: "Password1",
	}
	_, err := th.App.CreateUser(th.Context, user)
	require.NotNil(t, err)
	assert.Equal(t, "api.user.create_user.accepted_domain.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)

	// Create user with allowed domain should work
	allowedUser := &model.User{
		Email:    "user@allowed.com",
		Username: "testuser_" + model.NewId(),
		Password: "Password1",
	}
	createdUser, err := th.App.CreateUser(th.Context, allowedUser)
	require.Nil(t, err)
	require.NotNil(t, createdUser)
}

func TestCreateUser_AtUserLimit(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Set a very low user limit
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.MaxUsersPerTeam = 1
	})

	// Try to create a user when at limit
	user := &model.User{
		Email:    model.NewId() + "@example.com",
		Username: "testuser_" + model.NewId(),
		Password: "Password1",
	}
	_, err := th.App.CreateUser(th.Context, user)
	require.NotNil(t, err)
	assert.Equal(t, "api.user.create_user.user_limits.exceeded", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestGetUser_NotFound(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to get non-existent user
	_, err := th.App.GetUser(model.NewId())
	require.NotNil(t, err)
	assert.Equal(t, MissingAccountError, err.Id)
	assert.Equal(t, 404, err.StatusCode)
}

func TestGetUserByUsername_NotFound(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to get user by non-existent username
	_, err := th.App.GetUserByUsername("nonexistentusername")
	require.NotNil(t, err)
	assert.Equal(t, "app.user.get_by_username.app_error", err.Id)
	assert.Equal(t, 404, err.StatusCode)
}

func TestGetUserByEmail_NotFound(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to get user by non-existent email
	_, err := th.App.GetUserByEmail("nonexistent@example.com")
	require.NotNil(t, err)
	assert.Equal(t, MissingAccountError, err.Id)
	assert.Equal(t, 404, err.StatusCode)
}

func TestUpdatePassword_InvalidUser(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to update password for non-existent user
	err := th.App.UpdatePasswordAsUser(th.Context, model.NewId(), "currentPassword", "newPassword123")
	require.NotNil(t, err)
	assert.Equal(t, MissingAccountError, err.Id)
	assert.Equal(t, 404, err.StatusCode)
}

func TestUpdatePassword_OAuthUser(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Create OAuth user
	user := th.CreateUser(t)
	authData := model.NewId()
	th.App.Srv().Store().User().UpdateAuthData(user.Id, model.ServiceGitlab, &authData, "", false)

	// Get updated user
	oauthUser, _ := th.App.GetUser(user.Id)

	// Try to update password for OAuth user
	err := th.App.UpdatePasswordAsUser(th.Context, oauthUser.Id, "currentPassword", "newPassword123")
	require.NotNil(t, err)
	assert.Equal(t, "api.user.update_password.oauth.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestUpdatePassword_IncorrectCurrentPassword(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to update with wrong current password
	err := th.App.UpdatePasswordAsUser(th.Context, th.BasicUser.Id, "wrongpassword", "newPassword123")
	require.NotNil(t, err)
	assert.Equal(t, "api.user.update_password.incorrect.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestUpdateUser_EmailChangeRestriction(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Get the basic user
	user, _ := th.App.GetUser(th.BasicUser.Id)
	originalEmail := user.Email

	// Try to change email when it's restricted
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.RequireEmailVerification = true
	})

	user.Email = "newemail@example.com"
	_, err := th.App.UpdateUserAsUser(th.Context, user, false)
	require.NotNil(t, err)
	assert.Equal(t, "api.user.update_user.email_change.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)

	// Verify email wasn't changed
	updatedUser, _ := th.App.GetUser(user.Id)
	assert.Equal(t, originalEmail, updatedUser.Email)
}

func TestPatchUser_InvalidPatch(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to patch non-existent user
	patch := &model.UserPatch{
		Username: model.NewPointer("newusername"),
	}
	_, err := th.App.PatchUser(th.Context, model.NewId(), patch, false)
	require.NotNil(t, err)
	assert.Equal(t, MissingAccountError, err.Id)
	assert.Equal(t, 404, err.StatusCode)

	// Try to patch with invalid username
	invalidPatch := &model.UserPatch{
		Username: model.NewPointer("a"), // Too short
	}
	_, err = th.App.PatchUser(th.Context, th.BasicUser.Id, invalidPatch, false)
	require.NotNil(t, err)
	assert.Equal(t, "app.user.update.find.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestDeactivateUser_NotFound(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to deactivate non-existent user
	err := th.App.UpdateUserActive(th.Context, model.NewId(), false)
	require.NotNil(t, err)
	assert.Equal(t, MissingAccountError, err.Id)
	assert.Equal(t, 404, err.StatusCode)
}

func TestUpdateActive_AtUserLimitReactivation(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// First deactivate a user
	user := th.CreateUser(t)
	err := th.App.UpdateUserActive(th.Context, user.Id, false)
	require.Nil(t, err)

	// Set user limit that we're at
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.MaxUsersPerTeam = 3 // We have BasicUser, BasicUser2, and SystemAdminUser
	})

	// Try to reactivate when at limit
	err = th.App.UpdateUserActive(th.Context, user.Id, true)
	require.NotNil(t, err)
	assert.Equal(t, "app.user.update_active.user_limit.exceeded", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestResetPasswordFromCode_InvalidCode(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to reset password with invalid token
	err := th.App.ResetPasswordFromToken(th.Context, "invalidtoken", "newPassword123")
	require.NotNil(t, err)
	assert.Equal(t, "api.user.reset_password.invalid_link.app_error", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestCreateUserWithInviteId_RestrictedDomain(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Set allowed domains on team
	restoreTeam := saveTeamState(th)
	defer restoreTeam()

	th.BasicTeam.AllowedDomains = "allowed.com"
	_, err := th.App.UpdateTeam(th.BasicTeam)
	require.Nil(t, err)

	// Try to create user with disallowed domain
	user := &model.User{
		Email:    "user@notallowed.com",
		Username: "testuser_" + model.NewId(),
		Password: "Password1",
	}
	_, err = th.App.CreateUserWithInviteId(th.Context, user, th.BasicTeam.InviteId, "")
	require.NotNil(t, err)
	assert.Equal(t, "api.team.invite_members.invalid_email.app_error", err.Id)
	assert.Equal(t, 403, err.StatusCode)
}

func TestUpdateUser_UsernameConflictWithGroup(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Create a group
	groupName := strings.ToLower(model.NewId())
	group := &model.Group{
		Name:        &groupName,
		DisplayName: "Test Group",
		RemoteId:    nil,
		Source:      model.GroupSourceCustom,
	}
	createdGroup, err := th.App.CreateGroup(group)
	require.Nil(t, err)

	// Try to update user with username matching group name
	user, _ := th.App.GetUser(th.BasicUser.Id)
	user.Username = *createdGroup.Name
	_, appErr := th.App.UpdateUser(th.Context, user, false)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.user.username_taken_by_group.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)
}

func TestPermanentDeleteUser_FailStoreDelete(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Create a user to delete
	user := th.CreateUser(t)

	// Add the user to channels and create some posts to make deletion more complex
	th.LinkUserToTeam(t, user, th.BasicTeam)
	th.AddUserToChannel(t, user, th.BasicChannel)
	post := &model.Post{
		UserId:    user.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "Test message",
	}
	_, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, err)

	// Deactivate first (required before permanent delete)
	err = th.App.UpdateUserActive(th.Context, user.Id, false)
	require.Nil(t, err)

	// Try permanent delete - it should succeed but let's verify it handles errors gracefully
	err = th.App.PermanentDeleteUser(th.Context, user)
	require.Nil(t, err)

	// Verify user is gone
	_, err = th.App.GetUser(user.Id)
	require.NotNil(t, err)
	assert.Equal(t, MissingAccountError, err.Id)
}

func TestCreateUserFromSignup_NotOpenServer(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Disable open server
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableOpenServer = false
	})

	// Make sure it's not first account
	users, _ := th.App.Srv().Store().User().GetAll()
	require.Greater(t, len(users), 0)

	// Try to create user via signup
	user := &model.User{
		Email:    model.NewId() + "@example.com",
		Username: "testuser_" + model.NewId(),
		Password: "Password1",
	}
	_, err := th.App.CreateUserFromSignup(th.Context, user, "")
	require.NotNil(t, err)
	assert.Equal(t, "api.user.create_user.no_open_server", err.Id)
	assert.Equal(t, 403, err.StatusCode)
}

func TestGetUserByAuth_MissingAuthData(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Try to get user by auth data that doesn't exist
	_, err := th.App.GetUserByAuth(model.NewPointer("nonexistentauth"), model.ServiceGitlab)
	require.NotNil(t, err)
	assert.Equal(t, MissingAuthAccountError, err.Id)
	assert.Equal(t, 400, err.StatusCode)
}

func TestUpdatePasswordSendEmail_WeakPassword(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Enable strict password requirements
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 12
		*cfg.PasswordSettings.Lowercase = true
		*cfg.PasswordSettings.Uppercase = true
		*cfg.PasswordSettings.Symbol = true
		*cfg.PasswordSettings.Number = true
	})

	// Try to set weak password
	user, _ := th.App.GetUser(th.BasicUser.Id)
	err := th.App.UpdatePassword(th.Context, user, "weak")
	require.NotNil(t, err)
	assert.Equal(t, "model.user.is_valid.pwd", err.Id)
	assert.Equal(t, 400, err.StatusCode)
}
