// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	oauthgitlab "github.com/mattermost/mattermost-server/v6/model/gitlab"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils/testutils"
)

func TestCreateOAuthUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.GitLabSettings.Enable = true
	})

	t.Run("create user successfully", func(t *testing.T) {
		glUser := oauthgitlab.GitLabUser{Id: 42, Username: "o" + model.NewId(), Email: model.NewId() + "@simulator.amazonses.com", Name: "Joram Wilander"}
		js, jsonErr := json.Marshal(glUser)
		require.NoError(t, jsonErr)

		user, err := th.Suite.CreateOAuthUser(th.Context, model.UserAuthServiceGitlab, bytes.NewReader(js), th.BasicTeam.Id, nil)
		require.Nil(t, err)

		require.Equal(t, glUser.Username, user.Username, "usernames didn't match")

		th.Suite.PermanentDeleteUser(th.Context, user)
	})

	t.Run("user exists, update authdata successfully", func(t *testing.T) {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.Office365Settings.Enable = true
		})

		dbUser := th.BasicUser

		// mock oAuth Provider, return data
		mockUser := &model.User{Id: "abcdef", AuthData: model.NewString("e7110007-64be-43d8-9840-4a7e9c26b710"), Email: dbUser.Email}
		providerMock := &mocks.OAuthProvider{}
		providerMock.On("IsSameUser", mock.Anything, mock.Anything).Return(true)
		providerMock.On("GetUserFromJSON", mock.Anything, mock.Anything).Return(mockUser, nil)
		einterfaces.RegisterOAuthProvider(model.ServiceOffice365, providerMock)

		// Update user to be OAuth, formatting to match Office365 OAuth data
		s, er2 := th.Suite.platform.Store.User().UpdateAuthData(dbUser.Id, model.ServiceOffice365, model.NewString("e711000764be43d898404a7e9c26b710"), "", false)
		assert.NoError(t, er2)
		assert.Equal(t, dbUser.Id, s)

		// data passed doesn't matter as return is mocked
		_, err := th.Suite.CreateOAuthUser(th.Context, model.ServiceOffice365, strings.NewReader("{}"), th.BasicTeam.Id, nil)
		assert.Nil(t, err)
		u, er := th.Suite.platform.Store.User().GetByEmail(dbUser.Email)
		assert.NoError(t, er)
		// make sure authdata is updated
		assert.Equal(t, "e7110007-64be-43d8-9840-4a7e9c26b710", *u.AuthData)
	})

	t.Run("user creation disabled", func(t *testing.T) {
		*th.Suite.platform.Config().TeamSettings.EnableUserCreation = false
		_, err := th.Suite.CreateOAuthUser(th.Context, model.UserAuthServiceGitlab, strings.NewReader("{}"), th.BasicTeam.Id, nil)
		require.NotNil(t, err, "should have failed - user creation disabled")
	})
}

func TestSetDefaultProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.Suite.SetDefaultProfileImage(th.Context, &model.User{
		Id:       model.NewId(),
		Username: "notvaliduser",
	})
	// It doesn't fail, but it does nothing
	require.Nil(t, err)

	user := th.BasicUser

	err = th.Suite.SetDefaultProfileImage(th.Context, user)
	require.Nil(t, err)

	user = getUserFromDB(th.Suite, user.Id, t)
	assert.Equal(t, int64(0), user.LastPictureUpdate)
}

func TestAdjustProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.Suite.AdjustImage(bytes.NewReader([]byte{}))
	require.NotNil(t, err)

	// test image isn't the correct dimensions
	// it should be adjusted
	testjpg, error := testutils.ReadTestFile("testjpg.jpg")
	require.NoError(t, error)
	adjusted, err := th.Suite.AdjustImage(bytes.NewReader(testjpg))
	require.Nil(t, err)
	assert.True(t, adjusted.Len() > 0)
	assert.NotEqual(t, testjpg, adjusted)

	// default image should require adjustment
	user := th.BasicUser
	image, err2 := th.Suite.GetDefaultProfileImage(user)
	require.NoError(t, err2)
	image2, err2 := th.Suite.AdjustImage(bytes.NewReader(image))
	require.NoError(t, err2)
	assert.Equal(t, image, image2.Bytes())
}

func TestUpdateUserToRestrictedDomain(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	defer th.Suite.PermanentDeleteUser(th.Context, user)

	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.RestrictCreationToDomains = "foo.com"
	})

	_, err := th.Suite.UpdateUser(th.Context, user, false)
	assert.Nil(t, err)

	user.Email = "asdf@ghjk.l"
	_, err = th.Suite.UpdateUser(th.Context, user, false)
	assert.NotNil(t, err)

	t.Run("Restricted Domains must be ignored for guest users", func(t *testing.T) {
		guest := th.CreateGuest()
		defer th.Suite.PermanentDeleteUser(th.Context, guest)

		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictCreationToDomains = "foo.com"
		})

		guest.Email = "asdf@bar.com"
		updatedGuest, err := th.Suite.UpdateUser(th.Context, guest, false)
		require.Nil(t, err)
		require.Equal(t, guest.Email, updatedGuest.Email)
	})

	t.Run("Guest users should be affected by guest restricted domains", func(t *testing.T) {
		guest := th.CreateGuest()
		defer th.Suite.PermanentDeleteUser(th.Context, guest)

		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.GuestAccountsSettings.RestrictCreationToDomains = "foo.com"
		})

		guest.Email = "asdf@bar.com"
		_, err := th.Suite.UpdateUser(th.Context, guest, false)
		require.NotNil(t, err)

		guest.Email = "asdf@foo.com"
		updatedGuest, err := th.Suite.UpdateUser(th.Context, guest, false)
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
		u, err := th.Suite.UpdateUser(th.Context, user, false)
		require.NotNil(t, err)
		require.Nil(t, u)
	})
}

