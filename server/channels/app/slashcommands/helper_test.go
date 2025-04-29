// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
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

	SystemAdminUser   *model.User
	LogBuffer         *bytes.Buffer
	TestLogger        *mlog.Logger
	IncludeCacheLayer bool

	tb            testing.TB
	tempWorkspace string
}

func setupTestHelper(dbStore store.Store, enterprise bool, includeCacheLayer bool, tb testing.TB, configSet func(*model.Config)) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "apptest")
	require.NoError(tb, err)

	memoryStore := config.NewTestMemoryStore()

	memoryConfig := memoryStore.Get()
	if configSet != nil {
		configSet(memoryConfig)
	}
	memoryConfig.SqlSettings = *mainHelper.GetSQLSettings()
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests
	*memoryConfig.LogSettings.ConsoleLevel = mlog.LvlStdLog.Name
	_, _, err = memoryStore.Set(memoryConfig)
	require.NoError(tb, err)

	buffer := &bytes.Buffer{}

	var options []app.Option
	options = append(options, app.ConfigStore(memoryStore))
	if includeCacheLayer {
		options = append(options, app.StoreOverrideWithCache(dbStore))
	} else {
		options = append(options, app.StoreOverride(dbStore))
	}

	testLogger, err := mlog.NewLogger()
	require.NoError(tb, err)
	logCfg, err := config.MloggerConfigFromLoggerConfig(&memoryConfig.LogSettings, nil, config.GetLogFileLocation)
	require.NoError(tb, err)
	errCfg := testLogger.ConfigureTargets(logCfg, nil)
	require.NoError(tb, errCfg, "failed to configure test logger")
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
		tb:                tb,
	}

	if enterprise {
		stopErr := th.App.Srv().Jobs.StopWorkers()
		require.NoError(tb, stopErr)
		stopErr = th.App.Srv().Jobs.StopSchedulers()
		require.NoError(tb, stopErr)

		th.App.Srv().SetLicense(model.NewTestLicense())

		startErr := th.App.Srv().Jobs.StartWorkers()
		require.NoError(tb, startErr)
		startErr = th.App.Srv().Jobs.StartSchedulers()
		require.NoError(tb, startErr)
	} else {
		th.App.Srv().SetLicense(getLicense(false, memoryConfig))
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.RateLimitSettings.Enable = false })
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = "localhost:0" })
	serverErr := th.Server.Start()
	require.NoError(tb, serverErr)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })

	th.App.Srv().Platform().SearchEngine = mainHelper.SearchEngine

	th.App.Srv().Store().MarkSystemRanUnitTests()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	// Disable strict password requirements for test
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false
	})

	if th.tempWorkspace == "" {
		th.tempWorkspace = tempWorkspace
	}

	return th
}

func getLicense(enterprise bool, cfg *model.Config) *model.License {
	if *cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService || *cfg.ConnectedWorkspacesSettings.EnableSharedChannels {
		return model.NewTestLicenseSKU(model.LicenseShortSkuProfessional)
	}
	if enterprise {
		return model.NewTestLicense()
	}
	return nil
}

func setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, false, true, tb, nil)
}

func setupConfig(tb testing.TB, updateConfig func(cfg *model.Config)) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	return setupTestHelper(dbStore, false, true, tb, updateConfig)
}

func (th *TestHelper) initBasic() *TestHelper {
	th.SystemAdminUser = th.createUser()
	_, appErr := th.App.UpdateUserRoles(th.Context, th.SystemAdminUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(th.tb, appErr)

	th.BasicUser = th.createUser()
	th.BasicUser2 = th.createUser()
	th.BasicTeam = th.createTeam()

	th.linkUserToTeam(th.BasicUser, th.BasicTeam)
	th.linkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(th.BasicTeam)
	th.BasicPost = th.createPost(th.BasicChannel)
	return th
}

func (th *TestHelper) createTeam() *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	team, appErr := th.App.CreateTeam(th.Context, team)
	require.Nil(th.tb, appErr)

	return team
}

func (th *TestHelper) createUser() *model.User {
	return th.createUserOrGuest(false)
}

func (th *TestHelper) createGuest() *model.User {
	return th.createUserOrGuest(true)
}

func (th *TestHelper) createUserOrGuest(guest bool) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}

	var appErr *model.AppError
	if guest {
		user, appErr = th.App.CreateGuest(th.Context, user)
		require.Nil(th.tb, appErr)
	} else {
		user, appErr = th.App.CreateUser(th.Context, user)
		require.Nil(th.tb, appErr)
	}
	return user
}

