// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestCreateUserWithTeam(t *testing.T) {
	th := api4.Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	CheckCommand(t, "user", "create", "--email", email, "--password", "mypassword1", "--username", username)

	CheckCommand(t, "team", "add", th.BasicTeam.Id, email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetUsersInTeam(th.BasicTeam.Id, 0, 1000, "")).([]*model.User)

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
	th := api4.Setup()
	defer th.TearDown()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	CheckCommand(t, "user", "create", "--email", email, "--password", "mypassword1", "--username", username)

	if result := <-th.App.Srv.Store.User().GetByEmail(email); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		user := result.Data.(*model.User)
		require.Equal(t, email, user.Email)
	}
}

func TestResetPassword(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	CheckCommand(t, "user", "password", th.BasicUser.Email, "password2")

	th.Client.Logout()
	th.BasicUser.Password = "password2"
	th.LoginBasic()
}

func TestMakeUserActiveAndInactive(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	// first inactivate the user
	CheckCommand(t, "user", "deactivate", th.BasicUser.Email)

	// activate the inactive user
	CheckCommand(t, "user", "activate", th.BasicUser.Email)
}

func TestChangeUserEmail(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	newEmail := model.NewId() + "@mattermost-test.com"

	CheckCommand(t, "user", "email", th.BasicUser.Username, newEmail)
	if result := <-th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err == nil {
		t.Fatal("should've updated to the new email")
	}
	if result := <-th.App.Srv.Store.User().GetByEmail(newEmail); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		user := result.Data.(*model.User)
		if user.Email != newEmail {
			t.Fatal("should've updated to the new email")
		}
	}

	// should fail because using an invalid email
	require.Error(t, RunCommand(t, "user", "email", th.BasicUser.Username, "wrong$email.com"))

	// should fail because missing one parameter
	require.Error(t, RunCommand(t, "user", "email", th.BasicUser.Username))

	// should fail because missing both parameters
	require.Error(t, RunCommand(t, "user", "email"))

	// should fail because have more than 2  parameters
	require.Error(t, RunCommand(t, "user", "email", th.BasicUser.Username, "new@email.com", "extra!"))

	// should fail because user not found
	require.Error(t, RunCommand(t, "user", "email", "invalidUser", newEmail))

	// should fail because email already in use
	require.Error(t, RunCommand(t, "user", "email", th.BasicUser.Username, th.BasicUser2.Email))

}
