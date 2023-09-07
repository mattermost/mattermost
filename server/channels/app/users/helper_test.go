// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"bytes"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
)

var initBasicOnce sync.Once

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

func setupTestHelper(s store.Store, includeCacheLayer bool, tb testing.TB) *TestHelper {
	tempWorkspace, err := os.MkdirTemp("", "userservicetest")
	if err != nil {
		panic(err)
	}

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
	configStore.Set(config)

	buffer := &bytes.Buffer{}
	return &TestHelper{
		service: &UserService{
			store:        s.User(),
			sessionStore: s.Session(),
			oAuthStore:   s.OAuth(),
			config:       configStore.Get,
		},
		Context:     request.EmptyContext(nil),
		configStore: configStore,
		dbStore:     s,
		LogBuffer:   buffer,
		workspace:   tempWorkspace,
	}
}

func (th *TestHelper) InitBasic() *TestHelper {
	// create users once and cache them because password hashing is slow
	initBasicOnce.Do(func() {
		th.SystemAdminUser = th.CreateUser()
		th.SystemAdminUser, _ = th.service.GetUser(th.SystemAdminUser.Id)

		th.BasicUser = th.CreateUser()
		th.BasicUser, _ = th.service.GetUser(th.BasicUser.Id)

		th.BasicUser2 = th.CreateUser()
		th.BasicUser2, _ = th.service.GetUser(th.BasicUser2.Id)
	})

	return th
}

func (th *TestHelper) CreateUser() *model.User {
	return th.CreateUserOrGuest(false)
}

func (th *TestHelper) CreateGuest() *model.User {
	return th.CreateUserOrGuest(true)
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

	var err error
	if guest {
		if user, err = th.service.CreateUser(user, UserCreateOptions{Guest: true}); err != nil {
			panic(err)
		}
	} else {
		if user, err = th.service.CreateUser(user, UserCreateOptions{}); err != nil {
			panic(err)
		}
	}
	return user
}

func (th *TestHelper) TearDown() {
	th.configStore.Close()

	th.dbStore.Close()

	if th.workspace != "" {
		os.RemoveAll(th.workspace)
	}
}

func (th *TestHelper) UpdateConfig(f func(*model.Config)) {
	if th.configStore.IsReadOnly() {
		return
	}
	old := th.configStore.Get()
	updated := old.Clone()
	f(updated)
	if _, _, err := th.configStore.Set(updated); err != nil {
		panic(err)
	}
}
