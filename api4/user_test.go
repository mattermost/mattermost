// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/dgryski/dgoogauth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/utils/testutils"

	_ "github.com/mattermost/mattermost-server/v6/model/gitlab"
)

func TestCreateUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := model.User{
		Email:         th.GenerateTestEmail(),
		Nickname:      "Corey Hulen",
		Password:      "hello1",
		Username:      GenerateTestUsername(),
		Roles:         model.SystemAdminRoleId + " " + model.SystemUserRoleId,
		EmailVerified: true,
	}

	ruser, resp, err := th.Client.CreateUser(&user)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	// Creating a user as a regular user with verified flag should not verify the new user.
	require.False(t, ruser.EmailVerified)

	_, _, _ = th.Client.Login(user.Email, user.Password)

	require.Equal(t, user.Nickname, ruser.Nickname, "nickname didn't match")
	require.Equal(t, model.SystemUserRoleId, ruser.Roles, "did not clear roles")

	CheckUserSanitization(t, ruser)

	_, resp, err = th.Client.CreateUser(ruser)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	ruser.Id = ""
	ruser.Username = GenerateTestUsername()
	ruser.Password = "passwd1"
	_, resp, err = th.Client.CreateUser(ruser)
	CheckErrorID(t, err, "app.user.save.email_exists.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Email = th.GenerateTestEmail()
	ruser.Username = user.Username
	_, resp, err = th.Client.CreateUser(ruser)
	CheckErrorID(t, err, "app.user.save.username_exists.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Email = ""
	_, resp, err = th.Client.CreateUser(ruser)
	CheckErrorID(t, err, "model.user.is_valid.email.app_error")
	CheckBadRequestStatus(t, resp)

	ruser.Username = "testinvalid+++"
	_, resp, err = th.Client.CreateUser(ruser)
	CheckErrorID(t, err, "model.user.is_valid.username.app_error")
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user2 := &model.User{Email: th.GenerateTestEmail(), Password: "Password1", Username: GenerateTestUsername(), EmailVerified: true}
		ruser2, _, err2 := client.CreateUser(user2)
		require.NoError(t, err2)
		// Creating a user as sysadmin should verify the user with the EmailVerified flag.
		require.True(t, ruser2.EmailVerified)

		r, err2 := client.DoAPIPost("/users", "garbage")
		require.Error(t, err2, "should have errored")
		assert.Equal(t, http.StatusBadRequest, r.StatusCode)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		email := th.GenerateTestEmail()
		user2 := &model.User{Email: email, Password: "Password1", Username: GenerateTestUsername(), EmailVerified: true}
		_, _, err = client.CreateUser(user2)
		require.NoError(t, err)
		_, appErr := th.App.GetUserByUsername(user2.Username)
		require.Nil(t, appErr)

		user3 := &model.User{Email: fmt.Sprintf(" %s  ", email), Password: "Password1", Username: GenerateTestUsername(), EmailVerified: true}
		_, resp, err = client.CreateUser(user3)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		_, appErr = th.App.GetUserByUsername(user3.Username)
		require.NotNil(t, appErr)
	}, "Should not be able to create two users with the same email but spaces in it")
}

func TestCreateUserInputFilter(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("DomainRestriction", func(t *testing.T) {

		enableAPIUserDeletion := th.App.Config().ServiceSettings.EnableAPIUserDeletion
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.EnableOpenServer = true
			*cfg.TeamSettings.EnableUserCreation = true
			*cfg.TeamSettings.RestrictCreationToDomains = "mattermost.com"
			*cfg.ServiceSettings.EnableAPIUserDeletion = true
		})

		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictCreationToDomains = ""
			*cfg.ServiceSettings.EnableAPIUserDeletion = *enableAPIUserDeletion
		})

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			user := &model.User{Email: "foobar+testdomainrestriction@mattermost.com", Password: "Password1", Username: GenerateTestUsername()}
			u, _, err := client.CreateUser(user) // we need the returned created user to use its Id for deletion.
			require.NoError(t, err)
			_, err = client.PermanentDeleteUser(u.Id)
			require.NoError(t, err)
		}, "ValidUser")

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			user := &model.User{Email: "foobar+testdomainrestriction@mattermost.org", Password: "Password1", Username: GenerateTestUsername()}
			_, resp, err := client.CreateUser(user)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		}, "InvalidEmail")

		t.Run("ValidAuthServiceFilter", func(t *testing.T) {
			t.Run("SystemAdminClient", func(t *testing.T) {
				user := &model.User{
					Email:       "foobar+testdomainrestriction@mattermost.org",
					Username:    GenerateTestUsername(),
					AuthService: "ldap",
					AuthData:    model.NewString("999099"),
				}
				u, _, err := th.SystemAdminClient.CreateUser(user)
				require.NoError(t, err)
				_, err = th.SystemAdminClient.PermanentDeleteUser(u.Id)
				require.NoError(t, err)
			})
			t.Run("LocalClient", func(t *testing.T) {
				user := &model.User{
					Email:       "foobar+testdomainrestrictionlocalclient@mattermost.org",
					Username:    GenerateTestUsername(),
					AuthService: "ldap",
					AuthData:    model.NewString("999100"),
				}
				u, _, err := th.LocalClient.CreateUser(user)
				require.NoError(t, err)
				_, err = th.LocalClient.PermanentDeleteUser(u.Id)
				require.NoError(t, err)
			})
		})

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			user := &model.User{Email: "foobar+testdomainrestriction@mattermost.org", Password: "Password1", Username: GenerateTestUsername(), AuthService: "ldap"}
			_, resp, err := th.Client.CreateUser(user)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		}, "InvalidAuthServiceFilter")
	})

	t.Run("Roles", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.EnableOpenServer = true
			*cfg.TeamSettings.EnableUserCreation = true
			*cfg.TeamSettings.RestrictCreationToDomains = ""
			*cfg.ServiceSettings.EnableAPIUserDeletion = true
		})

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			emailAddr := "foobar+testinvalidrole@mattermost.com"
			user := &model.User{Email: emailAddr, Password: "Password1", Username: GenerateTestUsername(), Roles: "system_user system_admin"}
			_, _, err := client.CreateUser(user)
			require.NoError(t, err)
			ruser, appErr := th.App.GetUserByEmail(emailAddr)
			require.Nil(t, appErr)
			assert.NotEqual(t, ruser.Roles, "system_user system_admin")
			_, err = client.PermanentDeleteUser(ruser.Id)
			require.NoError(t, err)
		}, "InvalidRole")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.EnableOpenServer = true
			*cfg.TeamSettings.EnableUserCreation = true
		})
		user := &model.User{Id: "AAAAAAAAAAAAAAAAAAAAAAAAAA", Email: "foobar+testinvalidid@mattermost.com", Password: "Password1", Username: GenerateTestUsername(), Roles: "system_user system_admin"}
		_, resp, err := client.CreateUser(user)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "InvalidId")
}

func TestCreateUserWithToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("CreateWithTokenHappyPath", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}
		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		ruser, resp, err := th.Client.CreateUserWithToken(&user, token.Token)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		require.Equal(t, user.Nickname, ruser.Nickname)
		require.Equal(t, model.SystemUserRoleId, ruser.Roles, "should clear roles")
		CheckUserSanitization(t, ruser)
		_, err = th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, err, "The token must be deleted after being used")

		teams, appErr := th.App.GetTeamsForUser(ruser.Id)
		require.Nil(t, appErr)
		require.NotEmpty(t, teams, "The user must have teams")
		require.Equal(t, th.BasicTeam.Id, teams[0].Id, "The user joined team must be the team provided.")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}
		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		ruser, resp, err := client.CreateUserWithToken(&user, token.Token)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		require.Equal(t, user.Nickname, ruser.Nickname)
		require.Equal(t, model.SystemUserRoleId, ruser.Roles, "should clear roles")
		CheckUserSanitization(t, ruser)
		_, err = th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, err, "The token must be deleted after being used")

		teams, appErr := th.App.GetTeamsForUser(ruser.Id)
		require.Nil(t, appErr)
		require.NotEmpty(t, teams, "The user must have teams")
		require.Equal(t, th.BasicTeam.Id, teams[0].Id, "The user joined team must be the team provided.")
	}, "CreateWithTokenHappyPath")

	t.Run("NoToken", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}
		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		_, _, err := th.Client.CreateUserWithToken(&user, "")
		require.Error(t, err)
		CheckErrorID(t, err, "api.user.create_user.missing_token.app_error")
	})

	t.Run("TokenExpired", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}
		timeNow := time.Now()
		past49Hours := timeNow.Add(-49*time.Hour).UnixNano() / int64(time.Millisecond)
		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		token.CreateAt = past49Hours
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		_, resp, err := th.Client.CreateUserWithToken(&user, token.Token)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.user.create_user.signup_link_expired.app_error")
	})

	t.Run("WrongToken", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		_, resp, err := th.Client.CreateUserWithToken(&user, "wrong")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		CheckErrorID(t, err, "api.user.create_user.signup_link_invalid.app_error")
	})

	t.Run("EnableUserCreationDisable", func(t *testing.T) {

		enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })
		}()

		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

		_, resp, err := th.Client.CreateUserWithToken(&user, token.Token)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "api.user.create_user.signup_email_disabled.app_error")

	})
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })

		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

		_, resp, err := client.CreateUserWithToken(&user, token.Token)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "api.user.create_user.signup_email_disabled.app_error")
	}, "EnableUserCreationDisable")

	t.Run("EnableOpenServerDisable", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		token := model.NewToken(
			app.TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		enableOpenServer := th.App.Config().TeamSettings.EnableOpenServer
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableOpenServer = enableOpenServer })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })

		ruser, resp, err := th.Client.CreateUserWithToken(&user, token.Token)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		require.Equal(t, user.Nickname, ruser.Nickname)
		require.Equal(t, model.SystemUserRoleId, ruser.Roles, "should clear roles")
		CheckUserSanitization(t, ruser)
		_, err = th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, err, "The token must be deleted after be used")
	})
}

func TestCreateUserWebSocketEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("guest should not received new_user event but user should", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("guests"))
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.AllowEmailAccounts = true })

		id := model.NewId()
		guestPassword := "Pa$$word11"
		guest := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      guestPassword,
			EmailVerified: true,
		}

		guest, errr := th.App.CreateGuest(th.Context, guest)
		require.Nil(t, errr)

		_, _, errr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, "")
		require.Nil(t, errr)

		_, errr = th.App.AddUserToChannel(th.Context, guest, th.BasicChannel, false)
		require.Nil(t, errr)

		guestClient := th.CreateClient()

		_, _, err := guestClient.Login(guest.Email, guestPassword)
		require.NoError(t, err)

		guestWSClient, err := th.CreateWebSocketClientWithClient(guestClient)
		require.NoError(t, err)
		defer guestWSClient.Close()
		guestWSClient.Listen()

		userWSClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer userWSClient.Close()
		userWSClient.Listen()

		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		inviteId := th.BasicTeam.InviteId

		_, resp, err := th.Client.CreateUserWithInviteId(&user, inviteId)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		var userHasReceived bool
		var guestHasReceived bool

		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventNewUser {
						userHasReceived = true
					}
				case ev := <-guestWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventNewUser {
						guestHasReceived = true
					}
				case <-time.After(2 * time.Second):
					return
				}
			}
		}()

		require.Truef(t, userHasReceived, "User should have received %s event", model.WebsocketEventNewUser)
		require.Falsef(t, guestHasReceived, "Guest should not have received %s event", model.WebsocketEventNewUser)
	})
}

func TestCreateUserWithInviteId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("CreateWithInviteIdHappyPath", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		inviteId := th.BasicTeam.InviteId

		ruser, resp, err := th.Client.CreateUserWithInviteId(&user, inviteId)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		require.Equal(t, user.Nickname, ruser.Nickname)
		require.Equal(t, model.SystemUserRoleId, ruser.Roles, "should clear roles")
		CheckUserSanitization(t, ruser)
	})
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		inviteId := th.BasicTeam.InviteId

		ruser, resp, err := client.CreateUserWithInviteId(&user, inviteId)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		require.Equal(t, user.Nickname, ruser.Nickname)
		require.Equal(t, model.SystemUserRoleId, ruser.Roles, "should clear roles")
		CheckUserSanitization(t, ruser)
	}, "CreateWithInviteIdHappyPath")

	t.Run("GroupConstrainedTeam", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		th.BasicTeam.GroupConstrained = model.NewBool(true)
		team, appErr := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, appErr)

		defer func() {
			th.BasicTeam.GroupConstrained = model.NewBool(false)
			_, appErr = th.App.UpdateTeam(th.BasicTeam)
			require.Nil(t, appErr)
		}()

		inviteID := team.InviteId

		_, _, err := th.Client.CreateUserWithInviteId(&user, inviteID)
		CheckErrorID(t, err, "app.team.invite_id.group_constrained.error")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		th.BasicTeam.GroupConstrained = model.NewBool(true)
		team, appErr := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, appErr)

		defer func() {
			th.BasicTeam.GroupConstrained = model.NewBool(false)
			_, appErr = th.App.UpdateTeam(th.BasicTeam)
			require.Nil(t, appErr)
		}()

		inviteID := team.InviteId

		_, _, err := client.CreateUserWithInviteId(&user, inviteID)
		CheckErrorID(t, err, "app.team.invite_id.group_constrained.error")
	}, "GroupConstrainedTeam")

	t.Run("WrongInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		inviteId := model.NewId()

		_, resp, err := th.Client.CreateUserWithInviteId(&user, inviteId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		CheckErrorID(t, err, "app.team.get_by_invite_id.finding.app_error")
	})

	t.Run("NoInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		_, _, err := th.Client.CreateUserWithInviteId(&user, "")
		require.Error(t, err)
		CheckErrorID(t, err, "api.user.create_user.missing_invite_id.app_error")
	})

	t.Run("ExpiredInviteId", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		inviteId := th.BasicTeam.InviteId

		_, _, err := th.SystemAdminClient.RegenerateTeamInviteId(th.BasicTeam.Id)
		require.NoError(t, err)

		_, resp, err := th.Client.CreateUserWithInviteId(&user, inviteId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		CheckErrorID(t, err, "app.team.get_by_invite_id.finding.app_error")
	})

	t.Run("EnableUserCreationDisable", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

		inviteId := th.BasicTeam.InviteId

		_, resp, err := th.Client.CreateUserWithInviteId(&user, inviteId)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "api.user.create_user.signup_email_disabled.app_error")
	})
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		enableUserCreation := th.App.Config().TeamSettings.EnableUserCreation
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableUserCreation = enableUserCreation })

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserCreation = false })

		inviteId := th.BasicTeam.InviteId
		_, resp, err := client.CreateUserWithInviteId(&user, inviteId)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "api.user.create_user.signup_email_disabled.app_error")
	}, "EnableUserCreationDisable")

	t.Run("EnableOpenServerDisable", func(t *testing.T) {
		user := model.User{Email: th.GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		enableOpenServer := th.App.Config().TeamSettings.EnableOpenServer
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.EnableOpenServer = enableOpenServer })
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = false })

		team, _, err := th.SystemAdminClient.RegenerateTeamInviteId(th.BasicTeam.Id)
		assert.NoError(t, err)
		inviteId := team.InviteId

		ruser, resp, err := th.Client.CreateUserWithInviteId(&user, inviteId)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.Client.Login(user.Email, user.Password)
		require.Equal(t, user.Nickname, ruser.Nickname)
		require.Equal(t, model.SystemUserRoleId, ruser.Roles, "should clear roles")
		CheckUserSanitization(t, ruser)
	})
}

func TestGetMe(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	ruser, _, err := th.Client.GetMe("")
	require.NoError(t, err)

	require.Equal(t, th.BasicUser.Id, ruser.Id)

	th.Client.Logout()
	_, resp, err := th.Client.GetMe("")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	user.Props = map[string]string{"testpropkey": "testpropvalue"}

	th.App.UpdateUser(th.Context, user, false)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		ruser, resp, err := client.GetUser(user.Id, "")
		require.NoError(t, err)
		CheckUserSanitization(t, ruser)

		require.Equal(t, user.Email, ruser.Email)

		assert.NotNil(t, ruser.Props)
		assert.Equal(t, ruser.Props["testpropkey"], "testpropvalue")
		require.False(t, ruser.IsBot)

		ruser, resp, _ = client.GetUser(user.Id, resp.Etag)
		CheckEtag(t, ruser, resp)

		_, resp, err = client.GetUser("junk", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetUser(model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	ruser, _, err := th.Client.GetUser(user.Id, "")
	require.NoError(t, err)

	require.Empty(t, ruser.Email, "email should be blank")
	require.Empty(t, ruser.FirstName, "first name should be blank")
	require.Empty(t, ruser.LastName, "last name should be blank")

	th.Client.Logout()
	_, resp, err := th.Client.GetUser(user.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// System admins should ignore privacy settings
	ruser, _, _ = th.SystemAdminClient.GetUser(user.Id, resp.Etag)
	require.NotEmpty(t, ruser.Email, "email should not be blank")
	require.NotEmpty(t, ruser.FirstName, "first name should not be blank")
	require.NotEmpty(t, ruser.LastName, "last name should not be blank")
}

func TestGetUserWithAcceptedTermsOfServiceForOtherUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)

	th.App.UpdateUser(th.Context, user, false)

	ruser, _, err := th.Client.GetUser(user.Id, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	assert.Empty(t, ruser.TermsOfServiceId)

	th.App.SaveUserTermsOfService(user.Id, tos.Id, true)

	ruser, _, err = th.Client.GetUser(user.Id, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	// user TOS data cannot be fetched for other users by non-admin users
	assert.Empty(t, ruser.TermsOfServiceId)
}

func TestGetUserWithAcceptedTermsOfService(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)

	ruser, _, err := th.Client.GetUser(user.Id, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	assert.Empty(t, ruser.TermsOfServiceId)

	th.App.SaveUserTermsOfService(user.Id, tos.Id, true)

	ruser, _, err = th.Client.GetUser(user.Id, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	// a user can view their own TOS details
	assert.Equal(t, tos.Id, ruser.TermsOfServiceId)
}

func TestGetUserWithAcceptedTermsOfServiceWithAdminUser(t *testing.T) {
	th := Setup(t).InitBasic()
	th.LoginSystemAdmin()
	defer th.TearDown()

	user := th.BasicUser

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)

	ruser, _, err := th.SystemAdminClient.GetUser(user.Id, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	assert.Empty(t, ruser.TermsOfServiceId)

	th.App.SaveUserTermsOfService(user.Id, tos.Id, true)

	ruser, _, err = th.SystemAdminClient.GetUser(user.Id, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	// admin can view anyone's TOS details
	assert.Equal(t, tos.Id, ruser.TermsOfServiceId)
}

func TestGetBotUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

	th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.TeamUserRoleId, false)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})

	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
	}

	createdBot, resp, err := th.Client.CreateBot(bot)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(createdBot.UserId)

	botUser, _, err := th.Client.GetUser(createdBot.UserId, "")
	require.NoError(t, err)
	require.Equal(t, bot.Username, botUser.Username)
	require.True(t, botUser.IsBot)
}

