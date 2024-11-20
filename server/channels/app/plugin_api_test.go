// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
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

func setDefaultPluginConfig(th *TestHelper, pluginID string) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins[pluginID] = map[string]any{
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

func setupMultiPluginAPITest(t *testing.T, pluginCodes []string, pluginManifests []string, pluginIDs []string, asMain bool, app *App, c request.CTX) string {
	pluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(pluginDir)
		if err != nil {
			t.Logf("Failed to cleanup pluginDir %s", err.Error())
		}
	})

	webappPluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(webappPluginDir)
		if err != nil {
			t.Logf("Failed to cleanup webappPluginDir %s", err.Error())
		}
	})

	newPluginAPI := func(manifest *model.Manifest) plugin.API {
		return app.NewPluginAPI(c, manifest)
	}

	env, err := plugin.NewEnvironment(newPluginAPI, NewDriverImpl(app.Srv()), pluginDir, webappPluginDir, app.Log(), nil)
	require.NoError(t, err)

	require.Equal(t, len(pluginCodes), len(pluginIDs))
	require.Equal(t, len(pluginManifests), len(pluginIDs))

	for i, pluginID := range pluginIDs {
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		if asMain {
			utils.CompileGo(t, pluginCodes[i], backend)
		} else {
			utils.CompileGoTest(t, pluginCodes[i], backend)
		}

		err := os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(pluginManifests[i]), 0600)
		require.NoError(t, err)
		manifest, activated, reterr := env.Activate(pluginID)
		require.NoError(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)

		app.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[pluginID] = &model.PluginState{
				Enable: true,
			}
		})
	}

	app.ch.SetPluginsEnvironment(env)

	return pluginDir
}

func setupPluginAPITest(t *testing.T, pluginCode string, pluginManifest string, pluginID string, app *App, c request.CTX) string {
	asMain := pluginID != "test_db_driver"
	return setupMultiPluginAPITest(t,
		[]string{pluginCode}, []string{pluginManifest}, []string{pluginID},
		asMain, app, c)
}

func TestPublicFilesPathConfiguration(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	pluginID := "com.mattermost.sample"

	pluginDir := setupPluginAPITest(t,
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
		`{"id": "com.mattermost.sample", "server": {"executable": "backend.exe"}, "settings_schema": {"settings": []}}`, pluginID, th.App, th.Context)

	publicFilesFolderInTest := filepath.Join(pluginDir, pluginID, "public")
	publicFilesPath, err := th.App.GetPluginsEnvironment().PublicFilesPath(pluginID)
	assert.NoError(t, err)
	assert.Equal(t, publicFilesPath, publicFilesFolderInTest)
}

func TestPluginAPIGetUserPreference(t *testing.T) {
	t.Run("should return preferences when called", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		api := th.SetupPluginAPI()

		err := api.UpdatePreferencesForUser(th.BasicUser.Id, []model.Preference{
			{
				UserId:   th.BasicUser.Id,
				Category: model.PreferenceCategoryDisplaySettings,
				Name:     model.PreferenceNameUseMilitaryTime,
				Value:    "true",
			},
			{
				UserId:   th.BasicUser.Id,
				Category: "test_category",
				Name:     "test_key",
				Value:    "test_value",
			},
		})
		require.Nil(t, err)

		preference, err := api.GetPreferenceForUser(th.BasicUser.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime)

		require.Nil(t, err)
		assert.Equal(t, model.PreferenceCategoryDisplaySettings, preference.Category)
		assert.Equal(t, model.PreferenceNameUseMilitaryTime, preference.Name)
		assert.Equal(t, "true", preference.Value)

		preference, err = api.GetPreferenceForUser(th.BasicUser.Id, "test_category", "test_key")

		require.Nil(t, err)
		assert.Equal(t, "test_category", preference.Category)
		assert.Equal(t, "test_key", preference.Name)
		assert.Equal(t, "test_value", preference.Value)
	})

	t.Run("should return an error when a user doesn't have a preference set", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		api := th.SetupPluginAPI()

		_, err := api.GetPreferenceForUser(th.BasicUser.Id, "something", "that doesn't exist")
		assert.NotNil(t, err)
	})
}

func TestPluginAPIGetUserPreferences(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	preferences, err := api.GetPreferencesForUser(user1.Id)
	require.Nil(t, err)
	assert.Equal(t, 3, len(preferences))

	assert.Equal(t, user1.Id, preferences[0].UserId)
	assert.Equal(t, model.PreferenceRecommendedNextSteps, preferences[0].Category)
	assert.Equal(t, "hide", preferences[0].Name)
	assert.Equal(t, "false", preferences[0].Value)

	assert.Equal(t, model.PreferenceCategorySystemNotice, preferences[1].Category)

	assert.Equal(t, user1.Id, preferences[2].UserId)
	assert.Equal(t, model.PreferenceCategoryTutorialSteps, preferences[2].Category)
	assert.Equal(t, user1.Id, preferences[2].Name)
	assert.Equal(t, "0", preferences[2].Value)
}

func TestPluginAPIDeleteUserPreferences(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	preferences, err := api.GetPreferencesForUser(user1.Id)
	require.Nil(t, err)
	assert.Equal(t, 3, len(preferences))

	err = api.DeletePreferencesForUser(user1.Id, preferences)
	require.Nil(t, err)
	preferences, err = api.GetPreferencesForUser(user1.Id)
	require.Nil(t, err)
	assert.Equal(t, 0, len(preferences))

	user2, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user2" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user2)
		require.Nil(t, appErr)
	}()

	preference := model.Preference{
		Name:     user2.Id,
		UserId:   user2.Id,
		Category: model.PreferenceCategoryTheme,
		Value:    `{"color": "#ff0000", "color2": "#faf"}`,
	}
	err = api.UpdatePreferencesForUser(user2.Id, []model.Preference{preference})
	require.Nil(t, err)

	preferences, err = api.GetPreferencesForUser(user2.Id)
	require.Nil(t, err)
	assert.Equal(t, 4, len(preferences))

	err = api.DeletePreferencesForUser(user2.Id, []model.Preference{preference})
	require.Nil(t, err)
	preferences, err = api.GetPreferencesForUser(user2.Id)
	require.Nil(t, err)
	assert.Equal(t, 3, len(preferences))
	assert.ElementsMatch(t,
		[]string{model.PreferenceRecommendedNextSteps, model.PreferenceCategoryTutorialSteps, model.PreferenceCategorySystemNotice},
		[]string{preferences[0].Category, preferences[1].Category, preferences[2].Category},
	)
}

func TestPluginAPIUpdateUserPreferences(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	preferences, err := api.GetPreferencesForUser(user1.Id)
	require.Nil(t, err)
	assert.Equal(t, 3, len(preferences))

	assert.Equal(t, user1.Id, preferences[0].UserId)
	assert.Equal(t, model.PreferenceRecommendedNextSteps, preferences[0].Category)
	assert.Equal(t, "hide", preferences[0].Name)
	assert.Equal(t, "false", preferences[0].Value)
	assert.Equal(t, model.PreferenceCategorySystemNotice, preferences[1].Category)
	assert.Equal(t, user1.Id, preferences[2].UserId)
	assert.Equal(t, model.PreferenceCategoryTutorialSteps, preferences[2].Category)
	assert.Equal(t, user1.Id, preferences[2].Name)
	assert.Equal(t, "0", preferences[2].Value)

	preference := model.Preference{
		Name:     user1.Id,
		UserId:   user1.Id,
		Category: model.PreferenceCategoryTheme,
		Value:    `{"color": "#ff0000", "color2": "#faf"}`,
	}

	err = api.UpdatePreferencesForUser(user1.Id, []model.Preference{preference})
	require.Nil(t, err)

	preferences, err = api.GetPreferencesForUser(user1.Id)
	require.Nil(t, err)

	assert.Equal(t, 4, len(preferences))
	expectedCategories := []string{model.PreferenceCategoryTutorialSteps, model.PreferenceCategoryTheme, model.PreferenceRecommendedNextSteps, model.PreferenceCategorySystemNotice}
	for _, pref := range preferences {
		assert.Contains(t, expectedCategories, pref.Category)
		assert.Equal(t, user1.Id, pref.UserId)
	}
}

