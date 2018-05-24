package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestUploadPlugin(t *testing.T) {
	th := api4.Setup().InitSystemAdmin()
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

	path, _ := utils.FindDir("tests")
	file, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	CheckCommand(t, "plugin", "add", filepath.Join(path, "testplugin.tar.gz"))

	manifest, _ := th.SystemAdminClient.UploadPlugin(file)
	defer os.RemoveAll("plugins/testplugin")

	fmt.Println(manifest.Id)
}