func TestGetUserByUsername(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		ruser, resp, err := client.GetUserByUsername(user.Username, "")
		require.NoError(t, err)
		CheckUserSanitization(t, ruser)

		require.Equal(t, user.Email, ruser.Email)

		ruser, resp, _ = client.GetUserByUsername(user.Username, resp.Etag)
		CheckEtag(t, ruser, resp)

		_, resp, err = client.GetUserByUsername(GenerateTestUsername(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	// Check against privacy config settings
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	ruser, _, err := th.Client.GetUserByUsername(th.BasicUser2.Username, "")
	require.NoError(t, err)

	require.Empty(t, ruser.Email, "email should be blank")
	require.Empty(t, ruser.FirstName, "first name should be blank")
	require.Empty(t, ruser.LastName, "last name should be blank")

	ruser, _, err = th.Client.GetUserByUsername(th.BasicUser.Username, "")
	require.NoError(t, err)
	require.NotEmpty(t, ruser.NotifyProps, "notify props should be sent")

	th.Client.Logout()
	_, resp, err := th.Client.GetUserByUsername(user.Username, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// System admins should ignore privacy settings
		ruser, _, _ = client.GetUserByUsername(user.Username, resp.Etag)
		require.NotEmpty(t, ruser.Email, "email should not be blank")
		require.NotEmpty(t, ruser.FirstName, "first name should not be blank")
		require.NotEmpty(t, ruser.LastName, "last name should not be blank")
	})
}

func TestGetUserByUsernameWithAcceptedTermsOfService(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	ruser, _, err := th.Client.GetUserByUsername(user.Username, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	tos, _ := th.App.CreateTermsOfService("Dummy TOS", user.Id)
	th.App.SaveUserTermsOfService(ruser.Id, tos.Id, true)

	ruser, _, err = th.Client.GetUserByUsername(user.Username, "")
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, user.Email, ruser.Email)

	require.Equal(t, tos.Id, ruser.TermsOfServiceId, "Terms of service ID should match")
}

func TestSaveUserTermsOfService(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("Invalid data", func(t *testing.T) {
		resp, err := th.Client.DoAPIPost("/users/"+th.BasicUser.Id+"/terms_of_service", "{}")
		require.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestGetUserByEmail(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	userWithSlash, _, err := th.SystemAdminClient.CreateUser(&model.User{
		Email:    "email/with/slashes@example.com",
		Username: GenerateTestUsername(),
		Password: "Pa$$word11",
	})
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PrivacySettings.ShowEmailAddress = true
		*cfg.PrivacySettings.ShowFullName = true
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		t.Run("should be able to get another user by email", func(t *testing.T) {
			ruser, _, err := client.GetUserByEmail(user.Email, "")
			require.NoError(t, err)
			CheckUserSanitization(t, ruser)

			require.Equal(t, user.Email, ruser.Email)
		})

		t.Run("Get user with a / character in the email", func(t *testing.T) {
			ruser, _, err := client.GetUserByEmail(userWithSlash.Email, "")
			require.NoError(t, err)
			require.Equal(t, ruser.Id, userWithSlash.Id)
		})

		t.Run("should return not modified when provided with a matching etag", func(t *testing.T) {
			_, resp, err := client.GetUserByEmail(user.Email, "")
			require.NoError(t, err)

			ruser, resp, _ := client.GetUserByEmail(user.Email, resp.Etag)
			CheckEtag(t, ruser, resp)
		})

		t.Run("should return bad request when given an invalid email", func(t *testing.T) {
			_, resp, err := client.GetUserByEmail(GenerateTestUsername(), "")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("should return 404 when given a non-existent email", func(t *testing.T) {
			_, resp, err := client.GetUserByEmail(th.GenerateTestEmail(), "")
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})

	t.Run("should sanitize full name for non-admin based on privacy settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = true
			*cfg.PrivacySettings.ShowFullName = false
		})

		ruser, _, err := th.Client.GetUserByEmail(user.Email, "")
		require.NoError(t, err)
		assert.Equal(t, "", ruser.FirstName, "first name should be blank")
		assert.Equal(t, "", ruser.LastName, "last name should be blank")

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = true
		})

		ruser, _, err = th.Client.GetUserByEmail(user.Email, "")
		require.NoError(t, err)
		assert.NotEqual(t, "", ruser.FirstName, "first name should be set")
		assert.NotEqual(t, "", ruser.LastName, "last name should be set")
	})

	t.Run("should return forbidden for non-admin when privacy settings hide email", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = false
		})

		_, resp, err := th.Client.GetUserByEmail(user.Email, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowEmailAddress = true
		})

		ruser, _, err := th.Client.GetUserByEmail(user.Email, "")
		require.NoError(t, err)
		assert.Equal(t, user.Email, ruser.Email, "email should be set")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("should not sanitize full name for admin, regardless of privacy settings", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PrivacySettings.ShowEmailAddress = true
				*cfg.PrivacySettings.ShowFullName = false
			})

			ruser, _, err := client.GetUserByEmail(user.Email, "")
			require.NoError(t, err)
			assert.NotEqual(t, "", ruser.FirstName, "first name should be set")
			assert.NotEqual(t, "", ruser.LastName, "last name should be set")

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PrivacySettings.ShowFullName = true
			})

			ruser, _, err = client.GetUserByEmail(user.Email, "")
			require.NoError(t, err)
			assert.NotEqual(t, "", ruser.FirstName, "first name should be set")
			assert.NotEqual(t, "", ruser.LastName, "last name should be set")
		})

		t.Run("should always return email for admin, regardless of privacy settings", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PrivacySettings.ShowEmailAddress = false
			})

			ruser, _, err := client.GetUserByEmail(user.Email, "")
			require.NoError(t, err)
			assert.Equal(t, user.Email, ruser.Email, "email should be set")

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PrivacySettings.ShowEmailAddress = true
			})

			ruser, _, err = client.GetUserByEmail(user.Email, "")
			require.NoError(t, err)
			assert.Equal(t, user.Email, ruser.Email, "email should be set")
		})
	})
}

func TestSearchUsers(t *testing.T) {
	t.Skip("MM-46450")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	search := &model.UserSearch{Term: th.BasicUser.Username}

	users, _, err := th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.True(t, findUserInList(th.BasicUser.Id, users), "should have found user")

	_, appErr := th.App.UpdateActive(th.Context, th.BasicUser2, false)
	require.Nil(t, appErr)

	search.Term = th.BasicUser2.Username
	search.AllowInactive = false

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(th.BasicUser2.Id, users), "should not have found user")

	search.AllowInactive = true

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.True(t, findUserInList(th.BasicUser2.Id, users), "should have found user")

	search.Term = th.BasicUser.Username
	search.AllowInactive = false
	search.TeamId = th.BasicTeam.Id

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.True(t, findUserInList(th.BasicUser.Id, users), "should have found user")

	search.NotInChannelId = th.BasicChannel.Id

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(th.BasicUser.Id, users), "should not have found user")

	search.TeamId = ""
	search.NotInChannelId = ""
	search.InChannelId = th.BasicChannel.Id

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.True(t, findUserInList(th.BasicUser.Id, users), "should have found user")

	search.InChannelId = ""
	search.NotInChannelId = th.BasicChannel.Id
	_, resp, err := th.Client.SearchUsers(search)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	search.NotInChannelId = model.NewId()
	search.TeamId = model.NewId()
	_, resp, err = th.Client.SearchUsers(search)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	search.NotInChannelId = ""
	search.TeamId = model.NewId()
	_, resp, err = th.Client.SearchUsers(search)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	search.InChannelId = model.NewId()
	search.TeamId = ""
	_, resp, err = th.Client.SearchUsers(search)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Test search for users not in any team
	search.TeamId = ""
	search.NotInChannelId = ""
	search.InChannelId = ""
	search.NotInTeamId = th.BasicTeam.Id

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(th.BasicUser.Id, users), "should not have found user")

	oddUser := th.CreateUser()
	search.Term = oddUser.Username

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.True(t, findUserInList(oddUser.Id, users), "should have found user")

	_, _, err = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, oddUser.Id)
	require.NoError(t, err)

	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(oddUser.Id, users), "should not have found user")

	search.NotInTeamId = model.NewId()
	_, resp, err = th.Client.SearchUsers(search)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	search.Term = th.BasicUser.Username

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

	_, appErr = th.App.UpdateActive(th.Context, th.BasicUser2, true)
	require.Nil(t, appErr)

	search.InChannelId = ""
	search.NotInTeamId = ""
	search.Term = th.BasicUser2.Email
	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(th.BasicUser2.Id, users), "should not have found user")

	search.Term = th.BasicUser2.FirstName
	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(th.BasicUser2.Id, users), "should not have found user")

	search.Term = th.BasicUser2.LastName
	users, _, err = th.Client.SearchUsers(search)
	require.NoError(t, err)

	require.False(t, findUserInList(th.BasicUser2.Id, users), "should not have found user")

	search.Term = th.BasicUser.FirstName
	search.InChannelId = th.BasicChannel.Id
	search.NotInChannelId = th.BasicChannel.Id
	search.TeamId = th.BasicTeam.Id
	users, _, err = th.SystemAdminClient.SearchUsers(search)
	require.NoError(t, err)

	require.True(t, findUserInList(th.BasicUser.Id, users), "should have found user")

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	search = &model.UserSearch{Term: th.BasicUser.Username, InGroupId: group.Id}
	t.Run("Requires ldap license when searching in group", func(t *testing.T) {
		_, resp, err = th.SystemAdminClient.SearchUsers(search)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Requires manage system permission when searching for users in a group", func(t *testing.T) {
		_, resp, err = th.Client.SearchUsers(search)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Returns empty list when no users found searching for users in a group", func(t *testing.T) {
		users, _, err = th.SystemAdminClient.SearchUsers(search)
		require.NoError(t, err)
		require.Empty(t, users)
	})

	_, appErr = th.App.UpsertGroupMember(group.Id, th.BasicUser.Id)
	assert.Nil(t, appErr)

	t.Run("Returns user in group user found in group", func(t *testing.T) {
		users, _, err = th.SystemAdminClient.SearchUsers(search)
		require.NoError(t, err)
		require.Equal(t, users[0].Id, th.BasicUser.Id)
	})
}

func findUserInList(id string, users []*model.User) bool { //nolint:unused
	for _, user := range users {
		if user.Id == id {
			return true
		}
	}
	return false
}

func TestAutocompleteUsersInChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id
	channelId := th.BasicChannel.Id
	username := th.BasicUser.Username
	newUser := th.CreateUser()

	tt := []struct {
		Name            string
		TeamId          string
		ChannelId       string
		Username        string
		ExpectedResults int
		MoreThan        bool
		ShouldFail      bool
	}{
		{
			"Autocomplete in channel for specific username",
			teamId,
			channelId,
			username,
			1,
			false,
			false,
		},
		{
			"Search for not valid username",
			teamId,
			channelId,
			"amazonses",
			0,
			false,
			false,
		},
		{
			"Search for all users",
			teamId,
			channelId,
			"",
			2,
			true,
			false,
		},
		{
			"Fail when the teamId is not provided",
			"",
			channelId,
			"",
			2,
			true,
			true,
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			th.LoginBasic()
			rusers, _, err := th.Client.AutocompleteUsersInChannel(tc.TeamId, tc.ChannelId, tc.Username, model.UserSearchDefaultLimit, "")
			if tc.ShouldFail {
				CheckErrorID(t, err, "api.user.autocomplete_users.missing_team_id.app_error")
			} else {
				require.NoError(t, err)
				if tc.MoreThan {
					assert.True(t, len(rusers.Users) >= tc.ExpectedResults)
				} else {
					assert.Len(t, rusers.Users, tc.ExpectedResults)
				}
			}

			th.Client.Logout()
			_, resp, err := th.Client.AutocompleteUsersInChannel(tc.TeamId, tc.ChannelId, tc.Username, model.UserSearchDefaultLimit, "")
			require.Error(t, err)
			CheckUnauthorizedStatus(t, resp)

			th.Client.Login(newUser.Email, newUser.Password)
			_, resp, err = th.Client.AutocompleteUsersInChannel(tc.TeamId, tc.ChannelId, tc.Username, model.UserSearchDefaultLimit, "")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	}

	t.Run("Check against privacy config settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

		th.LoginBasic()
		rusers, _, err := th.Client.AutocompleteUsersInChannel(teamId, channelId, username, model.UserSearchDefaultLimit, "")
		require.NoError(t, err)

		assert.Equal(t, rusers.Users[0].FirstName, "", "should not show first/last name")
		assert.Equal(t, rusers.Users[0].LastName, "", "should not show first/last name")
	})

	t.Run("Check OutOfChannel results with/without VIEW_MEMBERS permissions", func(t *testing.T) {
		permissionsUser := th.CreateUser()
		th.SystemAdminClient.DemoteUserToGuest(permissionsUser.Id)
		permissionsUser.Roles = "system_guest"
		th.LinkUserToTeam(permissionsUser, th.BasicTeam)
		th.AddUserToChannel(permissionsUser, th.BasicChannel)

		otherUser := th.CreateUser()
		th.LinkUserToTeam(otherUser, th.BasicTeam)

		th.Client.Login(permissionsUser.Email, permissionsUser.Password)

		rusers, _, err := th.Client.AutocompleteUsersInChannel(teamId, channelId, "", model.UserSearchDefaultLimit, "")
		require.NoError(t, err)
		assert.Len(t, rusers.OutOfChannel, 1)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
		th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)

		rusers, _, err = th.Client.AutocompleteUsersInChannel(teamId, channelId, "", model.UserSearchDefaultLimit, "")
		require.NoError(t, err)
		assert.Empty(t, rusers.OutOfChannel)

		th.App.GetOrCreateDirectChannel(th.Context, permissionsUser.Id, otherUser.Id)

		rusers, _, err = th.Client.AutocompleteUsersInChannel(teamId, channelId, "", model.UserSearchDefaultLimit, "")
		require.NoError(t, err)
		assert.Len(t, rusers.OutOfChannel, 1)
	})

	t.Run("user must have access to team id, especially when it does not match channel's team id", func(t *testing.T) {
		_, _, err := th.Client.AutocompleteUsersInChannel("otherTeamId", channelId, username, model.UserSearchDefaultLimit, "")
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})
}

func TestAutocompleteUsersInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id
	username := th.BasicUser.Username
	newUser := th.CreateUser()

	tt := []struct {
		Name            string
		TeamId          string
		Username        string
		ExpectedResults int
		MoreThan        bool
	}{
		{
			"specific username",
			teamId,
			username,
			1,
			false,
		},
		{
			"not valid username",
			teamId,
			"amazonses",
			0,
			false,
		},
		{
			"all users in team",
			teamId,
			"",
			2,
			true,
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			th.LoginBasic()
			rusers, _, err := th.Client.AutocompleteUsersInTeam(tc.TeamId, tc.Username, model.UserSearchDefaultLimit, "")
			require.NoError(t, err)
			if tc.MoreThan {
				assert.True(t, len(rusers.Users) >= tc.ExpectedResults)
			} else {
				assert.Len(t, rusers.Users, tc.ExpectedResults)
			}
			th.Client.Logout()
			_, resp, err := th.Client.AutocompleteUsersInTeam(tc.TeamId, tc.Username, model.UserSearchDefaultLimit, "")
			require.Error(t, err)
			CheckUnauthorizedStatus(t, resp)

			th.Client.Login(newUser.Email, newUser.Password)
			_, resp, err = th.Client.AutocompleteUsersInTeam(tc.TeamId, tc.Username, model.UserSearchDefaultLimit, "")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	}

	t.Run("Check against privacy config settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

		th.LoginBasic()
		rusers, _, err := th.Client.AutocompleteUsersInTeam(teamId, username, model.UserSearchDefaultLimit, "")
		require.NoError(t, err)

		assert.Equal(t, rusers.Users[0].FirstName, "", "should not show first/last name")
		assert.Equal(t, rusers.Users[0].LastName, "", "should not show first/last name")
	})
}

func TestAutocompleteUsers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	username := th.BasicUser.Username
	newUser := th.CreateUser()

	tt := []struct {
		Name            string
		Username        string
		ExpectedResults int
		MoreThan        bool
	}{
		{
			"specific username",
			username,
			1,
			false,
		},
		{
			"not valid username",
			"amazonses",
			0,
			false,
		},
		{
			"all users in team",
			"",
			2,
			true,
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			th.LoginBasic()
			rusers, _, err := th.Client.AutocompleteUsers(tc.Username, model.UserSearchDefaultLimit, "")
			require.NoError(t, err)
			if tc.MoreThan {
				assert.True(t, len(rusers.Users) >= tc.ExpectedResults)
			} else {
				assert.Len(t, rusers.Users, tc.ExpectedResults)
			}

			th.Client.Logout()
			_, resp, err := th.Client.AutocompleteUsers(tc.Username, model.UserSearchDefaultLimit, "")
			require.Error(t, err)
			CheckUnauthorizedStatus(t, resp)

			th.Client.Login(newUser.Email, newUser.Password)
			_, _, err = th.Client.AutocompleteUsers(tc.Username, model.UserSearchDefaultLimit, "")
			require.NoError(t, err)
		})
	}

	t.Run("Check against privacy config settings", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowFullName = false })

		th.LoginBasic()
		rusers, _, err := th.Client.AutocompleteUsers(username, model.UserSearchDefaultLimit, "")
		require.NoError(t, err)

		assert.Equal(t, rusers.Users[0].FirstName, "", "should not show first/last name")
		assert.Equal(t, rusers.Users[0].LastName, "", "should not show first/last name")
	})
}

func TestGetProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// recreate basic user
	th.BasicUser = th.CreateUser()
	th.LoginBasic()
	user := th.BasicUser

	data, resp, err := th.Client.GetProfileImage(user.Id, "")
	require.NoError(t, err)
	require.NotEmpty(t, data, "should not be empty")

	_, resp, _ = th.Client.GetProfileImage(user.Id, resp.Etag)
	require.NotEqual(t, http.StatusNotModified, resp.StatusCode, "should not hit etag")

	_, resp, err = th.Client.GetProfileImage("junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = th.Client.GetProfileImage(model.NewId(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.Client.Logout()
	_, resp, err = th.Client.GetProfileImage(user.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetProfileImage(user.Id, "")
	require.NoError(t, err)

	info := &model.FileInfo{Path: "/users/" + user.Id + "/profile.png"}
	err = th.cleanupTestFile(info)
	require.NoError(t, err)
}

func TestGetUsersByIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		t.Run("should return the user", func(t *testing.T) {
			users, _, err := client.GetUsersByIds([]string{th.BasicUser.Id})
			require.NoError(t, err)

			assert.Equal(t, th.BasicUser.Id, users[0].Id)
			CheckUserSanitization(t, users[0])
		})

		t.Run("should return error when no IDs are specified", func(t *testing.T) {
			_, resp, err := client.GetUsersByIds([]string{})
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("should not return an error for invalid IDs", func(t *testing.T) {
			users, _, err := client.GetUsersByIds([]string{"junk"})
			require.NoError(t, err)
			require.Empty(t, users, "no users should be returned")
		})

		t.Run("should still return users for valid IDs when invalid IDs are specified", func(t *testing.T) {
			users, _, err := client.GetUsersByIds([]string{"junk", th.BasicUser.Id})
			require.NoError(t, err)

			require.Len(t, users, 1, "1 user should be returned")
		})
	})

	t.Run("should return error when not logged in", func(t *testing.T) {
		th.Client.Logout()

		_, resp, err := th.Client.GetUsersByIds([]string{th.BasicUser.Id})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetUsersByIdsWithOptions(t *testing.T) {
	t.Run("should only return specified users that have been updated since the given time", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// Users before the timestamp shouldn't be returned
		user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		require.Nil(t, appErr)

		user2, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		require.Nil(t, appErr)

		// Users not in the list of IDs shouldn't be returned
		_, appErr = th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		require.Nil(t, appErr)

		users, _, err := th.Client.GetUsersByIdsWithOptions([]string{user1.Id, user2.Id}, &model.UserGetByIdsOptions{
			Since: user2.UpdateAt - 1,
		})

		assert.NoError(t, err)
		assert.Len(t, users, 1)
		assert.Equal(t, users[0].Id, user2.Id)
	})
}

func TestGetUsersByGroupChannelIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	gc1, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.SystemAdminUser.Id, th.TeamAdminUser.Id}, th.BasicUser.Id)
	require.Nil(t, appErr)

	usersByChannelId, _, err := th.Client.GetUsersByGroupChannelIds([]string{gc1.Id})
	require.NoError(t, err)

	users, ok := usersByChannelId[gc1.Id]
	assert.True(t, ok)
	userIds := []string{}
	for _, user := range users {
		userIds = append(userIds, user.Id)
	}

	require.ElementsMatch(t, []string{th.SystemAdminUser.Id, th.TeamAdminUser.Id}, userIds)

	th.LoginBasic2()
	usersByChannelId, _, err = th.Client.GetUsersByGroupChannelIds([]string{gc1.Id})
	require.NoError(t, err)

	_, ok = usersByChannelId[gc1.Id]
	require.False(t, ok)

	th.Client.Logout()
	_, resp, err := th.Client.GetUsersByGroupChannelIds([]string{gc1.Id})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUsersByUsernames(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	users, _, err := th.Client.GetUsersByUsernames([]string{th.BasicUser.Username})
	require.NoError(t, err)

	require.Equal(t, th.BasicUser.Id, users[0].Id)
	CheckUserSanitization(t, users[0])

	_, resp, err := th.Client.GetUsersByIds([]string{})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	users, _, err = th.Client.GetUsersByUsernames([]string{"junk"})
	require.NoError(t, err)
	require.Empty(t, users, "no users should be returned")

	users, _, err = th.Client.GetUsersByUsernames([]string{"junk", th.BasicUser.Username})
	require.NoError(t, err)
	require.Len(t, users, 1, "1 user should be returned")

	th.Client.Logout()
	_, resp, err = th.Client.GetUsersByUsernames([]string{th.BasicUser.Username})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetTotalUsersStat(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	total, _ := th.Server.Store().User().Count(model.UserCountOptions{
		IncludeDeleted:     false,
		IncludeBotAccounts: true,
	})

	rstats, _, err := th.Client.GetTotalUsersStats("")
	require.NoError(t, err)

	require.Equal(t, total, rstats.TotalUsersCount)
}

func TestUpdateUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)

	user.Nickname = "Joram Wilander"
	user.Roles = model.SystemUserRoleId
	user.LastPasswordUpdate = 123

	ruser, _, err := th.Client.UpdateUser(user)
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, "Joram Wilander", ruser.Nickname, "Nickname should update properly")
	require.Equal(t, model.SystemUserRoleId, ruser.Roles, "Roles should not update")
	require.NotEqual(t, 123, ruser.LastPasswordUpdate, "LastPasswordUpdate should not update")

	ruser.Email = th.GenerateTestEmail()
	_, resp, err := th.Client.UpdateUser(ruser)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ruser.Email = th.GenerateTestEmail()
		_, _, err = client.UpdateUser(user)
		require.NoError(t, err)
	})

	ruser.Password = user.Password
	ruser, _, err = th.Client.UpdateUser(ruser)
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	ruser.Id = "junk"
	_, resp, err = th.Client.UpdateUser(ruser)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	ruser.Id = model.NewId()
	_, resp, err = th.Client.UpdateUser(ruser)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	r, err := th.Client.DoAPIPut("/users/"+ruser.Id, "garbage")
	require.Error(t, err)
	require.Equal(t, http.StatusBadRequest, r.StatusCode)

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	ruser.Id = user.Id
	ruser.Email = th.GenerateTestEmail()
	_, resp, err = th.Client.UpdateUser(ruser)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp, err = th.Client.UpdateUser(user)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp, err = th.Client.UpdateUser(user)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.UpdateUser(user)
		require.NoError(t, err)
	})
}

func TestPatchUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)

	t.Run("Timezone limit error", func(t *testing.T) {
		patch := &model.UserPatch{}
		patch.Timezone = model.StringMap{}
		patch.Timezone["manualTimezone"] = string(make([]byte, model.UserTimezoneMaxRunes))
		ruser, resp, err := th.Client.PatchUser(user.Id, patch)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "model.user.is_valid.timezone_limit.app_error")
		require.Nil(t, ruser)
	})

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

	ruser, _, err := th.Client.PatchUser(user.Id, patch)
	require.NoError(t, err)
	CheckUserSanitization(t, ruser)

	require.Equal(t, "Joram Wilander", ruser.Nickname, "Nickname should update properly")
	require.Equal(t, "Joram", ruser.FirstName, "FirstName should update properly")
	require.Equal(t, "Wilander", ruser.LastName, "LastName should update properly")
	require.Empty(t, ruser.Position, "Position should update properly")
	require.Equal(t, user.Username, ruser.Username, "Username should not update")
	require.Empty(t, ruser.Password, "Password should not be returned")
	require.Equal(t, "somethingrandom", ruser.NotifyProps["comment"], "NotifyProps should update properly")
	require.Equal(t, "true", ruser.Timezone["useAutomaticTimezone"], "useAutomaticTimezone should update properly")
	require.Equal(t, "America/New_York", ruser.Timezone["automaticTimezone"], "automaticTimezone should update properly")
	require.Empty(t, ruser.Timezone["manualTimezone"], "manualTimezone should update properly")

	appErr := th.App.CheckPasswordAndAllCriteria(ruser, *patch.Password, "")
	require.NotNil(t, appErr, "Password should not match")

	currentPassword := user.Password
	user, appErr = th.App.GetUser(ruser.Id)
	require.Nil(t, appErr)

	appErr = th.App.CheckPasswordAndAllCriteria(user, currentPassword, "")
	require.Nil(t, appErr, "Password should still match")

	patch = &model.UserPatch{}
	patch.Email = model.NewString(th.GenerateTestEmail())

	_, resp, err := th.Client.PatchUser(user.Id, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	patch.Password = model.NewString(currentPassword)
	ruser, _, err = th.Client.PatchUser(user.Id, patch)
	require.NoError(t, err)

	require.Equal(t, *patch.Email, ruser.Email, "Email should update properly")

	patch.Username = model.NewString(th.BasicUser2.Username)
	_, resp, err = th.Client.PatchUser(user.Id, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	patch.Username = nil

	_, resp, err = th.Client.PatchUser("junk", patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	ruser.Id = model.NewId()
	_, resp, err = th.Client.PatchUser(model.NewId(), patch)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	r, err := th.Client.DoAPIPut("/users/"+user.Id+"/patch", "garbage")
	require.Error(t, err)
	require.Equal(t, http.StatusBadRequest, r.StatusCode)

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	patch.Email = model.NewString(th.GenerateTestEmail())
	_, resp, err = th.Client.PatchUser(user.Id, patch)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp, err = th.Client.PatchUser(user.Id, patch)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp, err = th.Client.PatchUser(user.Id, patch)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.PatchUser(user.Id, patch)
	require.NoError(t, err)
}

func TestUserUnicodeNames(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	t.Run("create user unicode", func(t *testing.T) {
		user := model.User{
			Email:     th.GenerateTestEmail(),
			FirstName: "Andrew\u202e",
			LastName:  "\ufeffWiggin",
			Nickname:  "Ender\u2028 Wiggin",
			Password:  "hello1",
			Username:  "\ufeffwiggin77",
			Roles:     model.SystemAdminRoleId + " " + model.SystemUserRoleId}

		ruser, resp, err := client.CreateUser(&user)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		_, _, _ = client.Login(user.Email, user.Password)

		require.Equal(t, "wiggin77", ruser.Username, "Bad Unicode not filtered from username")
		require.Equal(t, "Andrew Wiggin", ruser.GetDisplayName(model.ShowFullName), "Bad Unicode not filtered from displayname")
		require.Equal(t, "Ender Wiggin", ruser.Nickname, "Bad Unicode not filtered from nickname")
	})

	t.Run("update user unicode", func(t *testing.T) {
		user := th.CreateUser()
		client.Login(user.Email, user.Password)

		user.Username = "wiggin\ufff9"
		user.Nickname = "Ender\u0340 \ufffcWiggin"
		user.FirstName = "Andrew\ufff9"
		user.LastName = "Wig\u206fgin"

		ruser, _, err := client.UpdateUser(user)
		require.NoError(t, err)

		require.Equal(t, "wiggin", ruser.Username, "bad unicode should be filtered from username")
		require.Equal(t, "Ender Wiggin", ruser.Nickname, "bad unicode should be filtered from nickname")
		require.Equal(t, "Andrew Wiggin", ruser.GetDisplayName(model.ShowFullName), "bad unicode should be filtered from display name")
	})

	t.Run("patch user unicode", func(t *testing.T) {
		user := th.CreateUser()
		client.Login(user.Email, user.Password)

		patch := &model.UserPatch{}
		patch.Nickname = model.NewString("\U000E0000Ender\u206d Wiggin\U000E007F")
		patch.FirstName = model.NewString("\U0001d173Andrew\U0001d17a")
		patch.LastName = model.NewString("\u2028Wiggin\u2029")

		ruser, _, err := client.PatchUser(user.Id, patch)
		require.NoError(t, err)
		CheckUserSanitization(t, ruser)

		require.Equal(t, "Ender Wiggin", ruser.Nickname, "Bad unicode should be filtered from nickname")
		require.Equal(t, "Andrew", ruser.FirstName, "Bad unicode should be filtered from first name")
		require.Equal(t, "Wiggin", ruser.LastName, "Bad unicode should be filtered from last name")
		require.Equal(t, "Andrew Wiggin", ruser.GetDisplayName(model.ShowFullName), "Bad unicode should be filtered from display name")
	})
}

func TestUpdateUserAuth(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeamWithClient(th.SystemAdminClient)

	user := th.CreateUser()

	th.LinkUserToTeam(user, team)
	_, err := th.App.Srv().Store().User().VerifyEmail(user.Id, user.Email)
	require.NoError(t, err)

	userAuth := &model.UserAuth{}
	userAuth.AuthData = user.AuthData
	userAuth.AuthService = user.AuthService
	userAuth.Password = user.Password

	// Regular user can not use endpoint
	_, respErr, _ := th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth)
	require.NotNil(t, respErr, "Shouldn't have permissions. Only Admins")

	userAuth.AuthData = model.NewString("test@test.com")
	userAuth.AuthService = model.UserAuthServiceSaml
	userAuth.Password = "newpassword"
	ruser, _, err := th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth)
	require.NoError(t, err)

	// AuthData and AuthService are set, password is set to empty
	require.Equal(t, *userAuth.AuthData, *ruser.AuthData)
	require.Equal(t, model.UserAuthServiceSaml, ruser.AuthService)
	require.Empty(t, ruser.Password)

	// When AuthData or AuthService are empty, password must be valid
	userAuth.AuthData = user.AuthData
	userAuth.AuthService = ""
	userAuth.Password = "1"
	_, respErr, _ = th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth)
	require.NotNil(t, respErr)

	// Regular user can not use endpoint
	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team)
	_, err = th.App.Srv().Store().User().VerifyEmail(user2.Id, user2.Email)
	require.NoError(t, err)

	th.SystemAdminClient.Login(user2.Email, "passwd1")

	userAuth.AuthData = user.AuthData
	userAuth.AuthService = user.AuthService
	userAuth.Password = user.Password
	_, respErr, _ = th.SystemAdminClient.UpdateUserAuth(user.Id, userAuth)
	require.NotNil(t, respErr, "Should have errored")
}

func TestDeleteUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.LoginBasic()
	resp, err := th.Client.DeleteUser(th.SystemAdminUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	resp, err = th.Client.DeleteUser(th.BasicUser.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		resp, err = c.DeleteUser(model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		resp, err = c.DeleteUser("junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		userToDelete := th.CreateUser()
		_, err = c.DeleteUser(userToDelete.Id)
		require.NoError(t, err)
	})

	selfDeleteUser := th.CreateUser()
	th.LoginBasic()
	resp, err = th.Client.DeleteUser(selfDeleteUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Login(selfDeleteUser.Email, selfDeleteUser.Password)
	th.App.UpdateConfig(func(c *model.Config) {
		*c.TeamSettings.EnableUserDeactivation = false
	})
	resp, err = th.Client.DeleteUser(selfDeleteUser.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(c *model.Config) {
		*c.TeamSettings.EnableUserDeactivation = true
	})
	_, err = th.Client.DeleteUser(selfDeleteUser.Id)
	require.NoError(t, err)
}

func TestPermanentDeleteUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	enableAPIUserDeletion := *th.App.Config().ServiceSettings.EnableAPIUserDeletion
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPIUserDeletion = &enableAPIUserDeletion })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = false })

	userToDelete := th.CreateUser()

	t.Run("Permanent deletion not available through API if EnableAPIUserDeletion is not set", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PermanentDeleteUser(userToDelete.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Permanent deletion available through local mode even if EnableAPIUserDeletion is not set", func(t *testing.T) {
		_, err := th.LocalClient.PermanentDeleteUser(userToDelete.Id)
		require.NoError(t, err)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIUserDeletion = true })
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		userToDelete = th.CreateUser()
		_, err := c.PermanentDeleteUser(userToDelete.Id)
		require.NoError(t, err)

		_, appErr := th.App.GetTeam(userToDelete.Id)
		assert.NotNil(t, appErr)

		resp, err := c.PermanentDeleteUser("junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "Permanent deletion with EnableAPIUserDeletion set")
}

func TestPermanentDeleteAllUsers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("The endpoint should not be available for neither normal nor sysadmin users", func(t *testing.T) {
		resp, err := th.Client.PermanentDeleteAllUsers()
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		resp, err = th.SystemAdminClient.PermanentDeleteAllUsers()
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("The endpoint should permanently delete all users", func(t *testing.T) {
		// Basic user creates a team and a channel
		team, appErr := th.App.CreateTeamWithUser(th.Context, &model.Team{
			DisplayName: "User Created Team",
			Name:        "user-created-team",
			Email:       "usercreatedteam@test.com",
			Type:        model.TeamOpen,
		}, th.BasicUser.Id)
		require.Nil(t, appErr)

		channel, appErr := th.App.CreateChannelWithUser(th.Context, &model.Channel{
			DisplayName: "User Created Channel",
			Name:        "user-created-channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Check that we have users and posts in the database
		users, err := th.App.Srv().Store().User().GetAll()
		require.NoError(t, err)
		require.Greater(t, len(users), 0)

		postCount, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
		require.NoError(t, err)
		require.Greater(t, postCount, int64(0))

		// Delete all users and their posts
		_, err = th.LocalClient.PermanentDeleteAllUsers()
		require.NoError(t, err)

		// Check that both user and post tables are empty
		users, err = th.App.Srv().Store().User().GetAll()
		require.NoError(t, err)
		require.Len(t, users, 0)

		postCount, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
		require.NoError(t, err)
		require.Equal(t, postCount, int64(0))

		// Check that the channel and team created by the user were not deleted
		rTeam, appErr := th.App.GetTeam(team.Id)
		require.Nil(t, appErr)
		require.NotNil(t, rTeam)

		rChannel, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.NotNil(t, rChannel)
	})
}

func TestUpdateUserRoles(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	resp, err := th.Client.UpdateUserRoles(th.SystemAdminUser.Id, model.SystemUserRoleId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err = client.UpdateUserRoles(th.BasicUser.Id, model.SystemUserRoleId)
		require.NoError(t, err)

		_, err = client.UpdateUserRoles(th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId)
		require.NoError(t, err)

		resp, err = client.UpdateUserRoles(th.BasicUser.Id, "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.UpdateUserRoles("junk", model.SystemUserRoleId)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.UpdateUserRoles(model.NewId(), model.SystemUserRoleId)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func assertExpectedWebsocketEvent(t *testing.T, client *model.WebSocketClient, event string, test func(*model.WebSocketEvent)) {
	for {
		select {
		case resp, ok := <-client.EventChannel:
			require.Truef(t, ok, "channel closed before receiving expected event %s", event)
			if resp.EventType() == event {
				test(resp)
				return
			}
		case <-time.After(5 * time.Second):
			require.Failf(t, "failed to receive expected event %s", event)
		}
	}
}

func assertWebsocketEventUserUpdatedWithEmail(t *testing.T, client *model.WebSocketClient, email string) {
	assertExpectedWebsocketEvent(t, client, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
		eventUser, ok := event.GetData()["user"].(*model.User)
		require.True(t, ok, "expected user")
		assert.Equal(t, email, eventUser.Email)
	})
}

func TestUpdateUserActive(t *testing.T) {
	t.Run("basic tests", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })
		_, err := th.Client.UpdateUserActive(user.Id, false)
		require.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = false })
		resp, err := th.Client.UpdateUserActive(user.Id, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })
		resp, err = th.Client.UpdateUserActive(user.Id, false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		th.LoginBasic2()

		resp, err = th.Client.UpdateUserActive(user.Id, true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = th.Client.UpdateUserActive(GenerateTestId(), true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = th.Client.UpdateUserActive("junk", true)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		th.Client.Logout()

		resp, err = th.Client.UpdateUserActive(user.Id, true)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			_, err = client.UpdateUserActive(user.Id, true)
			require.NoError(t, err)

			_, err = client.UpdateUserActive(user.Id, false)
			require.NoError(t, err)

			authData := model.NewId()
			_, err := th.App.Srv().Store().User().UpdateAuthData(user.Id, "random", &authData, "", true)
			require.NoError(t, err)

			_, err = client.UpdateUserActive(user.Id, false)
			require.NoError(t, err)
		})
	})

	t.Run("websocket events", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser2

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableUserDeactivation = true })

		webSocketClient, err := th.CreateWebSocketClient()
		assert.NoError(t, err)
		defer webSocketClient.Close()

		webSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		resp := <-webSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, resp.Status)

		adminWebSocketClient, err := th.CreateWebSocketSystemAdminClient()
		assert.NoError(t, err)
		defer adminWebSocketClient.Close()

		adminWebSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		resp = <-adminWebSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, resp.Status)

		// Verify that both admins and regular users see the email when privacy settings allow same,
		// and confirm event is fired for SystemAdmin and Local mode
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = true })
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			_, err := client.UpdateUserActive(user.Id, false)
			require.NoError(t, err)

			assertWebsocketEventUserUpdatedWithEmail(t, webSocketClient, user.Email)
			assertWebsocketEventUserUpdatedWithEmail(t, adminWebSocketClient, user.Email)
		})

		// Verify that only admins see the email when privacy settings hide emails,
		// and confirm event is fired for SystemAdmin and Local mode
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
			_, err := client.UpdateUserActive(user.Id, true)
			require.NoError(t, err)

			assertWebsocketEventUserUpdatedWithEmail(t, webSocketClient, "")
			assertWebsocketEventUserUpdatedWithEmail(t, adminWebSocketClient, user.Email)
		})
	})

	t.Run("activate guest should fail when guests feature is disable", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		id := model.NewId()
		guest := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}
		user, err := th.App.CreateGuest(th.Context, guest)
		require.Nil(t, err)
		th.App.UpdateActive(th.Context, user, false)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			resp, err := client.UpdateUserActive(user.Id, true)
			require.Error(t, err)
			CheckUnauthorizedStatus(t, resp)
		})
	})

	t.Run("activate guest should work when guests feature is enabled", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		id := model.NewId()
		guest := &model.User{
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}
		user, appErr := th.App.CreateGuest(th.Context, guest)
		require.Nil(t, appErr)
		th.App.UpdateActive(th.Context, user, false)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			_, err := client.UpdateUserActive(user.Id, true)
			require.NoError(t, err)
		})
	})
}

