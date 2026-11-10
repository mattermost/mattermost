// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	smocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/config"
)

// shortCPUProfileDuration keeps GenerateSupportPacket calls fast in tests
// that don't care about the CPU profile's contents.
var shortCPUProfileDuration = model.NewPointer(100 * time.Millisecond)

func TestGenerateSupportPacket(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	// Override log root path to allow log file reads from our temp directory
	th.App.Srv().Platform().SetLogRootPathOverride(dir)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)

	genMockLogFiles := func() {
		d1 := []byte("hello\ngo\n")
		genErr := os.WriteFile(logLocation, d1, 0777)
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

	getFileDataByName := func(fileDatas []model.FileData, filename string) *model.FileData {
		for _, fileData := range fileDatas {
			if fileData.Filename == filename {
				return &fileData
			}
		}

		return nil
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

	// database_schema.yaml is only generated for Postgres
	if *th.App.Config().SqlSettings.DriverName == model.DatabaseDriverPostgres {
		expectedFileNames = append(expectedFileNames, "database_schema.yaml")
	}

	expectedFileNamesWithLogs := append(expectedFileNames, "mattermost.log")

	t.Run("generate Support Packet with logs", func(t *testing.T) {
		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        true,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNamesWithLogs, rFileNames)
	})

	t.Run("generate Support Packet without logs", func(t *testing.T) {
		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
		})

		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNames, rFileNames)
	})

	t.Run("remove the log files and ensure that warning.txt file is generated", func(t *testing.T) {
		err = os.Remove(logLocation)
		require.NoError(t, err)
		t.Cleanup(genMockLogFiles)

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        true,
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
		mockStore.On("DeliveryTracking").Return(th.App.Srv().Store().DeliveryTracking())
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
		mockStore.On("GetInternalMasterDB").Return((*sql.DB)(nil))
		mockStore.On("GetDiagnostics", mock.Anything).Return(&store.DatabaseDiagnostics{}, nil)
		mockStore.On("GetSchemaDefinition").Return(&model.SupportPacketDatabaseSchema{
			Tables: []model.DatabaseTable{},
		}, nil)

		oldStore := th.App.Srv().Store()
		t.Cleanup(func() {
			th.App.Srv().SetStore(oldStore)
		})
		th.App.Srv().SetStore(&mockStore)

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
		})
		rFileNames := getFileNames(t, fileDatas)

		assert.Contains(t, rFileNames, "warning.txt")
		assert.Contains(t, rFileNames, "stats.yaml")
		assert.ElementsMatch(t, append(expectedFileNames, "warning.txt"), rFileNames)

		statsFile := getFileDataByName(fileDatas, "stats.yaml")
		require.NotNil(t, statsFile)
		var stats model.SupportPacketStats
		require.NoError(t, yaml.Unmarshal(statsFile.Body, &stats))
		assert.Nil(t, stats.Posts)

		warningsFile := getFileDataByName(fileDatas, "warning.txt")
		require.NotNil(t, warningsFile)
		assert.Contains(t, string(warningsFile.Body), "failed to get post count")
	})

	t.Run("collector nil result does not abort support packet generation", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = true
			})
		})

		fileDatas := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
		})
		rFileNames := getFileNames(t, fileDatas)
		assert.NotContains(t, rFileNames, "plugins.json")
		assert.Contains(t, rFileNames, "warning.txt")
		assert.Contains(t, rFileNames, "stats.yaml")

		warningsFile := getFileDataByName(fileDatas, "warning.txt")
		require.NotNil(t, warningsFile)
		assert.Contains(t, string(warningsFile.Body), "failed to get plugin list for Support Packet")
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
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
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
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
			PluginPackets:      []string{pluginID},
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
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
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
			CPUProfileDuration: shortCPUProfileDuration,
			IncludeLogs:        false,
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

func TestGetPluginsList(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	getPluginList := func(t *testing.T) *model.SupportPacketPluginList {
		t.Helper()

		plugins, err := th.App.getPluginsList(th.Context)
		assert.NoError(t, err)
		require.NotNil(t, plugins)
		return plugins
	}

	t.Run("no errors if no plugins are installed", func(t *testing.T) {
		pl := getPluginList(t)
		assert.Len(t, pl.Enabled, 0)
		assert.Len(t, pl.Disabled, 0)
	})

	t.Run("two plugins are installed", func(t *testing.T) {
		path, found := fileutils.FindDir("tests")
		require.True(t, found, "tests directory not found")

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

		pl := getPluginList(t)
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
		plugins, err := th.App.getPluginsList(th.Context)
		assert.Nil(t, plugins)
		assert.ErrorContains(t, err, "failed to get plugin list for Support Packet")
	})
}

