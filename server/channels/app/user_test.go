// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	oauthgitlab "github.com/mattermost/mattermost/server/v8/channels/app/oauthproviders/gitlab"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestCreateOAuthUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.GitLabSettings.Enable = true
	})

	t.Run("create user successfully", func(t *testing.T) {
		glUser := oauthgitlab.GitLabUser{Id: 42, Username: "o" + model.NewId(), Email: model.NewId() + "@simulator.amazonses.com", Name: "Joram Wilander"}
		js, jsonErr := json.Marshal(glUser)
		require.NoError(t, jsonErr)

		user, err := th.App.CreateOAuthUser(th.Context, model.UserAuthServiceGitlab, bytes.NewReader(js), th.BasicTeam.Id, nil)
		require.Nil(t, err)

		require.Equal(t, glUser.Username, user.Username, "usernames didn't match")

		th.App.PermanentDeleteUser(th.Context, user)
	})

	t.Run("user exists, update authdata successfully", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.Office365Settings.Enable = true
		})

		dbUser := th.BasicUser

		// mock oAuth Provider, return data
		mockUser := &model.User{Id: "abcdef", AuthData: model.NewPointer("e7110007-64be-43d8-9840-4a7e9c26b710"), Email: dbUser.Email}
		providerMock := &mocks.OAuthProvider{}
		providerMock.On("IsSameUser", mock.AnythingOfType("*request.Context"), mock.Anything, mock.Anything).Return(true)
		providerMock.On("GetUserFromJSON", mock.AnythingOfType("*request.Context"), mock.Anything, mock.Anything).Return(mockUser, nil)
		einterfaces.RegisterOAuthProvider(model.ServiceOffice365, providerMock)

		// Update user to be OAuth, formatting to match Office365 OAuth data
		s, er2 := th.App.Srv().Store().User().UpdateAuthData(dbUser.Id, model.ServiceOffice365, model.NewPointer("e711000764be43d898404a7e9c26b710"), "", false)
		assert.NoError(t, er2)
		assert.Equal(t, dbUser.Id, s)

		// data passed doesn't matter as return is mocked
		_, err := th.App.CreateOAuthUser(th.Context, model.ServiceOffice365, strings.NewReader("{}"), th.BasicTeam.Id, nil)
		assert.Nil(t, err)
		u, er := th.App.Srv().Store().User().GetByEmail(dbUser.Email)
		assert.NoError(t, er)
		// make sure authdata is updated
		assert.Equal(t, "e7110007-64be-43d8-9840-4a7e9c26b710", *u.AuthData)
	})

	t.Run("user creation disabled", func(t *testing.T) {
		*th.App.Config().TeamSettings.EnableUserCreation = false
		_, err := th.App.CreateOAuthUser(th.Context, model.UserAuthServiceGitlab, strings.NewReader("{}"), th.BasicTeam.Id, nil)
		require.NotNil(t, err, "should have failed - user creation disabled")
	})
}

func TestUpdateDefaultProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	startTime := model.GetMillis()
	time.Sleep(time.Millisecond)

	err := th.App.SetDefaultProfileImage(th.Context, &model.User{
		Id:       model.NewId(),
		Username: "notvaliduser",
	})
	// It doesn't fail, but it does nothing
	require.Nil(t, err)

	user := th.BasicUser

	err = th.App.UpdateDefaultProfileImage(th.Context, user)
	require.Nil(t, err)

	user = getUserFromDB(th.App, user.Id, t)
	assert.Less(t, user.LastPictureUpdate, -startTime, "LastPictureUpdate should be set to -(current time in milliseconds)")
}

func TestAdjustProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, appErr := th.App.AdjustImage(bytes.NewReader([]byte{}))
	require.NotNil(t, appErr)

	// test image isn't the correct dimensions
	// it should be adjusted
	testjpg, err := testutils.ReadTestFile("testjpg.jpg")
	require.NoError(t, err)
	adjusted, appErr := th.App.AdjustImage(bytes.NewReader(testjpg))
	require.Nil(t, appErr)
	assert.True(t, adjusted.Len() > 0)
	assert.NotEqual(t, testjpg, adjusted)

	// default image should not require adjustment
	user := th.BasicUser
	image, appErr := th.App.GetDefaultProfileImage(user)
	require.Nil(t, appErr)
	image2, appErr := th.App.AdjustImage(bytes.NewReader(image))
	require.Nil(t, appErr)
	assert.Equal(t, image, image2.Bytes())
}

func TestUpdateUserToRestrictedDomain(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, user)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictCreationToDomains = "foo.com"
	})

	_, err := th.App.UpdateUser(th.Context, user, false)
	assert.Nil(t, err)

	user.Email = "asdf@ghjk.l"
	_, err = th.App.UpdateUser(th.Context, user, false)
	assert.NotNil(t, err)

	t.Run("Restricted Domains must be ignored for guest users", func(t *testing.T) {
		guest := th.CreateGuest()
		defer th.App.PermanentDeleteUser(th.Context, guest)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictCreationToDomains = "foo.com"
		})

		guest.Email = "asdf@bar.com"
		updatedGuest, err := th.App.UpdateUser(th.Context, guest, false)
		require.Nil(t, err)
		require.Equal(t, guest.Email, updatedGuest.Email)
	})

	t.Run("Guest users should be affected by guest restricted domains", func(t *testing.T) {
		guest := th.CreateGuest()
		defer th.App.PermanentDeleteUser(th.Context, guest)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.GuestAccountsSettings.RestrictCreationToDomains = "foo.com"
		})

		guest.Email = "asdf@bar.com"
		_, err := th.App.UpdateUser(th.Context, guest, false)
		require.NotNil(t, err)

		guest.Email = "asdf@foo.com"
		updatedGuest, err := th.App.UpdateUser(th.Context, guest, false)
		require.Nil(t, err)
		require.Equal(t, guest.Email, updatedGuest.Email)
	})
}

func TestUpdateUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	group := th.CreateGroup()

	t.Run("fails if the username matches a group name", func(t *testing.T) {
		user.Username = *group.Name
		u, err := th.App.UpdateUser(th.Context, user, false)
		require.NotNil(t, err)
		require.Nil(t, u)
	})

	t.Run("fails if default profile picture is not updated when user has default profile picture and username is changed", func(t *testing.T) {
		user.Username = "updatedUsername"
		iLastPictureUpdate := user.LastPictureUpdate
		require.Equal(t, iLastPictureUpdate, int64(0))
		u, err := th.App.UpdateUser(th.Context, user, false)
		require.Nil(t, err)
		require.NotNil(t, u)
		require.Less(t, u.LastPictureUpdate, iLastPictureUpdate)
		require.Empty(t, u.Password)
	})

	t.Run("fails if profile picture is updated when user has custom profile picture and username is changed", func(t *testing.T) {
		// Give the user a LastPictureUpdate to mimic having a custom profile picture
		err := th.App.Srv().Store().User().UpdateLastPictureUpdate(user.Id)
		require.NoError(t, err)
		iUser, errGetUser := th.App.GetUser(user.Id)
		require.Nil(t, errGetUser)
		iUser.Username = "updatedUsername"
		iLastPictureUpdate := iUser.LastPictureUpdate
		require.Greater(t, iLastPictureUpdate, int64(0))

		// Attempt the update, ensure the LastPictureUpdate has not changed
		updatedUser, errUpdateUser := th.App.UpdateUser(th.Context, iUser, false)
		require.Nil(t, errUpdateUser)
		require.NotNil(t, updatedUser)
		require.Equal(t, updatedUser.LastPictureUpdate, iLastPictureUpdate)
	})
}

func TestUpdateUserMissingFields(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, user)

	tests := map[string]struct {
		input  *model.User
		expect string
	}{
		"no missing fields": {input: &model.User{Id: user.Id, Username: user.Username, Email: user.Email}, expect: ""},
		"missing id":        {input: &model.User{Username: user.Username, Email: user.Email}, expect: "app.user.missing_account.const"},
		"missing username":  {input: &model.User{Id: user.Id, Email: user.Email}, expect: "model.user.is_valid.username.app_error"},
		"missing email":     {input: &model.User{Id: user.Id, Username: user.Username}, expect: "model.user.is_valid.email.app_error"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := th.App.UpdateUser(th.Context, tc.input, false)

			if name == "no missing fields" {
				assert.Nil(t, err)
			} else {
				assert.Equal(t, tc.expect, err.Id)
			}
		})
	}
}

func TestCreateUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("fails if the username matches a group name", func(t *testing.T) {
		group := th.CreateGroup()

		id := model.NewId()
		user := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      *group.Name,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}

		user.Username = *group.Name
		u, err := th.App.CreateUser(th.Context, user)
		require.NotNil(t, err)
		require.Nil(t, u)
	})

	t.Run("should sanitize user authdata before publishing to plugin hooks", func(t *testing.T) {
		tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) UserHasBeenCreated(c *plugin.Context, user *model.User) {
				user.Nickname = "sanitized"
				if len(user.Password) > 0 {
					user.Nickname = "not-sanitized"
				}
				p.API.UpdateUser(user)
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := &model.User{
			Email:       model.NewId() + "success+test@example.com",
			Nickname:    "Darth Vader",
			Username:    "vader" + model.NewId(),
			Password:    "passwd12345",
			AuthService: "",
		}
		_, err := th.App.CreateUser(th.Context, user)
		require.Nil(t, err)

		time.Sleep(1 * time.Second)

		user, err = th.App.GetUser(user.Id)
		require.Nil(t, err)
		require.Equal(t, "sanitized", user.Nickname)
	})
}

func TestUpdateUserActive(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()

	EnableUserDeactivation := th.App.Config().TeamSettings.EnableUserDeactivation
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserDeactivation = EnableUserDeactivation })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableUserDeactivation = true
	})
	err := th.App.UpdateUserActive(th.Context, user.Id, false)
	assert.Nil(t, err)
}

func TestUpdateActiveBotsSideEffect(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(th.Context, bot.UserId)

	// Automatic deactivation disabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = false
	})

	th.App.UpdateActive(th.Context, th.BasicUser, false)

	retbot1, err := th.App.GetBot(th.Context, bot.UserId, true)
	require.Nil(t, err)
	require.Zero(t, retbot1.DeleteAt)
	user1, err := th.App.GetUser(bot.UserId)
	require.Nil(t, err)
	require.Zero(t, user1.DeleteAt)

	th.App.UpdateActive(th.Context, th.BasicUser, true)

	// Automatic deactivation enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = true
	})

	th.App.UpdateActive(th.Context, th.BasicUser, false)

	retbot2, err := th.App.GetBot(th.Context, bot.UserId, true)
	require.Nil(t, err)
	require.NotZero(t, retbot2.DeleteAt)
	user2, err := th.App.GetUser(bot.UserId)
	require.Nil(t, err)
	require.NotZero(t, user2.DeleteAt)

	th.App.UpdateActive(th.Context, th.BasicUser, true)
}

func TestUpdateOAuthUserAttrs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	id2 := model.NewId()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.GitLabSettings.Enable = true
	})
	gitlabProvider := einterfaces.GetOAuthProvider("gitlab")

	username := "user" + id
	username2 := "user" + id2

	email := "user" + id + "@nowhere.com"
	email2 := "user" + id2 + "@nowhere.com"

	var user, user2 *model.User
	var gitlabUserObj oauthgitlab.GitLabUser
	user, gitlabUserObj = createGitlabUser(t, th.App, th.Context, 1, username, email)
	user2, _ = createGitlabUser(t, th.App, th.Context, 2, username2, email2)

	t.Run("UpdateUsername", func(t *testing.T) {
		t.Run("NoExistingUserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = "updateduser" + model.NewId()
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(th.Context, data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.App, user.Id, t)

			require.Equal(t, gitlabUserObj.Username, user.Username, "user's username is not updated")
		})

		t.Run("ExistinguserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = user2.Username

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(th.Context, data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.App, user.Id, t)

			require.NotEqual(t, gitlabUserObj.Username, user.Username, "user's username is updated though there already exists another user with the same username")
		})
	})

	t.Run("UpdateEmail", func(t *testing.T) {
		t.Run("NoExistingUserWithSameEmail", func(t *testing.T) {
			gitlabUserObj.Email = "newuser" + model.NewId() + "@nowhere.com"
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(th.Context, data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.App, user.Id, t)

			require.Equal(t, gitlabUserObj.Email, user.Email, "user's email is not updated")

			require.True(t, user.EmailVerified, "user's email should have been verified")
		})

		t.Run("ExistingUserWithSameEmail", func(t *testing.T) {
			gitlabUserObj.Email = user2.Email

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(th.Context, data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.App, user.Id, t)

			require.NotEqual(t, gitlabUserObj.Email, user.Email, "user's email is updated though there already exists another user with the same email")
		})
	})

	t.Run("UpdateFirstName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated User"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(th.App, user.Id, t)
		th.App.UpdateOAuthUserAttrs(th.Context, data, user, gitlabProvider, "gitlab", nil)
		user = getUserFromDB(th.App, user.Id, t)

		require.Equal(t, "Updated", user.FirstName, "user's first name is not updated")
	})

	t.Run("UpdateLastName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated Lastname"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(th.App, user.Id, t)
		th.App.UpdateOAuthUserAttrs(th.Context, data, user, gitlabProvider, "gitlab", nil)
		user = getUserFromDB(th.App, user.Id, t)

		require.Equal(t, "Lastname", user.LastName, "user's last name is not updated")
	})
}

func TestCreateUserConflict(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := &model.User{
		Email:    "test@localhost",
		Username: model.NewUsername(),
	}
	user, err := th.App.Srv().Store().User().Save(th.Context, user)
	require.NoError(t, err)
	username := user.Username

	var invErr *store.ErrInvalidInput
	// Same id
	_, err = th.App.Srv().Store().User().Save(th.Context, user)
	require.Error(t, err)
	require.True(t, errors.As(err, &invErr))
	assert.Equal(t, "id", invErr.Field)

	// Same email
	user = &model.User{
		Email:    "test@localhost",
		Username: model.NewUsername(),
	}
	_, err = th.App.Srv().Store().User().Save(th.Context, user)
	require.Error(t, err)
	require.True(t, errors.As(err, &invErr))
	assert.Equal(t, "email", invErr.Field)

	// Same username
	user = &model.User{
		Email:    "test2@localhost",
		Username: username,
	}
	_, err = th.App.Srv().Store().User().Save(th.Context, user)
	require.Error(t, err)
	require.True(t, errors.As(err, &invErr))
	assert.Equal(t, "username", invErr.Field)
}

