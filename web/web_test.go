// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

var ApiClient *model.Client
var URL string

func Setup() {
	if app.Srv == nil {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		utils.InitTranslations(utils.Cfg.LocalizationSettings)
		app.NewServer()
		app.InitStores()
		api.InitRouter()
		app.StartServer()
		api.InitApi()
		InitWeb()
		URL = "http://localhost" + utils.Cfg.ServiceSettings.ListenAddress
		ApiClient = model.NewClient(URL)

		app.Srv.Store.MarkSystemRanUnitTests()

		*utils.Cfg.TeamSettings.EnableOpenServer = true
	}
}

func TearDown() {
	if app.Srv != nil {
		app.StopServer()
	}
}

/* Test disabled for now so we don't requrie the client to build. Maybe re-enable after client gets moved out.
func TestStatic(t *testing.T) {
	Setup()

	// add a short delay to make sure the server is ready to receive requests
	time.Sleep(1 * time.Second)

	resp, err := http.Get(URL + "/static/root.html")

	if err != nil {
		t.Fatalf("got error while trying to get static files %v", err)
	} else if resp.StatusCode != http.StatusOK {
		t.Fatalf("couldn't get static files %v", resp.StatusCode)
	}
}
*/

func TestGetAccessToken(t *testing.T) {
	Setup()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Password: "passwd1"}
	ruser := ApiClient.Must(ApiClient.CreateUser(&user, "")).Data.(*model.User)
	store.Must(app.Srv.Store.User().VerifyEmail(ruser.Id))

	ApiClient.Must(ApiClient.LoginById(ruser.Id, "passwd1"))

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := ApiClient.CreateTeam(&team)

	oauthApp := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	utils.Cfg.ServiceSettings.EnableOAuthServiceProvider = false
	data := url.Values{"grant_type": []string{"junk"}, "client_id": []string{"12345678901234567890123456"}, "client_secret": []string{"12345678901234567890123456"}, "code": []string{"junk"}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	if _, err := ApiClient.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - oauth providing turned off")
	}
	utils.Cfg.ServiceSettings.EnableOAuthServiceProvider = true

	ApiClient.Must(ApiClient.LoginById(ruser.Id, "passwd1"))
	ApiClient.SetTeamId(rteam.Data.(*model.Team).Id)
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	utils.SetDefaultRolesBasedOnConfig()
	oauthApp = ApiClient.Must(ApiClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

	redirect := ApiClient.Must(ApiClient.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ := url.Parse(redirect)

	teamId := rteam.Data.(*model.Team).Id

	ApiClient.Logout()

	data = url.Values{"grant_type": []string{"junk"}, "client_id": []string{oauthApp.Id}, "client_secret": []string{oauthApp.ClientSecret}, "code": []string{rurl.Query().Get("code")}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

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

	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", "")
	if _, err := ApiClient.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing client secret")
	}

	data.Set("client_secret", "junk")
	if _, err := ApiClient.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad client secret")
	}

	data.Set("client_secret", oauthApp.ClientSecret)
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
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("code", rurl.Query().Get("code"))
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])

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

	if result, err := ApiClient.DoApiGet("/teams/"+teamId+"/users/0/100?access_token="+token, "", ""); err != nil {
		t.Fatal(err)
	} else {
		userMap := model.UserMapFromJson(result.Body)
		if len(userMap) == 0 {
			t.Fatal("user map empty - did not get results correctly")
		}
	}

	if _, err := ApiClient.DoApiGet("/teams/"+teamId+"/users/0/100", "", ""); err == nil {
		t.Fatal("should have failed - no access token provided")
	}

	if _, err := ApiClient.DoApiGet("/teams/"+teamId+"/users/0/100?access_token=junk", "", ""); err == nil {
		t.Fatal("should have failed - bad access token provided")
	}

	ApiClient.SetOAuthToken(token)
	if result, err := ApiClient.DoApiGet("/teams/"+teamId+"/users/0/100", "", ""); err != nil {
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

func TestIncomingWebhook(t *testing.T) {
	Setup()

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = ApiClient.Must(ApiClient.CreateUser(user, "")).Data.(*model.User)
	store.Must(app.Srv.Store.User().VerifyEmail(user.Id))

	ApiClient.Login(user.Email, "passwd1")

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = ApiClient.Must(ApiClient.CreateTeam(team)).Data.(*model.Team)

	app.JoinUserToTeam(team, user)

	app.UpdateUserRoles(user.Id, model.ROLE_SYSTEM_ADMIN.Id)
	ApiClient.SetTeamId(team.Id)

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = ApiClient.Must(ApiClient.CreateChannel(channel1)).Data.(*model.Channel)

	if utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		hook1 := &model.IncomingWebhook{ChannelId: channel1.Id}
		hook1 = ApiClient.Must(ApiClient.CreateIncomingWebhook(hook1)).Data.(*model.IncomingWebhook)

		payload := "payload={\"text\": \"test text\"}"
		if _, err := ApiClient.PostToWebhook(hook1.Id, payload); err != nil {
			t.Fatal(err)
		}

		payload = "payload={\"text\": \"\"}"
		if _, err := ApiClient.PostToWebhook(hook1.Id, payload); err == nil {
			t.Fatal("should have errored - no text to post")
		}

		payload = "payload={\"text\": \"test text\", \"channel\": \"junk\"}"
		if _, err := ApiClient.PostToWebhook(hook1.Id, payload); err == nil {
			t.Fatal("should have errored - bad channel")
		}

		payload = "payload={\"text\": \"test text\"}"
		if _, err := ApiClient.PostToWebhook("abc123", payload); err == nil {
			t.Fatal("should have errored - bad hook")
		}
	} else {
		if _, err := ApiClient.PostToWebhook("123", "123"); err == nil {
			t.Fatal("should have failed - webhooks turned off")
		}
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