func TestPluginAPIGetUsers(t *testing.T) {
	th := Setup(t).DeleteBots()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	user2, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user2" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user2)
		require.Nil(t, appErr)
	}()

	user3, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user3" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user3)
		require.Nil(t, appErr)
	}()

	user4, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user4" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user4)
		require.Nil(t, appErr)
	}()

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

func TestPluginAPIGetUsersByIds(t *testing.T) {
	th := Setup(t).DeleteBots()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	user2, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user2" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user2)
		require.Nil(t, appErr)
	}()

	user3, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user3" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user3)
		require.Nil(t, appErr)
	}()

	testCases := []struct {
		Description  string
		requestedIDs []string
	}{
		{
			"no users",
			[]string{},
		},
		{
			"getting 1 and 3",
			[]string{user1.Id, user3.Id},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := api.GetUsersByIds(testCase.requestedIDs)
			assert.Nil(t, err)
			assert.Equal(t, len(testCase.requestedIDs), len(users))
			for _, user := range users {
				assert.Contains(t, testCase.requestedIDs, user.Id)
			}
		})
	}
}

func TestPluginAPIGetUsersInTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	team1 := th.CreateTeam()
	team2 := th.CreateTeam()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user1" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	user2, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user2" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user2)
		require.Nil(t, appErr)
	}()

	user3, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user3" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user3)
		require.Nil(t, appErr)
	}()

	user4, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Password: "password",
		Username: "user4" + model.NewId(),
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user4)
		require.Nil(t, appErr)
	}()

	// Add all users to team 1
	_, appErr := th.App.JoinUserToTeam(th.Context, team1, user1, "")
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, team1, user2, "")
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, team1, user3, "")
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, team1, user4, "")
	require.Nil(t, appErr)

	// Add only user3 and user4 to team 2
	_, appErr = th.App.JoinUserToTeam(th.Context, team2, user3, "")
	require.Nil(t, appErr)
	_, appErr = th.App.JoinUserToTeam(th.Context, team2, user4, "")
	require.Nil(t, appErr)

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
			usersMap := make(map[string]bool)
			for _, user := range testCase.ExpectedUsers {
				usersMap[user.Id] = true
			}
			for _, user := range users {
				delete(usersMap, user.Id)
			}
			assert.Empty(t, usersMap)
		})
	}
}

func TestPluginAPIUserCustomStatus(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
		Username: "user_" + model.NewId(),
		Password: "password",
	})
	require.Nil(t, err)
	defer func() {
		appErr := th.App.PermanentDeleteUser(th.Context, user1)
		require.Nil(t, appErr)
	}()

	custom := &model.CustomStatus{
		Emoji: "tada",
		Text:  "honk",
	}

	err = api.UpdateUserCustomStatus(user1.Id, custom)
	assert.Nil(t, err)
	userCs, err := th.App.GetCustomStatus(user1.Id)
	assert.Nil(t, err)
	assert.Equal(t, custom, userCs)

	custom.Text = ""
	err = api.UpdateUserCustomStatus(user1.Id, custom)
	assert.Nil(t, err)
	userCs, err = th.App.GetCustomStatus(user1.Id)
	assert.Nil(t, err)
	assert.Equal(t, custom, userCs)

	custom.Text = "honk"
	custom.Emoji = ""
	err = api.UpdateUserCustomStatus(user1.Id, custom)
	assert.Nil(t, err)
	userCs, err = th.App.GetCustomStatus(user1.Id)
	assert.Nil(t, err)
	assert.Equal(t, custom, userCs)

	custom.Text = ""
	err = api.UpdateUserCustomStatus(user1.Id, custom)
	assert.NotNil(t, err)
	assert.Equal(t, err.Error(), "SetCustomStatus: Failed to update the custom status. Please add either emoji or custom text status or both.")

	// Remove custom status
	err = api.RemoveUserCustomStatus(user1.Id)
	assert.Nil(t, err)
	var csClear *model.CustomStatus
	userCs, err = th.App.GetCustomStatus(user1.Id)
	assert.Nil(t, err)
	assert.Equal(t, csClear, userCs)
}

func TestPluginAPIGetFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// check a valid file first
	uploadTime := time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local)
	filename := "testGetFile"
	fileData := []byte("Hello World")
	info, err := th.App.DoUploadFile(th.Context, uploadTime, th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, filename, fileData, true)
	require.Nil(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info.Id)
		require.NoError(t, err)
		appErr := th.App.RemoveFile(info.Path)
		require.Nil(t, appErr)
	}()

	data, err1 := api.GetFile(info.Id)
	require.Nil(t, err1)
	assert.Equal(t, data, fileData)

	// then checking invalid file
	data, err = api.GetFile("../fake/testingApi")
	require.NotNil(t, err)
	require.Nil(t, data)
}

func TestPluginAPIGetFileInfos(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	fileInfo1, err := th.App.DoUploadFile(th.Context,
		time.Date(2020, 1, 1, 1, 1, 1, 1, time.UTC),
		th.BasicTeam.Id,
		th.BasicChannel.Id,
		th.BasicUser.Id,
		"testFile1",
		[]byte("testfile1 Content"),
		true,
	)
	require.Nil(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, fileInfo1.Id)
		require.NoError(t, err)
		appErr := th.App.RemoveFile(fileInfo1.Path)
		require.Nil(t, appErr)
	}()

	fileInfo2, err := th.App.DoUploadFile(th.Context,
		time.Date(2020, 1, 2, 1, 1, 1, 1, time.UTC),
		th.BasicTeam.Id,
		th.BasicChannel.Id,
		th.BasicUser2.Id,
		"testFile2",
		[]byte("testfile2 Content"),
		true,
	)
	require.Nil(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, fileInfo2.Id)
		require.NoError(t, err)
		appErr := th.App.RemoveFile(fileInfo2.Path)
		require.Nil(t, appErr)
	}()

	fileInfo3, err := th.App.DoUploadFile(th.Context,
		time.Date(2020, 1, 3, 1, 1, 1, 1, time.UTC),
		th.BasicTeam.Id,
		th.BasicChannel.Id,
		th.BasicUser.Id,
		"testFile3",
		[]byte("testfile3 Content"),
		true,
	)
	require.Nil(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, fileInfo3.Id)
		require.NoError(t, err)
		appErr := th.App.RemoveFile(fileInfo3.Path)
		require.Nil(t, appErr)
	}()

	_, err = api.CreatePost(&model.Post{
		Message:   "testFile1",
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		FileIds:   model.StringArray{fileInfo1.Id},
	})
	require.Nil(t, err)

	_, err = api.CreatePost(&model.Post{
		Message:   "testFile2",
		UserId:    th.BasicUser2.Id,
		ChannelId: th.BasicChannel.Id,
		FileIds:   model.StringArray{fileInfo2.Id},
	})
	require.Nil(t, err)

	t.Run("get file infos with no options 2nd page of 1 per page", func(t *testing.T) {
		fileInfos, err := api.GetFileInfos(1, 1, nil)
		require.Nil(t, err)
		require.Len(t, fileInfos, 1)
	})
	t.Run("get file infos filtered by user", func(t *testing.T) {
		fileInfos, err := api.GetFileInfos(0, 5, &model.GetFileInfosOptions{
			UserIds: []string{th.BasicUser.Id},
		})
		require.Nil(t, err)
		require.Len(t, fileInfos, 2)
	})
	t.Run("get file infos filtered by channel ordered by created at descending", func(t *testing.T) {
		fileInfos, err := api.GetFileInfos(0, 5, &model.GetFileInfosOptions{
			ChannelIds:     []string{th.BasicChannel.Id},
			SortBy:         model.FileinfoSortByCreated,
			SortDescending: true,
		})
		require.Nil(t, err)
		require.Len(t, fileInfos, 2)
		require.Equal(t, fileInfos[0].Id, fileInfo2.Id)
		require.Equal(t, fileInfos[1].Id, fileInfo1.Id)
	})
}

