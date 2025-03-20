// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost/server/public/model"
	smocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/config"
)

func TestGenerateSupportPacket(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.SetPhase2PermissionsMigrationStatus(true)

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

	getFileNames := func(t *testing.T, fileDatas []model.FileData) []string {
		var rFileNames []string
		for _, fileData := range fileDatas {
			require.NotNil(t, fileData)
			assert.Positive(t, len(fileData.Body))

			rFileNames = append(rFileNames, fileData.Filename)
		}
		return rFileNames
	}

	expectedFileNames := []string{
		"metadata.yaml",
		"stats.yaml",
		"jobs.yaml",
		"permissions.yaml",
		"plugins.json",
		"sanitized_config.json",
		"diagnostics.yaml",
		"cpu.prof",
		"heap.prof",
		"goroutines",
	}

	expectedFileNamesWithLogs := append(expectedFileNames, []string{
		"mattermost.log",
		"notifications.log",
	}...)

	t.Run("generate Support Packet with logs", func(t *testing.T) {
		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNamesWithLogs, rFileNames)
	})

	t.Run("generate Support Packet without logs", func(t *testing.T) {
		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})

		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNames, rFileNames)
	})

	t.Run("remove the log files and ensure that warning.txt file is generated", func(t *testing.T) {
		err = os.Remove(logLocation)
		require.NoError(t, err)
		err = os.Remove(notificationsLogLocation)
		require.NoError(t, err)
		t.Cleanup(genMockLogFiles)

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, append(expectedFileNames, "warning.txt"), rFileNames)
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
		mockStore.On("Command").Return(th.App.Srv().Store().Command())
		mockStore.On("Role").Return(th.App.Srv().Store().Role())
		mockStore.On("Scheme").Return(th.App.Srv().Store().Scheme())
		mockStore.On("Close").Return(nil)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)
		mockStore.On("GetDbVersion", false).Return("1.0.0", nil)
		mockStore.On("TotalMasterDbConnections").Return(30)
		mockStore.On("TotalReadDbConnections").Return(20)
		mockStore.On("TotalSearchDbConnections").Return(10)

		oldStore := th.App.Srv().Store()
		t.Cleanup(func() {
			th.App.Srv().SetStore(oldStore)
		})
		th.App.Srv().SetStore(&mockStore)

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.Contains(t, rFileNames, "warning.txt")
		assert.Contains(t, rFileNames, "stats.yaml")
		assert.ElementsMatch(t, append(expectedFileNames, "warning.txt"), rFileNames)
	})

	pluginID := "testplugin"
	pluginCode := `
		package main
		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type TestPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *TestPlugin) GenerateSupportData(c *plugin.Context) ([]*model.FileData, error) {
			return []*model.FileData{{
				Filename: "testplugin/diagnostics.yaml",
				Body:     []byte("foo"),
			}}, nil
		}

		func main() {
			plugin.ClientMain(&TestPlugin{})
		}`

	t.Run("Support Packet always contains plugin data if the plugin doesn't define the support_packet prop", func(t *testing.T) {
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`
		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)
		t.Cleanup(func() {
			appErr := th.App.ch.RemovePlugin(pluginID)
			require.Nil(t, appErr)
		})

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, append(expectedFileNames, "testplugin/diagnostics.yaml"), rFileNames)
	})

	t.Run("Support Packet contains plugin data if the plugin defines the support_packet prop and it gets queried", func(t *testing.T) {
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}, "props": {"support_packet": "some text"}}`
		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)
		t.Cleanup(func() {
			appErr := th.App.ch.RemovePlugin(pluginID)
			require.Nil(t, appErr)
		})

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs:   false,
			PluginPackets: []string{pluginID},
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, append(expectedFileNames, "testplugin/diagnostics.yaml"), rFileNames)
	})

	t.Run("Support Packet doesn't contain plugin data if the plugin defines the support_packet prop and it doesn't get queried", func(t *testing.T) {
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}, "props": {"support_packet": "some text"}}`
		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)
		t.Cleanup(func() {
			appErr := th.App.ch.RemovePlugin(pluginID)
			require.Nil(t, appErr)
		})

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNames, rFileNames)
	})

	t.Run("Plugin config values in the Support Packet are obfuscated, if the plugin marks them as secrets", func(t *testing.T) {
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}, "settings_schema": {"settings": [{"key": "foo", "type": "text"}, {"key": "bar", "type": "text", "secret": true}]}}`
		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)
		t.Cleanup(func() {
			appErr := th.App.ch.RemovePlugin(pluginID)
			require.Nil(t, appErr)
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins[pluginID] = map[string]any{
				"foo": "foo_value",
				"bar": "bar_value",
			}
		})

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})

		found := false
		for _, f := range fileDatas {
			if f.Filename != "sanitized_config.json" {
				continue
			}

			var config model.Config
			err = json.Unmarshal(f.Body, &config)
			require.NoError(t, err)

			assert.Equal(t, "foo_value", config.PluginSettings.Plugins[pluginID]["foo"])
			assert.Equal(t, model.FakeSetting, config.PluginSettings.Plugins[pluginID]["bar"])

			found = true
		}
		assert.True(t, found)
	})
}

func TestGetPluginsFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	getJobList := func(t *testing.T) *model.SupportPacketPluginList {
		t.Helper()

		fileData, err := th.App.getPluginsFile(th.Context)
		assert.NoError(t, err)
		require.NotNil(t, fileData)
		assert.Equal(t, "plugins.json", fileData.Filename)
		assert.Positive(t, len(fileData.Body))

		var pl model.SupportPacketPluginList
		err = json.Unmarshal(fileData.Body, &pl)
		require.NoError(t, err)

		return &pl
	}

	t.Run("no errors if no plugins are installed", func(t *testing.T) {
		pl := getJobList(t)
		assert.Len(t, pl.Enabled, 0)
		assert.Len(t, pl.Disabled, 0)
	})

	t.Run("two plugins are installed", func(t *testing.T) {
		path, _ := fileutils.FindDir("tests")

		bundle1, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		manifest1, appErr := th.App.InstallPlugin(bytes.NewReader(bundle1), false)
		require.Nil(t, appErr)
		require.Equal(t, "testplugin", manifest1.Id)
		appErr = th.App.EnablePlugin(manifest1.Id)
		require.Nil(t, appErr)

		bundle2, err := os.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
		require.NoError(t, err)
		manifest2, appErr := th.App.InstallPlugin(bytes.NewReader(bundle2), false)
		require.Nil(t, appErr)
		require.Equal(t, "testplugin2", manifest2.Id)

		pl := getJobList(t)
		require.Len(t, pl.Enabled, 1)
		assert.Equal(t, "testplugin", pl.Enabled[0].Id)
		require.Len(t, pl.Disabled, 1)
		assert.Equal(t, "testplugin2", pl.Disabled[0].Id)
	})

	t.Run("error if plugin are disabled", func(t *testing.T) {
		// Turn off plugins so we can get an error
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		// Plugins off in settings so no fileData and we get a warning instead
		fileData, err := th.App.getPluginsFile(th.Context)
		assert.Nil(t, fileData)
		assert.ErrorContains(t, err, "failed to get plugin list for Support Packet")
	})
}

