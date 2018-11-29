// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPluginApiTest(t *testing.T, pluginCode string, pluginManifest string, pluginId string, app *App) {
	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(app.NewPluginAPI, pluginDir, webappPluginDir, app.Log)
	require.NoError(t, err)

	backend := filepath.Join(pluginDir, pluginId, "backend.exe")
	compileGo(t, pluginCode, backend)

	ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(pluginManifest), 0600)
	manifest, activated, reterr := env.Activate(pluginId)
	require.Nil(t, reterr)
	require.NotNil(t, manifest)
	require.True(t, activated)

	app.SetPluginsEnvironment(env)
}

func TestPluginAPIGetUsersInTeam(t *testing.T) {
	th := Setup().InitBasic()
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

func TestPluginAPIUpdateUserStatus(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	statuses := []string{model.STATUS_ONLINE, model.STATUS_AWAY, model.STATUS_DND, model.STATUS_OFFLINE}

	for _, s := range statuses {
		status, err := api.UpdateUserStatus(th.BasicUser.Id, s)
		require.Nil(t, err)
		require.NotNil(t, status)
		assert.Equal(t, s, status.Status)
	}

	status, err := api.UpdateUserStatus(th.BasicUser.Id, "notrealstatus")
	assert.NotNil(t, err)
	assert.Nil(t, status)
}

func TestPluginAPISavePluginConfig(t *testing.T) {
	th := Setup().InitBasic()
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
	if err := json.Unmarshal([]byte(pluginConfigJsonString), &pluginConfig); err != nil {
		t.Fatal(err)
	}

	if err := api.SavePluginConfig(pluginConfig); err != nil {
		t.Fatal(err)
	}

	type Configuration struct {
		MyStringSetting string
		MyIntSetting    int
		MyBoolSetting   bool
	}

	savedConfiguration := new(Configuration)
	if err := api.LoadPluginConfiguration(savedConfiguration); err != nil {
		t.Fatal(err)
	}

	expectedConfiguration := new(Configuration)
	if err := json.Unmarshal([]byte(pluginConfigJsonString), &expectedConfiguration); err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, expectedConfiguration, savedConfiguration)
}

func TestPluginAPIGetPluginConfig(t *testing.T) {
	th := Setup().InitBasic()
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

	if err := json.Unmarshal([]byte(pluginConfigJsonString), &pluginConfig); err != nil {
		t.Fatal(err)
	}
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["pluginid"] = pluginConfig
	})

	savedPluginConfig := api.GetPluginConfig()
	assert.Equal(t, pluginConfig, savedPluginConfig)
}

func TestPluginAPILoadPluginConfiguration(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	var pluginJson map[string]interface{}
	if err := json.Unmarshal([]byte(`{"mystringsetting": "str", "MyIntSetting": 32, "myboolsetting": true}`), &pluginJson); err != nil {
		t.Fatal(err)
	}
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})
	setupPluginApiTest(t,
		`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
			"fmt"
		)

		type configuration struct {
			MyStringSetting string
			MyIntSetting int
			MyBoolSetting bool
		}

		type MyPlugin struct {
			plugin.MattermostPlugin

			configuration configuration
		}

		func (p *MyPlugin) OnConfigurationChange() error {
			if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
				return err
			}

			return nil
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			return nil, fmt.Sprintf("%v%v%v", p.configuration.MyStringSetting, p.configuration.MyIntSetting, p.configuration.MyBoolSetting)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
		`{"id": "testloadpluginconfig", "backend": {"executable": "backend.exe"}, "settings_schema": {
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
	}}`, "testloadpluginconfig", th.App)
	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin("testloadpluginconfig")
	assert.NoError(t, err)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	assert.Equal(t, "str32true", ret)
}

func TestPluginAPILoadPluginConfigurationDefaults(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	var pluginJson map[string]interface{}
	if err := json.Unmarshal([]byte(`{"mystringsetting": "override"}`), &pluginJson); err != nil {
		t.Fatal(err)
	}
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})
	setupPluginApiTest(t,
		`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
			"fmt"
		)

		type configuration struct {
			MyStringSetting string
			MyIntSetting int
			MyBoolSetting bool
		}

		type MyPlugin struct {
			plugin.MattermostPlugin

			configuration configuration
		}

		func (p *MyPlugin) OnConfigurationChange() error {
			if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
				return err
			}

			return nil
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			return nil, fmt.Sprintf("%v%v%v", p.configuration.MyStringSetting, p.configuration.MyIntSetting, p.configuration.MyBoolSetting)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
		`{"id": "testloadpluginconfig", "backend": {"executable": "backend.exe"}, "settings_schema": {
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
	}}`, "testloadpluginconfig", th.App)
	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin("testloadpluginconfig")
	assert.NoError(t, err)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	assert.Equal(t, "override35true", ret)
}

func TestPluginAPIGetProfileImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// check existing user first
	data, err := api.GetProfileImage(th.BasicUser.Id)
	require.Nil(t, err)
	require.NotEmpty(t, data)

	// then unknown user
	data, err = api.GetProfileImage(model.NewId())
	require.NotNil(t, err)
	require.Nil(t, data)
}

func TestPluginAPISetProfileImage(t *testing.T) {
	th := Setup().InitBasic()
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
	err = api.SetProfileImage(th.BasicUser.Id, dataBytes)
	require.Nil(t, err)

	// Get the user profile image to check
	imageProfile, err := api.GetProfileImage(th.BasicUser.Id)
	require.Nil(t, err)
	require.NotEmpty(t, imageProfile)

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(imageProfile)
	img2, _, err2 := image.Decode(byteReader)
	require.Nil(t, err2)
	require.Equal(t, img2.At(2, 3), colorful)
}

func TestPluginAPIGetPlugins(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	pluginCode := `
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
		compileGo(t, pluginCode, backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(fmt.Sprintf(`{"id": "%s", "server": {"executable": "backend.exe"}}`, pluginID)), 0600)
		manifest, activated, reterr := env.Activate(pluginID)

		require.Nil(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)
		pluginManifests = append(pluginManifests, manifest)
	}
	th.App.SetPluginsEnvironment(env)

	// Decativate the last one for testing
	sucess := env.Deactivate(pluginIDs[len(pluginIDs)-1])
	require.True(t, sucess)

	// check existing user first
	plugins, err := api.GetPlugins()
	assert.Nil(t, err)
	assert.NotEmpty(t, plugins)
	assert.Equal(t, pluginManifests, plugins)
}

func TestPluginAPIGetTeamIcon(t *testing.T) {
	th := Setup().InitBasic()
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
	th := Setup().InitBasic()
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

func TestPluginAPISearchChannels(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	t.Run("all fine", func(t *testing.T) {
		channels, err := api.SearchChannels(th.BasicTeam.Id, th.BasicChannel.Name)
		assert.Nil(t, err)
		assert.Len(t, channels, 1)
	})

	t.Run("invalid team id", func(t *testing.T) {
		channels, err := api.SearchChannels("invalidid", th.BasicChannel.Name)
		assert.Nil(t, err)
		assert.Empty(t, channels)
	})
}

func TestPluginAPIGetChannelsForTeamForUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	t.Run("all fine", func(t *testing.T) {
		channels, err := api.GetChannelsForTeamForUser(th.BasicTeam.Id, th.BasicUser.Id, false)
		assert.Nil(t, err)
		assert.Len(t, channels, 3)
	})

	t.Run("invalid team id", func(t *testing.T) {
		channels, err := api.GetChannelsForTeamForUser("invalidid", th.BasicUser.Id, false)
		assert.NotNil(t, err)
		assert.Empty(t, channels)
	})
}

func TestPluginAPIRemoveTeamIcon(t *testing.T) {
	th := Setup().InitBasic()
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

func TestPluginAPIGetDirectChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	dm1, err := api.GetDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, err)
	require.NotEmpty(t, dm1)

	dm2, err := api.GetDirectChannel(th.BasicUser.Id, th.BasicUser.Id)
	require.Nil(t, err)
	require.NotEmpty(t, dm2)

	dm3, err := api.GetDirectChannel(th.BasicUser.Id, model.NewId())
	require.NotNil(t, err)
	require.Empty(t, dm3)
}