func TestGetUsers(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rusers, _, err := client.GetUsers(0, 60, "")
		require.NoError(t, err)
		for _, u := range rusers {
			CheckUserSanitization(t, u)
		}

		rusers, _, err = client.GetUsers(0, 1, "")
		require.NoError(t, err)
		require.Len(t, rusers, 1, "should be 1 per page")

		rusers, _, err = client.GetUsers(1, 1, "")
		require.NoError(t, err)
		require.Len(t, rusers, 1, "should be 1 per page")

		rusers, _, err = client.GetUsers(10000, 100, "")
		require.NoError(t, err)
		require.Empty(t, rusers, "should be no users")

		// Check default params for page and per_page
		_, err = client.DoAPIGet("/users", "")
		require.NoError(t, err)
	})

	th.Client.Logout()
	_, resp, err := th.Client.GetUsers(0, 60, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetNewUsersInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	rusers, _, err := th.Client.GetNewUsersInTeam(teamId, 0, 60, "")
	require.NoError(t, err)

	lastCreateAt := model.GetMillis()
	for _, u := range rusers {
		require.LessOrEqual(t, u.CreateAt, lastCreateAt, "right sorting")
		lastCreateAt = u.CreateAt
		CheckUserSanitization(t, u)
	}

	rusers, _, err = th.Client.GetNewUsersInTeam(teamId, 1, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	th.Client.Logout()
	_, resp, err := th.Client.GetNewUsersInTeam(teamId, 1, 1, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetRecentlyActiveUsersInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	th.App.SetStatusOnline(th.BasicUser.Id, true)

	rusers, _, err := th.Client.GetRecentlyActiveUsersInTeam(teamId, 0, 60, "")
	require.NoError(t, err)

	for _, u := range rusers {
		require.NotZero(t, u.LastActivityAt, "should return last activity at")
		CheckUserSanitization(t, u)
	}

	rusers, _, err = th.Client.GetRecentlyActiveUsersInTeam(teamId, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	th.Client.Logout()
	_, resp, err := th.Client.GetRecentlyActiveUsersInTeam(teamId, 0, 1, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetActiveUsersInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	th.SystemAdminClient.UpdateUserActive(th.BasicUser2.Id, false)
	rusers, _, err := th.Client.GetActiveUsersInTeam(teamId, 0, 60, "")
	require.NoError(t, err)

	require.NotZero(t, len(rusers))
	for _, u := range rusers {
		require.Zero(t, u.DeleteAt, "should not be deleted")
		require.NotEqual(t, th.BasicUser2.Id, "should not include deactivated user")
		CheckUserSanitization(t, u)
	}

	rusers, _, err = th.Client.GetActiveUsersInTeam(teamId, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	// Check case where we have supplied both active and inactive flags
	_, err = th.Client.DoAPIGet("/users?inactive=true&active=true", "")
	require.Error(t, err)

	th.Client.Logout()
	_, resp, err := th.Client.GetActiveUsersInTeam(teamId, 0, 1, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetUsersWithoutTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, _, err := th.Client.GetUsersWithoutTeam(0, 100, "")
	require.Error(t, err, "should prevent non-admin user from getting users without a team")

	// These usernames need to appear in the first 100 users for this to work

	user, _, err := th.Client.CreateUser(&model.User{
		Username: "a000000000" + model.NewId(),
		Email:    "success+" + model.NewId() + "@simulator.amazonses.com",
		Password: "Password1",
	})
	require.NoError(t, err)
	th.LinkUserToTeam(user, th.BasicTeam)
	defer th.App.Srv().Store().User().PermanentDelete(user.Id)

	user2, _, err := th.Client.CreateUser(&model.User{
		Username: "a000000001" + model.NewId(),
		Email:    "success+" + model.NewId() + "@simulator.amazonses.com",
		Password: "Password1",
	})
	require.NoError(t, err)
	defer th.App.Srv().Store().User().PermanentDelete(user2.Id)

	rusers, _, err := th.SystemAdminClient.GetUsersWithoutTeam(0, 100, "")
	require.NoError(t, err)

	found1 := false
	found2 := false

	for _, u := range rusers {
		if u.Id == user.Id {
			found1 = true
		} else if u.Id == user2.Id {
			found2 = true
		}
	}

	require.False(t, found1, "should not return user that as a team")
	require.True(t, found2, "should return user that has no teams")
}

func TestGetUsersInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	rusers, resp, err := th.Client.GetUsersInTeam(teamId, 0, 60, "")
	require.NoError(t, err)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, resp, _ = th.Client.GetUsersInTeam(teamId, 0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, _, err = th.Client.GetUsersInTeam(teamId, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, _, err = th.Client.GetUsersInTeam(teamId, 1, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, _, err = th.Client.GetUsersInTeam(teamId, 10000, 100, "")
	require.NoError(t, err)
	require.Empty(t, rusers, "should be no users")

	th.Client.Logout()
	_, resp, err = th.Client.GetUsersInTeam(teamId, 0, 60, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp, err = th.Client.GetUsersInTeam(teamId, 0, 60, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetUsersInTeam(teamId, 0, 60, "")
	require.NoError(t, err)
}

func TestGetUsersNotInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id

	rusers, resp, err := th.Client.GetUsersNotInTeam(teamId, 0, 60, "")
	require.NoError(t, err)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}
	require.Len(t, rusers, 2, "should be 2 users in total")

	rusers, resp, _ = th.Client.GetUsersNotInTeam(teamId, 0, 60, resp.Etag)
	CheckEtag(t, rusers, resp)

	rusers, _, err = th.Client.GetUsersNotInTeam(teamId, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, _, err = th.Client.GetUsersNotInTeam(teamId, 2, 1, "")
	require.NoError(t, err)
	require.Empty(t, rusers, "should be no users")

	rusers, _, err = th.Client.GetUsersNotInTeam(teamId, 10000, 100, "")
	require.NoError(t, err)
	require.Empty(t, rusers, "should be no users")

	th.Client.Logout()
	_, resp, err = th.Client.GetUsersNotInTeam(teamId, 0, 60, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp, err = th.Client.GetUsersNotInTeam(teamId, 0, 60, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetUsersNotInTeam(teamId, 0, 60, "")
	require.NoError(t, err)
}

func TestGetUsersInChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	channelId := th.BasicChannel.Id

	rusers, _, err := th.Client.GetUsersInChannel(channelId, 0, 60, "")
	require.NoError(t, err)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, _, err = th.Client.GetUsersInChannel(channelId, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, _, err = th.Client.GetUsersInChannel(channelId, 1, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, _, err = th.Client.GetUsersInChannel(channelId, 10000, 100, "")
	require.NoError(t, err)
	require.Empty(t, rusers, "should be no users")

	th.Client.Logout()
	_, resp, err := th.Client.GetUsersInChannel(channelId, 0, 60, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	th.Client.Login(user.Email, user.Password)
	_, resp, err = th.Client.GetUsersInChannel(channelId, 0, 60, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetUsersInChannel(channelId, 0, 60, "")
	require.NoError(t, err)

	t.Run("Should forbid getting the members of an archived channel if users are not allowed to view archived messages", func(t *testing.T) {
		th.LoginBasic()
		channel, _, appErr := th.SystemAdminClient.CreateChannel(&model.Channel{
			DisplayName: "User Created Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		})
		require.NoError(t, appErr)
		_, aErr := th.App.AddUserToChannel(th.Context, th.BasicUser, channel, false)
		require.Nil(t, aErr)
		_, aErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, channel, false)
		require.Nil(t, aErr)
		th.SystemAdminClient.DeleteChannel(channel.Id)

		experimentalViewArchivedChannels := *th.App.Config().TeamSettings.ExperimentalViewArchivedChannels
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalViewArchivedChannels = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.ExperimentalViewArchivedChannels = experimentalViewArchivedChannels
		})

		// the endpoint should work fine for all clients when viewing
		// archived channels is enabled
		for _, client := range []*model.Client4{th.SystemAdminClient, th.Client, th.LocalClient} {
			users, _, userErr := client.GetUsersInChannel(channel.Id, 0, 1000, "")
			require.NoError(t, userErr)
			require.Len(t, users, 3)
		}

		// the endpoint should return forbidden if viewing archived
		// channels is disabled for all clients but the Local one
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalViewArchivedChannels = false })
		for _, client := range []*model.Client4{th.SystemAdminClient, th.Client} {
			users, resp, userErr := client.GetUsersInChannel(channel.Id, 0, 1000, "")
			require.Error(t, userErr)
			require.Len(t, users, 0)
			CheckForbiddenStatus(t, resp)
		}

		// local client should be able to get the users still
		users, _, appErr := th.LocalClient.GetUsersInChannel(channel.Id, 0, 1000, "")
		require.NoError(t, appErr)
		require.Len(t, users, 3)
	})
}

func TestGetUsersNotInChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teamId := th.BasicTeam.Id
	channelId := th.BasicChannel.Id

	user := th.CreateUser()
	th.LinkUserToTeam(user, th.BasicTeam)

	rusers, _, err := th.Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	require.NoError(t, err)
	for _, u := range rusers {
		CheckUserSanitization(t, u)
	}

	rusers, _, err = th.Client.GetUsersNotInChannel(teamId, channelId, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rusers, 1, "should be 1 per page")

	rusers, _, err = th.Client.GetUsersNotInChannel(teamId, channelId, 10000, 100, "")
	require.NoError(t, err)
	require.Empty(t, rusers, "should be no users")

	th.Client.Logout()
	_, resp, err := th.Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.Client.Login(user.Email, user.Password)
	_, resp, err = th.Client.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetUsersNotInChannel(teamId, channelId, 0, 60, "")
	require.NoError(t, err)
}

func TestGetUsersInGroup(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	t.Run("Requires ldap license", func(t *testing.T) {
		_, response, err := th.SystemAdminClient.GetUsersInGroup(group.Id, 0, 60, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Requires manage system permission to access users in group", func(t *testing.T) {
		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		_, response, err := th.Client.GetUsersInGroup(group.Id, 0, 60, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	user1, err := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, err)
	_, err = th.App.UpsertGroupMember(group.Id, user1.Id)
	assert.Nil(t, err)

	t.Run("Returns users in group when called by system admin", func(t *testing.T) {
		users, _, err := th.SystemAdminClient.GetUsersInGroup(group.Id, 0, 60, "")
		require.NoError(t, err)
		assert.Equal(t, users[0].Id, user1.Id)
	})

	t.Run("Returns no users when pagination out of range", func(t *testing.T) {
		users, _, err := th.SystemAdminClient.GetUsersInGroup(group.Id, 5, 60, "")
		require.NoError(t, err)
		assert.Empty(t, users)
	})
}

func TestUpdateUserMfa(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	resp, err := th.Client.UpdateUserMfa(th.BasicUser.Id, "12345", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err = client.UpdateUserMfa(th.BasicUser.Id, "12345", false)
		require.NoError(t, err)
	})
}

func TestUserLoginMFAFlow(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(c *model.Config) {
		*c.ServiceSettings.EnableMultifactorAuthentication = true
	})

	t.Run("WithoutMFA", func(t *testing.T) {
		_, _, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)
	})

	t.Run("WithInvalidMFA", func(t *testing.T) {
		secret, appErr := th.App.GenerateMfaSecret(th.BasicUser.Id)
		assert.Nil(t, appErr)

		// Fake user has MFA enabled
		err := th.Server.Store().User().UpdateMfaActive(th.BasicUser.Id, true)
		require.NoError(t, err)

		err = th.Server.Store().User().UpdateMfaActive(th.BasicUser.Id, true)
		require.NoError(t, err)

		err = th.Server.Store().User().UpdateMfaSecret(th.BasicUser.Id, secret.Secret)
		require.NoError(t, err)

		user, _, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		CheckErrorID(t, err, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)

		user, _, err = th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, "")
		CheckErrorID(t, err, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)

		user, _, err = th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, "abcdefgh")
		CheckErrorID(t, err, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)

		secret2, appErr := th.App.GenerateMfaSecret(th.BasicUser2.Id)
		assert.Nil(t, appErr)
		user, _, err = th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, secret2.Secret)
		CheckErrorID(t, err, "mfa.validate_token.authenticate.app_error")
		assert.Nil(t, user)
	})

	t.Run("WithCorrectMFA", func(t *testing.T) {
		secret, appErr := th.App.GenerateMfaSecret(th.BasicUser.Id)
		assert.Nil(t, appErr)

		// Fake user has MFA enabled
		err := th.Server.Store().User().UpdateMfaActive(th.BasicUser.Id, true)
		require.NoError(t, err)

		err = th.Server.Store().User().UpdateMfaSecret(th.BasicUser.Id, secret.Secret)
		require.NoError(t, err)

		code := dgoogauth.ComputeCode(secret.Secret, time.Now().UTC().Unix()/30)

		user, _, err := th.Client.LoginWithMFA(th.BasicUser.Email, th.BasicUser.Password, fmt.Sprintf("%06d", code))
		require.NoError(t, err)
		assert.NotNil(t, user)
	})
}

func TestGenerateMfaSecret(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = false })

	_, resp, err := th.Client.GenerateMfaSecret(th.BasicUser.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GenerateMfaSecret(th.BasicUser.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	_, resp, err = th.Client.GenerateMfaSecret("junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.App.Srv().SetLicense(model.NewTestLicense("mfa"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	_, resp, err = th.Client.GenerateMfaSecret(model.NewId())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	session, _ := th.App.GetSession(th.Client.AuthToken)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)

	_, resp, err = th.Client.GenerateMfaSecret(th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()

	_, resp, err = th.Client.GenerateMfaSecret(th.BasicUser.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateUserPassword(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	password := "newpassword1"
	_, err := th.Client.UpdateUserPassword(th.BasicUser.Id, th.BasicUser.Password, password)
	require.NoError(t, err)

	resp, err := th.Client.UpdateUserPassword(th.BasicUser.Id, password, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, password, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.Client.UpdateUserPassword("junk", password, password)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, "", password)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, "junk", password)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = th.Client.UpdateUserPassword(th.BasicUser.Id, password, th.BasicUser.Password)
	require.NoError(t, err)

	th.Client.Logout()
	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, password, password)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, password, password)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	// Test lockout
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 2 })

	// Fail twice
	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, "badpwd", "newpwd")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, "badpwd", "newpwd")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Should fail because account is locked out
	resp, err = th.Client.UpdateUserPassword(th.BasicUser.Id, th.BasicUser.Password, "newpwd")
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")
	CheckUnauthorizedStatus(t, resp)

	// System admin can update another user's password
	adminSetPassword := "pwdsetbyadmin"
	_, err = th.SystemAdminClient.UpdateUserPassword(th.BasicUser.Id, "", adminSetPassword)
	require.NoError(t, err)

	_, _, err = th.Client.Login(th.BasicUser.Email, adminSetPassword)
	require.NoError(t, err)
}

func TestUpdateUserHashedPassword(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	password := "SuperSecurePass23!"
	passwordHash := "$2a$10$CiS1iWVPUj7rQNdY6XW53.DmaPLsETIvmW2p0asp4Dqpofs10UL5W"
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err := client.UpdateUserHashedPassword(th.BasicUser.Id, passwordHash)
		require.NoError(t, err)
	})

	_, _, err := client.Login(th.BasicUser.Email, password)
	require.NoError(t, err)

	// Standard users should never be updating their passwords with already-
	// hashed passwords.
	resp, err := client.UpdateUserHashedPassword(th.BasicUser.Id, passwordHash)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestResetPassword(t *testing.T) {
	t.Skip("test disabled during old build server changes, should be investigated")

	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.Client.Logout()
	user := th.BasicUser
	// Delete all the messages before check the reset password
	mail.DeleteMailBox(user.Email)
	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, err := client.SendPasswordResetEmail(user.Email)
		require.NoError(t, err)
		resp, err := client.SendPasswordResetEmail("")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		// Should not leak whether the email is attached to an account or not
		_, err = client.SendPasswordResetEmail("notreal@example.com")
		require.NoError(t, err)
	})
	// Check if the email was send to the right email address and the recovery key match
	var resultsMailbox mail.JSONMessageHeaderInbucket
	err := mail.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = mail.GetMailBox(user.Email)
		return err
	})
	if err != nil {
		t.Log(err)
		t.Log("No email was received, maybe due load on the server. Disabling this verification")
	}
	var recoveryTokenString string
	if err == nil && len(resultsMailbox) > 0 {
		require.Contains(t, resultsMailbox[0].To[0], user.Email, "Correct To recipient")
		resultsEmail, mailErr := mail.GetMessageFromMailbox(user.Email, resultsMailbox[0].ID)
		require.NoError(t, mailErr)
		loc := strings.Index(resultsEmail.Body.Text, "token=")
		require.NotEqual(t, -1, loc, "Code should be found in email")
		loc += 6
		recoveryTokenString = resultsEmail.Body.Text[loc : loc+model.TokenSize]
	}
	recoveryToken, err := th.App.Srv().Store().Token().GetByToken(recoveryTokenString)
	require.NoError(t, err, "Recovery token not found (%s)", recoveryTokenString)

	resp, err := th.Client.ResetPassword(recoveryToken.Token, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.Client.ResetPassword(recoveryToken.Token, "newp")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.Client.ResetPassword("", "newpwd")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.Client.ResetPassword("junk", "newpwd")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	code := ""
	for i := 0; i < model.TokenSize; i++ {
		code += "a"
	}
	resp, err = th.Client.ResetPassword(code, "newpwd")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	_, err = th.Client.ResetPassword(recoveryToken.Token, "newpwd")
	require.NoError(t, err)
	th.Client.Login(user.Email, "newpwd")
	th.Client.Logout()
	resp, err = th.Client.ResetPassword(recoveryToken.Token, "newpwd")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	authData := model.NewId()
	_, err = th.App.Srv().Store().User().UpdateAuthData(user.Id, "random", &authData, "", true)
	require.NoError(t, err)
	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		resp, err = client.SendPasswordResetEmail(user.Email)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetSessions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	th.Client.Login(user.Email, user.Password)

	sessions, _, err := th.Client.GetSessions(user.Id, "")
	require.NoError(t, err)
	for _, session := range sessions {
		require.Equal(t, user.Id, session.UserId, "user id should match session user id")
	}

	resp, err := th.Client.RevokeSession("junk", model.NewId())
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = th.Client.GetSessions(th.BasicUser2.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.GetSessions(model.NewId(), "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp, err = th.Client.GetSessions(th.BasicUser2.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetSessions(user.Id, "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetSessions(th.BasicUser2.Id, "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetSessions(model.NewId(), "")
	require.NoError(t, err)
}

func TestRevokeSessions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	th.Client.Login(user.Email, user.Password)
	sessions, _, _ := th.Client.GetSessions(user.Id, "")
	require.NotZero(t, len(sessions), "sessions should exist")
	for _, session := range sessions {
		require.Equal(t, user.Id, session.UserId, "user id does not match session user id")
	}
	session := sessions[0]

	resp, err := th.Client.RevokeSession(user.Id, model.NewId())
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.Client.RevokeSession(th.BasicUser2.Id, model.NewId())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = th.Client.RevokeSession("junk", model.NewId())
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = th.Client.RevokeSession(user.Id, session.Id)
	require.NoError(t, err)

	th.LoginBasic()

	sessions, _ = th.App.GetSessions(th.SystemAdminUser.Id)
	session = sessions[0]

	resp, err = th.Client.RevokeSession(user.Id, session.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.Client.Logout()
	resp, err = th.Client.RevokeSession(user.Id, model.NewId())
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	resp, err = th.SystemAdminClient.RevokeSession(user.Id, model.NewId())
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	sessions, _, _ = th.SystemAdminClient.GetSessions(th.SystemAdminUser.Id, "")
	require.NotEmpty(t, sessions, "sessions should exist")
	for _, session := range sessions {
		require.Equal(t, th.SystemAdminUser.Id, session.UserId, "user id should match session user id")
	}
	session = sessions[0]

	_, err = th.SystemAdminClient.RevokeSession(th.SystemAdminUser.Id, session.Id)
	require.NoError(t, err)
}

func TestRevokeAllSessions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	th.Client.Login(user.Email, user.Password)

	resp, err := th.Client.RevokeAllSessions(th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = th.Client.RevokeAllSessions("junk" + user.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = th.Client.RevokeAllSessions(user.Id)
	require.NoError(t, err)

	th.Client.Logout()
	resp, err = th.Client.RevokeAllSessions(user.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.Client.Login(user.Email, user.Password)

	sessions, _, _ := th.Client.GetSessions(user.Id, "")
	require.NotEmpty(t, sessions, "session should exist")

	_, err = th.Client.RevokeAllSessions(user.Id)
	require.NoError(t, err)

	sessions, _, _ = th.SystemAdminClient.GetSessions(user.Id, "")
	require.Empty(t, sessions, "no sessions should exist for user")

	resp, err = th.Client.RevokeAllSessions(user.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestRevokeSessionsFromAllUsers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	th.Client.Login(user.Email, user.Password)
	resp, err := th.Client.RevokeSessionsFromAllUsers()
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	resp, err = th.Client.RevokeSessionsFromAllUsers()
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.Client.Login(user.Email, user.Password)
	admin := th.SystemAdminUser
	th.Client.Login(admin.Email, admin.Password)
	sessions, err := th.Server.Store().Session().GetSessions(user.Id)
	require.NotEmpty(t, sessions)
	require.NoError(t, err)
	sessions, err = th.Server.Store().Session().GetSessions(admin.Id)
	require.NotEmpty(t, sessions)
	require.NoError(t, err)
	_, err = th.Client.RevokeSessionsFromAllUsers()
	require.NoError(t, err)

	// All sessions were revoked, so making the same call
	// again will fail due to lack of a session.
	resp, err = th.Client.RevokeSessionsFromAllUsers()
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	sessions, err = th.Server.Store().Session().GetSessions(user.Id)
	require.Empty(t, sessions)
	require.NoError(t, err)

	sessions, err = th.Server.Store().Session().GetSessions(admin.Id)
	require.Empty(t, sessions)
	require.NoError(t, err)

}

func TestAttachDeviceId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	deviceId := model.PushNotifyApple + ":1234567890"

	t.Run("success", func(t *testing.T) {
		testCases := []struct {
			Description                   string
			SiteURL                       string
			ExpectedSetCookieHeaderRegexp string
		}{
			{"no subpath", "http://localhost:8065", "^MMAUTHTOKEN=[a-z0-9]+; Path=/"},
			{"subpath", "http://localhost:8065/subpath", "^MMAUTHTOKEN=[a-z0-9]+; Path=/subpath"},
		}

		for _, tc := range testCases {
			t.Run(tc.Description, func(t *testing.T) {

				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ServiceSettings.SiteURL = tc.SiteURL
				})

				resp, err := th.Client.AttachDeviceId(deviceId)
				require.NoError(t, err)

				cookies := resp.Header.Get("Set-Cookie")
				assert.Regexp(t, tc.ExpectedSetCookieHeaderRegexp, cookies)

				sessions, appErr := th.App.GetSessions(th.BasicUser.Id)
				require.Nil(t, appErr)
				assert.Equal(t, deviceId, sessions[0].DeviceId, "Missing device Id")
			})
		}
	})

	t.Run("invalid device id", func(t *testing.T) {
		resp, err := th.Client.AttachDeviceId("")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("not logged in", func(t *testing.T) {
		th.Client.Logout()

		resp, err := th.Client.AttachDeviceId("")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetUserAudits(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	audits, _, err := th.Client.GetUserAudits(user.Id, 0, 100, "")
	for _, audit := range audits {
		require.Equal(t, user.Id, audit.UserId, "user id should match audit user id")
	}
	require.NoError(t, err)

	_, resp, err := th.Client.GetUserAudits(th.BasicUser2.Id, 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp, err = th.Client.GetUserAudits(user.Id, 0, 100, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetUserAudits(user.Id, 0, 100, "")
	require.NoError(t, err)
}

func TestVerifyUserEmail(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	email := th.GenerateTestEmail()
	user := model.User{Email: email, Nickname: "Darth Vader", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId}

	ruser, _, _ := th.Client.CreateUser(&user)

	token, err := th.App.Srv().EmailService.CreateVerifyEmailToken(ruser.Id, email)
	require.NoError(t, err, "Unable to create email verify token")

	_, err = th.Client.VerifyUserEmail(token.Token)
	require.NoError(t, err)

	resp, err := th.Client.VerifyUserEmail(GenerateTestId())
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = th.Client.VerifyUserEmail("")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}

func TestSendVerificationEmail(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.Client.SendVerificationEmail(th.BasicUser.Email)
	require.NoError(t, err)

	resp, err := th.Client.SendVerificationEmail("")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Even non-existent emails should return 200 OK
	_, err = th.Client.SendVerificationEmail(th.GenerateTestEmail())
	require.NoError(t, err)

	th.Client.Logout()
	_, err = th.Client.SendVerificationEmail(th.BasicUser.Email)
	require.NoError(t, err)
}

func TestSetProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	_, err = th.Client.SetProfileImage(user.Id, data)
	require.NoError(t, err)

	resp, err := th.Client.SetProfileImage(model.NewId(), data)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	th.Client.Logout()
	resp, err = th.Client.SetProfileImage(user.Id, data)
	require.Error(t, err)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	buser, appErr := th.App.GetUser(user.Id)
	require.Nil(t, appErr)

	_, err = th.SystemAdminClient.SetProfileImage(user.Id, data)
	require.NoError(t, err)

	ruser, appErr := th.App.GetUser(user.Id)
	require.Nil(t, appErr)
	assert.True(t, buser.LastPictureUpdate == ruser.LastPictureUpdate, "Same picture should not have updated")

	data2, err := testutils.ReadTestFile("testjpg.jpg")
	require.NoError(t, err)

	_, err = th.SystemAdminClient.SetProfileImage(user.Id, data2)
	require.NoError(t, err)

	ruser, appErr = th.App.GetUser(user.Id)
	require.Nil(t, appErr)

	assert.True(t, buser.LastPictureUpdate < ruser.LastPictureUpdate, "Picture should have updated for user")

	info := &model.FileInfo{Path: "users/" + user.Id + "/profile.png"}
	err = th.cleanupTestFile(info)
	require.NoError(t, err)
}

func TestSetDefaultProfileImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user := th.BasicUser

	_, err := th.Client.SetDefaultProfileImage(user.Id)
	require.NoError(t, err)

	resp, err := th.Client.SetDefaultProfileImage(model.NewId())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetDefaultProfileImage when request is terminated early by server
	th.Client.Logout()
	resp, err = th.Client.SetDefaultProfileImage(user.Id)
	require.Error(t, err)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	_, err = th.SystemAdminClient.SetDefaultProfileImage(user.Id)
	require.NoError(t, err)

	ruser, appErr := th.App.GetUser(user.Id)
	require.Nil(t, appErr)
	assert.Equal(t, int64(0), ruser.LastPictureUpdate, "Picture should have reset to default")

	info := &model.FileInfo{Path: "users/" + user.Id + "/profile.png"}
	err = th.cleanupTestFile(info)
	require.NoError(t, err)
}

func TestLogin(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.Client.Logout()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})

	t.Run("missing password", func(t *testing.T) {
		_, _, err := th.Client.Login(th.BasicUser.Email, "")
		CheckErrorID(t, err, "api.user.login.blank_pwd.app_error")
	})

	t.Run("unknown user", func(t *testing.T) {
		_, _, err := th.Client.Login("unknown", th.BasicUser.Password)
		CheckErrorID(t, err, "api.user.login.invalid_credentials_email_username")
	})

	t.Run("valid login", func(t *testing.T) {
		user, _, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)
		assert.Equal(t, user.Id, th.BasicUser.Id)
	})

	t.Run("bot login rejected", func(t *testing.T) {
		bot, _, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username: "bot",
		})
		require.NoError(t, err)

		botUser, _, err := th.SystemAdminClient.GetUser(bot.UserId, "")
		require.NoError(t, err)

		_, err = th.SystemAdminClient.UpdateUserPassword(bot.UserId, "", "password")
		require.NoError(t, err)

		_, _, err = th.Client.Login(botUser.Email, "password")
		CheckErrorID(t, err, "api.user.login.bot_login_forbidden.app_error")
	})

	t.Run("login with terms_of_service set", func(t *testing.T) {
		termsOfService, appErr := th.App.CreateTermsOfService("terms of service", th.BasicUser.Id)
		require.Nil(t, appErr)

		_, err := th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, termsOfService.Id, true)
		require.NoError(t, err)

		userTermsOfService, _, err := th.Client.GetUserTermsOfService(th.BasicUser.Id, "")
		require.NoError(t, err)

		user, _, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)
		assert.Equal(t, user.Id, th.BasicUser.Id)
		assert.Equal(t, user.TermsOfServiceId, userTermsOfService.TermsOfServiceId)
		assert.Equal(t, user.TermsOfServiceCreateAt, userTermsOfService.CreateAt)
	})
}

func TestLoginWithLag(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.Client.Logout()

	t.Run("with replication lag, caches cleared", func(t *testing.T) {
		if !replicaFlag {
			t.Skipf("requires test flag: -mysql-replica")
		}

		if *th.App.Config().SqlSettings.DriverName != model.DatabaseDriverMysql {
			t.Skipf("requires %q database driver", model.DatabaseDriverMysql)
		}

		mainHelper.SQLStore.UpdateLicense(model.NewTestLicense("ldap"))
		mainHelper.ToggleReplicasOff()

		appErr := th.App.RevokeAllSessions(th.BasicUser.Id)
		require.Nil(t, appErr)

		mainHelper.ToggleReplicasOn()
		defer mainHelper.ToggleReplicasOff()

		cmdErr := mainHelper.SetReplicationLagForTesting(5)
		require.NoError(t, cmdErr)
		defer mainHelper.SetReplicationLagForTesting(0)

		_, _, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		appErr = th.App.Srv().InvalidateAllCaches()
		require.Nil(t, appErr)

		session, appErr := th.App.GetSession(th.Client.AuthToken)
		require.Nil(t, appErr)
		require.NotNil(t, session)
	})
}

func TestLoginCookies(t *testing.T) {
	t.Run("should return cookies with X-Requested-With header", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.HTTPHeader[model.HeaderRequestedWith] = model.HeaderRequestedWithXML

		user, resp, _ := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		sessionCookie := ""
		userCookie := ""
		csrfCookie := ""

		for _, cookie := range resp.Header["Set-Cookie"] {
			if match := regexp.MustCompile("^" + model.SessionCookieToken + "=([a-z0-9]+)").FindStringSubmatch(cookie); match != nil {
				sessionCookie = match[1]
			} else if match := regexp.MustCompile("^" + model.SessionCookieUser + "=([a-z0-9]+)").FindStringSubmatch(cookie); match != nil {
				userCookie = match[1]
			} else if match := regexp.MustCompile("^" + model.SessionCookieCsrf + "=([a-z0-9]+)").FindStringSubmatch(cookie); match != nil {
				csrfCookie = match[1]
			}
		}

		session, _ := th.App.GetSession(th.Client.AuthToken)

		assert.Equal(t, th.Client.AuthToken, sessionCookie)
		assert.Equal(t, user.Id, userCookie)
		assert.Equal(t, session.GetCSRF(), csrfCookie)
	})

	t.Run("should not return cookies without X-Requested-With header", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, resp, _ := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		assert.Empty(t, resp.Header.Get("Set-Cookie"))
	})

	t.Run("should include subpath in path", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.HTTPHeader[model.HeaderRequestedWith] = model.HeaderRequestedWithXML

		testCases := []struct {
			Description                   string
			SiteURL                       string
			ExpectedSetCookieHeaderRegexp string
		}{
			{"no subpath", "http://localhost:8065", "^MMAUTHTOKEN=[a-z0-9]+; Path=/"},
			{"subpath", "http://localhost:8065/subpath", "^MMAUTHTOKEN=[a-z0-9]+; Path=/subpath"},
		}

		for _, tc := range testCases {
			t.Run(tc.Description, func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ServiceSettings.SiteURL = tc.SiteURL
				})

				user, resp, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
				require.NoError(t, err)
				assert.Equal(t, user.Id, th.BasicUser.Id)

				cookies := resp.Header.Get("Set-Cookie")
				assert.Regexp(t, tc.ExpectedSetCookieHeaderRegexp, cookies)
			})
		}
	})

	t.Run("should return cookie with MMCLOUDURL for cloud installations", func(t *testing.T) {
		updateConfig := func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://testchips.cloud.mattermost.com"
		}
		th := SetupAndApplyConfigBeforeLogin(t, updateConfig).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		th.Client.HTTPHeader[model.HeaderRequestedWith] = model.HeaderRequestedWithXML
		_, resp, _ := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		found := false
		cookies := resp.Header.Values("Set-Cookie")
		for i := range cookies {
			if strings.Contains(cookies[i], "MMCLOUDURL") {
				found = true
				assert.Contains(t, cookies[i], "MMCLOUDURL=testchips;", "should contain MMCLOUDURL")
				assert.Contains(t, cookies[i], "Domain=mattermost.com;", "should contain Domain=mattermost.com")
				break
			}
		}
		assert.True(t, found, "Did not find MMCLOUDURL cookie")
	})

	t.Run("should return cookie with MMCLOUDURL for cloud installations when doing cws login", func(t *testing.T) {
		token := model.NewRandomString(64)
		os.Setenv("CWS_CLOUD_TOKEN", token)

		updateConfig := func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://testchips.cloud.mattermost.com"
		}
		th := SetupAndApplyConfigBeforeLogin(t, updateConfig).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		form := url.Values{}
		form.Add("login_id", th.SystemAdminUser.Email)
		form.Add("cws_token", token)

		th.Client.HTTPClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}

		r, _ := th.Client.DoAPIRequestWithHeaders(
			http.MethodPost,
			th.Client.APIURL+"/users/login/cws",
			form.Encode(),
			map[string]string{
				"Content-Type": "application/x-www-form-urlencoded",
			},
		)
		defer closeBody(r)

		cookies := r.Cookies()
		found := false
		for i := range cookies {
			if cookies[i].Name == model.SessionCookieCloudUrl {
				found = true
				assert.Equal(t, "testchips", cookies[i].Value)
			}
		}
		assert.True(t, found, "should have found cookie")
	})

	t.Run("should NOT return cookie with MMCLOUDURL for cloud installations without expected format of cloud URL", func(t *testing.T) {
		updateConfig := func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://testchips.com" // correct cloud URL would be https://testchips.cloud.mattermost.com
		}
		th := SetupAndApplyConfigBeforeLogin(t, updateConfig).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		_, resp, _ := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		cloudSessionCookie := ""
		for _, cookie := range resp.Header["Set-Cookie"] {
			if match := regexp.MustCompile("^" + model.SessionCookieCloudUrl + "=([a-z0-9]+)").FindStringSubmatch(cookie); match != nil {
				cloudSessionCookie = match[1]
			}
		}
		// no cookie set
		assert.Equal(t, "", cloudSessionCookie)
	})

	t.Run("should NOT return cookie with MMCLOUDURL for NON cloud installations", func(t *testing.T) {
		updateConfig := func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://testchips.com"
		}
		th := SetupAndApplyConfigBeforeLogin(t, updateConfig).InitBasic()
		defer th.TearDown()

		_, resp, _ := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		cloudSessionCookie := ""
		for _, cookie := range resp.Header["Set-Cookie"] {
			if match := regexp.MustCompile("^" + model.SessionCookieCloudUrl + "=([a-z0-9]+)").FindStringSubmatch(cookie); match != nil {
				cloudSessionCookie = match[1]
			}
		}
		// no cookie set
		assert.Equal(t, "", cloudSessionCookie)
	})
}