func TestGetSupportPacketStats(t *testing.T) {
	th := Setup(t)

	generateStats := func(t *testing.T) *model.SupportPacketStats {
		t.Helper()

		require.NoError(t, th.App.Srv().Store().Post().RefreshPostStats())

		fileData, err := th.App.getSupportPacketStats(th.Context)
		require.NotNil(t, fileData)
		assert.Equal(t, "stats.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))
		assert.NoError(t, err)

		var packet model.SupportPacketStats
		err = yaml.Unmarshal(fileData.Body, &packet)
		require.NoError(t, err)

		return &packet
	}

	t.Run("fresh server", func(t *testing.T) {
		sp := generateStats(t)

		assert.Equal(t, int64(0), sp.RegisteredUsers)
		assert.Equal(t, int64(0), sp.ActiveUsers)
		assert.Equal(t, int64(0), sp.DailyActiveUsers)
		assert.Equal(t, int64(0), sp.MonthlyActiveUsers)
		assert.Equal(t, int64(0), sp.DeactivatedUsers)
		assert.Equal(t, int64(0), sp.Guests)
		assert.Equal(t, int64(0), sp.BotAccounts)
		assert.Equal(t, int64(0), sp.Posts)
		assert.Equal(t, int64(0), sp.Channels)
		assert.Equal(t, int64(0), sp.Teams)
		assert.Equal(t, int64(0), sp.SlashCommands)
		assert.Equal(t, int64(0), sp.IncomingWebhooks)
		assert.Equal(t, int64(0), sp.OutgoingWebhooks)
	})

	t.Run("Happy path", func(t *testing.T) {
		var user *model.User
		for i := 0; i < 4; i++ {
			user = th.CreateUser()
		}
		th.BasicUser = user

		for i := 0; i < 3; i++ {
			deactivatedUser := th.CreateUser()
			require.NotNil(t, deactivatedUser)
			_, appErr := th.App.UpdateActive(th.Context, deactivatedUser, false)
			require.Nil(t, appErr)
		}

		for i := 0; i < 2; i++ {
			guest := th.CreateGuest()
			require.NotNil(t, guest)
		}

		th.CreateBot()

		team := th.CreateTeam()
		channel := th.CreateChannel(th.Context, team)

		for i := 0; i < 3; i++ {
			p := th.CreatePost(channel)
			require.NotNil(t, p)
		}

		cmd, appErr := th.App.CreateCommand(&model.Command{
			CreatorId: user.Id,
			TeamId:    team.Id,
			Trigger:   "test",
			Method:    model.CommandMethodGet,
			URL:       "http://nowhere.com/",
		})
		require.Nil(t, appErr)
		require.NotNil(t, cmd)

		webhookIn, appErr := th.App.CreateIncomingWebhookForChannel(user.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
		require.Nil(t, appErr)
		require.NotNil(t, webhookIn)

		webhookOut, appErr := th.App.CreateOutgoingWebhook(&model.OutgoingWebhook{
			ChannelId:    channel.Id,
			TeamId:       channel.TeamId,
			CreatorId:    th.BasicUser.Id,
			CallbackURLs: []string{"http://nowhere.com/"},
		})
		require.Nil(t, appErr)
		require.NotNil(t, webhookOut)

		sp := generateStats(t)

		assert.Equal(t, int64(9), sp.RegisteredUsers)
		assert.Equal(t, int64(6), sp.ActiveUsers)
		assert.Equal(t, int64(0), sp.DailyActiveUsers)
		assert.Equal(t, int64(0), sp.MonthlyActiveUsers)
		assert.Equal(t, int64(3), sp.DeactivatedUsers)
		assert.Equal(t, int64(2), sp.Guests)
		assert.Equal(t, int64(1), sp.BotAccounts)
		assert.Equal(t, int64(4), sp.Posts)    // 1 from the bot creation and 3 created directly
		assert.Equal(t, int64(3), sp.Channels) // 2 from the team creation and 1 created directly
		assert.Equal(t, int64(1), sp.Teams)
		assert.Equal(t, int64(1), sp.SlashCommands)
		assert.Equal(t, int64(1), sp.IncomingWebhooks)
		assert.Equal(t, int64(1), sp.OutgoingWebhooks)
	})

	// Reset test server
	th.TearDown()
	th = Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("post count should be present if number of users extends AnalyticsSettings.MaxUsersForStatistics", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AnalyticsSettings.MaxUsersForStatistics = model.NewPointer(1)
		})

		for i := 0; i < 5; i++ {
			p := th.CreatePost(th.BasicChannel)
			require.NotNil(t, p)
		}

		// InitBasic() already creats 5 posts
		packet := generateStats(t)
		assert.Equal(t, int64(10), packet.Posts)
	})
}

