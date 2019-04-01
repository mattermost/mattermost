// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/dgryski/dgoogauth"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/mailservice"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils/testutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

	ruser, resp := th.Client.CreateUser(&user)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	_, resp = th.Client.Login(user.Email, user.Password)
	session, _ := th.App.GetSession(th.Client.AuthToken)
	expectedCsrf := "MMCSRF=" + session.GetCSRF()
	actualCsrf := ""

	for _, cookie := range resp.Header["Set-Cookie"] {
		if strings.HasPrefix(cookie, "MMCSRF") {
			cookieParts := strings.Split(cookie, ";")
			actualCsrf = cookieParts[0]
			break
		}
	}

	if expectedCsrf != actualCsrf {
		t.Errorf("CSRF Mismatch - Expected %s, got %s", expectedCsrf, actualCsrf)
	}

	if ruser.Nickname != user.Nickname {
		t.Fatal("nickname didn't match")
	}

	if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
		t.Log(ruser.Roles)
		t.Fatal("did not clear roles")
	}

	CheckUserSanitization(t, ruser)

	_, resp = th.Client.CreateUser(ruser)
	CheckBadRequestStatus(t, resp)

	ruser.Id = ""
	ruser.Username = GenerateTestUsername()
	ruser.Password = "passwd1"
	_, resp = th.Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "store.sql_user.save.email_exists.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Email = th.GenerateTestEmail()
	ruser.Username = user.Username
	_, resp = th.Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "store.sql_user.save.username_exists.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Email = ""
	_, resp = th.Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "model.user.is_valid.email.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Username = "testinvalid+++"
	_, resp = th.Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "model.user.is_valid.username.app_error")
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

	user2 := &model.User{Email: th.GenerateTestEmail(), Password: "Password1", Username: GenerateTestUsername()}
	_, resp = th.SystemAdminClient.CreateUser(user2)
	CheckNoError(t, resp)

	r, err := th.Client.DoApiPost("/users", "garbage")
	require.NotNil(t, err, "should have errored")
	assert.Equal(t, http.StatusBadRequest, r.StatusCode)
}

func TestCreateUserWithToken(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	t.Run("CreateWithTokenHappyPath", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}
		token := model.NewToken(
			app.TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)

		ruser, resp := th.Client.CreateUserWithToken(&user, token.Token)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		if ruser.Nickname != user.Nickname {
			t.Fatal("nickname didn't match")
		}
		if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
			t.Log(ruser.Roles)
			t.Fatal("did not clear roles")
		}
		CheckUserSanitization(t, ruser)
		if result := <-th.App.Srv.Store.Token().GetByToken(token.Token); result.Err == nil {
			t.Fatal("The token must be deleted after be used")
		}

		if result := <-th.App.Srv.Store.Token().GetByToken(token.Token); result.Err == nil {
			t.Fatal("The token must be deleted after be used")
		}

		if teams, err := th.App.GetTeamsForUser(ruser.Id); err != nil || len(teams) == 0 {
			t.Fatal("The user must have teams")
		} else if teams[0].Id != th.BasicTeam.Id {
			t.Fatal("The user joined team must be the team provided.")
		}
	})

	t.Run("NoToken", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}
		token := model.NewToken(
			app.TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)

		_, resp := th.Client.CreateUserWithToken(&user, "")
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.missing_token.app_error")
	})

	t.Run("TokenExpired", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}
		timeNow := time.Now()
		past49Hours := timeNow.Add(-49*time.Hour).UnixNano() / int64(time.Millisecond)
		token := model.NewToken(
			app.TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		token.CreateAt = past49Hours
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)

		_, resp := th.Client.CreateUserWithToken(&user, token.Token)
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.signup_link_expired.app_error")
	})

	t.Run("WrongToken", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		_, resp := th.Client.CreateUserWithToken(&user, "wrong")
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.signup_link_invalid.app_error")
	})

	t.Run("EnableUserCreationDisable", func(t *testing.T) {

		enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })
		}()

		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		token := model.NewToken(
			app.TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

		_, resp := th.Client.CreateUserWithToken(&user, token.Token)
		CheckNotImplementedStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.signup_email_disabled.app_error")

	})

	t.Run("EnableOpenServerDisable", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		token := model.NewToken(
			app.TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)

		enableOpenServer := th.App.Config().TeamSettings.EnableOpenServer
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableOpenServer = enableOpenServer })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })

		ruser, resp := th.Client.CreateUserWithToken(&user, token.Token)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		if ruser.Nickname != user.Nickname {
			t.Fatal("nickname didn't match")
		}
		if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
			t.Log(ruser.Roles)
			t.Fatal("did not clear roles")
		}
		CheckUserSanitization(t, ruser)
		if result := <-th.App.Srv.Store.Token().GetByToken(token.Token); result.Err == nil {
			t.Fatal("The token must be deleted after be used")
		}
	})
}

func TestCreateUserWithInviteId(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	t.Run("CreateWithInviteIdHappyPath", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		inviteId := th.BasicTeam.InviteId

		ruser, resp := th.Client.CreateUserWithInviteId(&user, inviteId)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		if ruser.Nickname != user.Nickname {
			t.Fatal("nickname didn't match")
		}
		if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
			t.Log(ruser.Roles)
			t.Fatal("did not clear roles")
		}
		CheckUserSanitization(t, ruser)
	})

	t.Run("WrongInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		inviteId := model.NewId()

		_, resp := th.Client.CreateUserWithInviteId(&user, inviteId)
		CheckNotFoundStatus(t, resp)
		CheckErrorMessage(t, resp, "store.sql_team.get_by_invite_id.finding.app_error")
	})

	t.Run("NoInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		_, resp := th.Client.CreateUserWithInviteId(&user, "")
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.missing_invite_id.app_error")
	})

	t.Run("ExpiredInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		inviteId := th.BasicTeam.InviteId

		_, resp := th.SystemAdminClient.RegenerateTeamInviteId(th.BasicTeam.Id)
		CheckNoError(t, resp)

		_, resp = th.Client.CreateUserWithInviteId(&user, inviteId)
		CheckNotFoundStatus(t, resp)
		CheckErrorMessage(t, resp, "store.sql_team.get_by_invite_id.finding.app_error")
	})

	t.Run("EnableUserCreationDisable", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

		inviteId := th.BasicTeam.InviteId

		_, resp := th.Client.CreateUserWithInviteId(&user, inviteId)
		CheckNotImplementedStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.signup_email_disabled.app_error")
	})

	t.Run("EnableOpenServerDisable", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		enableOpenServer := th.App.Config().TeamSettings.EnableOpenServer
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableOpenServer = enableOpenServer })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })

		team, res := th.SystemAdminClient.RegenerateTeamInviteId(th.BasicTeam.Id)
		assert.Nil(t, res.Error)
		inviteId := team.InviteId

		ruser, resp := th.Client.CreateUserWithInviteId(&user, inviteId)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		if ruser.Nickname != user.Nickname {
			t.Fatal("nickname didn't match")
		}
		if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
			t.Log(ruser.Roles)
			t.Fatal("did not clear roles")
		}
		CheckUserSanitization(t, ruser)
	})

}

func TestGetMe(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	ruser, resp := th.Client.GetMe("")
	CheckNoError(t, resp)

	if ruser.Id != th.BasicUser.Id {
		t.Fatal("wrong user")
	}

	th.Client.Logout()
	_, resp = th.Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	user.Props = map[string]string{"testpropkey": "testpropvalue"}

	th.App.UpdateUser(user, false)

	ruser, resp := th.Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	assert.NotNil(t, ruser.Props)
	assert.Equal(t, ruser.Props["testpropkey"], "testpropvalue")
	require.False(t, ruser.IsBot)

	ruser, resp = th.Client.GetUser(user.Id, resp.Etag)
	CheckEtag(t, ruser, resp)

	_, resp = th.Client.GetUser("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetUser(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	ruser, resp = th.Client.GetUser(user.Id, "")
	CheckNoError(t, resp)

	if ruser.Email != "" {
		t.Fatal("email should be blank")
	}
	if ruser.FirstName != "" {
		t.Fatal("first name should be blank")
	}
	if ruser.LastName != "" {
		t.Fatal("last name should be blank")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUser(user.Id, "")
	CheckUnauthorizedStatus(t, resp)

	// System admins should ignore privacy settings
	ruser, _ = th.SystemAdminClient.GetUser(user.Id, resp.Etag)
	if ruser.Email == "" {
		t.Fatal("email should not be blank")
	}
	if ruser.FirstName == "" {
		t.Fatal("first name should not be blank")
	}
	if ruser.LastName == "" {
		t.Fatal("last name should not be blank")
	}
}

func TestGetUserWithAcceptedTermsOfServiceForOtherUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)

	th.App.UpdateUser(user, false)

	ruser, resp := th.Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	assert.Empty(t, ruser.TermsOfServiceId)

	th.App.SaveUserTermsOfService(user.Id, tos.Id, true)

	ruser, resp = th.Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	// user TOS data cannot be fetched for other users by non-admin users
	assert.Empty(t, ruser.TermsOfServiceId)
}

func TestGetUserWithAcceptedTermsOfService(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)

	ruser, resp := th.Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	assert.Empty(t, ruser.TermsOfServiceId)

	th.App.SaveUserTermsOfService(user.Id, tos.Id, true)

	ruser, resp = th.Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	// a user can view their own TOS details
	assert.Equal(t, tos.Id, ruser.TermsOfServiceId)
}

func TestGetUserWithAcceptedTermsOfServiceWithAdminUser(t *testing.T) {
	th := Setup().InitBasic()
	th.LoginSystemAdmin()
	defer th.TearDown()

	user := th.BasicUser

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)

	ruser, resp := th.SystemAdminClient.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	assert.Empty(t, ruser.TermsOfServiceId)

	th.App.SaveUserTermsOfService(user.Id, tos.Id, true)

	ruser, resp = th.SystemAdminClient.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	// admin can view anyone's TOS details
	assert.Equal(t, tos.Id, ruser.TermsOfServiceId)
}

func TestGetBotUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

	th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
	th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
	}

	createdBot, resp := th.Client.CreateBot(bot)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(createdBot.UserId)

	botUser, resp := th.Client.GetUser(createdBot.UserId, "")
	require.Equal(t, bot.Username, botUser.Username)
	require.True(t, botUser.IsBot)
}

func TestGetUserByUsername(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	ruser, resp := th.Client.GetUserByUsername(user.Username, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	ruser, resp = th.Client.GetUserByUsername(user.Username, resp.Etag)
	CheckEtag(t, ruser, resp)

	_, resp = th.Client.GetUserByUsername(GenerateTestUsername(), "")
	CheckNotFoundStatus(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	ruser, resp = th.Client.GetUserByUsername(th.BasicUser2.Username, "")
	CheckNoError(t, resp)

	if ruser.Email != "" {
		t.Fatal("email should be blank")
	}
	if ruser.FirstName != "" {
		t.Fatal("first name should be blank")
	}
	if ruser.LastName != "" {
		t.Fatal("last name should be blank")
	}

	ruser, resp = th.Client.GetUserByUsername(th.BasicUser.Username, "")
	CheckNoError(t, resp)
	if len(ruser.NotifyProps) == 0 {
		t.Fatal("notify props should be sent")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUserByUsername(user.Username, "")
	CheckUnauthorizedStatus(t, resp)

	// System admins should ignore privacy settings
	ruser, _ = th.SystemAdminClient.GetUserByUsername(user.Username, resp.Etag)
	if ruser.Email == "" {
		t.Fatal("email should not be blank")
	}
	if ruser.FirstName == "" {
		t.Fatal("first name should not be blank")
	}
	if ruser.LastName == "" {
		t.Fatal("last name should not be blank")
	}
}

func TestGetUserByUsernameWithAcceptedTermsOfService(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	ruser, resp := th.Client.GetUserByUsername(user.Username, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)
	th.App.SaveUserTermsOfService(ruser.Id, tos.Id, true)

	ruser, resp = th.Client.GetUserByUsername(user.Username, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	if ruser.TermsOfServiceId != tos.Id {
		t.Fatal("Terms of service ID didn't match")
	}
}

func TestGetUserByEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PrivacySettings.ShowEmailAddress = true
		*cfg.PrivacySettings.ShowFullName = true
	})

	t.Run("should be able to get another user by email", func(t *testing.T) {
		ruser, resp := th.Client.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		CheckUserSanitization(t, ruser)

		if ruser.Email != user.Email {
			t.Fatal("emails did not match")
		}
	})

	t.Run("should return not modified when provided with a matching etag", func(t *testing.T) {
		_, resp := th.Client.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)

		ruser, resp := th.Client.GetUserByEmail(user.Email, resp.Etag)
		CheckEtag(t, ruser, resp)
	})

	t.Run("should return bad request when given an invalid email", func(t *testing.T) {
		_, resp := th.Client.GetUserByEmail(GenerateTestUsername(), "")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("should return 404 when given a non-existent email", func(t *testing.T) {
		_, resp := th.Client.GetUserByEmail(th.GenerateTestEmail(), "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("should sanitize full name for non-admin based on privacy settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = true
			*cfg.PrivacySettings.ShowFullName = false
		})

		ruser, resp := th.Client.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.Equal(t, "", ruser.FirstName, "first name should be blank")
		assert.Equal(t, "", ruser.LastName, "last name should be blank")

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = true
		})

		ruser, resp = th.Client.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.NotEqual(t, "", ruser.FirstName, "first name should be set")
		assert.NotEqual(t, "", ruser.LastName, "last name should be set")
	})

	t.Run("should not sanitize full name for admin, regardless of privacy settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = true
			*cfg.PrivacySettings.ShowFullName = false
		})

		ruser, resp := th.SystemAdminClient.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.NotEqual(t, "", ruser.FirstName, "first name should be set")
		assert.NotEqual(t, "", ruser.LastName, "last name should be set")

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = true
		})

		ruser, resp = th.SystemAdminClient.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.NotEqual(t, "", ruser.FirstName, "first name should be set")
		assert.NotEqual(t, "", ruser.LastName, "last name should be set")
	})

	t.Run("should return forbidden for non-admin when privacy settings hide email", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = false
		})

		_, resp := th.Client.GetUserByEmail(user.Email, "")
		CheckForbiddenStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = true
		})

		ruser, resp := th.Client.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.Equal(t, user.Email, ruser.Email, "email should be set")
	})

	t.Run("should always return email for admin, regardless of privacy settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = false
		})

		ruser, resp := th.SystemAdminClient.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.Equal(t, user.Email, ruser.Email, "email should be set")

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = true
		})

		ruser, resp = th.SystemAdminClient.GetUserByEmail(user.Email, "")
		CheckNoError(t, resp)
		assert.Equal(t, user.Email, ruser.Email, "email should be set")
	})
}

func TestSearchUsers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	search := &model.UserSearch{Term: th.BasicUser.Username}

	users, resp := th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should have found user")
	}

	_, err := th.App.UpdateActive(th.BasicUser2, false)
	if err != nil {
		t.Fatal(err)
	}

	search.Term = th.BasicUser2.Username
	search.AllowInactive = false

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.AllowInactive = true

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should have found user")
	}

	search.Term = th.BasicUser.Username
	search.AllowInactive = false
	search.TeamId = th.BasicTeam.Id

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should have found user")
	}

	search.NotInChannelId = th.BasicChannel.Id

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should not have found user")
	}

	search.TeamId = ""
	search.NotInChannelId = ""
	search.InChannelId = th.BasicChannel.Id

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should have found user")
	}

	search.InChannelId = ""
	search.NotInChannelId = th.BasicChannel.Id
	_, resp = th.Client.SearchUsers(search)
	CheckBadRequestStatus(t, resp)

	search.NotInChannelId = model.NewId()
	search.TeamId = model.NewId()
	_, resp = th.Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	search.NotInChannelId = ""
	search.TeamId = model.NewId()
	_, resp = th.Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	search.InChannelId = model.NewId()
	search.TeamId = ""
	_, resp = th.Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	// Test search for users not in any team
	search.TeamId = ""
	search.NotInChannelId = ""
	search.InChannelId = ""
	search.NotInTeamId = th.BasicTeam.Id

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should not have found user")
	}

	oddUser := th.CreateUser()
	search.Term = oddUser.Username

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(oddUser.Id, users) {
		t.Fatal("should have found user")
	}

	_, resp = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, oddUser.Id)
	CheckNoError(t, resp)

	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(oddUser.Id, users) {
		t.Fatal("should not have found user")
	}

	search.NotInTeamId = model.NewId()
	_, resp = th.Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	search.Term = th.BasicUser.Username

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	_, err = th.App.UpdateActive(th.BasicUser2, true)
	if err != nil {
		t.Fatal(err)
	}

	search.InChannelId = ""
	search.NotInTeamId = ""
	search.Term = th.BasicUser2.Email
	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.Term = th.BasicUser2.FirstName
	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.Term = th.BasicUser2.LastName
	users, resp = th.Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.Term = th.BasicUser.FirstName
	search.InChannelId = th.BasicChannel.Id
	search.NotInChannelId = th.BasicChannel.Id
	search.TeamId = th.BasicTeam.Id
	users, resp = th.SystemAdminClient.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should have found user")
	}
}

func findUserInList(id string, users []*model.User) bool {
	for _, user := range users {
		if user.Id == id {
			return true
		}
	}
	return false
}