type ChannelOption func(*model.Channel)

func WithShared(v bool) ChannelOption {
	return func(channel *model.Channel) {
		channel.Shared = model.NewPointer(v)
	}
}

func (th *TestHelper) CreateChannel(team *model.Team, options ...ChannelOption) *model.Channel {
	return th.createChannel(team, model.ChannelTypeOpen, options...)
}

func (th *TestHelper) createPrivateChannel(team *model.Team) *model.Channel {
	return th.createChannel(team, model.ChannelTypePrivate)
}

func (th *TestHelper) createChannel(team *model.Team, channelType model.ChannelType, options ...ChannelOption) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   th.BasicUser.Id,
	}

	for _, option := range options {
		option(channel)
	}

	channel, appErr := th.App.CreateChannel(th.Context, channel, true)
	require.Nil(th.tb, appErr)

	if channel.IsShared() {
		id := model.NewId()
		_, err := th.App.ShareChannel(th.Context, &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             false,
			ReadOnly:         false,
			ShareName:        "shared-" + id,
			ShareDisplayName: "shared-" + id,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         model.NewId(),
		})
		require.NoError(th.tb, err)
	}
	return channel
}

func (th *TestHelper) createChannelWithAnotherUser(team *model.Team, channelType model.ChannelType, userID string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   userID,
	}

	channel, appErr := th.App.CreateChannel(th.Context, channel, true)
	require.Nil(th.tb, appErr)
	return channel
}

func (th *TestHelper) createDmChannel(user *model.User) *model.Channel {
	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, user.Id)
	require.Nil(th.tb, appErr)
	return channel
}

func (th *TestHelper) createGroupChannel(user1 *model.User, user2 *model.User) *model.Channel {
	channel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, user1.Id, user2.Id}, th.BasicUser.Id)
	require.Nil(th.tb, appErr)
	return channel
}

func (th *TestHelper) createPost(channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "message_" + id,
		CreateAt:  model.GetMillis() - 10000,
	}

	post, appErr := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(th.tb, appErr)
	return post
}

func (th *TestHelper) linkUserToTeam(user *model.User, team *model.Team) {
	_, appErr := th.App.JoinUserToTeam(th.Context, team, user, "")
	require.Nil(th.tb, appErr)
}

func (th *TestHelper) addUserToChannel(user *model.User, channel *model.Channel) *model.ChannelMember {
	member, appErr := th.App.AddUserToChannel(th.Context, user, channel, false)
	require.Nil(th.tb, appErr)
	return member
}

func (th *TestHelper) shutdownApp() {
	done := make(chan bool)
	go func() {
		th.Server.Shutdown()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		// Use require.FailNow to terminate all tests in this package, otherwise the
		// still running App could spuriously fail subsequent tests.
		require.FailNow(th.tb, "failed to shutdown App within 30 seconds")
	}
}

func (th *TestHelper) tearDown() {
	if th.IncludeCacheLayer {
		// Clean all the caches
		appErr := th.App.Srv().InvalidateAllCaches()
		require.Nil(th.tb, appErr)
	}
	th.shutdownApp()
	if th.tempWorkspace != "" {
		os.RemoveAll(th.tempWorkspace)
	}
}

func (th *TestHelper) removePermissionFromRole(permission string, roleName string) {
	role, appErr := th.App.GetRoleByName(context.Background(), roleName)
	require.Nil(th.tb, appErr)

	var newPermissions []string
	for _, p := range role.Permissions {
		if p != permission {
			newPermissions = append(newPermissions, p)
		}
	}

	if strings.Join(role.Permissions, " ") == strings.Join(newPermissions, " ") {
		return
	}

	role.Permissions = newPermissions

	_, appErr = th.App.UpdateRole(role)
	require.Nil(th.tb, appErr)
}

func (th *TestHelper) addPermissionToRole(permission string, roleName string) {
	role, appErr := th.App.GetRoleByName(context.Background(), roleName)
	require.Nil(th.tb, appErr)

	for _, existingPermission := range role.Permissions {
		if existingPermission == permission {
			return
		}
	}

	role.Permissions = append(role.Permissions, permission)

	_, appErr = th.App.UpdateRole(role)
	require.Nil(th.tb, appErr)
}
