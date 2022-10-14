// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"io/ioutil"
	"path/filepath"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/testlib"
	"github.com/stretchr/testify/mock"
)

type TestHelper struct {
	Service *PlatformService
	Suite   SuiteIFace

	BasicTeam    *model.Team
	BasicUser    *model.User
	BasicUser2   *model.User
	BasicChannel *model.Channel
	// BasicPost    *model.Post

	SystemAdminUser *model.User
}

var initBasicOnce sync.Once
var userCache struct {
	SystemAdminUser *model.User
	BasicUser       *model.User
	BasicUser2      *model.User
}

type mockSuite struct {
}

func (ms *mockSuite) SetStatusLastActivityAt(userID string, activityAt int64) {}
func (ms *mockSuite) SetStatusOffline(userID string, manual bool)             {}
func (ms *mockSuite) IsUserAway(lastActivityAt int64) bool                    { return false }
func (ms *mockSuite) SetStatusOnline(userID string, manual bool)              {}
func (ms *mockSuite) UpdateLastActivityAtIfNeeded(session model.Session)      {}
func (ms *mockSuite) SetStatusAwayIfNeeded(userID string, manual bool)        {}
func (ms *mockSuite) GetSession(token string) (*model.Session, *model.AppError) {
	return &model.Session{}, nil
}
func (ms *mockSuite) RolesGrantPermission(roleNames []string, permissionId string) bool { return true }
func (ms *mockSuite) UserCanSeeOtherUser(userID string, otherUserId string) (bool, *model.AppError) {
	return true, nil
}

func Setup(tb testing.TB, options ...Option) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, false, true, tb, options...)
}

func (th *TestHelper) InitBasic() *TestHelper {
	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		th.SystemAdminUser = th.CreateAdmin()
		userCache.SystemAdminUser = th.SystemAdminUser.DeepCopy()

		th.BasicUser = th.CreateUserOrGuest(false)
		userCache.BasicUser = th.BasicUser.DeepCopy()

		th.BasicUser2 = th.CreateUserOrGuest(false)
		userCache.BasicUser2 = th.BasicUser2.DeepCopy()
	})
	// restore cached users
	th.SystemAdminUser = userCache.SystemAdminUser.DeepCopy()
	th.BasicUser = userCache.BasicUser.DeepCopy()
	th.BasicUser2 = userCache.BasicUser2.DeepCopy()

	users := []*model.User{th.SystemAdminUser, th.BasicUser, th.BasicUser2}
	mainHelper.GetSQLStore().User().InsertUsers(users)

	th.BasicTeam = th.CreateTeam()

	// th.LinkUserToTeam(th.BasicUser, th.BasicTeam)
	// th.LinkUserToTeam(th.BasicUser2, th.BasicTeam)
	th.BasicChannel = th.CreateChannel(th.BasicTeam)
	// th.BasicPost = th.CreatePost(th.BasicChannel)
	return th
}

func SetupWithStoreMock(tb testing.TB, options ...Option) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, false, false, tb, options...)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.Service.Store = &emptyMockStore
	return th
}

func SetupWithCluster(tb testing.TB, cluster einterfaces.ClusterInterface) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	th := setupTestHelper(dbStore, true, true, tb)
	th.Service.clusterIFace = cluster

	return th
}

func setupTestHelper(dbStore store.Store, enterprise bool, includeCacheLayer bool, tb testing.TB, options ...Option) *TestHelper {
	tempWorkspace, err := ioutil.TempDir("", "apptest")
	if err != nil {
		panic(err)
	}

	configStore := config.NewTestMemoryStore()

	memoryConfig := configStore.Get()
	*memoryConfig.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*memoryConfig.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*memoryConfig.PluginSettings.AutomaticPrepackagedPlugins = false
	*memoryConfig.LogSettings.EnableSentry = false // disable error reporting during tests
	*memoryConfig.AnnouncementSettings.AdminNoticesEnabled = false
	*memoryConfig.AnnouncementSettings.UserNoticesEnabled = false
	*memoryConfig.MetricsSettings.Enable = true
	*memoryConfig.ServiceSettings.ListenAddress = ":0"
	*memoryConfig.MetricsSettings.ListenAddress = ":0"
	configStore.Set(memoryConfig)

	ps, err := New(ServiceConfig{
		ConfigStore: configStore,
		Store:       dbStore,
	}, options...)
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		Service: ps,
		Suite:   &mockSuite{},
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

	err = th.Service.Start(th.Suite)
	if err != nil {
		panic(err)
	}

	return th
}

func (th *TestHelper) TearDown() {
	th.Service.ShutdownMetrics()
	th.Service.Shutdown()
	th.Service.ShutdownConfig()
}

func (th *TestHelper) CreateTeam() *model.Team {
	id := model.NewId()

	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	var err error
	if team, err = th.Service.Store.Team().Save(team); err != nil {
		panic(err)
	}
	return team
}

func (th *TestHelper) CreateUserOrGuest(guest bool) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
		Roles:         model.SystemUserRoleId,
	}

	var err error
	user, err = th.Service.Store.User().Save(user)
	if err != nil {
		panic(err)
	}

	return user
}

func (th *TestHelper) CreateAdmin() *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
		Roles:         model.SystemAdminRoleId + " " + model.SystemUserRoleId,
	}

	var err error
	user, err = th.Service.Store.User().Save(user)
	if err != nil {
		panic(err)
	}

	return user
}

type ChannelOption func(*model.Channel)

func WithShared(v bool) ChannelOption {
	return func(channel *model.Channel) {
		channel.Shared = model.NewBool(v)
	}
}

func (th *TestHelper) CreateChannel(team *model.Team, options ...ChannelOption) *model.Channel {
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

	var err error
	channel, err = th.Service.Store.Channel().Save(channel, 999)
	if err != nil {
		panic(err)
	}

	return channel
}