func TestUpdateUserEmail(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()

	t.Run("RequireVerification", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = true
		})

		currentEmail := user.Email
		newEmail := th.MakeEmail()

		user.Email = newEmail
		user2, appErr := th.App.UpdateUser(th.Context, user, false)
		assert.Nil(t, appErr)
		assert.Equal(t, currentEmail, user2.Email)
		assert.True(t, user2.EmailVerified)

		token, err := th.App.Srv().EmailService.CreateVerifyEmailToken(user2.Id, newEmail)
		assert.NoError(t, err)

		appErr = th.App.VerifyEmailFromToken(th.Context, token.Token)
		assert.Nil(t, appErr)

		user2, appErr = th.App.GetUser(user2.Id)
		assert.Nil(t, appErr)
		assert.Equal(t, newEmail, user2.Email)
		assert.True(t, user2.EmailVerified)

		// Create bot user
		botuser := model.User{
			Email:    "botuser@localhost",
			Username: model.NewUsername(),
			IsBot:    true,
		}
		_, nErr := th.App.Srv().Store().User().Save(th.Context, &botuser)
		assert.NoError(t, nErr)

		newBotEmail := th.MakeEmail()
		botuser.Email = newBotEmail
		botuser2, appErr := th.App.UpdateUser(th.Context, &botuser, false)
		assert.Nil(t, appErr)
		assert.Equal(t, botuser2.Email, newBotEmail)
	})

	t.Run("RequireVerificationAlreadyUsedEmail", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = true
		})

		user2 := th.CreateUser()
		newEmail := user2.Email

		user.Email = newEmail
		user3, err := th.App.UpdateUser(th.Context, user, false)
		require.NotNil(t, err)
		assert.Equal(t, err.Id, "app.user.save.email_exists.app_error")
		assert.Nil(t, user3)
	})

	t.Run("NoVerification", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = false
		})

		newEmail := th.MakeEmail()

		user.Email = newEmail
		user2, err := th.App.UpdateUser(th.Context, user, false)
		assert.Nil(t, err)
		assert.Equal(t, newEmail, user2.Email)

		// Create bot user
		botuser := model.User{
			Email:    "botuser@localhost",
			Username: model.NewUsername(),
			IsBot:    true,
		}
		_, nErr := th.App.Srv().Store().User().Save(th.Context, &botuser)
		assert.NoError(t, nErr)

		newBotEmail := th.MakeEmail()
		botuser.Email = newBotEmail
		botuser2, err := th.App.UpdateUser(th.Context, &botuser, false)
		assert.Nil(t, err)
		assert.Equal(t, botuser2.Email, newBotEmail)
	})

	t.Run("NoVerificationAlreadyUsedEmail", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = false
		})

		user2 := th.CreateUser()
		newEmail := user2.Email

		user.Email = newEmail
		user3, err := th.App.UpdateUser(th.Context, user, false)
		require.NotNil(t, err)
		assert.Equal(t, err.Id, "app.user.save.email_exists.app_error")
		assert.Nil(t, user3)
	})

	t.Run("Only the last token works if verification is required", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = true
		})

		// we update the email a first time and update. The first
		// token is sent with the email
		user.Email = th.MakeEmail()
		_, appErr := th.App.UpdateUser(th.Context, user, true)
		require.Nil(t, appErr)

		tokens := []*model.Token{}
		require.Eventually(t, func() bool {
			var err error
			tokens, err = th.App.Srv().Store().Token().GetAllTokensByType(TokenTypeVerifyEmail)
			return err == nil && len(tokens) == 1
		}, 100*time.Millisecond, 10*time.Millisecond)

		firstToken := tokens[0]

		// without using the first token, we update the email a second
		// time and another token gets sent. The first one should not
		// work anymore and the second should work properly
		user.Email = th.MakeEmail()
		_, appErr = th.App.UpdateUser(th.Context, user, true)
		require.Nil(t, appErr)

		require.Eventually(t, func() bool {
			var err error
			tokens, err = th.App.Srv().Store().Token().GetAllTokensByType(TokenTypeVerifyEmail)
			// We verify the same conditions as the earlier function,
			// but we also need to ensure that this is not the same token
			// as before, which is possible if the token update goroutine
			// hasn't yet run.
			return err == nil && len(tokens) == 1 && tokens[0].Token != firstToken.Token
		}, 100*time.Millisecond, 10*time.Millisecond)
		secondToken := tokens[0]

		_, err := th.App.Srv().Store().Token().GetByToken(firstToken.Token)
		require.Error(t, err)

		require.NotNil(t, th.App.VerifyEmailFromToken(th.Context, firstToken.Token))
		require.Nil(t, th.App.VerifyEmailFromToken(th.Context, secondToken.Token))
		require.NotNil(t, th.App.VerifyEmailFromToken(th.Context, firstToken.Token))
	})
}

func getUserFromDB(a *App, id string, t *testing.T) *model.User {
	user, err := a.GetUser(id)
	require.Nil(t, err, "user is not found", err)
	return user
}

func getGitlabUserPayload(gitlabUser oauthgitlab.GitLabUser, t *testing.T) []byte {
	var payload []byte
	var err error
	payload, err = json.Marshal(gitlabUser)
	require.NoError(t, err, "Serialization of gitlab user to json failed", err)

	return payload
}

func createGitlabUser(t *testing.T, a *App, c request.CTX, id int64, username string, email string) (*model.User, oauthgitlab.GitLabUser) {
	gitlabUserObj := oauthgitlab.GitLabUser{Id: id, Username: username, Login: "user1", Email: email, Name: "Test User"}
	gitlabUser := getGitlabUserPayload(gitlabUserObj, t)

	var user *model.User
	var err *model.AppError

	user, err = a.CreateOAuthUser(c, "gitlab", bytes.NewReader(gitlabUser), "", nil)
	require.Nil(t, err, "unable to create the user", err)

	return user, gitlabUserObj
}

func TestGetUsersByStatus(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel, err := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
		CreatorId:   model.NewId(),
	}, false)
	require.Nil(t, err, "failed to create channel: %v", err)

	createUserWithStatus := func(username string, status string) *model.User {
		id := model.NewId()

		user, err := th.App.CreateUser(th.Context, &model.User{
			Email:    "success+" + id + "@simulator.amazonses.com",
			Username: "un_" + username + "_" + id,
			Nickname: "nn_" + id,
			Password: "Password1",
		})
		require.Nil(t, err, "failed to create user: %v", err)

		th.LinkUserToTeam(user, team)
		th.AddUserToChannel(user, channel)

		th.App.Srv().Platform().SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: status,
			Manual: true,
		})

		return user
	}

	// Creating these out of order in case that affects results
	awayUser1 := createUserWithStatus("away1", model.StatusAway)
	awayUser2 := createUserWithStatus("away2", model.StatusAway)
	dndUser1 := createUserWithStatus("dnd1", model.StatusDnd)
	dndUser2 := createUserWithStatus("dnd2", model.StatusDnd)
	offlineUser1 := createUserWithStatus("offline1", model.StatusOffline)
	offlineUser2 := createUserWithStatus("offline2", model.StatusOffline)
	onlineUser1 := createUserWithStatus("online1", model.StatusOnline)
	onlineUser2 := createUserWithStatus("online2", model.StatusOnline)

	t.Run("sorting by status then alphabetical", func(t *testing.T) {
		usersByStatus, err := th.App.GetUsersInChannelPageByStatus(&model.UserGetOptions{
			InChannelId: channel.Id,
			Page:        0,
			PerPage:     8,
		}, true)
		require.Nil(t, err)

		expectedUsersByStatus := []*model.User{
			onlineUser1,
			onlineUser2,
			awayUser1,
			awayUser2,
			dndUser1,
			dndUser2,
			offlineUser1,
			offlineUser2,
		}

		require.Equalf(t, len(expectedUsersByStatus), len(usersByStatus), "received only %v users, expected %v", len(usersByStatus), len(expectedUsersByStatus))

		for i := range usersByStatus {
			require.Equalf(t, expectedUsersByStatus[i].Id, usersByStatus[i].Id, "received user %v at index %v, expected %v", usersByStatus[i].Username, i, expectedUsersByStatus[i].Username)
		}
	})

	t.Run("paging", func(t *testing.T) {
		usersByStatus, err := th.App.GetUsersInChannelPageByStatus(&model.UserGetOptions{
			InChannelId: channel.Id,
			Page:        0,
			PerPage:     3,
		}, true)
		require.Nil(t, err)

		require.Equal(t, 3, len(usersByStatus), "received too many users")

		require.False(
			t,
			usersByStatus[0].Id != onlineUser1.Id && usersByStatus[1].Id != onlineUser2.Id,
			"expected to receive online users first",
		)

		require.Equal(t, awayUser1.Id, usersByStatus[2].Id, "expected to receive away users second")

		usersByStatus, err = th.App.GetUsersInChannelPageByStatus(&model.UserGetOptions{
			InChannelId: channel.Id,
			Page:        1,
			PerPage:     3,
		}, true)
		require.Nil(t, err)

		require.NotEmpty(t, usersByStatus, "at least some users are expected")
		require.Equal(t, awayUser2.Id, usersByStatus[0].Id, "expected to receive away users second")

		require.False(
			t,
			usersByStatus[1].Id != dndUser1.Id && usersByStatus[2].Id != dndUser2.Id,
			"expected to receive dnd users third",
		)

		usersByStatus, err = th.App.GetUsersInChannelPageByStatus(&model.UserGetOptions{
			InChannelId: channel.Id,
			Page:        1,
			PerPage:     4,
		}, true)
		require.Nil(t, err)

		require.Equal(t, 4, len(usersByStatus), "received too many users")

		require.False(
			t,
			usersByStatus[0].Id != dndUser1.Id && usersByStatus[1].Id != dndUser2.Id,
			"expected to receive dnd users third",
		)

		require.False(
			t,
			usersByStatus[2].Id != offlineUser1.Id && usersByStatus[3].Id != offlineUser2.Id,
			"expected to receive offline users last",
		)
	})
}

