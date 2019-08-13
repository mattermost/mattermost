// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/testlib"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var ApiClient *model.Client4
var URL string

type TestHelper struct {
	App    *app.App
	Server *app.Server
	Web    *Web

	BasicUser    *model.User
	BasicChannel *model.Channel
	BasicTeam    *model.Team

	SystemAdminUser *model.User

	tempWorkspace string
}

func Setup() *TestHelper {
	store := mainHelper.GetStore()
	store.DropAllTables()

	memoryStore, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{IgnoreEnvironmentOverrides: true})
	if err != nil {
		panic("failed to initialize memory store: " + err.Error())
	}

	var options []app.Option
	options = append(options, app.ConfigStore(memoryStore))
	options = append(options, app.StoreOverride(mainHelper.Store))

	s, err := app.NewServer(options...)
	if err != nil {
		panic(err)
	}
	a := s.FakeApp()
	prevListenAddress := *a.Config().ServiceSettings.ListenAddress
	a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := s.Start()
	if serverErr != nil {
		panic(serverErr)
	}
	a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	// Disable strict password requirements for test
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false
	})

	web := New(s, s.AppOptions, s.Router)
	URL = fmt.Sprintf("http://localhost:%v", a.Srv.ListenAddr.Port)
	ApiClient = model.NewAPIv4Client(URL)

	a.DoAppMigrations()

	a.Srv.Store.MarkSystemRanUnitTests()

	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.EnableOpenServer = true
	})

	th := &TestHelper{
		App:    a,
		Server: s,
		Web:    web,
	}

	return th
}

func (th *TestHelper) InitPlugins() *TestHelper {

	if th.tempWorkspace == "" {
		th.tempWorkspace, _ = testlib.SetupTestResources()
	}

	pluginDir := filepath.Join(th.tempWorkspace, "plugins")
	webappDir := filepath.Join(th.tempWorkspace, "webapp")

	th.App.InitPlugins(pluginDir, webappDir)

	return th
}

func (th *TestHelper) InitBasic() *TestHelper {
	th.SystemAdminUser, _ = th.App.CreateUser(&model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", EmailVerified: true, Roles: model.SYSTEM_ADMIN_ROLE_ID})

	user, _ := th.App.CreateUser(&model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1", EmailVerified: true, Roles: model.SYSTEM_USER_ROLE_ID})

	team, _ := th.App.CreateTeam(&model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: user.Email, Type: model.TEAM_OPEN})

	th.App.JoinUserToTeam(team, user, "")

	channel, _ := th.App.CreateChannel(&model.Channel{DisplayName: "Test API Name", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id, CreatorId: user.Id}, true)

	th.BasicUser = user
	th.BasicChannel = channel
	th.BasicTeam = team

	return th
}

func (th *TestHelper) TearDown() {
	th.Server.Shutdown()
	if err := recover(); err != nil {
		panic(err)
	}
}

func TestPublicFilesRequest(t *testing.T) {
	th := Setup().InitPlugins()
	defer th.TearDown()

	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(th.App.NewPluginAPI, pluginDir, webappPluginDir, th.App.Log)
	require.NoError(t, err)

	pluginID := "com.mattermost.sample"
	pluginCode :=
		`
	package main

	import (
		"github.com/mattermost/mattermost-server/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	
	`
	// Compile and write the plugin
	backend := filepath.Join(pluginDir, pluginID, "backend.exe")
	utils.CompileGo(t, pluginCode, backend)

	// Write the plugin.json manifest
	pluginManifest := `{"id": "com.mattermost.sample", "server": {"executable": "backend.exe"}, "settings_schema": {"settings": []}}`
	ioutil.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(pluginManifest), 0600)

	// Write the test public file
	helloHTML := `Hello from the static files public folder for the com.mattermost.sample plugin!`
	htmlFolderPath := filepath.Join(pluginDir, pluginID, "public")
	os.MkdirAll(htmlFolderPath, os.ModePerm)
	htmlFilePath := filepath.Join(htmlFolderPath, "hello.html")

	htmlFileErr := ioutil.WriteFile(htmlFilePath, []byte(helloHTML), 0600)
	assert.NoError(t, htmlFileErr)

	nefariousHTML := `You shouldn't be able to get here!`
	htmlFileErr = ioutil.WriteFile(filepath.Join(pluginDir, pluginID, "nefarious-file-access.html"), []byte(nefariousHTML), 0600)
	assert.NoError(t, htmlFileErr)

	manifest, activated, reterr := env.Activate(pluginID)
	require.Nil(t, reterr)
	require.NotNil(t, manifest)
	require.True(t, activated)

	th.App.SetPluginsEnvironment(env)

	req, _ := http.NewRequest("GET", "/plugins/com.mattermost.sample/public/hello.html", nil)
	res := httptest.NewRecorder()
	th.Web.MainRouter.ServeHTTP(res, req)
	assert.Equal(t, helloHTML, res.Body.String())

	req, _ = http.NewRequest("GET", "/plugins/com.mattermost.sample/nefarious-file-access.html", nil)
	res = httptest.NewRecorder()
	th.Web.MainRouter.ServeHTTP(res, req)
	assert.Equal(t, 404, res.Code)

	req, _ = http.NewRequest("GET", "/plugins/com.mattermost.sample/public/../nefarious-file-access.html", nil)
	res = httptest.NewRecorder()
	th.Web.MainRouter.ServeHTTP(res, req)
	assert.Equal(t, 301, res.Code)
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
