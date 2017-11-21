// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreateUser(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	Client := th.CreateClient()

	user := model.User{Email: strings.ToLower("success+"+model.NewId()) + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "hello1", Username: "n" + model.NewId()}

	ruser, err := Client.CreateUser(&user, "")
	if err != nil {
		t.Fatal(err)
	}

	Client.Login(user.Email, user.Password)

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))

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
	ruser.Data.(*model.User).Username = "n" + model.NewId()
	ruser.Data.(*model.User).Password = "passwd1"
	if _, err := Client.CreateUser(ruser.Data.(*model.User), ""); err != nil {
		if err.Message != "An account with that email already exists." {
			t.Fatal(err)
		}
	}

	ruser.Data.(*model.User).Email = "success+" + model.NewId() + "@simulator.amazonses.com"
	ruser.Data.(*model.User).Username = user.Username
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

func TestLogin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.EnableSignInWithEmail = false
		*cfg.EmailSettings.EnableSignInWithUsername = false
		*cfg.LdapSettings.Enable = false
	})

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	team2 := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_INVITE}
	rteam2 := Client.Must(Client.CreateTeam(&team2))

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Username: "corey" + model.NewId(), Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	if result, err := Client.LoginById(ruser.Data.(*model.User).Id, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("emails didn't match")
		}
	}

	if _, err := Client.Login(user.Email, user.Password); err == nil {
		t.Fatal("shouldn't be able to log in by email when disabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.EnableSignInWithEmail = true })
	if result, err := Client.Login(user.Email, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("emails didn't match")
		}
	}

	if _, err := Client.Login(user.Username, user.Password); err == nil {
		t.Fatal("shouldn't be able to log in by username when disabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.EnableSignInWithUsername = true })
	if result, err := Client.Login(user.Username, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("emails didn't match")
		}
	}

	if _, err := Client.Login(user.Email, user.Password+"invalid"); err == nil {
		t.Fatal("Invalid Password")
	}

	if _, err := Client.Login(user.Username, user.Password+"invalid"); err == nil {
		t.Fatal("Invalid Password")
	}

	if _, err := Client.Login("", user.Password); err == nil {
		t.Fatal("should have failed")
	}

	if _, err := Client.Login("", user.Password); err == nil {
		t.Fatal("should have failed")
	}

	authToken := Client.AuthToken
	Client.AuthToken = "invalid"

	if _, err := Client.GetUser(ruser.Data.(*model.User).Id, ""); err == nil {
		t.Fatal("should have failed")
	}

	Client.AuthToken = ""

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}

	if _, err := Client.CreateUserFromSignup(&user2, "junk", "1231312"); err == nil {
		t.Fatal("Should have errored, signed up without hashed email")
	}

	props := make(map[string]string)
	props["email"] = user2.Email
	props["id"] = rteam2.Data.(*model.Team).Id
	props["display_name"] = rteam2.Data.(*model.Team).DisplayName
	props["time"] = fmt.Sprintf("%v", model.GetMillis())
	data := model.MapToJson(props)
	hash := utils.HashSha256(fmt.Sprintf("%v:%v", data, th.App.Config().EmailSettings.InviteSalt))

	ruser2, err := Client.CreateUserFromSignup(&user2, data, hash)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := Client.Login(ruser2.Data.(*model.User).Email, user2.Password); err != nil {
		t.Fatal("From verfied hash")
	}

	Client.AuthToken = authToken

	user3 := &model.User{
		Email:       strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com",
		Nickname:    "Corey Hulen",
		Username:    "corey" + model.NewId(),
		Password:    "passwd1",
		AuthService: model.USER_AUTH_SERVICE_LDAP,
	}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user3.Id))

	if _, err := Client.Login(user3.Id, user3.Password); err == nil {
		t.Fatal("AD/LDAP user should not be able to log in with AD/LDAP disabled")
	}
}

func TestLoginByLdap(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Username: "corey" + model.NewId(), Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	if _, err := Client.LoginByLdap(ruser.Data.(*model.User).Id, user.Password); err == nil {
		t.Fatal("should have failed to log in with non AD/LDAP user")
	}
}

func TestLoginWithDeviceId(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user := th.BasicUser
	Client.Must(Client.Logout())

	deviceId := model.NewId()
	if result, err := Client.LoginWithDevice(user.Email, user.Password, deviceId); err != nil {
		t.Fatal(err)
	} else {
		ruser := result.Data.(*model.User)

		if ssresult, err := Client.GetSessions(ruser.Id); err != nil {
			t.Fatal(err)
		} else {
			sessions := ssresult.Data.([]*model.Session)
			if _, err := Client.LoginWithDevice(user.Email, user.Password, deviceId); err != nil {
				t.Fatal(err)
			}

			if sresult := <-th.App.Srv.Store.Session().Get(sessions[0].Id); sresult.Err == nil {
				t.Fatal("session should have been removed")
			}
		}
	}
}

func TestPasswordGuessLockout(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user := th.BasicUser
	Client.Must(Client.Logout())

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.EnableSignInWithEmail = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 2 })

	// OK to log in
	if _, err := Client.Login(user.Username, user.Password); err != nil {
		t.Fatal(err)
	}

	Client.Must(Client.Logout())

	// Fail twice
	if _, err := Client.Login(user.Email, "notthepassword"); err == nil {
		t.Fatal("Shouldn't be able to login with bad password.")
	}
	if _, err := Client.Login(user.Email, "notthepassword"); err == nil {
		t.Fatal("Shouldn't be able to login with bad password.")
	}

	// Locked out
	if _, err := Client.Login(user.Email, user.Password); err == nil {
		t.Fatal("Shouldn't be able to login with password when account is locked out.")
	}
}

func TestSessions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user := th.BasicUser
	Client.Must(Client.Logout())

	deviceId := model.NewId()
	Client.LoginWithDevice(user.Email, user.Password, deviceId)
	Client.Login(user.Email, user.Password)

	r1, err := Client.GetSessions(user.Id)
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

	r2, err := Client.GetSessions(user.Id)
	if err != nil {
		t.Fatal(err)
	}

	sessions2 := r2.Data.([]*model.Session)

	if len(sessions2) != 1 {
		t.Fatal("invalid number of sessions")
	}
}

func TestGetUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	team2 := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam2, _ := Client.CreateTeam(&team2)

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", FirstName: "Corey", LastName: "Hulen"}
	ruser2, _ := Client.CreateUser(&user2, "")
	th.LinkUserToTeam(ruser2.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser2.Data.(*model.User).Id))

	user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser3, _ := Client.CreateUser(&user3, "")
	th.LinkUserToTeam(ruser3.Data.(*model.User), rteam2.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser3.Data.(*model.User).Id))

	Client.Login(user.Email, user.Password)

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

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	if result, err := Client.GetUser(ruser2.Data.(*model.User).Id, ""); err != nil {
		t.Fatal(err)
	} else {
		u := result.Data.(*model.User)
		if u.Password != "" {
			t.Fatal("password must be empty")
		}
		if *u.AuthData != "" {
			t.Fatal("auth data must be empty")
		}
		if u.Email != "" {
			t.Fatal("email should be sanitized")
		}
		if u.FirstName != "" {
			t.Fatal("full name should be sanitized")
		}
		if u.LastName != "" {
			t.Fatal("full name should be sanitized")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = true })

	if result, err := Client.GetUser(ruser2.Data.(*model.User).Id, ""); err != nil {
		t.Fatal(err)
	} else {
		u := result.Data.(*model.User)
		if u.Email == "" {
			t.Fatal("email should not be sanitized")
		}
		if u.FirstName == "" {
			t.Fatal("full name should not be sanitized")
		}
		if u.LastName == "" {
			t.Fatal("full name should not be sanitized")
		}
	}

	if userMap, err := Client.GetProfilesInTeam(rteam.Data.(*model.Team).Id, 0, 100, ""); err != nil {
		t.Fatal(err)
	} else if len(userMap.Data.(map[string]*model.User)) != 3 {
		t.Fatal("should have been 3")
	} else if userMap.Data.(map[string]*model.User)[rId].Id != rId {
		t.Fatal("should have been valid")
	} else {

		// test etag caching
		if cache_result, err := Client.GetProfilesInTeam(rteam.Data.(*model.Team).Id, 0, 100, userMap.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(map[string]*model.User) != nil {
			t.Log(cache_result.Data)
			t.Fatal("cache should be empty")
		}
	}

	if userMap, err := Client.GetProfilesInTeam(rteam.Data.(*model.Team).Id, 0, 1, ""); err != nil {
		t.Fatal(err)
	} else if len(userMap.Data.(map[string]*model.User)) != 1 {
		t.Fatal("should have been 1")
	}

	if userMap, err := Client.GetProfilesInTeam(rteam.Data.(*model.Team).Id, 1, 1, ""); err != nil {
		t.Fatal(err)
	} else if len(userMap.Data.(map[string]*model.User)) != 1 {
		t.Fatal("should have been 1")
	}

	if userMap, err := Client.GetProfilesInTeam(rteam.Data.(*model.Team).Id, 10, 10, ""); err != nil {
		t.Fatal(err)
	} else if len(userMap.Data.(map[string]*model.User)) != 0 {
		t.Fatal("should have been 0")
	}

	if _, err := Client.GetProfilesInTeam(rteam2.Data.(*model.Team).Id, 0, 100, ""); err == nil {
		t.Fatal("shouldn't have access")
	}

	Client.AuthToken = ""
	if _, err := Client.GetUser(ruser2.Data.(*model.User).Id, ""); err == nil {
		t.Fatal("shouldn't have accss")
	}

	th.App.UpdateUserRoles(ruser.Data.(*model.User).Id, model.SYSTEM_ADMIN_ROLE_ID, false)

	Client.Login(user.Email, "passwd1")

	if _, err := Client.GetProfilesInTeam(rteam2.Data.(*model.Team).Id, 0, 100, ""); err != nil {
		t.Fatal(err)
	}
}

func TestGetProfiles(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.BasicClient.Must(th.BasicClient.CreateDirectChannel(th.BasicUser2.Id))

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })

	if result, err := th.BasicClient.GetProfiles(0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) < 1 {
			t.Fatal("map was wrong length")
		}

		for _, user := range users {
			if user.Email == "" {
				t.Fatal("problem with show email")
			}
		}

		// test etag caching
		if cache_result, err := th.BasicClient.GetProfiles(0, 100, result.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(map[string]*model.User) != nil {
			t.Log(cache_result.Etag)
			t.Log(result.Etag)
			t.Fatal("cache should be empty")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })

	if result, err := th.BasicClient.GetProfiles(0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) < 1 {
			t.Fatal("map was wrong length")
		}

		for _, user := range users {
			if user.Email != "" {
				t.Fatal("problem with show email")
			}
		}
	}
}

func TestGetProfilesByIds(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })

	if result, err := th.BasicClient.GetProfilesByIds([]string{th.BasicUser.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) != 1 {
			t.Fatal("map was wrong length")
		}

		for _, user := range users {
			if user.Email == "" {
				t.Fatal("problem with show email")
			}
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })

	if result, err := th.BasicClient.GetProfilesByIds([]string{th.BasicUser.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) != 1 {
			t.Fatal("map was wrong length")
		}

		for _, user := range users {
			if user.Email != "" {
				t.Fatal("problem with show email")
			}
		}
	}

	if result, err := th.BasicClient.GetProfilesByIds([]string{th.BasicUser.Id, th.BasicUser2.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) != 2 {
			t.Fatal("map was wrong length")
		}
	}
}

func TestGetAudits(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	time.Sleep(100 * time.Millisecond)

	Client.Login(user.Email, user.Password)

	time.Sleep(100 * time.Millisecond)

	if result, err := Client.GetAudits(ruser.Data.(*model.User).Id, ""); err != nil {
		t.Fatal(err)
	} else {

		if len(result.Data.(model.Audits)) != 1 {
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
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	b, err := app.CreateProfileImage("Corey Hulen", "eo1zkdr96pdj98pjmq8zy35wba", th.App.Config().FileSettings.InitialFont)
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

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")

	if resp, err := Client.DoApiGet("/users/"+user.Id+"/image", "", ""); err != nil {
		t.Fatal(err)
	} else {
		etag := resp.Header.Get(model.HEADER_ETAG_SERVER)
		resp2, _ := Client.DoApiGet("/users/"+user.Id+"/image", "", etag)
		if resp2.StatusCode == 304 {
			t.Fatal("Shouldn't have hit etag")
		}
	}

	if *th.App.Config().FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := th.App.Config().FileSettings.AmazonS3Endpoint
		accessKey := th.App.Config().FileSettings.AmazonS3AccessKeyId
		secretKey := th.App.Config().FileSettings.AmazonS3SecretAccessKey
		secure := *th.App.Config().FileSettings.AmazonS3SSL
		signV2 := *th.App.Config().FileSettings.AmazonS3SignV2
		region := th.App.Config().FileSettings.AmazonS3Region
		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			t.Fatal(err)
		}
		bucket := th.App.Config().FileSettings.AmazonS3Bucket
		if err = s3Clnt.RemoveObject(bucket, "/users/"+user.Id+"/profile.png"); err != nil {
			t.Fatal(err)
		}
	} else {
		path := th.App.Config().FileSettings.Directory + "/users/" + user.Id + "/profile.png"
		if err := os.Remove(path); err != nil {
			t.Fatal("Couldn't remove file at " + path)
		}
	}
}

func TestUserUploadProfileImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	if *th.App.Config().FileSettings.DriverName != "" {

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		if _, upErr := Client.UploadProfileFile(body.Bytes(), writer.FormDataContentType()); upErr == nil {
			t.Fatal("Should have errored")
		}

		Client.Login(user.Email, "passwd1")
		Client.SetTeamId(team.Id)

		if _, upErr := Client.UploadProfileFile(body.Bytes(), writer.FormDataContentType()); upErr == nil {
			t.Fatal("Should have errored")
		}

		part, err := writer.CreateFormFile("blargh", "test.png")
		if err != nil {
			t.Fatal(err)
		}

		path, _ := utils.FindDir("tests")
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

		if _, upErr := Client.UploadProfileFile(body.Bytes(), writer.FormDataContentType()); upErr == nil {
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

		if _, upErr := Client.UploadProfileFile(body.Bytes(), writer.FormDataContentType()); upErr != nil {
			t.Fatal(upErr)
		}

		Client.DoApiGet("/users/"+user.Id+"/image", "", "")

		if *th.App.Config().FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
			endpoint := th.App.Config().FileSettings.AmazonS3Endpoint
			accessKey := th.App.Config().FileSettings.AmazonS3AccessKeyId
			secretKey := th.App.Config().FileSettings.AmazonS3SecretAccessKey
			secure := *th.App.Config().FileSettings.AmazonS3SSL
			signV2 := *th.App.Config().FileSettings.AmazonS3SignV2
			region := th.App.Config().FileSettings.AmazonS3Region
			s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
			if err != nil {
				t.Fatal(err)
			}
			bucket := th.App.Config().FileSettings.AmazonS3Bucket
			if err = s3Clnt.RemoveObject(bucket, "/users/"+user.Id+"/profile.png"); err != nil {
				t.Fatal(err)
			}
		} else {
			path := th.App.Config().FileSettings.Directory + "users/" + user.Id + "/profile.png"
			if err := os.Remove(path); err != nil {
				t.Fatal("Couldn't remove file at " + path)
			}
		}
	} else {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		if _, upErr := Client.UploadProfileFile(body.Bytes(), writer.FormDataContentType()); upErr.StatusCode != http.StatusNotImplemented {
			t.Fatal("Should have failed with 501 - Not Implemented")
		}
	}
}

func TestUserUpdate(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", Roles: ""}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	if _, err := Client.UpdateUser(user); err == nil {
		t.Fatal("Should have errored")
	}

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	user.Nickname = "Jim Jimmy"
	user.Roles = model.SYSTEM_ADMIN_ROLE_ID
	user.LastPasswordUpdate = 123

	if result, err := Client.UpdateUser(user); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Nickname != "Jim Jimmy" {
			t.Fatal("Nickname did not update properly")
		}
		if result.Data.(*model.User).Roles != model.SYSTEM_USER_ROLE_ID {
			t.Fatal("Roles should not have updated")
		}
		if result.Data.(*model.User).LastPasswordUpdate == 123 {
			t.Fatal("LastPasswordUpdate should not have updated")
		}
	}

	user2 := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(team.Id)

	user.Nickname = "Tim Timmy"

	if _, err := Client.UpdateUser(user); err == nil {
		t.Fatal("Should have errored")
	}
}

func TestUserUpdatePassword(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()
	Client.SetTeamId(team.Id)

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	if _, err := Client.UpdateUserPassword(user.Id, "passwd1", "newpasswd1"); err == nil {
		t.Fatal("Should have errored")
	}

	Client.Login(user.Email, "passwd1")

	if _, err := Client.UpdateUserPassword("123", "passwd1", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "passwd1", "npwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword("12345678901234567890123456", "passwd1", "newpwd1"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "badpwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	if _, err := Client.UpdateUserPassword(user.Id, "passwd1", "newpwd1"); err != nil {
		t.Fatal(err)
	}

	updatedUser := Client.Must(Client.GetUser(user.Id, "")).Data.(*model.User)
	if updatedUser.LastPasswordUpdate == user.LastPasswordUpdate {
		t.Fatal("LastPasswordUpdate should have changed")
	}

	if _, err := Client.Login(user.Email, "newpwd1"); err != nil {
		t.Fatal(err)
	}

	// Test lockout
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumLoginAttempts = 2 })

	// Fail twice
	if _, err := Client.UpdateUserPassword(user.Id, "badpwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}
	if _, err := Client.UpdateUserPassword(user.Id, "badpwd", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}

	// Should fail because account is locked out
	if _, err := Client.UpdateUserPassword(user.Id, "newpwd1", "newpwd2"); err == nil {
		t.Fatal("Should have errored")
	}

	user2 := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)

	Client.Login(user2.Email, "passwd1")

	if _, err := Client.UpdateUserPassword(user.Id, "passwd1", "newpwd"); err == nil {
		t.Fatal("Should have errored")
	}
}

func TestUserUpdateRoles(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	if _, err := Client.UpdateUserRoles(user.Id, ""); err == nil {
		t.Fatal("Should have errored, not logged in")
	}

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateUserRoles(user.Id, ""); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user3 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	th.LinkUserToTeam(user3, team2)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user3.Id))

	Client.Login(user3.Email, "passwd1")
	Client.SetTeamId(team2.Id)

	if _, err := Client.UpdateUserRoles(user2.Id, ""); err == nil {
		t.Fatal("Should have errored, wrong team")
	}

	Client.Login(user.Email, "passwd1")

	if _, err := Client.UpdateUserRoles("junk", ""); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	if _, err := Client.UpdateUserRoles("system_admin", ""); err == nil {
		t.Fatal("Should have errored, we want to avoid this mistake")
	}

	if _, err := Client.UpdateUserRoles("12345678901234567890123456", ""); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	if _, err := Client.UpdateUserRoles(user2.Id, "junk"); err == nil {
		t.Fatal("Should have errored, bad role")
	}
}

