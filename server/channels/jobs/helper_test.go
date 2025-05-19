// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
)

type TestHelper struct {
	App        *app.App
	Context    *request.Context
	Server     *app.Server
	BasicTeam  *model.Team
	BasicUser  *model.User
	BasicUser2 *model.User

	SystemAdminUser   *model.User
	LogBuffer         *mlog.Buffer
	TestLogger        *mlog.Logger
	IncludeCacheLayer bool
	ConfigStore       *config.Store

	tempWorkspace             string
	oldWatcherPollingInterval int
}

func setupTestHelper(tb testing.TB, dbStore store.Store, enterprise bool, includeCacheLayer bool,
	updateCfg func(cfg *model.Config), options []app.Option) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "jobstest")
	require.NoError(tb, err)

	configStore := config.NewTestMemoryStore()
	memoryConfig := configStore.Get()
	memoryConfig.SqlSettings = *mainHelper.GetSQLSettings()
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests
	*memoryConfig.LogSettings.ConsoleLevel = mlog.LvlStdLog.Name
	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false

	if updateCfg != nil {
		updateCfg(memoryConfig)
	}

	_, _, err = configStore.Set(memoryConfig)
	require.NoError(tb, err)

	buffer := &mlog.Buffer{}

	options = append(options, app.ConfigStore(configStore))
	if includeCacheLayer {
		// Adds the cache layer to the test store
		options = append(options, app.StoreOverrideWithCache(dbStore))
	} else {
		options = append(options, app.StoreOverride(dbStore))
	}

	testLogger, err := mlog.NewLogger()
	require.NoError(tb, err)
	logCfg, err := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	require.NoError(tb, err)
	err = testLogger.ConfigureTargets(logCfg, nil)
	require.NoError(tb, err, "failed to configure test logger")
	err = mlog.AddWriterTarget(testLogger, buffer, true, mlog.StdAll...)
	require.NoError(tb, err, "failed to add writer target to test logger")
	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, app.SetLogger(testLogger))

	s, err := app.NewServer(options...)
	require.NoError(tb, err)

	th := &TestHelper{
		App:               app.New(app.ServerConnector(s.Channels())),
		Context:           request.EmptyContext(testLogger),
		Server:            s,
		LogBuffer:         buffer,
		TestLogger:        testLogger,
		IncludeCacheLayer: includeCacheLayer,
		ConfigStore:       configStore,
		tempWorkspace:     tempWorkspace,
	}

	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = "localhost:0" })
	err = th.Server.Start()
	require.NoError(tb, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.Srv().Store().MarkSystemRanUnitTests()

	tb.Cleanup(func() {
		if th.IncludeCacheLayer {
			// Clean all the caches
			appErr := th.App.Srv().InvalidateAllCaches()
			require.Nil(tb, appErr)
		}
		done := make(chan bool)
		go func() {
			th.Server.Shutdown()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(30 * time.Second):
			// panic instead of fatal to terminate all tests in this package, otherwise the
			// still running App could spuriously fail subsequent tests.
			panic("failed to shutdown App within 30 seconds")
		}

		if th.tempWorkspace != "" {
			os.RemoveAll(th.tempWorkspace)
		}

		if th.oldWatcherPollingInterval != 0 {
			jobs.DefaultWatcherPollingInterval = th.oldWatcherPollingInterval
		}
	})

	return th
}

func Setup(tb testing.TB, options ...app.Option) *TestHelper {
	return SetupWithUpdateCfg(tb, nil, options...)
}

func SetupWithUpdateCfg(tb testing.TB, updateCfg func(cfg *model.Config), options ...app.Option) *TestHelper {
	tb.Helper()
	if testing.Short() {
		tb.SkipNow()
	}

	oldWatcherPollingInterval := jobs.DefaultWatcherPollingInterval
	jobs.DefaultWatcherPollingInterval = 100

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	th := setupTestHelper(tb, dbStore, false, true, updateCfg, options)
	th.oldWatcherPollingInterval = oldWatcherPollingInterval
	return th
}

