// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testlib

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

type MainHelper struct {
	Settings         *model.SqlSettings
	Store            store.Store
	SqlSupplier      *sqlstore.SqlSupplier
	ClusterInterface *FakeClusterInterface

	container *storetest.RunningContainer
	status    int
}

func NewMainHelper() *MainHelper {
	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing.
	// Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	utils.TranslationsPreInit()

	container, settings, err := storetest.NewMySQLContainer()
	if err != nil {
		panic("failed to start mysql container: " + err.Error())
	}

	testClusterInterface := &FakeClusterInterface{}
	testStoreSqlSupplier := sqlstore.NewSqlSupplier(*settings, nil)
	testStore := &TestStore{store.NewLayeredStore(testStoreSqlSupplier, nil, testClusterInterface)}

	return &MainHelper{
		Settings:         settings,
		Store:            testStore,
		SqlSupplier:      testStoreSqlSupplier,
		ClusterInterface: testClusterInterface,
		container:        container,
	}
}

func (h *MainHelper) Main(m *testing.M) {
	h.status = m.Run()
}

func (h *MainHelper) Close() error {
	h.container.Stop()
	h.container = nil

	os.Exit(h.status)

	return nil
}