func TestPluginAPISavePluginConfig(t *testing.T) {
	th := Setup(t)
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

	api := NewPluginAPI(th.App, th.Context, manifest)

	pluginConfigJsonString := `{"mystringsetting": "str", "MyIntSetting": 32, "myboolsetting": true}`

	var pluginConfig map[string]any
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

func TestPluginAPILoadPluginConfiguration(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	var pluginJson map[string]any
	err := json.Unmarshal([]byte(`{"mystringsetting": "str", "MyIntSetting": 32, "myBoolsetting": true}`), &pluginJson)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})

	fullPath := filepath.Join(server.GetPackagePath(), "channels", "app", "plugin_api_tests", "manual.test_load_configuration_plugin", "main.go")

	err = pluginAPIHookTest(t, th, fullPath, "testloadpluginconfig", `{"id": "testloadpluginconfig", "server": {"executable": "backend.exe"}, "settings_schema": {
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
	th := Setup(t)
	defer th.TearDown()

	var pluginJson map[string]any
	err := json.Unmarshal([]byte(`{"mystringsetting": "override"}`), &pluginJson)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})

	fullPath := filepath.Join(server.GetPackagePath(), "channels", "app", "plugin_api_tests", "manual.test_load_configuration_defaults_plugin", "main.go")

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
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	pluginCode := `
    package main

    import (
      "github.com/mattermost/mattermost/server/public/plugin"
    )

    type MyPlugin struct {
      plugin.MattermostPlugin
    }

    func main() {
      plugin.ClientMain(&MyPlugin{})
    }
  `

	pluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	webappPluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(th.NewPluginAPI, NewDriverImpl(th.Server), pluginDir, webappPluginDir, th.App.Log(), nil)
	require.NoError(t, err)

	pluginIDs := []string{"pluginid1", "pluginid2", "pluginid3"}
	var pluginManifests []*model.Manifest
	for _, pluginID := range pluginIDs {
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		utils.CompileGo(t, pluginCode, backend)

		err := os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(fmt.Sprintf(`{"id": "%s", "server": {"executable": "backend.exe"}}`, pluginID)), 0600)
		require.NoError(t, err)
		manifest, activated, reterr := env.Activate(pluginID)

		require.NoError(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)
		pluginManifests = append(pluginManifests, manifest)
	}
	th.App.ch.SetPluginsEnvironment(env)

	// Deactivate the last one for testing
	success := env.Deactivate(pluginIDs[len(pluginIDs)-1])
	require.True(t, success)

	// check existing user first
	plugins, appErr := api.GetPlugins()
	assert.Nil(t, appErr)
	assert.NotEmpty(t, plugins)
	assert.Equal(t, pluginManifests, plugins)
}

func TestPluginAPIInstallPlugin(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	tarData, err := os.ReadFile(filepath.Join(server.GetPackagePath(), "tests", "testplugin.tar.gz"))
	require.NoError(t, err)

	_, appErr := api.InstallPlugin(bytes.NewReader(tarData), true)
	assert.NotNil(t, appErr, "should not allow upload if upload disabled")
	assert.Equal(t, appErr.Error(), "installPlugin: Plugins and/or plugin uploads have been disabled.")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})

	manifest, appErr := api.InstallPlugin(bytes.NewReader(tarData), true)
	defer os.RemoveAll("plugins/testplugin")
	require.Nil(t, appErr)
	assert.Equal(t, "testplugin", manifest.Id)

	// Successfully installed
	pluginsResp, appErr := api.GetPlugins()
	require.Nil(t, appErr)

	found := false
	for _, m := range pluginsResp {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.True(t, found)
}

func TestInstallPlugin(t *testing.T) {
	// TODO(ilgooz): remove this setup func to use existent setupPluginAPITest().
	// following setupTest() func is a modified version of setupPluginAPITest().
	// we need a modified version of setupPluginAPITest() because it wasn't possible to use it directly here
	// since it removes plugin dirs right after it returns, does not update App configs with the plugin
	// dirs and this behavior tends to break this test as a result.
	setupTest := func(t *testing.T, pluginCode string, pluginManifest string, pluginID string, app *App, c request.CTX) (func(), string) {
		pluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		webappPluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		app.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Directory = pluginDir
			*cfg.PluginSettings.ClientDirectory = webappPluginDir
		})

		newPluginAPI := func(manifest *model.Manifest) plugin.API {
			return app.NewPluginAPI(c, manifest)
		}

		env, err := plugin.NewEnvironment(newPluginAPI, NewDriverImpl(app.Srv()), pluginDir, webappPluginDir, app.Log(), nil)
		require.NoError(t, err)

		app.ch.SetPluginsEnvironment(env)

		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		utils.CompileGo(t, pluginCode, backend)

		err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(pluginManifest), 0600)
		require.NoError(t, err)
		manifest, activated, reterr := env.Activate(pluginID)
		require.NoError(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)

		return func() {
			os.RemoveAll(pluginDir)
			os.RemoveAll(webappPluginDir)
		}, pluginDir
	}

	th := Setup(t)
	defer th.TearDown()

	// start an http server to serve plugin's tarball to the test.
	ts := httptest.NewServer(http.FileServer(http.Dir(filepath.Join(server.GetPackagePath(), "tests"))))
	defer ts.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		cfg.PluginSettings.Plugins["testinstallplugin"] = map[string]any{
			"DownloadURL": ts.URL + "/testplugin.tar.gz",
		}
	})

	tearDown, _ := setupTest(t,
		`
		package main

		import (
			"net/http"

			"github.com/pkg/errors"

			"github.com/mattermost/mattermost/server/public/plugin"
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
		`{"id": "testinstallplugin", "server": {"executable": "backend.exe"}, "settings_schema": {
		"settings": [
			{
				"key": "DownloadURL",
				"type": "text"
			}
		]
	}}`, "testinstallplugin", th.App, th.Context)
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
	require.NoError(t, err)
	dataBytes := buf.Bytes()
	fileReader := bytes.NewReader(dataBytes)

	// Set the Team Icon
	appErr := th.App.SetTeamIconFromFile(th.BasicTeam, fileReader)
	require.Nil(t, appErr)

	// Get the team icon to check
	teamIcon, appErr := api.GetTeamIcon(th.BasicTeam.Id)
	require.Nil(t, appErr)
	require.NotEmpty(t, teamIcon)

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(teamIcon)
	img2, _, err2 := image.Decode(byteReader)
	require.NoError(t, err2)
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
	require.NoError(t, err)
	dataBytes := buf.Bytes()

	// Set the user profile image
	appErr := api.SetTeamIcon(th.BasicTeam.Id, dataBytes)
	require.Nil(t, appErr)

	// Get the user profile image to check
	teamIcon, appErr := api.GetTeamIcon(th.BasicTeam.Id)
	require.Nil(t, appErr)
	require.NotEmpty(t, teamIcon)

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(teamIcon)
	img2, _, err2 := image.Decode(byteReader)
	require.NoError(t, err2)
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
	require.NoError(t, err1)
	dataBytes := buf.Bytes()
	fileReader := bytes.NewReader(dataBytes)

	// Set the Team Icon
	err := th.App.SetTeamIconFromFile(th.BasicTeam, fileReader)
	require.Nil(t, err)
	err = api.RemoveTeamIcon(th.BasicTeam.Id)
	require.Nil(t, err)
}