func TestCBALogin(t *testing.T) {
	t.Run("primary", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense("future_features"))

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExperimentalSettings.ClientSideCertEnable = true
			*cfg.ExperimentalSettings.ClientSideCertCheck = model.ClientSideCertCheckPrimaryAuth
		})

		t.Run("missing cert header", func(t *testing.T) {
			th.Client.Logout()
			_, resp, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("missing cert subject", func(t *testing.T) {
			th.Client.Logout()
			th.Client.HTTPHeader["X-SSL-Client-Cert"] = "valid_cert_fake"
			_, resp, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("emails mismatch", func(t *testing.T) {
			th.Client.Logout()
			th.Client.HTTPHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=mis_match" + th.BasicUser.Email
			_, resp, err := th.Client.Login(th.BasicUser.Email, "")
			require.Error(t, err)
			CheckUnauthorizedStatus(t, resp)
		})

		t.Run("successful cba login", func(t *testing.T) {
			th.Client.HTTPHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
			user, _, err := th.Client.Login(th.BasicUser.Email, "")
			require.NoError(t, err)
			require.NotNil(t, user)
			require.Equal(t, th.BasicUser.Id, user.Id)
		})

		t.Run("bot login rejected", func(t *testing.T) {
			bot, _, err := th.SystemAdminClient.CreateBot(&model.Bot{
				Username: "bot",
			})
			require.NoError(t, err)

			botUser, _, err := th.SystemAdminClient.GetUser(bot.UserId, "")
			require.NoError(t, err)

			th.Client.HTTPHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + botUser.Email

			_, _, err = th.Client.Login(botUser.Email, "")
			CheckErrorID(t, err, "api.user.login.bot_login_forbidden.app_error")
		})
	})

	t.Run("secondary", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense("future_features"))

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		th.Client.HTTPHeader["X-SSL-Client-Cert"] = "valid_cert_fake"

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExperimentalSettings.ClientSideCertEnable = true
			*cfg.ExperimentalSettings.ClientSideCertCheck = model.ClientSideCertCheckSecondaryAuth
		})

		t.Run("password required", func(t *testing.T) {
			th.Client.HTTPHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
			_, resp, err := th.Client.Login(th.BasicUser.Email, "")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("successful cba login with password", func(t *testing.T) {
			th.Client.HTTPHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + th.BasicUser.Email
			user, _, err := th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
			require.NoError(t, err)
			require.NotNil(t, user)
			require.Equal(t, th.BasicUser.Id, user.Id)
		})

		t.Run("bot login rejected", func(t *testing.T) {
			bot, _, err := th.SystemAdminClient.CreateBot(&model.Bot{
				Username: "bot",
			})
			require.NoError(t, err)

			botUser, _, err := th.SystemAdminClient.GetUser(bot.UserId, "")
			require.NoError(t, err)

			_, err = th.SystemAdminClient.UpdateUserPassword(bot.UserId, "", "password")
			require.NoError(t, err)

			th.Client.HTTPHeader["X-SSL-Client-Cert-Subject-DN"] = "C=US, ST=Maryland, L=Pasadena, O=Brent Baccala, OU=FreeSoft, CN=www.freesoft.org/emailAddress=" + botUser.Email

			_, _, err = th.Client.Login(botUser.Email, "password")
			CheckErrorID(t, err, "api.user.login.bot_login_forbidden.app_error")
		})
	})
}

func TestSwitchAccount(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.Enable = true })

	th.Client.Logout()

	sr := &model.SwitchRequest{
		CurrentService: model.UserAuthServiceEmail,
		NewService:     model.UserAuthServiceGitlab,
		Email:          th.BasicUser.Email,
		Password:       th.BasicUser.Password,
	}

	link, _, err := th.Client.SwitchAccountType(sr)
	require.NoError(t, err)

	require.NotEmpty(t, link, "bad link")

	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExperimentalEnableAuthenticationTransfer = false })

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceEmail,
		NewService:     model.UserAuthServiceGitlab,
	}

	_, resp, err := th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceSaml,
		NewService:     model.UserAuthServiceEmail,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceEmail,
		NewService:     model.UserAuthServiceLdap,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceLdap,
		NewService:     model.UserAuthServiceEmail,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExperimentalEnableAuthenticationTransfer = true })

	th.LoginBasic()

	fakeAuthData := model.NewId()
	_, appErr := th.App.Srv().Store().User().UpdateAuthData(th.BasicUser.Id, model.UserAuthServiceGitlab, &fakeAuthData, th.BasicUser.Email, true)
	require.NoError(t, appErr)

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceGitlab,
		NewService:     model.UserAuthServiceEmail,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	link, _, err = th.Client.SwitchAccountType(sr)
	require.NoError(t, err)

	require.Equal(t, "/login?extra=signin_change", link)

	th.Client.Logout()
	_, _, err = th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	th.Client.Logout()

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceGitlab,
		NewService:     model.ServiceGoogle,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceEmail,
		NewService:     model.UserAuthServiceGitlab,
		Password:       th.BasicUser.Password,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceEmail,
		NewService:     model.UserAuthServiceGitlab,
		Email:          th.BasicUser.Email,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	sr = &model.SwitchRequest{
		CurrentService: model.UserAuthServiceGitlab,
		NewService:     model.UserAuthServiceEmail,
		Email:          th.BasicUser.Email,
		NewPassword:    th.BasicUser.Password,
	}

	_, resp, err = th.Client.SwitchAccountType(sr)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func assertToken(t *testing.T, th *TestHelper, token *model.UserAccessToken, expectedUserId string) {
	t.Helper()

	oldSessionToken := th.Client.AuthToken
	defer func() { th.Client.AuthToken = oldSessionToken }()

	th.Client.AuthToken = token.Token
	ruser, _, err := th.Client.GetMe("")
	require.NoError(t, err)

	assert.Equal(t, expectedUserId, ruser.Id, "returned wrong user")
}

func assertInvalidToken(t *testing.T, th *TestHelper, token *model.UserAccessToken) {
	t.Helper()

	oldSessionToken := th.Client.AuthToken
	defer func() { th.Client.AuthToken = oldSessionToken }()

	th.Client.AuthToken = token.Token
	_, resp, err := th.Client.GetMe("")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestCreateUserAccessToken(t *testing.T) {
	t.Run("create token without permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("system admin and local mode can create access token", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			rtoken, _, err := client.CreateUserAccessToken(th.BasicUser.Id, "test token")
			require.NoError(t, err)

			assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
			assert.NotEmpty(t, rtoken.Token, "token should not be empty")
			assert.NotEmpty(t, rtoken.Id, "id should not be empty")
			assert.Equal(t, "test token", rtoken.Description, "description did not match")
			assert.True(t, rtoken.IsActive, "token should be active")
			assertToken(t, th, rtoken, th.BasicUser.Id)
		})
	})

	t.Run("create token for invalid user id", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := client.CreateUserAccessToken("notarealuserid", "test token")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})

	t.Run("create token with invalid value", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := client.CreateUserAccessToken(th.BasicUser.Id, "")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})

	t.Run("create token with user access tokens disabled", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := client.CreateUserAccessToken(th.BasicUser.Id, "test token")
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})
	})

	t.Run("create user access token", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		rtoken, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)

		assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
		assert.NotEmpty(t, rtoken.Token, "token should not be empty")
		assert.NotEmpty(t, rtoken.Id, "id should not be empty")
		assert.Equal(t, "test token", rtoken.Description, "description did not match")
		assert.True(t, rtoken.IsActive, "token should be active")

		assertToken(t, th, rtoken, th.BasicUser.Id)
	})

	t.Run("create user access token as second user, without permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp, err := th.Client.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create user access token for basic user as as system admin", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		rtoken, _, err := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)
		assert.Equal(t, th.BasicUser.Id, rtoken.UserId)

		oldSessionToken := th.Client.AuthToken
		defer func() { th.Client.AuthToken = oldSessionToken }()

		assertToken(t, th, rtoken, th.BasicUser.Id)
	})

	t.Run("create access token as oauth session", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		session, _ := th.App.GetSession(th.Client.AuthToken)
		session.IsOAuth = true
		th.App.AddSessionToCache(session)

		_, resp, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create access token for bot created by user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		t.Run("without MANAGE_BOT permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			_, resp, err = th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			token, _, err := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			require.NoError(t, err)
			assert.Equal(t, createdBot.UserId, token.UserId)
			assertToken(t, th, token, createdBot.UserId)
		})
	})

	t.Run("create access token for bot created by another user, only having MANAGE_BOTS permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp, err = th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)

			rtoken, _, err := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
			require.NoError(t, err)
			assert.Equal(t, createdBot.UserId, rtoken.UserId)

			assertToken(t, th, rtoken, createdBot.UserId)
		})
	})
}

func TestGetUserAccessToken(t *testing.T) {
	t.Run("get for invalid user id", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp, err := th.Client.GetUserAccessToken("123")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get for unknown user id", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		_, resp, err := th.Client.GetUserAccessToken(model.NewId())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get my token", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)

		rtoken, _, err := th.Client.GetUserAccessToken(token.Id)
		require.NoError(t, err)

		assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
		assert.Empty(t, rtoken.Token, "token should be blank")
		assert.NotEmpty(t, rtoken.Id, "id should not be empty")
		assert.Equal(t, "test token", rtoken.Description, "description did not match")
	})

	t.Run("get user token as system admin", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)

		rtoken, _, err := th.SystemAdminClient.GetUserAccessToken(token.Id)
		require.NoError(t, err)

		assert.Equal(t, th.BasicUser.Id, rtoken.UserId, "wrong user id")
		assert.Empty(t, rtoken.Token, "token should be blank")
		assert.NotEmpty(t, rtoken.Id, "id should not be empty")
		assert.Equal(t, "test token", rtoken.Description, "description did not match")
	})

	t.Run("get token for bot created by user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			_, resp, err := th.Client.GetUserAccessToken(token.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			returnedToken, _, err := th.Client.GetUserAccessToken(token.Id)
			require.NoError(t, err)

			// Actual token won't be returned.
			returnedToken.Token = token.Token
			assert.Equal(t, token, returnedToken)
		})
	})

	t.Run("get token for bot created by another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			_, resp, err := th.Client.GetUserAccessToken(token.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)

			returnedToken, _, err := th.Client.GetUserAccessToken(token.Id)
			require.NoError(t, err)

			// Actual token won't be returned.
			returnedToken.Token = token.Token
			assert.Equal(t, token, returnedToken)
		})
	})
}

func TestGetUserAccessTokensForUser(t *testing.T) {
	t.Run("multiple tokens, offset 0, limit 100", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		_, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)

		_, _, err = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		require.NoError(t, err)

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			rtokens, _, err := client.GetUserAccessTokensForUser(th.BasicUser.Id, 0, 100)
			require.NoError(t, err)

			assert.Len(t, rtokens, 2, "should have 2 tokens")
			for _, uat := range rtokens {
				assert.Equal(t, th.BasicUser.Id, uat.UserId, "wrong user id")
			}
		})
	})

	t.Run("multiple tokens, offset 1, limit 1", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		_, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)

		_, _, err = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		require.NoError(t, err)

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			rtokens, _, err := client.GetUserAccessTokensForUser(th.BasicUser.Id, 1, 1)
			require.NoError(t, err)

			assert.Len(t, rtokens, 1, "should have 1 tokens")
			for _, uat := range rtokens {
				assert.Equal(t, th.BasicUser.Id, uat.UserId, "wrong user id")
			}
		})
	})
}

