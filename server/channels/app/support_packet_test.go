// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	smocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/config"
	emocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
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
	assert.ErrorContains(t, err, "failed to get plugin list for Support Packet")
}

func TestGenerateSupportPacketYaml(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	licenseUsers := 100
	license := model.NewTestLicense("ldap")
	license.Features.Users = model.NewPointer(licenseUsers)
	th.App.Srv().SetLicense(license)

	generateSupportPacket := func(t *testing.T) *model.SupportPacket {
		t.Helper()

		fileData, err := th.App.generateSupportPacketYaml(th.Context)
		require.NotNil(t, fileData)
		assert.Equal(t, "support_packet.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))
		assert.NoError(t, err)

		var packet model.SupportPacket
		require.NoError(t, yaml.Unmarshal(fileData.Body, &packet))
		require.NotNil(t, packet)
		return &packet
	}

	t.Run("Happy path", func(t *testing.T) {
		// Happy path where we have a Support Packet yaml file without any warnings
		packet := generateSupportPacket(t)

		/* Build information */
		assert.NotEmpty(t, packet.ServerOS)
		assert.NotEmpty(t, packet.ServerArchitecture)
		assert.Equal(t, model.CurrentVersion, packet.ServerVersion)
		// BuildHash is not present in tests

		/* DB */
		assert.NotEmpty(t, packet.DatabaseType)
		assert.NotEmpty(t, packet.DatabaseVersion)
		assert.NotEmpty(t, packet.DatabaseSchemaVersion)
		assert.Zero(t, packet.WebsocketConnections)
		assert.NotZero(t, packet.MasterDbConnections)
		assert.Zero(t, packet.ReplicaDbConnections)

		/* Cluster */
		assert.Empty(t, packet.ClusterID)

		/* File store */
		assert.Equal(t, "local", packet.FileDriver)
		assert.Equal(t, "OK", packet.FileStatus)

		/* LDAP */
		assert.Empty(t, packet.LdapVendorName)
		assert.Empty(t, packet.LdapVendorVersion)

		/* Elastic Search */
		assert.Empty(t, packet.ElasticServerVersion)
		assert.Empty(t, packet.ElasticServerPlugins)

		/* License */
		assert.Equal(t, "My awesome Company", packet.LicenseTo)
		assert.Equal(t, licenseUsers, packet.LicenseSupportedUsers)
		assert.Equal(t, false, packet.LicenseIsTrial)

		/* Server stats */
		assert.Equal(t, 3, packet.ActiveUsers) // from InitBasic()
		assert.Equal(t, 0, packet.DailyActiveUsers)
		assert.Equal(t, 0, packet.MonthlyActiveUsers)
		assert.Equal(t, 0, packet.InactiveUserCount)
		assert.Equal(t, 5, packet.TotalPosts)    // from InitBasic()
		assert.Equal(t, 3, packet.TotalChannels) // from InitBasic()
		assert.Equal(t, 1, packet.TotalTeams)    // from InitBasic()

		/* Jobs */
		assert.Empty(t, packet.DataRetentionJobs)
		assert.Empty(t, packet.MessageExportJobs)
		assert.Empty(t, packet.ElasticPostIndexingJobs)
		assert.Empty(t, packet.ElasticPostAggregationJobs)
		assert.Empty(t, packet.BlevePostIndexingJobs)
		assert.Empty(t, packet.LdapSyncJobs)
		assert.Empty(t, packet.MigrationJobs)
	})

	t.Run("post count should be present if number of users extends AnalyticsSettings.MaxUsersForStatistics", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AnalyticsSettings.MaxUsersForStatistics = model.NewPointer(1)
		})

		for i := 0; i < 5; i++ {
			p := th.CreatePost(th.BasicChannel)
			require.NotNil(t, p)
		}

		// InitBasic() already creats 5 posts
		packet := generateSupportPacket(t)
		assert.Equal(t, 10, packet.TotalPosts)
	})

	t.Run("filestore fails", func(t *testing.T) {
		fb := &fmocks.FileBackend{}
		platform.SetFileStore(fb)(th.Server.Platform())
		fb.On("DriverName").Return("mock")
		fb.On("TestConnection").Return(errors.New("all broken"))

		packet := generateSupportPacket(t)

		assert.Equal(t, "mock", packet.FileDriver)
		assert.Equal(t, "FAIL: all broken", packet.FileStatus)
	})

	t.Run("no LDAP info if LDAP sync is disabled", func(t *testing.T) {
		ldapMock := &emocks.LdapInterface{}
		th.App.Channels().Ldap = ldapMock

		packet := generateSupportPacket(t)

		assert.Equal(t, "", packet.LdapVendorName)
		assert.Equal(t, "", packet.LdapVendorVersion)
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.LdapSettings.EnableSync = model.NewPointer(true)
	})

	t.Run("no LDAP vendor info found", func(t *testing.T) {
		ldapMock := &emocks.LdapInterface{}
		ldapMock.On(
			"GetVendorNameAndVendorVersion",
			mock.AnythingOfType("*request.Context"),
		).Return("", "", nil)
		th.App.Channels().Ldap = ldapMock

		packet := generateSupportPacket(t)

		assert.Equal(t, "unknown", packet.LdapVendorName)
		assert.Equal(t, "unknown", packet.LdapVendorVersion)
	})

	t.Run("found LDAP vendor info", func(t *testing.T) {
		ldapMock := &emocks.LdapInterface{}
		ldapMock.On(
			"GetVendorNameAndVendorVersion",
			mock.AnythingOfType("*request.Context"),
		).Return("some vendor", "v1.0.0", nil)
		th.App.Channels().Ldap = ldapMock

		packet := generateSupportPacket(t)

		assert.Equal(t, "some vendor", packet.LdapVendorName)
		assert.Equal(t, "v1.0.0", packet.LdapVendorVersion)
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
		*cfg.NotificationLogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)
	notificationsLogLocation := config.GetNotificationsLogFileLocation(dir)

	genMockLogFiles := func() {
		d1 := []byte("hello\ngo\n")
		genErr := os.WriteFile(logLocation, d1, 0777)
		require.NoError(t, genErr)
		genErr = os.WriteFile(notificationsLogLocation, d1, 0777)
		require.NoError(t, genErr)
	}
	genMockLogFiles()

	t.Run("generate Support Packet with logs", func(t *testing.T) {
		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		var rFileNames []string
		testFiles := []string{
			"support_packet.yaml",
			"metadata.yaml",
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
	})

	t.Run("generate Support Packet without logs", func(t *testing.T) {
		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})

		testFiles := []string{
			"support_packet.yaml",
			"metadata.yaml",
			"plugins.json",
			"sanitized_config.json",
			"cpu.prof",
			"heap.prof",
			"goroutines",
		}
		var rFileNames []string
		for _, fileData := range fileDatas {
			require.NotNil(t, fileData)
			assert.Positive(t, len(fileData.Body))

			rFileNames = append(rFileNames, fileData.Filename)
		}
		assert.ElementsMatch(t, testFiles, rFileNames)
	})

	t.Run("remove the log files and ensure that warning.txt file is generated", func(t *testing.T) {
		// Remove these two files and ensure that warning.txt file is generated
		err = os.Remove(logLocation)
		require.NoError(t, err)
		err = os.Remove(notificationsLogLocation)
		require.NoError(t, err)
		t.Cleanup(genMockLogFiles)

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		testFiles := []string{
			"support_packet.yaml",
			"metadata.yaml",
			"plugins.json",
			"sanitized_config.json",
			"cpu.prof",
			"heap.prof",
			"warning.txt",
			"goroutines",
		}
		var rFileNames []string
		for _, fileData := range fileDatas {
			require.NotNil(t, fileData)
			assert.Positive(t, len(fileData.Body))

			rFileNames = append(rFileNames, fileData.Filename)
		}
		assert.ElementsMatch(t, testFiles, rFileNames)
	})

	t.Run("steps that generated an error should still return file data", func(t *testing.T) {
		mockStore := smocks.Store{}

		// Mock the post store to trigger an error
		ps := &smocks.PostStore{}
		ps.On("AnalyticsPostCount", &model.PostCountOptions{}).Return(int64(0), errors.New("all broken"))
		ps.On("ClearCaches")
		mockStore.On("Post").Return(ps)

		mockStore.On("User").Return(th.App.Srv().Store().User())
		mockStore.On("Channel").Return(th.App.Srv().Store().Channel())
		mockStore.On("Post").Return(th.App.Srv().Store().Post())
		mockStore.On("Team").Return(th.App.Srv().Store().Team())
		mockStore.On("Job").Return(th.App.Srv().Store().Job())
		mockStore.On("FileInfo").Return(th.App.Srv().Store().FileInfo())
		mockStore.On("Webhook").Return(th.App.Srv().Store().Webhook())
		mockStore.On("System").Return(th.App.Srv().Store().System())
		mockStore.On("License").Return(th.App.Srv().Store().License())
		mockStore.On("Close").Return(nil)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)
		mockStore.On("GetDbVersion", false).Return("1.0.0", nil)
		th.App.Srv().SetStore(&mockStore)

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})

		var rFileNames []string
		for _, fileData := range fileDatas {
			require.NotNil(t, fileData)
			assert.Positive(t, len(fileData.Body))

			rFileNames = append(rFileNames, fileData.Filename)
		}
		assert.Contains(t, rFileNames, "warning.txt")
		assert.Contains(t, rFileNames, "support_packet.yaml")
	})
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

func TestCreateSupportPacketMetadata(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("Happy path", func(t *testing.T) {
		fileData, err := th.App.createSupportPacketMetadata(th.Context)
		require.NoError(t, err)
		require.NotNil(t, fileData)
		assert.Equal(t, "metadata.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))

		metadate, err := model.ParsePacketMetadata(fileData.Body)
		assert.NoError(t, err)
		require.NotNil(t, metadate)
		assert.Equal(t, model.SupportPacketType, metadate.Type)
		assert.Equal(t, model.CurrentVersion, metadate.ServerVersion)
		assert.NotEmpty(t, metadate.ServerID)
		assert.NotEmpty(t, metadate.GeneratedAt)
	})
}
