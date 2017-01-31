// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestCreateUser(t *testing.T) {
	th := Setup()
	Client := th.Client

	user := model.User{Email: GenerateTestEmail(), Nickname: "Corey Hulen", Password: "hello1", Username: GenerateTestUsername(), Roles: model.ROLE_SYSTEM_ADMIN.Id + " " + model.ROLE_SYSTEM_USER.Id}

	ruser, resp := Client.CreateUser(&user)
	CheckNoError(t, resp)

	Client.Login(user.Email, user.Password)

	if ruser.Nickname != user.Nickname {
		t.Fatal("nickname didn't match")
	}

	if ruser.Roles != model.ROLE_SYSTEM_USER.Id {
		t.Fatal("did not clear roles")
	}

	CheckUserSanitization(t, ruser)

	_, resp = Client.CreateUser(ruser)
	CheckBadRequestStatus(t, resp)

	ruser.Id = ""
	ruser.Username = GenerateTestUsername()
	ruser.Password = "passwd1"
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "An account with that email already exists.")
	CheckBadRequestStatus(t, resp)

	ruser.Email = GenerateTestEmail()
	ruser.Username = user.Username
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "An account with that username already exists.")
	CheckBadRequestStatus(t, resp)

	ruser.Email = ""
	_, resp = Client.CreateUser(ruser)
	CheckErrorMessage(t, resp, "Invalid email")
	CheckBadRequestStatus(t, resp)

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

func TestGetUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	Client := th.Client

	user := th.CreateUser()

	ruser, resp := Client.GetUser(user.Id, "")
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Email != user.Email {
		t.Fatal("emails did not match")
	}

	ruser, resp = Client.GetUser(user.Id, resp.Etag)
	CheckEtag(t, ruser, resp)

	_, resp = Client.GetUser("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetUser(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	// Check against privacy config settings
	emailPrivacy := utils.Cfg.PrivacySettings.ShowEmailAddress
	namePrivacy := utils.Cfg.PrivacySettings.ShowFullName
	defer func() {
		utils.Cfg.PrivacySettings.ShowEmailAddress = emailPrivacy
		utils.Cfg.PrivacySettings.ShowFullName = namePrivacy
	}()
	utils.Cfg.PrivacySettings.ShowEmailAddress = false
	utils.Cfg.PrivacySettings.ShowFullName = false

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
	th.LoginSystemAdmin()
	ruser, resp = Client.GetUser(user.Id, resp.Etag)
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

func TestUpdateUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	Client := th.Client

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)

	user.Nickname = "Joram Wilander"
	user.Roles = model.ROLE_SYSTEM_ADMIN.Id
	user.LastPasswordUpdate = 123

	ruser, resp := Client.UpdateUser(user)
	CheckNoError(t, resp)
	CheckUserSanitization(t, ruser)

	if ruser.Nickname != "Joram Wilander" {
		t.Fatal("Nickname did not update properly")
	}
	if ruser.Roles != model.ROLE_SYSTEM_USER.Id {
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

	Client.Logout()
	_, resp = Client.UpdateUser(user)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp = Client.UpdateUser(user)
	CheckForbiddenStatus(t, resp)

	th.LoginSystemAdmin()
	_, resp = Client.UpdateUser(user)
	CheckNoError(t, resp)
}
