// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func TestGetUserFromUserArg(t *testing.T) {
	th := app.Setup().InitBasic()

	user := th.BasicUser

	if found := getUserFromUserArg(""); found != nil {
		t.Fatal("shoudn't have gotten a user", found)
	}

	if found := getUserFromUserArg(model.NewId()); found != nil {
		t.Fatal("shoudn't have gotten a user", found)
	}

	if found := getUserFromUserArg(user.Id); found == nil || found.Id != user.Id {
		t.Fatal("got incorrect user", found)
	}

	if found := getUserFromUserArg(user.Username); found == nil || found.Id != user.Id {
		t.Fatal("got incorrect user", found)
	}
}

func TestGetUsersFromUserArg(t *testing.T) {
	th := app.Setup().InitBasic()

	user := th.BasicUser
	user2 := th.CreateUser()

	if found := getUsersFromUserArgs([]string{}); len(found) != 0 {
		t.Fatal("shoudn't have gotten any users", found)
	}

	if found := getUsersFromUserArgs([]string{user.Id}); len(found) == 1 && found[0].Id != user.Id {
		t.Fatal("got incorrect user", found)
	}

	if found := getUsersFromUserArgs([]string{user2.Username}); len(found) == 1 && found[0].Id != user2.Id {
		t.Fatal("got incorrect user", found)
	}

	if found := getUsersFromUserArgs([]string{user.Username, user2.Id}); len(found) != 2 {
		t.Fatal("got incorrect number of users", found)
	} else if !(found[0].Id == user.Id && found[1].Id == user2.Id) && !(found[1].Id == user.Id && found[0].Id == user2.Id) {
		t.Fatal("got incorrect users", found[0], found[1])
	}
}