func TestUpdateUserMissingFields(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	defer th.Suite.PermanentDeleteUser(th.Context, user)

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
			_, err := th.Suite.UpdateUser(th.Context, tc.input, false)

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
		u, err := th.Suite.CreateUser(th.Context, user)
		require.NotNil(t, err)
		require.Nil(t, u)
	})

	t.Run("should sanitize user authdata before publishing to plugin hooks", func(t *testing.T) {
		tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/mattermost/mattermost-server/v6/plugin"
				"github.com/mattermost/mattermost-server/v6/model"
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
		`}, th.Suite, th.NewPluginAPI)
		defer tearDown()

		user := &model.User{
			Email:       model.NewId() + "success+test@example.com",
			Nickname:    "Darth Vader",
			Username:    "vader" + model.NewId(),
			Password:    "passwd12345",
			AuthService: "",
		}
		_, err := th.Suite.CreateUser(th.Context, user)
		require.Nil(t, err)

		time.Sleep(1 * time.Second)

		user, err = th.Suite.GetUser(user.Id)
		require.Nil(t, err)
		require.Equal(t, "sanitized", user.Nickname)
	})
}

func TestUpdateUserActive(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()

	EnableUserDeactivation := th.Suite.platform.Config().TeamSettings.EnableUserDeactivation
	defer func() {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserDeactivation = EnableUserDeactivation })
	}()

	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableUserDeactivation = true
	})
	err := th.Suite.UpdateUserActive(th.Context, user.Id, false)
	assert.Nil(t, err)
}

func TestUpdateActiveBotsSideEffect(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot, err := th.Suite.CreateBot(th.Context, &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.Suite.PermanentDeleteBot(bot.UserId)

	// Automatic deactivation disabled
	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = false
	})

	th.Suite.UpdateActive(th.Context, th.BasicUser, false)

	retbot1, err := th.Suite.GetBot(bot.UserId, true)
	require.Nil(t, err)
	require.Zero(t, retbot1.DeleteAt)
	user1, err := th.Suite.GetUser(bot.UserId)
	require.Nil(t, err)
	require.Zero(t, user1.DeleteAt)

	th.Suite.UpdateActive(th.Context, th.BasicUser, true)

	// Automatic deactivation enabled
	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = true
	})

	th.Suite.UpdateActive(th.Context, th.BasicUser, false)

	retbot2, err := th.Suite.GetBot(bot.UserId, true)
	require.Nil(t, err)
	require.NotZero(t, retbot2.DeleteAt)
	user2, err := th.Suite.GetUser(bot.UserId)
	require.Nil(t, err)
	require.NotZero(t, user2.DeleteAt)

	th.Suite.UpdateActive(th.Context, th.BasicUser, true)
}

func TestUpdateOAuthUserAttrs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	id2 := model.NewId()
	th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.GitLabSettings.Enable = true
	})
	gitlabProvider := einterfaces.GetOAuthProvider("gitlab")

	username := "user" + id
	username2 := "user" + id2

	email := "user" + id + "@nowhere.com"
	email2 := "user" + id2 + "@nowhere.com"

	var user, user2 *model.User
	var gitlabUserObj oauthgitlab.GitLabUser
	user, gitlabUserObj = createGitlabUser(t, th.Suite, th.Context, 1, username, email)
	user2, _ = createGitlabUser(t, th.Suite, th.Context, 2, username2, email2)

	t.Run("UpdateUsername", func(t *testing.T) {
		t.Run("NoExistingUserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = "updateduser" + model.NewId()
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.Suite, user.Id, t)
			th.Suite.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.Suite, user.Id, t)

			require.Equal(t, gitlabUserObj.Username, user.Username, "user's username is not updated")
		})

		t.Run("ExistinguserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = user2.Username

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.Suite, user.Id, t)
			th.Suite.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.Suite, user.Id, t)

			require.NotEqual(t, gitlabUserObj.Username, user.Username, "user's username is updated though there already exists another user with the same username")
		})
	})

	t.Run("UpdateEmail", func(t *testing.T) {
		t.Run("NoExistingUserWithSameEmail", func(t *testing.T) {
			gitlabUserObj.Email = "newuser" + model.NewId() + "@nowhere.com"
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.Suite, user.Id, t)
			th.Suite.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.Suite, user.Id, t)

			require.Equal(t, gitlabUserObj.Email, user.Email, "user's email is not updated")

			require.True(t, user.EmailVerified, "user's email should have been verified")
		})

		t.Run("ExistingUserWithSameEmail", func(t *testing.T) {
			gitlabUserObj.Email = user2.Email

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.Suite, user.Id, t)
			th.Suite.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab", nil)
			user = getUserFromDB(th.Suite, user.Id, t)

			require.NotEqual(t, gitlabUserObj.Email, user.Email, "user's email is updated though there already exists another user with the same email")
		})
	})

	t.Run("UpdateFirstName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated User"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(th.Suite, user.Id, t)
		th.Suite.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab", nil)
		user = getUserFromDB(th.Suite, user.Id, t)

		require.Equal(t, "Updated", user.FirstName, "user's first name is not updated")
	})

	t.Run("UpdateLastName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated Lastname"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(th.Suite, user.Id, t)
		th.Suite.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab", nil)
		user = getUserFromDB(th.Suite, user.Id, t)

		require.Equal(t, "Lastname", user.LastName, "user's last name is not updated")
	})
}

func TestCreateUserConflict(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := &model.User{
		Email:    "test@localhost",
		Username: model.NewId(),
	}
	user, err := th.Suite.platform.Store.User().Save(user)
	require.NoError(t, err)
	username := user.Username

	var invErr *store.ErrInvalidInput
	// Same id
	_, err = th.Suite.platform.Store.User().Save(user)
	require.Error(t, err)
	require.True(t, errors.As(err, &invErr))
	assert.Equal(t, "id", invErr.Field)

	// Same email
	user = &model.User{
		Email:    "test@localhost",
		Username: model.NewId(),
	}
	_, err = th.Suite.platform.Store.User().Save(user)
	require.Error(t, err)
	require.True(t, errors.As(err, &invErr))
	assert.Equal(t, "email", invErr.Field)

	// Same username
	user = &model.User{
		Email:    "test2@localhost",
		Username: username,
	}
	_, err = th.Suite.platform.Store.User().Save(user)
	require.Error(t, err)
	require.True(t, errors.As(err, &invErr))
	assert.Equal(t, "username", invErr.Field)
}

func TestUpdateUserEmail(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()

	t.Run("RequireVerification", func(t *testing.T) {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = true
		})

		currentEmail := user.Email
		newEmail := th.MakeEmail()

		user.Email = newEmail
		user2, appErr := th.Suite.UpdateUser(th.Context, user, false)
		assert.Nil(t, appErr)
		assert.Equal(t, currentEmail, user2.Email)
		assert.True(t, user2.EmailVerified)

		token, err := th.Suite.email.CreateVerifyEmailToken(user2.Id, newEmail)
		assert.NoError(t, err)

		appErr = th.Suite.VerifyEmailFromToken(th.Context, token.Token)
		assert.Nil(t, appErr)

		user2, appErr = th.Suite.GetUser(user2.Id)
		assert.Nil(t, appErr)
		assert.Equal(t, newEmail, user2.Email)
		assert.True(t, user2.EmailVerified)

		// Create bot user
		botuser := model.User{
			Email:    "botuser@localhost",
			Username: model.NewId(),
			IsBot:    true,
		}
		_, nErr := th.Suite.platform.Store.User().Save(&botuser)
		assert.NoError(t, nErr)

		newBotEmail := th.MakeEmail()
		botuser.Email = newBotEmail
		botuser2, appErr := th.Suite.UpdateUser(th.Context, &botuser, false)
		assert.Nil(t, appErr)
		assert.Equal(t, botuser2.Email, newBotEmail)

	})

	t.Run("RequireVerificationAlreadyUsedEmail", func(t *testing.T) {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = true
		})

		user2 := th.CreateUser()
		newEmail := user2.Email

		user.Email = newEmail
		user3, err := th.Suite.UpdateUser(th.Context, user, false)
		require.NotNil(t, err)
		assert.Equal(t, err.Id, "app.user.save.email_exists.app_error")
		assert.Nil(t, user3)
	})

	t.Run("NoVerification", func(t *testing.T) {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = false
		})

		newEmail := th.MakeEmail()

		user.Email = newEmail
		user2, err := th.Suite.UpdateUser(th.Context, user, false)
		assert.Nil(t, err)
		assert.Equal(t, newEmail, user2.Email)

		// Create bot user
		botuser := model.User{
			Email:    "botuser@localhost",
			Username: model.NewId(),
			IsBot:    true,
		}
		_, nErr := th.Suite.platform.Store.User().Save(&botuser)
		assert.NoError(t, nErr)

		newBotEmail := th.MakeEmail()
		botuser.Email = newBotEmail
		botuser2, err := th.Suite.UpdateUser(th.Context, &botuser, false)
		assert.Nil(t, err)
		assert.Equal(t, botuser2.Email, newBotEmail)
	})

	t.Run("NoVerificationAlreadyUsedEmail", func(t *testing.T) {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = false
		})

		user2 := th.CreateUser()
		newEmail := user2.Email

		user.Email = newEmail
		user3, err := th.Suite.UpdateUser(th.Context, user, false)
		require.NotNil(t, err)
		assert.Equal(t, err.Id, "app.user.save.email_exists.app_error")
		assert.Nil(t, user3)
	})

	t.Run("Only the last token works if verification is required", func(t *testing.T) {
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.RequireEmailVerification = true
		})

		// we update the email a first time and update. The first
		// token is sent with the email
		user.Email = th.MakeEmail()
		_, appErr := th.Suite.UpdateUser(th.Context, user, true)
		require.Nil(t, appErr)

		tokens := []*model.Token{}
		require.Eventually(t, func() bool {
			var err error
			tokens, err = th.Suite.platform.Store.Token().GetAllTokensByType(TokenTypeVerifyEmail)
			return err == nil && len(tokens) == 1
		}, 100*time.Millisecond, 10*time.Millisecond)

		firstToken := tokens[0]

		// without using the first token, we update the email a second
		// time and another token gets sent. The first one should not
		// work anymore and the second should work properly
		user.Email = th.MakeEmail()
		_, appErr = th.Suite.UpdateUser(th.Context, user, true)
		require.Nil(t, appErr)

		require.Eventually(t, func() bool {
			var err error
			tokens, err = th.Suite.platform.Store.Token().GetAllTokensByType(TokenTypeVerifyEmail)
			// We verify the same conditions as the earlier function,
			// but we also need to ensure that this is not the same token
			// as before, which is possible if the token update goroutine
			// hasn't yet run.
			return err == nil && len(tokens) == 1 && tokens[0].Token != firstToken.Token
		}, 100*time.Millisecond, 10*time.Millisecond)
		secondToken := tokens[0]

		_, err := th.Suite.platform.Store.Token().GetByToken(firstToken.Token)
		require.Error(t, err)

		require.NotNil(t, th.Suite.VerifyEmailFromToken(th.Context, firstToken.Token))
		require.Nil(t, th.Suite.VerifyEmailFromToken(th.Context, secondToken.Token))
		require.NotNil(t, th.Suite.VerifyEmailFromToken(th.Context, firstToken.Token))
	})
}

func getUserFromDB(ss *SuiteService, id string, t *testing.T) *model.User {
	user, err := ss.GetUser(id)
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

func createGitlabUser(t *testing.T, ss *SuiteService, c *request.Context, id int64, username string, email string) (*model.User, oauthgitlab.GitLabUser) {
	gitlabUserObj := oauthgitlab.GitLabUser{Id: id, Username: username, Login: "user1", Email: email, Name: "Test User"}
	gitlabUser := getGitlabUserPayload(gitlabUserObj, t)

	var user *model.User
	var err *model.AppError

	user, err = ss.CreateOAuthUser(c, "gitlab", bytes.NewReader(gitlabUser), "", nil)
	require.Nil(t, err, "unable to create the user", err)

	return user, gitlabUserObj
}

func TestGetUsersByStatus(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel, err := th.Suite.channels.CreateChannel(th.Context, &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
		CreatorId:   model.NewId(),
	}, false)
	require.Nil(t, err, "failed to create channel: %v", err)

	createUserWithStatus := func(username string, status string) *model.User {
		id := model.NewId()

		user, err := th.Suite.CreateUser(th.Context, &model.User{
			Email:    "success+" + id + "@simulator.amazonses.com",
			Username: "un_" + username + "_" + id,
			Nickname: "nn_" + id,
			Password: "Password1",
		})
		require.Nil(t, err, "failed to create user: %v", err)

		th.LinkUserToTeam(user, team)
		th.AddUserToChannel(user, channel)

		th.Suite.platform.SaveAndBroadcastStatus(&model.Status{
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
		usersByStatus, err := th.Suite.GetUsersInChannelPageByStatus(&model.UserGetOptions{
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
		usersByStatus, err := th.Suite.GetUsersInChannelPageByStatus(&model.UserGetOptions{
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

		usersByStatus, err = th.Suite.GetUsersInChannelPageByStatus(&model.UserGetOptions{
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

		usersByStatus, err = th.Suite.GetUsersInChannelPageByStatus(&model.UserGetOptions{
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
		u, err := th.Suite.CreateUserWithInviteId(th.Context, &user, th.BasicTeam.InviteId, "")
		require.Nil(t, err)
		require.Equal(t, u.Id, user.Id)
	})

	t.Run("invalid invite id", func(t *testing.T) {
		_, err := th.Suite.CreateUserWithInviteId(th.Context, &user, "", "")
		require.NotNil(t, err)
		require.Contains(t, err.Id, "app.team.get_by_invite_id")
	})

	t.Run("invalid domain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "mattermost.com"
		_, nErr := th.Suite.platform.Store.Team().Update(th.BasicTeam)
		require.NoError(t, nErr)
		_, err := th.Suite.CreateUserWithInviteId(th.Context, &user, th.BasicTeam.InviteId, "")
		require.NotNil(t, err)
		require.Equal(t, "api.team.invite_members.invalid_email.app_error", err.Id)
	})
}

func TestCreateUserWithToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}

	t.Run("invalid token", func(t *testing.T) {
		_, err := th.Suite.CreateUserWithToken(th.Context, &user, &model.Token{Token: "123"})
		require.NotNil(t, err, "Should fail on unexisting token")
	})

	t.Run("invalid token type", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeVerifyEmail,
			model.MapToJSON(map[string]string{"teamID": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		defer th.Suite.DeleteToken(token)
		_, err := th.Suite.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err, "Should fail on bad token type")
	})

	t.Run("token extra email does not match provided user data email", func(t *testing.T) {
		invitationEmail := "attacker@test.com"
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail}),
		)

		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		_, err := th.Suite.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err)
	})

	t.Run("expired token", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		token.CreateAt = model.GetMillis() - InvitationExpiryTime - 1
		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		defer th.Suite.DeleteToken(token)
		_, err := th.Suite.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err, "Should fail on expired token")
	})

	t.Run("invalid team id", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": model.NewId(), "email": user.Email}),
		)
		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		defer th.Suite.DeleteToken(token)
		_, err := th.Suite.CreateUserWithToken(th.Context, &user, token)
		require.NotNil(t, err, "Should fail on bad team id")
	})

	t.Run("valid regular user request", func(t *testing.T) {
		invitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		u := model.User{Email: invitationEmail, Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail}),
		)
		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		newUser, err := th.Suite.CreateUserWithToken(th.Context, &u, token)
		require.Nil(t, err, "Should add user to the team. err=%v", err)
		assert.False(t, newUser.IsGuest())
		require.Equal(t, invitationEmail, newUser.Email, "The user email must be the invitation one")

		_, nErr := th.Suite.platform.Store.Token().GetByToken(token.Token)
		require.Error(t, nErr, "The token must be deleted after be used")

		members, err := th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newUser.Id)
		require.Nil(t, err)
		assert.Len(t, members, 2)
	})

	t.Run("valid guest request", func(t *testing.T) {
		invitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail, "channels": th.BasicChannel.Id}),
		)

		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		guest := model.User{Email: invitationEmail, Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		newGuest, err := th.Suite.CreateUserWithToken(th.Context, &guest, token)
		require.Nil(t, err, "Should add user to the team. err=%v", err)

		assert.True(t, newGuest.IsGuest())
		require.Equal(t, invitationEmail, newGuest.Email, "The user email must be the invitation one")
		_, nErr := th.Suite.platform.Store.Token().GetByToken(token.Token)
		require.Error(t, nErr, "The token must be deleted after be used")

		members, err := th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newGuest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})

	t.Run("create guest having email domain restrictions", func(t *testing.T) {
		enableGuestDomainRestrictions := *th.Suite.platform.Config().GuestAccountsSettings.RestrictCreationToDomains
		defer func() {
			th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
				cfg.GuestAccountsSettings.RestrictCreationToDomains = &enableGuestDomainRestrictions
			})
		}()
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "restricted.com" })
		forbiddenInvitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		grantedInvitationEmail := strings.ToLower(model.NewId()) + "other-email@restricted.com"
		forbiddenDomainToken := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": forbiddenInvitationEmail, "channels": th.BasicChannel.Id}),
		)
		grantedDomainToken := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": grantedInvitationEmail, "channels": th.BasicChannel.Id}),
		)
		require.NoError(t, th.Suite.platform.Store.Token().Save(forbiddenDomainToken))
		require.NoError(t, th.Suite.platform.Store.Token().Save(grantedDomainToken))
		guest := model.User{
			Email:       forbiddenInvitationEmail,
			Nickname:    "Darth Vader",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		newGuest, err := th.Suite.CreateUserWithToken(th.Context, &guest, forbiddenDomainToken)
		require.NotNil(t, err)
		require.Nil(t, newGuest)
		assert.Equal(t, "api.user.create_user.accepted_domain.app_error", err.Id)

		guest.Email = grantedInvitationEmail
		newGuest, err = th.Suite.CreateUserWithToken(th.Context, &guest, grantedDomainToken)
		require.Nil(t, err)
		assert.True(t, newGuest.IsGuest())
		require.Equal(t, grantedInvitationEmail, newGuest.Email)
		_, nErr := th.Suite.platform.Store.Token().GetByToken(grantedDomainToken.Token)
		require.Error(t, nErr)

		members, err := th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newGuest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})

	t.Run("create guest having team and system email domain restrictions", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "restricted-team.com"
		_, err := th.Suite.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")
		enableGuestDomainRestrictions := *th.Suite.platform.Config().TeamSettings.RestrictCreationToDomains
		defer func() {
			th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
				cfg.TeamSettings.RestrictCreationToDomains = &enableGuestDomainRestrictions
			})
		}()
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "restricted.com" })
		invitationEmail := strings.ToLower(model.NewId()) + "other-email@test.com"
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail, "channels": th.BasicChannel.Id}),
		)
		require.NoError(t, th.Suite.platform.Store.Token().Save(token))
		guest := model.User{
			Email:       invitationEmail,
			Nickname:    "Darth Vader",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		newGuest, err := th.Suite.CreateUserWithToken(th.Context, &guest, token)
		require.Nil(t, err)
		assert.True(t, newGuest.IsGuest())
		assert.Equal(t, invitationEmail, newGuest.Email, "The user email must be the invitation one")
		_, nErr := th.Suite.platform.Store.Token().GetByToken(token.Token)
		require.Error(t, nErr)

		members, err := th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, newGuest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})
}

func TestPermanentDeleteUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	b := []byte("testimage")

	finfo, err := th.Suite.DoUploadFile(th.Context, time.Now(), th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "testfile.txt", b)

	require.Nil(t, err, "Unable to upload file. err=%v", err)

	// upload profile image
	user := th.BasicUser

	err = th.Suite.SetDefaultProfileImage(th.Context, user)
	require.Nil(t, err)

	bot, err := th.Suite.CreateBot(th.Context, &model.Bot{
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
	retUser1, err := th.Suite.GetUser(bot.UserId)
	assert.Nil(t, err)

	err = th.Suite.PermanentDeleteUser(th.Context, retUser1)
	assert.Nil(t, err)

	err1 = sqlStore.GetMasterX().Select(&bots2, "SELECT * FROM Bots")
	assert.NoError(t, err1)
	assert.Equal(t, 0, len(bots2))

	err = th.Suite.PermanentDeleteUser(th.Context, th.BasicUser)
	require.Nil(t, err, "Unable to delete user. err=%v", err)

	res, err := th.Suite.FileExists(finfo.Path)

	require.Nil(t, err, "Unable to check whether file exists. err=%v", err)

	require.False(t, res, "File was not deleted on FS. err=%v", err)

	finfo, err = th.Suite.GetFileInfo(finfo.Id)

	require.Nil(t, finfo, "Unable to find finfo. err=%v", err)

	require.NotNil(t, err, "GetFileInfo after DeleteUser is nil. err=%v", err)

	// test deletion of profile picture
	exists, err := th.Suite.FileExists(filepath.Join("users", user.Id))
	require.Nil(t, err, "Unable to stat finfo. err=%v", err)
	require.False(t, exists, "Profile image wasn't deleted. err=%v", err)
}

func TestPasswordRecovery(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("password token with same email as during creation", func(t *testing.T) {
		token, err := th.Suite.CreatePasswordRecoveryToken(th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		tokenData := struct {
			UserId string
			Email  string
		}{}

		err2 := json.Unmarshal([]byte(token.Extra), &tokenData)
		assert.NoError(t, err2)
		assert.Equal(t, th.BasicUser.Id, tokenData.UserId)
		assert.Equal(t, th.BasicUser.Email, tokenData.Email)

		err = th.Suite.ResetPasswordFromToken(th.Context, token.Token, "abcdefgh")
		assert.Nil(t, err)
	})

	t.Run("password token with modified email as during creation", func(t *testing.T) {
		token, err := th.Suite.CreatePasswordRecoveryToken(th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		th.Suite.platform.UpdateConfig(func(c *model.Config) {
			*c.EmailSettings.RequireEmailVerification = false
		})

		th.BasicUser.Email = th.MakeEmail()
		_, err = th.Suite.UpdateUser(th.Context, th.BasicUser, false)
		assert.Nil(t, err)

		err = th.Suite.ResetPasswordFromToken(th.Context, token.Token, "abcdefgh")
		assert.NotNil(t, err)
	})

	t.Run("non-expired token", func(t *testing.T) {
		token, err := th.Suite.CreatePasswordRecoveryToken(th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		err = th.Suite.resetPasswordFromToken(th.Context, token.Token, "abcdefgh", model.GetMillis())
		assert.Nil(t, err)
	})

	t.Run("expired token", func(t *testing.T) {
		token, err := th.Suite.CreatePasswordRecoveryToken(th.BasicUser.Id, th.BasicUser.Email)
		assert.Nil(t, err)

		err = th.Suite.resetPasswordFromToken(th.Context, token.Token, "abcdefgh", model.GetMillisForTime(time.Now().Add(25*time.Hour)))
		assert.NotNil(t, err)
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

	th.Suite.UpdateTeamMemberRoles(team1.Id, user1.Id, "team_user team_admin")

	team1channel1 := th.CreateChannel(th.Context, team1)
	team1channel2 := th.CreateChannel(th.Context, team1)
	th.CreateChannel(th.Context, team1) // Another channel
	team1offtopic, err := th.Suite.channels.GetChannelByName(th.Context, "off-topic", team1.Id, false)
	require.Nil(t, err)
	team1townsquare, err := th.Suite.channels.GetChannelByName(th.Context, "town-square", team1.Id, false)
	require.Nil(t, err)

	team2channel1 := th.CreateChannel(th.Context, team2)
	th.CreateChannel(th.Context, team2) // Another channel
	team2offtopic, err := th.Suite.channels.GetChannelByName(th.Context, "off-topic", team2.Id, false)
	require.Nil(t, err)
	team2townsquare, err := th.Suite.channels.GetChannelByName(th.Context, "town-square", team2.Id, false)
	require.Nil(t, err)

	th.Suite.channels.AddUserToChannel(th.Context, user1, team1channel1, false)
	th.Suite.channels.AddUserToChannel(th.Context, user1, team1channel2, false)
	th.Suite.channels.AddUserToChannel(th.Context, user1, team2channel1, false)

	addPermission := func(role *model.Role, permission string) *model.AppError {
		newPermissions := append(role.Permissions, permission)
		_, err := th.Suite.PatchRole(role, &model.RolePatch{Permissions: &newPermissions})
		return err
	}

	removePermission := func(role *model.Role, permission string) *model.AppError {
		newPermissions := []string{}
		for _, oldPermission := range role.Permissions {
			if permission != oldPermission {
				newPermissions = append(newPermissions, oldPermission)
			}
		}
		_, err := th.Suite.PatchRole(role, &model.RolePatch{Permissions: &newPermissions})
		return err
	}

	t.Run("VIEW_MEMBERS permission granted at system level", func(t *testing.T) {
		restrictions, err := th.Suite.GetViewUsersRestrictions(user1.Id)
		require.Nil(t, err)

		assert.Nil(t, restrictions)
	})

	t.Run("VIEW_MEMBERS permission granted at team level", func(t *testing.T) {
		systemUserRole, err := th.Suite.GetRoleByName(context.Background(), model.SystemUserRoleId)
		require.Nil(t, err)
		teamUserRole, err := th.Suite.GetRoleByName(context.Background(), model.TeamUserRoleId)
		require.Nil(t, err)

		require.Nil(t, removePermission(systemUserRole, model.PermissionViewMembers.Id))
		defer addPermission(systemUserRole, model.PermissionViewMembers.Id)
		require.Nil(t, addPermission(teamUserRole, model.PermissionViewMembers.Id))
		defer removePermission(teamUserRole, model.PermissionViewMembers.Id)

		restrictions, err := th.Suite.GetViewUsersRestrictions(user1.Id)
		require.Nil(t, err)

		assert.NotNil(t, restrictions)
		assert.NotNil(t, restrictions.Teams)
		assert.NotNil(t, restrictions.Channels)
		assert.ElementsMatch(t, []string{team1townsquare.Id, team1offtopic.Id, team1channel1.Id, team1channel2.Id, team2townsquare.Id, team2offtopic.Id, team2channel1.Id}, restrictions.Channels)
		assert.ElementsMatch(t, []string{team1.Id, team2.Id}, restrictions.Teams)
	})

	t.Run("VIEW_MEMBERS permission not granted at any level", func(t *testing.T) {
		systemUserRole, err := th.Suite.GetRoleByName(context.Background(), model.SystemUserRoleId)
		require.Nil(t, err)
		require.Nil(t, removePermission(systemUserRole, model.PermissionViewMembers.Id))
		defer addPermission(systemUserRole, model.PermissionViewMembers.Id)

		restrictions, err := th.Suite.GetViewUsersRestrictions(user1.Id)
		require.Nil(t, err)

		assert.NotNil(t, restrictions)
		assert.Empty(t, restrictions.Teams)
		assert.NotNil(t, restrictions.Channels)
		assert.ElementsMatch(t, []string{team1townsquare.Id, team1offtopic.Id, team1channel1.Id, team1channel2.Id, team2townsquare.Id, team2offtopic.Id, team2channel1.Id}, restrictions.Channels)
	})

	t.Run("VIEW_MEMBERS permission for some teams but not for others", func(t *testing.T) {
		systemUserRole, err := th.Suite.GetRoleByName(context.Background(), model.SystemUserRoleId)
		require.Nil(t, err)
		teamAdminRole, err := th.Suite.GetRoleByName(context.Background(), model.TeamAdminRoleId)
		require.Nil(t, err)

		require.Nil(t, removePermission(systemUserRole, model.PermissionViewMembers.Id))
		defer addPermission(systemUserRole, model.PermissionViewMembers.Id)
		require.Nil(t, addPermission(teamAdminRole, model.PermissionViewMembers.Id))
		defer removePermission(teamAdminRole, model.PermissionViewMembers.Id)

		restrictions, err := th.Suite.GetViewUsersRestrictions(user1.Id)
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
		err := th.Suite.PromoteGuestToUser(th.Context, th.BasicUser, th.BasicUser.Id)
		require.Nil(t, err)

		user, err := th.Suite.GetUser(th.BasicUser.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", user.Roles)
	})

	t.Run("Must work with guest user without teams or channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)

		err := th.Suite.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.Suite.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
	})

	t.Run("Must work with guest user with teams but no channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		err = th.Suite.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.Suite.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
		teamMember, err = th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
	})

	t.Run("Must work with guest user with teams and channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		channelMember := th.AddUserToChannel(guest, th.BasicChannel)
		require.True(t, channelMember.SchemeGuest)
		require.False(t, channelMember.SchemeUser)

		err = th.Suite.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.Suite.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
		teamMember, err = th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
		_, err = th.Suite.channels.GetChannelMember(th.Context, th.BasicChannel.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
	})

	t.Run("Must add the default channels", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		channelMember := th.AddUserToChannel(guest, th.BasicChannel)
		require.True(t, channelMember.SchemeGuest)
		require.False(t, channelMember.SchemeUser)

		channelMembers, err := th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.Len(t, channelMembers, 1)

		err = th.Suite.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)
		guest, err = th.Suite.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_user", guest.Roles)
		teamMember, err = th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)
		_, err = th.Suite.channels.GetChannelMember(th.Context, th.BasicChannel.Id, guest.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeGuest)
		assert.True(t, teamMember.SchemeUser)

		channelMembers, err = th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		assert.Len(t, channelMembers, 3)
	})

	t.Run("Must invalidate channel stats cache when promoting a guest", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		th.LinkUserToTeam(guest, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, guest.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeGuest)
		require.False(t, teamMember.SchemeUser)

		guestCount, _ := th.Suite.channels.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)

		channelMember := th.AddUserToChannel(guest, th.BasicChannel)
		require.True(t, channelMember.SchemeGuest)
		require.False(t, channelMember.SchemeUser)

		guestCount, _ = th.Suite.channels.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(1), guestCount)

		err = th.Suite.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)

		guestCount, _ = th.Suite.channels.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
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
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		guestCount, _ := th.Suite.channels.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)

		channelMember := th.AddUserToChannel(user, th.BasicChannel)
		require.True(t, channelMember.SchemeUser)
		require.False(t, channelMember.SchemeGuest)

		guestCount, _ = th.Suite.channels.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(0), guestCount)

		err = th.Suite.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)

		guestCount, _ = th.Suite.channels.GetChannelGuestCount(th.Context, th.BasicChannel.Id)
		require.Equal(t, int64(1), guestCount)
	})

	t.Run("Must fail with guest user", func(t *testing.T) {
		guest := th.CreateGuest()
		require.Equal(t, "system_guest", guest.Roles)
		err := th.Suite.DemoteUserToGuest(th.Context, guest)
		require.Nil(t, err)

		user, err := th.Suite.GetUser(guest.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
	})

	t.Run("Must work with user without teams or channels", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)

		err := th.Suite.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.Suite.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
	})

	t.Run("Must work with user with teams but no channels", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		err = th.Suite.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.Suite.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
		teamMember, err = th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
	})

	t.Run("Must work with user with teams and channels", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		channelMember := th.AddUserToChannel(user, th.BasicChannel)
		require.True(t, channelMember.SchemeUser)
		require.False(t, channelMember.SchemeGuest)

		err = th.Suite.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.Suite.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
		teamMember, err = th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
		_, err = th.Suite.channels.GetChannelMember(th.Context, th.BasicChannel.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
	})

	t.Run("Must respect the current channels not removing defaults", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)
		th.LinkUserToTeam(user, th.BasicTeam)
		teamMember, err := th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.False(t, teamMember.SchemeGuest)

		channelMember := th.AddUserToChannel(user, th.BasicChannel)
		require.True(t, channelMember.SchemeUser)
		require.False(t, channelMember.SchemeGuest)

		channelMembers, err := th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		require.Len(t, channelMembers, 3)

		err = th.Suite.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)
		user, err = th.Suite.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)
		teamMember, err = th.Suite.GetTeamMember(th.BasicTeam.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
		_, err = th.Suite.channels.GetChannelMember(th.Context, th.BasicChannel.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)

		channelMembers, err = th.Suite.channels.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, user.Id)
		require.Nil(t, err)
		assert.Len(t, channelMembers, 3)
	})

	t.Run("Must be removed as team and channel admin", func(t *testing.T) {
		user := th.CreateUser()
		require.Equal(t, "system_user", user.Roles)

		team := th.CreateTeam()

		th.LinkUserToTeam(user, team)
		th.Suite.UpdateTeamMemberRoles(team.Id, user.Id, "team_user team_admin")

		teamMember, err := th.Suite.GetTeamMember(team.Id, user.Id)
		require.Nil(t, err)
		require.True(t, teamMember.SchemeUser)
		require.True(t, teamMember.SchemeAdmin)
		require.False(t, teamMember.SchemeGuest)

		channel := th.CreateChannel(th.Context, team)

		th.AddUserToChannel(user, channel)
		th.Suite.channels.UpdateChannelMemberSchemeRoles(th.Context, channel.Id, user.Id, false, true, true)

		channelMember, err := th.Suite.channels.GetChannelMember(th.Context, channel.Id, user.Id)
		assert.Nil(t, err)
		assert.True(t, channelMember.SchemeUser)
		assert.True(t, channelMember.SchemeAdmin)
		assert.False(t, channelMember.SchemeGuest)

		err = th.Suite.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)

		user, err = th.Suite.GetUser(user.Id)
		assert.Nil(t, err)
		assert.Equal(t, "system_guest", user.Roles)

		teamMember, err = th.Suite.GetTeamMember(team.Id, user.Id)
		assert.Nil(t, err)
		assert.False(t, teamMember.SchemeUser)
		assert.False(t, teamMember.SchemeAdmin)
		assert.True(t, teamMember.SchemeGuest)

		channelMember, err = th.Suite.channels.GetChannelMember(th.Context, channel.Id, user.Id)
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

	err := th.Suite.DeactivateGuests(th.Context)
	require.Nil(t, err)

	guest1, err = th.Suite.GetUser(guest1.Id)
	assert.Nil(t, err)
	assert.NotEqual(t, int64(0), guest1.DeleteAt)

	guest2, err = th.Suite.GetUser(guest2.Id)
	assert.Nil(t, err)
	assert.NotEqual(t, int64(0), guest2.DeleteAt)

	user, err = th.Suite.GetUser(user.Id)
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
	user, err := th.Suite.UpdateUserRolesWithUser(th.Context, user, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(t, err)
	assert.Equal(t, user.Roles, model.SystemUserRoleId+" "+model.SystemAdminRoleId)

	// Test bad role.
	_, err = th.Suite.UpdateUserRolesWithUser(th.Context, user, "does not exist", false)
	require.NotNil(t, err)
}

func TestDeactivateMfa(t *testing.T) {
	t.Run("MFA is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Suite.platform.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableMultifactorAuthentication = false
		})

		user := th.BasicUser
		err := th.Suite.DeactivateMfa(user.Id)
		require.Nil(t, err)
	})
}

func TestPatchUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testUser := th.CreateUser()
	defer th.Suite.PermanentDeleteUser(th.Context, testUser)

	t.Run("Patch with a username already exists", func(t *testing.T) {
		_, err := th.Suite.PatchUser(th.Context, testUser.Id, &model.UserPatch{
			Username: model.NewString(th.BasicUser.Username),
		}, true)

		require.NotNil(t, err)
		require.Equal(t, "app.user.save.username_exists.app_error", err.Id)
	})

	t.Run("Patch with a email already exists", func(t *testing.T) {
		_, err := th.Suite.PatchUser(th.Context, testUser.Id, &model.UserPatch{
			Email: model.NewString(th.BasicUser.Email),
		}, true)

		require.NotNil(t, err)
		require.Equal(t, "app.user.save.email_exists.app_error", err.Id)
	})

	t.Run("Patch username with a new username", func(t *testing.T) {
		_, err := th.Suite.PatchUser(th.Context, testUser.Id, &model.UserPatch{
			Username: model.NewString(model.NewId()),
		}, true)

		require.Nil(t, err)
	})
}

func TestCreateUserWithInitialPreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("successfully create a user with initial tutorial and recommended steps preferences", func(t *testing.T) {
		testUser := th.CreateUser()
		defer th.Suite.PermanentDeleteUser(th.Context, testUser)

		insightsPref, appErr := th.Suite.GetPreferenceByCategoryAndNameForUser(testUser.Id, model.PreferenceCategoryInsights, model.PreferenceNameInsights)
		require.Nil(t, appErr)
		assert.Equal(t, "insights_tutorial_state", insightsPref.Name)
		assert.Equal(t, "{\"insights_modal_viewed\":true}", insightsPref.Value)

		tutorialStepPref, appErr := th.Suite.GetPreferenceByCategoryAndNameForUser(testUser.Id, model.PreferenceCategoryTutorialSteps, testUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, testUser.Id, tutorialStepPref.Name)

		recommendedNextStepsPref, appErr := th.Suite.GetPreferenceByCategoryForUser(testUser.Id, model.PreferenceRecommendedNextSteps)
		require.Nil(t, appErr)
		assert.Equal(t, model.PreferenceRecommendedNextSteps, recommendedNextStepsPref[0].Category)
		assert.Equal(t, "hide", recommendedNextStepsPref[0].Name)
		assert.Equal(t, "false", recommendedNextStepsPref[0].Value)
	})

	t.Run("successfully create a user with insights feature flag disabled", func(t *testing.T) {
		th.Suite.platform.SetConfigReadOnlyFF(false)
		defer th.Suite.platform.SetConfigReadOnlyFF(true)
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = false })
		defer th.Suite.platform.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
		testUser := th.CreateUser()
		defer th.Suite.PermanentDeleteUser(th.Context, testUser)

		insightsPref, appErr := th.Suite.GetPreferenceByCategoryAndNameForUser(testUser.Id, model.PreferenceCategoryInsights, model.PreferenceNameInsights)
		require.Nil(t, appErr)
		assert.Equal(t, "insights_tutorial_state", insightsPref.Name)
		assert.Equal(t, "{\"insights_modal_viewed\":false}", insightsPref.Value)

		recommendedNextStepsPref, appErr := th.Suite.GetPreferenceByCategoryForUser(testUser.Id, model.PreferenceRecommendedNextSteps)
		require.Nil(t, appErr)
		assert.Equal(t, model.PreferenceRecommendedNextSteps, recommendedNextStepsPref[0].Category)
		assert.Equal(t, "hide", recommendedNextStepsPref[0].Name)
		assert.Equal(t, "false", recommendedNextStepsPref[0].Value)
	})

	t.Run("successfully create a guest user with initial tutorial, insights and recommended steps preferences", func(t *testing.T) {
		th.Suite.platform.SetConfigReadOnlyFF(false)
		defer th.Suite.platform.SetConfigReadOnlyFF(true)
		th.Suite.platform.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.InsightsEnabled = true })
		testUser := th.CreateGuest()
		defer th.Suite.PermanentDeleteUser(th.Context, testUser)

		insightsPref, appErr := th.Suite.GetPreferenceByCategoryAndNameForUser(testUser.Id, model.PreferenceCategoryInsights, model.PreferenceNameInsights)
		require.Nil(t, appErr)
		assert.Equal(t, "insights_tutorial_state", insightsPref.Name)
		assert.Equal(t, "{\"insights_modal_viewed\":true}", insightsPref.Value)

		tutorialStepPref, appErr := th.Suite.GetPreferenceByCategoryAndNameForUser(testUser.Id, model.PreferenceCategoryTutorialSteps, testUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, testUser.Id, tutorialStepPref.Name)

		recommendedNextStepsPref, appErr := th.Suite.GetPreferenceByCategoryForUser(testUser.Id, model.PreferenceRecommendedNextSteps)
		require.Nil(t, appErr)
		assert.Equal(t, model.PreferenceRecommendedNextSteps, recommendedNextStepsPref[0].Category)
		assert.Equal(t, "hide", recommendedNextStepsPref[0].Name)
		assert.Equal(t, "false", recommendedNextStepsPref[0].Value)
	})
}
