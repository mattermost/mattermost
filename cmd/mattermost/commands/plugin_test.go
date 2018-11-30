package commands

import (
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// cloneDefaultConfig copies the default configuration to a temporary file.
func cloneDefaultConfig() (string, error) {
	defaultConfigFilePath, err := utils.EnsureConfigFile("default.json")
	if err != nil {
		return "", err
	}

	defaultConfigFile, err := os.Open(defaultConfigFilePath)
	if err != nil {
		return "", err
	}

	tempConfig, err := ioutil.TempFile("", "test-plugin")
	if err != nil {
		return "", err
	}

	if _, err := io.Copy(tempConfig, defaultConfigFile); err != nil {
		return "", err
	}

	return tempConfig.Name(), nil
}

func TestPlugin(t *testing.T) {
	// Skip this test until we can figure out the unexpected dockerized build failures.
	t.Skip()

	configFilePath, err := cloneDefaultConfig()
	require.Nil(t, err)
	defer os.Remove(configFilePath)

	// Write back out the config with the database configured for the unittests.
	config, _, _, appErr := utils.LoadConfig(configFilePath)
	require.Nil(t, appErr)

	config.SqlSettings = *storetest.MySQLSettings()
	*config.PluginSettings.EnableUploads = true
	*config.PluginSettings.Directory = "./test-plugins"
	*config.PluginSettings.ClientDirectory = "./test-client-plugins"

	appErr = utils.SaveConfig(configFilePath, config)
	require.Nil(t, appErr)

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
