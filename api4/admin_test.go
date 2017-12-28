// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestAdminUpdateUser(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.CreateTeamWithClient(Client)

	user := th.CreateUser()

	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	// Regular user can not use endpoint
	if _, err := th.Client.AdminUpdateUser(user.Id, *user.AuthData, user.AuthService, user.Password); err == nil {
		t.Fatal("Shouldn't have permissions. Only Admins")
	}

	authData := "test@test.com"
	ruser, resp := Client.AdminUpdateUser(user.Id, authData, model.USER_AUTH_SERVICE_SAML, "newpassword")
	CheckNoError(t, resp)

	// AuthData and AuthService are set, password is set to empty
	if *ruser.AuthData != authData {
		t.Fatal("Should have set the correct AuthData")
	}
	if ruser.AuthService != model.USER_AUTH_SERVICE_SAML {
		t.Fatal("Should have set the correct AuthService")
	}
	if ruser.Password != "" {
		t.Fatal("Password should be empty")
	}

	// When AuthData or AuthService are empty, password must be valid
	user.Password = "1"
	if _, err := Client.AdminUpdateUser(user.Id, *user.AuthData, "", user.Password); err == nil {
		t.Fatal("Should have errored - user password not valid")
	}

	// Not allowed to update other fields besided AuthData, AuthService and/or Password
	user.Nickname = "Jim Jimmy"
	user.Roles = model.SYSTEM_ADMIN_ROLE_ID
	user.Password = "Password1"
	user.LastPasswordUpdate = 123

	ruser, resp = Client.AdminUpdateUser(user.Id, *user.AuthData, user.AuthService, user.Password)
	CheckNoError(t, resp)

	if ruser.Nickname == "Jim Jimmy" {
		t.Fatal("Nickname should not have updated")
	}
	if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
		t.Fatal("Roles should not have updated")
	}
	if ruser.LastPasswordUpdate == 123 {
		t.Fatal("LastPasswordUpdate should not have updated")
	}

	// Regular user can not use endpoint
	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")
	if _, err := Client.AdminUpdateUser(user.Id, *user.AuthData, user.AuthService, user.Password); err == nil {
		t.Fatal("Should have errored")
	}
}