func TestCreateUserWithInviteId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}

	t.Run("should create a user", func(t *testing.T) {
		u, err := th.App.CreateUserWithInviteId(th.Context, &user, th.BasicTeam.InviteId, "")
		require.Nil(t, err)
		require.Equal(t, u.Id, user.Id)
	})

	t.Run("invalid invite id", func(t *testing.T) {
		_, err := th.App.CreateUserWithInviteId(th.Context, &user, "", "")
		require.NotNil(t, err)
		require.Contains(t, err.Id, "app.team.get_by_invite_id")
	})

	t.Run("invalid domain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "mattermost.com"
		_, nErr := th.App.Srv().Store().Team().Update(th.BasicTeam)
		require.NoError(t, nErr)
		_, err := th.App.CreateUserWithInviteId(th.Context, &user, th.BasicTeam.InviteId, "")
		require.NotNil(t, err)
		require.Equal(t, "api.team.invite_members.invalid_email.app_error", err.Id)
	})
}

func TestCreateUserWithToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}

	t.Run("invalid token", func(t *testing.T) {
		_, err := th.App.CreateUserWithToken(th.Context, &user, &model.Token{Token: "123"})
		require.NotNil(t, err, "Should fail on unexisting token")
	})

	t.Run("invalid token type", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeVerifyEmail,
			model.MapToJSON(map[string]string{"teamID": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)
		_, err := th.App.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err, "Should fail on bad token type")
	})

	t.Run("token extra email does not match provided user data email", func(t *testing.T) {
		invitationEmail := "attacker@test.com"
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail}),
		)

		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, err := th.App.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err)
	})

	t.Run("expired token", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		token.CreateAt = model.GetMillis() - InvitationExpiryTime - 1
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)
		_, err := th.App.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err, "Should fail on expired token")
	})

	t.Run("invalid team id", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": model.NewId(), "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)
		_, err := th.App.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err, "Should fail on bad team id")
	})

	t.Run("valid regular user request", func(t *testing.T) {
		invitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		u := model.User{Email: invitationEmail, Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		newUser, err := th.App.CreateUserWithToken(th.Context, &u, token)
		require.Nil(t, err, "Should add user to the team. err=%v", err)
		assert.False(t, newUser.IsGuest())
		require.Equal(t, invitationEmail, newUser.Email, "The user email must be the invitation one")

		_, nErr := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, nErr, "The token must be deleted after be used")

		members, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newUser.Id)
		require.Nil(t, err)
		assert.Len(t, members, 2)
	})

	t.Run("valid guest request", func(t *testing.T) {
		invitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail, "channels": th.BasicChannel.Id, "senderId": th.BasicUser.Id}),
		)

		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		guest := model.User{Email: invitationEmail, Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		newGuest, err := th.App.CreateUserWithToken(th.Context, &guest, token)
		require.Nil(t, err, "Should add user to the team. err=%v", err)

		assert.True(t, newGuest.IsGuest())
		require.Equal(t, invitationEmail, newGuest.Email, "The user email must be the invitation one")
		_, nErr := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, nErr, "The token must be deleted after be used")

		members, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newGuest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})

	t.Run("create guest having email domain restrictions", func(t *testing.T) {
		enableGuestDomainRestrictions := *th.App.Config().GuestAccountsSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.GuestAccountsSettings.RestrictCreationToDomains = &enableGuestDomainRestrictions
			})
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "restricted.com" })
		forbiddenInvitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		grantedInvitationEmail := strings.ToLower(model.NewId()) + "other-email@restricted.com"
		forbiddenDomainToken := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": forbiddenInvitationEmail, "channels": th.BasicChannel.Id, "senderId": th.BasicUser.Id}),
		)
		grantedDomainToken := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": grantedInvitationEmail, "channels": th.BasicChannel.Id, "senderId": th.BasicUser.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(forbiddenDomainToken))
		require.NoError(t, th.App.Srv().Store().Token().Save(grantedDomainToken))
		guest := model.User{
			Email:       forbiddenInvitationEmail,
			Nickname:    "Darth Vader",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		newGuest, err := th.App.CreateUserWithToken(th.Context, &guest, forbiddenDomainToken)
		require.NotNil(t, err)
		require.Nil(t, newGuest)
		assert.Equal(t, "api.user.create_user.accepted_domain.app_error", err.Id)

		guest.Email = grantedInvitationEmail
		newGuest, err = th.App.CreateUserWithToken(th.Context, &guest, grantedDomainToken)
		require.Nil(t, err)
		assert.True(t, newGuest.IsGuest())
		require.Equal(t, grantedInvitationEmail, newGuest.Email)
		_, nErr := th.App.Srv().Store().Token().GetByToken(grantedDomainToken.Token)
		require.Error(t, nErr)

		members, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newGuest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})

	t.Run("create guest having team and system email domain restrictions", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "restricted-team.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")
		enableGuestDomainRestrictions := *th.App.Config().TeamSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.TeamSettings.RestrictCreationToDomains = &enableGuestDomainRestrictions
			})
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "restricted.com" })
		invitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail, "channels": th.BasicChannel.Id, "senderId": th.BasicUser.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		guest := model.User{
			Email:       invitationEmail,
			Nickname:    "Darth Vader",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		newGuest, err := th.App.CreateUserWithToken(th.Context, &guest, token)
		require.Nil(t, err)
		assert.True(t, newGuest.IsGuest())
		assert.Equal(t, invitationEmail, newGuest.Email, "The user email must be the invitation one")
		_, nErr := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, nErr)

		members, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newGuest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})
}

func TestPermanentDeleteUser(t *testing.T) {
	th := Setup(t).InitBasic().DeleteBots()
	defer th.TearDown()

	b := []byte("testimage")

	finfo, err := th.App.DoUploadFile(th.Context, time.Now(), th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "testfile.txt", b, true)

	require.Nil(t, err, "Unable to upload file. err=%v", err)

	// upload profile image
	user := th.BasicUser

	err = th.App.SetDefaultProfileImage(th.Context, user)
	require.Nil(t, err)

	bot, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "botname",
		Description: "a bot",
		OwnerId:     model.NewId(),
	})
	assert.Nil(t, err)

	bots1 := []*model.Bot{}
	bots2 := []*model.Bot{}

	sqlStore := mainHelper.GetSQLStore()
	err1 := sqlStore.GetMasterX().Select(&bots1, "SELECT * FROM Bots")
	assert.NoError(t, err1)
	assert.Equal(t, 1, len(bots1))

	// test that bot is deleted from bots table
	retUser1, err := th.App.GetUser(bot.UserId)
	assert.Nil(t, err)

	err = th.App.PermanentDeleteUser(th.Context, retUser1)
	assert.Nil(t, err)

	err1 = sqlStore.GetMasterX().Select(&bots2, "SELECT * FROM Bots")
	assert.NoError(t, err1)
	assert.Equal(t, 0, len(bots2))

	scheduledPost1 := &model.ScheduledPost{
		Draft: model.Draft{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Scheduled post 1",
		},
		ScheduledAt: model.GetMillis() + 1000000,
	}

	createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1, "")
	require.Nil(t, appErr)

	scheduledPost2 := &model.ScheduledPost{
		Draft: model.Draft{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Scheduled post 2",
		},
		ScheduledAt: model.GetMillis() + 1000000,
	}

	createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2, "")
	require.Nil(t, appErr)

	err = th.App.PermanentDeleteUser(th.Context, th.BasicUser)
	require.Nil(t, err, "Unable to delete user. err=%v", err)

	res, err := th.App.FileExists(finfo.Path)

	require.Nil(t, err, "Unable to check whether file exists. err=%v", err)

	require.False(t, res, "File was not deleted on FS. err=%v", err)

	finfo, err = th.App.GetFileInfo(th.Context, finfo.Id)

	require.Nil(t, finfo, "Unable to find finfo. err=%v", err)

	require.NotNil(t, err, "GetFileInfo after DeleteUser is nil. err=%v", err)

	// test deletion of profile picture
	exists, err := th.App.FileExists(filepath.Join("users", user.Id))
	require.Nil(t, err, "Unable to stat finfo. err=%v", err)
	require.False(t, exists, "Profile image wasn't deleted. err=%v", err)

	// verify scheduled posts have been deleted
	fetchedScheduledPost, scheduledPostErr := th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost1.Id)
	require.ErrorIs(t, scheduledPostErr, sql.ErrNoRows)
	require.Nil(t, fetchedScheduledPost)

	fetchedScheduledPost, scheduledPostErr = th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost2.Id)
	require.ErrorIs(t, scheduledPostErr, sql.ErrNoRows)
	require.Nil(t, fetchedScheduledPost)
}