func pluginAPIHookTest(t *testing.T, th *TestHelper, fileName string, id string, settingsSchema string) error {
	data, err := os.ReadFile(fileName)
	if err != nil {
		return err
	}
	code := string(data)
	schema := `{"settings": [ ]	}`
	if settingsSchema != "" {
		schema = settingsSchema
	}
	th.App.ch.srv.platform.SetSqlStore(th.GetSqlStore()) // TODO: platform: check if necessary
	setupPluginAPITest(t, code,
		fmt.Sprintf(`{"id": "%v", "server": {"executable": "backend.exe"}, "settings_schema": %v}`, id, schema),
		id, th.App, th.Context)
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
// 5. Successfully running test should return nil, "OK". Any other returned string is considered and error

func TestBasicAPIPlugins(t *testing.T) {
	defaultSchema := getDefaultPluginSettingsSchema()
	testFolder := filepath.Join(server.GetPackagePath(), "channels", "app", "plugin_api_tests")
	dirs, err := os.ReadDir(testFolder)
	require.NoError(t, err, "Cannot read test folder %v", testFolder)
	for _, dir := range dirs {
		d := dir.Name()
		if dir.IsDir() && !strings.HasPrefix(d, "manual.") {
			t.Run(d, func(t *testing.T) {
				mainPath := filepath.Join(testFolder, d, "main.go")
				_, err := os.Stat(mainPath)
				require.NoError(t, err, "Cannot find plugin main file at %v", mainPath)
				th := Setup(t).InitBasic().DeleteBots()
				defer th.TearDown()
				setDefaultPluginConfig(th, dir.Name())
				err = pluginAPIHookTest(t, th, mainPath, dir.Name(), defaultSchema)
				require.NoError(t, err)
			})
		}
	}
}

func TestPluginAPIKVCompareAndSet(t *testing.T) {
	th := Setup(t)
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
	th := Setup(t)
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
		Username:    "a" + model.NewRandomString(10),
		DisplayName: "bot",
		Description: "bot",
	})
	require.Nil(t, err)

	_, err = api.CreateBot(&model.Bot{
		Username:    "a" + model.NewRandomString(10),
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
	channelID := th.BasicChannel.Id
	filename := "testGetFile"
	fileInfo, err := api.UploadFile(data, channelID, filename)
	require.Nil(t, err)
	defer func() {
		err := th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, fileInfo.Id)
		require.NoError(t, err)
		appErr := th.App.RemoveFile(fileInfo.Path)
		require.Nil(t, appErr)
	}()

	actualData, err := api.GetFile(fileInfo.Id)
	require.Nil(t, err)
	assert.Equal(t, data, actualData)

	userID := th.BasicUser.Id
	post, err := api.CreatePost(&model.Post{
		Message:   "test",
		UserId:    userID,
		ChannelId: channelID,
		FileIds:   model.StringArray{fileInfo.Id},
	})
	require.Nil(t, err)
	assert.Equal(t, model.StringArray{fileInfo.Id}, post.FileIds)

	actualPost, err := api.GetPost(post.Id)
	require.Nil(t, err)
	assert.Equal(t, model.StringArray{fileInfo.Id}, actualPost.FileIds)
}

func TestPluginCreatePostAddsFromPluginProp(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	channelID := th.BasicChannel.Id
	userID := th.BasicUser.Id
	post, err := api.CreatePost(&model.Post{
		Message:   "test",
		ChannelId: channelID,
		UserId:    userID,
	})
	require.Nil(t, err)

	actualPost, err := api.GetPost(post.Id)
	require.Nil(t, err)
	assert.Equal(t, "true", actualPost.GetProp("from_plugin"))
}

func TestPluginAPIGetConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	config := api.GetConfig()
	if config.LdapSettings.BindPassword != nil && *config.LdapSettings.BindPassword != "" {
		assert.Equal(t, *config.LdapSettings.BindPassword, model.FakeSetting)
	}

	assert.Equal(t, *config.FileSettings.PublicLinkSalt, model.FakeSetting)

	if *config.FileSettings.AmazonS3SecretAccessKey != "" {
		assert.Equal(t, *config.FileSettings.AmazonS3SecretAccessKey, model.FakeSetting)
	}

	if config.EmailSettings.SMTPPassword != nil && *config.EmailSettings.SMTPPassword != "" {
		assert.Equal(t, *config.EmailSettings.SMTPPassword, model.FakeSetting)
	}

	if *config.GitLabSettings.Secret != "" {
		assert.Equal(t, *config.GitLabSettings.Secret, model.FakeSetting)
	}

	assert.Equal(t, *config.SqlSettings.DataSource, model.FakeSetting)
	assert.Equal(t, *config.SqlSettings.AtRestEncryptKey, model.FakeSetting)
	assert.Equal(t, *config.ElasticsearchSettings.Password, model.FakeSetting)

	for i := range config.SqlSettings.DataSourceReplicas {
		assert.Equal(t, config.SqlSettings.DataSourceReplicas[i], model.FakeSetting)
	}

	for i := range config.SqlSettings.DataSourceSearchReplicas {
		assert.Equal(t, config.SqlSettings.DataSourceSearchReplicas[i], model.FakeSetting)
	}
}

func TestPluginAPIGetUnsanitizedConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	config := api.GetUnsanitizedConfig()
	if config.LdapSettings.BindPassword != nil && *config.LdapSettings.BindPassword != "" {
		assert.NotEqual(t, *config.LdapSettings.BindPassword, model.FakeSetting)
	}

	assert.NotEqual(t, *config.FileSettings.PublicLinkSalt, model.FakeSetting)

	if *config.FileSettings.AmazonS3SecretAccessKey != "" {
		assert.NotEqual(t, *config.FileSettings.AmazonS3SecretAccessKey, model.FakeSetting)
	}

	if config.EmailSettings.SMTPPassword != nil && *config.EmailSettings.SMTPPassword != "" {
		assert.NotEqual(t, *config.EmailSettings.SMTPPassword, model.FakeSetting)
	}

	if *config.GitLabSettings.Secret != "" {
		assert.NotEqual(t, *config.GitLabSettings.Secret, model.FakeSetting)
	}

	assert.NotEqual(t, *config.SqlSettings.DataSource, model.FakeSetting)
	assert.NotEqual(t, *config.SqlSettings.AtRestEncryptKey, model.FakeSetting)
	assert.NotEqual(t, *config.ElasticsearchSettings.Password, model.FakeSetting)

	for i := range config.SqlSettings.DataSourceReplicas {
		assert.NotEqual(t, config.SqlSettings.DataSourceReplicas[i], model.FakeSetting)
	}

	for i := range config.SqlSettings.DataSourceSearchReplicas {
		assert.NotEqual(t, config.SqlSettings.DataSourceSearchReplicas[i], model.FakeSetting)
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
	th := Setup(t)
	defer th.TearDown()

	setupMultiPluginAPITest(t,
		[]string{`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"bytes"
			"net/http"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/v2/test":
				if r.URL.Query().Get("abc") != "xyz" {
					return
				}

				if r.Header.Get("Mattermost-Plugin-ID") != "testplugininterclient" {
					return
				}

				buf := bytes.Buffer{}
				buf.ReadFrom(r.Body)
				resp := "we got:" + buf.String()
				w.WriteHeader(598)
				w.Write([]byte(resp))
				if r.URL.Path != "/api/v2/test" {
					return
				}
			case "/nobody":
				w.WriteHeader(599)
			}
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
			"bytes"
			"net/http"
			"io"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			buf := bytes.Buffer{}
			buf.WriteString("This is the request")
			req, err := http.NewRequest("GET", "/testplugininterserver/api/v2/test?abc=xyz", &buf)
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
			respbody, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, err.Error()
			}
			if resp.StatusCode != 598 {
				return nil, "wrong status " + string(respbody)
			}

			if string(respbody) !=  "we got:This is the request" {
				return nil, "wrong response " + string(respbody)
			}

			req, err = http.NewRequest("GET", "/testplugininterserver/nobody", nil)
			if err != nil {
				return nil, err.Error()
			}

			resp = p.API.PluginHTTP(req)
			if resp == nil {
				return nil, "Nil resp"
			}

			if resp.StatusCode != 599 {
				return nil, "wrong status " + string(respbody)
			}

			return nil, "ok"
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
		},
		[]string{
			`{"id": "testplugininterserver", "server": {"executable": "backend.exe"}}`,
			`{"id": "testplugininterclient", "server": {"executable": "backend.exe"}}`,
		},
		[]string{
			"testplugininterserver",
			"testplugininterclient",
		},
		true,
		th.App,
		th.Context,
	)

	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin("testplugininterclient")
	require.NoError(t, err)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	assert.Equal(t, "ok", ret)
}

func TestAPIMetrics(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("", func(t *testing.T) {
		metricsMock := &mocks.MetricsInterface{}

		pluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		webappPluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer os.RemoveAll(pluginDir)
		defer os.RemoveAll(webappPluginDir)

		env, err := plugin.NewEnvironment(th.NewPluginAPI, NewDriverImpl(th.Server), pluginDir, webappPluginDir, th.App.Log(), metricsMock)
		require.NoError(t, err)

		th.App.ch.SetPluginsEnvironment(env)

		pluginID := model.NewId()
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		code :=
			`
	package main

	import (
		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) UserHasBeenCreated(c *plugin.Context, user *model.User) {
		user.Nickname = "plugin-callback-success"
		p.API.UpdateUser(user)
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
`
		utils.CompileGo(t, code, backend)
		err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(`{"id": "`+pluginID+`", "server": {"executable": "backend.exe"}}`), 0600)
		require.NoError(t, err)

		// Don't care about these mocks
		metricsMock.On("ObservePluginHookDuration", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
		metricsMock.On("ObservePluginMultiHookIterationDuration", mock.Anything, mock.Anything, mock.Anything).Return()
		metricsMock.On("ObservePluginMultiHookDuration", mock.Anything).Return()

		// Setup mocks
		metricsMock.On("ObservePluginAPIDuration", pluginID, "UpdateUser", true, mock.Anything).Return()

		_, _, activationErr := env.Activate(pluginID)
		require.NoError(t, activationErr)

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		user1 := &model.User{
			Email:       model.NewId() + "success+test@example.com",
			Nickname:    "Darth Vader1",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		_, appErr := th.App.CreateUser(th.Context, user1)
		require.Nil(t, appErr)
		time.Sleep(1 * time.Second)
		user1, appErr = th.App.GetUser(user1.Id)
		require.Nil(t, appErr)
		require.Equal(t, "plugin-callback-success", user1.Nickname)

		// Disable plugin
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		metricsMock.AssertExpectations(t)
	})
}

func TestPluginAPIGetPostsForChannel(t *testing.T) {
	require := require.New(t)

	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	numPosts := 10

	// GetPostsForChannel returns posts ordered with the most recent first, so we
	// need to invert the expected slice, the oldest post being BasicPost
	expectedPosts := make([]*model.Post, numPosts)
	expectedPosts[numPosts-1] = th.BasicPost
	for i := numPosts - 2; i >= 0; i-- {
		expectedPosts[i] = th.CreatePost(th.BasicChannel)
	}
	// CreatePost does not add Metadata, but initializes the structure. GetPostsForChannel
	// returns nil for an empty Metadata, so we need to match that behaviour
	for _, post := range expectedPosts {
		post.Metadata = nil
	}

	postList, err := api.GetPostsForChannel(th.BasicChannel.Id, 0, 0)
	require.Nil(err)
	require.Nil(postList.ToSlice())

	postList, err = api.GetPostsForChannel(th.BasicChannel.Id, 0, numPosts/2)
	require.Nil(err)
	require.Equal(expectedPosts[:numPosts/2], postList.ToSlice())

	postList, err = api.GetPostsForChannel(th.BasicChannel.Id, 1, numPosts/2)
	require.Nil(err)
	require.Equal(expectedPosts[numPosts/2:], postList.ToSlice())

	postList, err = api.GetPostsForChannel(th.BasicChannel.Id, 2, numPosts/2)
	require.Nil(err)
	require.Nil(postList.ToSlice())

	postList, err = api.GetPostsForChannel(th.BasicChannel.Id, 0, numPosts+1)
	require.Nil(err)
	require.Equal(expectedPosts, postList.ToSlice())
}

func TestPluginHTTPConnHijack(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	fullPath := filepath.Join(server.GetPackagePath(), "channels", "app", "plugin_api_tests", "manual.test_http_hijack_plugin", "main.go")

	pluginCode, err := os.ReadFile(fullPath)
	require.NoError(t, err)
	require.NotEmpty(t, pluginCode)

	tearDown, ids, errors := SetAppEnvironmentWithPlugins(t, []string{string(pluginCode)}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.NoError(t, errors[0])
	require.Len(t, ids, 1)

	pluginID := ids[0]
	require.NotEmpty(t, pluginID)

	reqURL := fmt.Sprintf("http://localhost:%d/plugins/%s", th.Server.ListenAddr.Port, pluginID)
	req, err := http.NewRequest("GET", reqURL, nil)
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, "OK", string(body))
}

func TestPluginHTTPUpgradeWebSocket(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	fullPath := filepath.Join(server.GetPackagePath(), "channels", "app", "plugin_api_tests", "manual.test_http_upgrade_websocket_plugin", "main.go")

	pluginCode, err := os.ReadFile(fullPath)
	require.NoError(t, err)
	require.NotEmpty(t, pluginCode)

	tearDown, ids, errors := SetAppEnvironmentWithPlugins(t, []string{string(pluginCode)}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.NoError(t, errors[0])
	require.Len(t, ids, 1)

	pluginID := ids[0]
	require.NotEmpty(t, pluginID)

	reqURL := fmt.Sprintf("ws://localhost:%d/plugins/%s", th.Server.ListenAddr.Port, pluginID)
	wsc, err := model.NewWebSocketClient(reqURL, "")
	require.NoError(t, err)
	require.NotNil(t, wsc)

	wsc.Listen()
	defer wsc.Close()

	resp := <-wsc.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk)

	for i := 0; i < 10; i++ {
		wsc.SendMessage("custom_action", map[string]any{"value": i})
		var resp *model.WebSocketResponse
		select {
		case resp = <-wsc.ResponseChannel:
		case <-time.After(2 * time.Second):
		}
		require.NotNil(t, resp)
		require.Equal(t, resp.Status, model.StatusOk)
		require.Equal(t, "custom_action", resp.Data["action"])
		require.Equal(t, float64(i), resp.Data["value"])
	}
}

type MockSlashCommandProvider struct {
	Args    *model.CommandArgs
	Message string
}

func (*MockSlashCommandProvider) GetTrigger() string {
	return "mock"
}

func (*MockSlashCommandProvider) GetCommand(a *App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          "mock",
		AutoComplete:     true,
		AutoCompleteDesc: "mock",
		AutoCompleteHint: "mock",
		DisplayName:      "mock",
	}
}

func (mscp *MockSlashCommandProvider) DoCommand(a *App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	mscp.Args = args
	mscp.Message = message
	return &model.CommandResponse{
		Text:         "mock",
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}

func TestPluginExecuteSlashCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	slashCommandMock := &MockSlashCommandProvider{}
	RegisterCommandProvider(slashCommandMock)

	newUser := th.CreateUser()
	th.LinkUserToTeam(newUser, th.BasicTeam)

	t.Run("run invite command", func(t *testing.T) {
		args := &model.CommandArgs{
			Command:   "/mock @" + newUser.Username,
			TeamId:    th.BasicTeam.Id,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
		}
		_, err := api.ExecuteSlashCommand(args)
		require.NoError(t, err)
		require.Equal(t, args, slashCommandMock.Args)
		require.Equal(t, "@"+newUser.Username, slashCommandMock.Message)
	})
}

func TestPluginAPISearchPostsInTeamByUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	basicPostText := &th.BasicPost.Message
	unknownTerm := "Unknown Message"

	testCases := []struct {
		description      string
		teamID           string
		userID           string
		params           model.SearchParameter
		expectedPostsLen int
	}{
		{
			"empty params",
			th.BasicTeam.Id,
			th.BasicUser.Id,
			model.SearchParameter{},
			0,
		},
		{
			"doesn't match any posts",
			th.BasicTeam.Id,
			th.BasicUser.Id,
			model.SearchParameter{Terms: &unknownTerm},
			0,
		},
		{
			"matched posts",
			th.BasicTeam.Id,
			th.BasicUser.Id,
			model.SearchParameter{Terms: basicPostText},
			1,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			searchResults, err := api.SearchPostsInTeamForUser(testCase.teamID, testCase.userID, testCase.params)
			assert.Nil(t, err)
			assert.Equal(t, testCase.expectedPostsLen, len(searchResults.Posts))
		})
	}
}

func TestPluginAPICreateCommandAndListCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	foundCommand := func(listXCommand func(teamID string) ([]*model.Command, error)) bool {
		cmds, appErr := listXCommand(th.BasicTeam.Id)
		require.NoError(t, appErr)

		for _, cmd := range cmds {
			if cmd.Trigger == "testcmd" {
				return true
			}
		}
		return false
	}

	require.False(t, foundCommand(api.ListCommands))

	cmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		Trigger: "testcmd",
		Method:  "G",
		URL:     "http://test.com/testcmd",
	}

	cmd, appErr := api.CreateCommand(cmd)
	require.NoError(t, appErr)

	newCmd, appErr := api.GetCommand(cmd.Id)
	require.NoError(t, appErr)
	require.Equal(t, "pluginid", newCmd.PluginId)
	require.Equal(t, "", newCmd.CreatorId)
	require.True(t, foundCommand(api.ListCommands))
	require.True(t, foundCommand(api.ListCustomCommands))
	require.False(t, foundCommand(api.ListPluginCommands))
}

func TestPluginAPIUpdateCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	cmd := &model.Command{
		TeamId:  th.BasicTeam.Id,
		Trigger: "testcmd",
		Method:  "G",
		URL:     "http://test.com/testcmd",
	}

	cmd, appErr := api.CreateCommand(cmd)
	require.NoError(t, appErr)

	newCmd, appErr := api.GetCommand(cmd.Id)
	require.NoError(t, appErr)
	require.Equal(t, "pluginid", newCmd.PluginId)
	require.Equal(t, "", newCmd.CreatorId)

	newCmd.Trigger = "NewTrigger"
	newCmd.PluginId = "CannotChangeMe"
	newCmd2, appErr := api.UpdateCommand(newCmd.Id, newCmd)
	require.NoError(t, appErr)
	require.Equal(t, "pluginid", newCmd2.PluginId)
	require.Equal(t, "newtrigger", newCmd2.Trigger)

	team1 := th.CreateTeam()

	newCmd2.PluginId = "CannotChangeMe"
	newCmd2.Trigger = "anotherNewTrigger"
	newCmd2.TeamId = team1.Id
	newCmd3, appErr := api.UpdateCommand(newCmd2.Id, newCmd2)
	require.NoError(t, appErr)
	require.Equal(t, "pluginid", newCmd3.PluginId)
	require.Equal(t, "anothernewtrigger", newCmd3.Trigger)
	require.Equal(t, team1.Id, newCmd3.TeamId)

	newCmd3.Trigger = "anotherNewTriggerAgain"
	newCmd3.TeamId = ""
	newCmd4, appErr := api.UpdateCommand(newCmd2.Id, newCmd2)
	require.NoError(t, appErr)
	require.Equal(t, "anothernewtriggeragain", newCmd4.Trigger)
	require.Equal(t, team1.Id, newCmd4.TeamId)
}

func TestPluginAPIIsEnterpriseReady(t *testing.T) {
	oldValue := model.BuildEnterpriseReady
	defer func() { model.BuildEnterpriseReady = oldValue }()

	model.BuildEnterpriseReady = "true"
	th := Setup(t)
	defer th.TearDown()
	api := th.SetupPluginAPI()

	assert.Equal(t, true, api.IsEnterpriseReady())
}

func TestPluginUploadsAPI(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	pluginCode := fmt.Sprintf(`
    package main

    import (
		  "fmt"
			"bytes"

      "github.com/mattermost/mattermost/server/public/model"
      "github.com/mattermost/mattermost/server/public/plugin"
    )

    type TestPlugin struct {
      plugin.MattermostPlugin
    }

	  func (p *TestPlugin) OnActivate() error {
		  data := []byte("some content to upload")
			us, err := p.API.CreateUploadSession(&model.UploadSession{
			  Id: "%s",
				UserId: "%s",
				ChannelId: "%s",
				Type: model.UploadTypeAttachment,
			  FileSize: int64(len(data)),
				Filename: "upload.test",
			})
			if err != nil {
			  return fmt.Errorf("failed to create upload session: %%w", err)
			}

			us2, err := p.API.GetUploadSession(us.Id)
			if err != nil {
			  return fmt.Errorf("failed to get upload session: %%w", err)
			}

			if us.Id != us2.Id {
			  return fmt.Errorf("upload sessions should match")
			}

			fi, err := p.API.UploadData(us, bytes.NewBuffer(data))
			if err != nil {
			  return fmt.Errorf("failed to upload data: %%w", err)
			}

			if fi == nil || fi.Id == "" {
			  return fmt.Errorf("fileinfo should be set")
			}

			fileData, appErr := p.API.GetFile(fi.Id)
			if appErr != nil {
			  return fmt.Errorf("failed to get file data: %%w", err)
			}

			if !bytes.Equal(data, fileData) {
			  return fmt.Errorf("file data should match")
			}

		  return nil
	  }

    func main() {
      plugin.ClientMain(&TestPlugin{})
    }
  `, model.NewId(), th.BasicUser.Id, th.BasicChannel.Id)

	pluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	webappPluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	newPluginAPI := func(manifest *model.Manifest) plugin.API {
		return th.App.NewPluginAPI(th.Context, manifest)
	}
	env, err := plugin.NewEnvironment(newPluginAPI, NewDriverImpl(th.App.Srv()), pluginDir, webappPluginDir, th.App.Log(), nil)
	require.NoError(t, err)

	th.App.ch.SetPluginsEnvironment(env)

	pluginID := "testplugin"
	pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`
	backend := filepath.Join(pluginDir, pluginID, "backend.exe")
	utils.CompileGo(t, pluginCode, backend)

	err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(pluginManifest), 0600)
	require.NoError(t, err)
	manifest, activated, reterr := env.Activate(pluginID)
	require.NoError(t, reterr)
	require.NotNil(t, manifest)
	require.True(t, activated)
}

//go:embed plugin_api_tests/manual.test_configuration_will_be_saved_hook/main.tmpl
var configurationWillBeSavedHookTemplate string

func TestConfigurationWillBeSavedHook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	getPluginCode := func(hookCode string) string {
		return fmt.Sprintf(configurationWillBeSavedHookTemplate, hookCode)
	}

	runPlugin := func(t *testing.T, code string) {
		pluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		webappPluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer os.RemoveAll(pluginDir)
		defer os.RemoveAll(webappPluginDir)

		newPluginAPI := func(manifest *model.Manifest) plugin.API {
			return th.App.NewPluginAPI(th.Context, manifest)
		}
		env, err := plugin.NewEnvironment(newPluginAPI, NewDriverImpl(th.App.Srv()), pluginDir, webappPluginDir, th.App.Log(), nil)
		require.NoError(t, err)

		th.App.ch.SetPluginsEnvironment(env)

		pluginID := "testplugin"
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		utils.CompileGo(t, code, backend)

		err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(pluginManifest), 0600)
		require.NoError(t, err)
		manifest, activated, reterr := env.Activate(pluginID)
		require.NoError(t, reterr)
		require.NotNil(t, manifest)
		require.True(t, activated)
	}

	t.Run("error", func(t *testing.T) {
		hookCode := `
    return nil, fmt.Errorf("plugin hook failed")
    `

		runPlugin(t, getPluginCode(hookCode))

		cfg := th.App.Config()
		_, _, appErr := th.App.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		require.Equal(t, "saveConfig: An error occurred running the plugin hook on configuration save., plugin hook failed", appErr.Error())

		require.Equal(t, cfg, th.App.Config())
	})

	t.Run("AppError", func(t *testing.T) {
		hookCode := `
    return nil, model.NewAppError("saveConfig", "custom_error", nil, "", 400)
    `

		runPlugin(t, getPluginCode(hookCode))

		cfg := th.App.Config()
		_, _, appErr := th.App.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		require.Equal(t, "custom_error", appErr.Id)

		require.Equal(t, cfg, th.App.Config())
	})

	t.Run("no error, no config change", func(t *testing.T) {
		hookCode := `
    return nil, nil
    `

		runPlugin(t, getPluginCode(hookCode))

		cfg := th.App.Config()
		_, newCfg, appErr := th.App.SaveConfig(cfg, false)
		require.Nil(t, appErr)
		require.Equal(t, cfg, newCfg)
	})

	t.Run("config change", func(t *testing.T) {
		hookCode := `
    cfg := newCfg.Clone()
		cfg.PluginSettings.Plugins["custom_plugin"] = map[string]any{
		  "custom_key": "custom_val",
		}
    return cfg, nil
    `

		runPlugin(t, getPluginCode(hookCode))

		cfg := th.App.Config()
		_, newCfg, appErr := th.App.SaveConfig(cfg, false)
		require.Nil(t, appErr)
		require.NotEqual(t, cfg, newCfg)
		require.Equal(t, map[string]any{
			"custom_key": "custom_val",
		}, newCfg.PluginSettings.Plugins["custom_plugin"])
	})
}

