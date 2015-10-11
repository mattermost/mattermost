// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"image"
	"image/color"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCreateUser(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "hello"}

	ruser, err := Client.CreateUser(&user, "")
	if err != nil {
		t.Fatal(err)
	}

	if ruser.Data.(*model.User).Nickname != user.Nickname {
		t.Fatal("nickname didn't match")
	}

	if ruser.Data.(*model.User).Password != "" {
		t.Fatal("password wasn't blank")
	}

	if _, err := Client.CreateUser(ruser.Data.(*model.User), ""); err == nil {
		t.Fatal("Cannot create an existing")
	}

	ruser.Data.(*model.User).Id = ""
	if _, err := Client.CreateUser(ruser.Data.(*model.User), ""); err != nil {
		if err.Message != "An account with that email already exists." {
			t.Fatal(err)
		}
	}

	ruser.Data.(*model.User).Email = "test2@nowhere.com"
	if _, err := Client.CreateUser(ruser.Data.(*model.User), ""); err != nil {
		if err.Message != "An account with that username already exists." {
			t.Fatal(err)
		}
	}

	ruser.Data.(*model.User).Email = ""
	if _, err := Client.CreateUser(ruser.Data.(*model.User), ""); err != nil {
		if err.Message != "Invalid email" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost("/users/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestCreateUserAllowedDomains(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_INVITE, AllowedDomains: "spinpunch.com, @nowh.com,@hello.com"}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "hello"}

	_, err := Client.CreateUser(&user, "")
	if err == nil {
		t.Fatal("should have failed")
	}

	user.Email = "test@nowh.com"
	_, err = Client.CreateUser(&user, "")
	if err != nil {
		t.Fatal(err)
	}
}

func TestLogin(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser, _ := Client.CreateUser(&user, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	if result, err := Client.LoginById(ruser.Data.(*model.User).Id, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("email's didn't match")
		}
	}

	if result, err := Client.LoginByEmail(team.Name, user.Email, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("emails didn't match")
		}
	}

	if _, err := Client.LoginByEmail(team.Name, user.Email, user.Password+"invalid"); err == nil {
		t.Fatal("Invalid Password")
	}

	if _, err := Client.LoginByEmail(team.Name, "", user.Password); err == nil {
		t.Fatal("should have failed")
	}

	authToken := Client.AuthToken
	Client.AuthToken = "invalid"

	if _, err := Client.GetUser(ruser.Data.(*model.User).Id, ""); err == nil {
		t.Fatal("should have failed")
	}

	Client.AuthToken = ""

	team2 := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_INVITE}
	rteam2 := Client.Must(Client.CreateTeam(&team2))

	user2 := model.User{TeamId: rteam2.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}

	if _, err := Client.CreateUserFromSignup(&user2, "junk", "1231312"); err == nil {
		t.Fatal("Should have errored, signed up without hashed email")
	}

	props := make(map[string]string)
	props["email"] = user2.Email
	props["id"] = rteam2.Data.(*model.Team).Id
	props["display_name"] = rteam2.Data.(*model.Team).DisplayName
	props["time"] = fmt.Sprintf("%v", model.GetMillis())
	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	ruser2, _ := Client.CreateUserFromSignup(&user2, data, hash)

	if _, err := Client.LoginByEmail(team2.Name, ruser2.Data.(*model.User).Email, user2.Password); err != nil {
		t.Fatal("From verfied hash")
	}

	Client.AuthToken = authToken
}

func TestSessions(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	deviceId := model.NewId()
	Client.LoginByEmailWithDevice(team.Name, user.Email, user.Password, deviceId)
	Client.LoginByEmail(team.Name, user.Email, user.Password)

	r1, err := Client.GetSessions(ruser.Id)
	if err != nil {
		t.Fatal(err)
	}

	sessions := r1.Data.([]*model.Session)
	otherSession := ""

	if len(sessions) != 2 {
		t.Fatal("invalid number of sessions")
	}

	for _, session := range sessions {
		if session.DeviceId == deviceId {
			otherSession = session.Id
		}

		if len(session.Token) != 0 {
			t.Fatal("shouldn't return session tokens")
		}
	}

	if _, err := Client.RevokeSession(otherSession); err != nil {
		t.Fatal(err)
	}

	r2, err := Client.GetSessions(ruser.Id)
	if err != nil {
		t.Fatal(err)
	}

	sessions2 := r2.Data.([]*model.Session)

	if len(sessions2) != 1 {
		t.Fatal("invalid number of sessions")
	}
}

