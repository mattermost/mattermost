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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/model/gitlab"
)

func TestIsUsernameTaken(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	taken := th.App.IsUsernameTaken(user.Username)

	if !taken {
		t.Logf("the username '%v' should be taken", user.Username)
		t.FailNow()
	}

	newUsername := "randomUsername"
	taken = th.App.IsUsernameTaken(newUsername)

	if taken {
		t.Logf("the username '%v' should not be taken", newUsername)
		t.FailNow()
	}
}

func TestCheckUserDomain(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

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
	defer th.TearDown()

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	glUser := oauthgitlab.GitLabUser{Id: int64(r.Intn(1000)) + 1, Username: "o" + model.NewId(), Email: model.NewId() + "@simulator.amazonses.com", Name: "Joram Wilander"}

	json := glUser.ToJson()
	user, err := th.App.CreateOAuthUser(model.USER_AUTH_SERVICE_GITLAB, strings.NewReader(json), th.BasicTeam.Id)
	if err != nil {
		t.Fatal(err)
	}

	if user.Username != glUser.Username {
		t.Fatal("usernames didn't match")
	}

	th.App.PermanentDeleteUser(user)

	*th.App.Config().TeamSettings.EnableUserCreation = false

	_, err = th.App.CreateOAuthUser(model.USER_AUTH_SERVICE_GITLAB, strings.NewReader(json), th.BasicTeam.Id)
	if err == nil {
		t.Fatal("should have failed - user creation disabled")
	}
}

func TestCreateProfileImage(t *testing.T) {
	b, err := CreateProfileImage("Corey Hulen", "eo1zkdr96pdj98pjmq8zy35wba", "nunito-bold.ttf")
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

func TestSetDefaultProfileImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	err := th.App.SetDefaultProfileImage(&model.User{
		Id:       model.NewId(),
		Username: "notvaliduser",
	})
	require.Error(t, err)

	user := th.BasicUser

	err = th.App.SetDefaultProfileImage(user)
	require.Nil(t, err)

	user = getUserFromDB(th.App, user.Id, t)
	assert.Equal(t, int64(0), user.LastPictureUpdate)
}

func TestUpdateUserToRestrictedDomain(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(user)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.TeamSettings.RestrictCreationToDomains = "foo.com"
	})

	_, err := th.App.UpdateUser(user, false)
	assert.True(t, err == nil)

	user.Email = "asdf@ghjk.l"
	_, err = th.App.UpdateUser(user, false)
	assert.False(t, err == nil)
}

func TestUpdateOAuthUserAttrs(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	id := model.NewId()
	id2 := model.NewId()
	gitlabProvider := einterfaces.GetOauthProvider("gitlab")

	username := "user" + id
	username2 := "user" + id2

	email := "user" + id + "@nowhere.com"
	email2 := "user" + id2 + "@nowhere.com"

	var user, user2 *model.User
	var gitlabUserObj oauthgitlab.GitLabUser
	user, gitlabUserObj = createGitlabUser(t, th.App, username, email)
	user2, _ = createGitlabUser(t, th.App, username2, email2)

	t.Run("UpdateUsername", func(t *testing.T) {
		t.Run("NoExistingUserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = "updateduser" + model.NewId()
			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(th.App, user.Id, t)

			if user.Username != gitlabUserObj.Username {
				t.Fatal("user's username is not updated")
			}
		})

		t.Run("ExistinguserWithSameUsername", func(t *testing.T) {
			gitlabUserObj.Username = user2.Username

			gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
			data := bytes.NewReader(gitlabUser)

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(th.App, user.Id, t)

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

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(th.App, user.Id, t)

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

			user = getUserFromDB(th.App, user.Id, t)
			th.App.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
			user = getUserFromDB(th.App, user.Id, t)

			if user.Email == gitlabUserObj.Email {
				t.Fatal("user's email is updated though there already exists another user with the same email")
			}
		})
	})

	t.Run("UpdateFirstName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated User"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(th.App, user.Id, t)
		th.App.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
		user = getUserFromDB(th.App, user.Id, t)

		if user.FirstName != "Updated" {
			t.Fatal("user's first name is not updated")
		}
	})

	t.Run("UpdateLastName", func(t *testing.T) {
		gitlabUserObj.Name = "Updated Lastname"
		gitlabUser := getGitlabUserPayload(gitlabUserObj, t)
		data := bytes.NewReader(gitlabUser)

		user = getUserFromDB(th.App, user.Id, t)
		th.App.UpdateOAuthUserAttrs(data, user, gitlabProvider, "gitlab")
		user = getUserFromDB(th.App, user.Id, t)

		if user.LastName != "Lastname" {
			t.Fatal("user's last name is not updated")
		}
	})
}