func TestGetSupportPacketJobList(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	getJobList := func(t *testing.T) *model.SupportPacketJobList {
		t.Helper()

		fileData, err := th.App.getSupportPacketJobList(th.Context)
		require.NoError(t, err)
		require.NotNil(t, fileData)
		assert.Equal(t, "jobs.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))

		var jobs model.SupportPacketJobList
		err = yaml.Unmarshal(fileData.Body, &jobs)
		require.NoError(t, err)

		return &jobs
	}

	t.Run("no jobs run yet", func(t *testing.T) {
		jobs := getJobList(t)

		assert.Empty(t, jobs.LDAPSyncJobs)
		assert.Empty(t, jobs.DataRetentionJobs)
		assert.Empty(t, jobs.MessageExportJobs)
		assert.Empty(t, jobs.ElasticPostIndexingJobs)
		assert.Empty(t, jobs.ElasticPostAggregationJobs)
		assert.Empty(t, jobs.BlevePostIndexingJobs)
		assert.Empty(t, jobs.MigrationJobs)
	})

	t.Run("jobs exist", func(t *testing.T) {
		getJob := func(jobType string) *model.Job {
			return &model.Job{
				Id:             model.NewId(),
				Type:           jobType,
				Priority:       1,
				CreateAt:       model.GetMillis() - 1,
				StartAt:        model.GetMillis(),
				LastActivityAt: model.GetMillis() + 1,
				Status:         model.JobStatusPending,
				Progress:       51,
				Data:           model.StringMap{"key": "value"},
			}
		}
		// Create some jobs
		jobsToCreate := []*model.Job{
			getJob(model.JobTypeLdapSync),
			getJob(model.JobTypeDataRetention),
			getJob(model.JobTypeMessageExport),
			getJob(model.JobTypeElasticsearchPostIndexing),
			getJob(model.JobTypeElasticsearchPostAggregation),
			getJob(model.JobTypeBlevePostIndexing),
			getJob(model.JobTypeMigrations),
		}

		var expectedJobs []*model.Job
		for _, job := range jobsToCreate {
			// Create the job using the store directly.
			// Creating the job at the job service would error as the workers require enterprise code.
			rJob, err := th.App.Srv().Store().Job().Save(job)
			require.NoError(t, err)

			expectedJobs = append(expectedJobs, rJob)
		}

		jobs := getJobList(t)

		// Helper to verify job content matches
		verifyJob := func(t *testing.T, expected, actual *model.Job) {
			t.Helper()
			assert.Equal(t, expected.Id, actual.Id)
			assert.Equal(t, expected.Type, actual.Type)
			assert.Equal(t, expected.Priority, actual.Priority)
			assert.Equal(t, expected.CreateAt, actual.CreateAt)
			assert.Equal(t, expected.StartAt, actual.StartAt)
			assert.Equal(t, expected.LastActivityAt, actual.LastActivityAt)
			assert.Equal(t, expected.Status, actual.Status)
			assert.Equal(t, expected.Progress, actual.Progress)
			assert.Equal(t, expected.Data, actual.Data)
		}

		// Verify LDAP sync jobs
		require.Len(t, jobs.LDAPSyncJobs, 1, "Should have 1 LDAP sync job")
		verifyJob(t, expectedJobs[0], jobs.LDAPSyncJobs[0])

		// Verify data retention jobs
		require.Len(t, jobs.DataRetentionJobs, 1, "Should have 1 data retention job")
		verifyJob(t, expectedJobs[1], jobs.DataRetentionJobs[0])

		// Verify message export jobs
		require.Len(t, jobs.MessageExportJobs, 1, "Should have 1 message export job")
		verifyJob(t, expectedJobs[2], jobs.MessageExportJobs[0])

		// Verify elasticsearch post indexing jobs
		require.Len(t, jobs.ElasticPostIndexingJobs, 1, "Should have 1 elasticsearch post indexing job")
		verifyJob(t, expectedJobs[3], jobs.ElasticPostIndexingJobs[0])

		// Verify elasticsearch post aggregation jobs
		require.Len(t, jobs.ElasticPostAggregationJobs, 1, "Should have 1 elasticsearch post aggregation job")
		verifyJob(t, expectedJobs[4], jobs.ElasticPostAggregationJobs[0])

		// Verify bleve post indexing jobs
		require.Len(t, jobs.BlevePostIndexingJobs, 1, "Should have 1 bleve post indexing job")
		verifyJob(t, expectedJobs[5], jobs.BlevePostIndexingJobs[0])

		// Verify migration jobs
		require.Len(t, jobs.MigrationJobs, 1, "Should have 1 migration job")
		verifyJob(t, expectedJobs[6], jobs.MigrationJobs[0])
	})
}

func TestGetSupportPacketPermissionsInfo(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.SetPhase2PermissionsMigrationStatus(true)

	generatePermissionInfo := func(t *testing.T) *model.SupportPacketPermissionInfo {
		t.Helper()

		fileData, err := th.App.getSupportPacketPermissionsInfo(th.Context)
		require.NotNil(t, fileData)
		assert.Equal(t, "permissions.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))
		assert.NoError(t, err)

		var permissions model.SupportPacketPermissionInfo
		err = yaml.Unmarshal(fileData.Body, &permissions)
		require.NoError(t, err)

		return &permissions
	}

	t.Run("No custom permissions", func(t *testing.T) {
		permissions := generatePermissionInfo(t)

		assert.Len(t, permissions.Roles, 23)
		assert.Empty(t, permissions.Schemes)
	})

	scheme, appErr := th.App.CreateScheme(&model.Scheme{
		Name:        "custom_scheme",
		DisplayName: "Custom Scheme",
		Scope:       model.SchemeScopeTeam,
	})
	require.Nil(t, appErr)

	t.Run("with custom scheme", func(t *testing.T) {
		permissions := generatePermissionInfo(t)

		assert.Len(t, permissions.Roles, 33) // 23 default roles + 10 custom roles from the scheme
		require.Len(t, permissions.Schemes, 1)
		assert.Equal(t, scheme.Id, permissions.Schemes[0].Id)
		assert.Equal(t, model.FakeSetting, permissions.Schemes[0].Name, "Name should be obfuscated")
		assert.Equal(t, model.FakeSetting, permissions.Schemes[0].DisplayName, "DisplayName should be obfuscated")
		assert.Equal(t, model.FakeSetting, permissions.Schemes[0].Description, "Description should be obfuscated")
	})

	t.Run("with custom role", func(t *testing.T) {
		role, appErr := th.App.CreateRole(&model.Role{
			Name:        "custom_role",
			DisplayName: "Custom Role",
		})
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_, appErr := th.App.DeleteRole(role.Id)
			require.Nil(t, appErr)
		})

		permissions := generatePermissionInfo(t)

		require.Len(t, permissions.Schemes, 1)
		require.Len(t, permissions.Roles, 34) // 23 default roles + 10 custom roles from the scheme + 1 custom role
		found := false
		for _, r := range permissions.Roles {
			// Confirm that sensitive fields are obfuscated
			assert.Equal(t, model.FakeSetting, r.DisplayName, "DisplayName should be obfuscated")
			assert.Equal(t, model.FakeSetting, r.Description, "Description should be obfuscated")

			// Fine the custom role
			if r.Id == role.Id {
				assert.Equal(t, role.Name, r.Name)
				assert.Equal(t, role.CreateAt, r.CreateAt)
				assert.Equal(t, role.UpdateAt, r.UpdateAt)
				assert.Equal(t, role.DeleteAt, r.DeleteAt)
				assert.Equal(t, role.Permissions, r.Permissions)
				assert.Equal(t, role.SchemeManaged, r.SchemeManaged)
				assert.Equal(t, role.BuiltIn, r.BuiltIn)
				found = true
				break
			}
		}
		assert.True(t, found)
	})
}

func TestGetSupportPacketMetadata(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("Happy path", func(t *testing.T) {
		fileData, err := th.App.getSupportPacketMetadata(th.Context)
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
