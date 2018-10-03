// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
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
	env.Activate(pluginId)

	app.Plugins = env
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
	hooks, err := th.App.Plugins.HooksForPlugin("testloadpluginconfig")
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
	hooks, err := th.App.Plugins.HooksForPlugin("testloadpluginconfig")
	assert.NoError(t, err)
	_, ret := hooks.MessageWillBePosted(nil, nil)
	assert.Equal(t, "override35true", ret)
}
