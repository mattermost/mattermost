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

	cfg := th.Config()
	*cfg.PluginSettings.EnableUploads = true
	*cfg.PluginSettings.Directory = "./test-plugins"
	*cfg.PluginSettings.ClientDirectory = "./test-client-plugins"
	th.SetConfig(cfg)

	os.MkdirAll("./test-plugins", os.ModePerm)
	os.MkdirAll("./test-client-plugins", os.ModePerm)

	path, _ := fileutils.FindDir("tests")

	th.CheckCommand(t, "plugin", "add", filepath.Join(path, "testplugin.tar.gz"))

	th.CheckCommand(t, "plugin", "enable", "testplugin")
	fs, err := config.NewFileStore(th.ConfigPath(), false)
	require.Nil(t, err)
	assert.True(t, fs.Get().PluginSettings.PluginStates["testplugin"].Enable)
	fs.Close()

	th.CheckCommand(t, "plugin", "disable", "testplugin")
	fs, err = config.NewFileStore(th.ConfigPath(), false)
	require.Nil(t, err)
	assert.False(t, fs.Get().PluginSettings.PluginStates["testplugin"].Enable)
	fs.Close()

	th.CheckCommand(t, "plugin", "list")

	th.CheckCommand(t, "plugin", "delete", "testplugin")
}