func getUserFromDB(a *App, id string, t *testing.T) *model.User {
	user, err := a.GetUser(id)
	if err != nil {
		t.Fatal("user is not found", err)
		return nil
	}
	return user
}

func getGitlabUserPayload(gitlabUser oauthgitlab.GitLabUser, t *testing.T) []byte {
	var payload []byte
	var err error
	if payload, err = json.Marshal(gitlabUser); err != nil {
		t.Fatal("Serialization of gitlab user to json failed", err)
	}

	return payload
}

func createGitlabUser(t *testing.T, a *App, username string, email string) (*model.User, oauthgitlab.GitLabUser) {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	gitlabUserObj := oauthgitlab.GitLabUser{Id: int64(r.Intn(1000)) + 1, Username: username, Login: "user1", Email: email, Name: "Test User"}
	gitlabUser := getGitlabUserPayload(gitlabUserObj, t)

	var user *model.User
	var err *model.AppError

	if user, err = a.CreateOAuthUser("gitlab", bytes.NewReader(gitlabUser), ""); err != nil {
		t.Fatal("unable to create the user", err)
	}

	return user, gitlabUserObj
}

func TestGetUsersByStatus(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	team := th.CreateTeam()
	channel, err := th.App.CreateChannel(&model.Channel{
		DisplayName: "dn_" + model.NewId(),
		Name:        "name_" + model.NewId(),
		Type:        model.CHANNEL_OPEN,
		TeamId:      team.Id,
		CreatorId:   model.NewId(),
	}, false)
	if err != nil {
		t.Fatalf("failed to create channel: %v", err)
	}

	createUserWithStatus := func(username string, status string) *model.User {
		id := model.NewId()

		user, err := th.App.CreateUser(&model.User{
			Email:    "success+" + id + "@simulator.amazonses.com",
			Username: "un_" + username + "_" + id,
			Nickname: "nn_" + id,
			Password: "Password1",
		})
		if err != nil {
			t.Fatalf("failed to create user: %v", err)
		}

		th.LinkUserToTeam(user, team)
		th.AddUserToChannel(user, channel)

		th.App.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: status,
			Manual: true,
		})

		return user
	}

	// Creating these out of order in case that affects results
	awayUser1 := createUserWithStatus("away1", model.STATUS_AWAY)
	awayUser2 := createUserWithStatus("away2", model.STATUS_AWAY)
	dndUser1 := createUserWithStatus("dnd1", model.STATUS_DND)
	dndUser2 := createUserWithStatus("dnd2", model.STATUS_DND)
	offlineUser1 := createUserWithStatus("offline1", model.STATUS_OFFLINE)
	offlineUser2 := createUserWithStatus("offline2", model.STATUS_OFFLINE)
	onlineUser1 := createUserWithStatus("online1", model.STATUS_ONLINE)
	onlineUser2 := createUserWithStatus("online2", model.STATUS_ONLINE)

	t.Run("sorting by status then alphabetical", func(t *testing.T) {
		usersByStatus, err := th.App.GetUsersInChannelPageByStatus(channel.Id, 0, 8, true)
		if err != nil {
			t.Fatal(err)
		}

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

		if len(usersByStatus) != len(expectedUsersByStatus) {
			t.Fatalf("received only %v users, expected %v", len(usersByStatus), len(expectedUsersByStatus))
		}

		for i := range usersByStatus {
			if usersByStatus[i].Id != expectedUsersByStatus[i].Id {
				t.Fatalf("received user %v at index %v, expected %v", usersByStatus[i].Username, i, expectedUsersByStatus[i].Username)
			}
		}
	})

	t.Run("paging", func(t *testing.T) {
		usersByStatus, err := th.App.GetUsersInChannelPageByStatus(channel.Id, 0, 3, true)
		if err != nil {
			t.Fatal(err)
		}

		if len(usersByStatus) != 3 {
			t.Fatal("received too many users")
		}

		if usersByStatus[0].Id != onlineUser1.Id && usersByStatus[1].Id != onlineUser2.Id {
			t.Fatal("expected to receive online users first")
		}

		if usersByStatus[2].Id != awayUser1.Id {
			t.Fatal("expected to receive away users second")
		}

		usersByStatus, err = th.App.GetUsersInChannelPageByStatus(channel.Id, 1, 3, true)
		if err != nil {
			t.Fatal(err)
		}

		if usersByStatus[0].Id != awayUser2.Id {
			t.Fatal("expected to receive away users second")
		}

		if usersByStatus[1].Id != dndUser1.Id && usersByStatus[2].Id != dndUser2.Id {
			t.Fatal("expected to receive dnd users third")
		}

		usersByStatus, err = th.App.GetUsersInChannelPageByStatus(channel.Id, 1, 4, true)
		if err != nil {
			t.Fatal(err)
		}

		if len(usersByStatus) != 4 {
			t.Fatal("received too many users")
		}

		if usersByStatus[0].Id != dndUser1.Id && usersByStatus[1].Id != dndUser2.Id {
			t.Fatal("expected to receive dnd users third")
		}

		if usersByStatus[2].Id != offlineUser1.Id && usersByStatus[3].Id != offlineUser2.Id {
			t.Fatal("expected to receive offline users last")
		}
	})
}

