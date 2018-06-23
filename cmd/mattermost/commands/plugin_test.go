package commands

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/require"
)

func TestAddPlugin(t *testing.T) {
	pluginDir, err := ioutil.TempDir("", "mm-plugin-test")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)

	webappDir, err := ioutil.TempDir("", "mm-webapp-test")
	require.NoError(t, err)
	defer os.RemoveAll(webappDir)

	th := api4.Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	enablePlugins := *th.App.Config().PluginSettings.Enable
	enableUploadPlugins := *th.App.Config().PluginSettings.EnableUploads
	statesJSON, _ := json.Marshal(th.App.Config().PluginSettings.PluginStates)
	states := map[string]*model.PluginState{}
	json.Unmarshal(statesJSON, &states)

	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = enablePlugins
			*cfg.PluginSettings.EnableUploads = enableUploadPlugins
			cfg.PluginSettings.PluginStates = states
		})
		th.App.SaveConfig(th.App.Config(), false)
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})
	th.App.InitPlugins(pluginDir, webappDir, nil)

	defer func() {
		th.App.ShutDownPlugins()
		th.App.PluginEnv = nil
	}()

	path, _ := utils.FindDir("tests")

	CheckCommand(t, "plugin", "add", filepath.Join(path, "testplugin.tar.gz"))
}
