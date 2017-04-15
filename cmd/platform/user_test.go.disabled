// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func TestChangeUserActiveStatus(t *testing.T) {
	th := app.Setup().InitBasic()

	user := th.BasicUser

	if err := changeUserActiveStatus(nil, "user", false); err == nil {
		t.Fatal("should've returned error when user doesn't exist")
	}

	if err := changeUserActiveStatus(user, user.Username, false); err != nil {
		t.Fatal(err)
	} else if user, _ = app.GetUser(user.Id); user.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	}

	if err := changeUserActiveStatus(user, user.Username, true); err != nil {
		t.Fatal(err)
	} else if user, _ := app.GetUser(user.Id); user.DeleteAt != 0 {
		t.Fatal("should've activated user")
	}
}

func TestChangeUsersActiveStatus(t *testing.T) {
	th := app.Setup().InitBasic()

	user := th.BasicUser
	user2 := th.CreateUser()

	changeUsersActiveStatus([]string{user.Username, user2.Id}, false)

	if user, _ = app.GetUser(user.Id); user.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	} else if user2, _ = app.GetUser(user2.Id); user2.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	}

	changeUsersActiveStatus([]string{user.Username, user2.Id}, true)

	if user, _ = app.GetUser(user.Id); user.DeleteAt != 0 {
		t.Fatal("should've activated user")
	} else if user2, _ = app.GetUser(user2.Id); user2.DeleteAt != 0 {
		t.Fatal("should've activated user")
	}
}

func TestUserActivateDeactivateCmdF(t *testing.T) {
	th := app.Setup().InitBasic()

	user := th.BasicUser
	user2 := th.CreateUser()

	userDeactivateCmdF(userDeactivateCmd, []string{user.Username, user2.Id})

	if user, _ = app.GetUser(user.Id); user.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	} else if user2, _ = app.GetUser(user2.Id); user2.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	}

	userActivateCmdF(userActivateCmd, []string{user.Username, user2.Id})

	if user, _ = app.GetUser(user.Id); user.DeleteAt != 0 {
		t.Fatal("should've activated user")
	} else if user2, _ = app.GetUser(user2.Id); user2.DeleteAt != 0 {
		t.Fatal("should've activated user")
	}
}

func TestUserActivateDeactivateCmd(t *testing.T) {
	th := app.Setup().InitBasic()

	user := th.BasicUser
	user2 := th.CreateUser()

	if err := runCommand("user deactivate " + user.Username + " " + user2.Id); err != nil {
		t.Fatal(err)
	} else if user, _ = app.GetUser(user.Id); user.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	} else if user2, _ = app.GetUser(user2.Id); user2.DeleteAt == 0 {
		t.Fatal("should've deactivated user")
	}

	if err := runCommand("user activate " + user.Id + " " + user2.Username); err != nil {
		t.Fatal(err)
	} else if user, _ = app.GetUser(user.Id); user.DeleteAt != 0 {
		t.Fatal("should've activated user")
	} else if user2, _ = app.GetUser(user2.Id); user2.DeleteAt != 0 {
		t.Fatal("should've activated user")
	}
}

func TestUserCreateCmd(t *testing.T) {
	th := app.Setup().InitBasic()

	if err := runCommand("user create"); err == nil {
		t.Fatal("should've failed without any arguments")
	}

	username := th.MakeUsername()
	email := th.MakeEmail()
	if err := runCommand("user create --username " + username + " --email " + email + " --password " + model.NewId()); err != nil {
		t.Fatal(err)
	} else if user, err := app.GetUserByUsername(username); err != nil {
		t.Fatal(err.Message)
	} else if user.Username != username {
		t.Fatal("should've set correct username")
	} else if user.Email != email {
		t.Fatal("should've set correct email")
	}

	username = th.MakeUsername()
	nickname := model.NewId()
	firstName := model.NewId()
	lastName := model.NewId()
	locale := "fr"
	if err := runCommand("user create --username " + username + " --email " + th.MakeEmail() + " --password " + model.NewId() +
		" --nickname " + nickname + " --firstname " + firstName + " --lastname " + lastName + " --locale " + locale); err != nil {
		t.Fatal(err)
	} else if user, err := app.GetUserByUsername(username); err != nil {
		t.Fatal(err)
	} else if user.Nickname != nickname {
		t.Fatal("should've set correct nickname")
	} else if user.FirstName != firstName {
		t.Fatal("should've set correct first name")
	} else if user.LastName != lastName {
		t.Fatal("should've set correct last name")
	} else if user.Locale != locale {
		t.Fatal("should've set correct locale", user.Locale)
	} else if user.Roles != "system_user" {
		t.Fatal("should've set correct roles for user")
	}

	username = th.MakeUsername()
	if err := runCommand("user create --username " + username + " --email " + th.MakeEmail() + " --password " + model.NewId() + " --system_admin"); err != nil {
		t.Fatal(err)
	} else if user, err := app.GetUserByUsername(username); err != nil {
		t.Fatal(err)
	} else if user.Roles != "system_user system_admin" {
		t.Fatal("should've set correct roles for system admin")
	}

	if err := runCommand("user create --email " + th.MakeEmail() + " --password " + model.NewId()); err == nil {
		t.Fatal("should've failed without username")
	}

	if err := runCommand("user create --username " + th.MakeUsername() + " --email " + th.MakeEmail()); err == nil {
		t.Fatal("should've failed without password")
	}

	if err := runCommand("user create --username " + th.MakeUsername() + " --password " + model.NewId()); err == nil {
		t.Fatal("should've failed without email")
	}
}

func TestInviteUser(t *testing.T) {
	th := app.Setup().InitBasic()

	team := th.CreateTeam()

	if err := inviteUser(th.MakeEmail(), nil, "faketeam"); err == nil {
		t.Fatal("should've failed with nonexistent team")
	}

	if err := inviteUser(th.MakeEmail(), team, team.Name); err != nil {
		t.Fatal(err)
	}

	// Nothing else to test here since this just fires off an email
}

func TestUserInviteCmd(t *testing.T) {
	th := app.Setup().InitBasic()

	team := th.BasicTeam
	team2 := th.CreateTeam()

	if err := runCommand("user invite"); err == nil {
		t.Fatal("should've failed without any arguments")
	}

	if err := runCommand("user invite " + th.MakeEmail()); err == nil {
		t.Fatal("should've failed with 1 argument")
	}

	if err := runCommand("user invite " + th.MakeEmail() + " " + team.Id); err != nil {
		t.Fatal(err)
	}

	if err := runCommand("user invite " + th.MakeEmail() + " " + team.Name); err != nil {
		t.Fatal(err)
	}

	if err := runCommand("user invite " + th.MakeEmail() + " " + team.Id + " " + team2.Name); err != nil {
		t.Fatal(err)
	}

	if err := runCommand("user invite " + th.MakeEmail() + " " + team.Id + " " + team2.Name + " " + "faketeam"); err != nil {
		t.Fatal(err)
	}
}
