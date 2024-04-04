// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/config"
	fmocks "github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
)

func TestCreatePluginsFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Happy path where we have a plugins file with no err
	fileData, err := th.App.createPluginsFile(th.Context)
	require.NotNil(t, fileData)
	assert.Equal(t, "plugins.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)

	// Turn off plugins so we can get an error
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	// Plugins off in settings so no fileData and we get a warning instead
	fileData, err = th.App.createPluginsFile(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed to get plugin list for support package")
}

func TestGenerateSupportPacketYaml(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	licenseUsers := 100
	license := model.NewTestLicense()
	license.Features.Users = model.NewInt(licenseUsers)
	th.App.Srv().SetLicense(license)

	t.Run("Happy path", func(t *testing.T) {
		// Happy path where we have a support packet yaml file without any warnings

		fileData, err := th.App.generateSupportPacketYaml(th.Context)
		require.NotNil(t, fileData)
		assert.Equal(t, "support_packet.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))
		assert.NoError(t, err)
		var packet model.SupportPacket
		require.NoError(t, yaml.Unmarshal(fileData.Body, &packet))

		assert.Equal(t, 3, packet.ActiveUsers) // from InitBasic.
		assert.Equal(t, licenseUsers, packet.LicenseSupportedUsers)
		assert.Equal(t, false, packet.LicenseIsTrial)
		assert.Empty(t, packet.ClusterID)
		assert.Equal(t, "local", packet.FileDriver)
		assert.Equal(t, "OK", packet.FileStatus)
	})

	t.Run("filestore fails", func(t *testing.T) {
		fb := &fmocks.FileBackend{}
		platform.SetFileStore(fb)(th.Server.Platform())
		fb.On("DriverName").Return("mock")
		fb.On("TestConnection").Return(errors.New("all broken"))

		fileData, err := th.App.generateSupportPacketYaml(th.Context)
		require.NotNil(t, fileData)
		assert.Equal(t, "support_packet.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))
		assert.NoError(t, err)
		var packet model.SupportPacket
		require.NoError(t, yaml.Unmarshal(fileData.Body, &packet))

		assert.Equal(t, "mock", packet.FileDriver)
		assert.Equal(t, "FAIL: all broken", packet.FileStatus)
	})
}

func TestGenerateSupportPacket(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)
	notificationsLogLocation := config.GetNotificationsLogFileLocation(dir)

	d1 := []byte("hello\ngo\n")
	err = os.WriteFile(logLocation, d1, 0777)
	require.NoError(t, err)
	err = os.WriteFile(notificationsLogLocation, d1, 0777)
	require.NoError(t, err)

	fileDatas := th.App.GenerateSupportPacket(th.Context)
	var rFileNames []string
	testFiles := []string{
		"support_packet.yaml",
		"plugins.json",
		"sanitized_config.json",
		"mattermost.log",
		"notifications.log",
		"cpu.prof",
		"heap.prof",
		"goroutines",
	}
	for _, fileData := range fileDatas {
		require.NotNil(t, fileData)
		assert.Positive(t, len(fileData.Body))

		rFileNames = append(rFileNames, fileData.Filename)
	}
	assert.ElementsMatch(t, testFiles, rFileNames)

	// Remove these two files and ensure that warning.txt file is generated
	err = os.Remove(logLocation)
	require.NoError(t, err)
	err = os.Remove(notificationsLogLocation)
	require.NoError(t, err)
	fileDatas = th.App.GenerateSupportPacket(th.Context)
	testFiles = []string{
		"support_packet.yaml",
		"plugins.json",
		"sanitized_config.json",
		"cpu.prof",
		"heap.prof",
		"warning.txt",
		"goroutines",
	}
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

	// Disable notifications file setting in config so we should get an warning
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = false
	})

	fileData, err := th.App.getNotificationsLog(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "Unable to retrieve notifications.log because LogSettings: EnableFile is set to false")

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	// Enable notifications file but point to an empty directory to get an error trying to read the file
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetNotificationsLogFileLocation(dir)

	// There is no notifications.log file yet, so this fails
	fileData, err = th.App.getNotificationsLog(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed read notifcation log file at path "+logLocation)

	// Happy path where we have file and no error
	d1 := []byte("hello\ngo\n")
	err = os.WriteFile(logLocation, d1, 0777)
	require.NoError(t, err)

	fileData, err = th.App.getNotificationsLog(th.Context)
	assert.NoError(t, err)
	require.NotNil(t, fileData)
	assert.Equal(t, "notifications.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
}

func TestGetMattermostLog(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// disable mattermost log file setting in config so we should get an warning
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = false
	})

	fileData, err := th.App.getMattermostLog(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "Unable to retrieve mattermost.log because LogSettings: EnableFile is set to false")

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	// Enable log file but point to an empty directory to get an error trying to read the file
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)

	// There is no mattermost.log file yet, so this fails
	fileData, err = th.App.getMattermostLog(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed read mattermost log file at path "+logLocation)

	// Happy path where we get a log file and no warning
	d1 := []byte("hello\ngo\n")
	err = os.WriteFile(logLocation, d1, 0777)
	require.NoError(t, err)

	fileData, err = th.App.getMattermostLog(th.Context)
	require.NoError(t, err)
	require.NotNil(t, fileData)
	assert.Equal(t, "mattermost.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
}

func TestCreateSanitizedConfigFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Happy path where we have a sanitized config file with no err
	fileData, err := th.App.createSanitizedConfigFile(th.Context)
	require.NotNil(t, fileData)
	assert.Equal(t, "sanitized_config.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)
}