func TestAutocompleteUsers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id
	channelId := th.BasicChannel.Id
	username := th.BasicUser.Username

	rusers, resp := th.Client.AutocompleteUsersInChannel(teamId, channelId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if len(rusers.Users) != 1 {
		t.Fatal("should have returned 1 user")
	}

	rusers, resp = th.Client.AutocompleteUsersInChannel(teamId, channelId, "amazonses", model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)
	if len(rusers.Users) != 0 {
		t.Fatal("should have returned 0 users")
	}

	rusers, resp = th.Client.AutocompleteUsersInChannel(teamId, channelId, "", model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)
	if len(rusers.Users) < 2 {
		t.Fatal("should have many users")
	}

	rusers, resp = th.Client.AutocompleteUsersInChannel("", channelId, "", model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)
	if len(rusers.Users) < 2 {
		t.Fatal("should have many users")
	}

	rusers, resp = th.Client.AutocompleteUsersInTeam(teamId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if len(rusers.Users) != 1 {
		t.Fatal("should have returned 1 user")
	}

	rusers, resp = th.Client.AutocompleteUsers(username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if len(rusers.Users) != 1 {
		t.Fatal("should have returned 1 users")
	}

	rusers, resp = th.Client.AutocompleteUsers("", model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if len(rusers.Users) < 2 {
		t.Fatal("should have returned many users")
	}

	rusers, resp = th.Client.AutocompleteUsersInTeam(teamId, "amazonses", model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)
	if len(rusers.Users) != 0 {
		t.Fatal("should have returned 0 users")
	}

	rusers, resp = th.Client.AutocompleteUsersInTeam(teamId, "", model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)
	if len(rusers.Users) < 2 {
		t.Fatal("should have many users")
	}

	th.Client.Logout()
	_, resp = th.Client.AutocompleteUsersInChannel(teamId, channelId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.Client.AutocompleteUsersInTeam(teamId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.Client.AutocompleteUsers(username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp = th.Client.AutocompleteUsersInChannel(teamId, channelId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.AutocompleteUsersInTeam(teamId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.AutocompleteUsers(username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AutocompleteUsersInChannel(teamId, channelId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AutocompleteUsersInTeam(teamId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AutocompleteUsers(username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	th.LoginBasic()

	rusers, resp = th.Client.AutocompleteUsers(username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if rusers.Users[0].FirstName != "" || rusers.Users[0].LastName != "" {
		t.Fatal("should not show first/last name")
	}

	rusers, resp = th.Client.AutocompleteUsersInChannel(teamId, channelId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if rusers.Users[0].FirstName != "" || rusers.Users[0].LastName != "" {
		t.Fatal("should not show first/last name")
	}

	rusers, resp = th.Client.AutocompleteUsersInTeam(teamId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
	CheckNoError(t, resp)

	if rusers.Users[0].FirstName != "" || rusers.Users[0].LastName != "" {
		t.Fatal("should not show first/last name")
	}

	t.Run("user must have access to team id, especially when it does not match channel's team id", func(t *testing.T) {
		rusers, resp = th.Client.AutocompleteUsersInChannel("otherTeamId", channelId, username, model.USER_SEARCH_DEFAULT_LIMIT, "")
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})
}

func TestGetProfileImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	data, resp := th.Client.GetProfileImage(user.Id, "")
	CheckNoError(t, resp)
	if len(data) == 0 {
		t.Fatal("Should not be empty")
	}

	_, resp = th.Client.GetProfileImage(user.Id, resp.Etag)
	if resp.StatusCode == http.StatusNotModified {
		t.Fatal("Shouldn't have hit etag")
	}

	_, resp = th.Client.GetProfileImage("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetProfileImage(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.GetProfileImage(user.Id, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetProfileImage(user.Id, "")
	CheckNoError(t, resp)

	info := &model.FileInfo{Path: "/users/" + user.Id + "/profile.png"}
	if err := th.cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}
}

func TestGetUsersByIds(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	users, resp := th.Client.GetUsersByIds([]string{th.BasicUser.Id})
	CheckNoError(t, resp)

	if users[0].Id != th.BasicUser.Id {
		t.Fatal("returned wrong user")
	}
	CheckUserSanitization(t, users[0])

	_, resp = th.Client.GetUsersByIds([]string{})
	CheckBadRequestStatus(t, resp)

	users, resp = th.Client.GetUsersByIds([]string{"junk"})
	CheckNoError(t, resp)
	if len(users) > 0 {
		t.Fatal("no users should be returned")
	}

	users, resp = th.Client.GetUsersByIds([]string{"junk", th.BasicUser.Id})
	CheckNoError(t, resp)
	if len(users) != 1 {
		t.Fatal("1 user should be returned")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUsersByIds([]string{th.BasicUser.Id})
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUsersByUsernames(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	users, resp := th.Client.GetUsersByUsernames([]string{th.BasicUser.Username})
	CheckNoError(t, resp)

	if users[0].Id != th.BasicUser.Id {
		t.Fatal("returned wrong user")
	}
	CheckUserSanitization(t, users[0])

	_, resp = th.Client.GetUsersByIds([]string{})
	CheckBadRequestStatus(t, resp)

	users, resp = th.Client.GetUsersByUsernames([]string{"junk"})
	CheckNoError(t, resp)
	if len(users) > 0 {
		t.Fatal("no users should be returned")
	}

	users, resp = th.Client.GetUsersByUsernames([]string{"junk", th.BasicUser.Username})
	CheckNoError(t, resp)
	if len(users) != 1 {
		t.Fatal("1 user should be returned")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUsersByUsernames([]string{th.BasicUser.Username})
	CheckUnauthorizedStatus(t, resp)
}

func TestGetTotalUsersStat(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	total := <-th.Server.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     false,
		IncludeBotAccounts: true,
	})

	rstats, resp := th.Client.GetTotalUsersStats("")
	CheckNoError(t, resp)

	if rstats.TotalUsersCount != total.Data.(int64) {
		t.Fatal("wrong count")
	}
}

func TestUpdateUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)

	user.Nickname = "Joram Wilander"
	user.Roles = model.SYSTEM_ADMIN_ROLE_ID
	user.LastPasswordUpdate = 123

	ruser, resp := th.Client.UpdateUser(user)
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Nickname != "Joram Wilander" {
		t.Fatal("Nickname did not update properly")
	}
	if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
		t.Fatal("Roles should not have updated")
	}
	if ruser.LastPasswordUpdate == 123 {
		t.Fatal("LastPasswordUpdate should not have updated")
	}

	ruser.Email = th.GenerateTestEmail()
	_, resp = th.Client.UpdateUser(ruser)
	CheckBadRequestStatus(t, resp)

	ruser.Password = user.Password
	ruser, resp = th.Client.UpdateUser(ruser)
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	ruser.Id = "junk"
	_, resp = th.Client.UpdateUser(ruser)
	CheckBadRequestStatus(t, resp)

	ruser.Id = model.NewId()
	_, resp = th.Client.UpdateUser(ruser)
	CheckForbiddenStatus(t, resp)

	if r, err := th.Client.DoApiPut("/users/"+ruser.Id, "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	ruser.Id = user.Id
	ruser.Email = th.GenerateTestEmail()
	_, resp = th.Client.UpdateUser(ruser)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.UpdateUser(user)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp = th.Client.UpdateUser(user)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UpdateUser(user)
	CheckNoError(t, resp)
}

func TestPatchUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)

	patch := &model.UserPatch{}
	patch.Password = model.NewString("testpassword")
	patch.Nickname = model.NewString("Joram Wilander")
	patch.FirstName = model.NewString("Joram")
	patch.LastName = model.NewString("Wilander")
	patch.Position = new(string)
	patch.NotifyProps = model.StringMap{}
	patch.NotifyProps["comment"] = "somethingrandom"
	patch.Timezone = model.StringMap{}
	patch.Timezone["useAutomaticTimezone"] = "true"
	patch.Timezone["automaticTimezone"] = "America/New_York"
	patch.Timezone["manualTimezone"] = ""

	ruser, resp := th.Client.PatchUser(user.Id, patch)
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Nickname != "Joram Wilander" {
		t.Fatal("Nickname did not update properly")
	}
	if ruser.FirstName != "Joram" {
		t.Fatal("FirstName did not update properly")
	}
	if ruser.LastName != "Wilander" {
		t.Fatal("LastName did not update properly")
	}
	if ruser.Position != "" {
		t.Fatal("Position did not update properly")
	}
	if ruser.Username != user.Username {
		t.Fatal("Username should not have updated")
	}
	if ruser.Password != "" {
		t.Fatal("Password should not be returned")
	}
	if ruser.NotifyProps["comment"] != "somethingrandom" {
		t.Fatal("NotifyProps did not update properly")
	}
	if ruser.Timezone["useAutomaticTimezone"] != "true" {
		t.Fatal("useAutomaticTimezone did not update properly")
	}
	if ruser.Timezone["automaticTimezone"] != "America/New_York" {
		t.Fatal("automaticTimezone did not update properly")
	}
	if ruser.Timezone["manualTimezone"] != "" {
		t.Fatal("manualTimezone did not update properly")
	}

	err := th.App.CheckPasswordAndAllCriteria(ruser, *patch.Password, "")
	assert.Error(t, err, "Password should not match")

	currentPassword := user.Password
	user, err = th.App.GetUser(ruser.Id)
	if err != nil {
		t.Fatal("User Get shouldn't error")
	}

	err = th.App.CheckPasswordAndAllCriteria(user, currentPassword, "")
	if err != nil {
		t.Fatal("Password should still match")
	}

	patch = &model.UserPatch{}
	patch.Email = model.NewString(th.GenerateTestEmail())

	_, resp = th.Client.PatchUser(user.Id, patch)
	CheckBadRequestStatus(t, resp)

	patch.Password = model.NewString(currentPassword)
	ruser, resp = th.Client.PatchUser(user.Id, patch)
	CheckNoError(t, resp)

	if ruser.Email != *patch.Email {
		t.Fatal("Email did not update properly")
	}

	patch.Username = model.NewString(th.BasicUser2.Username)
	_, resp = th.Client.PatchUser(user.Id, patch)
	CheckBadRequestStatus(t, resp)

	patch.Username = nil

	_, resp = th.Client.PatchUser("junk", patch)
	CheckBadRequestStatus(t, resp)

	ruser.Id = model.NewId()
	_, resp = th.Client.PatchUser(model.NewId(), patch)
	CheckForbiddenStatus(t, resp)

	if r, err := th.Client.DoApiPut("/users/"+user.Id+"/patch", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	patch.Email = model.NewString(th.GenerateTestEmail())
	_, resp = th.Client.PatchUser(user.Id, patch)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.PatchUser(user.Id, patch)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp = th.Client.PatchUser(user.Id, patch)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.PatchUser(user.Id, patch)
	CheckNoError(t, resp)
}

func TestUpdateUserAuth(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	team := th.CreateTeamWithClient(th.SystemAdminClient)

	user := th.CreateUser()

	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id, user.Email))

	userAuth := &model.UserAuth{}
	userAuth.AuthData = user.AuthData
	userAuth.AuthService = user.AuthService
	userAuth.Password = user.Password

	// Regular user can not use endpoint
	if _, err := th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth); err == nil {
		t.Fatal("Shouldn't have permissions. Only Admins")
	}

	userAuth.AuthData = model.NewString("test@test.com")
	userAuth.AuthService = model.USER_AUTH_SERVICE_SAML
	userAuth.Password = "newpassword"
	ruser, resp := th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth)
	CheckNoError(t, resp)

	// AuthData and AuthService are set, password is set to empty
	if *ruser.AuthData != *userAuth.AuthData {
		t.Fatal("Should have set the correct AuthData")
	}
	if ruser.AuthService != model.USER_AUTH_SERVICE_SAML {
		t.Fatal("Should have set the correct AuthService")
	}
	if ruser.Password != "" {
		t.Fatal("Password should be empty")
	}

	// When AuthData or AuthService are empty, password must be valid
	userAuth.AuthData = user.AuthData
	userAuth.AuthService = ""
	userAuth.Password = "1"
	if _, err := th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth); err == nil {
		t.Fatal("Should have errored - user password not valid")
	}

	// Regular user can not use endpoint
	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id, user2.Email))

	th.SystemAdminClient.Login(user2.Email, "passwd1")

	userAuth.AuthData = user.AuthData
	userAuth.AuthService = user.AuthService
	userAuth.Password = user.Password
	if _, err := th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth); err == nil {
		t.Fatal("Should have errored")
	}
}

func TestDeleteUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	th.LoginBasic()

	testUser := th.SystemAdminUser
	_, resp := th.Client.DeleteUser(testUser.Id)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()

	_, resp = th.Client.DeleteUser(user.Id)
	CheckUnauthorizedStatus(t, resp)

	th.Client.Login(testUser.Email, testUser.Password)

	user.Id = model.NewId()
	_, resp = th.Client.DeleteUser(user.Id)
	CheckNotFoundStatus(t, resp)

	user.Id = "junk"
	_, resp = th.Client.DeleteUser(user.Id)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.DeleteUser(testUser.Id)
	CheckNoError(t, resp)

	selfDeleteUser := th.CreateUser()
	th.Client.Login(selfDeleteUser.Email, selfDeleteUser.Password)

	th.App.UpdateConfig(func(c *model.Config) {
		*c.TeamSettings.EnableUserDeactivation = false
	})
	_, resp = th.Client.DeleteUser(selfDeleteUser.Id)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(c *model.Config) {
		*c.TeamSettings.EnableUserDeactivation = true
	})
	_, resp = th.Client.DeleteUser(selfDeleteUser.Id)
	CheckNoError(t, resp)
}

func TestUpdateUserRoles(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.UpdateUserRoles(th.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.UpdateUserRoles(th.BasicUser.Id, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = th.SystemAdminClient.UpdateUserRoles("junk", model.SYSTEM_USER_ROLE_ID)
	CheckBadRequestStatus(t, resp)

	_, resp = th.SystemAdminClient.UpdateUserRoles(model.NewId(), model.SYSTEM_USER_ROLE_ID)
	CheckBadRequestStatus(t, resp)
}

func assertExpectedWebsocketEvent(t *testing.T, client *model.WebSocketClient, event string, test func(*model.WebSocketEvent)) {
	for {
		select {
		case resp, ok := <-client.EventChannel:
			if !ok {
				t.Fatalf("channel closed before receiving expected event %s", model.WEBSOCKET_EVENT_USER_UPDATED)
			} else if resp.Event == model.WEBSOCKET_EVENT_USER_UPDATED {
				test(resp)
				return
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("failed to receive expected event %s", model.WEBSOCKET_EVENT_USER_UPDATED)
		}
	}
}

func assertWebsocketEventUserUpdatedWithEmail(t *testing.T, client *model.WebSocketClient, email string) {
	assertExpectedWebsocketEvent(t, client, model.WEBSOCKET_EVENT_USER_UPDATED, func(event *model.WebSocketEvent) {
		if eventUser, ok := event.Data["user"].(map[string]interface{}); !ok {
			t.Fatalf("expected user")
		} else if userEmail, ok := eventUser["email"].(string); !ok {
			t.Fatalf("expected email %s, but got nil", email)
		} else {
			assert.Equal(t, email, userEmail)
		}
	})
}

func TestUpdateUserActive(t *testing.T) {
	t.Run("basic tests", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		user := th.BasicUser

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })
		pass, resp := th.Client.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)

		if !pass {
			t.Fatal("should have returned true")
		}

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = false })
		pass, resp = th.Client.UpdateUserActive(user.Id, false)
		CheckUnauthorizedStatus(t, resp)

		if pass {
			t.Fatal("should have returned false")
		}

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })
		pass, resp = th.Client.UpdateUserActive(user.Id, false)
		CheckUnauthorizedStatus(t, resp)

		if pass {
			t.Fatal("should have returned false")
		}

		th.LoginBasic2()

		_, resp = th.Client.UpdateUserActive(user.Id, true)
		CheckForbiddenStatus(t, resp)

		_, resp = th.Client.UpdateUserActive(GenerateTestId(), true)
		CheckForbiddenStatus(t, resp)

		_, resp = th.Client.UpdateUserActive("junk", true)
		CheckBadRequestStatus(t, resp)

		th.Client.Logout()

		_, resp = th.Client.UpdateUserActive(user.Id, true)
		CheckUnauthorizedStatus(t, resp)

		_, resp = th.SystemAdminClient.UpdateUserActive(user.Id, true)
		CheckNoError(t, resp)

		_, resp = th.SystemAdminClient.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)

		authData := model.NewId()
		result := <-th.App.Srv.Store.User().UpdateAuthData(user.Id, "random", &authData, "", true)
		require.Nil(t, result.Err)

		_, resp = th.SystemAdminClient.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)
	})

	t.Run("websocket events", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		user := th.BasicUser2

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })

		webSocketClient, err := th.CreateWebSocketClient()
		assert.Nil(t, err)
		defer webSocketClient.Close()

		webSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		if resp := <-webSocketClient.ResponseChannel; resp.Status != model.STATUS_OK {
			t.Fatal("should have responded OK to authentication challenge")
		}

		adminWebSocketClient, err := th.CreateWebSocketSystemAdminClient()
		assert.Nil(t, err)
		defer adminWebSocketClient.Close()

		adminWebSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		if resp := <-adminWebSocketClient.ResponseChannel; resp.Status != model.STATUS_OK {
			t.Fatal("should have responded OK to authentication challenge")
		}

		// Verify that both admins and regular users see the email when privacy settings allow same.
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = true })
		_, resp := th.SystemAdminClient.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)

		assertWebsocketEventUserUpdatedWithEmail(t, webSocketClient, user.Email)
		assertWebsocketEventUserUpdatedWithEmail(t, adminWebSocketClient, user.Email)

		// Verify that only admins see the email when privacy settings hide emails.
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
		_, resp = th.SystemAdminClient.UpdateUserActive(user.Id, true)
		CheckNoError(t, resp)

		assertWebsocketEventUserUpdatedWithEmail(t, webSocketClient, "")
		assertWebsocketEventUserUpdatedWithEmail(t, adminWebSocketClient, user.Email)
	})
}

