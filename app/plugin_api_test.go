// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getDefaultPluginSettingsSchema() string {
	ret, _ := json.Marshal(model.PluginSettingsSchema{
		Settings: []*model.PluginSetting{
			{Key: "BasicChannelName", Type: "text"},
			{Key: "BasicChannelId", Type: "text"},
			{Key: "BasicTeamDisplayName", Type: "text"},
			{Key: "BasicTeamName", Type: "text"},
			{Key: "BasicTeamId", Type: "text"},
			{Key: "BasicUserEmail", Type: "text"},
			{Key: "BasicUserId", Type: "text"},
			{Key: "BasicUser2Email", Type: "text"},
			{Key: "BasicUser2Id", Type: "text"},
			{Key: "BasicPostMessage", Type: "text"},
		},
	})
	return string(ret)
}

func setDefaultPluginConfig(th *TestHelper, pluginId string) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins[pluginId] = map[string]interface{}{
			"BasicChannelName":     th.BasicChannel.Name,
			"BasicChannelId":       th.BasicChannel.Id,
			"BasicTeamName":        th.BasicTeam.Name,
			"BasicTeamId":          th.BasicTeam.Id,
			"BasicTeamDisplayName": th.BasicTeam.DisplayName,
			"BasicUserEmail":       th.BasicUser.Email,
			"BasicUserId":          th.BasicUser.Id,
			"BasicUser2Email":      th.BasicUser2.Email,
			"BasicUser2Id":         th.BasicUser2.Id,
			"BasicPostMessage":     th.BasicPost.Message,
		}
	})
}

func setupMultiPluginApiTest(t *testing.T, pluginCodes []string, pluginManifests []string, pluginIds []string, app *App) string {
	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(app.NewPluginAPI, pluginDir, webappPluginDir, app.Log)
	require.NoError(t, err)

	require.Equal(t, len(pluginCodes), len(pluginIds))
	require.Equal(t, len(pluginManifests), len(pluginIds))

	for i, pluginId := range pluginIds {
		backend := filepath.Join(pluginDir, pluginId, "backend.exe")
		utils.CompileGo(t, pluginCodes[i], backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(pluginManifests[i]), 0600)
		manifest, activated, reterr := env.Activate(pluginId)
		require.Nil(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)
	}

	app.SetPluginsEnvironment(env)

	return pluginDir
}

func setupPluginApiTest(t *testing.T, pluginCode string, pluginManifest string, pluginId string, app *App) string {
	return setupMultiPluginApiTest(t, []string{pluginCode}, []string{pluginManifest}, []string{pluginId}, app)
}

