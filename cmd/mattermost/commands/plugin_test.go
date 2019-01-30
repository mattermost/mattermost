package commands

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlugin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	c := th.Config()
	*c.PluginSettings.EnableUploads = true
	*c.PluginSettings.Directory = "./test-plugins"
	*c.PluginSettings.ClientDirectory = "./test-client-plugins"
	th.SetConfig(c)

	os.MkdirAll("./test-plugins", os.ModePerm)
	os.MkdirAll("./test-client-plugins", os.ModePerm)

	path, _ := fileutils.FindDir("tests")

	os.Chdir(filepath.Join("..", "..", ".."))

	th.CheckCommand(t, "plugin", "add", filepath.Join(path, "testplugin.tar.gz"))

	th.CheckCommand(t, "plugin", "enable", "testplugin")
	cfg, _, _, err := config.LoadConfig(th.ConfigPath())
	require.Nil(t, err)
	assert.Equal(t, cfg.PluginSettings.PluginStates["testplugin"].Enable, true)

	th.CheckCommand(t, "plugin", "disable", "testplugin")
	cfg, _, _, err = config.LoadConfig(th.ConfigPath())
	require.Nil(t, err)
	assert.Equal(t, cfg.PluginSettings.PluginStates["testplugin"].Enable, false)

	th.CheckCommand(t, "plugin", "list")

	th.CheckCommand(t, "plugin", "delete", "testplugin")

	os.Chdir(filepath.Join("cmd", "mattermost", "commands"))
}