func TestGetUsers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	rusers, resp := th.Client.GetUsers(0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = th.Client.GetUsers(0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, resp = th.Client.GetUsers(0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsers(1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsers(10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	// Check default params for page and per_page
	if _, err := th.Client.DoApiGet("/users", ""); err != nil {
		t.Fatal("should not have errored")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUsers(0, 60, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetNewUsersInTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	rusers, resp := th.Client.GetNewUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)

	lastCreateAt := model.GetMillis()
	for _, u := range rusers {
		if u.CreateAt > lastCreateAt {
			t.Fatal("bad sorting")
		}
		lastCreateAt = u.CreateAt
		CheckUserSanitization(t, u)
	}

	rusers, resp = th.Client.GetNewUsersInTeam(teamId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	th.Client.Logout()
	_, resp = th.Client.GetNewUsersInTeam(teamId, 1, 1, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetRecentlyActiveUsersInTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	th.App.SetStatusOnline(th.BasicUser.Id, true)

	rusers, resp := th.Client.GetRecentlyActiveUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)

	for _, u := range rusers {
		if u.LastActivityAt == 0 {
			t.Fatal("did not return last activity at")
		}
		CheckUserSanitization(t, u)
	}

	rusers, resp = th.Client.GetRecentlyActiveUsersInTeam(teamId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	th.Client.Logout()
	_, resp = th.Client.GetRecentlyActiveUsersInTeam(teamId, 0, 1, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUsersWithoutTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if _, resp := th.Client.GetUsersWithoutTeam(0, 100, ""); resp.Error == nil {
		t.Fatal("should prevent non-admin user from getting users without a team")
	}

	// These usernames need to appear in the first 100 users for this to work

	user, resp := th.Client.CreateUser(&model.User{
		Username: "a000000000" + model.NewId(),
		Email:    "success+" + model.NewId() + "@simulator.amazonses.com",
		Password: "Password1",
	})
	CheckNoError(t, resp)
	th.LinkUserToTeam(user, th.BasicTeam)
	defer th.App.Srv.Store.User().PermanentDelete(user.Id)

	user2, resp := th.Client.CreateUser(&model.User{
		Username: "a000000001" + model.NewId(),
		Email:    "success+" + model.NewId() + "@simulator.amazonses.com",
		Password: "Password1",
	})
	CheckNoError(t, resp)
	defer th.App.Srv.Store.User().PermanentDelete(user2.Id)

	rusers, resp := th.SystemAdminClient.GetUsersWithoutTeam(0, 100, "")
	CheckNoError(t, resp)

	found1 := false
	found2 := false

	for _, u := range rusers {
		if u.Id == user.Id {
			found1 = true
		} else if u.Id == user2.Id {
			found2 = true
		}
	}

	if found1 {
		t.Fatal("shouldn't have returned user that has a team")
	} else if !found2 {
		t.Fatal("should've returned user that has no teams")
	}
}

func TestGetUsersInTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	rusers, resp := th.Client.GetUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = th.Client.GetUsersInTeam(teamId, 0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, resp = th.Client.GetUsersInTeam(teamId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsersInTeam(teamId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsersInTeam(teamId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUsersInTeam(teamId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp = th.Client.GetUsersInTeam(teamId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetUsersNotInTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	rusers, resp := th.Client.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}
	require.Len(t, rusers, 1, "should be 1 user in total")

	rusers, resp = th.Client.GetUsersNotInTeam(teamId, 0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, resp = th.Client.GetUsersNotInTeam(teamId, 0, 1, "")
	CheckNoError(t, resp)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, resp = th.Client.GetUsersNotInTeam(teamId, 1, 1, "")
	CheckNoError(t, resp)
	require.Len(t, rusers, 0, "should be no users")

	rusers, resp = th.Client.GetUsersNotInTeam(teamId, 10000, 100, "")
	CheckNoError(t, resp)
	require.Len(t, rusers, 0, "should be no users")

	th.Client.Logout()
	_, resp = th.Client.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp = th.Client.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetUsersInChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	channelId := th.BasicChannel.Id

	rusers, resp := th.Client.GetUsersInChannel(channelId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = th.Client.GetUsersInChannel(channelId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsersInChannel(channelId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsersInChannel(channelId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUsersInChannel(channelId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp = th.Client.GetUsersInChannel(channelId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersInChannel(channelId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetUsersNotInChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id
	channelId := th.BasicChannel.Id

	user := th.CreateUser()
	th.LinkUserToTeam(user, th.BasicTeam)

	rusers, resp := th.Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = th.Client.GetUsersNotInChannel(teamId, channelId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Log(len(rusers))
		t.Fatal("should be 1 per page")
	}

	rusers, resp = th.Client.GetUsersNotInChannel(teamId, channelId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	th.Client.Logout()
	_, resp = th.Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	th.Client.Login(user.Email, user.Password)
	_, resp = th.Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestUpdateUserMfa(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	_, resp := th.Client.UpdateUserMfa(th.BasicUser.Id, "12345", false)
	CheckForbiddenStatus(t, resp)
}

// CheckUserMfa is deprecated and should not be used anymore, it will be disabled by default in version 6.0
func TestCheckUserMfa(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(c *model.Config) {
		*c.ServiceSettings.DisableLegacyMFA = false
	})

	required, resp := th.Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	_, resp = th.Client.CheckUserMfa("")
	CheckBadRequestStatus(t, resp)

	th.Client.Logout()

	required, resp = th.Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	th.App.SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	th.LoginBasic()

	required, resp = th.Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	th.Client.Logout()

	required, resp = th.Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	th.App.UpdateConfig(func(c *model.Config) {
		*c.ServiceSettings.DisableLegacyMFA = true
	})

	_, resp = th.Client.CheckUserMfa(th.BasicUser.Email)
	CheckNotFoundStatus(t, resp)
}

func TestUserLoginMFAFlow(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(c *model.Config) {
		*c.ServiceSettings.DisableLegacyMFA = true
		*c.ServiceSettings.EnableMultifactorAuthentication = true
	})

	secret, err := th.App.GenerateMfaSecret(th.BasicUser.Id)
	assert.Nil(t, err)

	t.Run("WithoutMFA", func(t *testing.T) {
		_, resp := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		CheckNoError(t, resp)
	})

	// Fake user has MFA enabled
	if result := <-th.Server.Store.User().UpdateMfaActive(th.BasicUser.Id, true); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-th.Server.Store.User().UpdateMfaSecret(th.BasicUser.Id, secret.Secret); result.Err != nil {
		t.Fatal(result.Err)
	}

	t.Run("WithInvalidMFA", func(t *testing.T) {
		user, resp := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		CheckErrorMessage(t, resp, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)

		user, resp = th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, "")
		CheckErrorMessage(t, resp, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)

		user, resp = th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, "abcdefgh")
		CheckErrorMessage(t, resp, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)

		secret2, err := th.App.GenerateMfaSecret(th.BasicUser2.Id)
		assert.Nil(t, err)
		user, resp = th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, secret2.Secret)
		CheckErrorMessage(t, resp, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)
	})

	t.Run("WithCorrectMFA", func(t *testing.T) {
		t.Skip("Skipping test that fails randomly.")
		code := dgoogauth.ComputeCode(secret.Secret, time.Now().UTC().Unix()/30)

		user, resp := th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, strconv.Itoa(code))
		CheckNoError(t, resp)
		assert.NotNil(t, user)
	})
}

func TestGenerateMfaSecret(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = false })

	_, resp := th.Client.GenerateMfaSecret(th.BasicUser.Id)
	CheckNotImplementedStatus(t, resp)

	_, resp = th.SystemAdminClient.GenerateMfaSecret(th.BasicUser.Id)
	CheckNotImplementedStatus(t, resp)

	_, resp = th.Client.GenerateMfaSecret("junk")
	CheckBadRequestStatus(t, resp)

	th.App.SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	_, resp = th.Client.GenerateMfaSecret(model.NewId())
	CheckForbiddenStatus(t, resp)

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	_, resp = th.Client.GenerateMfaSecret(th.BasicUser.Id)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()

	_, resp = th.Client.GenerateMfaSecret(th.BasicUser.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateUserPassword(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	password := "newpassword1"
	pass, resp := th.Client.UpdateUserPassword(th.BasicUser.Id, th.BasicUser.Password, password)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have returned true")
	}

	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, password, "")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, password, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.UpdateUserPassword("junk", password, password)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, "", password)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, "junk", password)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, password, th.BasicUser.Password)
	CheckNoError(t, resp)

	th.Client.Logout()
	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, password, password)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, password, password)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	// Test lockout
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 2 })

	// Fail twice
	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, "badpwd", "newpwd")
	CheckBadRequestStatus(t, resp)
	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, "badpwd", "newpwd")
	CheckBadRequestStatus(t, resp)

	// Should fail because account is locked out
	_, resp = th.Client.UpdateUserPassword(th.BasicUser.Id, th.BasicUser.Password, "newpwd")
	CheckErrorMessage(t, resp, "api.user.check_user_login_attempts.too_many.app_error")
	CheckUnauthorizedStatus(t, resp)

	// System admin can update another user's password
	adminSetPassword := "pwdsetbyadmin"
	pass, resp = th.SystemAdminClient.UpdateUserPassword(th.BasicUser.Id, "", adminSetPassword)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have returned true")
	}

	_, resp = th.Client.Login(th.BasicUser.Email, adminSetPassword)
	CheckNoError(t, resp)
}

func TestResetPassword(t *testing.T) {
	t.Skip("test disabled during old build server changes, should be investigated")

	th := Setup().InitBasic()
	defer th.TearDown()
	th.Client.Logout()
	user := th.BasicUser
	// Delete all the messages before check the reset password
	mailservice.DeleteMailBox(user.Email)
	success, resp := th.Client.SendPasswordResetEmail(user.Email)
	CheckNoError(t, resp)
	if !success {
		t.Fatal("should have succeeded")
	}
	_, resp = th.Client.SendPasswordResetEmail("")
	CheckBadRequestStatus(t, resp)
	// Should not leak whether the email is attached to an account or not
	success, resp = th.Client.SendPasswordResetEmail("notreal@example.com")
	CheckNoError(t, resp)
	if !success {
		t.Fatal("should have succeeded")
	}
	// Check if the email was send to the right email address and the recovery key match
	var resultsMailbox mailservice.JSONMessageHeaderInbucket
	err := mailservice.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = mailservice.GetMailBox(user.Email)
		return err
	})
	if err != nil {
		t.Log(err)
		t.Log("No email was received, maybe due load on the server. Disabling this verification")
	}
	var recoveryTokenString string
	if err == nil && len(resultsMailbox) > 0 {
		if !strings.ContainsAny(resultsMailbox[0].To[0], user.Email) {
			t.Fatal("Wrong To recipient")
		} else {
			if resultsEmail, err := mailservice.GetMessageFromMailbox(user.Email, resultsMailbox[0].ID); err == nil {
				loc := strings.Index(resultsEmail.Body.Text, "token=")
				if loc == -1 {
					t.Log(resultsEmail.Body.Text)
					t.Fatal("Code not found in email")
				}
				loc += 6
				recoveryTokenString = resultsEmail.Body.Text[loc : loc+model.TOKEN_SIZE]
			}
		}
	}
	var recoveryToken *model.Token
	if result := <-th.App.Srv.Store.Token().GetByToken(recoveryTokenString); result.Err != nil {
		t.Log(recoveryTokenString)
		t.Fatal(result.Err)
	} else {
		recoveryToken = result.Data.(*model.Token)
	}
	_, resp = th.Client.ResetPassword(recoveryToken.Token, "")
	CheckBadRequestStatus(t, resp)
	_, resp = th.Client.ResetPassword(recoveryToken.Token, "newp")
	CheckBadRequestStatus(t, resp)
	_, resp = th.Client.ResetPassword("", "newpwd")
	CheckBadRequestStatus(t, resp)
	_, resp = th.Client.ResetPassword("junk", "newpwd")
	CheckBadRequestStatus(t, resp)
	code := ""
	for i := 0; i < model.TOKEN_SIZE; i++ {
		code += "a"
	}
	_, resp = th.Client.ResetPassword(code, "newpwd")
	CheckBadRequestStatus(t, resp)
	success, resp = th.Client.ResetPassword(recoveryToken.Token, "newpwd")
	CheckNoError(t, resp)
	if !success {
		t.Fatal("should have succeeded")
	}
	th.Client.Login(user.Email, "newpwd")
	th.Client.Logout()
	_, resp = th.Client.ResetPassword(recoveryToken.Token, "newpwd")
	CheckBadRequestStatus(t, resp)
	authData := model.NewId()
	if result := <-th.App.Srv.Store.User().UpdateAuthData(user.Id, "random", &authData, "", true); result.Err != nil {
		t.Fatal(result.Err)
	}
	_, resp = th.Client.SendPasswordResetEmail(user.Email)
	CheckBadRequestStatus(t, resp)
}

func TestGetSessions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	th.Client.Login(user.Email, user.Password)

	sessions, resp := th.Client.GetSessions(user.Id, "")
	for _, session := range sessions {
		if session.UserId != user.Id {
			t.Fatal("user id does not match session user id")
		}
	}
	CheckNoError(t, resp)

	_, resp = th.Client.RevokeSession("junk", model.NewId())
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetSessions(th.BasicUser2.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.GetSessions(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.GetSessions(th.BasicUser2.Id, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetSessions(user.Id, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetSessions(th.BasicUser2.Id, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetSessions(model.NewId(), "")
	CheckNoError(t, resp)
}

func TestRevokeSessions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	th.Client.Login(user.Email, user.Password)
	sessions, _ := th.Client.GetSessions(user.Id, "")
	if len(sessions) == 0 {
		t.Fatal("sessions should exist")
	}
	for _, session := range sessions {
		if session.UserId != user.Id {
			t.Fatal("user id does not match session user id")
		}
	}
	session := sessions[0]

	_, resp := th.Client.RevokeSession(user.Id, model.NewId())
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.RevokeSession(th.BasicUser2.Id, model.NewId())
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.RevokeSession("junk", model.NewId())
	CheckBadRequestStatus(t, resp)

	status, resp := th.Client.RevokeSession(user.Id, session.Id)
	if !status {
		t.Fatal("user session revoke unsuccessful")
	}
	CheckNoError(t, resp)

	th.LoginBasic()

	sessions, _ = th.App.GetSessions(th.SystemAdminUser.Id)
	session = sessions[0]

	_, resp = th.Client.RevokeSession(user.Id, session.Id)
	CheckBadRequestStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.RevokeSession(user.Id, model.NewId())
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.RevokeSession(user.Id, model.NewId())
	CheckBadRequestStatus(t, resp)

	sessions, _ = th.SystemAdminClient.GetSessions(th.SystemAdminUser.Id, "")
	if len(sessions) == 0 {
		t.Fatal("sessions should exist")
	}
	for _, session := range sessions {
		if session.UserId != th.SystemAdminUser.Id {
			t.Fatal("user id does not match session user id")
		}
	}
	session = sessions[0]

	_, resp = th.SystemAdminClient.RevokeSession(th.SystemAdminUser.Id, session.Id)
	CheckNoError(t, resp)
}

func TestRevokeAllSessions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	th.Client.Login(user.Email, user.Password)

	_, resp := th.Client.RevokeAllSessions(th.BasicUser2.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.RevokeAllSessions("junk" + user.Id)
	CheckBadRequestStatus(t, resp)

	status, resp := th.Client.RevokeAllSessions(user.Id)
	if !status {
		t.Fatal("user all sessions revoke unsuccessful")
	}
	CheckNoError(t, resp)

	th.Client.Logout()
	_, resp = th.Client.RevokeAllSessions(user.Id)
	CheckUnauthorizedStatus(t, resp)

	th.Client.Login(user.Email, user.Password)

	sessions, _ := th.Client.GetSessions(user.Id, "")
	if len(sessions) < 1 {
		t.Fatal("session should exist")
	}

	_, resp = th.Client.RevokeAllSessions(user.Id)
	CheckNoError(t, resp)

	sessions, _ = th.SystemAdminClient.GetSessions(user.Id, "")
	if len(sessions) != 0 {
		t.Fatal("no sessions should exist for user")
	}

	_, resp = th.Client.RevokeAllSessions(user.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestAttachDeviceId(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	deviceId := model.PUSH_NOTIFY_APPLE + ":1234567890"
	pass, resp := th.Client.AttachDeviceId(deviceId)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	if sessions, err := th.App.GetSessions(th.BasicUser.Id); err != nil {
		t.Fatal(err)
	} else {
		if sessions[0].DeviceId != deviceId {
			t.Fatal("Missing device Id")
		}
	}

	_, resp = th.Client.AttachDeviceId("")
	CheckBadRequestStatus(t, resp)

	th.Client.Logout()

	_, resp = th.Client.AttachDeviceId("")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUserAudits(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	audits, resp := th.Client.GetUserAudits(user.Id, 0, 100, "")
	for _, audit := range audits {
		if audit.UserId != user.Id {
			t.Fatal("user id does not match audit user id")
		}
	}
	CheckNoError(t, resp)

	_, resp = th.Client.GetUserAudits(th.BasicUser2.Id, 0, 100, "")
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.GetUserAudits(user.Id, 0, 100, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUserAudits(user.Id, 0, 100, "")
	CheckNoError(t, resp)
}

func TestVerifyUserEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	email := th.GenerateTestEmail()
	user := model.User{Email: email, Nickname: "Darth Vader", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

	ruser, _ := th.Client.CreateUser(&user)

	token, err := th.App.CreateVerifyEmailToken(ruser.Id, email)
	if err != nil {
		t.Fatal("Unable to create email verify token")
	}

	_, resp := th.Client.VerifyUserEmail(token.Token)
	CheckNoError(t, resp)

	_, resp = th.Client.VerifyUserEmail(GenerateTestId())
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.VerifyUserEmail("")
	CheckBadRequestStatus(t, resp)
}

func TestSendVerificationEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	pass, resp := th.Client.SendVerificationEmail(th.BasicUser.Email)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	_, resp = th.Client.SendVerificationEmail("")
	CheckBadRequestStatus(t, resp)

	// Even non-existent emails should return 200 OK
	_, resp = th.Client.SendVerificationEmail(th.GenerateTestEmail())
	CheckNoError(t, resp)

	th.Client.Logout()
	_, resp = th.Client.SendVerificationEmail(th.BasicUser.Email)
	CheckNoError(t, resp)
}

func TestSetProfileImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	data, err := testutils.ReadTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	}

	ok, resp := th.Client.SetProfileImage(user.Id, data)
	if !ok {
		t.Fatal(resp.Error)
	}
	CheckNoError(t, resp)

	ok, resp = th.Client.SetProfileImage(model.NewId(), data)
	if ok {
		t.Fatal("Should return false, set profile image not allowed")
	}
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	th.Client.Logout()
	_, resp = th.Client.SetProfileImage(user.Id, data)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		t.Fatal("Should have failed either forbidden or unauthorized")
	}

	buser, err := th.App.GetUser(user.Id)
	require.Nil(t, err)

	_, resp = th.SystemAdminClient.SetProfileImage(user.Id, data)
	CheckNoError(t, resp)

	ruser, err := th.App.GetUser(user.Id)
	require.Nil(t, err)
	assert.True(t, buser.LastPictureUpdate < ruser.LastPictureUpdate, "Picture should have updated for user")

	info := &model.FileInfo{Path: "users/" + user.Id + "/profile.png"}
	if err := th.cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}
}

func TestSetDefaultProfileImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	ok, resp := th.Client.SetDefaultProfileImage(user.Id)
	if !ok {
		t.Fatal(resp.Error)
	}
	CheckNoError(t, resp)

	ok, resp = th.Client.SetDefaultProfileImage(model.NewId())
	if ok {
		t.Fatal("Should return false, set profile image not allowed")
	}
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetDefaultProfileImage when request is terminated early by server
	th.Client.Logout()
	_, resp = th.Client.SetDefaultProfileImage(user.Id)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		t.Fatal("Should have failed either forbidden or unauthorized")
	}

	_, resp = th.SystemAdminClient.SetDefaultProfileImage(user.Id)
	CheckNoError(t, resp)

	ruser, err := th.App.GetUser(user.Id)
	require.Nil(t, err)
	assert.Equal(t, int64(0), ruser.LastPictureUpdate, "Picture should have resetted to default")

	info := &model.FileInfo{Path: "users/" + user.Id + "/profile.png"}
	if err := th.cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}
}

func TestLogin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.Client.Logout()

	t.Run("missing password", func(t *testing.T) {
		_, resp := th.Client.Login(th.BasicUser.Email, "")
		CheckErrorMessage(t, resp, "api.user.login.blank_pwd.app_error")
	})

	t.Run("unknown user", func(t *testing.T) {
		_, resp := th.Client.Login("unknown", th.BasicUser.Password)
		CheckErrorMessage(t, resp, "store.sql_user.get_for_login.app_error")
	})

	t.Run("valid login", func(t *testing.T) {
		user, resp := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		CheckNoError(t, resp)
		assert.Equal(t, user.Id, th.BasicUser.Id)
	})

	t.Run("bot login rejected", func(t *testing.T) {
		bot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username: "bot",
		})
		CheckNoError(t, resp)

		botUser, resp := th.SystemAdminClient.GetUser(bot.UserId, "")
		CheckNoError(t, resp)

		changed, resp := th.SystemAdminClient.UpdateUserPassword(bot.UserId, "", "password")
		CheckNoError(t, resp)
		require.True(t, changed)

		_, resp = th.Client.Login(botUser.Email, "password")
		CheckErrorMessage(t, resp, "api.user.login.bot_login_forbidden.app_error")
	})
}