func TestPasswordRecovery(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("password token with same email as during creation", func(t *testing.T) {
		token, err := th.App.CreatePasswordRecoveryToken(th.Context, th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		tokenData := struct {
			UserID string
			Email  string
		}{}

		err2 := json.Unmarshal([]byte(token.Extra), &tokenData)
		assert.NoError(t, err2)
		assert.Equal(t, th.BasicUser.Id, tokenData.UserID)
		assert.Equal(t, th.BasicUser.Email, tokenData.Email)

		err = th.App.ResetPasswordFromToken(th.Context, token.Token, "abcdefgh")
		assert.Nil(t, err)
	})

	t.Run("password token with modified email as during creation", func(t *testing.T) {
		token, err := th.App.CreatePasswordRecoveryToken(th.Context, th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		th.App.UpdateConfig(func(c *model.Config) {
			*c.EmailSettings.RequireEmailVerification = false
		})

		th.BasicUser.Email = th.MakeEmail()
		_, err = th.App.UpdateUser(th.Context, th.BasicUser, false)
		assert.Nil(t, err)

		err = th.App.ResetPasswordFromToken(th.Context, token.Token, "abcdefgh")
		assert.NotNil(t, err)
	})

	t.Run("non-expired token", func(t *testing.T) {
		token, err := th.App.CreatePasswordRecoveryToken(th.Context, th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		err = th.App.resetPasswordFromToken(th.Context, token.Token, "abcdefgh", model.GetMillis())
		assert.Nil(t, err)
	})

	t.Run("expired token", func(t *testing.T) {
		token, err := th.App.CreatePasswordRecoveryToken(th.Context, th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		err = th.App.resetPasswordFromToken(th.Context, token.Token, "abcdefgh", model.GetMillisForTime(time.Now().Add(25*time.Hour)))
		assert.NotNil(t, err)
	})
}

func TestInvalidatePasswordRecoveryTokens(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("remove manually added tokens", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			token := model.NewToken(
				TokenTypePasswordRecovery,
				model.MapToJSON(map[string]string{"UserId": th.BasicUser.Id, "email": th.BasicUser.Email}),
			)
			require.NoError(t, th.App.Srv().Store().Token().Save(token))
		}
		tokens, err := th.App.Srv().Store().Token().GetAllTokensByType(TokenTypePasswordRecovery)
		assert.NoError(t, err)
		assert.Equal(t, 5, len(tokens))

		appErr := th.App.InvalidatePasswordRecoveryTokensForUser(th.BasicUser.Id)
		assert.Nil(t, appErr)

		tokens, err = th.App.Srv().Store().Token().GetAllTokensByType(TokenTypePasswordRecovery)
		assert.NoError(t, err)
		assert.Equal(t, 0, len(tokens))
	})

	t.Run("add multiple tokens, should only be one valid", func(t *testing.T) {
		_, appErr := th.App.CreatePasswordRecoveryToken(th.Context, th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, appErr)

		token, appErr := th.App.CreatePasswordRecoveryToken(th.Context, th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, appErr)

		tokens, err := th.App.Srv().Store().Token().GetAllTokensByType(TokenTypePasswordRecovery)
		assert.NoError(t, err)
		assert.Equal(t, 1, len(tokens))
		assert.Equal(t, token.Token, tokens[0].Token)
	})
}

func TestPasswordChangeSessionTermination(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("user-initiated password change with termination enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(c *model.Config) {
			*c.ServiceSettings.TerminateSessionsOnPasswordChange = true
		})

		session, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		session2, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser2.Id
		th.Context.Session().Id = session.Id

		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password2")
		require.Nil(t, err)

		session, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		require.False(t, session.IsExpired())

		session2, err = th.App.GetSession(session2.Token)
		require.NotNil(t, err)
		require.Nil(t, session2)

		// Cleanup
		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password1")
		require.Nil(t, err)
		th.Context.Session().UserId = ""
		th.Context.Session().Id = ""
	})

	t.Run("user-initiated password change with termination disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(c *model.Config) {
			*c.ServiceSettings.TerminateSessionsOnPasswordChange = false
		})

		session, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		session2, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser2.Id
		th.Context.Session().Id = session.Id

		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password2")
		require.Nil(t, err)

		session, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		require.False(t, session.IsExpired())

		session2, err = th.App.GetSession(session2.Token)
		require.Nil(t, err)
		require.False(t, session2.IsExpired())

		// Cleanup
		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password1")
		require.Nil(t, err)
		th.Context.Session().UserId = ""
		th.Context.Session().Id = ""
	})

	t.Run("admin-initiated password change with termination enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(c *model.Config) {
			*c.ServiceSettings.TerminateSessionsOnPasswordChange = true
		})

		session, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		session2, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password2")
		require.Nil(t, err)

		session, err = th.App.GetSession(session.Token)
		require.NotNil(t, err)
		require.Nil(t, session)

		session2, err = th.App.GetSession(session2.Token)
		require.NotNil(t, err)
		require.Nil(t, session2)

		// Cleanup
		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password1")
		require.Nil(t, err)
	})

	t.Run("admin-initiated password change with termination disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(c *model.Config) {
			*c.ServiceSettings.TerminateSessionsOnPasswordChange = false
		})

		session, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		session2, err := th.App.CreateSession(th.Context, &model.Session{
			UserId: th.BasicUser2.Id,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, err)

		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password2")
		require.Nil(t, err)

		session, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		require.False(t, session.IsExpired())

		session2, err = th.App.GetSession(session2.Token)
		require.Nil(t, err)
		require.False(t, session2.IsExpired())

		// Cleanup
		err = th.App.UpdatePassword(th.Context, th.BasicUser2, "Password1")
		require.Nil(t, err)
	})
}