func TestGetUserAccessTokens(t *testing.T) {
	t.Run("GetUserAccessTokens, not a system admin", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		_, resp, err := th.Client.GetUserAccessTokens(0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("GetUserAccessTokens, as a system admin, page 1, perPage 1", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		_, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		require.NoError(t, err)

		_, _, err = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		require.NoError(t, err)

		rtokens, _, err := th.SystemAdminClient.GetUserAccessTokens(1, 1)
		require.NoError(t, err)

		assert.Len(t, rtokens, 1, "should have 1 token")
	})

	t.Run("GetUserAccessTokens, as a system admin, page 0, perPage 2", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		_, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		require.NoError(t, err)

		_, _, err = th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token 2")
		require.NoError(t, err)

		rtokens, _, err := th.SystemAdminClient.GetUserAccessTokens(0, 2)
		require.NoError(t, err)

		assert.Len(t, rtokens, 2, "should have 2 tokens")
	})
}

func TestSearchUserAccessToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
	token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	require.NoError(t, err)

	_, resp, err := th.Client.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: token.Id})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	rtokens, _, err := th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: th.BasicUser.Id})
	require.NoError(t, err)

	require.Len(t, rtokens, 1, "should have 1 token")

	rtokens, _, err = th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: token.Id})
	require.NoError(t, err)

	require.Len(t, rtokens, 1, "should have 1 token")

	rtokens, _, err = th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: th.BasicUser.Username})
	require.NoError(t, err)

	require.Len(t, rtokens, 1, "should have 1 token")

	rtokens, _, err = th.SystemAdminClient.SearchUserAccessTokens(&model.UserAccessTokenSearch{Term: "not found"})
	require.NoError(t, err)

	require.Empty(t, rtokens, "should have 1 tokens")
}

func TestRevokeUserAccessToken(t *testing.T) {
	t.Run("revoke user token", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			token, _, err := client.CreateUserAccessToken(th.BasicUser.Id, "test token")
			require.NoError(t, err)
			assertToken(t, th, token, th.BasicUser.Id)

			_, err = client.RevokeUserAccessToken(token.Id)
			require.NoError(t, err)

			assertInvalidToken(t, th, token)
		})
	})

	t.Run("revoke token belonging to another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		require.NoError(t, err)

		resp, err := th.Client.RevokeUserAccessToken(token.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("revoke token for bot created by user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionRevokeUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			resp, err := th.Client.RevokeUserAccessToken(token.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			_, err := th.Client.RevokeUserAccessToken(token.Id)
			require.NoError(t, err)
		})
	})

	t.Run("revoke token for bot created by another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionRevokeUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			resp, err = th.Client.RevokeUserAccessToken(token.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)

			_, err := th.Client.RevokeUserAccessToken(token.Id)
			require.NoError(t, err)
		})
	})
}

func TestDisableUserAccessToken(t *testing.T) {
	t.Run("disable user token", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
		token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)
		assertToken(t, th, token, th.BasicUser.Id)

		_, err = th.Client.DisableUserAccessToken(token.Id)
		require.NoError(t, err)

		assertInvalidToken(t, th, token)
	})

	t.Run("disable token belonging to another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		require.NoError(t, err)

		resp, err := th.Client.DisableUserAccessToken(token.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("disable token for bot created by user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionRevokeUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			resp, err := th.Client.DisableUserAccessToken(token.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			_, err := th.Client.DisableUserAccessToken(token.Id)
			require.NoError(t, err)
		})
	})

	t.Run("disable token for bot created by another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionRevokeUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			resp, err = th.Client.DisableUserAccessToken(token.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)

			_, err := th.Client.DisableUserAccessToken(token.Id)
			require.NoError(t, err)
		})
	})
}

func TestEnableUserAccessToken(t *testing.T) {
	t.Run("enable user token", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
		token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, "test token")
		require.NoError(t, err)
		assertToken(t, th, token, th.BasicUser.Id)

		_, err = th.Client.DisableUserAccessToken(token.Id)
		require.NoError(t, err)

		assertInvalidToken(t, th, token)

		_, err = th.Client.EnableUserAccessToken(token.Id)
		require.NoError(t, err)

		assertToken(t, th, token, th.BasicUser.Id)
	})

	t.Run("enable token belonging to another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(th.BasicUser2.Id, "test token")
		require.NoError(t, err)

		_, err = th.SystemAdminClient.DisableUserAccessToken(token.Id)
		require.NoError(t, err)

		resp, err := th.Client.DisableUserAccessToken(token.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("enable token for bot created by user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionRevokeUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.Client.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		_, err = th.Client.DisableUserAccessToken(token.Id)
		require.NoError(t, err)

		t.Run("without MANAGE_BOTS permission", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			resp, err2 := th.Client.EnableUserAccessToken(token.Id)
			require.Error(t, err2)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)

			_, err = th.Client.EnableUserAccessToken(token.Id)
			require.NoError(t, err)
		})
	})

	t.Run("enable token for bot created by another user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateUserAccessToken.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionRevokeUserAccessToken.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		token, _, err := th.SystemAdminClient.CreateUserAccessToken(createdBot.UserId, "test token")
		require.NoError(t, err)

		_, err = th.SystemAdminClient.DisableUserAccessToken(token.Id)
		require.NoError(t, err)

		t.Run("only having MANAGE_BOTS permission", func(t *testing.T) {
			resp, err2 := th.Client.EnableUserAccessToken(token.Id)
			require.Error(t, err2)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("with MANAGE_OTHERS_BOTS permission", func(t *testing.T) {
			th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)

			_, err = th.Client.EnableUserAccessToken(token.Id)
			require.NoError(t, err)
		})
	})
}

func TestUserAccessTokenInactiveUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
	token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	require.NoError(t, err)

	th.Client.AuthToken = token.Token
	_, _, err = th.Client.GetMe("")
	require.NoError(t, err)

	th.App.UpdateActive(th.Context, th.BasicUser, false)

	_, resp, err := th.Client.GetMe("")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestUserAccessTokenDisableConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testDescription := "test token"

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })

	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
	token, _, err := th.Client.CreateUserAccessToken(th.BasicUser.Id, testDescription)
	require.NoError(t, err)

	oldSessionToken := th.Client.AuthToken
	th.Client.AuthToken = token.Token
	_, _, err = th.Client.GetMe("")
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })

	_, resp, err := th.Client.GetMe("")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.Client.AuthToken = oldSessionToken
	_, _, err = th.Client.GetMe("")
	require.NoError(t, err)
}

func TestUserAccessTokenDisableConfigBotsExcluded(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
		*cfg.ServiceSettings.EnableUserAccessTokens = false
	})

	bot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	rtoken, _, err := th.SystemAdminClient.CreateUserAccessToken(bot.UserId, "test token")
	th.Client.AuthToken = rtoken.Token
	require.NoError(t, err)

	_, _, err = th.Client.GetMe("")
	require.NoError(t, err)
}

func TestGetUsersByStatus(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, appErr := th.App.CreateTeam(th.Context, &model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	})

	require.Nil(t, appErr, "failed to create team")

	channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
		CreatorId:   model.NewId(),
	}, false)
	require.Nil(t, appErr, "failed to create channel")

	createUserWithStatus := func(username string, status string) *model.User {
		id := model.NewId()

		user, err := th.App.CreateUser(th.Context, &model.User{
			Email:    "success+" + id + "@simulator.amazonses.com",
			Username: "un_" + username + "_" + id,
			Nickname: "nn_" + id,
			Password: "Password1",
		})
		require.Nil(t, err, "failed to create user")

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
	offlineUser1 := createUserWithStatus("offline1", model.StatusOffline)
	offlineUser2 := createUserWithStatus("offline2", model.StatusOffline)
	awayUser1 := createUserWithStatus("away1", model.StatusAway)
	awayUser2 := createUserWithStatus("away2", model.StatusAway)
	onlineUser1 := createUserWithStatus("online1", model.StatusOnline)
	onlineUser2 := createUserWithStatus("online2", model.StatusOnline)
	dndUser1 := createUserWithStatus("dnd1", model.StatusDnd)
	dndUser2 := createUserWithStatus("dnd2", model.StatusDnd)

	client := th.CreateClient()
	_, _, err := client.Login(onlineUser2.Username, "Password1")
	require.NoError(t, err)

	t.Run("sorting by status then alphabetical", func(t *testing.T) {
		usersByStatus, _, err := client.GetUsersInChannelByStatus(channel.Id, 0, 8, "")
		require.NoError(t, err)

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
		require.Equal(t, len(expectedUsersByStatus), len(usersByStatus))

		for i := range usersByStatus {
			require.Equal(t, expectedUsersByStatus[i].Id, usersByStatus[i].Id)
		}
	})

	t.Run("paging", func(t *testing.T) {
		usersByStatus, _, err := client.GetUsersInChannelByStatus(channel.Id, 0, 3, "")
		require.NoError(t, err)
		require.Len(t, usersByStatus, 3)
		require.Equal(t, onlineUser1.Id, usersByStatus[0].Id, "online users first")
		require.Equal(t, onlineUser2.Id, usersByStatus[1].Id, "online users first")
		require.Equal(t, awayUser1.Id, usersByStatus[2].Id, "expected to receive away users second")

		usersByStatus, _, err = client.GetUsersInChannelByStatus(channel.Id, 1, 3, "")
		require.NoError(t, err)

		require.Equal(t, awayUser2.Id, usersByStatus[0].Id, "expected to receive away users second")
		require.Equal(t, dndUser1.Id, usersByStatus[1].Id, "expected to receive dnd users third")
		require.Equal(t, dndUser2.Id, usersByStatus[2].Id, "expected to receive dnd users third")

		usersByStatus, _, err = client.GetUsersInChannelByStatus(channel.Id, 1, 4, "")
		require.NoError(t, err)

		require.Len(t, usersByStatus, 4)
		require.Equal(t, dndUser1.Id, usersByStatus[0].Id, "expected to receive dnd users third")
		require.Equal(t, dndUser2.Id, usersByStatus[1].Id, "expected to receive dnd users third")

		require.Equal(t, offlineUser1.Id, usersByStatus[2].Id, "expected to receive offline users last")
		require.Equal(t, offlineUser2.Id, usersByStatus[3].Id, "expected to receive offline users last")
	})
}

func TestRegisterTermsOfServiceAction(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, "st_1", true)
	CheckErrorID(t, err, "app.terms_of_service.get.no_rows.app_error")

	termsOfService, appErr := th.App.CreateTermsOfService("terms of service", th.BasicUser.Id)
	require.Nil(t, appErr)

	_, err = th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, termsOfService.Id, true)
	require.NoError(t, err)

	_, appErr = th.App.GetUser(th.BasicUser.Id)
	require.Nil(t, appErr)
}

func TestGetUserTermsOfService(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, _, err := th.Client.GetUserTermsOfService(th.BasicUser.Id, "")
	CheckErrorID(t, err, "app.user_terms_of_service.get_by_user.no_rows.app_error")

	termsOfService, appErr := th.App.CreateTermsOfService("terms of service", th.BasicUser.Id)
	require.Nil(t, appErr)

	_, err = th.Client.RegisterTermsOfServiceAction(th.BasicUser.Id, termsOfService.Id, true)
	require.NoError(t, err)

	userTermsOfService, _, err := th.Client.GetUserTermsOfService(th.BasicUser.Id, "")
	require.NoError(t, err)

	assert.Equal(t, th.BasicUser.Id, userTermsOfService.UserId)
	assert.Equal(t, termsOfService.Id, userTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, userTermsOfService.CreateAt)
}

func TestLoginErrorMessage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.Client.Logout()
	require.NoError(t, err)

	// Email and Username enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.EnableSignInWithEmail = true
		*cfg.EmailSettings.EnableSignInWithUsername = true
	})
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_email_username")

	// Email enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.EnableSignInWithEmail = true
		*cfg.EmailSettings.EnableSignInWithUsername = false
	})
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_email")

	// Username enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.EnableSignInWithEmail = false
		*cfg.EmailSettings.EnableSignInWithUsername = true
	})
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_username")

	// SAML/SSO enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.SamlSettings.Enable = true
		*cfg.SamlSettings.Verify = false
		*cfg.SamlSettings.Encrypt = false
		*cfg.SamlSettings.IdpURL = "https://localhost/adfs/ls"
		*cfg.SamlSettings.IdpDescriptorURL = "https://localhost/adfs/services/trust"
		*cfg.SamlSettings.IdpMetadataURL = "https://localhost/adfs/metadata"
		*cfg.SamlSettings.ServiceProviderIdentifier = "https://localhost/login/sso/saml"
		*cfg.SamlSettings.AssertionConsumerServiceURL = "https://localhost/login/sso/saml"
		*cfg.SamlSettings.IdpCertificateFile = app.SamlIdpCertificateName
		*cfg.SamlSettings.PrivateKeyFile = app.SamlPrivateKeyName
		*cfg.SamlSettings.PublicCertificateFile = app.SamlPublicCertificateName
		*cfg.SamlSettings.EmailAttribute = "Email"
		*cfg.SamlSettings.UsernameAttribute = "Username"
		*cfg.SamlSettings.FirstNameAttribute = "FirstName"
		*cfg.SamlSettings.LastNameAttribute = "LastName"
		*cfg.SamlSettings.NicknameAttribute = ""
		*cfg.SamlSettings.PositionAttribute = ""
		*cfg.SamlSettings.LocaleAttribute = ""
	})
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_sso")
}

func TestLoginLockout(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.Client.Logout()
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 3 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_email_username")
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_email_username")
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.login.invalid_credentials_email_username")
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")
	_, _, err = th.Client.Login(th.BasicUser.Email, "wrong")
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")

	//Check if lock is active
	_, _, err = th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")

	// Fake user has MFA enabled
	err = th.Server.Store().User().UpdateMfaActive(th.BasicUser2.Id, true)
	require.NoError(t, err)
	_, _, err = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorID(t, err, "api.user.check_user_mfa.bad_code.app_error")
	_, _, err = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorID(t, err, "api.user.check_user_mfa.bad_code.app_error")
	_, _, err = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorID(t, err, "api.user.check_user_mfa.bad_code.app_error")
	_, _, err = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")
	_, _, err = th.Client.LoginWithMFA(th.BasicUser2.Email, th.BasicUser2.Password, "000000")
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")

	// Fake user has MFA disabled
	err = th.Server.Store().User().UpdateMfaActive(th.BasicUser2.Id, false)
	require.NoError(t, err)

	//Check if lock is active
	_, _, err = th.Client.Login(th.BasicUser2.Email, th.BasicUser2.Password)
	CheckErrorID(t, err, "api.user.check_user_login_attempts.too_many.app_error")
}

func TestDemoteUserToGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		th.App.Srv().RemoveLicense()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	user := th.BasicUser

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, _, err := c.GetUser(user.Id, "")
		require.NoError(t, err)

		_, err = c.DemoteUserToGuest(user.Id)
		require.NoError(t, err)

		defer require.Nil(t, th.App.PromoteGuestToUser(th.Context, user, ""))
	}, "demote a user to guest")

	t.Run("websocket update user event", func(t *testing.T) {
		webSocketClient, err := th.CreateWebSocketClient()
		assert.NoError(t, err)
		defer webSocketClient.Close()

		webSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		resp := <-webSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, resp.Status)

		adminWebSocketClient, err := th.CreateWebSocketSystemAdminClient()
		assert.NoError(t, err)
		defer adminWebSocketClient.Close()

		adminWebSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		resp = <-adminWebSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, resp.Status)

		_, _, err = th.SystemAdminClient.GetUser(user.Id, "")
		require.NoError(t, err)
		_, err = th.SystemAdminClient.DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		defer th.SystemAdminClient.PromoteGuestToUser(user.Id)

		assertExpectedWebsocketEvent(t, webSocketClient, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
			eventUser, ok := event.GetData()["user"].(*model.User)
			require.True(t, ok, "expected user")
			assert.Equal(t, "system_guest", eventUser.Roles)
		})
		assertExpectedWebsocketEvent(t, adminWebSocketClient, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
			eventUser, ok := event.GetData()["user"].(*model.User)
			require.True(t, ok, "expected user")
			assert.Equal(t, "system_guest", eventUser.Roles)
		})
	})
}

func TestPromoteGuestToUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = enableGuestAccounts })
		th.App.Srv().RemoveLicense()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.Srv().SetLicense(model.NewTestLicense())

	user := th.BasicUser
	th.App.UpdateUserRoles(th.Context, user.Id, model.SystemGuestRoleId, false)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, _, err := c.GetUser(user.Id, "")
		require.NoError(t, err)

		_, err = c.PromoteGuestToUser(user.Id)
		require.NoError(t, err)

		defer require.Nil(t, th.App.DemoteUserToGuest(th.Context, user))
	}, "promote a guest to user")

	t.Run("websocket update user event", func(t *testing.T) {
		webSocketClient, err := th.CreateWebSocketClient()
		assert.NoError(t, err)
		defer webSocketClient.Close()

		webSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		resp := <-webSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, resp.Status)

		adminWebSocketClient, err := th.CreateWebSocketSystemAdminClient()
		assert.NoError(t, err)
		defer adminWebSocketClient.Close()

		adminWebSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		resp = <-adminWebSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, resp.Status)

		_, _, err = th.SystemAdminClient.GetUser(user.Id, "")
		require.NoError(t, err)
		_, err = th.SystemAdminClient.PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		defer th.SystemAdminClient.DemoteUserToGuest(user.Id)

		assertExpectedWebsocketEvent(t, webSocketClient, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
			eventUser, ok := event.GetData()["user"].(*model.User)
			require.True(t, ok, "expected user")
			assert.Equal(t, "system_user", eventUser.Roles)
		})
		assertExpectedWebsocketEvent(t, adminWebSocketClient, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
			eventUser, ok := event.GetData()["user"].(*model.User)
			require.True(t, ok, "expected user")
			assert.Equal(t, "system_user", eventUser.Roles)
		})
	})
}

func TestVerifyUserEmailWithoutToken(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		email := th.GenerateTestEmail()
		user := model.User{Email: email, Nickname: "Darth Vader", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SystemUserRoleId}
		ruser, _, _ := th.Client.CreateUser(&user)

		vuser, _, err := client.VerifyUserEmailWithoutToken(ruser.Id)
		require.NoError(t, err)
		require.Equal(t, ruser.Id, vuser.Id)
	}, "Should verify a new user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		vuser, _, err := client.VerifyUserEmailWithoutToken("randomId")
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.invalid_url_param.app_error")
		require.Nil(t, vuser)
	}, "Should not be able to find user")

	t.Run("Should not be able to verify user due to permissions", func(t *testing.T) {
		user := th.CreateUser()
		vuser, _, err := th.Client.VerifyUserEmailWithoutToken(user.Id)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
		require.Nil(t, vuser)
	})
}

func TestGetKnownUsers(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t1, err := th.App.CreateTeam(th.Context, &model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	})
	require.Nil(t, err, "failed to create team")

	t2, err := th.App.CreateTeam(th.Context, &model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	})
	require.Nil(t, err, "failed to create team")

	t3, err := th.App.CreateTeam(th.Context, &model.Team{
		DisplayName: "dn_" + model.NewId(),
		Name:        GenerateTestTeamName(),
		Email:       th.GenerateTestEmail(),
		Type:        model.TeamOpen,
	})
	require.Nil(t, err, "failed to create team")

	c1, err := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      t1.Id,
		CreatorId:   model.NewId(),
	}, false)
	require.Nil(t, err, "failed to create channel")

	c2, err := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      t2.Id,
		CreatorId:   model.NewId(),
	}, false)
	require.Nil(t, err, "failed to create channel")

	c3, err := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.ChannelTypeOpen,
		TeamId:      t3.Id,
		CreatorId:   model.NewId(),
	}, false)
	require.Nil(t, err, "failed to create channel")

	u1 := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, u1)
	u2 := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, u2)
	u3 := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, u3)
	u4 := th.CreateUser()
	defer th.App.PermanentDeleteUser(th.Context, u4)

	th.LinkUserToTeam(u1, t1)
	th.LinkUserToTeam(u1, t2)
	th.LinkUserToTeam(u2, t1)
	th.LinkUserToTeam(u3, t2)
	th.LinkUserToTeam(u4, t3)

	th.App.AddUserToChannel(th.Context, u1, c1, false)
	th.App.AddUserToChannel(th.Context, u1, c2, false)
	th.App.AddUserToChannel(th.Context, u2, c1, false)
	th.App.AddUserToChannel(th.Context, u3, c2, false)
	th.App.AddUserToChannel(th.Context, u4, c3, false)

	t.Run("get know users sharing no channels", func(t *testing.T) {
		_, _, _ = th.Client.Login(u4.Email, u4.Password)
		userIds, _, err := th.Client.GetKnownUsers()
		require.NoError(t, err)
		assert.Empty(t, userIds)
	})

	t.Run("get know users sharing one channel", func(t *testing.T) {
		_, _, _ = th.Client.Login(u3.Email, u3.Password)
		userIds, _, err := th.Client.GetKnownUsers()
		require.NoError(t, err)
		assert.Len(t, userIds, 1)
		assert.Equal(t, userIds[0], u1.Id)
	})

	t.Run("get know users sharing multiple channels", func(t *testing.T) {
		_, _, _ = th.Client.Login(u1.Email, u1.Password)
		userIds, _, err := th.Client.GetKnownUsers()
		require.NoError(t, err)
		assert.Len(t, userIds, 2)
		assert.ElementsMatch(t, userIds, []string{u2.Id, u3.Id})
	})
}

