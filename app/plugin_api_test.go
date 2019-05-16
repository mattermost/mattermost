// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"text/template"
	"time"

	"github.com/mattermost/mattermost-server/utils/fileutils"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPluginApiTest(t *testing.T, pluginCode string, pluginManifest string, pluginId string, app *App) string {
	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(app.NewPluginAPI, pluginDir, webappPluginDir, app.Log)
	require.NoError(t, err)

	backend := filepath.Join(pluginDir, pluginId, "backend.exe")
	utils.CompileGo(t, pluginCode, backend)

	ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(pluginManifest), 0600)
	manifest, activated, reterr := env.Activate(pluginId)
	require.Nil(t, reterr)
	require.NotNil(t, manifest)
	require.True(t, activated)

	app.SetPluginsEnvironment(env)

	return pluginDir
}

func TestPublicFilesPathConfiguration(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	pluginID := "com.mattermost.sample"

	pluginDir := setupPluginApiTest(t,
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var pluginJson map[string]interface{}
	if err := json.Unmarshal([]byte(`{"mystringsetting": "str", "MyIntSetting": 32, "myboolsetting": true}`), &pluginJson); err != nil {
		t.Fatal(err)
	}
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})

	testFolder, found := fileutils.FindDir("tests")
	require.True(t, found, "Cannot find tests folder")
	fullPath := path.Join(testFolder, "plugin_tests", "manual.test_load_configuration_plugin", "main.go")

	err := pluginAPIHookTest(t, th, fullPath, "testloadpluginconfig", nil, `{"id": "testloadpluginconfig", "backend": {"executable": "backend.exe"}, "settings_schema": {
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
	assert.NoError(t, err)

}

func TestPluginAPILoadPluginConfigurationDefaults(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var pluginJson map[string]interface{}
	if err := json.Unmarshal([]byte(`{"mystringsetting": "override"}`), &pluginJson); err != nil {
		t.Fatal(err)
	}
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})

	testFolder, found := fileutils.FindDir("tests")
	require.True(t, found, "Cannot find tests folder")
	fullPath := path.Join(testFolder, "plugin_tests", "manual.test_load_configuration_defaults_plugin", "main.go")

	err := pluginAPIHookTest(t, th, fullPath, "testloadpluginconfig", nil, `{
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

	assert.NoError(t, err)

}

func TestPluginAPIGetPlugins(t *testing.T) {
	th := Setup(t).InitBasic()
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

func pluginAPIHookTest(t *testing.T, th *TestHelper, fileName string, id string, params map[string]interface{}, settingsSchema string) error {
	tpl := template.Must(template.ParseFiles(fileName))
	builder := &strings.Builder{}
	if err := tpl.Execute(builder, params); err != nil {
		panic(err)
	}
	code := builder.String()
	schema := `{"settings": [ ]	}`
	if settingsSchema != "" {
		schema = settingsSchema
	}
	setupPluginApiTest(t, code,
		fmt.Sprintf(`{"id": "%v", "backend": {"executable": "backend.exe"}, "settings_schema": %v}`, id, schema),
		id, th.App)
	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(id)
	assert.NoError(t, err)
	require.NotNil(t, hooks)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	if ret != "" {
		return errors.New(ret)
	}
	return nil
}

// This is a meta-test function. It does the following:
// 1. Scans "tests/plugin_tests" folder
// 2. For each folder - compiles the main.go inside and executes it, validating it's result
// 3. If folder starts with "manual." it is skipped ("manual." tests executed in other part of this file)
// 4. Before compiling the main.go file is passed through templating and the following values are available in the template: BasicUser, BasicUser2, BasicChannel, BasicTeam, BasicPost

func TestBasicAPIPlugins(t *testing.T) {
	testFolder, found := fileutils.FindDir("tests")
	require.True(t, found, "Cannot read find test folder")
	fullPath := path.Join(testFolder, "plugin_tests")
	dirs, err := ioutil.ReadDir(fullPath)
	require.NoError(t, err, "Cannot read test folder %v", fullPath)
	for _, dir := range dirs {
		d := dir.Name()
		if dir.IsDir() && !strings.HasPrefix(d, "manual.") {
			t.Run(d, func(t *testing.T) {
				mainPath := path.Join(fullPath, d, "main.go")
				_, err := os.Stat(mainPath)
				assert.NoError(t, err, "Cannot find plugin main file at %v", mainPath)
				th := Setup(t).InitBasic()
				defer th.TearDown()
				params := map[string]interface{}{
					"BasicUser":    th.BasicUser,
					"BasicUser2":   th.BasicUser2,
					"BasicChannel": th.BasicChannel,
					"BasicTeam":    th.BasicTeam,
					"BasicPost":    th.BasicPost,
				}

				err = pluginAPIHookTest(t, th, mainPath, dir.Name(), params, "")
				assert.NoError(t, err)
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
