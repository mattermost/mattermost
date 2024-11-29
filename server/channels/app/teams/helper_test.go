// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
)

type TestHelper struct {
	service     *TeamService
	configStore *config.Store
	dbStore     store.Store
	workspace   string

	Context   *request.Context
	LogBuffer *bytes.Buffer
	TB        testing.TB
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
		Context:     request.EmptyContext(mlog.CreateConsoleTestLogger(tb)),
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
	_, _, err := th.configStore.Set(updated)
	require.NoError(th.TB, err)
}

func (th *TestHelper) CreateUser(u *model.User) *model.User {
	u.EmailVerified = true
	user, err := th.dbStore.User().Save(th.Context, u)
	require.NoError(th.TB, err)

	return user
}

func (th *TestHelper) DeleteUser(u *model.User) {
	err := th.dbStore.User().PermanentDelete(th.Context, u.Id)
	require.NoError(th.TB, err)
}

func (th *TestHelper) DeleteTeam(t *model.Team) {
	err := th.dbStore.Channel().PermanentDeleteByTeam(t.Id)
	require.NoError(th.TB, err)

	err = th.dbStore.Team().RemoveAllMembersByTeam(t.Id)
	require.NoError(th.TB, err)

	err = th.dbStore.Team().PermanentDelete(t.Id)
	require.NoError(th.TB, err)
}