func TestPublishUserTyping(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	tr := model.TypingRequest{
		ChannelId: th.BasicChannel.Id,
		ParentId:  "randomparentid",
	}

	t.Run("should return ok for non-system admin when triggering typing event for own user", func(t *testing.T) {
		_, err := th.Client.PublishUserTyping(th.BasicUser.Id, tr)
		require.NoError(t, err)
	})

	t.Run("should return ok for system admin when triggering typing event for own user", func(t *testing.T) {
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(th.SystemAdminUser, th.BasicChannel)

		_, err := th.SystemAdminClient.PublishUserTyping(th.SystemAdminUser.Id, tr)
		require.NoError(t, err)
	})

	t.Run("should return forbidden for non-system admin when triggering a typing event for a different user", func(t *testing.T) {
		resp, err := th.Client.PublishUserTyping(th.BasicUser2.Id, tr)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("should return bad request when triggering a typing event for an invalid user id", func(t *testing.T) {
		resp, err := th.Client.PublishUserTyping("invalid", tr)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.invalid_url_param.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("should send typing event via websocket when triggering a typing event for a user with a common channel", func(t *testing.T) {
		webSocketClient, err := th.CreateWebSocketClient()
		assert.NoError(t, err)
		defer webSocketClient.Close()

		webSocketClient.Listen()

		time.Sleep(300 * time.Millisecond)
		wsResp := <-webSocketClient.ResponseChannel
		require.Equal(t, model.StatusOk, wsResp.Status)

		_, err = th.SystemAdminClient.PublishUserTyping(th.BasicUser2.Id, tr)
		require.NoError(t, err)

		assertExpectedWebsocketEvent(t, webSocketClient, model.WebsocketEventTyping, func(resp *model.WebSocketEvent) {
			assert.Equal(t, th.BasicChannel.Id, resp.GetBroadcast().ChannelId)

			eventUserId, ok := resp.GetData()["user_id"].(string)
			require.True(t, ok, "expected user_id")
			assert.Equal(t, th.BasicUser2.Id, eventUserId)

			eventParentId, ok := resp.GetData()["parent_id"].(string)
			require.True(t, ok, "expected parent_id")
			assert.Equal(t, "randomparentid", eventParentId)
		})
	})

	th.Server.Platform().Busy.Set(time.Second * 10)

	t.Run("should return service unavailable for non-system admin user when triggering a typing event and server busy", func(t *testing.T) {
		resp, err := th.Client.PublishUserTyping("invalid", tr)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.server_busy.app_error")
		CheckServiceUnavailableStatus(t, resp)
	})

	t.Run("should return service unavailable for system admin user when triggering a typing event and server busy", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PublishUserTyping(th.SystemAdminUser.Id, tr)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.server_busy.app_error")
		CheckServiceUnavailableStatus(t, resp)
	})
}

func TestConvertUserToBot(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot, resp, err := th.Client.ConvertUserToBot(th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	require.Nil(t, bot)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		user := model.User{Email: th.GenerateTestEmail(), Username: GenerateTestUsername(), Password: "password"}

		ruser, resp, err := client.CreateUser(&user)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		bot, _, err = client.ConvertUserToBot(ruser.Id)
		require.NoError(t, err)
		require.NotNil(t, bot)
		require.Equal(t, bot.UserId, ruser.Id)

		bot, _, err = client.GetBot(bot.UserId, "")
		require.NoError(t, err)
		require.NotNil(t, bot)
	})
}

func TestGetChannelMembersWithTeamData(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channels, resp, err := th.Client.GetChannelMembersWithTeamData(th.BasicUser.Id, 0, 5)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.Len(t, channels, 5)
	for _, ch := range channels {
		assert.Equal(t, th.BasicTeam.DisplayName, ch.TeamDisplayName)
	}
}

func TestMigrateAuthToLDAP(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	resp, err := th.Client.MigrateAuthToLdap("email", "a", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err = client.MigrateAuthToLdap("email", "a", false)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}

func TestMigrateAuthToSAML(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	resp, err := th.Client.MigrateAuthToSaml("email", map[string]string{"1": "a"}, true)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err = client.MigrateAuthToSaml("email", map[string]string{"1": "a"}, true)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})
}
func TestUpdatePassword(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("Forbidden when request performed by system user on a system admin", func(t *testing.T) {
		res, err := th.Client.UpdatePassword(th.SystemAdminUser.Id, "Pa$$word11", "foobar")
		require.Error(t, err)
		CheckForbiddenStatus(t, res)
	})

	t.Run("OK when request performed by system user with requisite system permission, except if requested user is system admin", func(t *testing.T) {
		th.AddPermissionToRole(model.PermissionSysconsoleWriteUserManagementUsers.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(model.PermissionSysconsoleWriteUserManagementUsers.Id, model.SystemUserRoleId)

		res, _ := th.Client.UpdatePassword(th.TeamAdminUser.Id, "Pa$$word11", "foobar")
		CheckOKStatus(t, res)

		res, err := th.Client.UpdatePassword(th.SystemAdminUser.Id, "Pa$$word11", "foobar")
		require.Error(t, err)
		CheckForbiddenStatus(t, res)
	})

	t.Run("OK when request performed by system admin, even if requested user is system admin", func(t *testing.T) {
		res, _ := th.SystemAdminClient.UpdatePassword(th.SystemAdminUser.Id, "Pa$$word11", "foobar")
		CheckOKStatus(t, res)
	})
}

func TestGetThreadsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})
	t.Run("empty", func(t *testing.T) {
		client := th.Client

		_, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 0)
	})

	t.Run("no params, 1 thread", func(t *testing.T) {
		client := th.Client

		rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)
		require.Equal(t, uss.Threads[0].PostId, rpost.Id)
		require.Equal(t, uss.Threads[0].ReplyCount, int64(1))
	})

	t.Run("extended, 1 thread", func(t *testing.T) {
		client := th.Client

		rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Extended: true,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)
		require.Equal(t, uss.Threads[0].PostId, rpost.Id)
		require.Equal(t, uss.Threads[0].ReplyCount, int64(1))
		require.Equal(t, uss.Threads[0].Participants[0].Id, th.BasicUser.Id)
	})

	t.Run("deleted, 1 thread", func(t *testing.T) {
		client := th.Client

		rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)
		require.Equal(t, uss.Threads[0].PostId, rpost.Id)
		require.Equal(t, uss.Threads[0].ReplyCount, int64(1))
		require.Equal(t, uss.Threads[0].Participants[0].Id, th.BasicUser.Id)

		_, err = th.Client.DeletePost(rpost.Id)
		require.NoError(t, err)

		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 0)

		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: true,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)
		require.Greater(t, uss.Threads[0].Post.DeleteAt, int64(0))

	})

	t.Run("paged, 30 threads", func(t *testing.T) {
		client := th.Client

		var rootIds []*model.Post
		for i := 0; i < 30; i++ {
			rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			rootIds = append(rootIds, rpost)
			_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
		}

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted:  false,
			PageSize: 30,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 30)
		require.Len(t, rootIds, 30)
		require.Equal(t, uss.Threads[0].PostId, rootIds[29].Id)
		require.Equal(t, uss.Threads[0].ReplyCount, int64(1))
		require.Equal(t, uss.Threads[0].Participants[0].Id, th.BasicUser.Id)
	})

	t.Run("paged, 10 threads before/after", func(t *testing.T) {
		client := th.Client

		var rootIds []*model.Post
		for i := 0; i < 30; i++ {
			rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: fmt.Sprintf("testMsg-%d", i)})
			rootIds = append(rootIds, rpost)
			postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: fmt.Sprintf("testReply-%d", i), RootId: rpost.Id})
		}
		rootId := rootIds[15].Id // middle point
		rootIdBefore := rootIds[14].Id
		rootIdAfter := rootIds[16].Id

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted:  false,
			PageSize: 10,
			Before:   rootId,
		})

		require.NoError(t, err)
		require.Len(t, uss.Threads, 10)
		require.Equal(t, rootIdBefore, uss.Threads[0].PostId)

		uss2, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted:  false,
			PageSize: 10,
			After:    rootId,
		})
		require.NoError(t, err)
		require.Len(t, uss2.Threads, 10)

		require.Equal(t, rootIdAfter, uss2.Threads[0].PostId)

		uss3, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted:  false,
			PageSize: 10,
			After:    rootId + "__bad",
		})
		require.NoError(t, err)
		require.NotNil(t, uss3.Threads)
		require.Len(t, uss3.Threads, 0)
	})

	t.Run("totalsOnly param", func(t *testing.T) {
		client := th.Client
		sysadminClient := th.SystemAdminClient

		var rootIds []*model.Post
		for i := 0; i < 10; i++ {
			rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			rootIds = append(rootIds, rpost)
			if i%2 == 0 {
				_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
			} else {
				_, resp, err = sysadminClient.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply @" + th.BasicUser.Username, RootId: rpost.Id})
			}
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
		}

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted:    false,
			TotalsOnly: true,
			PageSize:   30,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 0)
		require.Len(t, rootIds, 10)
		require.Equal(t, int64(10), uss.Total)
		require.Equal(t, int64(5), uss.TotalUnreadThreads)
		require.Equal(t, int64(5), uss.TotalUnreadMentions)
	})

	t.Run("threadsOnly param", func(t *testing.T) {
		client := th.Client
		sysadminClient := th.SystemAdminClient

		var rootIds []*model.Post
		for i := 0; i < 10; i++ {
			rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			rootIds = append(rootIds, rpost)
			if i%2 == 0 {
				_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
			} else {
				_, resp, err = sysadminClient.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply @" + th.BasicUser.Username, RootId: rpost.Id})
			}

			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
		}

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted:     false,
			ThreadsOnly: true,
			PageSize:    30,
		})

		require.NoError(t, err)
		require.Len(t, rootIds, 10)
		require.Len(t, uss.Threads, 10)
		require.Equal(t, int64(0), uss.Total)
		require.Equal(t, int64(0), uss.TotalUnreadThreads)
		require.Equal(t, int64(0), uss.TotalUnreadMentions)
		require.Equal(t, int64(1), uss.Threads[0].ReplyCount)

		require.Equal(t, rootIds[9].Id, uss.Threads[0].PostId)
		require.Equal(t, th.SystemAdminUser.Id, uss.Threads[0].Participants[0].Id)
		require.Equal(t, th.BasicUser.Id, uss.Threads[1].Participants[0].Id)
	})

	t.Run("setting both threadsOnly, and totalsOnly params is not allowed", func(t *testing.T) {
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		_, resp, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			ThreadsOnly: true,
			TotalsOnly:  true,
			PageSize:    30,
		})

		require.Error(t, err)
		checkHTTPStatus(t, resp, http.StatusBadRequest)
	})

	t.Run("editing or reacting to reply post does not make thread unread", func(t *testing.T) {
		client := th.Client

		rootPost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "root post"})
		replyPost, _ := postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "reply post", RootId: rootPost.Id})
		uss, _, err := th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Equal(t, uss.TotalUnreadThreads, int64(1))
		require.Equal(t, uss.Threads[0].PostId, rootPost.Id)

		_, _, err = th.Client.UpdateThreadReadForUser(th.BasicUser.Id, th.BasicChannel.TeamId, rootPost.Id, model.GetMillis())
		require.NoError(t, err)
		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Equal(t, uss.TotalUnreadThreads, int64(0))

		// edit post
		editedReplyPostMessage := "edited " + replyPost.Message
		_, _, err = th.SystemAdminClient.PatchPost(replyPost.Id, &model.PostPatch{Message: &editedReplyPostMessage})
		require.NoError(t, err)
		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Equal(t, uss.TotalUnreadThreads, int64(0))

		// react to post
		reaction := &model.Reaction{
			UserId:    th.SystemAdminUser.Id,
			PostId:    replyPost.Id,
			EmojiName: "smile",
		}
		_, _, err = th.SystemAdminClient.SaveReaction(reaction)
		require.NoError(t, err)
		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Equal(t, uss.TotalUnreadThreads, int64(0))
	})
}

func TestThreadSocketEvents(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	userWSClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer userWSClient.Close()
	userWSClient.Listen()

	client := th.Client

	rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	replyPost, appErr := th.App.CreatePostAsUser(th.Context, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply @" + th.BasicUser.Username, UserId: th.BasicUser2.Id, RootId: rpost.Id}, th.Context.Session().Id, false)
	require.Nil(t, appErr)
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser2.Id)

	t.Run("Listed for update event", func(t *testing.T) {
		var caught bool
		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventThreadUpdated {
						caught = true
						var thread model.ThreadResponse
						jsonErr := json.Unmarshal([]byte(ev.GetData()["thread"].(string)), &thread)
						require.NoError(t, jsonErr)
						for _, p := range thread.Participants {
							if p.Id != th.BasicUser.Id && p.Id != th.BasicUser2.Id {
								require.Fail(t, "invalid participants")
							}
						}
					}
				case <-time.After(1 * time.Second):
					return
				}
			}
		}()
		require.Truef(t, caught, "User should have received %s event", model.WebsocketEventThreadUpdated)
	})

	resp, err = th.Client.UpdateThreadFollowForUser(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, false)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	t.Run("Listed for follow event", func(t *testing.T) {
		var caught bool
		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventThreadFollowChanged {
						caught = true
						require.Equal(t, ev.GetData()["state"], false)
						require.Equal(t, ev.GetData()["reply_count"], float64(1))
					}
				case <-time.After(1 * time.Second):
					return
				}
			}
		}()
		require.Truef(t, caught, "User should have received %s event", model.WebsocketEventThreadFollowChanged)
	})

	_, resp, err = th.Client.UpdateThreadReadForUser(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, replyPost.CreateAt+1)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	t.Run("Listed for read event", func(t *testing.T) {
		var caught bool
		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventThreadReadChanged {
						caught = true

						data := ev.GetData()
						require.EqualValues(t, replyPost.CreateAt+1, data["timestamp"])
						require.EqualValues(t, float64(1), data["previous_unread_replies"])
						require.EqualValues(t, float64(1), data["previous_unread_mentions"])
						require.EqualValues(t, float64(0), data["unread_replies"])
						require.EqualValues(t, float64(0), data["unread_mentions"])

					}
				case <-time.After(1 * time.Second):
					return
				}
			}
		}()

		require.Truef(t, caught, "User should have received %s event", model.WebsocketEventThreadReadChanged)
	})

	_, resp, err = th.Client.SetThreadUnreadByPostId(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, rpost.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	t.Run("Listen for read event 2", func(t *testing.T) {
		var caught bool
		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventThreadReadChanged {
						caught = true

						data := ev.GetData()
						require.EqualValues(t, rpost.CreateAt-1, data["timestamp"])
						require.EqualValues(t, float64(0), data["previous_unread_replies"])
						require.EqualValues(t, float64(0), data["previous_unread_mentions"])
						require.EqualValues(t, float64(1), data["unread_replies"])
						require.EqualValues(t, float64(1), data["unread_mentions"])

					}
				case <-time.After(1 * time.Second):
					return
				}
			}
		}()

		require.Truef(t, caught, "User should have received %s event", model.WebsocketEventThreadReadChanged)
	})

	// read the thread
	_, resp, err = th.Client.UpdateThreadReadForUser(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, replyPost.CreateAt+1)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	t.Run("Listen for thread updated event after create post", func(t *testing.T) {
		testCases := []struct {
			post        *model.Post
			preReplies  int64
			preMentions int64
			replies     int64
			mentions    int64
		}{
			{
				post:        &model.Post{ChannelId: th.BasicChannel.Id, Message: "simple reply", UserId: th.BasicUser2.Id, RootId: rpost.Id},
				preReplies:  0,
				preMentions: 0,
				replies:     1,
				mentions:    0,
			},
			{
				post:        &model.Post{ChannelId: th.BasicChannel.Id, Message: "mention reply 1 @" + th.BasicUser.Username, UserId: th.BasicUser2.Id, RootId: rpost.Id},
				preReplies:  1,
				preMentions: 0,
				replies:     2,
				mentions:    1,
			},
			{
				post:        &model.Post{ChannelId: th.BasicChannel.Id, Message: "mention reply 2 @" + th.BasicUser.Username, UserId: th.BasicUser2.Id, RootId: rpost.Id},
				preReplies:  2,
				preMentions: 1,
				replies:     3,
				mentions:    2,
			},
			{
				// posting as current user will read the thread
				post:        &model.Post{ChannelId: th.BasicChannel.Id, Message: "self reply", UserId: th.BasicUser.Id, RootId: rpost.Id},
				preReplies:  3,
				preMentions: 2,
				replies:     0,
				mentions:    0,
			}, {
				post:        &model.Post{ChannelId: th.BasicChannel.Id, Message: "simple reply", UserId: th.BasicUser2.Id, RootId: rpost.Id},
				preReplies:  0,
				preMentions: 0,
				replies:     1,
				mentions:    0,
			},
			{
				post:        &model.Post{ChannelId: th.BasicChannel.Id, Message: "mention reply 3 @" + th.BasicUser.Username, UserId: th.BasicUser2.Id, RootId: rpost.Id},
				preReplies:  1,
				preMentions: 0,
				replies:     2,
				mentions:    1,
			},
		}

		for _, tc := range testCases {
			// post a reply on the thread
			_, appErr = th.App.CreatePostAsUser(th.Context, tc.post, th.Context.Session().Id, false)
			require.Nil(t, appErr)

			var caught bool
			func() {
				for {
					select {
					case ev := <-userWSClient.EventChannel:
						if ev.EventType() == model.WebsocketEventThreadUpdated {
							caught = true
							data := ev.GetData()
							var thread model.ThreadResponse
							jsonErr := json.Unmarshal([]byte(data["thread"].(string)), &thread)
							require.NoError(t, jsonErr)

							require.Equal(t, tc.preReplies, int64(data["previous_unread_replies"].(float64)))
							require.Equal(t, tc.preMentions, int64(data["previous_unread_mentions"].(float64)))
							require.Equal(t, tc.replies, thread.UnreadReplies)
							require.Equal(t, tc.mentions, thread.UnreadMentions)
						}
					case <-time.After(1 * time.Second):
						return
					}
				}
			}()

			require.Truef(t, caught, "User should have received %s event", model.WebsocketEventThreadUpdated)
		}
	})

	t.Run("Listen for thread updated event after create post when not previously following the thread", func(t *testing.T) {
		rpost2 := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser2.Id, Message: "root post"}

		var appErr *model.AppError
		rpost2, appErr = th.App.CreatePostAsUser(th.Context, rpost2, th.Context.Session().Id, false)
		require.Nil(t, appErr)

		reply1 := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser2.Id, Message: "reply 1", RootId: rpost2.Id}
		reply2 := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser2.Id, Message: "reply 2", RootId: rpost2.Id}
		reply3 := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser2.Id, Message: "mention @" + th.BasicUser.Username, RootId: rpost2.Id}

		_, appErr = th.App.CreatePostAsUser(th.Context, reply1, th.Context.Session().Id, false)
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePostAsUser(th.Context, reply2, th.Context.Session().Id, false)
		require.Nil(t, appErr)
		_, appErr = th.App.CreatePostAsUser(th.Context, reply3, th.Context.Session().Id, false)
		require.Nil(t, appErr)

		count := 0
		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventThreadUpdated {
						count++
						data := ev.GetData()
						var thread model.ThreadResponse
						jsonErr := json.Unmarshal([]byte(data["thread"].(string)), &thread)
						require.NoError(t, jsonErr)

						require.Equal(t, int64(0), int64(data["previous_unread_replies"].(float64)))
						require.Equal(t, int64(0), int64(data["previous_unread_mentions"].(float64)))
						require.Equal(t, int64(3), thread.UnreadReplies)
						require.Equal(t, int64(1), thread.UnreadMentions)
					}
				case <-time.After(1 * time.Second):
					return
				}
			}
		}()

		require.Equalf(t, 1, count, "User should have received 1 %s event", model.WebsocketEventThreadUpdated)
	})
}