func TestGetViewUsersRestrictions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team1 := th.CreateTeam()
	team2 := th.CreateTeam()
	th.CreateTeam() // Another team

	user1 := th.CreateUser()

	th.LinkUserToTeam(user1, team1)
	th.LinkUserToTeam(user1, team2)

	th.App.UpdateTeamMemberRoles(th.Context, team1.Id, user1.Id, "team_user team_admin")

	team1channel1 := th.CreateChannel(th.Context, team1)
	team1channel2 := th.CreateChannel(th.Context, team1)
	th.CreateChannel(th.Context, team1) // Another channel
	team1offtopic, err := th.App.GetChannelByName(th.Context, "off-topic", team1.Id, false)
	require.Nil(t, err)
	team1townsquare, err := th.App.GetChannelByName(th.Context, "town-square", team1.Id, false)
	require.Nil(t, err)

	team2channel1 := th.CreateChannel(th.Context, team2)
	th.CreateChannel(th.Context, team2) // Another channel
	team2offtopic, err := th.App.GetChannelByName(th.Context, "off-topic", team2.Id, false)
	require.Nil(t, err)
	team2townsquare, err := th.App.GetChannelByName(th.Context, "town-square", team2.Id, false)
	require.Nil(t, err)

	th.App.AddUserToChannel(th.Context, user1, team1channel1, false)
	th.App.AddUserToChannel(th.Context, user1, team1channel2, false)
	th.App.AddUserToChannel(th.Context, user1, team2channel1, false)

	addPermission := func(role *model.Role, permission string) *model.AppError {
		newPermissions := append(role.Permissions, permission)
		_, err := th.App.PatchRole(role, &model.RolePatch{Permissions: &newPermissions})
		return err
	}

	removePermission := func(role *model.Role, permission string) *model.AppError {
		newPermissions := []string{}
		for _, oldPermission := range role.Permissions {
			if permission != oldPermission {
				newPermissions = append(newPermissions, oldPermission)
			}
		}
		_, err := th.App.PatchRole(role, &model.RolePatch{Permissions: &newPermissions})
		return err
	}

	t.Run("VIEW_MEMBERS permission granted at system level", func(t *testing.T) {
		restrictions, err := th.App.GetViewUsersRestrictions(th.Context, user1.Id)
		require.Nil(t, err)

		assert.Nil(t, restrictions)
	})

	t.Run("VIEW_MEMBERS permission granted at team level", func(t *testing.T) {
		systemUserRole, err := th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
		require.Nil(t, err)
		teamUserRole, err := th.App.GetRoleByName(context.Background(), model.TeamUserRoleId)
		require.Nil(t, err)

		require.Nil(t, removePermission(systemUserRole, model.PermissionViewMembers.Id))
		defer addPermission(systemUserRole, model.PermissionViewMembers.Id)
		require.Nil(t, addPermission(teamUserRole, model.PermissionViewMembers.Id))
		defer removePermission(teamUserRole, model.PermissionViewMembers.Id)

		restrictions, err := th.App.GetViewUsersRestrictions(th.Context, user1.Id)
		require.Nil(t, err)

		assert.NotNil(t, restrictions)
		assert.NotNil(t, restrictions.Teams)
		assert.NotNil(t, restrictions.Channels)
		assert.ElementsMatch(t, []string{team1townsquare.Id, team1offtopic.Id, team1channel1.Id, team1channel2.Id, team2townsquare.Id, team2offtopic.Id, team2channel1.Id}, restrictions.Channels)
		assert.ElementsMatch(t, []string{team1.Id, team2.Id}, restrictions.Teams)
	})

	t.Run("VIEW_MEMBERS permission not granted at any level", func(t *testing.T) {
		systemUserRole, err := th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
		require.Nil(t, err)
		require.Nil(t, removePermission(systemUserRole, model.PermissionViewMembers.Id))
		defer addPermission(systemUserRole, model.PermissionViewMembers.Id)

		restrictions, err := th.App.GetViewUsersRestrictions(th.Context, user1.Id)
		require.Nil(t, err)

		assert.NotNil(t, restrictions)
		assert.Empty(t, restrictions.Teams)
		assert.NotNil(t, restrictions.Channels)
		assert.ElementsMatch(t, []string{team1townsquare.Id, team1offtopic.Id, team1channel1.Id, team1channel2.Id, team2townsquare.Id, team2offtopic.Id, team2channel1.Id}, restrictions.Channels)
	})

	t.Run("VIEW_MEMBERS permission for some teams but not for others", func(t *testing.T) {
		systemUserRole, err := th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
		require.Nil(t, err)
		teamAdminRole, err := th.App.GetRoleByName(context.Background(), model.TeamAdminRoleId)
		require.Nil(t, err)

		require.Nil(t, removePermission(systemUserRole, model.PermissionViewMembers.Id))
		defer addPermission(systemUserRole, model.PermissionViewMembers.Id)
		require.Nil(t, addPermission(teamAdminRole, model.PermissionViewMembers.Id))
		defer removePermission(teamAdminRole, model.PermissionViewMembers.Id)

		restrictions, err := th.App.GetViewUsersRestrictions(th.Context, user1.Id)
		require.Nil(t, err)

		assert.NotNil(t, restrictions)
		assert.NotNil(t, restrictions.Teams)
		assert.NotNil(t, restrictions.Channels)
		assert.ElementsMatch(t, restrictions.Teams, []string{team1.Id})
		assert.ElementsMatch(t, []string{team1townsquare.Id, team1offtopic.Id, team1channel1.Id, team1channel2.Id, team2townsquare.Id, team2offtopic.Id, team2channel1.Id}, restrictions.Channels)
	})
}

func TestPromoteGuestToUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Must fail with regular user", func(t *testing.T) {
		require.Equal(t, "system_user", th.BasicUser.Roles)
		err := th.App.PromoteGuestToUser(th.Context, th.BasicUser, th.BasicUser.Id)
		require.Nil(t, err)

		user, err := th.App.GetUser(th.BasicUser.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", user.Roles)
	})

	t.Run("Must work with guest user without teams or channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)

		err := th.App.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.App.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
	})

	t.Run("Must work with guest user with teams but no channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		err = th.App.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.App.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
		teamMember, err = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
	})

	t.Run("Must work with guest user with teams and channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		channelMember := th.AddUserToChannel(guest, th.BasicChannel)
		require.True(t, channelMember.SchemeGuest)
		require.False(t, channelMember.SchemeUser)

		err = th.App.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.App.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
		teamMember, err = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
		_, err = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
	})

	t.Run("Must add the default channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		channelMember := th.AddUserToChannel(guest, th.BasicChannel)
		require.True(t, channelMember.SchemeGuest)
		require.False(t, channelMember.SchemeUser)

		channelMembers, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.Len(t, channelMembers, 1)

		err = th.App.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.App.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
		teamMember, err = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
		_, err = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)

		channelMembers, err = th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		assert.Len(t, channelMembers, 3)
	})

	t.Run("Must invalidate channel stats cache when promoting a guest", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		guestCount, _ := th.App.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)

		channelMember := th.AddUserToChannel(guest, th.BasicChannel)
		require.True(t, channelMember.SchemeGuest)
		require.False(t, channelMember.SchemeUser)

		guestCount, _ = th.App.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(1), guestCount)

		err = th.App.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)

		guestCount, _ = th.App.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)
	})
}

func TestDemoteUserToGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Must invalidate channel stats cache when demoting a user", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		guestCount, _ := th.App.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)

		channelMember := th.AddUserToChannel(user, th.BasicChannel)
		require.True(t, channelMember.SchemeUser)
		require.False(t, channelMember.SchemeGuest)

		guestCount, _ = th.App.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)

		err = th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)

		guestCount, _ = th.App.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(1), guestCount)
	})

	t.Run("Must fail with guest user", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		err := th.App.DemoteUserToGuest(th.Context, guest)
		require.Nil(t, err)

		user, err := th.App.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
	})

	t.Run("Must work with user without teams or channels", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)

		err := th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.App.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
	})

	t.Run("Must work with user with teams but no channels", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		err = th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.App.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
		teamMember, err = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
	})

	t.Run("Must work with user with teams and channels", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		channelMember := th.AddUserToChannel(user, th.BasicChannel)
		require.True(t, channelMember.SchemeUser)
		require.False(t, channelMember.SchemeGuest)

		err = th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.App.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
		teamMember, err = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
		_, err = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
	})

	t.Run("Must respect the current channels not removing defaults", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		channelMember := th.AddUserToChannel(user, th.BasicChannel)
		require.True(t, channelMember.SchemeUser)
		require.False(t, channelMember.SchemeGuest)

		channelMembers, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.Len(t, channelMembers, 3)

		err = th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.App.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
		teamMember, err = th.App.GetTeamMember(th.Context, th.BasicTeam.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
		_, err = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)

		channelMembers, err = th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		assert.Len(t, channelMembers, 3)
	})

	t.Run("Must be removed as team and channel admin", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)

		team := th.CreateTeam()

		th.LinkUserToTeam(user, team)
		th.App.UpdateTeamMemberRoles(th.Context, team.Id, user.Id, "team_user team_admin")

		teamMember, err := th.App.GetTeamMember(th.Context, team.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.True(t, teamMember.SchemeAdmin)
		require.False(t, teamMember.SchemeGuest)

		channel := th.CreateChannel(th.Context, team)

		th.AddUserToChannel(user, channel)
		th.App.UpdateChannelMemberSchemeRoles(th.Context, channel.Id, user.Id, false, true, true)

		channelMember, err := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
		assert.Nil(t, err)
		assert.True(t, channelMember.SchemeUser)
		assert.True(t, channelMember.SchemeAdmin)
		assert.False(t, channelMember.SchemeGuest)

		err = th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)

		user, err = th.App.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)

		teamMember, err = th.App.GetTeamMember(th.Context, team.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.False(t, teamMember.SchemeAdmin)
		assert.True(t, teamMember.SchemeGuest)

		channelMember, err = th.App.GetChannelMember(th.Context, channel.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, channelMember.SchemeUser)
		assert.False(t, channelMember.SchemeAdmin)
		assert.True(t, channelMember.SchemeGuest)
	})
}