func TestGetSupportPacketStats(t *testing.T) {
	mainHelper.Parallel(t)

	generateStats := func(t *testing.T, rctx request.CTX, a *App) *model.SupportPacketStats {
		t.Helper()

		require.NoError(t, a.Srv().Store().Post().RefreshPostStats())

		packet, err := a.getSupportPacketStats(rctx)
		require.NotNil(t, packet)
		assert.NoError(t, err)

		return packet
	}

	assertStatValue := func(t *testing.T, stat *int64, expected int64) {
		t.Helper()
		require.NotNil(t, stat)
		assert.Equal(t, expected, *stat)
	}

	th := Setup(t)

	t.Run("fresh server", func(t *testing.T) {
		sp := generateStats(t, th.Context, th.App)

		assertStatValue(t, sp.RegisteredUsers, 0)
		assertStatValue(t, sp.ActiveUsers, 0)
		assertStatValue(t, sp.DailyActiveUsers, 0)
		assertStatValue(t, sp.MonthlyActiveUsers, 0)
		assertStatValue(t, sp.DeactivatedUsers, 0)
		assertStatValue(t, sp.Guests, 0)
		assertStatValue(t, sp.SingleChannelGuests, 0)
		assertStatValue(t, sp.BotAccounts, 0)
		assertStatValue(t, sp.Posts, 0)
		assertStatValue(t, sp.Channels, 0)
		assertStatValue(t, sp.Teams, 0)
		assertStatValue(t, sp.SlashCommands, 0)
		assertStatValue(t, sp.IncomingWebhooks, 0)
		assertStatValue(t, sp.OutgoingWebhooks, 0)
	})

	t.Run("Happy path", func(t *testing.T) {
		var user *model.User
		for range 4 {
			user = th.CreateUser(t)
		}
		th.BasicUser = user

		for range 3 {
			deactivatedUser := th.CreateUser(t)
			require.NotNil(t, deactivatedUser)
			_, appErr := th.App.UpdateActive(th.Context, deactivatedUser, false)
			require.Nil(t, appErr)
		}

		for range 2 {
			guest := th.CreateGuest(t)
			require.NotNil(t, guest)
		}

		th.CreateBot(t)

		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team)

		for range 3 {
			p := th.CreatePost(t, channel)
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

		sp := generateStats(t, th.Context, th.App)

		assertStatValue(t, sp.RegisteredUsers, 9)
		assertStatValue(t, sp.ActiveUsers, 6)
		assertStatValue(t, sp.DailyActiveUsers, 0)
		assertStatValue(t, sp.MonthlyActiveUsers, 0)
		assertStatValue(t, sp.DeactivatedUsers, 3)
		assertStatValue(t, sp.Guests, 2)
		assertStatValue(t, sp.SingleChannelGuests, 0)
		assertStatValue(t, sp.BotAccounts, 1)
		assertStatValue(t, sp.Posts, 4)    // 1 from the bot creation and 3 created directly
		assertStatValue(t, sp.Channels, 3) // 2 from the team creation and 1 created directly
		assertStatValue(t, sp.Teams, 1)
		assertStatValue(t, sp.SlashCommands, 1)
		assertStatValue(t, sp.IncomingWebhooks, 1)
		assertStatValue(t, sp.OutgoingWebhooks, 1)
	})

	t.Run("single channel guests are counted when a guest is in exactly one channel", func(t *testing.T) {
		basicTh := Setup(t).InitBasic(t)
		channel := basicTh.CreateChannel(t, basicTh.BasicTeam)

		guest := basicTh.CreateGuest(t)
		basicTh.LinkUserToTeam(t, guest, basicTh.BasicTeam)
		basicTh.AddUserToChannel(t, guest, channel)

		sp := generateStats(t, basicTh.Context, basicTh.App)
		assertStatValue(t, sp.SingleChannelGuests, 1)
	})

	t.Run("post count should be present if number of users extends AnalyticsSettings.MaxUsersForStatistics", func(t *testing.T) {
		// Setup a new test helper
		basicTh := Setup(t).InitBasic(t)
		basicTh.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AnalyticsSettings.MaxUsersForStatistics = new(1)
		})

		for range 5 {
			p := basicTh.CreatePost(t, basicTh.BasicChannel)
			require.NotNil(t, p)
		}

		// InitBasic(t) already creats 5 posts
		sp := generateStats(t, basicTh.Context, basicTh.App)
		assertStatValue(t, sp.Posts, 10)
	})

	t.Run("channel count is omitted when a channel query fails and errors include every failed stat", func(t *testing.T) {
		mockStore := smocks.Store{}
		channelStore := &smocks.ChannelStore{}
		postStore := &smocks.PostStore{}

		channelStore.On("AnalyticsTypeCount", "", model.ChannelTypeOpen).Return(int64(0), errors.New("open query failed"))
		postStore.On("AnalyticsPostCount", &model.PostCountOptions{}).Return(int64(0), errors.New("post query failed"))
		postStore.On("RefreshPostStats").Return(nil)
		postStore.On("ClearCaches")

		mockStore.On("User").Return(th.App.Srv().Store().User())
		mockStore.On("Post").Return(postStore)
		mockStore.On("Channel").Return(channelStore)
		mockStore.On("Team").Return(th.App.Srv().Store().Team())
		mockStore.On("Command").Return(th.App.Srv().Store().Command())
		mockStore.On("Webhook").Return(th.App.Srv().Store().Webhook())
		mockStore.On("ClearCaches")
		mockStore.On("Close").Return(nil)

		oldStore := th.App.Srv().Store()
		t.Cleanup(func() {
			th.App.Srv().SetStore(oldStore)
		})
		th.App.Srv().SetStore(&mockStore)

		packet, err := th.App.getSupportPacketStats(th.Context)
		require.NotNil(t, packet)
		require.Error(t, err)
		assert.ErrorContains(t, err, "failed to get post count")
		assert.ErrorContains(t, err, "failed to get channel count")
		assert.Nil(t, packet.Channels)
		assert.Nil(t, packet.Posts)
	})

	t.Run("channel count is omitted when only the private channel query fails", func(t *testing.T) {
		mockStore := smocks.Store{}
		channelStore := &smocks.ChannelStore{}

		channelStore.On("AnalyticsTypeCount", "", model.ChannelTypeOpen).Return(int64(5), nil)
		channelStore.On("AnalyticsTypeCount", "", model.ChannelTypePrivate).Return(int64(0), errors.New("private query failed"))

		mockStore.On("User").Return(th.App.Srv().Store().User())
		mockStore.On("Post").Return(th.App.Srv().Store().Post())
		mockStore.On("Channel").Return(channelStore)
		mockStore.On("Team").Return(th.App.Srv().Store().Team())
		mockStore.On("Command").Return(th.App.Srv().Store().Command())
		mockStore.On("Webhook").Return(th.App.Srv().Store().Webhook())
		mockStore.On("ClearCaches")
		mockStore.On("Close").Return(nil)

		oldStore := th.App.Srv().Store()
		t.Cleanup(func() {
			th.App.Srv().SetStore(oldStore)
		})
		th.App.Srv().SetStore(&mockStore)

		packet, err := th.App.getSupportPacketStats(th.Context)
		require.NotNil(t, packet)
		require.ErrorContains(t, err, "failed to get channel count")
		assert.Nil(t, packet.Channels)
		assert.NotNil(t, packet.Posts)
	})
}