func TestUserUpdateRolesMoreCases(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	th.SystemAdminClient.SetTeamId(th.BasicTeam.Id)
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)

	const BASIC_USER = "system_user"
	const SYSTEM_ADMIN = "system_user system_admin"

	// user 1 is trying to promote user 2
	if _, err := th.BasicClient.UpdateUserRoles(th.BasicUser2.Id, SYSTEM_ADMIN); err == nil {
		t.Fatal("Should have errored, basic user is not a system admin")
	}

	// user 1 is trying to demote system admin
	if _, err := th.BasicClient.UpdateUserRoles(th.SystemAdminUser.Id, BASIC_USER); err == nil {
		t.Fatal("Should have errored, can only be system admin")
	}

	// user 1 is trying to promote himself
	if _, err := th.BasicClient.UpdateUserRoles(th.BasicUser.Id, SYSTEM_ADMIN); err == nil {
		t.Fatal("Should have errored, can only be system admin")
	}

	// System admin promoting user 2
	if _, err := th.SystemAdminClient.UpdateUserRoles(th.BasicUser2.Id, SYSTEM_ADMIN); err != nil {
		t.Fatal("Should have succeeded since they are system admin")
	}

	// System admin demoting user 2
	if _, err := th.SystemAdminClient.UpdateUserRoles(th.BasicUser2.Id, BASIC_USER); err != nil {
		t.Fatal("Should have succeeded since they are system admin")
	}

	// Setting user to team admin should have no effect on results
	th.BasicClient.Must(th.SystemAdminClient.UpdateTeamRoles(th.BasicUser.Id, "team_user team_admin"))

	// user 1 is trying to promote user 2
	if _, err := th.BasicClient.UpdateUserRoles(th.BasicUser2.Id, SYSTEM_ADMIN); err == nil {
		t.Fatal("Should have errored, basic user is not a system admin")
	}

	// user 1 is trying to demote system admin
	if _, err := th.BasicClient.UpdateUserRoles(th.SystemAdminUser.Id, BASIC_USER); err == nil {
		t.Fatal("Should have errored, can only be system admin")
	}

	// user 1 is trying to promote himself
	if _, err := th.BasicClient.UpdateUserRoles(th.BasicUser.Id, SYSTEM_ADMIN); err == nil {
		t.Fatal("Should have errored, can only be system admin")
	}

	// system admin demoting himself
	if _, err := th.SystemAdminClient.UpdateUserRoles(th.SystemAdminUser.Id, BASIC_USER); err != nil {
		t.Fatal("Should have succeeded since they are system admin")
	}
}

func TestUserUpdateDeviceId(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)
	deviceId := model.PUSH_NOTIFY_APPLE + ":1234567890"

	if _, err := Client.AttachDeviceId(deviceId); err != nil {
		t.Fatal(err)
	}

	if result := <-th.App.Srv.Store.Session().GetSessions(user.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		sessions := result.Data.([]*model.Session)

		if sessions[0].DeviceId != deviceId {
			t.Fatal("Missing device Id")
		}
	}
}

func TestUserUpdateDeviceId2(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)
	deviceId := model.PUSH_NOTIFY_APPLE_REACT_NATIVE + ":1234567890"

	if _, err := Client.AttachDeviceId(deviceId); err != nil {
		t.Fatal(err)
	}

	if result := <-th.App.Srv.Store.Session().GetSessions(user.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		sessions := result.Data.([]*model.Session)

		if sessions[0].DeviceId != deviceId {
			t.Fatal("Missing device Id")
		}
	}
}

func TestUserUpdateActive(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	SystemAdminClient := th.SystemAdminClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	if _, err := Client.UpdateActive(user.Id, false); err == nil {
		t.Fatal("Should have errored, not logged in")
	}

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateActive(user.Id, false); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	Client.Must(Client.Logout())

	user3 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team2)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user3.Id))

	Client.Login(user3.Email, "passwd1")
	Client.SetTeamId(team2.Id)

	if _, err := Client.UpdateActive(user.Id, false); err == nil {
		t.Fatal("Should have errored, not yourself")
	}

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if _, err := Client.UpdateActive("junk", false); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	if _, err := Client.UpdateActive("12345678901234567890123456", false); err == nil {
		t.Fatal("Should have errored, bad id")
	}

	th.App.SetStatusOnline(user3.Id, "", false)

	if _, err := SystemAdminClient.UpdateActive(user3.Id, false); err != nil {
		t.Fatal(err)
	}

	if status, err := th.App.GetStatus(user3.Id); err != nil {
		t.Fatal(err)
	} else if status.Status != model.STATUS_OFFLINE {
		t.Fatal("status should have been set to offline")
	}
}

func TestUserPermDelete(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	th.LinkUserToTeam(user1, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user1.Id))

	Client.Login(user1.Email, "passwd1")
	Client.SetTeamId(team.Id)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "search for post1"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "search for post2"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag search for post3"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel1.Id, Message: "hashtag for post4"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "test"

	err := th.App.PermanentDeleteUser(user1)
	if err != nil {
		t.Fatal(err)
	}

	Client.ClearOAuthToken()
}

func TestSendPasswordReset(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	Client.Logout()

	if result, err := Client.SendPasswordReset(user.Email); err != nil {
		t.Fatal(err)
	} else {
		resp := result.Data.(map[string]string)
		if resp["email"] != user.Email {
			t.Fatal("wrong email")
		}
	}

	if _, err := Client.SendPasswordReset("junk@junk.com"); err != nil {
		t.Fatal("Should have errored - bad email")
	}

	if _, err := Client.SendPasswordReset(""); err == nil {
		t.Fatal("Should have errored - no email")
	}

	authData := model.NewId()
	user2 := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", AuthData: &authData, AuthService: "random"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	if _, err := Client.SendPasswordReset(user2.Email); err == nil {
		t.Fatal("should have errored - SSO user can't send reset password link")
	}
}