func TestGetUser(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser, _ := Client.CreateUser(&user, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	user2 := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser2, _ := Client.CreateUser(&user2, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser2.Data.(*model.User).Id))

	team2 := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam2, _ := Client.CreateTeam(&team2)

	user3 := model.User{TeamId: rteam2.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser3, _ := Client.CreateUser(&user3, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser3.Data.(*model.User).Id))

	Client.LoginByEmail(team.Name, user.Email, user.Password)

	rId := ruser.Data.(*model.User).Id
	if result, err := Client.GetUser(rId, ""); err != nil {
		t.Fatal("Failed to get user")
	} else {
		if result.Data.(*model.User).Password != "" {
			t.Fatal("User shouldn't have any password data once set")
		}

		if cache_result, err := Client.GetUser(rId, result.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(*model.User) != nil {
			t.Fatal("cache should be empty")
		}
	}

	if result, err := Client.GetMe(""); err != nil {
		t.Fatal("Failed to get user")
	} else {
		if result.Data.(*model.User).Password != "" {
			t.Fatal("User shouldn't have any password data once set")
		}
	}

	if _, err := Client.GetUser("FORBIDDENERROR", ""); err == nil {
		t.Fatal("shouldn't exist")
	}

	if _, err := Client.GetUser(ruser2.Data.(*model.User).Id, ""); err == nil {
		t.Fatal("shouldn't have accss")
	}

	if userMap, err := Client.GetProfiles(rteam.Data.(*model.Team).Id, ""); err != nil {
		t.Fatal(err)
	} else if len(userMap.Data.(map[string]*model.User)) != 2 {
		t.Fatal("should have been 2")
	} else if userMap.Data.(map[string]*model.User)[rId].Id != rId {
		t.Fatal("should have been valid")
	} else {

		// test etag caching
		if cache_result, err := Client.GetProfiles(rteam.Data.(*model.Team).Id, userMap.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(map[string]*model.User) != nil {
			t.Log(cache_result.Data)
			t.Fatal("cache should be empty")
		}
	}

	if _, err := Client.GetProfiles(rteam2.Data.(*model.Team).Id, ""); err == nil {
		t.Fatal("shouldn't have access")
	}

	Client.AuthToken = ""
	if _, err := Client.GetUser(ruser2.Data.(*model.User).Id, ""); err == nil {
		t.Fatal("shouldn't have accss")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, ruser.Data.(*model.User), model.ROLE_SYSTEM_ADMIN)

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.GetProfiles(rteam2.Data.(*model.Team).Id, ""); err != nil {
		t.Fatal(err)
	}
}

func TestGetAudits(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser, _ := Client.CreateUser(&user, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	time.Sleep(100 * time.Millisecond)

	Client.LoginByEmail(team.Name, user.Email, user.Password)

	time.Sleep(100 * time.Millisecond)

	if result, err := Client.GetAudits(ruser.Data.(*model.User).Id, ""); err != nil {
		t.Fatal(err)
	} else {

		if len(result.Data.(model.Audits)) != 2 {
			t.Fatal(result.Data.(model.Audits))
		}

		if cache_result, err := Client.GetAudits(ruser.Data.(*model.User).Id, result.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(model.Audits) != nil {
			t.Fatal("cache should be empty")
		}
	}

	if _, err := Client.GetAudits("FORBIDDENERROR", ""); err == nil {
		t.Fatal("audit log shouldn't exist")
	}
}

func TestUserCreateImage(t *testing.T) {
	Setup()

	b, err := createProfileImage("Corey Hulen", "eo1zkdr96pdj98pjmq8zy35wba")
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

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	Client.DoApiGet("/users/"+user.Id+"/image", "", "")

	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.FileSettings.AmazonS3Region])
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		if err := bucket.Del("teams/" + user.TeamId + "/users/" + user.Id + "/profile.png"); err != nil {
			t.Fatal(err)
		}
	} else {
		path := utils.Cfg.FileSettings.Directory + "teams/" + user.TeamId + "/users/" + user.Id + "/profile.png"
		if err := os.Remove(path); err != nil {
			t.Fatal("Couldn't remove file at " + path)
		}
	}

}

func TestUserUploadProfileImage(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if utils.Cfg.FileSettings.DriverName != "" {

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		if _, upErr := Client.UploadFile("/users/newimage", body.Bytes(), writer.FormDataContentType()); upErr == nil {
			t.Fatal("Should have errored")
		}

		Client.LoginByEmail(team.Name, user.Email, "pwd")

		if _, upErr := Client.UploadFile("/users/newimage", body.Bytes(), writer.FormDataContentType()); upErr == nil {
			t.Fatal("Should have errored")
		}

		part, err := writer.CreateFormFile("blargh", "test.png")
		if err != nil {
			t.Fatal(err)
		}

		path := utils.FindDir("web/static/images")
		file, err := os.Open(path + "/test.png")
		if err != nil {
			t.Fatal(err)
		}
		defer file.Close()

		_, err = io.Copy(part, file)
		if err != nil {
			t.Fatal(err)
		}

		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}

		if _, upErr := Client.UploadFile("/users/newimage", body.Bytes(), writer.FormDataContentType()); upErr == nil {
			t.Fatal("Should have errored")
		}

		file2, err := os.Open(path + "/test.png")
		if err != nil {
			t.Fatal(err)
		}
		defer file2.Close()

		body = &bytes.Buffer{}
		writer = multipart.NewWriter(body)

		part, err = writer.CreateFormFile("image", "test.png")
		if err != nil {
			t.Fatal(err)
		}

		if _, err := io.Copy(part, file2); err != nil {
			t.Fatal(err)
		}

		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}

		if _, upErr := Client.UploadFile("/users/newimage", body.Bytes(), writer.FormDataContentType()); upErr != nil {
			t.Fatal(upErr)
		}

		Client.DoApiGet("/users/"+user.Id+"/image", "", "")

		if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
			var auth aws.Auth
			auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
			auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

			s := s3.New(auth, aws.Regions[utils.Cfg.FileSettings.AmazonS3Region])
			bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

			if err := bucket.Del("teams/" + user.TeamId + "/users/" + user.Id + "/profile.png"); err != nil {
				t.Fatal(err)
			}
		} else {
			path := utils.Cfg.FileSettings.Directory + "teams/" + user.TeamId + "/users/" + user.Id + "/profile.png"
			if err := os.Remove(path); err != nil {
				t.Fatal("Couldn't remove file at " + path)
			}
		}
	} else {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		if _, upErr := Client.UploadFile("/users/newimage", body.Bytes(), writer.FormDataContentType()); upErr.StatusCode != http.StatusNotImplemented {
			t.Fatal("Should have failed with 501 - Not Implemented")
		}
	}
}

