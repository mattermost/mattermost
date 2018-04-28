// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"fmt"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

var ApiClient *model.Client
var URL string

type persistentTestStore struct {
	store.Store
}

func (*persistentTestStore) Close() {}

var testStoreContainer *storetest.RunningContainer
var testStore *persistentTestStore

func StopTestStore() {
	if testStoreContainer != nil {
		testStoreContainer.Stop()
		testStoreContainer = nil
	}
}

func Setup() *app.App {
	a, err := app.New(app.StoreOverride(testStore), app.DisableConfigWatch)
	if err != nil {
		panic(err)
	}
	prevListenAddress := *a.Config().ServiceSettings.ListenAddress
	a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := a.StartServer()
	if serverErr != nil {
		panic(serverErr)
	}
	a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })
	api4.Init(a, a.Srv.Router, false)
	api3 := api.Init(a, a.Srv.Router)
	Init(api3)
	URL = fmt.Sprintf("http://localhost:%v", a.Srv.ListenAddr.Port)
	ApiClient = model.NewClient(URL)

	a.DoAdvancedPermissionsMigration()

	a.Srv.Store.MarkSystemRanUnitTests()

	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableOpenServer = true
		*cfg.ServiceSettings.EnableAPIv3 = true
	})

	return a
}

func TearDown(a *app.App) {
	a.Shutdown()
	if err := recover(); err != nil {
		StopTestStore()
		panic(err)
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

	a.UpdateUserRoles(user.Id, model.SYSTEM_ADMIN_ROLE_ID, false)
	ApiClient.SetTeamId(team.Id)

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = ApiClient.Must(ApiClient.CreateChannel(channel1)).Data.(*model.Channel)

	if a.Config().ServiceSettings.EnableIncomingWebhooks {
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

		payloadMultiPart := "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\nwebhook-bot\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nthis is a test :tada:\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"
		if _, err := ApiClient.DoPost("/hooks/"+hook1.Id, payloadMultiPart, "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW"); err != nil {
			t.Fatal("should have errored - bad hook")
		}

	} else {
		if _, err := ApiClient.PostToWebhook("123", "123"); err == nil {
			t.Fatal("should have failed - webhooks turned off")
		}
	}
}

func TestMain(m *testing.M) {
	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing. Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	utils.TranslationsPreInit()

	status := 0

	container, settings, err := storetest.NewPostgreSQLContainer()
	if err != nil {
		panic(err)
	}

	testStoreContainer = container
	testStore = &persistentTestStore{store.NewLayeredStore(sqlstore.NewSqlSupplier(*settings, nil), nil, nil)}

	defer func() {
		StopTestStore()
		os.Exit(status)
	}()

	status = m.Run()

}

func TestCheckClientCompatability(t *testing.T) {
	//Browser Name, UA String, expected result (if the browser should fail the test false and if it should pass the true)
	type uaTest struct {
		Name      string // Name of Browser
		UserAgent string // Useragent of Browser
		Result    bool   // Expected result (true if browser should be compatible, false if browser shouldn't be compatible)
	}
	var uaTestParameters = []uaTest{
		{"Mozilla 40.1", "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1", true},
		{"Chrome 60", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36", true},
		{"Chrome Mobile", "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Mobile Safari/537.36", true},
		{"MM Classic App", "Mozilla/5.0 (Linux; Android 8.0.0; Nexus 5X Build/OPR6.170623.013; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/61.0.3163.81 Mobile Safari/537.36 Web-Atoms-Mobile-WebView", true},
		{"MM App 3.7.1", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36", true},
		{"Franz 4.0.4", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Franz/4.0.4 Chrome/52.0.2743.82 Electron/1.3.1 Safari/537.36", true},
		{"Edge 14", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393", true},
		{"Internet Explorer 9", "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 7.1; Trident/5.0", false},
		{"Internet Explorer 11", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko", true},
		{"Internet Explorer 11 2", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; Zoom 3.6.0; rv:11.0) like Gecko", true},
		{"Internet Explorer 11 (Compatibility Mode) 1", "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; .NET CLR 1.1.4322; InfoPath.3; Zoom 3.6.0)", false},
		{"Internet Explorer 11 (Compatibility Mode) 2", "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; Zoom 3.6.0)", false},
		{"Safari 9", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Safari/604.1.38", true},
		{"Safari 8", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/8.0.7 Safari/600.7.12", false},
		{"Safari Mobile", "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B137 Safari/601.1", true},
	}
	for _, browser := range uaTestParameters {
		t.Run(browser.Name, func(t *testing.T) {
			if result := CheckClientCompatability(browser.UserAgent); result != browser.Result {
				t.Fatalf("%s User Agent Test failed!", browser.Name)
			}
		})
	}
}
