// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"io/ioutil"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type TestHelper struct {
	Service *PlatformService
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, false, true, tb)
}

func setupTestHelper(dbStore store.Store, enterprise bool, includeCacheLayer bool, tb testing.TB) *TestHelper {
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
	configStore.Set(memoryConfig)

	ps, err := New(ServiceConfig{
		ConfigStore: configStore,
	})
	if err != nil {
		panic(err)
	}

	th := &TestHelper{
		Service: ps,
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

	return th
}

func (th *TestHelper) TearDown() {
	// Add cleaning code here
}