func TestUserUpdate(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	time1 := model.GetMillis()

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd", LastActivityAt: time1, LastPingAt: time1, Roles: ""}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if _, err := Client.UpdateUser(user); err == nil {
		t.Fatal("Should have errored")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	time.Sleep(100 * time.Millisecond)

	time2 := model.GetMillis()

	time.Sleep(100 * time.Millisecond)

	user.Nickname = "Jim Jimmy"
	user.TeamId = "12345678901234567890123456"
	user.LastActivityAt = time2
	user.LastPingAt = time2
	user.Roles = model.ROLE_TEAM_ADMIN
	user.LastPasswordUpdate = 123

	if result, err := Client.UpdateUser(user); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Nickname != "Jim Jimmy" {
			t.Fatal("Nickname did not update properly")
		}
		if result.Data.(*model.User).TeamId != team.Id {
			t.Fatal("TeamId should not have updated")
		}
		if result.Data.(*model.User).LastActivityAt == time2 {
			t.Fatal("LastActivityAt should not have updated")
		}
		if result.Data.(*model.User).LastPingAt == time2 {
			t.Fatal("LastPingAt should not have updated")
		}
		if result.Data.(*model.User).Roles != "" {
			t.Fatal("Roles should not have updated")
		}
		if result.Data.(*model.User).LastPasswordUpdate == 123 {
			t.Fatal("LastPasswordUpdate should not have updated")
		}
	}

	user.TeamId = "junk"
	if _, err := Client.UpdateUser(user); err == nil {
		t.Fatal("Should have errored - tried to change teamId to junk")
	}

	user.TeamId = team.Id
	if _, err := Client.UpdateUser(nil); err == nil {
		t.Fatal("Should have errored")
	}

	user2 := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	user.Nickname = "Tim Timmy"

	if _, err := Client.UpdateUser(user); err == nil {
		t.Fatal("Should have errored")
	}
}

