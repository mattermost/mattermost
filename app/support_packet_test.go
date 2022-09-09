// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
)

func TestCreatePluginsFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Happy path where we have a plugins file with no warning
	fileData, warning := th.App.createPluginsFile()
	require.NotNil(t, fileData)
	assert.Equal(t, "plugins.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.Empty(t, warning)

	// Turn off plugins so we can get an error
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	// Plugins off in settings so no fileData and we get a warning instead
	fileData, warning = th.App.createPluginsFile()
	assert.Nil(t, fileData)
	assert.Contains(t, warning, "c.App.GetPlugins() Error:")
}

func TestGenerateSupportPacketYaml(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	licenseUsers := 100
	license := model.NewTestLicense()
	license.Features.Users = model.NewInt(licenseUsers)
	th.App.Srv().SetLicense(license)

	// Happy path where we have a support packet yaml file without any warnings
	fileData, warning := th.App.generateSupportPacketYaml()
	require.NotNil(t, fileData)
	assert.Equal(t, "support_packet.yaml", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.Empty(t, warning)
	var packet model.SupportPacket
	require.NoError(t, yaml.Unmarshal(fileData.Body, &packet))
	assert.Equal(t, 3, packet.ActiveUsers) // from InitBasic.
	assert.Equal(t, licenseUsers, packet.LicenseSupportedUsers)
}
func TestGenerateSupportPacket(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	d1 := []byte("hello\ngo\n")
	err := os.WriteFile("mattermost.log", d1, 0777)
	require.NoError(t, err)
	err = os.WriteFile("notifications.log", d1, 0777)
	require.NoError(t, err)

	fileDatas := th.App.GenerateSupportPacket()
	testFiles := []string{"support_packet.yaml", "plugins.json", "sanitized_config.json", "mattermost.log", "notifications.log"}
	for i, fileData := range fileDatas {
		require.NotNil(t, fileData)
		assert.Equal(t, testFiles[i], fileData.Filename)
		assert.Positive(t, len(fileData.Body))
	}

	// Remove these two files and ensure that warning.txt file is generated
	err = os.Remove("notifications.log")
	require.NoError(t, err)
	err = os.Remove("mattermost.log")
	require.NoError(t, err)
	fileDatas = th.App.GenerateSupportPacket()
	testFiles = []string{"support_packet.yaml", "plugins.json", "sanitized_config.json", "warning.txt"}
	for i, fileData := range fileDatas {
		require.NotNil(t, fileData)
		assert.Equal(t, testFiles[i], fileData.Filename)
		assert.Positive(t, len(fileData.Body))
	}
}

func TestGetNotificationsLog(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Disable notifications file to get an error
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = false
	})

	fileData, warning := th.App.getNotificationsLog()
	assert.Nil(t, fileData)
	assert.Equal(t, warning, "Unable to retrieve notifications.log because LogSettings: EnableFile is false in config.json")

	// Enable notifications file but delete any notifications file to get an error trying to read the file
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = true
	})

	// If any previous notifications.log file, lets delete it
	os.Remove("notifications.log")

	fileData, warning = th.App.getNotificationsLog()
	assert.Nil(t, fileData)
	assert.Contains(t, warning, "os.ReadFile(notificationsLog) Error:")

	// Happy path where we have file and no warning
	d1 := []byte("hello\ngo\n")
	err := os.WriteFile("notifications.log", d1, 0777)
	defer os.Remove("notifications.log")
	require.NoError(t, err)

	fileData, warning = th.App.getNotificationsLog()
	require.NotNil(t, fileData)
	assert.Equal(t, "notifications.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.Empty(t, warning)
}

func TestGetMattermostLog(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// disable mattermost log file setting in config so we should get an warning
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = false
	})

	fileData, warning := th.App.getMattermostLog()
	assert.Nil(t, fileData)
	assert.Equal(t, "Unable to retrieve mattermost.log because LogSettings: EnableFile is false in config.json", warning)

	// We enable the setting but delete any mattermost log file
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = true
	})

	// If any previous mattermost.log file, lets delete it
	os.Remove("mattermost.log")

	fileData, warning = th.App.getMattermostLog()
	assert.Nil(t, fileData)
	assert.Contains(t, warning, "os.ReadFile(mattermostLog) Error:")

	// Happy path where we get a log file and no warning
	d1 := []byte("hello\ngo\n")
	err := os.WriteFile("mattermost.log", d1, 0777)
	defer os.Remove("mattermost.log")
	require.NoError(t, err)

	fileData, warning = th.App.getMattermostLog()
	require.NotNil(t, fileData)
	assert.Equal(t, "mattermost.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.Empty(t, warning)
}

func TestCreateSanitizedConfigFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Happy path where we have a sanitized config file with no warning
	fileData, warning := th.App.createSanitizedConfigFile()
	require.NotNil(t, fileData)
	assert.Equal(t, "sanitized_config.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.Empty(t, warning)
}
