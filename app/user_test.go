// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/einterfaces"
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
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	glUser := oauthgitlab.GitLabUser{Id: int64(r.Intn(1000)) + 1, Username: "o" + model.NewId(), Email: model.NewId() + "@simulator.amazonses.com", Name: "Joram Wilander"}

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

func TestCreateProfileImage(t *testing.T) {
	utils.LoadConfig("config.json")

	b, err := CreateProfileImage("Corey Hulen", "eo1zkdr96pdj98pjmq8zy35wba")
	if err != nil {
		t.Fatal(err)
	}

	rdr := bytes.NewReader(b)
	img, _, err2 := image.Decode(rdr)
	if err2 != nil {
		t.Fatal(err)
	}

	colorful := color.RGBA{116, 49, 196, 255}

	if img.At(1, 1) != colorful {
		t.Fatal("Failed to create correct color")
	}
}

func TestUpdateOAuthUserAttrs(t *testing.T) {
	Setup()
	id := model.NewId()
	id2 := model.NewId()
	gitlabProvider := einterfaces.GetOauthProvider("gitlab")

	username := "user" + id
	username2 := "user" + id2

	email := "user" + id + "@nowhere.com"
	email2 := "user" + id2 + "@nowhere.com"

	var user, user2 *model.User
	var gitlabUserObj oauthgitlab.GitLabUser
	user, gitlabUserObj = createGitlabUser(t, username, email)
	user2, _ = createGitlabUser(t, username2, email2)

	t.Run("UpdateUsername", func(t *testing.T) {
		t.Run("NoExistingUserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = "updateduser" + model.NewId()
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(user.Id, t)
			UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(user.Id, t)

			if user.Username != gitlabUserObj.Username {
				t.Fatal("user's username is not updated")
			}
		})

		t.Run("ExistinguserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = user2.Username

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(user.Id, t)
			UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(user.Id, t)

			if user.Username == gitlabUserObj.Username {
				t.Fatal("user's username is updated though there already exists another user with the same username")
			}
		})
	})

	t.Run("UpdateEmail", func(t *testing.T) {
		t.Run("NoExistingUserWithSameEmail", func(t *testing.T) {
			gitlabUserObj.Email = "newuser" + model.NewId() + "@nowhere.com"
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(user.Id, t)
			UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(user.Id, t)

			if user.Email != gitlabUserObj.Email {
				t.Fatal("user's email is not updated")
			}

			if !user.EmailVerified {
				t.Fatal("user's email should have been verified")
			}
		})

		t.Run("ExistingUserWithSameEmail", func(t *testing.T) {
			gitlabUserObj.Email = user2.Email

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(user.Id, t)
			UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(user.Id, t)

			if user.Email == gitlabUserObj.Email {
				t.Fatal("user's email is updated though there already exists another user with the same email")
			}
		})
	})

	t.Run("UpdateFirstName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated User"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(user.Id, t)
		UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
		user = getUserFromDB(user.Id, t)

		if user.FirstName != "Updated" {
			t.Fatal("user's first name is not updated")
		}
	})

	t.Run("UpdateLastName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated Lastname"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(user.Id, t)
		UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
		user = getUserFromDB(user.Id, t)

		if user.LastName != "Lastname" {
			t.Fatal("user's last name is not updated")
		}
	})
}

func getUserFromDB(id string, t *testing.T) *model.User {
	if user, err := GetUser(id); err != nil {
		t.Fatal("user is not found")
		return nil
	} else {
		return user
	}
}

func getGitlabUserPayload(gitlabUser oauthgitlab.GitLabUser, t *testing.T) []byte {
	var payload []byte
	var err error
	if payload, err = json.Marshal(gitlabUser); err != nil {
		t.Fatal("Serialization of gitlab user to json failed")
	}

	return payload
}

func createGitlabUser(t *testing.T, email string, username string) (*model.User, oauthgitlab.GitLabUser) {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	gitlabUserObj := oauthgitlab.GitLabUser{Id: int64(r.Intn(1000)) + 1, Username: username, Login: "user1", Email: email, Name: "Test User"}
	gitlabUser := getGitlabUserPayload(gitlabUserObj, t)

	var user *model.User
	var err *model.AppError

	if user, err = CreateOAuthUser("gitlab", bytes.NewReader(gitlabUser), ""); err != nil {
		t.Fatal("unable to create the user")
	}

	return user, gitlabUserObj
}
