// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mssola/user_agent"
)

var ApiClient *model.Client
var URL string

func Setup() *app.App {
	a := app.Global()
	if a.Srv == nil {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		utils.InitTranslations(utils.Cfg.LocalizationSettings)
		a.NewServer()
		a.InitStores()
		a.Srv.Router = api.NewRouter()
		a.StartServer()
		api4.InitApi(a.Srv.Router, false)
		api.InitApi(a.Srv.Router)
		InitWeb()
		URL = "http://localhost" + *utils.Cfg.ServiceSettings.ListenAddress
		ApiClient = model.NewClient(URL)

		a.Srv.Store.MarkSystemRanUnitTests()

		*utils.Cfg.TeamSettings.EnableOpenServer = true
	}
	return a
}

func TearDown(a *app.App) {
	if a.Srv != nil {
		a.StopServer()
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

func TestIncomingWebhook(t *testing.T) {
	a := Setup()
	defer TearDown(a)

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = ApiClient.Must(ApiClient.CreateUser(user, "")).Data.(*model.User)
	store.Must(a.Srv.Store.User().VerifyEmail(user.Id))

	ApiClient.Login(user.Email, "passwd1")

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = ApiClient.Must(ApiClient.CreateTeam(team)).Data.(*model.Team)

	a.JoinUserToTeam(team, user, "")

	a.UpdateUserRoles(user.Id, model.ROLE_SYSTEM_ADMIN.Id)
	ApiClient.SetTeamId(team.Id)

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
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

func TestCheckBrowserCompatability(t *testing.T) {

	//test should fail browser compatibility check with Mozilla FF 40.1
	ua := "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1"
	t.Logf("Checking Mozzila 40.1 with U.A. String: \n%v", ua)
	if result := CheckBrowserCompatability(user_agent.New(ua)); result == true {
		t.Error("Fail: should have failed browser compatibility")
	} else {
		t.Log("Pass: User Agent correctly failed!")
	}

	ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36"
	t.Logf("Checking Chrome 60 with U.A. String: \n%v", ua)
	if result := CheckBrowserCompatability(user_agent.New(ua)); result == false {
		t.Error("Fail: should have passed browser compatibility")
	} else {
		t.Log("Pass: User Agent correctly passed!")
	}

	ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393"
	t.Logf("Checking Edge 14.14393 with U.A. String: \n%v", ua)
	if result := CheckBrowserCompatability(user_agent.New(ua)); result == true {
		t.Log("Warning: Edge should have failed browser compatibility. It is probably still detecting as Chrome.")
	} else {
		t.Log("Pass: User Agent correctly failed!")
	}
}