func TestFollowThreads(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	t.Run("1 thread", func(t *testing.T) {
		client := th.Client

		rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
		var uss *model.Threads
		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)

		resp, err = th.Client.UpdateThreadFollowForUser(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 0)

		resp, err = th.Client.UpdateThreadFollowForUser(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, true)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)
		require.GreaterOrEqual(t, uss.Threads[0].LastViewedAt, uss.Threads[0].LastReplyAt)

	})

	t.Run("No permission to channel", func(t *testing.T) {
		// Add user1 to private channel
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, th.BasicPrivateChannel2, false)
		require.Nil(t, appErr)
		defer th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", th.BasicPrivateChannel2)

		// create thread in private channel
		rpost, resp, err := th.Client.CreatePost(&model.Post{ChannelId: th.BasicPrivateChannel2.Id, Message: "root post"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		_, resp, err = th.Client.CreatePost(&model.Post{ChannelId: th.BasicPrivateChannel2.Id, Message: "testReply", RootId: rpost.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Try to follow thread as other user who is not in the private channel
		resp, err = th.Client.UpdateThreadFollowForUser(th.BasicUser2.Id, th.BasicTeam.Id, rpost.Id, true)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Try to unfollow thread as other user who is not in the private channel
		resp, err = th.Client.UpdateThreadFollowForUser(th.BasicUser2.Id, th.BasicTeam.Id, rpost.Id, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func checkThreadListReplies(t *testing.T, th *TestHelper, client *model.Client4, userId string, expectedReplies, expectedThreads int, options *model.GetUserThreadsOpts) (*model.Threads, *model.Response) {
	opts := model.GetUserThreadsOpts{}
	if options != nil {
		opts = *options
	}
	u, resp, err := client.GetUserThreads(userId, th.BasicTeam.Id, opts)
	require.NoError(t, err)
	require.Len(t, u.Threads, expectedThreads)

	count := int64(0)
	sum := int64(0)
	for _, thr := range u.Threads {
		if thr.UnreadReplies > 0 {
			count += 1
		}
		sum += thr.UnreadReplies
	}
	require.EqualValues(t, expectedReplies, sum, "expectedReplies don't match")
	require.Equal(t, count, u.TotalUnreadThreads, "TotalUnreadThreads don't match")

	return u, resp
}

func postAndCheck(t *testing.T, client *model.Client4, post *model.Post) (*model.Post, *model.Response) {
	p, resp, err := client.CreatePost(post)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	return p, resp
}

func TestMaintainUnreadRepliesInThread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	defer th.UnlinkUserFromTeam(th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(th.SystemAdminUser, th.BasicChannel)
	defer th.RemoveUserFromChannel(th.SystemAdminUser, th.BasicChannel)
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	client := th.Client
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

	// create a post by regular user
	rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
	// reply with another
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})

	// regular user should have one thread with one reply
	checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 1, 1, nil)

	// add another reply by regular user
	postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply2", RootId: rpost.Id})

	// replying to the thread clears reply count, so it should be 0
	checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 0, 1, nil)

	// the other user should have 1 reply - the reply from the regular user
	checkThreadListReplies(t, th, th.SystemAdminClient, th.SystemAdminUser.Id, 1, 1, nil)

	// mark all as read for user
	resp, err := th.Client.UpdateThreadsReadForUser(th.BasicUser.Id, th.BasicTeam.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// reply count should be 0
	checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 0, 1, nil)

	// mark other user's read state
	_, resp, err = th.SystemAdminClient.UpdateThreadReadForUser(th.SystemAdminUser.Id, th.BasicTeam.Id, rpost.Id, model.GetMillis())
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// get unread only, should return nothing
	checkThreadListReplies(t, th, th.SystemAdminClient, th.SystemAdminUser.Id, 0, 0, &model.GetUserThreadsOpts{Unread: true})

	// restore unread to an old date
	_, resp, err = th.SystemAdminClient.UpdateThreadReadForUser(th.SystemAdminUser.Id, th.BasicTeam.Id, rpost.Id, 123)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	// should have 2 unread replies now
	checkThreadListReplies(t, th, th.SystemAdminClient, th.SystemAdminUser.Id, 2, 1, &model.GetUserThreadsOpts{Unread: true})

}

func TestThreadCounts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	client := th.Client
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

	// create a post by regular user
	rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
	// reply with another
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})

	// create another post by regular user
	rpost2, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testMsg1"})
	// reply with another 2 times
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testReply2", RootId: rpost2.Id})
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testReply22", RootId: rpost2.Id})

	// regular user should have two threads with 3 replies total
	checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 3, 2, &model.GetUserThreadsOpts{
		Deleted: false,
	})

	// delete first thread
	th.App.Srv().Store().Post().Delete(rpost.Id, model.GetMillis(), th.BasicUser.Id)

	// we should now have 1 thread with 2 replies
	checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 2, 1, &model.GetUserThreadsOpts{
		Deleted: false,
	})
	// with Deleted we should get the same as before deleting
	checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 3, 2, &model.GetUserThreadsOpts{
		Deleted: true,
	})
}

func TestSingleThreadGet(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	client := th.Client
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

	// create a post by regular user
	rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
	// reply with another
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})

	// create another thread to check that we are not returning it by mistake
	rpost2, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testMsg2"})
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testReply", RootId: rpost2.Id})

	// regular user should have two threads with 3 replies total
	threads, _ := checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 2, 2, nil)

	tr, _, err := th.Client.GetUserThread(th.BasicUser.Id, th.BasicTeam.Id, threads.Threads[0].PostId, false)
	require.NoError(t, err)
	require.NotNil(t, tr)
	require.Equal(t, threads.Threads[0].PostId, tr.PostId)
	require.Empty(t, tr.Participants[0].Username)

	tr, _, err = th.Client.GetUserThread(th.BasicUser.Id, th.BasicTeam.Id, threads.Threads[0].PostId, true)
	require.NoError(t, err)
	require.NotEmpty(t, tr.Participants[0].Username)
}

func TestMaintainUnreadMentionsInThread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	defer th.UnlinkUserFromTeam(th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(th.SystemAdminUser, th.BasicChannel)
	defer th.RemoveUserFromChannel(th.SystemAdminUser, th.BasicChannel)
	client := th.Client
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})
	checkThreadList := func(client *model.Client4, userId string, expectedMentions, expectedThreads int) (*model.Threads, *model.Response) {
		uss, resp, err := client.GetUserThreads(userId, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)

		require.Len(t, uss.Threads, expectedThreads)
		sum := int64(0)
		for _, thr := range uss.Threads {
			sum += thr.UnreadMentions
		}
		require.Equal(t, sum, uss.TotalUnreadMentions)
		require.EqualValues(t, expectedMentions, uss.TotalUnreadMentions)

		return uss, resp
	}

	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
	defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

	// create regular post
	rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
	// create reply and mention the original poster and another user
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply @" + th.BasicUser.Username + " and @" + th.BasicUser2.Username, RootId: rpost.Id})

	// basic user 1 was mentioned 1 time
	checkThreadList(th.Client, th.BasicUser.Id, 1, 1)
	// basic user 2 was mentioned 1 time
	checkThreadList(th.SystemAdminClient, th.BasicUser2.Id, 1, 1)

	// test self mention, shouldn't increase mention count
	postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply @" + th.BasicUser.Username, RootId: rpost.Id})
	// mention should be 0 after self reply
	checkThreadList(th.Client, th.BasicUser.Id, 0, 1)

	// test DM
	dm := th.CreateDmChannel(th.SystemAdminUser)
	dm_root_post, _ := postAndCheck(t, client, &model.Post{ChannelId: dm.Id, Message: "hi @" + th.SystemAdminUser.Username})

	// no changes
	checkThreadList(th.Client, th.BasicUser.Id, 0, 1)

	// post reply by the same user
	postAndCheck(t, client, &model.Post{ChannelId: dm.Id, Message: "how are you", RootId: dm_root_post.Id})

	// thread created
	checkThreadList(th.Client, th.BasicUser.Id, 0, 2)

	// post two replies by another user, without mentions. mention count should still increase since this is a DM
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: dm.Id, Message: "msg1", RootId: dm_root_post.Id})
	postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: dm.Id, Message: "msg2", RootId: dm_root_post.Id})
	// expect increment by two mentions
	checkThreadList(th.Client, th.BasicUser.Id, 2, 2)
}

func TestReadThreads(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})
	client := th.Client
	t.Run("all threads", func(t *testing.T) {

		rpost, resp, err := client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		_, resp, err = client.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply", RootId: rpost.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)

		var uss, uss2 *model.Threads
		uss, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss.Threads, 1)

		resp, err = th.Client.UpdateThreadsReadForUser(th.BasicUser.Id, th.BasicTeam.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		uss2, _, err = th.Client.GetUserThreads(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{
			Deleted: false,
		})
		require.NoError(t, err)
		require.Len(t, uss2.Threads, 1)
		require.Greater(t, uss2.Threads[0].LastViewedAt, uss.Threads[0].LastViewedAt)
	})

	t.Run("1 thread by timestamp", func(t *testing.T) {
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

		rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsgC1"})
		postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReplyC1", RootId: rpost.Id})

		rrpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testMsgC2"})
		postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel2.Id, Message: "testReplyC2", RootId: rrpost.Id})

		uss, _ := checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 2, 2, nil)

		_, resp, err := th.Client.UpdateThreadReadForUser(th.BasicUser.Id, th.BasicTeam.Id, rrpost.Id, model.GetMillis()+10)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		uss2, _ := checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 1, 2, nil)
		require.Greater(t, uss2.Threads[0].LastViewedAt, uss.Threads[0].LastViewedAt)

		timestamp := model.GetMillis()
		_, resp, err = th.Client.UpdateThreadReadForUser(th.BasicUser.Id, th.BasicTeam.Id, rrpost.Id, timestamp)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		uss3, _ := checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 1, 2, nil)
		require.Equal(t, uss3.Threads[0].LastViewedAt, timestamp)
	})

	t.Run("1 thread by post id", func(t *testing.T) {
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.BasicUser.Id)
		defer th.App.Srv().Store().Post().PermanentDeleteByUser(th.SystemAdminUser.Id)

		rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsgC1"})
		reply1, _ := postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReplyC1", RootId: rpost.Id})
		reply2, _ := postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReplyC1", RootId: rpost.Id})
		reply3, _ := postAndCheck(t, th.SystemAdminClient, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReplyC1", RootId: rpost.Id})

		checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 3, 1, nil)

		_, resp, err := th.Client.UpdateThreadReadForUser(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, reply3.CreateAt+1)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 0, 1, nil)

		_, resp, err = th.Client.SetThreadUnreadByPostId(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, reply1.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 3, 1, nil)

		_, resp, err = th.Client.SetThreadUnreadByPostId(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, reply2.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 2, 1, nil)

		_, resp, err = th.Client.SetThreadUnreadByPostId(th.BasicUser.Id, th.BasicTeam.Id, rpost.Id, reply3.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		checkThreadListReplies(t, th, th.Client, th.BasicUser.Id, 1, 1, nil)
	})
}

func TestMarkThreadUnreadMentionCount(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})
	client := th.Client

	channel := th.BasicChannel
	user := th.BasicUser
	user2 := th.BasicUser2
	appErr := th.App.JoinChannel(th.Context, channel, user.Id)
	require.Nil(t, appErr)
	appErr = th.App.JoinChannel(th.Context, channel, user2.Id)
	require.Nil(t, appErr)

	rpost, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testMsg @" + th.BasicUser2.Username})
	reply1, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply1 @" + th.BasicUser2.Username, RootId: rpost.Id})
	reply2, _ := postAndCheck(t, client, &model.Post{ChannelId: th.BasicChannel.Id, Message: "testReply2", RootId: rpost.Id})

	th.SystemAdminClient.UpdateThreadReadForUser(th.BasicUser2.Id, th.BasicTeam.Id, rpost.Id, model.GetMillis())

	u, _, _ := th.SystemAdminClient.GetUserThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
	require.EqualValues(t, 0, u.TotalUnreadMentions)

	th.SystemAdminClient.UpdateThreadReadForUser(th.BasicUser2.Id, th.BasicTeam.Id, rpost.Id, rpost.CreateAt)

	u, _, _ = th.SystemAdminClient.GetUserThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
	require.EqualValues(t, 1, u.TotalUnreadMentions)

	th.SystemAdminClient.UpdateThreadReadForUser(th.BasicUser2.Id, th.BasicTeam.Id, rpost.Id, reply1.CreateAt)

	u, _, _ = th.SystemAdminClient.GetUserThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
	require.EqualValues(t, 1, u.TotalUnreadMentions)

	th.SystemAdminClient.UpdateThreadReadForUser(th.BasicUser2.Id, th.BasicTeam.Id, rpost.Id, reply2.CreateAt)

	u, _, _ = th.SystemAdminClient.GetUserThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
	require.EqualValues(t, 0, u.TotalUnreadMentions)
}

func TestPatchAndUpdateWithProviderAttributes(t *testing.T) {
	t.Run("LDAP user", func(t *testing.T) {
		th := SetupEnterprise(t).InitBasic()
		defer th.TearDown()
		user := th.CreateUserWithAuth(model.UserAuthServiceLdap)
		ldapMock := &mocks.LdapInterface{}
		ldapMock.Mock.On(
			"CheckProviderAttributes",
			mock.Anything, // app.AppIface
			mock.Anything, // *model.User
			mock.Anything, // *model.Patch
		).Return("")
		th.App.Channels().Ldap = ldapMock
		// CheckProviderAttributes should be called for both Patch and Update
		th.SystemAdminClient.PatchUser(user.Id, &model.UserPatch{})
		ldapMock.AssertNumberOfCalls(t, "CheckProviderAttributes", 1)
		th.SystemAdminClient.UpdateUser(user)
		ldapMock.AssertNumberOfCalls(t, "CheckProviderAttributes", 2)
	})
	t.Run("SAML user", func(t *testing.T) {
		t.Run("with LDAP sync", func(t *testing.T) {
			th := SetupEnterprise(t).InitBasic()
			defer th.TearDown()
			th.SetupLdapConfig()
			th.SetupSamlConfig()
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.SamlSettings.EnableSyncWithLdap = true
			})
			user := th.CreateUserWithAuth(model.UserAuthServiceSaml)
			ldapMock := &mocks.LdapInterface{}
			ldapMock.Mock.On(
				"CheckProviderAttributes", mock.Anything, mock.Anything, mock.Anything,
			).Return("")
			th.App.Channels().Ldap = ldapMock
			th.SystemAdminClient.PatchUser(user.Id, &model.UserPatch{})
			ldapMock.AssertNumberOfCalls(t, "CheckProviderAttributes", 1)
			th.SystemAdminClient.UpdateUser(user)
			ldapMock.AssertNumberOfCalls(t, "CheckProviderAttributes", 2)
		})
		t.Run("without LDAP sync", func(t *testing.T) {
			th := SetupEnterprise(t).InitBasic()
			defer th.TearDown()
			user := th.CreateUserWithAuth(model.UserAuthServiceSaml)
			samlMock := &mocks.SamlInterface{}
			samlMock.Mock.On(
				"CheckProviderAttributes", mock.Anything, mock.Anything, mock.Anything,
			).Return("")
			th.App.Channels().Saml = samlMock
			th.SystemAdminClient.PatchUser(user.Id, &model.UserPatch{})
			samlMock.AssertNumberOfCalls(t, "CheckProviderAttributes", 1)
			th.SystemAdminClient.UpdateUser(user)
			samlMock.AssertNumberOfCalls(t, "CheckProviderAttributes", 2)
		})
	})
	t.Run("OpenID user", func(t *testing.T) {
		th := SetupEnterprise(t).InitBasic()
		defer th.TearDown()
		user := th.CreateUserWithAuth(model.ServiceOpenid)
		// OAUTH users cannot change these fields
		for _, fieldName := range []string{
			"FirstName",
			"LastName",
		} {
			patch := user.ToPatch()
			patch.SetField(fieldName, "something new")
			conflictField := th.App.CheckProviderAttributes(user, patch)
			require.NotEqual(t, "", conflictField)
		}
	})
	t.Run("Patch username", func(t *testing.T) {
		th := SetupEnterprise(t).InitBasic()
		defer th.TearDown()
		// For non-email users, the username must be changed through the provider
		for _, authService := range []string{
			model.UserAuthServiceLdap,
			model.UserAuthServiceSaml,
			model.ServiceOpenid,
		} {
			user := th.CreateUserWithAuth(authService)
			patch := &model.UserPatch{Username: model.NewString("something new")}
			conflictField := th.App.CheckProviderAttributes(user, patch)
			require.NotEqual(t, "", conflictField)
		}
	})
}

func TestSetProfileImageWithProviderAttributes(t *testing.T) {
	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	type imageTestCase struct {
		testName      string
		ldapAttrIsSet bool
		shouldPass    bool
	}

	doImageTest := func(t *testing.T, th *TestHelper, user *model.User, testCase imageTestCase) {
		client := th.SystemAdminClient
		t.Run(testCase.testName, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				if testCase.ldapAttrIsSet {
					*cfg.LdapSettings.PictureAttribute = "jpegPhoto"
				} else {
					*cfg.LdapSettings.PictureAttribute = ""
				}
			})
			resp, err2 := client.SetProfileImage(user.Id, data)
			if testCase.shouldPass {
				require.NoError(t, err2)
			} else {
				require.Error(t, err2)
				checkHTTPStatus(t, resp, http.StatusConflict)
			}
		})
	}
	doCleanup := func(t *testing.T, th *TestHelper, user *model.User) {
		info := &model.FileInfo{Path: "users/" + user.Id + "/profile.png"}
		err = th.cleanupTestFile(info)
		require.NoError(t, err)
	}

	t.Run("LDAP user", func(t *testing.T) {
		testCases := []imageTestCase{
			{"profile picture attribute is set", true, false},
			{"profile picture attribute is not set", false, true},
		}
		th := SetupEnterprise(t).InitBasic()
		defer th.TearDown()
		th.SetupLdapConfig()
		user := th.CreateUserWithAuth(model.UserAuthServiceLdap)
		for _, testCase := range testCases {
			doImageTest(t, th, user, testCase)
		}
		doCleanup(t, th, user)
	})

	t.Run("SAML user", func(t *testing.T) {
		th := SetupEnterprise(t).InitBasic()
		defer th.TearDown()
		th.SetupLdapConfig()
		th.SetupSamlConfig()
		user := th.CreateUserWithAuth(model.UserAuthServiceSaml)

		t.Run("with LDAP sync", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.SamlSettings.EnableSyncWithLdap = true
			})
			testCases := []imageTestCase{
				{"profile picture attribute is set", true, false},
				{"profile picture attribute is not set", false, true},
			}
			for _, testCase := range testCases {
				doImageTest(t, th, user, testCase)
			}
		})
		t.Run("without LDAP sync", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.SamlSettings.EnableSyncWithLdap = false
			})
			testCases := []imageTestCase{
				{"profile picture attribute is set", true, true},
				{"profile picture attribute is not set", false, true},
			}
			for _, testCase := range testCases {
				doImageTest(t, th, user, testCase)
			}
		})
		doCleanup(t, th, user)
	})
}

func TestGetUsersWithInvalidEmails(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.SystemAdminClient

	user := model.User{
		Email:    "ben@invalid.mattermost.com",
		Nickname: "Ben Cooke",
		Password: "hello1",
		Username: GenerateTestUsername(),
		Roles:    model.SystemAdminRoleId + " " + model.SystemUserRoleId,
	}

	_, resp, err := client.CreateUser(&user)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableOpenServer = false
		*cfg.TeamSettings.RestrictCreationToDomains = "localhost,simulator.amazonses.com"
	})

	users, _, err := client.GetUsersWithInvalidEmails(0, 50)
	require.NoError(t, err)
	assert.Len(t, users, 1)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableOpenServer = true
	})

	_, resp, err = client.GetUsersWithInvalidEmails(0, 50)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableOpenServer = false
		*cfg.TeamSettings.RestrictCreationToDomains = "localhost,simulator.amazonses.com,invalid.mattermost.com"
	})

	users, _, err = client.GetUsersWithInvalidEmails(0, 50)
	require.NoError(t, err)
	assert.Len(t, users, 0)

	_, resp, err = th.Client.GetUsersWithInvalidEmails(0, 50)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}
func TestUserUpdateEvents(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client1 := th.CreateClient()
	th.LoginBasicWithClient(client1)
	WebSocketClient, err := th.CreateWebSocketClientWithClient(client1)
	require.NoError(t, err)
	defer WebSocketClient.Close()
	WebSocketClient.Listen()
	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk)

	client2 := th.CreateClient()
	th.LoginBasic2WithClient(client2)
	WebSocketClient2, err := th.CreateWebSocketClientWithClient(client2)
	require.NoError(t, err)
	defer WebSocketClient2.Close()
	WebSocketClient2.Listen()
	resp = <-WebSocketClient2.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk)

	time.Sleep(1000 * time.Millisecond)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// trigger user update for onlineUser2
		th.BasicUser.Nickname = "something_else"
		ruser, _, err := client1.UpdateUser(th.BasicUser)
		require.NoError(t, err)
		CheckUserSanitization(t, ruser)

		assertExpectedWebsocketEvent(t, WebSocketClient, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
			eventUser, ok := event.GetData()["user"].(*model.User)
			require.True(t, ok, "expected user")
			// assert eventUser.Id is same as th.BasicUser.Id
			assert.Equal(t, eventUser.Id, th.BasicUser.Id)
			// assert eventUser.NotifyProps isn't empty
			require.NotEmpty(t, eventUser.NotifyProps, "user event for source user should not be sanitized")
		})
		assertExpectedWebsocketEvent(t, WebSocketClient2, model.WebsocketEventUserUpdated, func(event *model.WebSocketEvent) {
			eventUser, ok := event.GetData()["user"].(*model.User)
			require.True(t, ok, "expected user")
			// assert eventUser.Id is same as th.BasicUser.Id
			assert.Equal(t, eventUser.Id, th.BasicUser.Id)
			// assert eventUser.NotifyProps is an empty map
			require.Empty(t, eventUser.NotifyProps, "user event for non-source users should be sanitized")
		})
	})
}
