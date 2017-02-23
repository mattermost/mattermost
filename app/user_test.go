// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/model/gitlab"
	"github.com/mattermost/platform/utils"
)

func TestIsUsernameTaken(t *testing.T) {
	th := Setup().InitBasic()
	user := th.BasicUser
	taken := IsUsernameTaken(user.Username)

	if !taken {
		t.Logf("the username '%v' should be taken", user.Username)
		t.FailNow()
	}

	newUsername := "randomUsername"
	taken = IsUsernameTaken(newUsername)

	if taken {
		t.Logf("the username '%v' should not be taken", newUsername)
		t.FailNow()
	}
}

func TestCheckUserDomain(t *testing.T) {
	th := Setup().InitBasic()
	user := th.BasicUser

	cases := []struct {
		domains string
		matched bool
	}{
		{"simulator.amazonses.com", true},
		{"gmail.com", false},
		{"", true},
		{"gmail.com simulator.amazonses.com", true},
	}
	for _, c := range cases {
		matched := CheckUserDomain(user, c.domains)
		if matched != c.matched {
			if c.matched {
				t.Logf("'%v' should have matched '%v'", user.Email, c.domains)
			} else {
				t.Logf("'%v' should not have matched '%v'", user.Email, c.domains)
			}
			t.FailNow()
		}
	}
}

func TestCreateOAuthUser(t *testing.T) {
	th := Setup().InitBasic()
	glUser := oauthgitlab.GitLabUser{Id: 1000, Username: model.NewId(), Email: model.NewId() + "@simulator.amazonses.com", Name: "Joram Wilander"}

	json := glUser.ToJson()
	user, err := CreateOAuthUser(model.USER_AUTH_SERVICE_GITLAB, strings.NewReader(json), th.BasicTeam.Id)
	if err != nil {
		t.Fatal(err)
	}

	if user.Username != glUser.Username {
		t.Fatal("usernames didn't match")
	}

	PermanentDeleteUser(user)

	userCreation := utils.Cfg.TeamSettings.EnableUserCreation
	defer func() {
		utils.Cfg.TeamSettings.EnableUserCreation = userCreation
	}()
	utils.Cfg.TeamSettings.EnableUserCreation = false

	_, err = CreateOAuthUser(model.USER_AUTH_SERVICE_GITLAB, strings.NewReader(json), th.BasicTeam.Id)
	if err == nil {
		t.Fatal("should have failed - user creation disabled")
	}

}
