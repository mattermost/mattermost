// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testlib

import (
	"flag"
	"fmt"
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
	settings         *model.SqlSettings
	testStore        *TestStore
	sqlSupplier      *sqlstore.SqlSupplier
	clusterInterface *FakeClusterInterface

	status           int
	testResourcePath string
}

func NewMainHelper(setupDb bool) *MainHelper {
	var mainHelper MainHelper
	flag.Parse()

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

	if setupDb {
		driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
		if driverName == "" {
			driverName = model.DATABASE_DRIVER_MYSQL
		}

		mainHelper.settings = storetest.MakeSqlSettings(driverName)

		mainHelper.clusterInterface = &FakeClusterInterface{}
		mainHelper.sqlSupplier = sqlstore.NewSqlSupplier(*mainHelper.settings, nil)
		mainHelper.testStore = &TestStore{
			store.NewLayeredStore(mainHelper.sqlSupplier, nil, mainHelper.clusterInterface),
		}

	}

	mainHelper.testResourcePath = SetupTestResources()
	return &mainHelper
}

func (h *MainHelper) Main(m *testing.M) {
	prevDir, err := os.Getwd()
	if err != nil {
		panic("Failed to get current working directory: " + err.Error())
	}

	err = os.Chdir(h.testResourcePath)
	if err != nil {
		panic(fmt.Sprintf("Failed to set current working directory to %s: %s", h.testResourcePath, err.Error()))
	}

	defer func() {
		err := os.Chdir(prevDir)
		if err != nil {
			panic(fmt.Sprintf("Failed to restore current working directory to %s: %s", prevDir, err.Error()))
		}
	}()

	h.status = m.Run()
}

func (h *MainHelper) Close() error {
	if h.settings != nil {
		storetest.CleanupSqlSettings(h.settings)
	}
	os.RemoveAll(h.testResourcePath)

	os.Exit(h.status)

	return nil
}

func (h *MainHelper) GetSqlSettings() *model.SqlSettings {
	if h.settings == nil {
		panic("MainHelper not initialized with database access.")
	}

	return h.settings
}

func (h *MainHelper) GetStore() store.Store {
	if h.testStore == nil {
		panic("MainHelper not initialized with store.")
	}

	return h.testStore
}

func (h *MainHelper) GetSqlSupplier() *sqlstore.SqlSupplier {
	if h.sqlSupplier == nil {
		panic("MainHelper not initialized with sql supplier.")
	}

	return h.sqlSupplier
}

func (h *MainHelper) GetClusterInterface() *FakeClusterInterface {
	if h.clusterInterface == nil {
		panic("MainHelper not initialized with sql supplier.")
	}

	return h.clusterInterface
}
