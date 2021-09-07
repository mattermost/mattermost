// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store/localcachelayer"
)

type TestHelper struct {
	App          *app.App
	Context      *request.Context
	Server       *app.Server
	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	BasicPost    *model.Post

	SystemAdminUser *model.User

	tempWorkspace string

	TestLogger *mlog.Logger
}

func setupTestHelper(enterprise bool) *TestHelper {
	store := mainHelper.GetStore()
	store.DropAllTables()

	memoryStore := config.NewTestMemoryStore()
	newConfig := memoryStore.Get().Clone()
	*newConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*newConfig.AnnouncementSettings.UserNoticesEnabled = false
	memoryStore.Set(newConfig)

	var options []app.Option
	options = append(options, app.ConfigStore(memoryStore))
	options = append(options, app.StoreOverride(mainHelper.Store))
	options = append(options, app.SkipPostInitializiation())

	testLogger, _ := mlog.NewLogger()
	logCfg, _ := config.MloggerConfigFromLoggerConfig(&newConfig.LogSettings, nil, config.GetLogFileLocation)
	if errCfg := testLogger.ConfigureTargets(logCfg); errCfg != nil {
		panic("failed to configure test logger: " + errCfg.Error())
	}
	// lock logger config so server init cannot override it during testing.
	testLogger.LockConfiguration()
	options = append(options, app.SetLogger(testLogger))

	s, err := app.NewServer(options...)
	if err != nil {
		panic(err)
	}
	// Adds the cache layer to the test store
	s.Store, err = localcachelayer.NewLocalCacheLayer(s.Store, s.Metrics, s.Cluster, s.CacheProvider)
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		App:        app.New(app.ServerConnector(s)),
		Context:    &request.Context{},
		Server:     s,
		TestLogger: testLogger,
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.RateLimitSettings.Enable = false })
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })

	serverErr := th.Server.Start()
	if serverErr != nil {
		panic(serverErr)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.DoAppMigrations()

	th.App.Srv().Store.MarkSystemRanUnitTests()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	if enterprise {
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.Srv().Jobs.InitWorkers()
		th.App.Srv().Jobs.InitSchedulers()
	} else {
		th.App.Srv().SetLicense(nil)
	}

	return th
}

func SetupEnterprise(tb testing.TB) *TestHelper {
	return setupTestHelper(true)
}

func Setup(tb testing.TB) *TestHelper {
	return setupTestHelper(false)
}

func (th *TestHelper) InitBasic() *TestHelper {
	th.SystemAdminUser = th.CreateUser()
	th.App.UpdateUserRoles(th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	th.SystemAdminUser, _ = th.App.GetUser(th.SystemAdminUser.Id)

	th.BasicTeam = th.CreateTeam()
	th.BasicUser = th.CreateUser()
	th.LinkUserToTeam(th.BasicUser, th.BasicTeam)
	th.BasicUser2 = th.CreateUser()
	th.LinkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(th.BasicTeam)
	th.BasicPost = th.CreatePost(th.BasicChannel)

	return th
}

func (*TestHelper) MakeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
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
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}

	var err *model.AppError
	if user, err = th.App.CreateUser(th.Context, user); err != nil {
		panic(err)
	}
	return user
}

func (th *TestHelper) CreateChannel(team *model.Team) *model.Channel {
	return th.createChannel(team, model.ChannelTypeOpen)
}

func (th *TestHelper) createChannel(team *model.Team, channelType model.ChannelType) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   th.BasicUser.Id,
	}

	var err *model.AppError
	if channel, err = th.App.CreateChannel(th.Context, channel, true); err != nil {
		panic(err)
	}
	return channel
}

func (th *TestHelper) CreateDmChannel(user *model.User) *model.Channel {
	var err *model.AppError
	var channel *model.Channel
	if channel, err = th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, user.Id); err != nil {
		panic(err)
	}
	return channel
}

func (th *TestHelper) CreatePost(channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	var err *model.AppError
	if post, err = th.App.CreatePost(th.Context, post, channel, false, true); err != nil {
		panic(err)
	}
	return post
}

func (th *TestHelper) LinkUserToTeam(user *model.User, team *model.Team) {
	_, err := th.App.JoinUserToTeam(th.Context, team, user, "")
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) AddUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
	member, err := th.App.AddUserToChannel(user, channel, false)
	if err != nil {
		panic(err)
	}
	return member
}

func (th *TestHelper) TearDown() {
	// Clean all the caches
	th.App.Srv().InvalidateAllCaches()
	th.Server.Shutdown()
	if th.tempWorkspace != "" {
		os.RemoveAll(th.tempWorkspace)
	}
}

func (*TestHelper) ResetRoleMigration() {
	sqlStore := mainHelper.GetSQLStore()
	if _, err := sqlStore.GetMaster().Exec("DELETE from Roles"); err != nil {
		panic(err)
	}

	mainHelper.GetClusterInterface().SendClearRoleCacheMessage()

	if _, err := sqlStore.GetMaster().Exec("DELETE from Systems where Name = :Name", map[string]interface{}{"Name": model.AdvancedPermissionsMigrationKey}); err != nil {
		panic(err)
	}
}

func (th *TestHelper) DeleteAllJobsByTypeAndMigrationKey(jobType string, migrationKey string) {
	jobs, err := th.App.Srv().Store.Job().GetAllByType(model.JobTypeMigrations)
	if err != nil {
		panic(err)
	}

	for _, job := range jobs {
		if key, ok := job.Data[JobDataKeyMigration]; ok && key == migrationKey {
			if _, err = th.App.Srv().Store.Job().Delete(job.Id); err != nil {
				panic(err)
			}
		}
	}
}
