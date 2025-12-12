// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
	"github.com/stretchr/testify/require"
)

type TestHelper struct {
	service     *Service
	configStore *config.Store
	store       store.Store
	workspace   string

	BasicTeam    *model.Team
	BasicChannel *model.Channel
	BasicUser    *model.User
	BasicUser2   *model.User

	SystemAdminUser *model.User

	Context request.CTX
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	var dbStore store.Store
	if mainHelper.Options.RunParallel {
		dbStore, _, _, _ = mainHelper.GetNewStores(tb)
		tb.Cleanup(func() {
			dbStore.Close()
		})
	} else {
		dbStore = mainHelper.GetStore()
		dbStore.DropAllTables()
		dbStore.MarkSystemRanUnitTests()
		mainHelper.PreloadMigrations()
	}

	return setupTestHelper(dbStore, tb)
}

func SetupWithStoreMock(tb testing.TB) *TestHelper {
	mockStore := testlib.GetMockStoreForSetupFunctions()
	th := setupTestHelper(mockStore, tb)
	statusMock := mocks.StatusStore{}
	statusMock.On("UpdateExpiredDNDStatuses").Return([]*model.Status{}, nil)
	statusMock.On("Get", "user1").Return(&model.Status{UserId: "user1", Status: model.StatusOnline}, nil)
	statusMock.On("UpdateLastActivityAt", "user1", mock.Anything).Return(nil)
	statusMock.On("SaveOrUpdate", mock.AnythingOfType("*model.Status")).Return(nil)
	emptyMockStore := mocks.Store{}
	emptyMockStore.On("Close").Return(nil)
	emptyMockStore.On("Status").Return(&statusMock)
	th.service.store = &emptyMockStore
	return th
}

func setupTestHelper(s store.Store, tb testing.TB) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "userservicetest")
	require.NoError(tb, err)

	configStore := config.NewTestMemoryStore()

	config := configStore.Get()
	*config.PluginSettings.Directory = filepath.Join(tempWorkspace, "plugins")
	*config.PluginSettings.ClientDirectory = filepath.Join(tempWorkspace, "webapp")
	*config.PluginSettings.AutomaticPrepackagedPlugins = false
	*config.LogSettings.EnableSentry = false // disable error reporting during tests
	*config.AnnouncementSettings.AdminNoticesEnabled = false
	*config.AnnouncementSettings.UserNoticesEnabled = false
	*config.TeamSettings.MaxUsersPerTeam = 50
	*config.RateLimitSettings.Enable = false
	*config.TeamSettings.EnableOpenServer = true
	// Disable strict password requirements for test
	*config.PasswordSettings.MinimumLength = 5
	*config.PasswordSettings.Lowercase = false
	*config.PasswordSettings.Uppercase = false
	*config.PasswordSettings.Symbol = false
	*config.PasswordSettings.Number = false
	_, _, err = configStore.Set(config)
	require.NoError(tb, err)

	licenseFn := func() *model.License { return model.NewTestLicense() }

	us, err := users.New(users.ServiceConfig{
		UserStore:    s.User(),
		SessionStore: s.Session(),
		OAuthStore:   s.OAuth(),
		ConfigFn:     configStore.Get,
		LicenseFn:    licenseFn,
	})
	require.NoError(tb, err)

	templatesDir, ok := templates.GetTemplateDirectory()
	require.True(tb, ok)
	htmlTemplateWatcher, errorsChan, err := templates.NewWithWatcher(templatesDir)
	require.NoError(tb, err)

	go func() {
		for err2 := range errorsChan {
			mlog.Error("Server templates error", mlog.Err(err2))
		}
	}()

	service := &Service{
		store:              s,
		userService:        us,
		license:            licenseFn,
		config:             configStore.Get,
		templatesContainer: htmlTemplateWatcher,
	}

	err = service.setUpRateLimiters()
	require.NoError(tb, err)

	tb.Cleanup(func() {
		err := configStore.Close()
		require.NoError(tb, err)

		s.Close()

		if tempWorkspace != "" {
			os.RemoveAll(tempWorkspace)
		}
	})

	return &TestHelper{
		service:     service,
		configStore: configStore,
		store:       s,
		workspace:   tempWorkspace,
		Context:     request.TestContext(tb),
	}
}

