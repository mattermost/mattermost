// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/stretchr/testify/require"
)

type TestHelper struct {
	service     *UserService
	configStore *config.Store
	dbStore     store.Store
	workspace   string

	Context    *request.Context
	BasicUser  *model.User
	BasicUser2 *model.User

	SystemAdminUser *model.User
	LogBuffer       *bytes.Buffer
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, false, tb)
}

func setupTestHelper(s store.Store, _ bool, tb testing.TB) *TestHelper {
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

	buffer := &bytes.Buffer{}

	tb.Cleanup(func() {
		err := configStore.Close()
		require.NoError(tb, err)

		s.Close()

		if tempWorkspace != "" {
			os.RemoveAll(tempWorkspace)
		}
	})

	return &TestHelper{
		service: &UserService{
			store:        s.User(),
			sessionStore: s.Session(),
			oAuthStore:   s.OAuth(),
			config:       configStore.Get,
		},
		Context:     request.EmptyContext(mlog.CreateConsoleTestLogger(tb)),
		configStore: configStore,
		dbStore:     s,
		LogBuffer:   buffer,
		workspace:   tempWorkspace,
	}
}

func (th *TestHelper) InitBasic(tb testing.TB) *TestHelper {
	var err error

	th.SystemAdminUser = th.CreateUser(tb)
	th.SystemAdminUser, err = th.service.GetUser(th.SystemAdminUser.Id)
	require.NoError(tb, err)

	th.BasicUser = th.CreateUser(tb)
	th.BasicUser, err = th.service.GetUser(th.BasicUser.Id)
	require.NoError(tb, err)

	th.BasicUser2 = th.CreateUser(tb)
	th.BasicUser2, err = th.service.GetUser(th.BasicUser2.Id)
	require.NoError(tb, err)

	return th
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
		user, err = th.service.CreateUser(th.Context, user, UserCreateOptions{Guest: true})
		require.NoError(tb, err)
	} else {
		user, err = th.service.CreateUser(th.Context, user, UserCreateOptions{})
		require.NoError(tb, err)
	}

	return user
}