func TestCreateUserWithToken(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}

	t.Run("invalid token", func(t *testing.T) {
		if _, err := th.App.CreateUserWithToken(&user, "123"); err == nil {
			t.Fatal("Should fail on unexisting token")
		}
	})

	t.Run("invalid token type", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_VERIFY_EMAIL,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.CreateUserWithToken(&user, token.Token); err == nil {
			t.Fatal("Should fail on bad token type")
		}
	})

	t.Run("expired token", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": user.Email}),
		)
		token.CreateAt = model.GetMillis() - TEAM_INVITATION_EXPIRY_TIME - 1
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.CreateUserWithToken(&user, token.Token); err == nil {
			t.Fatal("Should fail on expired token")
		}
	})

	t.Run("invalid team id", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": model.NewId(), "email": user.Email}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.CreateUserWithToken(&user, token.Token); err == nil {
			t.Fatal("Should fail on bad team id")
		}
	})

	t.Run("valid request", func(t *testing.T) {
		invitationEmail := model.NewId() + "other-email@test.com"
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "email": invitationEmail}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		newUser, err := th.App.CreateUserWithToken(&user, token.Token)
		if err != nil {
			t.Log(err)
			t.Fatal("Should add user to the team")
		}
		if newUser.Email != invitationEmail {
			t.Fatal("The user email must be the invitation one")
		}
		if result := <-th.App.Srv.Store.Token().GetByToken(token.Token); result.Err == nil {
			t.Fatal("The token must be deleted after be used")
		}
	})
}

func TestPermanentDeleteUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	b := []byte("testimage")

	finfo, err := th.App.DoUploadFile(time.Now(), th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "testfile.txt", b)

	if err != nil {
		t.Log(err)
		t.Fatal("Unable to upload file")
	}

	err = th.App.PermanentDeleteUser(th.BasicUser)
	if err != nil {
		t.Log(err)
		t.Fatal("Unable to delete user")
	}

	res, err := th.App.FileExists(finfo.Path)

	if err != nil {
		t.Log(err)
		t.Fatal("Unable to check whether file exists")
	}

	if res {
		t.Log(err)
		t.Fatal("File was not deleted on FS")
	}

	finfo, err = th.App.GetFileInfo(finfo.Id)

	if finfo != nil {
		t.Log(err)
		t.Fatal("Unable to find finfo")
	}

	if err == nil {
		t.Log(err)
		t.Fatal("GetFileInfo after DeleteUser is nil")
	}
}

func TestRecordUserServiceTermsAction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := &model.User{
		Email:       strings.ToLower(model.NewId()) + "success+test@example.com",
		Nickname:    "Luke Skywalker", // trying to bring balance to the "Force", one test user at a time
		Username:    "luke" + model.NewId(),
		Password:    "passwd1",
		AuthService: "",
	}
	user, err := th.App.CreateUser(user)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	defer th.App.PermanentDeleteUser(user)

	serviceTerms, err := th.App.CreateServiceTerms("text", user.Id)
	if err != nil {
		t.Fatalf("failed to create service terms: %v", err)
	}

	err = th.App.RecordUserServiceTermsAction(user.Id, serviceTerms.Id, true)
	if err != nil {
		t.Fatalf("failed to record user action: %v", err)
	}

	nuser, err := th.App.GetUser(user.Id)
	assert.Equal(t, serviceTerms.Id, nuser.AcceptedServiceTermsId)

	err = th.App.RecordUserServiceTermsAction(user.Id, serviceTerms.Id, false)
	if err != nil {
		t.Fatalf("failed to record user action: %v", err)
	}

	nuser, err = th.App.GetUser(user.Id)
	assert.Empty(t, nuser.AcceptedServiceTermsId)
}