func (th *TestHelper) InitBasic(tb testing.TB) *TestHelper {
	var err error
	th.BasicTeam = th.CreateTeam(tb)

	th.SystemAdminUser = th.CreateUser(tb)
	th.SystemAdminUser, err = th.service.userService.GetUser(th.SystemAdminUser.Id)
	require.NoError(tb, err)
	th.addUserToTeam(tb, th.BasicTeam, th.SystemAdminUser)

	th.BasicUser = th.CreateUser(tb)
	th.BasicUser, err = th.service.userService.GetUser(th.BasicUser.Id)
	require.NoError(tb, err)
	th.addUserToTeam(tb, th.BasicTeam, th.BasicUser)

	th.BasicUser2 = th.CreateUser(tb)
	th.BasicUser2, err = th.service.userService.GetUser(th.BasicUser2.Id)
	require.NoError(tb, err)
	th.addUserToTeam(tb, th.BasicTeam, th.BasicUser2)

	th.BasicChannel = th.createChannel(tb, th.BasicTeam, string(model.ChannelTypeOpen))
	th.addUserToChannel(tb, th.BasicChannel, th.SystemAdminUser)
	th.addUserToChannel(tb, th.BasicChannel, th.BasicUser)
	th.addUserToChannel(tb, th.BasicChannel, th.BasicUser2)

	return th
}

func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	team, err := th.store.Team().Save(team)
	require.NoError(tb, err)

	return team
}

func (th *TestHelper) createChannel(tb testing.TB, team *model.Team, channelType string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        "name_" + id,
		Type:        model.ChannelType(channelType),
		TeamId:      team.Id,
		CreatorId:   th.BasicUser.Id,
	}

	channel, err := th.store.Channel().Save(th.Context, channel, *th.configStore.Get().TeamSettings.MaxChannelsPerTeam)
	require.NoError(tb, err)

	return channel
}

func (th *TestHelper) addUserToChannel(tb testing.TB, channel *model.Channel, user *model.User) *model.ChannelMember {
	newMember := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
	}

	newMember, err := th.store.Channel().SaveMember(th.Context, newMember)
	require.NoError(tb, err)

	return newMember
}

func (th *TestHelper) addUserToTeam(tb testing.TB, team *model.Team, user *model.User) *model.TeamMember {
	tm := &model.TeamMember{
		TeamId:      team.Id,
		UserId:      user.Id,
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
	}

	tm, err := th.store.Team().SaveMember(th.Context, tm, *th.service.config().TeamSettings.MaxUsersPerTeam)
	require.NoError(tb, err)

	return tm
}

func (th *TestHelper) CreateUser(tb testing.TB) *model.User {
	return th.CreateUserOrGuest(tb, false)
}

func (th *TestHelper) CreateGuest(tb testing.TB) *model.User {
	return th.CreateUserOrGuest(tb, true)
}

func (th *TestHelper) CreateUserOrGuest(tb testing.TB, guest bool) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}

	var err error
	if guest {
		user, err = th.service.userService.CreateUser(th.Context, user, users.UserCreateOptions{Guest: true})
		require.NoError(tb, err)
	} else {
		user, err = th.service.userService.CreateUser(th.Context, user, users.UserCreateOptions{})
		require.NoError(tb, err)
	}
	return user
}

func (th *TestHelper) UpdateConfig(tb testing.TB, f func(*model.Config)) {
	if th.configStore.IsReadOnly() {
		return
	}
	old := th.configStore.Get()
	updated := old.Clone()
	f(updated)
	_, _, err := th.configStore.Set(updated)
	require.NoError(tb, err)
}

func (th *TestHelper) ConfigureInbucketMail(tb testing.TB) {
	inbucket_host := os.Getenv("CI_INBUCKET_HOST")
	if inbucket_host == "" {
		inbucket_host = "localhost"
	}
	inbucket_port := os.Getenv("CI_INBUCKET_SMTP_PORT")
	if inbucket_port == "" {
		inbucket_port = "10025"
	}
	th.UpdateConfig(tb, func(cfg *model.Config) {
		*cfg.EmailSettings.SMTPServer = inbucket_host
		*cfg.EmailSettings.SMTPPort = inbucket_port
	})
}