/*func TestResetPassword(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	//Delete all the messages before check the reset password
	utils.DeleteMailBox(user.Email)

	Client.Must(Client.SendPasswordReset(user.Email))

	//Check if the email was send to the rigth email address and the recovery key match
	var resultsMailbox utils.JSONMessageHeaderInbucket
	err := utils.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = utils.GetMailBox(user.Email)
		return err
	})
	if err != nil {
		t.Log(err)
		t.Log("No email was received, maybe due load on the server. Disabling this verification")
	}

	var recoveryTokenString string
	if err == nil && len(resultsMailbox) > 0 {
		if !strings.ContainsAny(resultsMailbox[0].To[0], user.Email) {
			t.Fatal("Wrong To recipient")
		} else {
			if resultsEmail, err := utils.GetMessageFromMailbox(user.Email, resultsMailbox[0].ID); err == nil {
				loc := strings.Index(resultsEmail.Body.Text, "token=")
				if loc == -1 {
					t.Log(recoveryTokenString)
					t.Log(resultsEmail.Body.Text)
					t.Fatal("Code not found in email")
				}
				loc += 6
				recoveryTokenString = resultsEmail.Body.Text[loc : loc+model.TOKEN_SIZE]
				t.Log(resultsEmail.Body.Text)
			}
		}
	}

	var recoveryToken *model.Token
	if result := <-th.App.Srv.Store.Token().GetByToken(recoveryTokenString); result.Err != nil {
		t.Log(recoveryTokenString)
		t.Fatal(result.Err)
	} else {
		recoveryToken = result.Data.(*model.Token)
	}

	if recoveryToken.Token != recoveryTokenString {
		t.Fatal("Did not send the correct token. DB: "+recoveryToken.Token, " Sent: "+recoveryTokenString)
	}

	if _, err := Client.ResetPassword(recoveryToken.Token, ""); err == nil {
		t.Fatal("Should have errored - no password")
	}

	if _, err := Client.ResetPassword(recoveryToken.Token, "newp"); err == nil {
		t.Fatal("Should have errored - password too short")
	}

	if _, err := Client.ResetPassword("", "newpwd"); err == nil {
		t.Fatal("Should have errored - no code")
	}

	if _, err := Client.ResetPassword("junk", "newpwd"); err == nil {
		t.Fatal("Should have errored - bad code")
	}

	code := ""
	for i := 0; i < model.TOKEN_SIZE; i++ {
		code += "a"
	}
	if _, err := Client.ResetPassword(code, "newpwd1"); err == nil {
		t.Fatal("Should have errored - bad code")
	}

	if _, err := Client.ResetPassword(recoveryToken.Token, "newpwd1"); err != nil {
		t.Log(recoveryToken.Token)
		t.Fatal(err)
	}

}*/

func TestUserUpdateNotify(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", Roles: ""}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	data := make(map[string]string)
	data["user_id"] = user.Id
	data["email"] = "true"
	data["desktop"] = "all"
	data["desktop_sound"] = "false"
	data["comments"] = "any"

	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - not logged in")
	}

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

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
		if result.Data.(*model.User).NotifyProps["comments"] != data["comments"] {
			t.Fatal("NotifyProps did not update properly - comments")
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

	data["email"] = "true"
	data["comments"] = ""
	if _, err := Client.UpdateUserNotify(data); err == nil {
		t.Fatal("Should have errored - empty comments")
	}
}

func TestFuzzyUserCreate(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	Client.Logout()

	for i := 0; i < len(utils.FUZZY_STRINGS_NAMES) || i < len(utils.FUZZY_STRINGS_EMAILS); i++ {
		testName := "Name"
		testEmail := "test@nowhere.com"

		if i < len(utils.FUZZY_STRINGS_NAMES) {
			testName = utils.FUZZY_STRINGS_NAMES[i]
		}
		if i < len(utils.FUZZY_STRINGS_EMAILS) {
			testEmail = utils.FUZZY_STRINGS_EMAILS[i]
		}

		user := model.User{Email: strings.ToLower(model.NewId()) + testEmail, Nickname: testName, Password: "hello1"}

		ruser, err := Client.CreateUser(&user, "")
		if err != nil {
			t.Fatal(err)
		}

		th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	}
}

func TestEmailToOAuth(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Id))

	m := map[string]string{}
	if _, err := Client.EmailToOAuth(m); err == nil {
		t.Fatal("should have failed - empty data")
	}

	m["password"] = "passwd1"
	_, err := Client.EmailToOAuth(m)
	if err == nil {
		t.Fatal("should have failed - missing team_name, service, email")
	}

	m["team_name"] = team.Name
	if _, err := Client.EmailToOAuth(m); err == nil {
		t.Fatal("should have failed - missing service, email")
	}

	m["service"] = "someservice"
	if _, err := Client.EmailToOAuth(m); err == nil {
		t.Fatal("should have failed - missing email")
	}

	m["team_name"] = "junk"
	if _, err := Client.EmailToOAuth(m); err == nil {
		t.Fatal("should have failed - bad team name")
	}

	m["team_name"] = team.Name
	m["email"] = "junk"
	if _, err := Client.EmailToOAuth(m); err == nil {
		t.Fatal("should have failed - bad email")
	}

	m["email"] = ruser.Email
	m["password"] = "junk"
	if _, err := Client.EmailToOAuth(m); err == nil {
		t.Fatal("should have failed - bad password")
	}
}

func TestOAuthToEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Id))

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser2 := Client.Must(Client.CreateUser(&user2, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser2, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser2.Id))

	m := map[string]string{}
	if _, err := Client.OAuthToEmail(m); err == nil {
		t.Fatal("should have failed - not logged in")
	}

	Client.Login(user.Email, user.Password)

	if _, err := Client.OAuthToEmail(m); err == nil {
		t.Fatal("should have failed - empty data")
	}

	m["password"] = "passwd1"
	_, err := Client.OAuthToEmail(m)
	if err == nil {
		t.Fatal("should have failed - missing team_name, service, email")
	}

	m["team_name"] = team.Name
	if _, err := Client.OAuthToEmail(m); err == nil {
		t.Fatal("should have failed - missing email")
	}

	m["team_name"] = team.Name
	m["email"] = "junk"
	if _, err := Client.OAuthToEmail(m); err == nil {
		t.Fatal("should have failed - bad email")
	}

	m["email"] = ruser2.Email
	if _, err := Client.OAuthToEmail(m); err == nil {
		t.Fatal("should have failed - wrong user")
	}
}

func TestLDAPToEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Id))

	Client.Login(user.Email, user.Password)

	m := map[string]string{}
	if _, err := Client.LDAPToEmail(m); err == nil {
		t.Fatal("should have failed - empty data")
	}

	m["email_password"] = "passwd1"
	_, err := Client.LDAPToEmail(m)
	if err == nil {
		t.Fatal("should have failed - missing team_name, ldap_password, email")
	}

	m["team_name"] = team.Name
	if _, err := Client.LDAPToEmail(m); err == nil {
		t.Fatal("should have failed - missing email, ldap_password")
	}

	m["ldap_password"] = "passwd1"
	if _, err := Client.LDAPToEmail(m); err == nil {
		t.Fatal("should have failed - missing email")
	}

	m["email"] = ruser.Email
	m["team_name"] = "junk"
	if _, err := Client.LDAPToEmail(m); err == nil {
		t.Fatal("should have failed - bad team name")
	}

	m["team_name"] = team.Name
	m["email"] = "junk"
	if _, err := Client.LDAPToEmail(m); err == nil {
		t.Fatal("should have failed - bad email")
	}

	m["email"] = user.Email
	if _, err := Client.LDAPToEmail(m); err == nil {
		t.Fatal("should have failed - user is not an AD/LDAP user")
	}
}

func TestEmailToLDAP(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Id))

	Client.Login(user.Email, user.Password)

	m := map[string]string{}
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - empty data")
	}

	m["email_password"] = "passwd1"
	_, err := Client.EmailToLDAP(m)
	if err == nil {
		t.Fatal("should have failed - missing team_name, ldap_id, ldap_password, email")
	}

	m["team_name"] = team.Name
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - missing email, ldap_password, ldap_id")
	}

	m["ldap_id"] = "someid"
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - missing email, ldap_password")
	}

	m["ldap_password"] = "passwd1"
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - missing email")
	}

	m["email"] = ruser.Email
	m["team_name"] = "junk"
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - bad team name")
	}

	m["team_name"] = team.Name
	m["email"] = "junk"
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - bad email")
	}

	m["email"] = user.Email
	m["email_password"] = "junk"
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - bad password")
	}

	m["email_password"] = "passwd1"
	if _, err := Client.EmailToLDAP(m); err == nil {
		t.Fatal("should have failed - missing ldap bits or user")
	}
}

func TestMeInitialLoad(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if result, err := th.BasicClient.GetInitialLoad(); err != nil {
		t.Fatal(err)
	} else {
		il := result.Data.(*model.InitialLoad)

		if il.User == nil {
			t.Fatal("should be valid")
		}

		if il.Preferences == nil {
			t.Fatal("should be valid")
		}

		if len(il.Teams) != 1 {
			t.Fatal("should be valid")
		}

		if len(il.TeamMembers) != 1 {
			t.Fatal("should be valid")
		}

		if len(il.ClientCfg) == 0 {
			t.Fatal("should be valid")
		}

		if len(il.LicenseCfg) == 0 {
			t.Fatal("should be valid")
		}
	}

	th.BasicClient.Logout()

	if result, err := th.BasicClient.GetInitialLoad(); err != nil {
		t.Fatal(err)
	} else {
		il := result.Data.(*model.InitialLoad)

		if il.User != nil {
			t.Fatal("should be valid")
		}

		if il.Preferences != nil {
			t.Fatal("should be valid")
		}

		if len(il.Teams) != 0 {
			t.Fatal("should be valid")
		}

		if len(il.TeamMembers) != 0 {
			t.Fatal("should be valid")
		}

		if len(il.ClientCfg) == 0 {
			t.Fatal("should be valid")
		}

		if len(il.LicenseCfg) == 0 {
			t.Fatal("should be valid")
		}
	}

}

func TestGenerateMfaSecret(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	Client.Logout()

	if _, err := Client.GenerateMfaSecret(); err == nil {
		t.Fatal("should have failed - not logged in")
	}

	Client.Login(user.Email, user.Password)

	if _, err := Client.GenerateMfaSecret(); err == nil {
		t.Fatal("should have failed - not licensed")
	}

	// need to add more test cases when license and config can be configured for tests
}

func TestUpdateMfa(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
	}()
	utils.SetIsLicensed(false)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	if utils.License().Features.MFA == nil {
		utils.License().Features.MFA = new(bool)
	}

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	Client.Logout()

	if _, err := Client.UpdateMfa(true, "123456"); err == nil {
		t.Fatal("should have failed - not logged in")
	}

	Client.Login(user.Email, user.Password)

	if _, err := Client.UpdateMfa(true, ""); err == nil {
		t.Fatal("should have failed - no token")
	}

	if _, err := Client.UpdateMfa(true, "123456"); err == nil {
		t.Fatal("should have failed - not licensed")
	}

	utils.SetIsLicensed(true)
	*utils.License().Features.MFA = true
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMultifactorAuthentication = true })

	if _, err := Client.UpdateMfa(true, "123456"); err == nil {
		t.Fatal("should have failed - bad token")
	}

	// need to add more test cases when enterprise bits can be loaded into tests
}

func TestCheckMfa(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	Client.Logout()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	if result, err := Client.CheckMfa(user.Email); err != nil {
		t.Fatal(err)
	} else {
		resp := result.Data.(map[string]string)
		if resp["mfa_required"] != "false" {
			t.Fatal("mfa should not be required")
		}
	}

	// need to add more test cases when enterprise bits can be loaded into tests
}

