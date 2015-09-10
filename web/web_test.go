// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

var ApiClient *model.Client
var URL string

func Setup() {
	if api.Srv == nil {
		utils.LoadConfig("config.json")
		api.NewServer()
		api.StartServer()
		api.InitApi()
		InitWeb()
		URL = "http://localhost:" + utils.Cfg.ServiceSettings.Port
		ApiClient = model.NewClient(URL, URL+"/api/v1")
	}
}

func TearDown() {
	if api.Srv != nil {
		api.StopServer()
	}
}

func TestStatic(t *testing.T) {
	Setup()

	resp, _ := http.Get(URL + "/static/images/favicon.ico")

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("couldn't get static files %v", resp.StatusCode)
	}
}

func TestGetAccessToken(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := ApiClient.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Password: "pwd"}
	ruser := ApiClient.Must(ApiClient.CreateUser(&user, "")).Data.(*model.User)
	store.Must(api.Srv.Store.User().VerifyEmail(ruser.Id))

	app := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		data := url.Values{"grant_type": []string{"junk"}, "client_id": []string{"12345678901234567890123456"}, "client_secret": []string{"12345678901234567890123456"}, "code": []string{"junk"}, "redirect_uri": []string{app.CallbackUrls[0]}}

		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}
	} else {

		ApiClient.Must(ApiClient.LoginById(ruser.Id, "pwd"))
		app = ApiClient.Must(ApiClient.RegisterApp(app)).Data.(*model.OAuthApp)

		redirect := ApiClient.Must(ApiClient.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, app.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
		rurl, _ := url.Parse(redirect)

		ApiClient.Logout()

		data := url.Values{"grant_type": []string{"junk"}, "client_id": []string{app.Id}, "client_secret": []string{app.ClientSecret}, "code": []string{rurl.Query().Get("code")}, "redirect_uri": []string{app.CallbackUrls[0]}}

		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - bad grant type")
		}

		data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
		data.Set("client_id", "")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - missing client id")
		}
		data.Set("client_id", "junk")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - bad client id")
		}

		data.Set("client_id", app.Id)
		data.Set("client_secret", "")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - missing client secret")
		}

		data.Set("client_secret", "junk")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - bad client secret")
		}

		data.Set("client_secret", app.ClientSecret)
		data.Set("code", "")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - missing code")
		}

		data.Set("code", "junk")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - bad code")
		}

		data.Set("code", rurl.Query().Get("code"))
		data.Set("redirect_uri", "junk")
		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - non-matching redirect uri")
		}

		// reset data for successful request
		data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
		data.Set("client_id", app.Id)
		data.Set("client_secret", app.ClientSecret)
		data.Set("code", rurl.Query().Get("code"))
		data.Set("redirect_uri", app.CallbackUrls[0])

		token := ""
		if result, err := ApiClient.GetAccessToken(data); err != nil {
			t.Fatal(err)
		} else {
			rsp := result.Data.(*model.AccessResponse)
			if len(rsp.AccessToken) == 0 {
				t.Fatal("access token not returned")
			} else {
				token = rsp.AccessToken
			}
			if rsp.TokenType != model.ACCESS_TOKEN_TYPE {
				t.Fatal("access token type incorrect")
			}
		}

		if result, err := ApiClient.DoApiGet("/users/profiles?access_token="+token, "", ""); err != nil {
			t.Fatal(err)
		} else {
			userMap := model.UserMapFromJson(result.Body)
			if len(userMap) == 0 {
				t.Fatal("user map empty - did not get results correctly")
			}
		}

		if _, err := ApiClient.DoApiGet("/users/profiles", "", ""); err == nil {
			t.Fatal("should have failed - no access token provided")
		}

		if _, err := ApiClient.DoApiGet("/users/profiles?access_token=junk", "", ""); err == nil {
			t.Fatal("should have failed - bad access token provided")
		}

		ApiClient.SetOAuthToken(token)
		if result, err := ApiClient.DoApiGet("/users/profiles", "", ""); err != nil {
			t.Fatal(err)
		} else {
			userMap := model.UserMapFromJson(result.Body)
			if len(userMap) == 0 {
				t.Fatal("user map empty - did not get results correctly")
			}
		}

		if _, err := ApiClient.GetAccessToken(data); err == nil {
			t.Fatal("should have failed - tried to reuse auth code")
		}

		ApiClient.ClearOAuthToken()
	}
}

func TestZZWebTearDown(t *testing.T) {
	// *IMPORTANT*
	// This should be the last function in any test file
	// that calls Setup()
	// Should be in the last file too sorted by name
	time.Sleep(2 * time.Second)
	TearDown()
}