func TestSendPushNotification(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping TestSendPushNotification test in short mode")
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()
	api := th.SetupPluginAPI()

	// Create 3 users, each having 2 sessions.
	type userSession struct {
		user    *model.User
		session *model.Session
	}
	var userSessions []userSession
	for i := 0; i < 3; i++ {
		u := th.CreateUser()
		sess, err := th.App.CreateSession(th.Context, &model.Session{
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, err)
		// We don't need to track the 2nd session.
		_, err = th.App.CreateSession(th.Context, &model.Session{
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, err)
		_, err = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, u.Id)
		require.Nil(t, err)
		th.AddUserToChannel(u, th.BasicChannel)
		userSessions = append(userSessions, userSession{
			user:    u,
			session: sess,
		})
	}

	handler := &testPushNotificationHandler{
		t:        t,
		behavior: "simple",
	}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationContents = model.FullNotification
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	var wg sync.WaitGroup
	for _, data := range userSessions {
		wg.Add(1)
		go func(user model.User) {
			defer wg.Done()
			post := th.CreatePost(th.BasicChannel)
			post.Message = "started a conversation"
			notification := &model.PushNotification{
				Category:    model.CategoryCanReply,
				Version:     model.PushMessageV2,
				Type:        model.PushTypeMessage,
				TeamId:      th.BasicChannel.TeamId,
				ChannelId:   th.BasicChannel.Id,
				PostId:      post.Id,
				RootId:      post.RootId,
				SenderId:    post.UserId,
				SenderName:  "Sender Name",
				PostType:    post.Type,
				ChannelType: th.BasicChannel.Type,
				Message:     "Custom message",
			}
			appErr := api.SendPushNotification(notification, user.Id)
			require.Nil(t, appErr)
		}(*data.user)
	}
	wg.Wait()

	// Hack to let the worker goroutines complete.
	time.Sleep(1 * time.Second)
	// Server side verification.
	var numMessages int
	for _, n := range handler.notifications() {
		switch n.Type {
		case model.PushTypeMessage:
			numMessages++
			assert.Equal(t, th.BasicChannel.Id, n.ChannelId)
			assert.Equal(t, "Custom message", n.Message)
		default:
			assert.Fail(t, "should not receive any other push notification types")
		}
	}
	assert.Equal(t, 6, numMessages)
}

func TestPluginServeMetrics(t *testing.T) {
	th := Setup(t, StartMetrics)
	defer th.TearDown()

	var prevEnable *bool
	var prevAddress *string
	th.App.UpdateConfig(func(cfg *model.Config) {
		prevEnable = cfg.MetricsSettings.Enable
		prevAddress = cfg.MetricsSettings.ListenAddress
		cfg.MetricsSettings.Enable = model.NewPointer(true)
		cfg.MetricsSettings.ListenAddress = model.NewPointer(":30067")
	})
	defer th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.MetricsSettings.Enable = prevEnable
		cfg.MetricsSettings.ListenAddress = prevAddress
	})

	fullPath := filepath.Join(server.GetPackagePath(), "channels", "app", "plugin_api_tests", "manual.test_serve_metrics_plugin", "main.go")

	pluginCode, err := os.ReadFile(fullPath)
	require.NoError(t, err)
	require.NotEmpty(t, pluginCode)

	tearDown, ids, errors := SetAppEnvironmentWithPlugins(t, []string{string(pluginCode)}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.NoError(t, errors[0])
	require.Len(t, ids, 1)

	pluginID := ids[0]
	require.NotEmpty(t, pluginID)

	reqURL := fmt.Sprintf("http://localhost%s/plugins/%s/metrics", *th.App.Config().MetricsSettings.ListenAddress, pluginID)
	req, err := http.NewRequest("GET", reqURL, nil)
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, "METRICS", string(body))

	reqURL = fmt.Sprintf("http://localhost%s/plugins/%s/metrics/subpath", *th.App.Config().MetricsSettings.ListenAddress, pluginID)
	req, err = http.NewRequest("GET", reqURL, nil)
	require.NoError(t, err)

	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err = io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, "METRICS SUBPATH", string(body))
}

func TestPluginGetChannelsForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.CreateUser()

	team1 := th.CreateTeam()
	th.LinkUserToTeam(user, team1)
	team2 := th.CreateTeam()
	th.LinkUserToTeam(user, team2)

	channel1 := th.CreateChannel(th.Context, team1)
	th.AddUserToChannel(user, channel1)
	channel2 := th.CreateChannel(th.Context, team2)
	th.AddUserToChannel(user, channel2)

	dmChannel := th.CreateDmChannel(user)

	pluginCode := `
	package main
	import (
		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
		"github.com/pkg/errors"
	)

	const (
		userID = "` + user.Id + `"
		teamID1 = "` + team1.Id + `"
		teamID2 = "` + team2.Id + `"
		channelID1 = "` + channel1.Id + `"
		channelID2 = "` + channel2.Id + `"
		dmChannelID = "` + dmChannel.Id + `"
	)

	type TestPlugin struct {
		plugin.MattermostPlugin
	}

	func checkForChannels(channels []*model.Channel, expectedLength int, channel1Expected, channel2Expected, dmChannelExpected bool) string {
		if len(channels) != expectedLength {
			return "Returned the wrong number of channels"
		}

		var channel1Found, channel2Found, dmChannelFound bool
		for _, channel := range channels {
			if channel.Id == channelID1 {
				channel1Found = true
			} else if channel.Id == channelID2 {
				channel2Found = true
			} else if channel.Id == dmChannelID {
				dmChannelFound = true
			}
		}

		if channel1Found && !channel1Expected {
			return "Channel 1 found"
		} else if !channel1Found && channel1Expected {
			return "Channel 1 not found"
		} else if channel2Found && !channel2Expected {
			return "Channel 2 found"
		} else if !channel2Found && channel2Expected {
			return "Channel 2 not found"
		} else if dmChannelFound && !dmChannelExpected {
			return "DM Channel found"
		} else if !dmChannelFound && dmChannelExpected {
			return "DM Channel not found"
		} else {
			return ""
		}
	}

	func (p *TestPlugin) OnActivate() error {
		if channels, appErr := p.API.GetChannelsForTeamForUser(teamID1, userID, true); appErr != nil {
			return appErr
		} else if msg := checkForChannels(channels, 4, true, false, true); msg != "" {
			return errors.New(msg + " when called with team ID 1")
		}

		if channels, appErr := p.API.GetChannelsForTeamForUser(teamID2, userID, true); appErr != nil {
			return appErr
		} else if msg := checkForChannels(channels, 4, false, true, true); msg != "" {
			return errors.New(msg + " when called with team ID 2")
		}

		if channels, appErr := p.API.GetChannelsForTeamForUser("", userID, true); appErr != nil {
			return appErr
		} else if msg := checkForChannels(channels, 7, true, true, true); msg != "" {
			return errors.New(msg + " when called with empty team ID")
		}

		return nil
	}

	func main() {
		plugin.ClientMain(&TestPlugin{})
	}`
	pluginID := "testplugin"
	pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

	setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)
}

