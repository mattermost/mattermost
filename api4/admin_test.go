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

	if _, err := th.Client.AdminUpdateUser(user); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	user.Password = "1"

	if _, err := Client.AdminUpdateUser(user); err == nil {
		t.Fatal("Should have errored - user password not valid")
	}

	user.Nickname = "Jim Jimmy"
	user.Roles = model.SYSTEM_ADMIN_ROLE_ID
	user.Password = "Password1"
	user.LastPasswordUpdate = 123

	ruser, resp := Client.AdminUpdateUser(user)
	CheckNoError(t, resp)

	if ruser.Nickname != "Jim Jimmy" {
		t.Fatal("Nickname did not update properly")
	}
	if ruser.Roles != model.SYSTEM_USER_ROLE_ID {
		t.Fatal("Roles should not have updated")
	}
	if ruser.LastPasswordUpdate == 123 {
		t.Fatal("LastPasswordUpdate should not have updated")
	}

	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")

	user.Nickname = "Tim Timmy"

	if _, err := Client.AdminUpdateUser(user); err == nil {
		t.Fatal("Should have errored")
	}
}