func TestCBALogin(t *testing.T) {
	t.Run("primary", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		th.App.SetLicense(model.NewTestLicense("saml"))

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExperimentalSettings.ClientSideCertEnable = true
			*cfg.ExperimentalSettings.ClientSideCertCheck = model.CLIENT_SIDE_CERT_CHECK_PRIMARY_AUTH
		})

		t.Run("missing cert header", func(t *testing.T) {
			th.Client.Logout()
			_, resp := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("missing cert subject", func(t *testing.T) {
			th.Client.Logout()
			th.Client.HttpHeader["X-SSL-Client-Cert"] = "valid_cert_fake"
			_, resp := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("emails mismatch", func(t *testing.T) {
			th.Client.Logout()
			th.Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=mis_match" + th.BasicUser.Email
			_, resp := th.Client.Login(th.BasicUser.Email, "")
			CheckBadRequestStatus(t, resp)
		})

		t.Run("successful cba login", func(t *testing.T) {
			th.Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
			user, resp := th.Client.Login(th.BasicUser.Email, "")
			CheckNoError(t, resp)
			require.NotNil(t, user)
			require.Equal(t, th.BasicUser.Id, user.Id)
		})

		t.Run("bot login rejected", func(t *testing.T) {
			bot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
				Username: "bot",
			})
			CheckNoError(t, resp)

			botUser, resp := th.SystemAdminClient.GetUser(bot.UserId, "")
			CheckNoError(t, resp)

			th.Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + botUser.Email

			_, resp = th.Client.Login(botUser.Email, "")
			CheckErrorMessage(t, resp, "api.user.login.bot_login_forbidden.app_error")
		})
	})

	t.Run("secondary", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		th.App.SetLicense(model.NewTestLicense("saml"))

		th.Client.HttpHeader["X-SSL-Client-Cert"] = "valid_cert_fake"

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExperimentalSettings.ClientSideCertEnable = true
			*cfg.ExperimentalSettings.ClientSideCertCheck = model.CLIENT_SIDE_CERT_CHECK_SECONDARY_AUTH
		})

		t.Run("password required", func(t *testing.T) {
			th.Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
			_, resp := th.Client.Login(th.BasicUser.Email, "")
			CheckBadRequestStatus(t, resp)
		})

		t.Run("successful cba login with password", func(t *testing.T) {
			th.Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
			user, resp := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
			CheckNoError(t, resp)
			require.NotNil(t, user)
			require.Equal(t, th.BasicUser.Id, user.Id)
		})

		t.Run("bot login rejected", func(t *testing.T) {
			bot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
				Username: "bot",
			})
			CheckNoError(t, resp)

			botUser, resp := th.SystemAdminClient.GetUser(bot.UserId, "")
			CheckNoError(t, resp)

			changed, resp := th.SystemAdminClient.UpdateUserPassword(bot.UserId, "", "password")
			CheckNoError(t, resp)
			require.True(t, changed)

			th.Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + botUser.Email

			_, resp = th.Client.Login(botUser.Email, "password")
			CheckErrorMessage(t, resp, "api.user.login.bot_login_forbidden.app_error")
		})
	})
}