func TestUserTyping(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	defer WebSocketClient.Close()
	WebSocketClient.Listen()

	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Status != model.STATUS_OK {
		t.Fatal("should have responded OK to authentication challenge")
	}

	WebSocketClient.UserTyping("", "")
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.websocket_handler.invalid_param.app_error" {
		t.Fatal("should have been invalid param response")
	}

	th.LoginBasic2()
	Client.Must(Client.JoinChannel(th.BasicChannel.Id))

	WebSocketClient2, err2 := th.CreateWebSocketClient()
	if err2 != nil {
		t.Fatal(err2)
	}
	defer WebSocketClient2.Close()
	WebSocketClient2.Listen()

	time.Sleep(300 * time.Millisecond)

	WebSocketClient.UserTyping(th.BasicChannel.Id, "")

	time.Sleep(300 * time.Millisecond)

	stop := make(chan bool)
	eventHit := false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient2.EventChannel:
				if resp.Event == model.WEBSOCKET_EVENT_TYPING && resp.Data["user_id"].(string) == th.BasicUser.Id {
					eventHit = true
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(1000 * time.Millisecond)

	stop <- true

	if !eventHit {
		t.Fatal("did not receive typing event")
	}

	WebSocketClient.UserTyping(th.BasicChannel.Id, "someparentid")

	time.Sleep(300 * time.Millisecond)

	eventHit = false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient2.EventChannel:
				if resp.Event == model.WEBSOCKET_EVENT_TYPING && resp.Data["parent_id"] == "someparentid" {
					eventHit = true
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(300 * time.Millisecond)

	stop <- true

	if !eventHit {
		t.Fatal("did not receive typing event")
	}
}

func TestGetProfilesInChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })

	if result, err := Client.GetProfilesInChannel(th.BasicChannel.Id, 0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) < 1 {
			t.Fatal("map was wrong length")
		}

		for _, user := range users {
			if user.Email == "" {
				t.Fatal("problem with show email")
			}
		}
	}

	th.LoginBasic2()

	if _, err := Client.GetProfilesInChannel(th.BasicChannel.Id, 0, 100, ""); err == nil {
		t.Fatal("should not have access")
	}

	Client.Must(Client.JoinChannel(th.BasicChannel.Id))

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })

	if result, err := Client.GetProfilesInChannel(th.BasicChannel.Id, 0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) < 1 {
			t.Fatal("map was wrong length")
		}

		found := false
		for _, user := range users {
			if user.Email != "" {
				t.Fatal("problem with show email")
			}
			if user.Id == th.BasicUser2.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	Client.Must(Client.CreateUser(&user, ""))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId("junk")

	if _, err := Client.GetProfilesInChannel(th.BasicChannel.Id, 0, 100, ""); err == nil {
		t.Fatal("should not have access")
	}
}

func TestGetProfilesNotInChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })

	if result, err := Client.GetProfilesNotInChannel(th.BasicChannel.Id, 0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) < 1 {
			t.Fatal("map was wrong length")
		}

		found := false
		for _, user := range users {
			if user.Email == "" {
				t.Fatal("problem with show email")
			}
			if user.Id == th.BasicUser2.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, th.BasicTeam)

	th.LoginBasic2()

	if _, err := Client.GetProfilesNotInChannel(th.BasicChannel.Id, 0, 100, ""); err == nil {
		t.Fatal("should not have access")
	}

	Client.Must(Client.JoinChannel(th.BasicChannel.Id))

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })

	if result, err := Client.GetProfilesNotInChannel(th.BasicChannel.Id, 0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.(map[string]*model.User)

		if len(users) < 1 {
			t.Fatal("map was wrong length")
		}

		found := false
		for _, user := range users {
			if user.Email != "" {
				t.Fatal("problem with show email")
			}
			if user.Id == th.BasicUser2.Id {
				found = true
			}
		}

		if found {
			t.Fatal("should not have found profile")
		}
	}

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	Client.Must(Client.CreateUser(&user2, ""))

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(th.BasicTeam.Id)

	if _, err := Client.GetProfilesNotInChannel(th.BasicChannel.Id, 0, 100, ""); err == nil {
		t.Fatal("should not have access")
	}
}

func TestSearchUsers(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient

	inactiveUser := th.CreateUser(Client)
	th.LinkUserToTeam(inactiveUser, th.BasicTeam)
	th.SystemAdminClient.Must(th.SystemAdminClient.UpdateActive(inactiveUser.Id, false))

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == th.BasicUser.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: inactiveUser.Username, TeamId: th.BasicTeam.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == inactiveUser.Id {
				found = true
			}
		}

		if found {
			t.Fatal("should not have found inactive user")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: inactiveUser.Username, TeamId: th.BasicTeam.Id, AllowInactive: true}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == inactiveUser.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found inactive user")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username, InChannelId: th.BasicChannel.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		if len(users) != 1 {
			t.Fatal("map was wrong length")
		}

		found := false
		for _, user := range users {
			if user.Id == th.BasicUser.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser2.Username, NotInChannelId: th.BasicChannel.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		if len(users) != 1 {
			t.Fatal("map was wrong length")
		}

		found1 := false
		found2 := false
		for _, user := range users {
			if user.Id == th.BasicUser.Id {
				found1 = true
			} else if user.Id == th.BasicUser2.Id {
				found2 = true
			}
		}

		if found1 {
			t.Fatal("should not have found profile")
		}
		if !found2 {
			t.Fatal("should have found profile")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser2.Username, TeamId: th.BasicTeam.Id, NotInChannelId: th.BasicChannel.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		if len(users) != 1 {
			t.Fatal("map was wrong length")
		}

		found1 := false
		found2 := false
		for _, user := range users {
			if user.Id == th.BasicUser.Id {
				found1 = true
			} else if user.Id == th.BasicUser2.Id {
				found2 = true
			}
		}

		if found1 {
			t.Fatal("should not have found profile")
		}
		if !found2 {
			t.Fatal("should have found profile")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username, TeamId: "junk", NotInChannelId: th.BasicChannel.Id}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		if len(users) != 0 {
			t.Fatal("map was wrong length")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	privacyEmailPrefix := strings.ToLower(model.NewId())
	privacyUser := &model.User{Email: privacyEmailPrefix + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", FirstName: model.NewId(), LastName: "Jimmers"}
	privacyUser = Client.Must(Client.CreateUser(privacyUser, "")).Data.(*model.User)
	th.LinkUserToTeam(privacyUser, th.BasicTeam)

	if result, err := Client.SearchUsers(model.UserSearch{Term: privacyUser.FirstName}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == privacyUser.Id {
				found = true
			}
		}

		if found {
			t.Fatal("should not have found profile")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })

	if result, err := Client.SearchUsers(model.UserSearch{Term: privacyUser.FirstName}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == privacyUser.Id {
				found = true
			}
		}

		if found {
			t.Fatal("should not have found profile")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = true })

	if result, err := Client.SearchUsers(model.UserSearch{Term: privacyUser.FirstName}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == privacyUser.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: privacyEmailPrefix}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == privacyUser.Id {
				found = true
			}
		}

		if found {
			t.Fatal("should not have found profile")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = true })

	if result, err := Client.SearchUsers(model.UserSearch{Term: privacyEmailPrefix}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == privacyUser.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	th.LoginBasic2()

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == th.BasicUser.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found profile")
		}
	}

	if _, err := Client.SearchUsers(model.UserSearch{}); err == nil {
		t.Fatal("should have errored - blank term")
	}

	if _, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username, InChannelId: th.BasicChannel.Id}); err == nil {
		t.Fatal("should not have access")
	}

	if _, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username, NotInChannelId: th.BasicChannel.Id}); err == nil {
		t.Fatal("should not have access")
	}

	userWithoutTeam := th.CreateUser(Client)
	if result, err := Client.SearchUsers(model.UserSearch{Term: userWithoutTeam.Username}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == userWithoutTeam.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found user without team")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: userWithoutTeam.Username, WithoutTeam: true}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == userWithoutTeam.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("should have found user without team")
		}
	}

	if result, err := Client.SearchUsers(model.UserSearch{Term: th.BasicUser.Username, WithoutTeam: true}); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)

		found := false
		for _, user := range users {
			if user.Id == th.BasicUser.Id {
				found = true
			}
		}

		if found {
			t.Fatal("should not have found user with team")
		}
	}
}