func (th *TestHelper) InitBasic(tb testing.TB) *TestHelper {
	tb.Helper()

	th.SystemAdminUser = th.CreateUser(tb)
	_, appErr := th.App.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(tb, appErr)
	th.SystemAdminUser, appErr = th.App.GetUser(th.SystemAdminUser.Id)
	require.Nil(tb, appErr)

	th.BasicUser = th.CreateUser(tb)
	th.BasicUser, appErr = th.App.GetUser(th.BasicUser.Id)
	require.Nil(tb, appErr)

	th.BasicUser2 = th.CreateUser(tb)
	th.BasicUser2, appErr = th.App.GetUser(th.BasicUser2.Id)
	require.Nil(tb, appErr)

	th.BasicTeam = th.CreateTeam(tb)

	return th
}

func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	tb.Helper()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	team, err := th.App.CreateTeam(th.Context, team)
	require.Nil(tb, err)
	return team
}

func (th *TestHelper) CreateUser(tb testing.TB) *model.User {
	tb.Helper()
	return th.CreateUserOrGuest(tb, false)
}

func (th *TestHelper) CreateUserOrGuest(tb testing.TB, guest bool) *model.User {
	tb.Helper()
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}

	var err *model.AppError
	if guest {
		user, err = th.App.CreateGuest(th.Context, user)
	} else {
		user, err = th.App.CreateUser(th.Context, user)
	}
	require.Nil(tb, err)
	return user
}

func (th *TestHelper) SetupBatchWorker(tb testing.TB, worker *jobs.BatchWorker) *model.Job {
	tb.Helper()

	jobId := model.NewId()
	th.Server.Jobs.RegisterJobType(jobId, worker, nil)

	jobData := make(model.StringMap)
	jobData["batch_number"] = "1"
	job, appErr := th.Server.Jobs.CreateJob(th.Context, jobId, jobData)
	require.Nil(tb, appErr)

	done := make(chan bool)
	go func() {
		defer close(done)
		worker.Run()
	}()

	// When ending the test, ensure we wait for the worker to finish.
	tb.Cleanup(func() {
		waitDone(tb, done, "worker did not stop running")
	})

	// Give the worker time to start running
	time.Sleep(500 * time.Millisecond)

	return job
}

func (th *TestHelper) WaitForJobStatus(tb testing.TB, job *model.Job, status string) {
	tb.Helper()

	require.Eventuallyf(tb, func() bool {
		actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
		require.Nil(tb, appErr)
		require.Equal(tb, job.Id, actualJob.Id)

		return actualJob.Status == status
	}, 5*time.Second, 250*time.Millisecond, "job never transitioned to %s", status)
}

func (th *TestHelper) WaitForBatchNumber(tb testing.TB, job *model.Job, batchNumber int) {
	tb.Helper()

	require.Eventuallyf(tb, func() bool {
		actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
		require.Nil(tb, appErr)
		require.Equal(tb, job.Id, actualJob.Id)

		finalBatchNumber, err := strconv.Atoi(actualJob.Data["batch_number"])
		require.NoError(tb, err)
		return finalBatchNumber == batchNumber
	}, 5*time.Second, 250*time.Millisecond, "job did not stop at batch %d", batchNumber)
}

func waitDone(tb testing.TB, done chan bool, msg string) {
	tb.Helper()

	require.Eventually(tb, func() bool {
		select {
		case <-done:
			return true
		default:
			return false
		}
	}, 5*time.Second, 100*time.Millisecond, msg)
}

func (th *TestHelper) SetupWorkers(tb testing.TB) {
	tb.Helper()

	err := th.App.Srv().Jobs.StartWorkers()
	require.NoError(tb, err)
}

func (th *TestHelper) RunJob(tb testing.TB, jobType string, jobData map[string]string) *model.Job {
	tb.Helper()

	job, appErr := th.Server.Jobs.CreateJob(th.Context, jobType, jobData)
	require.Nil(tb, appErr)

	// poll until completion
	th.checkJobStatus(tb, job.Id, model.JobStatusSuccess)
	job, appErr = th.Server.Jobs.GetJob(th.Context, job.Id)
	require.Nil(tb, appErr)

	return job
}

func (th *TestHelper) checkJobStatus(tb testing.TB, jobId string, status string) {
	tb.Helper()

	require.Eventuallyf(tb, func() bool {
		// it's ok if there's an error, it might take awhile for the job to finish.
		job, appErr := th.Server.Jobs.GetJob(th.Context, jobId)
		assert.Nil(tb, appErr)
		if jobId == job.Id {
			return job.Status == status
		}
		return false
	}, 15*time.Second, 100*time.Millisecond, "expected job's status to be %s", status)
}