func TestSwitchAccount(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.Enable = true })

	th.Client.Logout()

	sr := &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
		Email:          th.BasicUser.Email,
		Password:       th.BasicUser.Password,
	}

	link, resp := th.Client.SwitchAccountType(sr)
	CheckNoError(t, resp)

	if link == "" {
		t.Fatal("bad link")
	}

	th.App.SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExperimentalEnableAuthenticationTransfer = false })

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_SAML,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_LDAP,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_LDAP,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExperimentalEnableAuthenticationTransfer = true })

	th.LoginBasic()

	fakeAuthData := model.NewId()
	if result := <-th.App.Srv.Store.User().UpdateAuthData(th.BasicUser.Id, model.USER_AUTH_SERVICE_GITLAB, &fakeAuthData, th.BasicUser.Email, true); result.Err != nil {
		t.Fatal(result.Err)
	}

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_GITLAB,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	link, resp = th.Client.SwitchAccountType(sr)
	CheckNoError(t, resp)

	if link != "/login?extra=signin_change" {
		t.Log(link)
		t.Fatal("bad link")
	}

	th.Client.Logout()
	_, resp = th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	CheckNoError(t, resp)
	th.Client.Logout()

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_GITLAB,
		NewService:     model.SERVICE_GOOGLE,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckBadRequestStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
		Password:       th.BasicUser.Password,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckNotFoundStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
		Email:          th.BasicUser.Email,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckUnauthorizedStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_GITLAB,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	_, resp = th.Client.SwitchAccountType(sr)
	CheckUnauthorizedStatus(t, resp)
}

