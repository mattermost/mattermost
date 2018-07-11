// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

func TestPluginAPI(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	for name, f := range map[string]func(*testing.T, *App){
		"PluginAPI_LoadPluginConfiguration":         testLoadPluginConfiguration,
		"PluginAPI_LoadPluginConfigurationDefaults": testLoadPluginConfigurationDefaults,
	} {
		t.Run(name, func(t *testing.T) { f(t, th.App) })
	}
}

func testLoadPluginConfiguration(t *testing.T, app *App) {
	var pluginJson map[string]interface{}
	if err := json.Unmarshal([]byte(`{"mystringsetting": "str", "MyIntSetting": 32, "myboolsetting": true}`), &pluginJson); err != nil {
		t.Fatal(err)
	}
	app.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})
	plugintest.RunTestWithSupervisorWithSuppliedAPI(t,
		`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
			"fmt"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
			
			MyStringSetting string
			MyIntSetting int
			MyBoolSetting bool
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			return nil, fmt.Sprintf("%v%v%v", p.MyStringSetting, p.MyIntSetting, p.MyBoolSetting)
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
	}}`,
		app.NewPluginAPI,
		func(t *testing.T, supervisor *plugin.Supervisor) {
			_, ret := supervisor.Hooks().MessageWillBePosted(nil, nil)
			assert.Equal(t, "str32true", ret)
		})
}

func testLoadPluginConfigurationDefaults(t *testing.T, app *App) {
	var pluginJson map[string]interface{}
	if err := json.Unmarshal([]byte(`{"mystringsetting": "override"}`), &pluginJson); err != nil {
		t.Fatal(err)
	}
	app.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["testloadpluginconfig"] = pluginJson
	})
	plugintest.RunTestWithSupervisorWithSuppliedAPI(t,
		`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
			"fmt"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
			
			MyStringSetting string
			MyIntSetting int
			MyBoolSetting bool
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			return nil, fmt.Sprintf("%v%v%v", p.MyStringSetting, p.MyIntSetting, p.MyBoolSetting)
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
	}}`,
		app.NewPluginAPI,
		func(t *testing.T, supervisor *plugin.Supervisor) {
			_, ret := supervisor.Hooks().MessageWillBePosted(nil, nil)
			assert.Equal(t, "override35true", ret)
		})
}
