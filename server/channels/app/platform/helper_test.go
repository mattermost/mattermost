// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type TestHelper struct {
	Context request.CTX
	Service *PlatformService
	Suite   SuiteIFace
	Store   store.Store

	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	// BasicPost    *model.Post

	SystemAdminUser *model.User

	runShutdown sync.Once

	tempWorkspace string
}

type mockSuite struct{}

func (ms *mockSuite) SetStatusLastActivityAt(userID string, activityAt int64) {}
func (ms *mockSuite) SetStatusOffline(userID string, manual bool, force bool) {}
func (ms *mockSuite) IsUserAway(lastActivityAt int64) bool                    { return false }
func (ms *mockSuite) SetStatusOnline(userID string, manual bool)              {}
func (ms *mockSuite) UpdateLastActivityAtIfNeeded(session model.Session)      {}
func (ms *mockSuite) SetStatusAwayIfNeeded(userID string, manual bool)        {}
func (ms *mockSuite) GetSession(token string) (*model.Session, *model.AppError) {
	return &model.Session{}, nil
}
func (ms *mockSuite) RolesGrantPermission(roleNames []string, permissionId string) bool { return true }
func (ms *mockSuite) UserCanSeeOtherUser(rctx request.CTX, userID string, otherUserId string) (bool, *model.AppError) {
	return true, nil
}

func (ms *mockSuite) HasPermissionToReadChannel(rctx request.CTX, userID string, channel *model.Channel) bool {
	return true
}

func (ms *mockSuite) MFARequired(rctx request.CTX) *model.AppError {
	return nil
}

func setupDBStore(tb testing.TB) (store.Store, *model.SqlSettings) {
	var dbStore store.Store
	var dbSettings *model.SqlSettings
	if mainHelper.Options.RunParallel {
		dbStore, _, dbSettings, _ = mainHelper.GetNewStores(tb)
		tb.Cleanup(func() {
			dbStore.Close()
		})
	} else {
		dbStore = mainHelper.GetStore()
		dbStore.DropAllTables()
		dbStore.MarkSystemRanUnitTests()
		dbSettings = mainHelper.Settings
		mainHelper.PreloadMigrations()
	}

	return dbStore, dbSettings
}

func Setup(tb testing.TB, options ...Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore, dbSettings := setupDBStore(tb)

	return setupTestHelper(dbStore, dbSettings, false, true, tb, options...)
}

func (th *TestHelper) InitBasic(tb testing.TB) *TestHelper {
	th.SystemAdminUser = th.CreateAdmin(tb)

	th.BasicUser = th.CreateUserOrGuest(tb, false)

	th.BasicUser2 = th.CreateUserOrGuest(tb, false)

	th.BasicTeam = th.CreateTeam(tb)

	// th.LinkUserToTeam(t, th.BasicUser, th.BasicTeam)
	// th.LinkUserToTeam(t, th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(tb, th.BasicTeam)
	// th.BasicPost = th.CreatePost(t, th.BasicChannel)
	return th
}

func SetupWithStoreMock(tb testing.TB, options ...Option) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	options = append(options, StoreOverride(mockStore))
	th := setupTestHelper(mockStore, &model.SqlSettings{}, false, false, tb, options...)
	return th
}

func SetupWithCluster(tb testing.TB, cluster einterfaces.ClusterInterface) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore, dbSettings := setupDBStore(tb)

	th := setupTestHelper(dbStore, dbSettings, true, true, tb)
	th.Service.clusterIFace = cluster

	return th
}

func setupTestHelper(dbStore store.Store, dbSettings *model.SqlSettings, enterprise bool, includeCacheLayer bool, tb testing.TB, options ...Option) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "apptest")
	require.NoError(tb, err)

	configStore := config.NewTestMemoryStore()

	memoryConfig := configStore.Get()
	memoryConfig.SqlSettings = *dbSettings
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests
	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false
	*memoryConfig.MetricsSettings.Enable = true
	*memoryConfig.ServiceSettings.ListenAddress = "localhost:0"
	*memoryConfig.MetricsSettings.ListenAddress = "localhost:0"
	_, _, err = configStore.Set(memoryConfig)
	require.NoError(tb, err)

	options = append(options, ConfigStore(configStore))

	ps, err := New(
		ServiceConfig{
			Store: dbStore,
		}, options...)
	if err != nil {
		require.NoError(tb, err)
	}

	th := &TestHelper{
		Context:       request.TestContext(tb),
		Service:       ps,
		Suite:         &mockSuite{},
		Store:         dbStore,
		tempWorkspace: tempWorkspace,
	}

	if _, ok := dbStore.(*mocks.Store); ok {
		statusMock := mocks.StatusStore{}
		statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
		statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
		statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
		statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
		emptyMockStore := mocks.Store{}
		emptyMockStore.On("Close").Return(nil)
		emptyMockStore.On("Status").Return(&statusMock)
		th.Service.Store = &emptyMockStore
	}

	// Share same configuration with app.TestHelper
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.MaxUsersPerTeam = 50
		*cfg.RateLimitSettings.Enable = false
		*cfg.TeamSettings.EnableOpenServer = true
	})

	// Disable strict password requirements for test
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 5
		*cfg.PasswordSettings.Lowercase = false
		*cfg.PasswordSettings.Uppercase = false
		*cfg.PasswordSettings.Symbol = false
		*cfg.PasswordSettings.Number = false
	})

	if enterprise {
		th.Service.SetLicense(model.NewTestLicense())
	} else {
		th.Service.SetLicense(nil)
	}

	err = th.Service.Start(nil)
	require.NoError(tb, err)

	tb.Cleanup(func() {
		th.Shutdown(tb)
	})

	return th
}

// Shutdown may be called by tests to manually shut down the [TestHelper].
// If it's not called manually, it will get called automatically via [testing.TB.Cleanup].
func (th *TestHelper) Shutdown(tb testing.TB) {
	th.runShutdown.Do(func() {
		err := th.Service.ShutdownMetrics()
		require.NoError(tb, err)
		err = th.Service.Shutdown()
		require.NoError(tb, err)
		err = th.Service.ShutdownConfig()
		require.NoError(tb, err)
		if th.tempWorkspace != "" {
			err := os.RemoveAll(th.tempWorkspace)
			require.NoError(tb, err)
		}
	})
}

func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	id := model.NewId()

	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	team, err := th.Service.Store.Team().Save(team)
	require.NoError(tb, err)

	return team
}

func (th *TestHelper) CreateUserOrGuest(tb testing.TB, guest bool) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
		Roles:         model.SystemUserRoleId,
	}

	user, err := th.Service.Store.User().Save(th.Context, user)
	require.NoError(tb, err)

	return user
}

func (th *TestHelper) CreateAdmin(tb testing.TB) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
		Roles:         model.SystemAdminRoleId + " " + model.SystemUserRoleId,
	}

	user, err := th.Service.Store.User().Save(th.Context, user)
	require.NoError(tb, err)

	return user
}

type ChannelOption func(*model.Channel)

func WithShared(v bool) ChannelOption {
	return func(channel *model.Channel) {
		channel.Shared = model.NewPointer(v)
	}
}

func (th *TestHelper) CreateChannel(tb testing.TB, team *model.Team, options ...ChannelOption) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.ChannelTypeOpen,
	}

	for _, option := range options {
		option(channel)
	}

	channel, err := th.Service.Store.Channel().Save(th.Context, channel, 999)
	require.NoError(tb, err)

	return channel
}