func TestPluginPatchChannelMembersNotifications(t *testing.T) {
	t.Run("should be able to set fields for multiple members", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel)
		th.AddUserToChannel(th.BasicUser2, channel)

		member1, err := th.App.GetChannelMember(th.Context, channel.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.Equal(t, "", member1.NotifyProps["test_field"])
		require.Equal(t, model.IgnoreChannelMentionsDefault, member1.NotifyProps[model.IgnoreChannelMentionsNotifyProp])
		member2, err := th.App.GetChannelMember(th.Context, channel.Id, th.BasicUser2.Id)
		require.Nil(t, err)
		require.Equal(t, "", member2.NotifyProps["test_field"])
		require.Equal(t, model.IgnoreChannelMentionsDefault, member2.NotifyProps[model.IgnoreChannelMentionsNotifyProp])

		pluginCode := `
			package main
			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			const (
				channelID = "` + channel.Id + `"
				userID1 = "` + th.BasicUser.Id + `"
				userID2 = "` + th.BasicUser2.Id + `"
			)

			type TestPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *TestPlugin) OnActivate() error {
				return p.API.PatchChannelMembersNotifications(
					[]*model.ChannelMemberIdentifier{
						{ChannelId: channelID, UserId: userID1},
						{ChannelId: channelID, UserId: userID2},
					},
					map[string]string{
						"test_field":                          "test_value",
						model.IgnoreChannelMentionsNotifyProp: model.IgnoreChannelMentionsOn,
					},
				)
			}

			func main() {
				plugin.ClientMain(&TestPlugin{})
			}`
		pluginID := "testplugin"
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)

		updated1, err := th.App.GetChannelMember(th.Context, member1.ChannelId, member1.UserId)
		require.Nil(t, err)
		updated2, err := th.App.GetChannelMember(th.Context, member2.ChannelId, member2.UserId)
		require.Nil(t, err)

		assert.Equal(t, member1.NotifyProps[model.MarkUnreadNotifyProp], updated1.NotifyProps[model.MarkUnreadNotifyProp])
		assert.Equal(t, "test_value", updated1.NotifyProps["test_field"])
		assert.Equal(t, model.IgnoreChannelMentionsOn, updated1.NotifyProps[model.IgnoreChannelMentionsNotifyProp])
		assert.Equal(t, member2.NotifyProps[model.MarkUnreadNotifyProp], updated2.NotifyProps[model.MarkUnreadNotifyProp])
		assert.Equal(t, "test_value", updated2.NotifyProps["test_field"])
		assert.Equal(t, model.IgnoreChannelMentionsOn, updated2.NotifyProps[model.IgnoreChannelMentionsNotifyProp])
	})

	t.Run("should be able to clear a field", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		channel := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel)

		member, err := th.App.GetChannelMember(th.Context, channel.Id, th.BasicUser.Id)
		require.Nil(t, err)

		member.NotifyProps["test_field"] = "test_value"
		_, err = th.App.updateChannelMember(th.Context, member)
		require.Nil(t, err)

		member, err = th.App.GetChannelMember(th.Context, channel.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.Equal(t, "test_value", member.NotifyProps["test_field"])

		pluginCode := `
			package main
			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			const (
				channelID = "` + channel.Id + `"
				userID = "` + th.BasicUser.Id + `"
			)

			type TestPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *TestPlugin) OnActivate() error {
				return p.API.PatchChannelMembersNotifications(
					[]*model.ChannelMemberIdentifier{
						{ChannelId: channelID, UserId: userID},
					},
					map[string]string{
						"test_field": "",
					},
				)
			}

			func main() {
				plugin.ClientMain(&TestPlugin{})
			}`
		pluginID := "testplugin"
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)

		updated, err := th.App.GetChannelMember(th.Context, member.ChannelId, member.UserId)
		require.Nil(t, err)

		assert.Equal(t, "", updated.NotifyProps["test_field"])
	})
}
