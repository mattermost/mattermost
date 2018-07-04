package commands

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlugin(t *testing.T) {
	os.MkdirAll("./test-plugins", os.ModePerm)
	os.MkdirAll("./test-client-plugins", os.ModePerm)

	th := api4.Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	path, _ := utils.FindDir("tests")

	os.Chdir(filepath.Join("..", "..", ".."))

	CheckCommand(t, "--config", filepath.Join(path, "test-config.json"), "plugin", "add", filepath.Join(path, "testplugin.tar.gz"))

	CheckCommand(t, "--config", filepath.Join(path, "test-config.json"), "plugin", "enable", "testplugin")
	cfg, _, _, err := utils.LoadConfig(filepath.Join(path, "test-config.json"))
	require.Nil(t, err)
	assert.Equal(t, cfg.PluginSettings.PluginStates["testplugin"].Enable, true)

	CheckCommand(t, "--config", filepath.Join(path, "test-config.json"), "plugin", "disable", "testplugin")
	cfg, _, _, err = utils.LoadConfig(filepath.Join(path, "test-config.json"))
	require.Nil(t, err)
	assert.Equal(t, cfg.PluginSettings.PluginStates["testplugin"].Enable, false)

	CheckCommand(t, "--config", filepath.Join(path, "test-config.json"), "plugin", "list")

	CheckCommand(t, "--config", filepath.Join(path, "test-config.json"), "plugin", "delete", "testplugin")

	os.Chdir(filepath.Join("cmd", "mattermost", "commands"))
}