func TestGetSupportPacketJobList(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	getJobList := func(t *testing.T) *model.SupportPacketJobList {
		t.Helper()

		jobs, err := th.App.getSupportPacketJobList(th.Context)
		require.NoError(t, err)
		require.NotNil(t, jobs)
		return jobs
	}

	t.Run("no jobs run yet", func(t *testing.T) {
		jobs := getJobList(t)

		assert.Empty(t, jobs.LDAPSyncJobs)
		assert.Empty(t, jobs.DataRetentionJobs)
		assert.Empty(t, jobs.MessageExportJobs)
		assert.Empty(t, jobs.ElasticPostIndexingJobs)
		assert.Empty(t, jobs.ElasticPostAggregationJobs)
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

		// Verify migration jobs
		require.Len(t, jobs.MigrationJobs, 1, "Should have 1 migration job")
		verifyJob(t, expectedJobs[5], jobs.MigrationJobs[0])
	})
}

func TestGetSupportPacketPermissionsInfo(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	generatePermissionInfo := func(t *testing.T) *model.SupportPacketPermissionInfo {
		t.Helper()

		permissions, err := th.App.getSupportPacketPermissionsInfo(th.Context)
		require.NotNil(t, permissions)
		assert.NoError(t, err)
		return permissions
	}

	t.Run("No custom permissions", func(t *testing.T) {
		permissions := generatePermissionInfo(t)

		assert.Len(t, permissions.Roles, 24)
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

		assert.Len(t, permissions.Roles, 34) // 24 default roles + 10 custom roles from the scheme
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
		require.Len(t, permissions.Roles, 35) // 24 default roles + 10 custom roles from the scheme + 1 custom role
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
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("Happy path", func(t *testing.T) {
		metadata, err := th.App.getSupportPacketMetadata(th.Context)
		require.NoError(t, err)
		require.NotNil(t, metadata)
		assert.Equal(t, model.SupportPacketType, metadata.Type)
		assert.Equal(t, model.CurrentVersion, metadata.ServerVersion)
		assert.NotEmpty(t, metadata.ServerID)
		assert.NotEmpty(t, metadata.GeneratedAt)
	})
}

func TestGetSupportPacketDatabaseSchema(t *testing.T) {
	th := Setup(t)

	// Mock store for testing
	mockStore := &smocks.Store{}
	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(mockStore)
	defer th.App.Srv().SetStore(originalStore)
	// Set up mock return for schema definition
	mockStore.On("GetSchemaDefinition").Return(&model.SupportPacketDatabaseSchema{
		Tables: []model.DatabaseTable{
			{
				Name: "users",
				Columns: []model.DatabaseColumn{
					{Name: "id", DataType: "varchar", IsNullable: false},
					{Name: "username", DataType: "varchar", IsNullable: false},
					{Name: "email", DataType: "varchar", IsNullable: false},
				},
			},
			{
				Name: "channels",
				Columns: []model.DatabaseColumn{
					{Name: "id", DataType: "varchar", IsNullable: false},
					{Name: "name", DataType: "varchar", IsNullable: false},
				},
			},
			{
				Name: "teams",
				Columns: []model.DatabaseColumn{
					{Name: "id", DataType: "varchar", IsNullable: false},
					{Name: "name", DataType: "varchar", IsNullable: false},
				},
			},
			{
				Name: "posts",
				Columns: []model.DatabaseColumn{
					{Name: "id", DataType: "varchar", IsNullable: false},
					{Name: "message", DataType: "text", IsNullable: false},
				},
			},
		},
	}, nil)

	// Test with Postgres
	oldDriverName := *th.App.Config().SqlSettings.DriverName
	*th.App.Config().SqlSettings.DriverName = model.DatabaseDriverPostgres
	defer func() {
		*th.App.Config().SqlSettings.DriverName = oldDriverName
	}()

	fileData, err := th.App.getSupportPacketDatabaseSchema(th.Context)
	require.NoError(t, err)
	require.NotNil(t, fileData)
	assert.Equal(t, "database_schema.yaml", fileData.Filename)
	assert.Positive(t, len(fileData.Body))

	var schema model.SupportPacketDatabaseSchema
	err = yaml.Unmarshal(fileData.Body, &schema)
	require.NoError(t, err)

	// Verify schema structure
	assert.NotEmpty(t, schema.Tables)

	// Verify that common tables are present
	tableNames := make([]string, 0, len(schema.Tables))
	for _, table := range schema.Tables {
		tableNames = append(tableNames, table.Name)
	}

	// Verify some core tables
	expectedTables := []string{"users", "channels", "teams", "posts"}
	for _, expected := range expectedTables {
		assert.Contains(t, tableNames, expected)
	}

	// Verify table structure
	for _, table := range schema.Tables {
		if table.Name == "users" {
			// Check user table has key columns
			columnNames := make([]string, 0, len(table.Columns))
			for _, column := range table.Columns {
				columnNames = append(columnNames, column.Name)
			}

			expectedColumns := []string{"id", "username", "email"}
			for _, expected := range expectedColumns {
				assert.Contains(t, columnNames, expected)
			}

			break
		}
	}
}

func TestSupportPacketMarshalGolden(t *testing.T) {
	t.Parallel()

	statsCount := int64(42)
	dailyActive := int64(15)

	jobFactory := func(id, jobType string) *model.Job {
		return &model.Job{
			Id:             id,
			Type:           jobType,
			CreateAt:       1111,
			StartAt:        2222,
			LastActivityAt: 3333,
			Status:         model.JobStatusSuccess,
			Data:           model.StringMap{"result": "ok"},
		}
	}

	role := &model.Role{
		Id:          "role-id",
		Name:        "team_admin",
		Permissions: []string{"manage_system", "manage_team"},
	}

	scheme := &model.Scheme{
		Id:          "scheme-id",
		Name:        "scheme-name",
		DisplayName: "Scheme Name",
		Scope:       model.SchemeScopeTeam,
	}

	cases := []struct {
		name     string
		filename string
		// Jobs and roles format their timestamps in server-local time, so their goldens are recorded in UTC.
		localTime bool
		marshal   func() (*model.FileData, error)
	}{
		{
			name:     "metadata",
			filename: "metadata.yaml",
			marshal: func() (*model.FileData, error) {
				return supportPacketMetadataFile(&model.PacketMetadata{
					Version:       1,
					Type:          model.SupportPacketType,
					GeneratedAt:   1735689600000,
					ServerVersion: "11.0.0",
					ServerID:      "server-id-fixed",
					LicenseID:     "license-id-fixed",
					CustomerID:    "customer-id-fixed",
					Extras: map[string]any{
						"region": "us-east",
						"tier":   "enterprise",
					},
				}, nil)
			},
		},
		{
			name:     "stats",
			filename: "stats.yaml",
			marshal: func() (*model.FileData, error) {
				return supportPacketStatsFile(&model.SupportPacketStats{
					RegisteredUsers:  &statsCount,
					DailyActiveUsers: &dailyActive,
				}, nil)
			},
		},
		{
			name:      "jobs",
			filename:  "jobs.yaml",
			localTime: true,
			marshal: func() (*model.FileData, error) {
				return supportPacketJobsFile(&model.SupportPacketJobList{
					LDAPSyncJobs:               []*model.Job{jobFactory("job-ldap", model.JobTypeLdapSync)},
					DataRetentionJobs:          []*model.Job{jobFactory("job-retention", model.JobTypeDataRetention)},
					MessageExportJobs:          []*model.Job{jobFactory("job-export", model.JobTypeMessageExport)},
					ElasticPostIndexingJobs:    []*model.Job{jobFactory("job-index", model.JobTypeElasticsearchPostIndexing)},
					ElasticPostAggregationJobs: []*model.Job{jobFactory("job-agg", model.JobTypeElasticsearchPostAggregation)},
					MigrationJobs:              []*model.Job{jobFactory("job-migrate", model.JobTypeMigrations)},
				}, nil)
			},
		},
		{
			name:      "permissions",
			filename:  "permissions.yaml",
			localTime: true,
			marshal: func() (*model.FileData, error) {
				return supportPacketPermissionsFile(&model.SupportPacketPermissionInfo{
					Roles:   []*model.Role{role},
					Schemes: []*model.Scheme{scheme},
				}, nil)
			},
		},
		{
			name:     "plugins",
			filename: "plugins.json",
			marshal: func() (*model.FileData, error) {
				return supportPacketPluginsFile(&model.SupportPacketPluginList{
					Enabled: []model.Manifest{
						{Id: "com.mattermost.enabled", Name: "Enabled Plugin", Version: "1.2.3"},
					},
					Disabled: []model.Manifest{
						{Id: "com.mattermost.disabled", Name: "Disabled Plugin", Version: "2.3.4"},
					},
				}, nil)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, offset := time.Unix(0, 0).Zone(); tc.localTime && offset != 0 {
				t.Skip("golden recorded in UTC; run with TZ=UTC")
			}

			fileData, err := tc.marshal()
			require.NoError(t, err)
			require.NotNil(t, fileData)
			require.Equal(t, tc.filename, fileData.Filename)

			expected, err := os.ReadFile(filepath.Join(server.GetPackagePath(), "channels", "app", "testdata", "support_packet", tc.filename))
			require.NoError(t, err)
			require.Equal(t, string(expected), string(fileData.Body))
		})
	}
}
