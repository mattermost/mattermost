// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/stretchr/testify/require"
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

	tempWorkspace string
}

func setupTestHelper(dbStore store.Store, enterprise bool, includeCacheLayer bool, options []app.Option, tb testing.TB) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "jobstest")
	if err != nil {
		panic(err)
	}

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
	configStore.Set(memoryConfig)

	buffer := &mlog.Buffer{}

	options = append(options, app.ConfigStore(configStore))
	if includeCacheLayer {
		// Adds the cache layer to the test store
		options = append(options, app.StoreOverrideWithCache(dbStore))
	} else {
		options = append(options, app.StoreOverride(dbStore))
	}

	testLogger, _ := mlog.NewLogger()
	logCfg, _ := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	if errCfg := testLogger.ConfigureTargets(logCfg, nil); errCfg != nil {
		panic("failed to configure test logger: " + errCfg.Error())
	}
	if errW := mlog.AddWriterTarget(testLogger, buffer, true, mlog.StdAll...); errW != nil {
		panic("failed to add writer target to test logger: " + errW.Error())
	}
	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, app.SetLogger(testLogger))

	s, err := app.NewServer(options...)
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		App:               app.New(app.ServerConnector(s.Channels())),
		Context:           request.EmptyContext(testLogger),
		Server:            s,
		LogBuffer:         buffer,
		TestLogger:        testLogger,
		IncludeCacheLayer: includeCacheLayer,
		ConfigStore:       configStore,
	}

	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = "localhost:0" })
	serverErr := th.Server.Start()
	if serverErr != nil {
		panic(serverErr)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.Srv().Store().MarkSystemRanUnitTests()

	return th
}

func Setup(tb testing.TB, options ...app.Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, false, true, options, tb)
}

var initBasicOnce sync.Once
var userCache struct {
	SystemAdminUser *model.User
	BasicUser       *model.User
	BasicUser2      *model.User
}

func (th *TestHelper) InitBasic() *TestHelper {
	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		th.SystemAdminUser = th.CreateUser()
		th.App.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		th.SystemAdminUser, _ = th.App.GetUser(th.SystemAdminUser.Id)
		userCache.SystemAdminUser = th.SystemAdminUser.DeepCopy()

		th.BasicUser = th.CreateUser()
		th.BasicUser, _ = th.App.GetUser(th.BasicUser.Id)
		userCache.BasicUser = th.BasicUser.DeepCopy()

		th.BasicUser2 = th.CreateUser()
		th.BasicUser2, _ = th.App.GetUser(th.BasicUser2.Id)
		userCache.BasicUser2 = th.BasicUser2.DeepCopy()
	})
	// restore cached users
	th.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	th.BasicUser = userCache.BasicUser.DeepCopy()
	th.BasicUser2 = userCache.BasicUser2.DeepCopy()

	users := []*model.User{th.SystemAdminUser, th.BasicUser, th.BasicUser2}
	mainHelper.GetSQLStore().User().InsertUsers(users)

	th.BasicTeam = th.CreateTeam()
	return th
}

func (th *TestHelper) CreateTeam() *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	var err *model.AppError
	if team, err = th.App.CreateTeam(th.Context, team); err != nil {
		panic(err)
	}
	return team
}

func (th *TestHelper) CreateUser() *model.User {
	return th.CreateUserOrGuest(false)
}

func (th *TestHelper) CreateUserOrGuest(guest bool) *model.User {
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
		if user, err = th.App.CreateGuest(th.Context, user); err != nil {
			panic(err)
		}
	} else {
		if user, err = th.App.CreateUser(th.Context, user); err != nil {
			panic(err)
		}
	}
	return user
}

func (th *TestHelper) ShutdownApp() {
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
}

func (th *TestHelper) TearDown() {
	if th.IncludeCacheLayer {
		// Clean all the caches
		th.App.Srv().InvalidateAllCaches()
	}
	th.ShutdownApp()
	if th.tempWorkspace != "" {
		os.RemoveAll(th.tempWorkspace)
	}
}

func (th *TestHelper) SetupBatchWorker(t *testing.T, worker *jobs.BatchWorker) *model.Job {
	t.Helper()

	jobId := model.NewId()
	th.Server.Jobs.RegisterJobType(jobId, worker, nil)

	jobData := make(model.StringMap)
	jobData["batch_number"] = "1"
	job, appErr := th.Server.Jobs.CreateJob(th.Context, jobId, jobData)

	if appErr != nil {
		panic(appErr)
	}

	done := make(chan bool)
	go func() {
		defer close(done)
		worker.Run()
	}()

	// When ending the test, ensure we wait for the worker to finish.
	t.Cleanup(func() {
		waitDone(t, done, "worker did not stop running")
	})

	// Give the worker time to start running
	time.Sleep(500 * time.Millisecond)

	return job
}

func (th *TestHelper) WaitForJobStatus(t *testing.T, job *model.Job, status string) {
	t.Helper()

	require.Eventuallyf(t, func() bool {
		actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
		require.Nil(t, appErr)
		require.Equal(t, job.Id, actualJob.Id)

		return actualJob.Status == status
	}, 5*time.Second, 250*time.Millisecond, "job never transitioned to %s", status)
}

func (th *TestHelper) WaitForBatchNumber(t *testing.T, job *model.Job, batchNumber int) {
	t.Helper()

	require.Eventuallyf(t, func() bool {
		actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
		require.Nil(t, appErr)
		require.Equal(t, job.Id, actualJob.Id)

		finalBatchNumber, err := strconv.Atoi(actualJob.Data["batch_number"])
		require.NoError(t, err)
		return finalBatchNumber == batchNumber
	}, 5*time.Second, 250*time.Millisecond, "job did not stop at batch %d", batchNumber)
}

func waitDone(t *testing.T, done chan bool, msg string) {
	t.Helper()

	require.Eventually(t, func() bool {
		select {
		case <-done:
			return true
		default:
			return false
		}
	}, 5*time.Second, 100*time.Millisecond, msg)
}