func TestAutocompleteUsers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	if result, err := Client.AutocompleteUsers(th.BasicUser.Username); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("should have returned 1 user in")
		}
	}

	if result, err := Client.AutocompleteUsers("amazonses"); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)
		if len(users) != 0 {
			t.Fatal("should have returned 0 users - email should not autocomplete")
		}
	}

	if result, err := Client.AutocompleteUsers(""); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)
		if len(users) == 0 {
			t.Fatal("should have many users")
		}
	}

	notInTeamUser := th.CreateUser(Client)

	if result, err := Client.AutocompleteUsers(notInTeamUser.Username); err != nil {
		t.Fatal(err)
	} else {
		users := result.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("should have returned 1 user in")
		}
	}

	if result, err := Client.AutocompleteUsersInTeam(notInTeamUser.Username); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInTeam)
		if len(autocomplete.InTeam) != 0 {
			t.Fatal("should have returned 0 users")
		}
	}

	if result, err := Client.AutocompleteUsersInTeam(th.BasicUser.Username); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInTeam)
		if len(autocomplete.InTeam) != 1 {
			t.Fatal("should have returned 1 user in")
		}
	}

	if result, err := Client.AutocompleteUsersInTeam(th.BasicUser.Username[0:5]); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInTeam)
		if len(autocomplete.InTeam) < 1 {
			t.Fatal("should have returned at least 1 user in")
		}
	}

	if result, err := Client.AutocompleteUsersInChannel(th.BasicUser.Username, th.BasicChannel.Id); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInChannel)
		if len(autocomplete.InChannel) != 1 {
			t.Fatal("should have returned 1 user in")
		}
		if len(autocomplete.OutOfChannel) != 0 {
			t.Fatal("should have returned no users out")
		}
	}

	if result, err := Client.AutocompleteUsersInChannel("", th.BasicChannel.Id); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInChannel)
		if len(autocomplete.InChannel) != 1 && autocomplete.InChannel[0].Id != th.BasicUser2.Id {
			t.Fatal("should have returned at 1 user in")
		}
		if len(autocomplete.OutOfChannel) != 1 && autocomplete.OutOfChannel[0].Id != th.BasicUser2.Id {
			t.Fatal("should have returned 1 user out")
		}
	}

	if result, err := Client.AutocompleteUsersInTeam(""); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInTeam)
		if len(autocomplete.InTeam) != 2 {
			t.Fatal("should have returned 2 users in")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	privacyUser := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", FirstName: model.NewId(), LastName: "Jimmers"}
	privacyUser = Client.Must(Client.CreateUser(privacyUser, "")).Data.(*model.User)
	th.LinkUserToTeam(privacyUser, th.BasicTeam)

	if result, err := Client.AutocompleteUsersInChannel(privacyUser.FirstName, th.BasicChannel.Id); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInChannel)
		if len(autocomplete.InChannel) != 0 {
			t.Fatal("should have returned no users")
		}
		if len(autocomplete.OutOfChannel) != 0 {
			t.Fatal("should have returned no users")
		}
	}

	if result, err := Client.AutocompleteUsersInTeam(privacyUser.FirstName); err != nil {
		t.Fatal(err)
	} else {
		autocomplete := result.Data.(*model.UserAutocompleteInTeam)
		if len(autocomplete.InTeam) != 0 {
			t.Fatal("should have returned no users")
		}
	}

	if _, err := Client.AutocompleteUsersInChannel("", "junk"); err == nil {
		t.Fatal("should have errored - bad channel id")
	}

	Client.SetTeamId("junk")
	if _, err := Client.AutocompleteUsersInChannel("", th.BasicChannel.Id); err == nil {
		t.Fatal("should have errored - bad team id")
	}

	if _, err := Client.AutocompleteUsersInTeam(""); err == nil {
		t.Fatal("should have errored - bad team id")
	}
}

func TestGetByUsername(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	if result, err := Client.GetByUsername(th.BasicUser.Username, ""); err != nil {
		t.Fatal("Failed to get user")
	} else {
		if result.Data.(*model.User).Password != "" {
			t.Fatal("User shouldn't have any password data once set")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	if result, err := Client.GetByUsername(th.BasicUser2.Username, ""); err != nil {
		t.Fatal(err)
	} else {
		u := result.Data.(*model.User)
		if u.Password != "" {
			t.Fatal("password must be empty")
		}
		if *u.AuthData != "" {
			t.Fatal("auth data must be empty")
		}
		if u.Email != "" {
			t.Fatal("email should be sanitized")
		}
	}

}

func TestGetByEmail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	if _, respMetdata := Client.GetByEmail(th.BasicUser.Email, ""); respMetdata.Error != nil {
		t.Fatal("Failed to get user by email")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowEmailAddress = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.PrivacySettings.ShowFullName = false })

	if user, respMetdata := Client.GetByEmail(th.BasicUser2.Email, ""); respMetdata.Error != nil {
		t.Fatal(respMetdata.Error)
	} else {
		if user.Password != "" {
			t.Fatal("password must be empty")
		}
		if *user.AuthData != "" {
			t.Fatal("auth data must be empty")
		}
		if user.Email != "" {
			t.Fatal("email should be sanitized")
		}
	}
}