func assertToken(t *testing.T, th *TestHelper, token *model.UserAccessToken, expectedUserId string) {
	t.Helper()

	oldSessionToken := th.Client.AuthToken
	defer func() { th.Client.AuthToken = oldSessionToken }()

	th.Client.AuthToken = token.Token
	ruser, resp := th.Client.GetMe("")
	CheckNoError(t, resp)

	assert.Equal(t, expectedUserId, ruser.Id, "returned wrong user")
}

func assertInvalidToken(t *testing.T, th *TestHelper, token *model.UserAccessToken) {
	t.Helper()

	oldSessionToken := th.Client.AuthToken
	defer func() { th.Client.AuthToken = oldSessionToken }()

	th.Client.AuthToken = token.Token
	_, resp := th.Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
}

func TestCreateUserAccessToken(t *testing.T) {
	t.Run("create token without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create token for invalid user id", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp := th.Client.CreateUserAccessToken("notarealuserid", "test token")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create token with invalid value", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create token with user access tokens disabled", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })
		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("create user access token", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		rtoken, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)

		assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
		assert.NotEmpty(t, rtoken.Token, "token should not be empty")
		assert.NotEmpty(t, rtoken.Id, "id should not be empty")
		assert.Equal(t, "test token", rtoken.Description, "description did not match")
		assert.True(t, rtoken.IsActive, "token should be active")

		assertToken(t, th, rtoken, th.BasicUser.Id)
	})

	t.Run("create user access token as second user, without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create user access token for basic user as as system admin", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		rtoken, resp := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)
		assert.Equal(t, th.BasicUser.Id, rtoken.UserId)

		oldSessionToken := th.Client.AuthToken
		defer func() { th.Client.AuthToken = oldSessionToken }()

		assertToken(t, th, rtoken, th.BasicUser.Id)
	})

	t.Run("create access token as oauth session", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		session, _ := th.App.GetSession(th.Client.AuthToken)
		session.IsOAuth = true
		th.App.AddSessionToCache(session)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create access token for bot created by user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		t.Run("without MANAGE_BOT permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			_, resp = th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			token, resp := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			CheckNoError(t, resp)
			assert.Equal(t, createdBot.UserId, token.UserId)
			assertToken(t, th, token, createdBot.UserId)
		})
	})

	t.Run("create access token for bot created by another user, only having MANAGE_BOTS permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp = th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)

			rtoken, resp := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			CheckNoError(t, resp)
			assert.Equal(t, createdBot.UserId, rtoken.UserId)

			assertToken(t, th, rtoken, createdBot.UserId)
		})
	})
}

func TestGetUserAccessToken(t *testing.T) {
	t.Run("get for invalid user id", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp := th.Client.GetUserAccessToken("123")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get for unknown user id", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp := th.Client.GetUserAccessToken(model.NewId())
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get my token", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)

		rtoken, resp := th.Client.GetUserAccessToken(token.Id)
		CheckNoError(t, resp)

		assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
		assert.Empty(t, rtoken.Token, "token should be blank")
		assert.NotEmpty(t, rtoken.Id, "id should not be empty")
		assert.Equal(t, "test token", rtoken.Description, "description did not match")
	})

	t.Run("get user token as system admin", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)

		rtoken, resp := th.SystemAdminClient.GetUserAccessToken(token.Id)
		CheckNoError(t, resp)

		assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
		assert.Empty(t, rtoken.Token, "token should be blank")
		assert.NotEmpty(t, rtoken.Id, "id should not be empty")
		assert.Equal(t, "test token", rtoken.Description, "description did not match")
	})

	t.Run("get token for bot created by user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			_, resp := th.Client.GetUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			returnedToken, resp := th.Client.GetUserAccessToken(token.Id)
			CheckNoError(t, resp)

			// Actual token won't be returned.
			returnedToken.Token = token.Token
			assert.Equal(t, token, returnedToken)
		})
	})

	t.Run("get token for bot created by another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp = th.Client.GetUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)

			returnedToken, resp := th.Client.GetUserAccessToken(token.Id)
			CheckNoError(t, resp)

			// Actual token won't be returned.
			returnedToken.Token = token.Token
			assert.Equal(t, token, returnedToken)
		})
	})
}

func TestGetUserAccessTokensForUser(t *testing.T) {
	t.Run("multiple tokens, offset 0, limit 100", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)

		_, resp = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		rtokens, resp := th.Client.GetUserAccessTokensForUser(th.BasicUser.Id, 0, 100)
		CheckNoError(t, resp)

		assert.Len(t, rtokens, 2, "should have 2 tokens")
		for _, uat := range rtokens {
			assert.Equal(t, th.BasicUser.Id, uat.UserId, "wrong user id")
		}
	})

	t.Run("multiple tokens as system admin, offset 0, limit 100", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)

		_, resp = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		rtokens, resp := th.Client.GetUserAccessTokensForUser(th.BasicUser.Id, 0, 100)
		CheckNoError(t, resp)

		assert.Len(t, rtokens, 2, "should have 2 tokens")
		for _, uat := range rtokens {
			assert.Equal(t, th.BasicUser.Id, uat.UserId, "wrong user id")
		}
	})

	t.Run("multiple tokens, offset 1, limit 1", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)

		_, resp = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		rtokens, resp := th.Client.GetUserAccessTokensForUser(th.BasicUser.Id, 1, 1)
		CheckNoError(t, resp)

		assert.Len(t, rtokens, 1, "should have 1 tokens")
		for _, uat := range rtokens {
			assert.Equal(t, th.BasicUser.Id, uat.UserId, "wrong user id")
		}
	})
}

func TestGetUserAccessTokens(t *testing.T) {
	t.Run("GetUserAccessTokens, not a system admin", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.GetUserAccessTokens(0, 100)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("GetUserAccessTokens, as a system admin, page 1, perPage 1", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		_, resp = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		rtokens, resp := th.SystemAdminClient.GetUserAccessTokens(1, 1)
		CheckNoError(t, resp)

		assert.Len(t, rtokens, 1, "should have 1 token")
	})

	t.Run("GetUserAccessTokens, as a system admin, page 0, perPage 2", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		_, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		_, resp = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		CheckNoError(t, resp)

		rtokens, resp := th.SystemAdminClient.GetUserAccessTokens(0, 2)
		CheckNoError(t, resp)

		assert.Len(t, rtokens, 2, "should have 2 tokens")
	})
}

func TestSearchUserAccessToken(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	_, resp = th.Client.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: token.Id})
	CheckForbiddenStatus(t, resp)

	rtokens, resp := th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: th.BasicUser.Id})
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 tokens")
	}

	rtokens, resp = th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: token.Id})
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 tokens")
	}

	rtokens, resp = th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: th.BasicUser.Username})
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 tokens")
	}

	rtokens, resp = th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: "not found"})
	CheckNoError(t, resp)

	if len(rtokens) != 0 {
		t.Fatal("should have 0 tokens")
	}
}

func TestRevokeUserAccessToken(t *testing.T) {
	t.Run("revoke user token", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
		token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)
		assertToken(t, th, token, th.BasicUser.Id)

		ok, resp := th.Client.RevokeUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		assertInvalidToken(t, th, token)
	})

	t.Run("revoke token belonging to another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		token, resp := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		CheckNoError(t, resp)

		ok, resp := th.Client.RevokeUserAccessToken(token.Id)
		CheckForbiddenStatus(t, resp)
		assert.False(t, ok, "should have failed")
	})

	t.Run("revoke token for bot created by user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			_, resp := th.Client.RevokeUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			ok, resp := th.Client.RevokeUserAccessToken(token.Id)
			CheckNoError(t, resp)
			assert.True(t, ok, "should have passed")
		})
	})

	t.Run("revoke token for bot created by another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp = th.Client.RevokeUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)

			ok, resp := th.Client.RevokeUserAccessToken(token.Id)
			CheckNoError(t, resp)
			assert.True(t, ok, "should have passed")
		})
	})
}