func TestUserUpdatePassword(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if _, err := Client.UpdateUserPassword(user.Id, "pwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.UpdateUserPassword("123", "pwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "pwd", "npwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword("12345678901234567890123456", "pwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "badpwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "pwd", "newpwd"); err != nil {
		t.Fatal(err)
	}

	updatedUser := Client.Must(Client.GetUser(user.Id, "")).Data.(*model.User)
	if updatedUser.LastPasswordUpdate == user.LastPasswordUpdate {
		t.Fatal("LastPasswordUpdate should have changed")
	}

	if _, err := Client.LoginByEmail(team.Name, user.Email, "newpwd"); err != nil {
		t.Fatal(err)
	}

	user2 := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if _, err := Client.UpdateUserPassword(user.Id, "pwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}
}

func TestUserUpdateRoles(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	data := make(map[string]string)
	data["user_id"] = user.Id
	data["new_roles"] = ""

	if _, err := Client.UpdateUserRoles(data); err == nil {
		t.Fatal("Should have errored, not logged in")
	}

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if _, err := Client.UpdateUserRoles(data); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	name := make(map[string]string)
	name["new_name"] = "NewName"
	if _, err := Client.UpdateTeamDisplayName(name); err == nil {
		t.Fatal("should have errored - user not admin yet")
	}

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user3 := &model.User{TeamId: team2.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user3.Id))

	Client.LoginByEmail(team2.Name, user3.Email, "pwd")

	data["user_id"] = user2.Id

	if _, err := Client.UpdateUserRoles(data); err == nil {
		t.Fatal("Should have errored, wrong team")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	data["user_id"] = "junk"
	data["new_roles"] = "admin"

	if _, err := Client.UpdateUserRoles(data); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	data["user_id"] = "12345678901234567890123456"

	if _, err := Client.UpdateUserRoles(data); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	data["user_id"] = user2.Id

	if result, err := Client.UpdateUserRoles(data); err != nil {
		t.Log(data["new_roles"])
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Roles != "admin" {
			t.Fatal("Roles did not update properly")
		}
	}

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if _, err := Client.UpdateTeamDisplayName(name); err != nil {
		t.Fatal(err)
	}
}

func TestUserUpdateActive(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	if _, err := Client.UpdateActive(user.Id, false); err == nil {
		t.Fatal("Should have errored, not logged in")
	}

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if _, err := Client.UpdateActive(user.Id, false); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user3 := &model.User{TeamId: team2.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user3.Id))

	Client.LoginByEmail(team2.Name, user3.Email, "pwd")

	if _, err := Client.UpdateActive(user.Id, false); err == nil {
		t.Fatal("Should have errored, wrong team")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if _, err := Client.UpdateActive("junk", false); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	if _, err := Client.UpdateActive("12345678901234567890123456", false); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	if result, err := Client.UpdateActive(user2.Id, false); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).DeleteAt == 0 {
			t.Fatal("active did not update properly")
		}
	}

	if result, err := Client.UpdateActive(user2.Id, true); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).DeleteAt != 0 {
			t.Fatal("active did not update properly true")
		}
	}
}

func TestSendPasswordReset(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	data := make(map[string]string)
	data["email"] = user.Email
	data["name"] = team.Name

	if _, err := Client.SendPasswordReset(data); err != nil {
		t.Fatal(err)
	}

	data["email"] = ""
	if _, err := Client.SendPasswordReset(data); err == nil {
		t.Fatal("Should have errored - no email")
	}

	data["email"] = "junk@junk.com"
	if _, err := Client.SendPasswordReset(data); err == nil {
		t.Fatal("Should have errored - bad email")
	}

	data["email"] = user.Email
	data["name"] = ""
	if _, err := Client.SendPasswordReset(data); err == nil {
		t.Fatal("Should have errored - no name")
	}

	data["name"] = "junk"
	if _, err := Client.SendPasswordReset(data); err == nil {
		t.Fatal("Should have errored - bad name")
	}
}

