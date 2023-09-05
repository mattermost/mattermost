// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestCreatePluginsFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	ctx := request.EmptyContext(th.TestLogger)

	// Happy path where we have a plugins file with no err
	fileData, err := th.App.createPluginsFile(ctx)
	require.NotNil(t, fileData)
	assert.Equal(t, "plugins.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)

	// Turn off plugins so we can get an error
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	// Plugins off in settings so no fileData and we get a warning instead
	fileData, err = th.App.createPluginsFile(ctx)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed to get plugin list for support package")
}

func TestGenerateSupportPacketYaml(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	ctx := request.EmptyContext(th.TestLogger)

	licenseUsers := 100
	license := model.NewTestLicense()
	license.Features.Users = model.NewInt(licenseUsers)
	th.App.Srv().SetLicense(license)

	// Happy path where we have a support packet yaml file without any warnings
	fileData, err := th.App.generateSupportPacketYaml(ctx)
	require.NotNil(t, fileData)
	assert.Equal(t, "support_packet.yaml", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)
	var packet model.SupportPacket
	require.NoError(t, yaml.Unmarshal(fileData.Body, &packet))
	assert.Equal(t, 3, packet.ActiveUsers) // from InitBasic.
	assert.Equal(t, licenseUsers, packet.LicenseSupportedUsers)
}

func TestGenerateSupportPacket(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	ctx := request.EmptyContext(th.TestLogger)

	d1 := []byte("hello\ngo\n")
	err := os.WriteFile("mattermost.log", d1, 0777)
	require.NoError(t, err)
	err = os.WriteFile("notifications.log", d1, 0777)
	require.NoError(t, err)

	fileDatas := th.App.GenerateSupportPacket(ctx)
	var rFileNames []string
	testFiles := []string{"support_packet.yaml", "plugins.json", "sanitized_config.json", "mattermost.log", "notifications.log"}
	for _, fileData := range fileDatas {
		require.NotNil(t, fileData)
		assert.Positive(t, len(fileData.Body))

		rFileNames = append(rFileNames, fileData.Filename)
	}
	assert.ElementsMatch(t, testFiles, rFileNames)

	// Remove these two files and ensure that warning.txt file is generated
	err = os.Remove("notifications.log")
	require.NoError(t, err)
	err = os.Remove("mattermost.log")
	require.NoError(t, err)
	fileDatas = th.App.GenerateSupportPacket(ctx)
	testFiles = []string{"support_packet.yaml", "plugins.json", "sanitized_config.json", "warning.txt"}
	rFileNames = nil
	for _, fileData := range fileDatas {
		require.NotNil(t, fileData)
		assert.Positive(t, len(fileData.Body))

		rFileNames = append(rFileNames, fileData.Filename)
	}
	assert.ElementsMatch(t, testFiles, rFileNames)
}

func TestGetNotificationsLog(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	ctx := request.EmptyContext(th.TestLogger)

	// Disable notifications file to get an error
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = false
	})

	fileData, err := th.App.getNotificationsLog(ctx)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "Unable to retrieve notifications.log because LogSettings: EnableFile is set to false")

	// Enable notifications file but delete any notifications file to get an error trying to read the file
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = true
	})

	// If any previous notifications.log file, lets delete it
	os.Remove("notifications.log")

	fileData, err = th.App.getNotificationsLog(ctx)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed read notifcation log file at path")

	// Happy path where we have file and no error
	d1 := []byte("hello\ngo\n")
	err = os.WriteFile("notifications.log", d1, 0777)
	defer os.Remove("notifications.log")
	require.NoError(t, err)

	fileData, err = th.App.getNotificationsLog(ctx)
	require.NotNil(t, fileData)
	assert.Equal(t, "notifications.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)
}

func TestGetMattermostLog(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	ctx := request.EmptyContext(th.TestLogger)

	// disable mattermost log file setting in config so we should get an warning
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = false
	})

	fileData, err := th.App.getMattermostLog(ctx)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "Unable to retrieve mattermost.log because LogSettings: EnableFile is set to false")

	// We enable the setting but delete any mattermost log file
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = true
	})

	// If any previous mattermost.log file, lets delete it
	os.Remove("mattermost.log")

	fileData, err = th.App.getMattermostLog(ctx)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed read mattermost log file at path mattermost.log")

	// Happy path where we get a log file and no warning
	d1 := []byte("hello\ngo\n")
	err = os.WriteFile("mattermost.log", d1, 0777)
	defer os.Remove("mattermost.log")
	require.NoError(t, err)

	fileData, err = th.App.getMattermostLog(ctx)
	require.NotNil(t, fileData)
	assert.Equal(t, "mattermost.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)
}

func TestCreateSanitizedConfigFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	ctx := request.EmptyContext(th.TestLogger)

	// Happy path where we have a sanitized config file with no err
	fileData, err := th.App.createSanitizedConfigFile(ctx)
	require.NotNil(t, fileData)
	assert.Equal(t, "sanitized_config.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)
}
