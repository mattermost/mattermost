// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/config"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

type TestHelper struct {
	service     *TeamService
	configStore *config.Store
	dbStore     store.Store
	workspace   string

	Context   *request.Context
	LogBuffer *bytes.Buffer
}

type mockWebHub struct{}

func (mockWebHub) Publish(*model.WebSocketEvent) {}

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
	tempWorkspace, err := os.MkdirTemp("", "teamservicetest")
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
		service: &TeamService{
			store:        s.Team(),
			channelStore: s.Channel(),
			groupStore:   s.Group(),
			config:       configStore.Get,
			license: func() *model.License {
				return model.NewTestLicense()
			},
			wh: &mockWebHub{},
		},
		Context:     request.EmptyContext(nil),
		configStore: configStore,
		dbStore:     s,
		LogBuffer:   buffer,
		workspace:   tempWorkspace,
	}
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

func (th *TestHelper) CreateUser(u *model.User) *model.User {
	u.EmailVerified = true
	user, err := th.dbStore.User().Save(u)
	if err != nil {
		panic(err)
	}

	return user
}

func (th *TestHelper) DeleteUser(u *model.User) {
	err := th.dbStore.User().PermanentDelete(u.Id)
	if err != nil {
		panic(err)
	}
}

func (th *TestHelper) DeleteTeam(t *model.Team) {
	if err := th.dbStore.Channel().PermanentDeleteByTeam(t.Id); err != nil {
		panic(err)
	}

	if err := th.dbStore.Team().RemoveAllMembersByTeam(t.Id); err != nil {
		panic(err)
	}

	if err := th.dbStore.Team().PermanentDelete(t.Id); err != nil {
		panic(err)
	}
}
