// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	enableOpenServer := th.App.Config().TeamSettings.EnableOpenServer
	enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableOpenServer = enableOpenServer })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })
	}()

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

	ruser, resp := Client.CreateUser(&user)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	Client.Login(user.Email, user.Password)

	if ruser.Nickname != user.Nickname {
		t.Fatal("nickname didn't match")
	}

	if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
		t.Log(ruser.Roles)
		t.Fatal("did not clear roles")
	}

	CheckUserSanitization(t, ruser)

	_, resp = Client.CreateUser(ruser)
	CheckBadRequestStatus(t, resp)

	ruser.Id = ""
	ruser.Username = GenerateTestUsername()
	ruser.Password = "passwd1"
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "store.sql_user.save.email_exists.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Email = th.GenerateTestEmail()
	ruser.Username = user.Username
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "store.sql_user.save.username_exists.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Email = ""
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "model.user.is_valid.email.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Username = "testinvalid+++"
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "model.user.is_valid.username.app_error")
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

	user2 := &model.User{Email: th.GenerateTestEmail(), Password: "Password1", Username: GenerateTestUsername()}
	_, resp = AdminClient.CreateUser(user2)
	CheckNoError(t, resp)

	if r, err := Client.DoApiPost("/users", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}
}

func TestCreateUserWithToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	t.Run("CreateWithTokenHappyPath", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}
		token := model.NewToken(
			app.TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)

		ruser, resp := Client.CreateUserWithToken(&user, token.Token)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		Client.Login(user.Email, user.Password)
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

		_, resp := Client.CreateUserWithToken(&user, "")
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

		_, resp := Client.CreateUserWithToken(&user, token.Token)
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.signup_link_expired.app_error")
	})

	t.Run("WrongToken", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		_, resp := Client.CreateUserWithToken(&user, "wrong")
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

		_, resp := Client.CreateUserWithToken(&user, token.Token)
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

		ruser, resp := Client.CreateUserWithToken(&user, token.Token)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		Client.Login(user.Email, user.Password)
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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	t.Run("CreateWithInviteIdHappyPath", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		inviteId := th.BasicTeam.InviteId

		ruser, resp := Client.CreateUserWithInviteId(&user, inviteId)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		Client.Login(user.Email, user.Password)
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

		_, resp := Client.CreateUserWithInviteId(&user, inviteId)
		CheckNotFoundStatus(t, resp)
		CheckErrorMessage(t, resp, "store.sql_team.get_by_invite_id.finding.app_error")
	})

	t.Run("NoInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		_, resp := Client.CreateUserWithInviteId(&user, "")
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "api.user.create_user.missing_invite_id.app_error")
	})

	t.Run("ExpiredInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

		inviteId := th.BasicTeam.InviteId

		th.BasicTeam.InviteId = model.NewId()
		_, resp := AdminClient.UpdateTeam(th.BasicTeam)
		CheckNoError(t, resp)

		_, resp = Client.CreateUserWithInviteId(&user, inviteId)
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

		_, resp := Client.CreateUserWithInviteId(&user, inviteId)
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

		inviteId := th.BasicTeam.InviteId

		ruser, resp := Client.CreateUserWithInviteId(&user, inviteId)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		Client.Login(user.Email, user.Password)
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
	Client := th.Client

	ruser, resp := Client.GetMe("")
	CheckNoError(t, resp)

	if ruser.Id != th.BasicUser.Id {
		t.Fatal("wrong user")
	}

	Client.Logout()
	_, resp = Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.CreateUser()
	user.Props = map[string]string{"testpropkey": "testpropvalue"}

	th.App.UpdateUser(user, false)

	showEmailAddress := th.App.Config().PrivacySettings.ShowEmailAddress
	showFullName := th.App.Config().PrivacySettings.ShowFullName
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = showEmailAddress })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = showFullName })
	}()

	ruser, resp := Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	assert.NotNil(t, ruser.Props)
	assert.Equal(t, ruser.Props["testpropkey"], "testpropvalue")

	ruser, resp = Client.GetUser(user.Id, resp.Etag)
	CheckEtag(t, ruser, resp)

	_, resp = Client.GetUser("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetUser(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	ruser, resp = Client.GetUser(user.Id, "")
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

	Client.Logout()
	_, resp = Client.GetUser(user.Id, "")
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

func TestGetUserByUsername(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.BasicUser

	showEmailAddress := th.App.Config().PrivacySettings.ShowEmailAddress
	showFullName := th.App.Config().PrivacySettings.ShowFullName
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = showEmailAddress })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = showFullName })
	}()

	ruser, resp := Client.GetUserByUsername(user.Username, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	ruser, resp = Client.GetUserByUsername(user.Username, resp.Etag)
	CheckEtag(t, ruser, resp)

	_, resp = Client.GetUserByUsername(GenerateTestUsername(), "")
	CheckNotFoundStatus(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	ruser, resp = Client.GetUserByUsername(th.BasicUser2.Username, "")
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

	ruser, resp = Client.GetUserByUsername(th.BasicUser.Username, "")
	CheckNoError(t, resp)
	if len(ruser.NotifyProps) == 0 {
		t.Fatal("notify props should be sent")
	}

	Client.Logout()
	_, resp = Client.GetUserByUsername(user.Username, "")
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

func TestGetUserByEmail(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	showEmailAddress := th.App.Config().PrivacySettings.ShowEmailAddress
	showFullName := th.App.Config().PrivacySettings.ShowFullName
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = showEmailAddress })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = showFullName })
	}()

	user := th.CreateUser()

	ruser, resp := Client.GetUserByEmail(user.Email, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	ruser, resp = Client.GetUserByEmail(user.Email, resp.Etag)
	CheckEtag(t, ruser, resp)

	_, resp = Client.GetUserByEmail(GenerateTestUsername(), "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetUserByEmail(th.GenerateTestEmail(), "")
	CheckNotFoundStatus(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	ruser, resp = Client.GetUserByEmail(user.Email, "")
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

	Client.Logout()
	_, resp = Client.GetUserByEmail(user.Email, "")
	CheckUnauthorizedStatus(t, resp)

	// System admins should ignore privacy settings
	ruser, _ = th.SystemAdminClient.GetUserByEmail(user.Email, resp.Etag)
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

func TestSearchUsers(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	showEmailAddress := th.App.Config().PrivacySettings.ShowEmailAddress
	showFullName := th.App.Config().PrivacySettings.ShowFullName
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = showEmailAddress })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = showFullName })
	}()

	search := &model.UserSearch{Term: th.BasicUser.Username}

	users, resp := Client.SearchUsers(search)
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

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.AllowInactive = true

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should have found user")
	}

	search.Term = th.BasicUser.Username
	search.AllowInactive = false
	search.TeamId = th.BasicTeam.Id

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should have found user")
	}

	search.NotInChannelId = th.BasicChannel.Id

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should not have found user")
	}

	search.TeamId = ""
	search.NotInChannelId = ""
	search.InChannelId = th.BasicChannel.Id

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should have found user")
	}

	search.InChannelId = ""
	search.NotInChannelId = th.BasicChannel.Id
	_, resp = Client.SearchUsers(search)
	CheckBadRequestStatus(t, resp)

	search.NotInChannelId = model.NewId()
	search.TeamId = model.NewId()
	_, resp = Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	search.NotInChannelId = ""
	search.TeamId = model.NewId()
	_, resp = Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	search.InChannelId = model.NewId()
	search.TeamId = ""
	_, resp = Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	// Test search for users not in any team
	search.TeamId = ""
	search.NotInChannelId = ""
	search.InChannelId = ""
	search.NotInTeamId = th.BasicTeam.Id

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser.Id, users) {
		t.Fatal("should not have found user")
	}

	oddUser := th.CreateUser()
	search.Term = oddUser.Username

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if !findUserInList(oddUser.Id, users) {
		t.Fatal("should have found user")
	}

	_, resp = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, oddUser.Id)
	CheckNoError(t, resp)

	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(oddUser.Id, users) {
		t.Fatal("should not have found user")
	}

	search.NotInTeamId = model.NewId()
	_, resp = Client.SearchUsers(search)
	CheckForbiddenStatus(t, resp)

	search.Term = th.BasicUser.Username

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	_, err = th.App.UpdateActive(th.BasicUser2, true)
	if err != nil {
		t.Fatal(err)
	}

	search.InChannelId = ""
	search.NotInTeamId = ""
	search.Term = th.BasicUser2.Email
	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.Term = th.BasicUser2.FirstName
	users, resp = Client.SearchUsers(search)
	CheckNoError(t, resp)

	if findUserInList(th.BasicUser2.Id, users) {
		t.Fatal("should not have found user")
	}

	search.Term = th.BasicUser2.LastName
	users, resp = Client.SearchUsers(search)
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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	teamId := th.BasicTeam.Id
	channelId := th.BasicChannel.Id
	username := th.BasicUser.Username

	showFullName := th.App.Config().PrivacySettings.ShowFullName
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = showFullName })
	}()

	rusers, resp := Client.AutocompleteUsersInChannel(teamId, channelId, username, "")
	CheckNoError(t, resp)

	if len(rusers.Users) != 1 {
		t.Fatal("should have returned 1 user")
	}

	rusers, resp = Client.AutocompleteUsersInChannel(teamId, channelId, "amazonses", "")
	CheckNoError(t, resp)
	if len(rusers.Users) != 0 {
		t.Fatal("should have returned 0 users")
	}

	rusers, resp = Client.AutocompleteUsersInChannel(teamId, channelId, "", "")
	CheckNoError(t, resp)
	if len(rusers.Users) < 2 {
		t.Fatal("should have many users")
	}

	rusers, resp = Client.AutocompleteUsersInChannel("", channelId, "", "")
	CheckNoError(t, resp)
	if len(rusers.Users) < 2 {
		t.Fatal("should have many users")
	}

	rusers, resp = Client.AutocompleteUsersInTeam(teamId, username, "")
	CheckNoError(t, resp)

	if len(rusers.Users) != 1 {
		t.Fatal("should have returned 1 user")
	}

	rusers, resp = Client.AutocompleteUsers(username, "")
	CheckNoError(t, resp)

	if len(rusers.Users) != 1 {
		t.Fatal("should have returned 1 users")
	}

	rusers, resp = Client.AutocompleteUsers("", "")
	CheckNoError(t, resp)

	if len(rusers.Users) < 2 {
		t.Fatal("should have returned many users")
	}

	rusers, resp = Client.AutocompleteUsersInTeam(teamId, "amazonses", "")
	CheckNoError(t, resp)
	if len(rusers.Users) != 0 {
		t.Fatal("should have returned 0 users")
	}

	rusers, resp = Client.AutocompleteUsersInTeam(teamId, "", "")
	CheckNoError(t, resp)
	if len(rusers.Users) < 2 {
		t.Fatal("should have many users")
	}

	Client.Logout()
	_, resp = Client.AutocompleteUsersInChannel(teamId, channelId, username, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.AutocompleteUsersInTeam(teamId, username, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.AutocompleteUsers(username, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.AutocompleteUsersInChannel(teamId, channelId, username, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.AutocompleteUsersInTeam(teamId, username, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.AutocompleteUsers(username, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AutocompleteUsersInChannel(teamId, channelId, username, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AutocompleteUsersInTeam(teamId, username, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AutocompleteUsers(username, "")
	CheckNoError(t, resp)

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	th.LoginBasic()

	rusers, resp = Client.AutocompleteUsers(username, "")
	CheckNoError(t, resp)

	if rusers.Users[0].FirstName != "" || rusers.Users[0].LastName != "" {
		t.Fatal("should not show first/last name")
	}

	rusers, resp = Client.AutocompleteUsersInChannel(teamId, channelId, username, "")
	CheckNoError(t, resp)

	if rusers.Users[0].FirstName != "" || rusers.Users[0].LastName != "" {
		t.Fatal("should not show first/last name")
	}

	rusers, resp = Client.AutocompleteUsersInTeam(teamId, username, "")
	CheckNoError(t, resp)

	if rusers.Users[0].FirstName != "" || rusers.Users[0].LastName != "" {
		t.Fatal("should not show first/last name")
	}

	t.Run("team id, if provided, must match channel's team id", func(t *testing.T) {
		rusers, resp = Client.AutocompleteUsersInChannel("otherTeamId", channelId, username, "")
		CheckErrorMessage(t, resp, "api.user.autocomplete_users.invalid_team_id")
	})
}

func TestGetProfileImage(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser

	data, resp := Client.GetProfileImage(user.Id, "")
	CheckNoError(t, resp)
	if len(data) == 0 {
		t.Fatal("Should not be empty")
	}

	_, resp = Client.GetProfileImage(user.Id, resp.Etag)
	if resp.StatusCode == http.StatusNotModified {
		t.Fatal("Shouldn't have hit etag")
	}

	_, resp = Client.GetProfileImage("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetProfileImage(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetProfileImage(user.Id, "")
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

	Client := th.Client

	users, resp := Client.GetUsersByIds([]string{th.BasicUser.Id})
	CheckNoError(t, resp)

	if users[0].Id != th.BasicUser.Id {
		t.Fatal("returned wrong user")
	}
	CheckUserSanitization(t, users[0])

	_, resp = Client.GetUsersByIds([]string{})
	CheckBadRequestStatus(t, resp)

	users, resp = Client.GetUsersByIds([]string{"junk"})
	CheckNoError(t, resp)
	if len(users) > 0 {
		t.Fatal("no users should be returned")
	}

	users, resp = Client.GetUsersByIds([]string{"junk", th.BasicUser.Id})
	CheckNoError(t, resp)
	if len(users) != 1 {
		t.Fatal("1 user should be returned")
	}

	Client.Logout()
	_, resp = Client.GetUsersByIds([]string{th.BasicUser.Id})
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUsersByUsernames(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.Client

	users, resp := Client.GetUsersByUsernames([]string{th.BasicUser.Username})
	CheckNoError(t, resp)

	if users[0].Id != th.BasicUser.Id {
		t.Fatal("returned wrong user")
	}
	CheckUserSanitization(t, users[0])

	_, resp = Client.GetUsersByIds([]string{})
	CheckBadRequestStatus(t, resp)

	users, resp = Client.GetUsersByUsernames([]string{"junk"})
	CheckNoError(t, resp)
	if len(users) > 0 {
		t.Fatal("no users should be returned")
	}

	users, resp = Client.GetUsersByUsernames([]string{"junk", th.BasicUser.Username})
	CheckNoError(t, resp)
	if len(users) != 1 {
		t.Fatal("1 user should be returned")
	}

	Client.Logout()
	_, resp = Client.GetUsersByUsernames([]string{th.BasicUser.Username})
	CheckUnauthorizedStatus(t, resp)
}

func TestGetTotalUsersStat(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	total := <-th.App.Srv.Store.User().GetTotalUsersCount()

	rstats, resp := Client.GetTotalUsersStats("")
	CheckNoError(t, resp)

	if rstats.TotalUsersCount != total.Data.(int64) {
		t.Fatal("wrong count")
	}
}

func TestUpdateUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)

	user.Nickname = "Joram Wilander"
	user.Roles = model.SYSTEM_ADMIN_ROLE_ID
	user.LastPasswordUpdate = 123

	ruser, resp := Client.UpdateUser(user)
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

	ruser.Id = "junk"
	_, resp = Client.UpdateUser(ruser)
	CheckBadRequestStatus(t, resp)

	ruser.Id = model.NewId()
	_, resp = Client.UpdateUser(ruser)
	CheckForbiddenStatus(t, resp)

	if r, err := Client.DoApiPut("/users/"+ruser.Id, "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	session, _ := th.App.GetSession(Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	ruser.Id = user.Id
	ruser.Email = th.GenerateTestEmail()
	_, resp = Client.UpdateUser(ruser)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdateUser(user)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp = Client.UpdateUser(user)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UpdateUser(user)
	CheckNoError(t, resp)
}

func TestPatchUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)

	patch := &model.UserPatch{}

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

	ruser, resp := Client.PatchUser(user.Id, patch)
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

	patch.Username = model.NewString(th.BasicUser2.Username)
	_, resp = Client.PatchUser(user.Id, patch)
	CheckBadRequestStatus(t, resp)

	patch.Username = nil

	_, resp = Client.PatchUser("junk", patch)
	CheckBadRequestStatus(t, resp)

	ruser.Id = model.NewId()
	_, resp = Client.PatchUser(model.NewId(), patch)
	CheckForbiddenStatus(t, resp)

	if r, err := Client.DoApiPut("/users/"+user.Id+"/patch", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	session, _ := th.App.GetSession(Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	patch.Email = model.NewString(th.GenerateTestEmail())
	_, resp = Client.PatchUser(user.Id, patch)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.PatchUser(user.Id, patch)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp = Client.PatchUser(user.Id, patch)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.PatchUser(user.Id, patch)
	CheckNoError(t, resp)
}

func TestUpdateUserAuth(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.CreateTeamWithClient(Client)

	user := th.CreateUser()

	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	userAuth := &model.UserAuth{}
	userAuth.AuthData = user.AuthData
	userAuth.AuthService = user.AuthService
	userAuth.Password = user.Password

	// Regular user can not use endpoint
	if _, err := th.Client.UpdateUserAuth(user.Id, userAuth); err == nil {
		t.Fatal("Shouldn't have permissions. Only Admins")
	}

	userAuth.AuthData = model.NewString("test@test.com")
	userAuth.AuthService = model.USER_AUTH_SERVICE_SAML
	userAuth.Password = "newpassword"
	ruser, resp := Client.UpdateUserAuth(user.Id, userAuth)
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
	if _, err := Client.UpdateUserAuth(user.Id, userAuth); err == nil {
		t.Fatal("Should have errored - user password not valid")
	}

	// Regular user can not use endpoint
	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")

	userAuth.AuthData = user.AuthData
	userAuth.AuthService = user.AuthService
	userAuth.Password = user.Password
	if _, err := Client.UpdateUserAuth(user.Id, userAuth); err == nil {
		t.Fatal("Should have errored")
	}
}

func TestDeleteUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.Client

	user := th.BasicUser
	th.LoginBasic()

	testUser := th.SystemAdminUser
	_, resp := Client.DeleteUser(testUser.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.DeleteUser(user.Id)
	CheckUnauthorizedStatus(t, resp)

	Client.Login(testUser.Email, testUser.Password)

	user.Id = model.NewId()
	_, resp = Client.DeleteUser(user.Id)
	CheckNotFoundStatus(t, resp)

	user.Id = "junk"
	_, resp = Client.DeleteUser(user.Id)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.DeleteUser(testUser.Id)
	CheckNoError(t, resp)
}

func TestUpdateUserRoles(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.Client
	SystemAdminClient := th.SystemAdminClient

	_, resp := Client.UpdateUserRoles(th.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID)
	CheckForbiddenStatus(t, resp)

	_, resp = SystemAdminClient.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID)
	CheckNoError(t, resp)

	_, resp = SystemAdminClient.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID)
	CheckNoError(t, resp)

	_, resp = SystemAdminClient.UpdateUserRoles(th.BasicUser.Id, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = SystemAdminClient.UpdateUserRoles("junk", model.SYSTEM_USER_ROLE_ID)
	CheckBadRequestStatus(t, resp)

	_, resp = SystemAdminClient.UpdateUserRoles(model.NewId(), model.SYSTEM_USER_ROLE_ID)
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
		th := Setup().InitBasic().InitSystemAdmin()
		defer th.TearDown()

		Client := th.Client
		SystemAdminClient := th.SystemAdminClient
		user := th.BasicUser

		EnableUserDeactivation := th.App.Config().TeamSettings.EnableUserDeactivation
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserDeactivation = EnableUserDeactivation })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })
		pass, resp := Client.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)

		if !pass {
			t.Fatal("should have returned true")
		}

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = false })
		pass, resp = Client.UpdateUserActive(user.Id, false)
		CheckUnauthorizedStatus(t, resp)

		if pass {
			t.Fatal("should have returned false")
		}

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })
		pass, resp = Client.UpdateUserActive(user.Id, false)
		CheckUnauthorizedStatus(t, resp)

		if pass {
			t.Fatal("should have returned false")
		}

		th.LoginBasic2()

		_, resp = Client.UpdateUserActive(user.Id, true)
		CheckForbiddenStatus(t, resp)

		_, resp = Client.UpdateUserActive(GenerateTestId(), true)
		CheckForbiddenStatus(t, resp)

		_, resp = Client.UpdateUserActive("junk", true)
		CheckBadRequestStatus(t, resp)

		Client.Logout()

		_, resp = Client.UpdateUserActive(user.Id, true)
		CheckUnauthorizedStatus(t, resp)

		_, resp = SystemAdminClient.UpdateUserActive(user.Id, true)
		CheckNoError(t, resp)

		_, resp = SystemAdminClient.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)

		authData := model.NewId()
		result := <-th.App.Srv.Store.User().UpdateAuthData(user.Id, "random", &authData, "", true)
		require.Nil(t, result.Err)

		_, resp = SystemAdminClient.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)
	})

	t.Run("websocket events", func(t *testing.T) {
		th := Setup().InitBasic().InitSystemAdmin()
		defer th.TearDown()

		SystemAdminClient := th.SystemAdminClient
		user := th.BasicUser2

		EnableUserDeactivation := th.App.Config().TeamSettings.EnableUserDeactivation
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserDeactivation = EnableUserDeactivation })
		}()

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

		ShowEmailAddress := th.App.Config().PrivacySettings.ShowEmailAddress
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = ShowEmailAddress })
		}()

		// Verify that both admins and regular users see the email when privacy settings allow same.
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })
		_, resp := SystemAdminClient.UpdateUserActive(user.Id, false)
		CheckNoError(t, resp)

		assertWebsocketEventUserUpdatedWithEmail(t, webSocketClient, user.Email)
		assertWebsocketEventUserUpdatedWithEmail(t, adminWebSocketClient, user.Email)

		// Verify that only admins see the email when privacy settings hide emails.
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
		_, resp = SystemAdminClient.UpdateUserActive(user.Id, true)
		CheckNoError(t, resp)

		assertWebsocketEventUserUpdatedWithEmail(t, webSocketClient, "")
		assertWebsocketEventUserUpdatedWithEmail(t, adminWebSocketClient, user.Email)
	})
}