func TestResetPassword(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	data := make(map[string]string)
	data["new_password"] = "newpwd"
	props := make(map[string]string)
	props["user_id"] = user.Id
	props["time"] = fmt.Sprintf("%v", model.GetMillis())
	data["data"] = model.MapToJson(props)
	data["hash"] = model.HashPassword(fmt.Sprintf("%v:%v", data["data"], utils.Cfg.EmailSettings.PasswordResetSalt))
	data["name"] = team.Name

	if _, err := Client.ResetPassword(data); err != nil {
		t.Fatal(err)
	}

	data["new_password"] = ""
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - no password")
	}

	data["new_password"] = "npwd"
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - password too short")
	}

	data["new_password"] = "newpwd"
	data["hash"] = ""
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - no hash")
	}

	data["hash"] = "junk"
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - bad hash")
	}

	props["user_id"] = ""
	data["data"] = model.MapToJson(props)
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - no user id")
	}

	data["user_id"] = "12345678901234567890123456"
	data["data"] = model.MapToJson(props)
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	props["user_id"] = user.Id
	props["time"] = ""
	data["data"] = model.MapToJson(props)
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - no time")
	}

	props["time"] = fmt.Sprintf("%v", model.GetMillis())
	data["data"] = model.MapToJson(props)
	data["domain"] = ""
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - no domain")
	}

	data["domain"] = "junk"
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - bad domain")
	}

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test2@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	data["domain"] = team2.Name
	if _, err := Client.ResetPassword(data); err == nil {
		t.Fatal("Should have errored - domain team doesn't match user team")
	}
}

func TestUserUpdateNotify(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd", Roles: ""}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	data := make(map[string]string)
	data["user_id"] = user.Id
	data["email"] = "true"
	data["desktop"] = "all"
	data["desktop_sound"] = "false"

	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - not logged in")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	if result, err := Client.UpdateUserNotify(data); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).NotifyProps["desktop"] != data["desktop"] {
			t.Fatal("NotifyProps did not update properly - desktop")
		}
		if result.Data.(*model.User).NotifyProps["desktop_sound"] != data["desktop_sound"] {
			t.Fatal("NotifyProps did not update properly - desktop_sound")
		}
		if result.Data.(*model.User).NotifyProps["email"] != data["email"] {
			t.Fatal("NotifyProps did not update properly - email")
		}
	}

	if _, err := Client.UpdateUserNotify(nil); err == nil {
		t.Fatal("Should have errored")
	}

	data["user_id"] = "junk"
	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - junk user id")
	}

	data["user_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	data["user_id"] = user.Id
	data["desktop"] = ""
	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - empty desktop notify")
	}

	data["desktop"] = "all"
	data["desktop_sound"] = ""
	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - empty desktop sound")
	}

	data["desktop_sound"] = "false"
	data["email"] = ""
	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - empty email")
	}
}

func TestFuzzyUserCreate(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	for i := 0; i < len(utils.FUZZY_STRINGS_NAMES) || i < len(utils.FUZZY_STRINGS_EMAILS); i++ {
		testName := "Name"
		testEmail := "test@nowhere.com"

		if i < len(utils.FUZZY_STRINGS_NAMES) {
			testName = utils.FUZZY_STRINGS_NAMES[i]
		}
		if i < len(utils.FUZZY_STRINGS_EMAILS) {
			testEmail = utils.FUZZY_STRINGS_EMAILS[i]
		}

		user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + testEmail, Nickname: testName, Password: "hello"}

		_, err := Client.CreateUser(&user, "")
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestStatuses(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	Client.LoginByEmail(team.Name, user.Email, user.Password)

	r1, err := Client.GetStatuses()
	if err != nil {
		t.Fatal(err)
	}

	statuses := r1.Data.(map[string]string)

	if len(statuses) != 1 {
		t.Fatal("invalid number of statuses")
	}

	for _, status := range statuses {
		if status != model.USER_OFFLINE && status != model.USER_AWAY && status != model.USER_ONLINE {
			t.Fatal("one of the statuses had an invalid value")
		}
	}

}
