package commands

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlugin(t *testing.T) {
	config := &model.Config{}
	config.SetDefaults()
	*config.PluginSettings.EnableUploads = true
	*config.PluginSettings.Directory = "./test-plugins"
	*config.PluginSettings.ClientDirectory = "./test-client-plugins"

	configFilePath, cleanup := makeConfigFile(config)
	defer cleanup()

	os.MkdirAll("./test-plugins", os.ModePerm)
	os.MkdirAll("./test-client-plugins", os.ModePerm)

	th := api4.Setup().InitBasic()
	defer th.TearDown()

	path, _ := utils.FindDir("tests")

	os.Chdir(filepath.Join("..", "..", ".."))

	CheckCommand(t, "--config", configFilePath, "plugin", "add", filepath.Join(path, "testplugin.tar.gz"))

	CheckCommand(t, "--config", configFilePath, "plugin", "enable", "testplugin")
	cfg, _, _, err := utils.LoadConfig(configFilePath)
	require.Nil(t, err)
	assert.Equal(t, cfg.PluginSettings.PluginStates["testplugin"].Enable, true)

	CheckCommand(t, "--config", configFilePath, "plugin", "disable", "testplugin")
	cfg, _, _, err = utils.LoadConfig(configFilePath)
	require.Nil(t, err)
	assert.Equal(t, cfg.PluginSettings.PluginStates["testplugin"].Enable, false)

	CheckCommand(t, "--config", configFilePath, "plugin", "list")

	CheckCommand(t, "--config", configFilePath, "plugin", "delete", "testplugin")

	os.Chdir(filepath.Join("cmd", "mattermost", "commands"))
}
