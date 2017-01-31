// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

type TestHelper struct {
	Client          *model.Client4
	BasicUser       *model.User
	SystemAdminUser *model.User
}

func Setup() *TestHelper {
	if app.Srv == nil {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		utils.InitTranslations(utils.Cfg.LocalizationSettings)
		utils.Cfg.TeamSettings.MaxUsersPerTeam = 50
		*utils.Cfg.RateLimitSettings.Enable = false
		utils.Cfg.EmailSettings.SendEmailNotifications = true
		utils.Cfg.EmailSettings.SMTPServer = "dockerhost"
		utils.Cfg.EmailSettings.SMTPPort = "2500"
		utils.Cfg.EmailSettings.FeedbackEmail = "test@example.com"
		utils.DisableDebugLogForTest()
		app.NewServer()
		app.InitStores()
		InitRouter()
		app.StartServer()
		InitApi(true)
		utils.EnableDebugLogForTest()
		app.Srv.Store.MarkSystemRanUnitTests()

		*utils.Cfg.TeamSettings.EnableOpenServer = true
	}

	th := &TestHelper{}
	th.Client = th.CreateClient()
	return th
}

func (me *TestHelper) InitBasic() *TestHelper {
	me.BasicUser = me.CreateUser()
	app.UpdateUserRoles(me.BasicUser.Id, model.ROLE_SYSTEM_USER.Id)
	me.LoginBasic()

	return me
}

func (me *TestHelper) InitSystemAdmin() *TestHelper {
	me.SystemAdminUser = me.CreateUser()
	app.UpdateUserRoles(me.SystemAdminUser.Id, model.ROLE_SYSTEM_USER.Id+" "+model.ROLE_SYSTEM_ADMIN.Id)

	return me
}

func (me *TestHelper) CreateClient() *model.Client4 {
	return model.NewAPIv4Client("http://localhost" + utils.Cfg.ServiceSettings.ListenAddress)
}

func (me *TestHelper) CreateUser() *model.User {
	id := model.NewId()

	user := &model.User{
		Email:     GenerateTestEmail(),
		Username:  GenerateTestUsername(),
		Nickname:  "nn_" + id,
		FirstName: "f_" + id,
		LastName:  "l_" + id,
		Password:  "Password1",
	}

	utils.DisableDebugLogForTest()
	ruser, _ := me.Client.CreateUser(user)
	ruser.Password = "Password1"
	VerifyUserEmail(ruser.Id)
	utils.EnableDebugLogForTest()
	return ruser
}

func (me *TestHelper) LoginBasic() {
	utils.DisableDebugLogForTest()
	me.Client.Login(me.BasicUser.Email, me.BasicUser.Password)
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginSystemAdmin() {
	utils.DisableDebugLogForTest()
	me.Client.Login(me.SystemAdminUser.Email, me.SystemAdminUser.Password)
	utils.EnableDebugLogForTest()
}

func GenerateTestEmail() string {
	return strings.ToLower("success+" + model.NewId() + "@simulator.amazonses.com")
}

func GenerateTestUsername() string {
	return "n" + model.NewId()
}

func VerifyUserEmail(userId string) {
	store.Must(app.Srv.Store.User().VerifyEmail(userId))
}

func CheckUserSanitization(t *testing.T, user *model.User) {
	if user.Password != "" {
		t.Fatal("password wasn't blank")
	}

	if user.AuthData != nil && *user.AuthData != "" {
		t.Fatal("auth data wasn't blank")
	}

	if user.MfaSecret != "" {
		t.Fatal("mfa secret wasn't blank")
	}
}

func CheckEtag(t *testing.T, data interface{}, resp *model.Response) {
	if !reflect.ValueOf(data).IsNil() {
		t.Fatal("etag data was not nil")
	}

	if resp.StatusCode != http.StatusNotModified {
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusNotModified))
		t.Fatal("wrong status code for etag")
	}
}

func CheckNoError(t *testing.T, resp *model.Response) {
	if resp.Error != nil {
		t.Fatal(resp.Error)
	}
}

func CheckForbiddenStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusForbidden))
		return
	}

	if resp.StatusCode != http.StatusForbidden {
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusForbidden))
		t.Fatal("wrong status code")
	}
}

func CheckUnauthorizedStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusUnauthorized))
		return
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusUnauthorized))
		t.Fatal("wrong status code")
	}
}

func CheckNotFoundStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusNotFound))
		return
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusNotFound))
		t.Fatal("wrong status code")
	}
}

func CheckBadRequestStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusBadRequest))
		return
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
		t.Fatal("wrong status code")
	}
}

func CheckErrorMessage(t *testing.T, resp *model.Response, message string) {
	if resp.Error == nil {
		t.Fatal("should have errored with message:" + message)
		return
	}

	if resp.Error.Message != message {
		t.Log("actual: " + resp.Error.Message)
		t.Log("expected: " + message)
		t.Fatal("incorrect error message")
	}
}