func TestDisableUserAccessToken(t *testing.T) {
	t.Run("disable user token", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
		token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)
		assertToken(t, th, token, th.BasicUser.Id)

		ok, resp := th.Client.DisableUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		assertInvalidToken(t, th, token)
	})

	t.Run("disable token belonging to another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		token, resp := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		CheckNoError(t, resp)

		ok, resp := th.Client.DisableUserAccessToken(token.Id)
		CheckForbiddenStatus(t, resp)
		assert.False(t, ok, "should have failed")
	})

	t.Run("disable token for bot created by user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			_, resp := th.Client.DisableUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			ok, resp := th.Client.DisableUserAccessToken(token.Id)
			CheckNoError(t, resp)
			assert.True(t, ok, "should have passed")
		})
	})

	t.Run("disable token for bot created by another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp = th.Client.DisableUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)

			ok, resp := th.Client.DisableUserAccessToken(token.Id)
			CheckNoError(t, resp)
			assert.True(t, ok, "should have passed")
		})
	})
}

func TestEnableUserAccessToken(t *testing.T) {
	t.Run("enable user token", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
		token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		CheckNoError(t, resp)
		assertToken(t, th, token, th.BasicUser.Id)

		ok, resp := th.Client.DisableUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		assertInvalidToken(t, th, token)

		ok, resp = th.Client.EnableUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		assertToken(t, th, token, th.BasicUser.Id)
	})

	t.Run("enable token belonging to another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		token, resp := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		CheckNoError(t, resp)

		ok, resp := th.SystemAdminClient.DisableUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		ok, resp = th.Client.DisableUserAccessToken(token.Id)
		CheckForbiddenStatus(t, resp)
		assert.False(t, ok, "should have failed")
	})

	t.Run("enable token for bot created by user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		ok, resp := th.Client.DisableUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			_, resp := th.Client.EnableUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)

			ok, resp := th.Client.EnableUserAccessToken(token.Id)
			CheckNoError(t, resp)
			assert.True(t, ok, "should have passed")
		})
	})

	t.Run("enable token for bot created by another user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, resp := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		CheckNoError(t, resp)

		ok, resp := th.SystemAdminClient.DisableUserAccessToken(token.Id)
		CheckNoError(t, resp)
		assert.True(t, ok, "should have passed")

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp := th.Client.EnableUserAccessToken(token.Id)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)

			ok, resp := th.Client.EnableUserAccessToken(token.Id)
			CheckNoError(t, resp)
			assert.True(t, ok, "should have passed")
		})
	})
}

func TestUserAccessTokenInactiveUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	th.Client.AuthToken = token.Token
	_, resp = th.Client.GetMe("")
	CheckNoError(t, resp)

	th.App.UpdateActive(th.BasicUser, false)

	_, resp = th.Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
}

func TestUserAccessTokenDisableConfig(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := th.Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	oldSessionToken := th.Client.AuthToken
	th.Client.AuthToken = token.Token
	_, resp = th.Client.GetMe("")
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })

	_, resp = th.Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)

	th.Client.AuthToken = oldSessionToken
	_, resp = th.Client.GetMe("")
	CheckNoError(t, resp)
}

func TestGetUsersByStatus(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	team, err := th.App.CreateTeam(&model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TEAM_OPEN,
	})
	if err != nil {
		t.Fatalf("failed to create team: %v", err)
	}

	channel, err := th.App.CreateChannel(&model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.CHANNEL_OPEN,
		TeamId:      team.Id,
		CreatorId:   model.NewId(),
	}, false)
	if err != nil {
		t.Fatalf("failed to create channel: %v", err)
	}

	createUserWithStatus := func(username string, status string) *model.User {
		id := model.NewId()

		user, err := th.App.CreateUser(&model.User{
			Email:    "success+" + id + "@simulator.amazonses.com",
			Username: "un_" + username + "_" + id,
			Nickname: "nn_" + id,
			Password: "Password1",
		})
		if err != nil {
			t.Fatalf("failed to create user: %v", err)
		}

		th.LinkUserToTeam(user, team)
		th.AddUserToChannel(user, channel)

		th.App.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: status,
			Manual: true,
		})

		return user
	}

	// Creating these out of order in case that affects results
	offlineUser1 := createUserWithStatus("offline1", model.STATUS_OFFLINE)
	offlineUser2 := createUserWithStatus("offline2", model.STATUS_OFFLINE)
	awayUser1 := createUserWithStatus("away1", model.STATUS_AWAY)
	awayUser2 := createUserWithStatus("away2", model.STATUS_AWAY)
	onlineUser1 := createUserWithStatus("online1", model.STATUS_ONLINE)
	onlineUser2 := createUserWithStatus("online2", model.STATUS_ONLINE)
	dndUser1 := createUserWithStatus("dnd1", model.STATUS_DND)
	dndUser2 := createUserWithStatus("dnd2", model.STATUS_DND)

	client := th.CreateClient()
	if _, resp := client.Login(onlineUser2.Username, "Password1"); resp.Error != nil {
		t.Fatal(resp.Error)
	}

	t.Run("sorting by status then alphabetical", func(t *testing.T) {
		usersByStatus, resp := client.GetUsersInChannelByStatus(channel.Id, 0, 8, "")
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}

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

		if len(usersByStatus) != len(expectedUsersByStatus) {
			t.Fatalf("received only %v users, expected %v", len(usersByStatus), len(expectedUsersByStatus))
		}

		for i := range usersByStatus {
			if usersByStatus[i].Id != expectedUsersByStatus[i].Id {
				t.Fatalf("received user %v at index %v, expected %v", usersByStatus[i].Username, i, expectedUsersByStatus[i].Username)
			}
		}
	})

	t.Run("paging", func(t *testing.T) {
		usersByStatus, resp := client.GetUsersInChannelByStatus(channel.Id, 0, 3, "")
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}

		if len(usersByStatus) != 3 {
			t.Fatal("received too many users")
		}

		if usersByStatus[0].Id != onlineUser1.Id && usersByStatus[1].Id != onlineUser2.Id {
			t.Fatal("expected to receive online users first")
		}

		if usersByStatus[2].Id != awayUser1.Id {
			t.Fatal("expected to receive away users second")
		}

		usersByStatus, resp = client.GetUsersInChannelByStatus(channel.Id, 1, 3, "")
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}

		if usersByStatus[0].Id != awayUser2.Id {
			t.Fatal("expected to receive away users second")
		}

		if usersByStatus[1].Id != dndUser1.Id && usersByStatus[2].Id != dndUser2.Id {
			t.Fatal("expected to receive dnd users third")
		}

		usersByStatus, resp = client.GetUsersInChannelByStatus(channel.Id, 1, 4, "")
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}

		if len(usersByStatus) != 4 {
			t.Fatal("received too many users")
		}

		if usersByStatus[0].Id != dndUser1.Id && usersByStatus[1].Id != dndUser2.Id {
			t.Fatal("expected to receive dnd users third")
		}

		if usersByStatus[2].Id != offlineUser1.Id && usersByStatus[3].Id != offlineUser2.Id {
			t.Fatal("expected to receive offline users last")
		}
	})
}

func TestRegisterTermsOfServiceAction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	success, resp := th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, "st_1", true)
	CheckErrorMessage(t, resp, "store.sql_terms_of_service_store.get.no_rows.app_error")

	termsOfService, err := th.App.CreateTermsOfService("terms of service", th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}

	success, resp = th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, termsOfService.Id, true)
	CheckNoError(t, resp)

	assert.True(t, *success)
	_, err = th.App.GetUser(th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}
}

func TestGetUserTermsOfService(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.GetUserTermsOfService(th.BasicUser.Id, "")
	CheckErrorMessage(t, resp, "store.sql_user_terms_of_service.get_by_user.no_rows.app_error")

	termsOfService, err := th.App.CreateTermsOfService("terms of service", th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}

	success, resp := th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, termsOfService.Id, true)
	CheckNoError(t, resp)
	assert.True(t, *success)

	userTermsOfService, resp := th.Client.GetUserTermsOfService(th.BasicUser.Id, "")
	CheckNoError(t, resp)

	assert.Equal(t, th.BasicUser.Id, userTermsOfService.UserId)
	assert.Equal(t, termsOfService.Id, userTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, userTermsOfService.CreateAt)
}

func TestLoginLockout(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.Logout()
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 3 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	_, resp = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorMessage(t, resp, "api.user.check_user_password.invalid.app_error")
	_, resp = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorMessage(t, resp, "api.user.check_user_password.invalid.app_error")
	_, resp = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorMessage(t, resp, "api.user.check_user_password.invalid.app_error")
	_, resp = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorMessage(t, resp, "api.user.check_user_login_attempts.too_many.app_error")
	_, resp = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorMessage(t, resp, "api.user.check_user_login_attempts.too_many.app_error")

	// Fake user has MFA enabled
	if result := <-th.Server.Store.User().UpdateMfaActive(th.BasicUser2.Id, true); result.Err != nil {
		t.Fatal(result.Err)
	}
	_, resp = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorMessage(t, resp, "api.user.check_user_mfa.bad_code.app_error")
	_, resp = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorMessage(t, resp, "api.user.check_user_mfa.bad_code.app_error")
	_, resp = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorMessage(t, resp, "api.user.check_user_mfa.bad_code.app_error")
	_, resp = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorMessage(t, resp, "api.user.check_user_login_attempts.too_many.app_error")
	_, resp = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorMessage(t, resp, "api.user.check_user_login_attempts.too_many.app_error")
}
