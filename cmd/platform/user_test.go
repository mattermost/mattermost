// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
)

func TestCreateUserWithTeam(t *testing.T) {
	th := api.Setup().InitSystemAdmin()
	defer th.TearDown()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	checkCommand(t, "user", "create", "--email", email, "--password", "mypassword1", "--username", username)

	checkCommand(t, "team", "add", th.SystemAdminTeam.Id, email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetProfilesInTeam(th.SystemAdminTeam.Id, 0, 1000, "")).Data.(map[string]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == email {
			found = true
		}

	}

	if !found {
		t.Fatal("Failed to create User")
	}
}

func TestCreateUserWithoutTeam(t *testing.T) {
	th := api.Setup()
	defer th.TearDown()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	checkCommand(t, "user", "create", "--email", email, "--password", "mypassword1", "--username", username)

	if result := <-th.App.Srv.Store.User().GetByEmail(email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Email != email {
			t.Fatal()
		}
	}
}

func TestResetPassword(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	checkCommand(t, "user", "password", th.BasicUser.Email, "password2")

	th.BasicClient.Logout()
	th.BasicUser.Password = "password2"
	th.LoginBasic()
}

func TestMakeUserActiveAndInactive(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	// first inactivate the user
	checkCommand(t, "user", "deactivate", th.BasicUser.Email)

	// activate the inactive user
	checkCommand(t, "user", "activate", th.BasicUser.Email)
}