func TestGetUsers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	rusers, resp := Client.GetUsers(0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetUsers(0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, resp = Client.GetUsers(0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsers(1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsers(10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	// Check default params for page and per_page
	if _, err := Client.DoApiGet("/users", ""); err != nil {
		t.Fatal("should not have errored")
	}

	Client.Logout()
	_, resp = Client.GetUsers(0, 60, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetNewUsersInTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	teamId := th.BasicTeam.Id

	rusers, resp := Client.GetNewUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)

	lastCreateAt := model.GetMillis()
	for _, u := range rusers {
		if u.CreateAt > lastCreateAt {
			t.Fatal("bad sorting")
		}
		lastCreateAt = u.CreateAt
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetNewUsersInTeam(teamId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	Client.Logout()
	_, resp = Client.GetNewUsersInTeam(teamId, 1, 1, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetRecentlyActiveUsersInTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	teamId := th.BasicTeam.Id

	th.App.SetStatusOnline(th.BasicUser.Id, true)

	rusers, resp := Client.GetRecentlyActiveUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)

	for _, u := range rusers {
		if u.LastActivityAt == 0 {
			t.Fatal("did not return last activity at")
		}
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetRecentlyActiveUsersInTeam(teamId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	Client.Logout()
	_, resp = Client.GetRecentlyActiveUsersInTeam(teamId, 0, 1, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUsersWithoutTeam(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	SystemAdminClient := th.SystemAdminClient

	if _, resp := Client.GetUsersWithoutTeam(0, 100, ""); resp.Error == nil {
		t.Fatal("should prevent non-admin user from getting users without a team")
	}

	// These usernames need to appear in the first 100 users for this to work

	user, resp := Client.CreateUser(&model.User{
		Username: "a000000000" + model.NewId(),
		Email:    "success+" + model.NewId() + "@simulator.amazonses.com",
		Password: "Password1",
	})
	CheckNoError(t, resp)
	th.LinkUserToTeam(user, th.BasicTeam)
	defer th.App.Srv.Store.User().PermanentDelete(user.Id)

	user2, resp := Client.CreateUser(&model.User{
		Username: "a000000001" + model.NewId(),
		Email:    "success+" + model.NewId() + "@simulator.amazonses.com",
		Password: "Password1",
	})
	CheckNoError(t, resp)
	defer th.App.Srv.Store.User().PermanentDelete(user2.Id)

	rusers, resp := SystemAdminClient.GetUsersWithoutTeam(0, 100, "")
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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	teamId := th.BasicTeam.Id

	rusers, resp := Client.GetUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetUsersInTeam(teamId, 0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, resp = Client.GetUsersInTeam(teamId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersInTeam(teamId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersInTeam(teamId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	Client.Logout()
	_, resp = Client.GetUsersInTeam(teamId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetUsersInTeam(teamId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetUsersNotInTeam(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	teamId := th.BasicTeam.Id

	rusers, resp := Client.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetUsersNotInTeam(teamId, 0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, resp = Client.GetUsersNotInTeam(teamId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersNotInTeam(teamId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersNotInTeam(teamId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	Client.Logout()
	_, resp = Client.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersNotInTeam(teamId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetUsersInChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channelId := th.BasicChannel.Id

	rusers, resp := Client.GetUsersInChannel(channelId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetUsersInChannel(channelId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersInChannel(channelId, 1, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersInChannel(channelId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	Client.Logout()
	_, resp = Client.GetUsersInChannel(channelId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetUsersInChannel(channelId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersInChannel(channelId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetUsersNotInChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	teamId := th.BasicTeam.Id
	channelId := th.BasicChannel.Id

	user := th.CreateUser()
	th.LinkUserToTeam(user, th.BasicTeam)

	rusers, resp := Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckNoError(t, resp)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp = Client.GetUsersNotInChannel(teamId, channelId, 0, 1, "")
	CheckNoError(t, resp)
	if len(rusers) != 1 {
		t.Log(len(rusers))
		t.Fatal("should be 1 per page")
	}

	rusers, resp = Client.GetUsersNotInChannel(teamId, channelId, 10000, 100, "")
	CheckNoError(t, resp)
	if len(rusers) != 0 {
		t.Fatal("should be no users")
	}

	Client.Logout()
	_, resp = Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	Client.Login(user.Email, user.Password)
	_, resp = Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	CheckNoError(t, resp)
}

func TestUpdateUserMfa(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	session, _ := th.App.GetSession(Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	_, resp := Client.UpdateUserMfa(th.BasicUser.Id, "12345", false)
	CheckForbiddenStatus(t, resp)
}

func TestCheckUserMfa(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	required, resp := Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	_, resp = Client.CheckUserMfa("")
	CheckBadRequestStatus(t, resp)

	Client.Logout()

	required, resp = Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	th.App.SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	th.LoginBasic()

	required, resp = Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}

	Client.Logout()

	required, resp = Client.CheckUserMfa(th.BasicUser.Email)
	CheckNoError(t, resp)

	if required {
		t.Fatal("should be false - mfa not active")
	}
}

func TestGenerateMfaSecret(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.GenerateMfaSecret(th.BasicUser.Id)
	CheckNotImplementedStatus(t, resp)

	_, resp = th.SystemAdminClient.GenerateMfaSecret(th.BasicUser.Id)
	CheckNotImplementedStatus(t, resp)

	_, resp = Client.GenerateMfaSecret("junk")
	CheckBadRequestStatus(t, resp)

	th.App.SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	_, resp = Client.GenerateMfaSecret(model.NewId())
	CheckForbiddenStatus(t, resp)

	session, _ := th.App.GetSession(Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	_, resp = Client.GenerateMfaSecret(th.BasicUser.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GenerateMfaSecret(th.BasicUser.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateUserPassword(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	password := "newpassword1"
	pass, resp := Client.UpdateUserPassword(th.BasicUser.Id, th.BasicUser.Password, password)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have returned true")
	}

	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, password, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, password, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateUserPassword("junk", password, password)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, "", password)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, "junk", password)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, password, th.BasicUser.Password)
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, password, password)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, password, password)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	// Test lockout
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 2 })

	// Fail twice
	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, "badpwd", "newpwd")
	CheckBadRequestStatus(t, resp)
	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, "badpwd", "newpwd")
	CheckBadRequestStatus(t, resp)

	// Should fail because account is locked out
	_, resp = Client.UpdateUserPassword(th.BasicUser.Id, th.BasicUser.Password, "newpwd")
	CheckErrorMessage(t, resp, "api.user.check_user_login_attempts.too_many.app_error")
	CheckUnauthorizedStatus(t, resp)

	// System admin can update another user's password
	adminSetPassword := "pwdsetbyadmin"
	pass, resp = th.SystemAdminClient.UpdateUserPassword(th.BasicUser.Id, "", adminSetPassword)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have returned true")
	}

	_, resp = Client.Login(th.BasicUser.Email, adminSetPassword)
	CheckNoError(t, resp)
}

/*func TestResetPassword(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.Client
	Client.Logout()
	user := th.BasicUser
	// Delete all the messages before check the reset password
	mailservice.DeleteMailBox(user.Email)
	success, resp := Client.SendPasswordResetEmail(user.Email)
	CheckNoError(t, resp)
	if !success {
		t.Fatal("should have succeeded")
	}
	_, resp = Client.SendPasswordResetEmail("")
	CheckBadRequestStatus(t, resp)
	// Should not leak whether the email is attached to an account or not
	success, resp = Client.SendPasswordResetEmail("notreal@example.com")
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
	_, resp = Client.ResetPassword(recoveryToken.Token, "")
	CheckBadRequestStatus(t, resp)
	_, resp = Client.ResetPassword(recoveryToken.Token, "newp")
	CheckBadRequestStatus(t, resp)
	_, resp = Client.ResetPassword("", "newpwd")
	CheckBadRequestStatus(t, resp)
	_, resp = Client.ResetPassword("junk", "newpwd")
	CheckBadRequestStatus(t, resp)
	code := ""
	for i := 0; i < model.TOKEN_SIZE; i++ {
		code += "a"
	}
	_, resp = Client.ResetPassword(code, "newpwd")
	CheckBadRequestStatus(t, resp)
	success, resp = Client.ResetPassword(recoveryToken.Token, "newpwd")
	CheckNoError(t, resp)
	if !success {
		t.Fatal("should have succeeded")
	}
	Client.Login(user.Email, "newpwd")
	Client.Logout()
	_, resp = Client.ResetPassword(recoveryToken.Token, "newpwd")
	CheckBadRequestStatus(t, resp)
	authData := model.NewId()
	if result := <-app.Srv.Store.User().UpdateAuthData(user.Id, "random", &authData, "", true); result.Err != nil {
		t.Fatal(result.Err)
	}
	_, resp = Client.SendPasswordResetEmail(user.Email)
	CheckBadRequestStatus(t, resp)
}*/

func TestGetSessions(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.BasicUser

	Client.Login(user.Email, user.Password)

	sessions, resp := Client.GetSessions(user.Id, "")
	for _, session := range sessions {
		if session.UserId != user.Id {
			t.Fatal("user id does not match session user id")
		}
	}
	CheckNoError(t, resp)

	_, resp = Client.RevokeSession("junk", model.NewId())
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetSessions(th.BasicUser2.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetSessions(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetSessions(th.BasicUser2.Id, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetSessions(user.Id, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetSessions(th.BasicUser2.Id, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetSessions(model.NewId(), "")
	CheckNoError(t, resp)
}

func TestRevokeSessions(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.BasicUser
	Client.Login(user.Email, user.Password)
	sessions, _ := Client.GetSessions(user.Id, "")
	if len(sessions) == 0 {
		t.Fatal("sessions should exist")
	}
	for _, session := range sessions {
		if session.UserId != user.Id {
			t.Fatal("user id does not match session user id")
		}
	}
	session := sessions[0]

	_, resp := Client.RevokeSession(user.Id, model.NewId())
	CheckBadRequestStatus(t, resp)

	_, resp = Client.RevokeSession(th.BasicUser2.Id, model.NewId())
	CheckForbiddenStatus(t, resp)

	_, resp = Client.RevokeSession("junk", model.NewId())
	CheckBadRequestStatus(t, resp)

	status, resp := Client.RevokeSession(user.Id, session.Id)
	if !status {
		t.Fatal("user session revoke unsuccessful")
	}
	CheckNoError(t, resp)

	th.LoginBasic()

	sessions, _ = th.App.GetSessions(th.SystemAdminUser.Id)
	session = sessions[0]

	_, resp = Client.RevokeSession(user.Id, session.Id)
	CheckBadRequestStatus(t, resp)

	Client.Logout()
	_, resp = Client.RevokeSession(user.Id, model.NewId())
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
	Client := th.Client

	user := th.BasicUser
	Client.Login(user.Email, user.Password)

	_, resp := Client.RevokeAllSessions(th.BasicUser2.Id)
	CheckForbiddenStatus(t, resp)

	th.InitSystemAdmin()

	_, resp = Client.RevokeAllSessions("junk" + user.Id)
	CheckBadRequestStatus(t, resp)

	status, resp := Client.RevokeAllSessions(user.Id)
	if !status {
		t.Fatal("user all sessions revoke unsuccessful")
	}
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.RevokeAllSessions(user.Id)
	CheckUnauthorizedStatus(t, resp)

	Client.Login(user.Email, user.Password)

	sessions, _ := Client.GetSessions(user.Id, "")
	if len(sessions) < 1 {
		t.Fatal("session should exist")
	}

	_, resp = Client.RevokeAllSessions(user.Id)
	CheckNoError(t, resp)

	sessions, _ = th.SystemAdminClient.GetSessions(user.Id, "")
	if len(sessions) != 0 {
		t.Fatal("no sessions should exist for user")
	}

	_, resp = Client.RevokeAllSessions(user.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestAttachDeviceId(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	deviceId := model.PUSH_NOTIFY_APPLE + ":1234567890"
	pass, resp := Client.AttachDeviceId(deviceId)
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

	_, resp = Client.AttachDeviceId("")
	CheckBadRequestStatus(t, resp)

	Client.Logout()

	_, resp = Client.AttachDeviceId("")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUserAudits(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser

	audits, resp := Client.GetUserAudits(user.Id, 0, 100, "")
	for _, audit := range audits {
		if audit.UserId != user.Id {
			t.Fatal("user id does not match audit user id")
		}
	}
	CheckNoError(t, resp)

	_, resp = Client.GetUserAudits(th.BasicUser2.Id, 0, 100, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetUserAudits(user.Id, 0, 100, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetUserAudits(user.Id, 0, 100, "")
	CheckNoError(t, resp)
}

func TestVerifyUserEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Darth Vader", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID}

	ruser, _ := Client.CreateUser(&user)

	token, err := th.App.CreateVerifyEmailToken(ruser.Id)
	if err != nil {
		t.Fatal("Unable to create email verify token")
	}

	_, resp := Client.VerifyUserEmail(token.Token)
	CheckNoError(t, resp)

	_, resp = Client.VerifyUserEmail(GenerateTestId())
	CheckBadRequestStatus(t, resp)

	_, resp = Client.VerifyUserEmail("")
	CheckBadRequestStatus(t, resp)
}

func TestSendVerificationEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	pass, resp := Client.SendVerificationEmail(th.BasicUser.Email)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	_, resp = Client.SendVerificationEmail("")
	CheckBadRequestStatus(t, resp)

	// Even non-existent emails should return 200 OK
	_, resp = Client.SendVerificationEmail(th.GenerateTestEmail())
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.SendVerificationEmail(th.BasicUser.Email)
	CheckNoError(t, resp)
}

func TestSetProfileImage(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser

	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	}

	ok, resp := Client.SetProfileImage(user.Id, data)
	if !ok {
		t.Fatal(resp.Error)
	}
	CheckNoError(t, resp)

	ok, resp = Client.SetProfileImage(model.NewId(), data)
	if ok {
		t.Fatal("Should return false, set profile image not allowed")
	}
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	Client.Logout()
	_, resp = Client.SetProfileImage(user.Id, data)
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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser

	ok, resp := Client.SetDefaultProfileImage(user.Id)
	if !ok {
		t.Fatal(resp.Error)
	}
	CheckNoError(t, resp)

	ok, resp = Client.SetDefaultProfileImage(model.NewId())
	if ok {
		t.Fatal("Should return false, set profile image not allowed")
	}
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetDefaultProfileImage when request is terminated early by server
	Client.Logout()
	_, resp = Client.SetDefaultProfileImage(user.Id)
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

func TestCBALogin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	Client.Logout()

	th.App.SetLicense(model.NewTestLicense("saml"))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ExperimentalSettings.ClientSideCertEnable = true
		*cfg.ExperimentalSettings.ClientSideCertCheck = model.CLIENT_SIDE_CERT_CHECK_PRIMARY_AUTH
	})

	user, resp := Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	if resp.Error.StatusCode != 400 && user == nil {
		t.Fatal("Should have failed because it's missing the cert header")
	}

	Client.HttpHeader["X-SSL-Client-Cert"] = "valid_cert_fake"
	user, resp = Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	if resp.Error.StatusCode != 400 && user == nil {
		t.Fatal("Should have failed because it's missing the cert subject")
	}

	Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=mis_match" + th.BasicUser.Email
	user, resp = Client.Login(th.BasicUser.Email, "")
	if resp.Error.StatusCode != 400 && user == nil {
		t.Fatal("Should have failed because the emails mismatch")
	}

	Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
	user, _ = Client.Login(th.BasicUser.Email, "")
	if !(user != nil && user.Email == th.BasicUser.Email) {
		t.Fatal("Should have been able to login")
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ExperimentalSettings.ClientSideCertEnable = true
		*cfg.ExperimentalSettings.ClientSideCertCheck = model.CLIENT_SIDE_CERT_CHECK_SECONDARY_AUTH
	})

	Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
	user, _ = Client.Login(th.BasicUser.Email, "")
	if resp.Error.StatusCode != 400 && user == nil {
		t.Fatal("Should have failed because password is required")
	}

	Client.HttpHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
	user, _ = Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	if !(user != nil && user.Email == th.BasicUser.Email) {
		t.Fatal("Should have been able to login")
	}
}

func TestSwitchAccount(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Enable = true })

	Client.Logout()

	sr := &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
		Email:          th.BasicUser.Email,
		Password:       th.BasicUser.Password,
	}

	link, resp := Client.SwitchAccountType(sr)
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

	_, resp = Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_SAML,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	_, resp = Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_LDAP,
	}

	_, resp = Client.SwitchAccountType(sr)
	CheckForbiddenStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_LDAP,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
	}

	_, resp = Client.SwitchAccountType(sr)
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

	link, resp = Client.SwitchAccountType(sr)
	CheckNoError(t, resp)

	if link != "/login?extra=signin_change" {
		t.Log(link)
		t.Fatal("bad link")
	}

	Client.Logout()
	_, resp = Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	CheckNoError(t, resp)
	Client.Logout()

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_GITLAB,
		NewService:     model.SERVICE_GOOGLE,
	}

	_, resp = Client.SwitchAccountType(sr)
	CheckBadRequestStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
		Password:       th.BasicUser.Password,
	}

	_, resp = Client.SwitchAccountType(sr)
	CheckNotFoundStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_EMAIL,
		NewService:     model.USER_AUTH_SERVICE_GITLAB,
		Email:          th.BasicUser.Email,
	}

	_, resp = Client.SwitchAccountType(sr)
	CheckUnauthorizedStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.USER_AUTH_SERVICE_GITLAB,
		NewService:     model.USER_AUTH_SERVICE_EMAIL,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	_, resp = Client.SwitchAccountType(sr)
	CheckUnauthorizedStatus(t, resp)
}

func TestCreateUserAccessToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	_, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.CreateUserAccessToken("notarealuserid", testDescription)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.CreateUserAccessToken(th.BasicUser.Id, "")
	CheckBadRequestStatus(t, resp)

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })
	_, resp = Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNotImplementedStatus(t, resp)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	rtoken, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	if rtoken.UserId != th.BasicUser.Id {
		t.Fatal("wrong user id")
	} else if rtoken.Token == "" {
		t.Fatal("token should not be empty")
	} else if rtoken.Id == "" {
		t.Fatal("id should not be empty")
	} else if rtoken.Description != testDescription {
		t.Fatal("description did not match")
	} else if !rtoken.IsActive {
		t.Fatal("token should be active")
	}

	oldSessionToken := Client.AuthToken
	Client.AuthToken = rtoken.Token
	ruser, resp := Client.GetMe("")
	CheckNoError(t, resp)

	if ruser.Id != th.BasicUser.Id {
		t.Fatal("returned wrong user")
	}

	Client.AuthToken = oldSessionToken

	_, resp = Client.CreateUserAccessToken(th.BasicUser2.Id, testDescription)
	CheckForbiddenStatus(t, resp)

	rtoken, resp = AdminClient.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	if rtoken.UserId != th.BasicUser.Id {
		t.Fatal("wrong user id")
	}

	oldSessionToken = Client.AuthToken
	Client.AuthToken = rtoken.Token
	ruser, resp = Client.GetMe("")
	CheckNoError(t, resp)

	if ruser.Id != th.BasicUser.Id {
		t.Fatal("returned wrong user")
	}

	Client.AuthToken = oldSessionToken

	session, _ := th.App.GetSession(Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	_, resp = Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckForbiddenStatus(t, resp)
}

func TestGetUserAccessToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	_, resp := Client.GetUserAccessToken("123")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetUserAccessToken(model.NewId())
	CheckForbiddenStatus(t, resp)

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	rtoken, resp := Client.GetUserAccessToken(token.Id)
	CheckNoError(t, resp)

	if rtoken.UserId != th.BasicUser.Id {
		t.Fatal("wrong user id")
	} else if rtoken.Token != "" {
		t.Fatal("token should be blank")
	} else if rtoken.Id == "" {
		t.Fatal("id should not be empty")
	} else if rtoken.Description != testDescription {
		t.Fatal("description did not match")
	}

	_, resp = AdminClient.GetUserAccessToken(token.Id)
	CheckNoError(t, resp)

	_, resp = Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	rtokens, resp := Client.GetUserAccessTokensForUser(th.BasicUser.Id, 0, 100)
	CheckNoError(t, resp)

	if len(rtokens) != 2 {
		t.Fatal("should have 2 tokens")
	}

	for _, uat := range rtokens {
		if uat.UserId != th.BasicUser.Id {
			t.Fatal("wrong user id")
		}
	}

	rtokens, resp = Client.GetUserAccessTokensForUser(th.BasicUser.Id, 1, 1)
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 token")
	}

	rtokens, resp = AdminClient.GetUserAccessTokensForUser(th.BasicUser.Id, 0, 100)
	CheckNoError(t, resp)

	if len(rtokens) != 2 {
		t.Fatal("should have 2 tokens")
	}

	_, resp = Client.GetUserAccessTokens(0, 100)
	CheckForbiddenStatus(t, resp)

	rtokens, resp = AdminClient.GetUserAccessTokens(1, 1)
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 token")
	}

	rtokens, resp = AdminClient.GetUserAccessTokens(0, 2)
	CheckNoError(t, resp)

	if len(rtokens) != 2 {
		t.Fatal("should have 2 tokens")
	}
}

func TestSearchUserAccessToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	_, resp = Client.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: token.Id})
	CheckForbiddenStatus(t, resp)

	rtokens, resp := AdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: th.BasicUser.Id})
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 tokens")
	}

	rtokens, resp = AdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: token.Id})
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 tokens")
	}

	rtokens, resp = AdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: th.BasicUser.Username})
	CheckNoError(t, resp)

	if len(rtokens) != 1 {
		t.Fatal("should have 1 tokens")
	}

	rtokens, resp = AdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: "not found"})
	CheckNoError(t, resp)

	if len(rtokens) != 0 {
		t.Fatal("should have 0 tokens")
	}
}

func TestRevokeUserAccessToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	oldSessionToken := Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckNoError(t, resp)
	Client.AuthToken = oldSessionToken

	ok, resp := Client.RevokeUserAccessToken(token.Id)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have passed")
	}

	oldSessionToken = Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
	Client.AuthToken = oldSessionToken

	token, resp = AdminClient.CreateUserAccessToken(th.BasicUser2.Id, testDescription)
	CheckNoError(t, resp)

	ok, resp = Client.RevokeUserAccessToken(token.Id)
	CheckForbiddenStatus(t, resp)

	if ok {
		t.Fatal("should have failed")
	}
}

func TestDisableUserAccessToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	testDescription := "test token"

	*th.App.Config().ServiceSettings.EnableUserAccessTokens = true

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	oldSessionToken := Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckNoError(t, resp)
	Client.AuthToken = oldSessionToken

	ok, resp := Client.DisableUserAccessToken(token.Id)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have passed")
	}

	oldSessionToken = Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
	Client.AuthToken = oldSessionToken

	token, resp = AdminClient.CreateUserAccessToken(th.BasicUser2.Id, testDescription)
	CheckNoError(t, resp)

	ok, resp = Client.DisableUserAccessToken(token.Id)
	CheckForbiddenStatus(t, resp)

	if ok {
		t.Fatal("should have failed")
	}
}

func TestEnableUserAccessToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	testDescription := "test token"

	*th.App.Config().ServiceSettings.EnableUserAccessTokens = true

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	oldSessionToken := Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckNoError(t, resp)
	Client.AuthToken = oldSessionToken

	_, resp = Client.DisableUserAccessToken(token.Id)
	CheckNoError(t, resp)

	oldSessionToken = Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
	Client.AuthToken = oldSessionToken

	ok, resp := Client.EnableUserAccessToken(token.Id)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have passed")
	}

	oldSessionToken = Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckNoError(t, resp)
	Client.AuthToken = oldSessionToken
}

func TestUserAccessTokenInactiveUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckNoError(t, resp)

	th.App.UpdateActive(th.BasicUser, false)

	_, resp = Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)
}

func TestUserAccessTokenDisableConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.BasicUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)
	token, resp := Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	CheckNoError(t, resp)

	oldSessionToken := Client.AuthToken
	Client.AuthToken = token.Token
	_, resp = Client.GetMe("")
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })

	_, resp = Client.GetMe("")
	CheckUnauthorizedStatus(t, resp)

	Client.AuthToken = oldSessionToken
	_, resp = Client.GetMe("")
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

func TestRegisterServiceTermsAction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	success, resp := Client.RegisterServiceTermsAction(th.BasicUser.Id, "st_1", true)
	CheckErrorMessage(t, resp, "store.sql_service_terms_store.get.no_rows.app_error")

	serviceTerms, err := th.App.CreateServiceTerms("service terms", th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}

	success, resp = Client.RegisterServiceTermsAction(th.BasicUser.Id, serviceTerms.Id, true)
	CheckNoError(t, resp)

	assert.True(t, *success)
	user, err := th.App.GetUser(th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, user.AcceptedServiceTermsId, serviceTerms.Id)
}