func TestPublicFilesPathConfiguration(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	pluginID := "com.mattermost.sample"

	pluginDir := setupPluginApiTest(t,
		`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
		`{"id": "com.mattermost.sample", "server": {"executable": "backend.exe"}, "settings_schema": {"settings": []}}`, pluginID, th.App)

	publicFilesFolderInTest := filepath.Join(pluginDir, pluginID, "public")
	publicFilesPath, err := th.App.GetPluginsEnvironment().PublicFilesPath(pluginID)
	assert.NoError(t, err)
	assert.Equal(t, publicFilesPath, publicFilesFolderInTest)
}
func TestPluginAPIGetUsers(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user1)

	user2, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user2" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user2)

	user3, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user3" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user3)

	user4, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user4" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user4)

	testCases := []struct {
		Description   string
		Page          int
		PerPage       int
		ExpectedUsers []*model.User
	}{
		{
			"page 0, perPage 0",
			0,
			0,
			[]*model.User{},
		},
		{
			"page 0, perPage 10",
			0,
			10,
			[]*model.User{user1, user2, user3, user4},
		},
		{
			"page 0, perPage 2",
			0,
			2,
			[]*model.User{user1, user2},
		},
		{
			"page 1, perPage 2",
			1,
			2,
			[]*model.User{user3, user4},
		},
		{
			"page 10, perPage 10",
			10,
			10,
			[]*model.User{},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := api.GetUsers(&model.UserGetOptions{
				Page:    testCase.Page,
				PerPage: testCase.PerPage,
			})
			assert.Nil(t, err)
			assert.Equal(t, testCase.ExpectedUsers, users)
		})
	}
}

func TestPluginAPIGetUsersInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	team1 := th.CreateTeam()
	team2 := th.CreateTeam()

	user1, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user1)

	user2, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user2" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user2)

	user3, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user3" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user3)

	user4, err := th.App.CreateUser(&model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user4" + model.NewId(),
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteUser(user4)

	// Add all users to team 1
	_, _, err = th.App.joinUserToTeam(team1, user1)
	require.Nil(t, err)
	_, _, err = th.App.joinUserToTeam(team1, user2)
	require.Nil(t, err)
	_, _, err = th.App.joinUserToTeam(team1, user3)
	require.Nil(t, err)
	_, _, err = th.App.joinUserToTeam(team1, user4)
	require.Nil(t, err)

	// Add only user3 and user4 to team 2
	_, _, err = th.App.joinUserToTeam(team2, user3)
	require.Nil(t, err)
	_, _, err = th.App.joinUserToTeam(team2, user4)
	require.Nil(t, err)

	testCases := []struct {
		Description   string
		TeamId        string
		Page          int
		PerPage       int
		ExpectedUsers []*model.User
	}{
		{
			"unknown team",
			model.NewId(),
			0,
			0,
			[]*model.User{},
		},
		{
			"team 1, page 0, perPage 10",
			team1.Id,
			0,
			10,
			[]*model.User{user1, user2, user3, user4},
		},
		{
			"team 1, page 0, perPage 2",
			team1.Id,
			0,
			2,
			[]*model.User{user1, user2},
		},
		{
			"team 1, page 1, perPage 2",
			team1.Id,
			1,
			2,
			[]*model.User{user3, user4},
		},
		{
			"team 2, page 0, perPage 10",
			team2.Id,
			0,
			10,
			[]*model.User{user3, user4},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := api.GetUsersInTeam(testCase.TeamId, testCase.Page, testCase.PerPage)
			assert.Nil(t, err)
			assert.Equal(t, testCase.ExpectedUsers, users)
		})
	}
}

func TestPluginAPIGetFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// check a valid file first
	uploadTime := time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local)
	filename := "testGetFile"
	fileData := []byte("Hello World")
	info, err := th.App.DoUploadFile(uploadTime, th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, filename, fileData)
	require.Nil(t, err)
	defer func() {
		th.App.Srv.Store.FileInfo().PermanentDelete(info.Id)
		th.App.RemoveFile(info.Path)
	}()

	data, err1 := api.GetFile(info.Id)
	require.Nil(t, err1)
	assert.Equal(t, data, fileData)

	// then checking invalid file
	data, err = api.GetFile("../fake/testingApi")
	require.NotNil(t, err)
	require.Nil(t, data)
}

func TestPluginAPISavePluginConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	manifest := &model.Manifest{
		Id: "pluginid",
		SettingsSchema: &model.PluginSettingsSchema{
			Settings: []*model.PluginSetting{
				{Key: "MyStringSetting", Type: "text"},
				{Key: "MyIntSetting", Type: "text"},
				{Key: "MyBoolSetting", Type: "bool"},
			},
		},
	}

	api := NewPluginAPI(th.App, manifest)

	pluginConfigJsonString := `{"mystringsetting": "str", "MyIntSetting": 32, "myboolsetting": true}`

	var pluginConfig map[string]interface{}
	err := json.Unmarshal([]byte(pluginConfigJsonString), &pluginConfig)
	require.NoError(t, err)

	appErr := api.SavePluginConfig(pluginConfig)
	require.Nil(t, appErr)

	type Configuration struct {
		MyStringSetting string
		MyIntSetting    int
		MyBoolSetting   bool
	}

	savedConfiguration := new(Configuration)
	err = api.LoadPluginConfiguration(savedConfiguration)
	require.NoError(t, err)

	expectedConfiguration := new(Configuration)
	err = json.Unmarshal([]byte(pluginConfigJsonString), &expectedConfiguration)
	require.NoError(t, err)

	assert.Equal(t, expectedConfiguration, savedConfiguration)
}

func TestPluginAPIGetPluginConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	manifest := &model.Manifest{
		Id: "pluginid",
		SettingsSchema: &model.PluginSettingsSchema{
			Settings: []*model.PluginSetting{
				{Key: "MyStringSetting", Type: "text"},
				{Key: "MyIntSetting", Type: "text"},
				{Key: "MyBoolSetting", Type: "bool"},
			},
		},
	}

	api := NewPluginAPI(th.App, manifest)

	pluginConfigJsonString := `{"mystringsetting": "str", "myintsetting": 32, "myboolsetting": true}`
	var pluginConfig map[string]interface{}

	err := json.Unmarshal([]byte(pluginConfigJsonString), &pluginConfig)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["pluginid"] = pluginConfig
	})

	savedPluginConfig := api.GetPluginConfig()
	assert.Equal(t, pluginConfig, savedPluginConfig)
}

func TestPluginAPILoadPluginConfiguration(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var pluginJson map[string]interface{}
	err := json.Unmarshal([]byte(`{"mystringsetting": "str", "MyIntSetting": 32, "myboolsetting": true}`), &pluginJson)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})

	testFolder, found := fileutils.FindDir("mattermost-server/app/plugin_api_tests")
	require.True(t, found, "Cannot find tests folder")
	fullPath := path.Join(testFolder, "manual.test_load_configuration_plugin", "main.go")

	err = pluginAPIHookTest(t, th, fullPath, "testloadpluginconfig", `{"id": "testloadpluginconfig", "backend": {"executable": "backend.exe"}, "settings_schema": {
		"settings": [
			{
				"key": "MyStringSetting",
				"type": "text"
			},
			{
				"key": "MyIntSetting",
				"type": "text"
			},
			{
				"key": "MyBoolSetting",
				"type": "bool"
			}
		]
	}}`)
	require.NoError(t, err)

}

func TestPluginAPILoadPluginConfigurationDefaults(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var pluginJson map[string]interface{}
	err := json.Unmarshal([]byte(`{"mystringsetting": "override"}`), &pluginJson)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})

	testFolder, found := fileutils.FindDir("mattermost-server/app/plugin_api_tests")
	require.True(t, found, "Cannot find tests folder")
	fullPath := path.Join(testFolder, "manual.test_load_configuration_defaults_plugin", "main.go")

	err = pluginAPIHookTest(t, th, fullPath, "testloadpluginconfig", `{
		"settings": [
			{
				"key": "MyStringSetting",
				"type": "text",
				"default": "notthis"
			},
			{
				"key": "MyIntSetting",
				"type": "text",
				"default": 35
			},
			{
				"key": "MyBoolSetting",
				"type": "bool",
				"default": true
			}
		]
	}`)

	require.NoError(t, err)

}

func TestPluginAPIGetPlugins(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	pluginCode := `
    package main

    import (
      "github.com/mattermost/mattermost-server/v5/plugin"
    )

    type MyPlugin struct {
      plugin.MattermostPlugin
    }

    func main() {
      plugin.ClientMain(&MyPlugin{})
    }
  `

	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(th.App.NewPluginAPI, pluginDir, webappPluginDir, th.App.Log)
	require.NoError(t, err)

	pluginIDs := []string{"pluginid1", "pluginid2", "pluginid3"}
	var pluginManifests []*model.Manifest
	for _, pluginID := range pluginIDs {
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		utils.CompileGo(t, pluginCode, backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(fmt.Sprintf(`{"id": "%s", "server": {"executable": "backend.exe"}}`, pluginID)), 0600)
		manifest, activated, reterr := env.Activate(pluginID)

		require.Nil(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)
		pluginManifests = append(pluginManifests, manifest)
	}
	th.App.SetPluginsEnvironment(env)

	// Deactivate the last one for testing
	success := env.Deactivate(pluginIDs[len(pluginIDs)-1])
	require.True(t, success)

	// check existing user first
	plugins, err := api.GetPlugins()
	assert.Nil(t, err)
	assert.NotEmpty(t, plugins)
	assert.Equal(t, pluginManifests, plugins)
}

func TestPluginAPIInstallPlugin(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	_, err = api.InstallPlugin(bytes.NewReader(tarData), true)
	assert.NotNil(t, err, "should not allow upload if upload disabled")
	assert.Equal(t, err.Error(), "installPlugin: Plugins and/or plugin uploads have been disabled., ")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})

	manifest, err := api.InstallPlugin(bytes.NewReader(tarData), true)
	defer os.RemoveAll("plugins/testplugin")
	require.Nil(t, err)
	assert.Equal(t, "testplugin", manifest.Id)

	// Successfully installed
	pluginsResp, err := api.GetPlugins()
	require.Nil(t, err)

	found := false
	for _, m := range pluginsResp {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.True(t, found)
}

func TestInstallPlugin(t *testing.T) {
	// TODO(ilgooz): remove this setup func to use existent setupPluginApiTest().
	// following setupTest() func is a modified version of setupPluginApiTest().
	// we need a modified version of setupPluginApiTest() because it wasn't possible to use it directly here
	// since it removes plugin dirs right after it returns, does not update App configs with the plugin
	// dirs and this behavior tends to break this test as a result.
	setupTest := func(t *testing.T, pluginCode string, pluginManifest string, pluginID string, app *App) (func(), string) {
		pluginDir, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		webappPluginDir, err := ioutil.TempDir("", "")
		require.NoError(t, err)

		app.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Directory = pluginDir
			*cfg.PluginSettings.ClientDirectory = webappPluginDir
		})

		env, err := plugin.NewEnvironment(app.NewPluginAPI, pluginDir, webappPluginDir, app.Log)
		require.NoError(t, err)

		app.SetPluginsEnvironment(env)

		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		utils.CompileGo(t, pluginCode, backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(pluginManifest), 0600)
		manifest, activated, reterr := env.Activate(pluginID)
		require.Nil(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)

		return func() {
			os.RemoveAll(pluginDir)
			os.RemoveAll(webappPluginDir)
		}, pluginDir
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	// start an http server to serve plugin's tarball to the test.
	path, _ := fileutils.FindDir("tests")
	ts := httptest.NewServer(http.FileServer(http.Dir(path)))
	defer ts.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		cfg.PluginSettings.Plugins["testinstallplugin"] = map[string]interface{}{
			"DownloadURL": ts.URL + "/testplugin.tar.gz",
		}
	})

	tearDown, _ := setupTest(t,
		`
		package main

		import (
			"net/http"
			
			"github.com/pkg/errors"

			"github.com/mattermost/mattermost-server/v5/plugin"
		)

		type configuration struct {
			DownloadURL string
		}
		
		type Plugin struct {
			plugin.MattermostPlugin

			configuration configuration
		}

		func (p *Plugin) OnConfigurationChange() error {
			if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
				return err
			}
			return nil
		}
		
		func (p *Plugin) OnActivate() error {
			resp, err := http.Get(p.configuration.DownloadURL)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			_, aerr := p.API.InstallPlugin(resp.Body, true)
			if aerr != nil {
				return errors.Wrap(aerr, "cannot install plugin")
			}
			return nil
		}

		func main() {
			plugin.ClientMain(&Plugin{})
		}
		
	`,
		`{"id": "testinstallplugin", "backend": {"executable": "backend.exe"}, "settings_schema": {
		"settings": [
			{
				"key": "DownloadURL",
				"type": "text"
			}
		]
	}}`, "testinstallplugin", th.App)
	defer tearDown()

	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin("testinstallplugin")
	require.NoError(t, err)

	err = hooks.OnActivate()
	require.NoError(t, err)

	plugins, aerr := th.App.GetPlugins()
	require.Nil(t, aerr)
	require.Len(t, plugins.Inactive, 1)
	require.Equal(t, "testplugin", plugins.Inactive[0].Id)
}

func TestPluginAPIGetTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// Create an 128 x 128 image
	img := image.NewRGBA(image.Rect(0, 0, 128, 128))
	// Draw a red dot at (2, 3)
	img.Set(2, 3, color.RGBA{255, 0, 0, 255})
	buf := new(bytes.Buffer)
	err := png.Encode(buf, img)
	require.Nil(t, err)
	dataBytes := buf.Bytes()
	fileReader := bytes.NewReader(dataBytes)

	// Set the Team Icon
	err = th.App.SetTeamIconFromFile(th.BasicTeam, fileReader)
	require.Nil(t, err)

	// Get the team icon to check
	teamIcon, err := api.GetTeamIcon(th.BasicTeam.Id)
	require.Nil(t, err)
	require.NotEmpty(t, teamIcon)

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(teamIcon)
	img2, _, err2 := image.Decode(byteReader)
	require.Nil(t, err2)
	require.Equal(t, img2.At(2, 3), colorful)
}

func TestPluginAPISetTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// Create an 128 x 128 image
	img := image.NewRGBA(image.Rect(0, 0, 128, 128))
	// Draw a red dot at (2, 3)
	img.Set(2, 3, color.RGBA{255, 0, 0, 255})
	buf := new(bytes.Buffer)
	err := png.Encode(buf, img)
	require.Nil(t, err)
	dataBytes := buf.Bytes()

	// Set the user profile image
	err = api.SetTeamIcon(th.BasicTeam.Id, dataBytes)
	require.Nil(t, err)

	// Get the user profile image to check
	teamIcon, err := api.GetTeamIcon(th.BasicTeam.Id)
	require.Nil(t, err)
	require.NotEmpty(t, teamIcon)

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(teamIcon)
	img2, _, err2 := image.Decode(byteReader)
	require.Nil(t, err2)
	require.Equal(t, img2.At(2, 3), colorful)
}

func TestPluginAPIRemoveTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// Create an 128 x 128 image
	img := image.NewRGBA(image.Rect(0, 0, 128, 128))

	// Draw a red dot at (2, 3)
	img.Set(2, 3, color.RGBA{255, 0, 0, 255})
	buf := new(bytes.Buffer)
	err1 := png.Encode(buf, img)
	require.Nil(t, err1)
	dataBytes := buf.Bytes()
	fileReader := bytes.NewReader(dataBytes)

	// Set the Team Icon
	err := th.App.SetTeamIconFromFile(th.BasicTeam, fileReader)
	require.Nil(t, err)
	err = api.RemoveTeamIcon(th.BasicTeam.Id)
	require.Nil(t, err)
}

func pluginAPIHookTest(t *testing.T, th *TestHelper, fileName string, id string, settingsSchema string) error {
	data, err := ioutil.ReadFile(fileName)
	if err != nil {
		return err
	}
	code := string(data)
	schema := `{"settings": [ ]	}`
	if settingsSchema != "" {
		schema = settingsSchema
	}
	setupPluginApiTest(t, code,
		fmt.Sprintf(`{"id": "%v", "backend": {"executable": "backend.exe"}, "settings_schema": %v}`, id, schema),
		id, th.App)
	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(id)
	require.NoError(t, err)
	require.NotNil(t, hooks)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	if ret != "OK" {
		return errors.New(ret)
	}
	return nil
}

// This is a meta-test function. It does the following:
// 1. Scans "tests/plugin_tests" folder
// 2. For each folder - compiles the main.go inside and executes it, validating it's result
// 3. If folder starts with "manual." it is skipped ("manual." tests executed in other part of this file)
// 4. Before compiling the main.go file is passed through templating and the following values are available in the template: BasicUser, BasicUser2, BasicChannel, BasicTeam, BasicPost
// 5. Succesfully running test should return nil, "OK". Any other returned string is considered and error

func TestBasicAPIPlugins(t *testing.T) {
	defaultSchema := getDefaultPluginSettingsSchema()
	testFolder, found := fileutils.FindDir("mattermost-server/app/plugin_api_tests")
	require.True(t, found, "Cannot read find app folder")
	dirs, err := ioutil.ReadDir(testFolder)
	require.NoError(t, err, "Cannot read test folder %v", testFolder)
	for _, dir := range dirs {
		d := dir.Name()
		if dir.IsDir() && !strings.HasPrefix(d, "manual.") {
			t.Run(d, func(t *testing.T) {
				mainPath := path.Join(testFolder, d, "main.go")
				_, err := os.Stat(mainPath)
				require.NoError(t, err, "Cannot find plugin main file at %v", mainPath)
				th := Setup(t).InitBasic()
				defer th.TearDown()
				setDefaultPluginConfig(th, dir.Name())
				err = pluginAPIHookTest(t, th, mainPath, dir.Name(), defaultSchema)
				require.NoError(t, err)
			})
		}
	}
}

func TestPluginAPIKVCompareAndSet(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	testCases := []struct {
		Description   string
		ExpectedValue []byte
	}{
		{
			Description:   "Testing non-nil, non-empty value",
			ExpectedValue: []byte("value1"),
		},
		{
			Description:   "Testing empty value",
			ExpectedValue: []byte(""),
		},
	}

	for i, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			expectedKey := fmt.Sprintf("Key%d", i)
			expectedValueEmpty := []byte("")
			expectedValue1 := testCase.ExpectedValue
			expectedValue2 := []byte("value2")
			expectedValue3 := []byte("value3")

			// Attempt update using an incorrect old value
			updated, err := api.KVCompareAndSet(expectedKey, expectedValue2, expectedValue1)
			require.Nil(t, err)
			require.False(t, updated)

			// Make sure no key is already created
			value, err := api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Nil(t, value)

			// Insert using nil old value
			updated, err = api.KVCompareAndSet(expectedKey, nil, expectedValue1)
			require.Nil(t, err)
			require.True(t, updated)

			// Get inserted value
			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue1, value)

			// Attempt to insert again using nil old value
			updated, err = api.KVCompareAndSet(expectedKey, nil, expectedValue2)
			require.Nil(t, err)
			require.False(t, updated)

			// Get old value to assert nothing has changed
			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue1, value)

			// Update using correct old value
			updated, err = api.KVCompareAndSet(expectedKey, expectedValue1, expectedValue2)
			require.Nil(t, err)
			require.True(t, updated)

			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue2, value)

			// Update using incorrect old value
			updated, err = api.KVCompareAndSet(expectedKey, []byte("incorrect"), expectedValue3)
			require.Nil(t, err)
			require.False(t, updated)

			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue2, value)

			// Update using nil old value
			updated, err = api.KVCompareAndSet(expectedKey, nil, expectedValue3)
			require.Nil(t, err)
			require.False(t, updated)

			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue2, value)

			// Update using empty old value
			updated, err = api.KVCompareAndSet(expectedKey, expectedValueEmpty, expectedValue3)
			require.Nil(t, err)
			require.False(t, updated)

			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue2, value)
		})
	}
}

func TestPluginAPIKVCompareAndDelete(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	testCases := []struct {
		Description   string
		ExpectedValue []byte
	}{
		{
			Description:   "Testing non-nil, non-empty value",
			ExpectedValue: []byte("value1"),
		},
		{
			Description:   "Testing empty value",
			ExpectedValue: []byte(""),
		},
	}

	for i, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			expectedKey := fmt.Sprintf("Key%d", i)
			expectedValue1 := testCase.ExpectedValue
			expectedValue2 := []byte("value2")

			// Set the value
			err := api.KVSet(expectedKey, expectedValue1)
			require.Nil(t, err)

			// Attempt delete using an incorrect old value
			deleted, err := api.KVCompareAndDelete(expectedKey, expectedValue2)
			require.Nil(t, err)
			require.False(t, deleted)

			// Make sure the value is still there
			value, err := api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Equal(t, expectedValue1, value)

			// Attempt delete using the proper value
			deleted, err = api.KVCompareAndDelete(expectedKey, expectedValue1)
			require.Nil(t, err)
			require.True(t, deleted)

			// Verify it's deleted
			value, err = api.KVGet(expectedKey)
			require.Nil(t, err)
			require.Nil(t, value)
		})
	}
}

func TestPluginCreateBot(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	bot, err := api.CreateBot(&model.Bot{
		Username:    model.NewRandomString(10),
		DisplayName: "bot",
		Description: "bot",
	})
	require.Nil(t, err)

	_, err = api.CreateBot(&model.Bot{
		Username:    model.NewRandomString(10),
		OwnerId:     bot.UserId,
		DisplayName: "bot2",
		Description: "bot2",
	})
	require.NotNil(t, err)

}

func TestPluginCreatePostWithUploadedFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	data := []byte("Hello World")
	channelId := th.BasicChannel.Id
	filename := "testGetFile"
	fileInfo, err := api.UploadFile(data, channelId, filename)
	require.Nil(t, err)
	defer func() {
		th.App.Srv.Store.FileInfo().PermanentDelete(fileInfo.Id)
		th.App.RemoveFile(fileInfo.Path)
	}()

	actualData, err := api.GetFile(fileInfo.Id)
	require.Nil(t, err)
	assert.Equal(t, data, actualData)

	userId := th.BasicUser.Id
	post, err := api.CreatePost(&model.Post{
		Message:   "test",
		UserId:    userId,
		ChannelId: channelId,
		FileIds:   model.StringArray{fileInfo.Id},
	})
	require.Nil(t, err)
	assert.Equal(t, model.StringArray{fileInfo.Id}, post.FileIds)

	actualPost, err := api.GetPost(post.Id)
	require.Nil(t, err)
	assert.Equal(t, model.StringArray{fileInfo.Id}, actualPost.FileIds)
}

func TestPluginAPIGetConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	config := api.GetConfig()
	if config.LdapSettings.BindPassword != nil && len(*config.LdapSettings.BindPassword) > 0 {
		assert.Equal(t, *config.LdapSettings.BindPassword, model.FAKE_SETTING)
	}

	assert.Equal(t, *config.FileSettings.PublicLinkSalt, model.FAKE_SETTING)

	if len(*config.FileSettings.AmazonS3SecretAccessKey) > 0 {
		assert.Equal(t, *config.FileSettings.AmazonS3SecretAccessKey, model.FAKE_SETTING)
	}

	if config.EmailSettings.SMTPPassword != nil && len(*config.EmailSettings.SMTPPassword) > 0 {
		assert.Equal(t, *config.EmailSettings.SMTPPassword, model.FAKE_SETTING)
	}

	if len(*config.GitLabSettings.Secret) > 0 {
		assert.Equal(t, *config.GitLabSettings.Secret, model.FAKE_SETTING)
	}

	assert.Equal(t, *config.SqlSettings.DataSource, model.FAKE_SETTING)
	assert.Equal(t, *config.SqlSettings.AtRestEncryptKey, model.FAKE_SETTING)
	assert.Equal(t, *config.ElasticsearchSettings.Password, model.FAKE_SETTING)

	for i := range config.SqlSettings.DataSourceReplicas {
		assert.Equal(t, config.SqlSettings.DataSourceReplicas[i], model.FAKE_SETTING)
	}

	for i := range config.SqlSettings.DataSourceSearchReplicas {
		assert.Equal(t, config.SqlSettings.DataSourceSearchReplicas[i], model.FAKE_SETTING)
	}
}

func TestPluginAPIGetUnsanitizedConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	config := api.GetUnsanitizedConfig()
	if config.LdapSettings.BindPassword != nil && len(*config.LdapSettings.BindPassword) > 0 {
		assert.NotEqual(t, *config.LdapSettings.BindPassword, model.FAKE_SETTING)
	}

	assert.NotEqual(t, *config.FileSettings.PublicLinkSalt, model.FAKE_SETTING)

	if len(*config.FileSettings.AmazonS3SecretAccessKey) > 0 {
		assert.NotEqual(t, *config.FileSettings.AmazonS3SecretAccessKey, model.FAKE_SETTING)
	}

	if config.EmailSettings.SMTPPassword != nil && len(*config.EmailSettings.SMTPPassword) > 0 {
		assert.NotEqual(t, *config.EmailSettings.SMTPPassword, model.FAKE_SETTING)
	}

	if len(*config.GitLabSettings.Secret) > 0 {
		assert.NotEqual(t, *config.GitLabSettings.Secret, model.FAKE_SETTING)
	}

	assert.NotEqual(t, *config.SqlSettings.DataSource, model.FAKE_SETTING)
	assert.NotEqual(t, *config.SqlSettings.AtRestEncryptKey, model.FAKE_SETTING)
	assert.NotEqual(t, *config.ElasticsearchSettings.Password, model.FAKE_SETTING)

	for i := range config.SqlSettings.DataSourceReplicas {
		assert.NotEqual(t, config.SqlSettings.DataSourceReplicas[i], model.FAKE_SETTING)
	}

	for i := range config.SqlSettings.DataSourceSearchReplicas {
		assert.NotEqual(t, config.SqlSettings.DataSourceSearchReplicas[i], model.FAKE_SETTING)
	}
}

func TestPluginAddUserToChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	member, err := api.AddUserToChannel(th.BasicChannel.Id, th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, err)
	require.NotNil(t, member)
	require.Equal(t, th.BasicChannel.Id, member.ChannelId)
	require.Equal(t, th.BasicUser.Id, member.UserId)
}

func TestInterpluginPluginHTTP(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	setupMultiPluginApiTest(t,
		[]string{`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"bytes"
			"net/http"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/v2/test" {
				return
			}
			buf := bytes.Buffer{}
			buf.ReadFrom(r.Body)
			resp := "we got:" + buf.String()
			w.WriteHeader(598)
			w.Write([]byte(resp))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
			"bytes"
			"net/http"
			"io/ioutil"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			buf := bytes.Buffer{}
			buf.WriteString("This is the request")
			req, err := http.NewRequest("GET", "/testplugininterserver/api/v2/test", &buf)
			if err != nil {
				return nil, err.Error()
			}
			req.Header.Add("Mattermost-User-Id", "userid")
			resp := p.API.PluginHTTP(req)
			if resp == nil {
				return nil, "Nil resp"
			}
			if resp.Body == nil {
				return nil, "Nil body"
			}
			respbody, err := ioutil.ReadAll(resp.Body)
			if err != nil {
				return nil, err.Error()
			}
			if resp.StatusCode != 598 {
				return nil, "wrong status " + string(respbody)
			}
			return nil, string(respbody)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
		},
		[]string{
			`{"id": "testplugininterserver", "backend": {"executable": "backend.exe"}}`,
			`{"id": "testplugininterclient", "backend": {"executable": "backend.exe"}}`,
		},
		[]string{
			"testplugininterserver",
			"testplugininterclient",
		},
		th.App,
	)

	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin("testplugininterclient")
	require.NoError(t, err)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	assert.Equal(t, "we got:This is the request", ret)
}