func TestDeactivateGuests(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest1 := th.CreateGuest()
	guest2 := th.CreateGuest()
	user := th.CreateUser()

	err := th.App.DeactivateGuests(th.Context)
	require.Nil(t, err)

	guest1, err = th.App.GetUser(guest1.Id)
	assert.Nil(t, err)
	assert.NotEqual(t, int64(0), guest1.DeleteAt)

	guest2, err = th.App.GetUser(guest2.Id)
	assert.Nil(t, err)
	assert.NotEqual(t, int64(0), guest2.DeleteAt)

	user, err = th.App.GetUser(user.Id)
	assert.Nil(t, err)
	assert.Equal(t, int64(0), user.DeleteAt)
}

func TestUpdateUserRolesWithUser(t *testing.T) {
	// InitBasic is used to let the first CreateUser call not be
	// a system_admin
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create normal user.
	user := th.CreateUser()
	assert.Equal(t, user.Roles, model.SystemUserRoleId)

	// Upgrade to sysadmin.
	user, err := th.App.UpdateUserRolesWithUser(th.Context, user, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(t, err)
	assert.Equal(t, user.Roles, model.SystemUserRoleId+" "+model.SystemAdminRoleId)

	// Test bad role.
	_, err = th.App.UpdateUserRolesWithUser(th.Context, user, "does not exist", false)
	require.NotNil(t, err)

	//Test reset to User role
	user, err = th.App.UpdateUserRolesWithUser(th.Context, user, model.SystemUserRoleId, false)
	require.Nil(t, err)
	assert.Equal(t, user.Roles, model.SystemUserRoleId)
}

func TestUpdateLastAdminUserRolesWithUser(t *testing.T) {
	// InitBasic is used to let the first CreateUser call not be
	// a system_admin
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Cannot remove if only admin", func(t *testing.T) {
		// Attempt to downgrade sysadmin.
		user, appErr := th.App.UpdateUserRolesWithUser(th.Context, th.SystemAdminUser, model.SystemUserRoleId, false)
		require.NotNil(t, appErr)
		require.Nil(t, user)
	})

	t.Run("Cannot remove if only non-Bot admin", func(t *testing.T) {
		bot := th.CreateBot()
		user, appErr := th.App.UpdateUserRoles(th.Context, bot.UserId, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		require.Nil(t, appErr)
		require.NotNil(t, user)

		// Attempt to downgrade sysadmin.
		user, appErr = th.App.UpdateUserRolesWithUser(th.Context, th.SystemAdminUser, model.SystemUserRoleId, false)
		require.NotNil(t, appErr)
		require.Nil(t, user)
	})

	t.Run("Can remove if not only non-Bot admin", func(t *testing.T) {
		systemAdminUser2 := th.CreateUser()
		user, appErr := th.App.UpdateUserRoles(th.Context, systemAdminUser2.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		require.Nil(t, appErr)
		require.NotNil(t, user)

		// Attempt to downgrade sysadmin.
		user, appErr = th.App.UpdateUserRolesWithUser(th.Context, th.SystemAdminUser, model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		require.NotNil(t, user)
	})
}

func TestDeactivateMfa(t *testing.T) {
	t.Run("MFA is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableMultifactorAuthentication = false
		})

		user := th.BasicUser
		err := th.App.DeactivateMfa(user.Id)
		require.Nil(t, err)
	})
}

func TestPatchUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testUser := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, testUser)

	t.Run("Patch with a username already exists", func(t *testing.T) {
		_, err := th.App.PatchUser(th.Context, testUser.Id, &model.UserPatch{
			Username: model.NewPointer(th.BasicUser.Username),
		}, true)

		require.NotNil(t, err)
		require.Equal(t, "app.user.save.username_exists.app_error", err.Id)
	})

	t.Run("Patch with a email already exists", func(t *testing.T) {
		_, err := th.App.PatchUser(th.Context, testUser.Id, &model.UserPatch{
			Email: model.NewPointer(th.BasicUser.Email),
		}, true)

		require.NotNil(t, err)
		require.Equal(t, "app.user.save.email_exists.app_error", err.Id)
	})

	t.Run("Patch username with a new username", func(t *testing.T) {
		u, err := th.App.PatchUser(th.Context, testUser.Id, &model.UserPatch{
			Username: model.NewPointer(model.NewUsername()),
		}, true)

		require.Nil(t, err)
		require.Empty(t, u.Password)
	})
}

func TestUpdateThreadReadForUser(t *testing.T) {
	t.Run("Ensure thread membership exists before updating read", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		rootPost, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hi"}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		replyPost, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hi"}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		threads, appErr := th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		require.Zero(t, threads.Total)

		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "currentSessionId", th.BasicUser.Id, th.BasicChannel.TeamId, rootPost.Id, replyPost.CreateAt)
		require.NotNil(t, appErr)

		_, err := th.App.Srv().Store().Thread().MaintainMembership(th.BasicUser.Id, rootPost.Id, store.ThreadMembershipOpts{Following: true, UpdateFollowing: true})
		require.NoError(t, err)

		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "currentSessionId", th.BasicUser.Id, th.BasicChannel.TeamId, rootPost.Id, replyPost.CreateAt)
		require.Nil(t, appErr)
	})
}

func TestCreateUserWithInitialPreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("successfully create a user with initial tutorial and recommended steps preferences", func(t *testing.T) {
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		testUser := th.CreateUser()
		defer th.App.PermanentDeleteUser(th.Context, testUser)

		tutorialStepPref, appErr := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, testUser.Id, model.PreferenceCategoryTutorialSteps, testUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, testUser.Id, tutorialStepPref.Name)

		recommendedNextStepsPref, appErr := th.App.GetPreferenceByCategoryForUser(th.Context, testUser.Id, model.PreferenceRecommendedNextSteps)
		require.Nil(t, appErr)
		assert.Equal(t, model.PreferenceRecommendedNextSteps, recommendedNextStepsPref[0].Category)
		assert.Equal(t, "hide", recommendedNextStepsPref[0].Name)
		assert.Equal(t, "false", recommendedNextStepsPref[0].Value)

		gmASdmNoticeViewedPref, appErr := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, testUser.Id, model.PreferenceCategorySystemNotice, "GMasDM")
		require.Nil(t, appErr)
		assert.Equal(t, "GMasDM", gmASdmNoticeViewedPref.Name)
		assert.Equal(t, "true", gmASdmNoticeViewedPref.Value)
	})

	t.Run("successfully create a guest user with initial tutorial and recommended steps preferences", func(t *testing.T) {
		th.Server.platform.SetConfigReadOnlyFF(false)
		defer th.Server.platform.SetConfigReadOnlyFF(true)
		testUser := th.CreateGuest()
		defer th.App.PermanentDeleteUser(th.Context, testUser)

		tutorialStepPref, appErr := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, testUser.Id, model.PreferenceCategoryTutorialSteps, testUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, testUser.Id, tutorialStepPref.Name)

		recommendedNextStepsPref, appErr := th.App.GetPreferenceByCategoryForUser(th.Context, testUser.Id, model.PreferenceRecommendedNextSteps)
		require.Nil(t, appErr)
		assert.Equal(t, model.PreferenceRecommendedNextSteps, recommendedNextStepsPref[0].Category)
		assert.Equal(t, "hide", recommendedNextStepsPref[0].Name)
		assert.Equal(t, "false", recommendedNextStepsPref[0].Value)

		gmASdmNoticeViewedPref, appErr := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, testUser.Id, model.PreferenceCategorySystemNotice, "GMasDM")
		require.Nil(t, appErr)
		assert.Equal(t, "GMasDM", gmASdmNoticeViewedPref.Name)
		assert.Equal(t, "true", gmASdmNoticeViewedPref.Value)
	})
}

func TestSendSubscriptionHistoryEvent(t *testing.T) {
	cloudProduct := &model.Product{
		ID:                "prod_test1",
		Name:              "name1",
		Description:       "description1",
		PricePerSeat:      1000,
		SKU:               "sku1",
		PriceID:           "price_id1",
		Family:            "family1",
		RecurringInterval: "year",
		BillingScheme:     "billing_scheme1",
		CrossSellsTo:      "prod_test2",
	}

	subscription := &model.Subscription{
		ID:         "MySubscriptionID",
		CustomerID: "MyCustomer",
		ProductID:  "SomeProductId",
		AddOns:     []string{},
		StartAt:    1000000000,
		EndAt:      2000000000,
		CreateAt:   1000000000,
		Seats:      10,
		DNS:        "some.dns.server",
	}

	subscriptionHistory := &model.SubscriptionHistory{
		ID:             "sub_history",
		SubscriptionID: "MySubscriptionID",
		Seats:          10,
		CreateAt:       1000000000,
	}

	t.Run("Should not create SubscriptionHistoryEvent if the license is not cloud", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense(""))

		userID := "123"

		subscriptionHistoryEvent, err := th.App.SendSubscriptionHistoryEvent(userID)
		require.NoError(t, err)
		require.Nil(t, subscriptionHistoryEvent)
	})

	t.Run("Should create SubscriptionHistoryEvent if the license is cloud and the product is yearly", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		// mock the cloud functions
		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)
		cloud.Mock.On("GetCloudProduct", mock.Anything, mock.Anything).Return(cloudProduct, nil)
		cloud.Mock.On("CreateOrUpdateSubscriptionHistoryEvent", mock.Anything, mock.Anything).Return(subscriptionHistory, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		// Mock to get the user count
		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)

		mockStore.On("User").Return(&mockUserStore)

		userID := "123"

		subscriptionHistoryEvent, err := th.App.SendSubscriptionHistoryEvent(userID)
		require.NoError(t, err)
		require.Equal(t, subscription.ID, subscriptionHistoryEvent.SubscriptionID, "subscription ID doesn't match")
		require.Equal(t, 10, subscriptionHistoryEvent.Seats, "Number of seats doesn't match")
	})
}

func TestGetUsersForReporting(t *testing.T) {
	t.Run("should throw error on invalid date range", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		userReports, err := th.App.GetUsersForReporting(&model.UserReportOptions{
			ReportingBaseOptions: model.ReportingBaseOptions{
				SortColumn: "Username",
				PageSize:   50,
				StartAt:    1000,
				EndAt:      500,
			},
		})
		require.NotNil(t, err)
		require.Nil(t, userReports)
	})

	t.Run("should throw error on bad sort column", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		userReports, err := th.App.GetUsersForReporting(&model.UserReportOptions{
			ReportingBaseOptions: model.ReportingBaseOptions{
				SortColumn: "FakeColumn",
				PageSize:   50,
			},
		})
		require.NotNil(t, err)
		require.Nil(t, userReports)
	})

	t.Run("should return some formatted reporting data", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		// Mock to get the user count
		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("GetUserReport",
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
			mock.Anything,
		).Return([]*model.UserReportQuery{
			{
				User: model.User{
					Id:        "some-id",
					CreateAt:  1000,
					FirstName: "Bob",
					LastName:  "Bobson",
					LastLogin: 1500,
				},
			},
		}, nil)

		mockStore.On("User").Return(&mockUserStore)

		userReports, err := th.App.GetUsersForReporting(&model.UserReportOptions{
			ReportingBaseOptions: model.ReportingBaseOptions{
				SortColumn: "Username",
				PageSize:   50,
			},
		})
		require.Nil(t, err)
		require.NotNil(t, userReports)
	})
}

func TestCreateUserOrGuest(t *testing.T) {
	t.Run("base case - you can create a user", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		user := &model.User{
			Email:         "TestCreateUserOrGuest@example.com",
			Username:      "username_123",
			Nickname:      "nn_username_123",
			Password:      "Password1",
			EmailVerified: true,
		}
		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.Equal(t, "username_123", createdUser.Username)
	})

	t.Run("cannot create user when user count has exceeded the permissible limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(12000), nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockStore.On("User").Return(&mockUserStore)

		user := &model.User{
			Email:         "TestCreateUserOrGuest@example.com",
			Username:      "username_123",
			Nickname:      "nn_username_123",
			Password:      "Password1",
			EmailVerified: true,
		}
		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.NotNil(t, appErr)
		require.Nil(t, createdUser)
	})

	t.Run("can create user when server is exactly on limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		id := NewTestId()
		userCreationMocks(t, th, id, 11000)

		user := &model.User{
			Email:         "TestCreateUserOrGuest@example.com",
			Username:      "username_123",
			Nickname:      "nn_username_123",
			Password:      "Password1",
			EmailVerified: true,
		}
		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.Equal(t, "username_123", createdUser.Username)
	})

	t.Run("licensed server can create user when server is OVER limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		id := NewTestId()
		userCreationMocks(t, th, id, 20000)

		user := &model.User{
			Email:         "TestCreateUserOrGuest@example.com",
			Username:      "username_123",
			Nickname:      "nn_username_123",
			Password:      "Password1",
			EmailVerified: true,
		}

		th.App.Srv().SetLicense(model.NewTestLicense(""))
		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.Equal(t, "username_123", createdUser.Username)
	})

	t.Run("licensed server can create user when server is UNDER limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		id := NewTestId()
		userCreationMocks(t, th, id, 10)

		user := &model.User{
			Email:         "TestCreateUserOrGuest@example.com",
			Username:      "username_123",
			Nickname:      "nn_username_123",
			Password:      "Password1",
			EmailVerified: true,
		}

		th.App.Srv().SetLicense(model.NewTestLicense(""))
		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.Equal(t, "username_123", createdUser.Username)
	})
}

func userCreationMocks(t *testing.T, th *TestHelper, userID string, activeUserCount int64) {
	mockUserStore := storemocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(activeUserCount, nil)
	mockUserStore.On("IsEmpty", mock.Anything).Return(false, nil)
	mockUserStore.On("VerifyEmail", mock.Anything, "TestCreateUserOrGuest@example.com").Return("", nil)
	mockUserStore.On("InvalidateProfilesInChannelCacheByUser", mock.Anything).Return()
	mockUserStore.On("InvalidateProfileCacheForUser", mock.Anything).Return()
	mockUserStore.On("Save", mock.Anything, mock.Anything).Return(&model.User{
		Id:            userID,
		Email:         "TestCreateUserOrGuest@example.com",
		Username:      "username_123",
		Nickname:      "nn_username_123",
		Password:      "Password1",
		EmailVerified: true,
	}, nil)

	mockUserStore.On("Get", mock.Anything, userID).Return(&model.User{
		Id:            userID,
		Email:         "TestCreateUserOrGuest@example.com",
		Username:      "username_123",
		Nickname:      "nn_username_123",
		Password:      "Password1",
		EmailVerified: true,
	}, nil)

	mockGroupStore := storemocks.GroupStore{}
	mockGroupStore.On("GetByName", "username_123", mock.Anything).Return(nil, nil)

	mockChannelStore := storemocks.ChannelStore{}
	mockChannelStore.On("InvalidateAllChannelMembersForUser", mock.Anything).Return()

	mockPreferencesStore := storemocks.PreferenceStore{}
	mockPreferencesStore.On("Save", mock.Anything).Return(nil)

	mockProductNoticeStore := storemocks.ProductNoticesStore{}
	mockProductNoticeStore.On("View", userID, mock.Anything).Return(nil)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Group").Return(&mockGroupStore)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("Preference").Return(&mockPreferencesStore)
	mockStore.On("ProductNotices").Return(&mockProductNoticeStore)

	var err error
	th.App.ch.srv.userService, err = users.New(users.ServiceConfig{
		UserStore:    &mockUserStore,
		SessionStore: &storemocks.SessionStore{},
		OAuthStore:   &storemocks.OAuthStore{},
		ConfigFn:     th.App.ch.srv.platform.Config,
		LicenseFn:    th.App.ch.srv.License,
	})

	require.NoError(t, err)
}
